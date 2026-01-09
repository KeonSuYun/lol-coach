"""
AI 分析路由模块
负责处理 AI 战术分析相关的接口
"""

import os
import json
import time
import re
import asyncio
from pathlib import Path
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from openai import AsyncOpenAI

from routers.dependencies import get_current_user, db
from core.logger import logger

# 创建路由实例
router = APIRouter()

# ================= 全局变量引入 =================
current_dir = Path(__file__).resolve().parent.parent
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

# 从 server.py 引入的全局变量 (需在启动时初始化)
CHAMPION_NAME_MAP = {}
CHAMPION_CACHE = {}
ANALYZE_LIMIT_STORE = {}

# 初始化异步 OpenAI 客户端
client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)

# ================= 数据模型 =================

class AnalyzeRequest(BaseModel):
    mode: str
    myHero: str = ""
    enemyHero: str = ""
    myTeam: List[str] = []
    enemyTeam: List[str] = []
    userRole: str = ""

    #  新增段位字段,默认为黄金/白金
    rank: str = "Gold"
    #  [新增] 接收地图方位参数
    mapSide: str = "unknown"

    myLaneAssignments: Optional[Dict[str, str]] = None
    enemyLaneAssignments: Optional[Dict[str, str]] = None
    model_type: str = "chat" # 'chat' or 'reasoner'

    #  [关键修复] 添加 extraMechanics 字段
    # 允许接收 HexLite 发送的实时技能包 (Dict: 英雄名 -> 技能描述文本)
    extraMechanics: Optional[Dict[str, str]] = {}

# ================= 辅助函数 =================

def normalize_simple(name):
    """去除所有非字母数字字符并转小写 (Jarvan IV -> jarvaniv)"""
    if not name: return ""
    return re.sub(r'[^a-zA-Z0-9]+', '', name).lower()

def preload_champion_map():
    """预加载英雄名称映射"""
    global CHAMPION_NAME_MAP
    try:
        json_path = current_dir / "secure_data" / "champions.json"
        if not json_path.exists():
            logger.info(" 未找到 champions.json，名称自动纠错功能可能受限")
            return

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        count = 0
        for item in data:
            real_name = item.get("name")
            if not real_name: continue

            # 1. 记录标准名
            CHAMPION_NAME_MAP[real_name] = real_name
            # 2. 记录归一化名 (核心修复逻辑)
            CHAMPION_NAME_MAP[normalize_simple(real_name)] = real_name

            # 3. 记录别名 (如中文名)
            for alias in item.get("alias", []):
                CHAMPION_NAME_MAP[alias] = real_name
                CHAMPION_NAME_MAP[normalize_simple(alias)] = real_name
            count += 1

        # 4. 手动补丁 (处理 Riot API 特殊命名)
        CHAMPION_NAME_MAP["monkeyking"] = "Wukong"
        CHAMPION_NAME_MAP["wukong"] = "Wukong"
        CHAMPION_NAME_MAP["jarvaniv"] = "Jarvan IV" # 强制补充

        logger.info(f" [Init] 英雄名称自动纠错字典已加载: {len(CHAMPION_NAME_MAP)} 条索引")

    except Exception as e:
        logger.info(f" [Init] 名称映射加载失败: {e}")

def infer_team_roles(team_list: List[str], fixed_assignments: Optional[Dict[str, str]] = None):
    clean_team = [h.strip() for h in team_list if h] if team_list else []
    standard_roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]
    final_roles = {role: "Unknown" for role in standard_roles}
    assigned_heroes = set()

    if fixed_assignments:
        for role, hero_raw in fixed_assignments.items():
            if not hero_raw: continue
            role_upper = role.upper()
            hero = hero_raw.strip()
            if role_upper in standard_roles:
                final_roles[role_upper] = hero
                assigned_heroes.add(hero)

    remaining_heroes = []
    for h in clean_team:
        is_assigned = False
        for assigned in assigned_heroes:
            if h.lower() == assigned.lower():
                is_assigned = True
                break
        if not is_assigned:
            remaining_heroes.append(h)

    for hero in remaining_heroes:
        # 安全调用:如果 db 没有 get_champion_info 方法则返回 None
        hero_info = getattr(db, 'get_champion_info', lambda x: None)(hero)
        # 适配新版数据:role 已经是大写 TOP/MID 等
        pref_role = hero_info.get('role', 'MID').upper() if hero_info else "MID"

        target = pref_role
        if target not in standard_roles: target = "MID"

        if final_roles[target] == "Unknown":
            final_roles[target] = hero
        else:
            for r in standard_roles:
                if final_roles[r] == "Unknown":
                    final_roles[r] = hero
                    break

    return {k: v for k, v in final_roles.items() if v != "Unknown"}

