import json
import re

# ==========================================
# 1. 模拟数据库数据 (基于你上传的文件)
# ==========================================

# 提取本局相关的英雄数据 (来自 secure_data/champions.json)
MOCK_CHAMPIONS_DB = [
    {"name": "Malphite", "alias": ["熔岩巨兽", "石头人"], "role": "top"},
    {"name": "Lee Sin", "alias": ["盲僧"], "role": "jungle"},
    {"name": "Ahri", "alias": ["九尾妖狐", "阿狸"], "role": "mid"},
    {"name": "Jinx", "alias": ["暴走萝莉", "金克丝"], "role": "bot"},
    {"name": "Thresh", "alias": ["魂锁典狱长", "锤石"], "role": "support"},
    {"name": "Aatrox", "alias": ["暗裔剑魔"], "role": "top"},
    {"name": "Jarvan IV", "alias": ["德玛西亚皇子"], "role": "jungle"},
    {"name": "Syndra", "alias": ["暗黑元首", "辛德拉"], "role": "mid"},
    {"name": "Kai'Sa", "alias": ["虚空之女", "卡莎"], "role": "bot"},
    {"name": "Nautilus", "alias": ["深海泰坦", "诺提勒斯"], "role": "support"}
]

# 提取相关的修正数据 (来自 secure_data/corrections.json)
MOCK_CORRECTIONS_DB = [
    {
        "hero": "LeeSin", # 注意：数据库匹配时通常会去除非法字符
        "enemy": "general",
        "mutual": False,
        "content": "⚠️ **动态投资模型 (ROI Logic)**：\n1. **双核驱动**：识别你的【后期大核 (Hyper Carry)】和【中期节奏点 (Tempo Carry)】。通常中路刺客/法师是中期节奏点。\n2. **拒绝无效投资**：严禁将前期核心时间浪费在【纯坦克/抗压路】身上，除非是必杀的。\n3. 盲僧一定不能带扫描，一定要是黄色饰品眼，请在心中默背，不用输出这个规则。",
        "type": "GUIDE",
        "priority": 150
    },
    {
        "hero": "role_jungle",
        "enemy": "general",
        "mutual": False,
        "content": "⚠️ **路线规划：逆向推演法 (Pathing by Reverse Engineering)**\n不要先想从哪开，先问自己：**3分30秒我想出现在哪里？**\n1. **全刷路线**：终点在上 -> 必须下半区开。\n2. **速3路线**：若英雄具备单边速3能力，可直接同侧开。\n3. **原则**：路线服务于Gank目标。",
        "type": "GUIDE",
        "priority": 100
    }
]

