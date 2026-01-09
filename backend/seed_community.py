import os
from core.logger import logger
import datetime
import time
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# ==========================================
# 1. 示例数据配置区域 (AI 批量生成时只需替换这里)
# ==========================================

#  [Wiki 攻略] 示例数据
DATA_WIKI_POSTS = [
    {
        "ref_id": "#AN-001",
        "title": "安妮进阶：无前摇 W 的原理与实战应用",
        "author_name": "黑暗之女本人",
        "author_id": "mock_user_001",
        "likes": 5200,
        "views": 25000,
        "category": "mechanic",
        "hero_id": "1",  # Annie
        "opponent_id": None,
        "is_ai_pick": True,
        "content": """很多人玩安妮习惯攒满4层晕再上前，这样意图太明显，对面早就后撤了。
        
真正的安妮高手懂得“藏晕”：
1. 保持在2层或3层被动。
2. 使用 E 技能加速上前。
3. 在 Q 技能飞行的空中开启 E 技能（如果是2层），或者利用 W 技能的无读条特性。

**W技能机制详解：**
安妮的 W (焚烧) 是瞬发技能，没有弹道。这意味着只要在这个范围内，按下技能的瞬间伤害判定就已经生效。利用这一点，我们可以在闪现的瞬间按 W，对方几乎无法反应交出闪现。

实战连招推荐：
- 3层被动 -> Q起手 -> 空中开E -> 晕眩触发 -> 接W -> R""",
        "tags": ["机制", "隐藏分", "进阶"]
    },
    {
        "ref_id": "#AN-VS-YAS",
        "title": "安妮打亚索：平A破盾与 W 穿风墙技巧",
        "author_name": "中单质检员",
        "author_id": "mock_user_002",
        "likes": 4500,
        "views": 18000,
        "category": "matchup",
        "hero_id": "1",  # Annie
        "opponent_id": "157",  # Yasuo
        "is_ai_pick": True,
        "content": """亚索是中单常见的对手，很多法师怕风墙，但安妮不怕！
        
**对线核心：**
1. **平A破盾**：安妮拥有625的超长射程，一级上线先A他一下破掉被动盾，等盾消失再用技能消耗。
2. **W穿风墙**：这是重点！安妮的 W (焚烧) 不是飞行道具，它是瞬间判定的范围伤害。亚索的风墙**挡不住** W！
3. **R穿风墙**：同理，提伯斯的砸地伤害也挡不住。

**出装建议：**
先出护臂增加容错，或者直接卢登打爆发。带电刑，不要带彗星（容易空）。""",
        "tags": ["亚索", "克制", "细节"]
    },
    {
        "ref_id": "#AN-VS-ZED",
        "title": "对线劫：前期压制与金身时机",
        "author_name": "金身传家宝",
        "author_id": "mock_user_003",
        "likes": 2800,
        "views": 9000,
        "category": "matchup",
        "hero_id": "1",  # Annie
        "opponent_id": "238",  # Zed
        "is_ai_pick": False,
        "content": "打劫主要看走位躲手里剑。他W交了之后就是超级兵。6级后手里一定要捏着晕，他R落地会出现在你背后，直接往身后丢R必中。",
        "tags": ["劫", "反杀", "金身"]
    }
]

#  [酒馆动态] 示例数据
DATA_TAVERN_POSTS = [
    {
        "author_name": "可爱的蓝火",
        "author_id": "mock_user_004",
        "avatar_hero": "Annie",
        "hero_id": "1",
        "content": "家人们，新出的那个咖啡甜心安妮皮肤大家买了吗？那个回城特效把小熊变成管家也太萌了吧！冲冲冲！",
        "tags": ["皮肤", "咖啡甜心"],
        "likes": 234,
        "comments": 45,
        "topic": "skin",
        "image": "https://game.gtimg.cn/images/lol/act/img/skin/big1013.jpg"
    },
    {
        "author_name": "草丛里的熊",
        "author_id": "mock_user_005",
        "avatar_hero": "Amumu",
        "hero_id": "32",
        "content": "我是主玩阿木木打野的，找个会玩的安妮中单双排！我们两个大招毁天灭地，主要是我能抗塔，你放心输出！白金钻石分段。",
        "tags": ["寻找队友", "阿木木", "大招流"],
        "likes": 56,
        "comments": 12,
        "topic": "teamup",
        "image": None
    },
    {
        "author_name": "暴躁老哥",
        "author_id": "mock_user_006",
        "avatar_hero": "Brand",
        "hero_id": "63",
        "content": "现在的安妮是不是被削弱过头了？昨天我一套技能打在奥恩身上像是在给他挠痒痒，这法穿棒是假的吧？",
        "tags": ["吐槽", "伤害刮痧", "坦克联盟"],
        "likes": 88,
        "comments": 32,
        "topic": "rant",
        "image": None
    }
]