def recommend_heroes_algo(db_instance, user_role, rank_tier, enemy_hero_doc=None):
    """
    根据段位和当前分路,计算推荐列表。
    完全移除对位 (Matchup) 逻辑,仅基于版本强度 (Tier/WinRate/PickRate)。
    """
    recommendations = []
    current_role = user_role.upper() # 确保是大写 (TOP/MID...)

    # 1. 获取所有英雄
    cursor = db_instance.champions_col.find({})

    candidates = []

    for hero in cursor:
        #  核心:只读取 seed_data.py 生成的 positions 字段
        positions_data = hero.get('positions', {})
        role_stats = positions_data.get(current_role)

        # 如果该英雄不打这个位置,跳过
        if not role_stats:
            continue

        # 2. 提取关键指标
        tier = role_stats.get('tier', 5)
        win_rate = role_stats.get('win_rate', 0)
        pick_rate = role_stats.get('pick_rate', 0)
        ban_rate = role_stats.get('ban_rate', 0)

        # 3. 计算得分 (Score)
        # 基础分:胜率 (0.50 -> 50分)
        score = win_rate * 100

        # 层级加权: T1=+25, T2=+15, T3=+5
        if tier == 1: score += 25
        elif tier == 2: score += 15
        elif tier == 3: score += 5
        else: score -= 5

        reason = ""

        # 4. 段位偏好逻辑
        if rank_tier == "Diamond+":
            #  高分段:看重 Meta (Pick率)
            score += pick_rate * 50
            reason = f"高分段T{tier}热门 (选取率: {pick_rate:.1%})"
        else:
            #  低分段:看重 胜率 & Ban率
            score += ban_rate * 20
            score += (win_rate - 0.5) * 100
            reason = f"当前版本T{tier}强势 (胜率: {win_rate:.1%})"

        #  已移除所有克制微调逻辑

        candidates.append({
            "name": hero['name'], # 存英文ID
            "score": score,
            "tier": f"T{tier}",
            "data": {
                # 统一口径:因为没有对位数据,这里填全局胜率,并在 Prompt 里修改解释
                "vs_win": f"{win_rate:.1%}",
                "lane_kill": "-",               # 明确标识无数据
                "win_rate": f"{win_rate:.1%}",
                "pick_rate": f"{pick_rate:.1%}",
                "games": "High"
            },
            "reason": reason
        })

    # 5. 排序并取 Top 3
    candidates.sort(key=lambda x: x['score'], reverse=True)
    return candidates[:3]

# ================= 路由处理函数 =================