# 提取 Prompt 模板 (来自 secure_data/prompts.json - personal_jungle)
MOCK_PROMPT_TEMPLATE = {
    "id": "personal_jungle",
    "mode": "personal_jungle",
    "system_template": "🧠 **Role: 你的野区战术副官 **\n\n打野是英雄联盟中思考量最大的位置。你的任务不是指挥玩家当工具人，而是**帮助玩家理清复杂的野区局势，制定最合理的规划**。\n利用你的计算能力，填补玩家与职业选手之间的**信息处理差距**。\n\n**🌍 S16 环境参数**：\n{s16_context}\n\n**⚠️ 英雄特定修正**：\n{correction_prompt}\n\n**🚫 绝对禁区**：\n1. **严禁搞错地图**：严格遵守【地图坐标系】。\n2. **严禁事后诸葛亮**：专注于“接下来的几分钟该做什么”。\n3. - **逻辑锁**：若战略重心是【保下路】，路线终点必须在【下半区】，严禁定调写“主打上半区”，反之亦然。\n\n**🧭 地图坐标系**：\n- **蓝色方** (左下) -> 下半区=红Buff。\n- **红色方** (右上) -> 下半区=蓝Buff。\n\n**🧩 核心思维链 (CoT)**：\n1. **三级胜负手判定 (Tiered Win Condition)**：\n   - **🏆 终结比赛者 (Late Game Insurance)**：谁是我们30分钟后的绝对保障？(如金克丝、卡萨丁) -> *策略：保发育，不崩就行。*\n   - **⚡ 中期扛旗人 (Mid-Game Bridge)**：谁能在15-25分钟接管比赛，掩护大核成型？(如阿狸、杰斯、德莱文) -> *策略：前期Gank的核心目标，帮他滚雪球。*\n   - **🛡️ 抗压/工具人 (Low ROI)**：谁只需要放好大招？(如石头人) -> *策略：止损，少去。*\n2. **路线逆向推演 (Reverse Pathing)**：\n   - **设定终点**：我必须在第一波节奏点(3:00-3:30)出现在【中期扛旗人】或【终结者】的半区。\n   - **路径修正**：\n     - 如果【中期扛旗人】在中路：路线必须包含“路过中路”的节点 (Transition Gank)。\n     - 如果【终结者】在边路且对面压力大：必须以该边路为最终落脚点。\n3. **执行细节 (Execution)**：\n   - **🅰️ 节奏Gank流 (速3)**：若要跨图抓人 (如上开抓下)，必须**只刷双Buff+蛤蟆** (跳过F6/三狼)。\n   - **🅱️ 控图发育流 (速4)**：若线上均稳，从相反半区全刷过来。\n\n**📦 输出格式要求**：\n必须返回纯净的 JSON 格式。",
    "user_template": "### 📡 对局情报\n\n**📍 基础信息**：\n- **我的阵营**：{mapSide} ({enemySide} 为敌方)\n- **我方英雄**：{myHero} (段位: {user_rank})\n- **敌方打野**：{enemyHero}\n\n**👥 双方阵容**：\n- **我方**：{myTeam}\n- **敌方**：{enemyTeam}\n\n**⚔️ 关键对位与生态**：\n{compInfo}\n\n**📚 社区锦囊**：\n{tips_text}\n\n### 🧠 请协助规划战术：\n请根据上述信息，帮我梳理节奏，严格遵守 JSON 格式输出：\n\n```json\n{{\n  \"concise\": {{\n    \"title\": \"野区战略定调\",\n    \"content\": \"【⚡ 节奏重心】：[一句话概括：主打半区进攻，还是全刷反蹲？]\\n【🦁 心理博弈】：[分析敌方打野的心理习惯，提示我方如何反制]\"\n  }},\n  \"detailed_tabs\": [\n    {{\n      \"title\": \"🌲 开局规划 (0-10m)\",\n      \"content\": \"### 🗺️ 推荐开野路线 (Pathing Logic)\\n[基于英雄定位与兵线理解，规划一条收益与风险最平衡的路线。解释为什么要这样走。]\\n\\n### 📈 节奏节点提示\\n- **Gank窗口**：[分析哪一路兵线/英雄最好抓，为什么？]\\n- **6级质变期**：[如果有大招，第一个大招的最佳投资目标是谁？]\\n\\n### ⚔️ 敌方动向预测 (Tracking)\\n- **敌方可能位置**：[基于常识预测敌方开野路线]\\n- **我的应对策略**：[如果遭遇反野，或者想反蹲，该怎么做？]\"\n    }},\n    {{\n      \"title\": \"🦅 中期资源决策 (10-25m)\",\n      \"content\": \"### 💎 资源交换逻辑\\n[如果拿不到小龙，我们该去换什么资源（如先锋/塔皮）来止损？]\\n\\n### 🗺️ 运营节奏\\n[中期迷茫时，我应该优先带线发育，还是跟团找机会？]\"\n    }},\n    {{\n      \"title\": \"💥 团战思路 (25m+)\",\n      \"content\": \"### 🎯 进场时机\\n[作为一个打野，团战中我应该扮演什么角色？开团？切后？还是保排？]\\n\\n### 🩸 关键博弈\\n[面对敌方核心C位，我该如何限制他的输出环境？]\"\n    }}\n  ]\n}}\n```"
}