#  [Wiki 总览] 示例数据
DATA_WIKI_SUMMARIES = [
    {
        "hero_id": "1",  # Annie
        "overview": "安妮（黑暗之女）是一名拥有极强爆发和开团能力的法师。她的被动[嗜火]提供的眩晕是她的核心机制，配合[提伯斯之怒]可以在瞬间扭转战局。",
        "key_mechanics": [
            {"label": "无前摇 W 藏晕技巧", "refId": "#AN-001"},
            {"label": "提伯斯格挡与微操", "refId": "#AN-002"},
            {"label": "R闪取消施法后摇", "refId": None}
        ],
        "common_matchups": [
            {"championId": "157", "difficulty": "简单", "note": "W/R 无视风墙", "refId": "#AN-VS-YAS"},
            {"championId": "238", "difficulty": "中等", "note": "落地身后瞬晕", "refId": "#AN-VS-ZED"},
            {"championId": "517", "difficulty": "困难", "note": "谨防被偷大反打", "refId": "#AN-VS-SYL"}
        ],
        "build_path": "恶意(增加极速) > 影焰(法术暴击) > 中娅沙漏(保命)"
    }
]

# ==========================================
# 2. 数据库写入脚本
# ==========================================

def seed_database():
    # 1. 连接数据库
    uri = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    logger.info(f" 连接数据库: {uri} ...")
    
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        #  [修复] 智能选择数据库，防止 ConfigurationError
        try:
            db = client.get_default_database()
        except (ConfigurationError, ValueError):
            db = client['lol_community']
            
        logger.info(f" 成功连接至数据库: {db.name}")
    except Exception as e:
        logger.info(f" 连接失败: {e}")
        return

    # 2. 写入 Wiki 攻略 (Wiki Posts)
    col_wiki = db['wiki_posts']
    logger.info(f"\n 正在写入攻略数据 ({len(DATA_WIKI_POSTS)} 条)...")
    
    count_wiki = 0
    for post in DATA_WIKI_POSTS:
        # 查重 (基于 ref_id)
        if col_wiki.find_one({"ref_id": post["ref_id"]}):
            logger.info(f"   - 跳过已存在: {post['title']}")
            continue
            
        post["created_at"] = datetime.datetime.utcnow()
        col_wiki.insert_one(post)
        count_wiki += 1
    logger.info(f"    新增 {count_wiki} 条攻略")

    # 3. 写入酒馆动态 (Tavern Posts)
    col_tavern = db['tavern_posts']
    logger.info(f"\n 正在写入酒馆动态 ({len(DATA_TAVERN_POSTS)} 条)...")
    
    count_tavern = 0
    for post in DATA_TAVERN_POSTS:
        # 简单查重 (基于内容前20字符)
        if col_tavern.find_one({"content": post["content"], "author_name": post["author_name"]}):
            logger.info(f"   - 跳过已存在动态: {post['author_name']}")
            continue
            
        post["created_at"] = datetime.datetime.utcnow()
        col_tavern.insert_one(post)
        count_tavern += 1
    logger.info(f"    新增 {count_tavern} 条动态")

    # 4. 写入 Wiki 总览 (Wiki Summaries)
    col_summary = db['wiki_summaries']
    logger.info(f"\n 正在写入英雄总览 ({len(DATA_WIKI_SUMMARIES)} 条)...")
    
    count_summary = 0
    for summary in DATA_WIKI_SUMMARIES:
        # 使用 upsert (更新或插入)
        result = col_summary.update_one(
            {"hero_id": summary["hero_id"]},
            {"$set": summary},
            upsert=True
        )
        if result.upserted_id:
            count_summary += 1
    logger.info(f"    更新/新增 {count_summary} 条英雄总览")

    logger.info("\n 所有数据处理完成！")

if __name__ == "__main__":
    seed_database()