@router.post("/analyze")
async def analyze_match(data: AnalyzeRequest, current_user: dict = Depends(get_current_user)):
    #  [防刷] 3秒冷却机制
    username = current_user['username']
    now = time.time()
    last_request_time = ANALYZE_LIMIT_STORE.get(username, 0)

    # 如果距离上次请求不足 3 秒,直接拒绝
    if now - last_request_time < 3:
        return JSONResponse(
            status_code=429,
            content={
                "concise": {
                    "title": "操作太快了",
                    "content": "请等待 AI 思考完毕后再试 (冷却中...)"
                }
            }
        )

    # 更新最后请求时间
    ANALYZE_LIMIT_STORE[username] = now

    # 1. API Key 检查
    if not DEEPSEEK_API_KEY:
         async def err(): yield json.dumps({"concise": {"title":"维护中", "content":"服务暂时不可用 (Configuration Error)"}})
         return StreamingResponse(err(), media_type="application/json")

    # 模式别名处理
    MODE_ALIASES = {
        "jungle_farming": "role_jungle_farming",
        # 未来你还可以加更多别名
    }

    def normalize_mode(mode: str) -> str:
        return MODE_ALIASES.get(mode, mode)

    # 在 check_and_update_usage 之前
    data.mode = normalize_mode(data.mode)

    # 2. 频控检查 (传入 model_type 进行分级计费)
    allowed, msg, remaining = db.check_and_update_usage(current_user['username'], data.mode, data.model_type)

    #  [修复核心] Test 2 零余额保护:明确返回 403 状态码
    if not allowed:
        return JSONResponse(
            status_code=403,
            content={
                "concise": {
                    "title": "请求被拒绝",
                    "content": msg + ("\n 升级 Pro 可解锁无限次使用！" if remaining == -1 else "")
                }
            }
        )

    #  5. 输入自动纠错 (JarvanIV -> Jarvan IV)
    def fix_name(n):
        if not n: return ""
        #  关键:放行 None,允许未选英雄
        if n == "None": return "None"
        # 优先查表修正,如果没查到则尝试归一化查,最后保留原值
        return CHAMPION_NAME_MAP.get(n) or CHAMPION_NAME_MAP.get(normalize_simple(n)) or n

    # 对所有可能涉及英雄名的字段进行清洗
    data.myHero = fix_name(data.myHero)
    data.enemyHero = fix_name(data.enemyHero)
    data.myTeam = [fix_name(h) for h in data.myTeam]
    data.enemyTeam = [fix_name(h) for h in data.enemyTeam]

    if data.myLaneAssignments:
        data.myLaneAssignments = {k: fix_name(v) for k, v in data.myLaneAssignments.items()}
    if data.enemyLaneAssignments:
        data.enemyLaneAssignments = {k: fix_name(v) for k, v in data.enemyLaneAssignments.items()}

    # 3. Input Sanitization (输入清洗 - 验证清洗后的名称)
    #  关键修改:如果是 "None",跳过数据库校验
    if data.myHero and data.myHero != "None":
        hero_info = db.get_champion_info(data.myHero)
        if not hero_info:
            async def attack_err(): yield json.dumps({"concise": {"title": "输入错误", "content": f"系统未识别英雄 '{data.myHero}'。"}})
            return StreamingResponse(attack_err(), media_type="application/json")

    if data.enemyHero and data.enemyHero != "None":
        hero_info = db.get_champion_info(data.enemyHero)
        if not hero_info:
            async def attack_err(): yield json.dumps({"concise": {"title": "输入错误", "content": f"系统未识别英雄 '{data.enemyHero}'。"}})
            return StreamingResponse(attack_err(), media_type="application/json")

    # 4. 数据准备 (修复版:正确读取 JSON 结构)
    game_constants = await run_in_threadpool(db.get_game_constants)

    # =========================================================
    #  【关键位置调整】辅助函数定义提前到这里! (解决 NameError)
    # =========================================================
    def get_hero_cn_name(hero_id):
        """优先提取中文名 (Alias > Name)"""
        if not hero_id or hero_id == "Unknown" or hero_id == "None": return hero_id

        info = CHAMPION_CACHE.get(hero_id) or db.get_champion_info(hero_id)
        if not info: return hero_id

        # 1. 尝试从 alias 列表取第一个 (通常是中文名,如 "赏金猎人")
        if info.get("alias") and isinstance(info["alias"], list) and len(info["alias"]) > 0:
            return info["alias"][0]

        # 2. 尝试 title (如 "赏金猎人"),如果有这个字段的话
        if info.get("title"):
            return info["title"]

        # 3. 兜底使用 name (Miss Fortune)
        return info.get("name", hero_id)

    def get_champ_meta(name):
        """获取英雄战术标签 (应用中文名)"""
        info = CHAMPION_CACHE.get(name) or db.get_champion_info(name)
        if info: CHAMPION_CACHE[name] = info

        if not info:
            return name, "常规英雄", "全期"

        #  修正点:使用 get_hero_cn_name 翻译名字
        c_name = get_hero_cn_name(name)

        # 1. 尝试获取自定义标签 (mechanic_type)
        c_type = info.get('mechanic_type')
        # 2. 如果没有,使用官方 tags 并简单汉化
        if not c_type:
            tags = info.get('tags', [])
            tag_map = {"Fighter":"战士", "Mage":"法师", "Assassin":"刺客", "Tank":"坦克", "Marksman":"射手", "Support":"辅助"}
            c_type = tag_map.get(tags[0], tags[0]) if tags else "常规英雄"

        c_power = info.get('power_spike', '全期')
        return c_name, c_type, c_power

    # 5. 分路计算
    my_roles_map = infer_team_roles(data.myTeam, data.myLaneAssignments)
    enemy_roles_map = infer_team_roles(data.enemyTeam, data.enemyLaneAssignments)

    # ---------------------------------------------------------
    #  核心逻辑:智能身份推断 (User Role Logic)
    # ---------------------------------------------------------
    user_role_key = "MID"
    manual_role_set = False

    # 优先级 1: 用户手动指定 (且有效)
    if data.userRole and data.userRole.upper() in ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]:
        user_role_key = data.userRole.upper()
        manual_role_set = True
    # 优先级 2: 根据选择的英雄在己方阵容中的位置推断 (仅当已选英雄时)
    elif data.myHero and data.myHero != "None":
        for r, h in my_roles_map.items():
            if h == data.myHero: user_role_key = r; break

    #  修正:如果用户没手动指定,且推断出的位置很奇怪(比如盲僧上单)
    # 我们查库看看这个英雄的"本命位置"是不是打野
    if not manual_role_set and data.myHero and data.myHero != "None":
        hero_info_doc = db.get_champion_info(data.myHero)
        if hero_info_doc and hero_info_doc.get('role') == 'jungle':
            # 检查队友里有没有更像打野的人
            teammate_roles = [db.get_champion_info(h).get('role') for h in data.myTeam if db.get_champion_info(h)]

            # 如果我是单人路,且队友里没人是主玩打野的,那大概率系统判错了,我才是打野
            if user_role_key in ["TOP", "MID"] and 'jungle' not in teammate_roles:
                user_role_key = "JUNGLE"
    # =========================================================
    #  [新增/搬运] 机制库动态过滤 (必须放在 user_role_key 确定之后)
    # =========================================================
    modules = game_constants.get('data_modules', {})
    mechanics_list = []

    for cat_key, cat_val in modules.items():
        if isinstance(cat_val, dict) and 'items' in cat_val:

            # 1. 屏蔽打野专属数据 (如果是线上玩家)
            if cat_key == 'jungle_data' and user_role_key != 'JUNGLE':
                continue

            # 2. 屏蔽打野高阶博弈
            if cat_key == 'jungle_pro_logic' and user_role_key != 'JUNGLE':
                continue

            for item in cat_val['items']:
                #  [新增核心逻辑] 分路任务精确过滤
                # 如果 item 中定义了 role_key (例如 "TOP"), 且与当前 user_role_key 不一致,则跳过
                target_role = item.get('role_key')
                if target_role and target_role != user_role_key:
                    continue

                mechanics_list.append(f"{item.get('name')}: {item.get('rule')} ({item.get('note')})")

    s16_details = "; ".join(mechanics_list)
    s16_context = f"【S16/分路与机制库】: {s16_details if s16_details else '暂无特殊机制数据'}"
    # ---------------------------------------------------------
    #  核心逻辑:智能生态构建 (Smart Context Logic)
    # ---------------------------------------------------------
    primary_enemy = "Unknown"

    #  统一变量:无论哪路,分析结果都存入这里,传给 Prompt 的 {compInfo} 插槽
    lane_matchup_context = ""

    # === A. 下路 (ADC/SUPPORT) 生态 ===
    if user_role_key in ["ADC", "SUPPORT"]:
        primary_enemy = enemy_roles_map.get(user_role_key, "Unknown")

        my_ad = my_roles_map.get("ADC", "Unknown")
        my_sup = my_roles_map.get("SUPPORT", "Unknown")
        en_ad = enemy_roles_map.get("ADC", "Unknown")
        en_sup = enemy_roles_map.get("SUPPORT", "Unknown")

        my_ad_n, my_ad_t, _ = get_champ_meta(my_ad)
        my_sup_n, my_sup_t, _ = get_champ_meta(my_sup)
        en_ad_n, en_ad_t, _ = get_champ_meta(en_ad)
        en_sup_n, en_sup_t, _ = get_champ_meta(en_sup)

        lane_matchup_context = f"""
        \n---------  下路2v2生态系统 (Bot Lane Ecosystem)  ---------
        【我方体系】:{my_ad_n} ({my_ad_t}) + {my_sup_n} ({my_sup_t})
        - 化学反应:这是一组由"{my_ad_t}"配合"{my_sup_t}"构建的防线。

        【敌方体系】:{en_ad_n} ({en_ad_t}) + {en_sup_n} ({en_sup_t})
        - 威胁来源:面对"{en_sup_t}"类型的辅助,请重点分析其开团手段或消耗能力。

        【博弈定性】:
        这是一场 [{my_ad_t}+{my_sup_t}] 对抗 [{en_ad_t}+{en_sup_t}] 的对局。
        请在【对线期博弈】中直接回答:
        1. 谁拥有线权?
        2. 谁拥有击杀压力?
        3. 2v2 打到底谁赢面大?
        -------------------------------------------------------------
        """

    # === B. 中单 (MID) ===
    #  修正:只针对中单生成"中野联动"Prompt,不包含打野
    elif user_role_key == "MID":
        primary_enemy = enemy_roles_map.get("MID", "Unknown")

        my_mid = my_roles_map.get("MID", "Unknown")
        my_jg = my_roles_map.get("JUNGLE", "Unknown")
        en_mid = enemy_roles_map.get("MID", "Unknown")
        en_jg = enemy_roles_map.get("JUNGLE", "Unknown")

        my_mid_n, my_mid_t, _ = get_champ_meta(my_mid)
        my_jg_n,  my_jg_t,  my_jg_p  = get_champ_meta(my_jg)
        en_mid_n, en_mid_t, _ = get_champ_meta(en_mid)
        en_jg_n,  en_jg_t,  _  = get_champ_meta(en_jg)

        lane_matchup_context = f"""
        \n---------  中野2v2节奏引擎 (Mid-Jungle Engine)  ---------
        【我方中野】:{my_mid_n} ({my_mid_t})  {my_jg_n} ({my_jg_t})
        - 联动逻辑:基于我方打野是"{my_jg_t}",中单应扮演什么角色?
        - 强势期:注意 {my_jg_n} 的强势期在【{my_jg_p}】,请据此规划前15分钟节奏。

        【敌方中野】:{en_mid_n} ({en_mid_t})  {en_jg_n} ({en_jg_t})
        - 警报:敌方是"{en_mid_t}"+"{en_jg_t}"的组合。请计算他们在中路或河道的 2v2 爆发能力。

        【博弈定性】:
        这是一场 [{my_mid_t}+{my_jg_t}] VS [{en_mid_t}+{en_jg_t}] 的节奏对抗。
        请在【前期博弈】中明确回答:
        1. 河道主权:3分30秒河蟹刷新时,哪边中野更强?
        2. 先手权:谁拥有推线游走的主动权?
        -------------------------------------------------------------
        """

    # === C. 打野 (JUNGLE) ===
    #  修正:打野使用专属的 Prompts 模板,不生成额外的 Python Context 指令
    # === C. 打野 (JUNGLE) ===
    #  修正:为打野注入全图对线生态,防止敌我不分
    elif user_role_key == "JUNGLE":
        primary_enemy = enemy_roles_map.get("JUNGLE", "Unknown")
        if primary_enemy == "Unknown" and data.enemyHero and data.enemyHero != "None":
            primary_enemy = data.enemyHero

        # 获取各路英雄名称 (带中文翻译)
        my_top_n, _, _ = get_champ_meta(my_roles_map.get("TOP", "Unknown"))
        en_top_n, _, _ = get_champ_meta(enemy_roles_map.get("TOP", "Unknown"))
        my_mid_n, _, _ = get_champ_meta(my_roles_map.get("MID", "Unknown"))
        en_mid_n, _, _ = get_champ_meta(enemy_roles_map.get("MID", "Unknown"))
        my_ad_n, _, _ = get_champ_meta(my_roles_map.get("ADC", "Unknown"))
        my_sup_n, _, _ = get_champ_meta(my_roles_map.get("SUPPORT", "Unknown"))
        en_ad_n, _, _ = get_champ_meta(enemy_roles_map.get("ADC", "Unknown"))
        en_sup_n, _, _ = get_champ_meta(enemy_roles_map.get("SUPPORT", "Unknown"))

        #  关键修复:构建清晰的对线列表,强制 AI 理解敌我关系
        lane_matchup_context = f"""
        \n---------  全局对线生态 (Jungle Perspective)  ---------
        【上路对位】:我方 [{my_top_n}] VS 敌方 [{en_top_n}]
        【中路对位】:我方 [{my_mid_n}] VS 敌方 [{en_mid_n}]
        【下路对位】:我方 [{my_ad_n}+{my_sup_n}] VS 敌方 [{en_ad_n}+{en_sup_n}]
        -------------------------------------------------------
        """

    # === D. 上路 (TOP) / 其他 ===
    else:
        primary_enemy = enemy_roles_map.get("TOP", "Unknown")
        # 兜底
        if primary_enemy == "Unknown" and data.enemyHero and data.enemyHero != "None":
            primary_enemy = data.enemyHero

        # 简单的上路 Context
        lane_matchup_context = "(上路是孤岛,请专注于 1v1 兵线与换血细节分析)"

    # 兜底:如果没找到对位,尝试使用前端传来的 enemyHero
    if primary_enemy == "Unknown" and data.enemyHero and data.enemyHero != "None":
        primary_enemy = data.enemyHero

    # 6.  触发推荐算法 (纯净版)
    rank_type = "Diamond+" if data.rank in ["Diamond", "Master", "Challenger"] else "Platinum-"
    algo_recommendations = recommend_heroes_algo(db, user_role_key, rank_type, None)

    rec_str = ""
    for idx, rec in enumerate(algo_recommendations):
        #  使用定义好的 get_hero_cn_name 翻译,推荐列表也变中文了
        rec_name_cn = get_hero_cn_name(rec['name'])
        rec_str += f"{idx+1}. {rec_name_cn} ({rec['tier']}) - {rec['reason']}\n"
    if not rec_str: rec_str = "(暂无数据)"

    # =========================================================================
    # 7. RAG 检索 & 模式修正 (核心修复区)
    # =========================================================================
    top_tips = []
    corrections = []

    #  A. 定义模式 (Template vs Style)
    target_mode = data.mode
    style_mode = "default"

    if data.myHero == "None":
        target_mode = "bp"
        style_mode = "default"

    # 野核:兼容新旧mode写法
    elif data.mode in ("role_jungle_farming", "jungle_farming"):
        target_mode = "role_jungle_farming"
        style_mode = "role_jungle_farming"

    elif data.mode == "personal":
        if user_role_key == "JUNGLE":
            target_mode = "personal_jungle"
            style_mode = "role_jungle_ganking"  # 默认节奏/抓人倾向
        else:
            target_mode = "personal_lane"
            style_mode = "default"


    if data.myHero and data.myHero != "None":
        rag_enemy = primary_enemy
        if user_role_key == "JUNGLE":
            real_enemy_jg = enemy_roles_map.get("JUNGLE", "Unknown")
            if primary_enemy != real_enemy_jg:
                rag_enemy = "general"

        knowledge = await run_in_threadpool(db.get_top_knowledge_for_ai, data.myHero, rag_enemy)
        if rag_enemy == "general":
            top_tips = knowledge.get("general", [])
        else:
            top_tips = knowledge.get("matchup", []) + knowledge.get("general", [])

        #  B. 获取修正数据 (传入 style_mode)
        # 注意:这里不再会被覆盖了!
        corrections = await run_in_threadpool(
            db.get_corrections,
            data.myHero,
            rag_enemy,
            user_role_key,
            style_mode  # <--- 传入流派模式
        )

    #  C. 处理修正数据格式 (Dict -> String)
    correction_texts = []
    if corrections:
        for c in corrections:
            # 兼容:如果是对象取 content,如果是字符串直接用
            if isinstance(c, dict):
                content = c.get("content")
                if content: correction_texts.append(content)
            elif isinstance(c, str):
                correction_texts.append(c)

    correction_prompt = "修正:\n" + "\n".join([f"- {t}" for t in correction_texts]) if correction_texts else ""

    #  安全修改:使用 XML 标签隔离不可信内容
    if top_tips:
        safe_tips = []
        for t in top_tips:
            # 简单过滤:移除可能导致注入的关键词
            clean_t = t.replace("System:", "").replace("User:", "").replace("Instruction:", "")
            safe_tips.append(f"<tip>{clean_t}</tip>")
        tips_text = "<community_knowledge>\n" + "\n".join(safe_tips) + "\n</community_knowledge>"
    else:
        tips_text = "(暂无社区数据)"

    # =========================================================================
    # 8. Prompt 构建 ( 终极缓存优化版:Global Prefix + Sandwich Structure)
    # =========================================================================

    # 1. 准备基础 Context 变量
    full_s16_context = f"{s16_context}"

    #  [Global Prefix] 全局元规则 (所有模式共享,确保 100% 缓存命中头部)
    META_SYSTEM_PROMPT = """
【元规则 (系统底层指令)】
1. **身份定义**:你是 HexCoach 战术副官,服务于英雄联盟玩家。
2. **输出协议**:
   - 必须输出纯 JSON 格式,严格遵守 `user_template` 定义的结构。
   - 语言仅限中文。
3. **排版视觉规范 (强制执行)**:
   - **摘要(concise)卡片化**:必须使用 `### 【小标题】` 来分割不同维度的分析(前端依赖此标签生成可视化卡片)。
   - **列表结构**:内容必须按点分行,每一项以 `- ` 开头。
   - **视觉降噪**:严禁使用 `**` 加粗(星号),重点内容仅允许使用【】包裹。
   - **拒绝堆砌**:不要把所有信息塞进一段,必须换行。
"""

    #  [Mode Specific] 野核专属校验 (仅野核模式追加)
    JUNGLE_FARM_RECAP = """
===  最终校验 (FINAL CHECK) ===
1. **逻辑自检**:
   - 0-4分钟:必须包含【黄金路线】(F6-石-红-狼-蛙-蓝)。
   - 5:30节点:必须包含【三狼(2)+蛤蟆(2)】的决策。
2. **巢虫落地**:必须解释【先布阵】的具体操作。
请基于上述规则生成最终 JSON。
"""

    # 2. 确定 Recap 内容 (动态追加在末尾)
    recap_section = ""
    # 兼容 new mode names
    if data.mode in ["role_jungle_farming", "jungle_farming"]:
        recap_section = JUNGLE_FARM_RECAP

    # 3. 获取数据库中的模板 (Body)
    tpl = db.get_prompt_template(target_mode) or db.get_prompt_template("personal_lane")
    sys_tpl_body = tpl['system_template']

    # 判断 User 端是否需要填充 Tips (如果 System 里没写 {tips_text},则传给 User)
    tips_in_system = "{tips_text}" in sys_tpl_body

    # 4. 智能组装 System Content
    # 结构:[Global Meta] + [DB Template (含 S16/Tips/Corrections)] + [Recap]
    try:
        # A. 格式化数据库模板部分
        # 检查模板是否包含占位符,如果有则填充
        if "{s16_context}" in sys_tpl_body:
            formatted_body = sys_tpl_body.format(
                s16_context=full_s16_context,
                tips_text=tips_text if tips_in_system else "",
                correction_prompt=correction_prompt
            )
        else:
            # 兜底:如果模板里没写占位符,手动拼接
            formatted_body = (
                f"{sys_tpl_body}\n\n"
                f"===  S16 Context ===\n{full_s16_context}\n\n"
                f"===  Community Tips ===\n{tips_text}\n\n"
                f"{correction_prompt}"
            )
            tips_in_system = True

        # B. 最终拼接 (三明治结构)
        system_content = f"{META_SYSTEM_PROMPT}\n\n{formatted_body}\n\n{recap_section}"

    except Exception as e:
        logger.info(f" Prompt Formatting Warning: {e}")
        # 降级方案
        system_content = f"{META_SYSTEM_PROMPT}\n\n{sys_tpl_body}\n\nContext: {full_s16_context}\n\n{recap_section}"

    # 5. JSON 强制约束兜底
    if "Output JSON only" not in system_content:
        system_content += "\n IMPORTANT: You must return PURE JSON only."
    # ---------------------------------------------------------
    #  关键步骤:中文翻译 (确保 AI 输出中文)
    # ---------------------------------------------------------
    def translate_roles(role_map):
        translated_map = {}
        for role, hero_id in role_map.items():
            translated_map[role] = get_hero_cn_name(hero_id) or "未知"
        return translated_map

    my_roles_cn = translate_roles(my_roles_map)
    enemy_roles_cn = translate_roles(enemy_roles_map)

    # 翻译核心英雄
    my_hero_cn = get_hero_cn_name(data.myHero)

    enemy_hero_cn = "未知"
    if primary_enemy != "Unknown" and primary_enemy != "None":
        enemy_hero_cn = get_hero_cn_name(primary_enemy)
        # 如果打野针对非对位,加备注
        real_jg = enemy_roles_map.get("JUNGLE")
        if user_role_key == "JUNGLE" and primary_enemy != real_jg:
            enemy_hero_cn += " (Gank目标)"

    def format_roles_str(role_map):
        return " | ".join([f"{k}: {v}" for k, v in role_map.items()])

    # B. 组装 User Content (动态部分)
    #  接收并处理 mapSide 参数
    map_side_desc = "未知阵营"
    enemy_side_desc = "未知阵营"

    if data.mapSide == "blue":
        map_side_desc = " 蓝色方 (基地左下)"
        enemy_side_desc = " 红色方 (基地右上)"
    elif data.mapSide == "red":
        map_side_desc = " 红色方 (基地右上)"
        enemy_side_desc = " 蓝色方 (基地左下)"

    #  决定传给 User 的 Tips 内容
    # 如果 System 已经包含了 Tips,User 端就传个占位符省流量
    # 如果 System 没包含 (例如 personal_jungle 模板),User 端必须传真实内容
    user_tips_content = "(已加载至 System Context)" if tips_in_system else tips_text

    user_content = tpl['user_template'].format(
        mode=data.mode,
        user_rank=data.rank,
        db_suggestions=rec_str,
        myTeam=format_roles_str(my_roles_cn),       #  中文阵容 (别名)
        enemyTeam=format_roles_str(enemy_roles_cn), #  中文阵容 (别名)
        myHero=my_hero_cn,          #  中文名 (别名)
        enemyHero=enemy_hero_cn,    #  中文名 (别名)
        userRole=user_role_key,

        #  注入红蓝方信息
        mapSide=map_side_desc,
        enemySide=enemy_side_desc,

        #  关键优化:不再重复传输大段文本
        s16_context="(机制库已加载至 System Context)",

        compInfo=lane_matchup_context,
        tips_text=user_tips_content, #  智能填充
        correction_prompt=""         # 修正内容通常在 System 中处理
    )

    # 9. AI 调用
    if data.model_type == "reasoner":
        MODEL_NAME = "deepseek-reasoner"
        logger.info(f" [AI] 核心算力 Request - User: {current_user['username']}")
    else:
        MODEL_NAME = "deepseek-chat"
        logger.info(f" [AI] 基础算力 Request - User: {current_user['username']}")

    async def event_stream():
        try:
            stream = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "system", "content": system_content}, {"role": "user", "content": user_content}],
                stream=True, temperature=0.6, max_tokens=4000
            )

            #  新增状态标记:是否正在输出思考过程
            is_thinking = False

            async for chunk in stream:
                if chunk.choices:
                    delta = chunk.choices[0].delta

                    # 1. 尝试获取思考内容 (DeepSeek R1 特有字段 reasoning_content)
                    reasoning = getattr(delta, 'reasoning_content', None)

                    if reasoning:
                        if not is_thinking:
                            yield "<think>" #  手动加上开始标签,前端才能识别
                            is_thinking = True
                        yield reasoning

                    # 2. 处理正式回复 (content)
                    elif delta.content:
                        if is_thinking:
                            yield "</think>" #  思考结束,闭合标签
                            is_thinking = False
                        yield delta.content

            #  兜底:防止流结束时思考标签没闭合
            if is_thinking:
                yield "</think>"

        except Exception as e:
            logger.info(f" AI Error: {e}")
            yield json.dumps({"concise": {"title": "错误", "content": "AI服务繁忙,请稍后重试。"}})

    return StreamingResponse(event_stream(), media_type="text/plain")

# ================= 初始化函数 (由 server.py 调用) =================

def init_ai_router():
    """初始化 AI 路由所需的全局变量"""
    preload_champion_map()