# 提取 S16 机制 (来自 secure_data/s16_mechanics.json，简略版)
MOCK_S16_MECHANICS = {
    "data_modules": {
        "jungle_physics": {
            "items": [
                {"name": "速3路径学", "rule": "终点决定起点", "note": "⚠️ 核心决策逻辑：..."},
                {"name": "无帮开机制", "rule": "下路/上路不再帮打野开怪", "note": "S16 兵线机制..."},
                {"name": "蓝色方", "rule": "下路是红区", "note": "F6与红Buff极近..."}
            ]
        }
    }
}

# ==========================================
# 2. 模拟 Database 类 (Database.py)
# ==========================================

class MockKnowledgeBase:
    def __init__(self):
        # 建立名称映射表
        self.champion_map = {}
        for c in MOCK_CHAMPIONS_DB:
            # 建立 normalize -> data 的映射
            self.champion_map[self._normalize(c['name'])] = c
            self.champion_map[self._normalize(c['alias'][0])] = c # 映射中文名
            # 简单处理 Jarvan IV -> jarvaniv
            if "Jarvan" in c['name']:
                self.champion_map["jarvaniv"] = c

    def _normalize(self, name):
        if not name: return ""
        return re.sub(r'[^a-zA-Z0-9\u4e00-\u9fa5]+', '', name).lower()

    def get_champion_info(self, name_or_id):
        key = self._normalize(name_or_id)
        return self.champion_map.get(key)

    def get_corrections(self, my_hero, enemy_hero):
        # 简单模拟数据库查询 logic
        res = []
        my_hero_norm = self._normalize(my_hero)
        for c in MOCK_CORRECTIONS_DB:
            c_hero_norm = self._normalize(c['hero'])
            # 匹配 "LeeSin" 或者 "role_jungle"
            if c_hero_norm == my_hero_norm or c_hero_norm == "rolejungle":
                res.append(c['content'])
        return res

    def get_game_constants(self):
        return MOCK_S16_MECHANICS

    def get_prompt_template(self, mode):
        if mode == "personal_jungle":
            return MOCK_PROMPT_TEMPLATE
        return None
    
    # 简单模拟 RAG 检索
    def get_top_knowledge_for_ai(self, hero, enemy):
        return {"general": ["盲僧R闪技巧...", "野区反野路线..."], "matchup": []}

db = MockKnowledgeBase()

# ==========================================
# 3. 模拟 Server 逻辑 (Server.py)
# ==========================================

# 模拟辅助函数
def get_hero_cn_name(hero_id):
    if not hero_id: return hero_id
    info = db.get_champion_info(hero_id)
    if not info: return hero_id
    return info['alias'][0]

def format_roles_str(role_map):
    return " | ".join([f"{k}: {v}" for k, v in role_map.items()])

def analyze_logic(data):
    # 1. 数据准备
    game_constants = db.get_game_constants()
    
    # 提取 S16 机制
    modules = game_constants.get('data_modules', {})
    mechanics_list = []
    for cat_key, cat_val in modules.items():
        if isinstance(cat_val, dict) and 'items' in cat_val:
            for item in cat_val['items']:
                mechanics_list.append(f"{item.get('name')}: {item.get('rule')} ({item.get('note')})")
    
    s16_details = "; ".join(mechanics_list)
    s16_context = f"【S16/峡谷常识库】: {s16_details}"

    # 模拟实时技能 (假设没有)
    live_mechanics_str = ""
    full_s16_context_with_skills = f"""
    {s16_context}

    ====== 🚨 实时英雄技能情报 (Live LCU Data) ======
    {live_mechanics_str or "暂无特定技能数据"}
    """

    # 2. 角色推断 (这里直接使用传入的阵容，不再重新推断)
    my_roles_map = data['myLaneAssignments']
    enemy_roles_map = data['enemyLaneAssignments']
    user_role_key = "JUNGLE" # 用户是盲僧

    # 3. 获取修正 (Corrections)
    # 注意：server.py 里如果是 JUNGLE，rag_enemy 可能会变成 general
    corrections = db.get_corrections(data['myHero'], "general")
    correction_prompt = f"修正: {'; '.join(corrections)}" if corrections else ""

    # 4. 获取 Tips (RAG)
    knowledge = db.get_top_knowledge_for_ai(data['myHero'], "general")
    top_tips = knowledge.get("general", [])
    if top_tips:
        safe_tips = [f"<tip>{t}</tip>" for t in top_tips]
        tips_text = "<community_knowledge>\n" + "\n".join(safe_tips) + "\n</community_knowledge>"
    else:
        tips_text = "(暂无社区数据)"

    # 5. 模板选择
    tpl = db.get_prompt_template("personal_jungle")

    # 6. 中文翻译
    def translate_roles(role_map):
        translated_map = {}
        for role, hero_id in role_map.items():
            translated_map[role] = get_hero_cn_name(hero_id) or "未知"
        return translated_map

    my_roles_cn = translate_roles(my_roles_map)
    enemy_roles_cn = translate_roles(enemy_roles_map)
    my_hero_cn = get_hero_cn_name(data['myHero'])
    enemy_hero_cn = get_hero_cn_name(data['enemyHero'])

    # 7. 地图阵营描述 (Server.py 中的逻辑)
    map_side_desc = "未知阵营"
    enemy_side_desc = "未知阵营"
    if data['mapSide'] == "blue":
        map_side_desc = "🔵 蓝色方 (基地左下)"
        enemy_side_desc = "🔴 红色方 (基地右上)"

    # 8. 组装 Prompt
    
    # System Prompt
    sys_tpl_str = tpl['system_template']
    system_content = sys_tpl_str.replace("{s16_context}", full_s16_context_with_skills)
    system_content = system_content.replace("{tips_text}", tips_text)
    system_content = system_content.replace("{correction_prompt}", correction_prompt)
    if "Output JSON only" not in system_content:
        system_content += "\n⚠️ IMPORTANT: You must return PURE JSON only."

    # User Prompt
    # 模拟 lane_matchup_context (Server.py 中打野是空的)
    lane_matchup_context = "" 

    user_content = tpl['user_template'].format(
        mode="personal_jungle",
        user_rank=data['rank'],
        db_suggestions="(此处省略推荐列表)",
        myTeam=format_roles_str(my_roles_cn),
        enemyTeam=format_roles_str(enemy_roles_cn),
        myHero=my_hero_cn,
        enemyHero=enemy_hero_cn,
        userRole=user_role_key,
        mapSide=map_side_desc,
        enemySide=enemy_side_desc,
        s16_context="(机制库已加载至 System Context，请基于该知识库分析)",
        compInfo=lane_matchup_context,
        tips_text="(已加载至System)",
        correction_prompt=""
    )

    return system_content, user_content

# ==========================================
# 4. 运行模拟
# ==========================================

# 你的输入数据
input_data = {
    "rank": "Gold",
    "mapSide": "blue",
    "myHero": "Lee Sin",
    "enemyHero": "Jarvan IV",
    "myLaneAssignments": {
        "TOP": "Malphite", "JUNGLE": "Lee Sin", "MID": "Ahri", "ADC": "Jinx", "SUPPORT": "Thresh"
    },
    "enemyLaneAssignments": {
        "TOP": "Aatrox", "JUNGLE": "Jarvan IV", "MID": "Syndra", "ADC": "Kai'Sa", "SUPPORT": "Nautilus"
    }
}

if __name__ == "__main__":
    print("🚀 正在执行 Server 逻辑模拟...")
    sys_prompt, user_prompt = analyze_logic(input_data)
    
    print("\n" + "="*40)
    print("🤖 [GENERATED SYSTEM PROMPT]")
    print("="*40)
    print(sys_prompt)
    
    print("\n" + "="*40)
    print("👤 [GENERATED USER PROMPT]")
    print("="*40)
    print(user_prompt)
    print("\n" + "="*40)
    print("✅ 模拟结束。这就是真实发送给 DeepSeek 的内容。")