import json
import os
import datetime
import re
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

def load_json(filename):
    """尝试从 secure_data 文件夹读取 JSON"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "secure_data", filename)
    if not os.path.exists(file_path):
        print(f"⚠️ [提示] 本地文件未找到: {filename}")
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ [错误] 读取 {filename} 失败: {e}")
        return None

# ✨ 辅助函数：清洗百分比字符串 ("50.87%" -> 0.5087)
def parse_percent(val):
    if isinstance(val, str):
        clean = val.replace("%", "").strip()
        try:
            return float(clean) / 100.0
        except:
            return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    return 0.0

# ✨ 辅助函数：清洗层级 ("T1" -> 1)
def parse_tier(val):
    if isinstance(val, int): return val
    if isinstance(val, str):
        clean = val.upper().replace("T", "").strip()
        if clean.isdigit():
            return int(clean)
    return 5 # 默认 T5

# ✨ 辅助函数：判断是否包含中文字符
def has_chinese(text):
    for char in text:
        if '\u4e00' <= char <= '\u9fff':
            return True
    return False

# ✨ 新增：获取当前 UTC 时间
def get_utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

def seed_data():
    print("🌱 [Seeding] 启动全量更新程序 (多分路适配版)...")
    
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ 数据库连接成功")
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        return

    db = client["lol_community"]

    # =====================================================
    # 1. 同步英雄数据 (Champions) - 核心升级逻辑
    # =====================================================
    print("\n🚀 [1/4] 更新英雄数据 (支持多位置合并)...")
    
    champs_data = load_json("champions.json")
    if champs_data:
        # 1. 清空旧数据
        delete_result = db.champions.delete_many({})
        print(f"🧹 已清空旧表 (删除了 {delete_result.deleted_count} 条)")
        
        # 2. 内存字典：用于合并同一个英雄的不同分路数据
        # 结构: { "Ambessa": { base_info..., positions: { "TOP": {...}, "MID": {...} } } }
        hero_map = {}

        for hero in champs_data:
            try:
                # 确定英文 ID
                hero_id = hero.get("name") 
                if not hero_id: continue
                
                # 当前这条数据的分路 (标准化为大写)
                role = hero.get("role", "MID").upper()
                
                # 准备这条数据的 详细Stats
                stats_block = {
                    "role": role,
                    "tier": parse_tier(hero.get("tier")),
                    "win_rate": parse_percent(hero.get("win_rate")),
                    "pick_rate": parse_percent(hero.get("pick_rate")),
                    "ban_rate": parse_percent(hero.get("ban_rate"))
                }

                # 如果是第一次遇到这个英雄，初始化基础信息
                if hero_id not in hero_map:
                    # 智能提取中文名
                    display_name = hero_id
                    alias_list = hero.get("alias", [])
                    chinese_aliases = [a for a in alias_list if has_chinese(a)]
                    if chinese_aliases:
                        chinese_aliases.sort(key=len)
                        display_name = chinese_aliases[0]

                    hero_map[hero_id] = {
                        "id": str(hero_id),
                        "_id": str(hero_id),
                        "name": display_name,
                        "alias": alias_list,
                        "tags": [t.capitalize() for t in hero.get("tags", [])],
                        "updated_at": get_utc_now(),
                        
                        # ✨ 核心：初始化 positions 字典
                        "positions": {},
                        
                        # 保留一份“主数据”在根目录，防止某些旧逻辑报错
                        # (默认存第一条遇到的，后面会根据 Pick率 修正)
                        "tier": stats_block["tier"],
                        "win_rate": stats_block["win_rate"],
                        "role": role 
                    }
                
                # 将当前分路数据 存入 positions
                hero_map[hero_id]["positions"][role] = stats_block
                
                # (可选) 更新主数据：如果当前分路的 Pick 率更高，就把它作为主显示数据
                current_main_pick = hero_map[hero_id].get("pick_rate", 0)
                if stats_block["pick_rate"] > current_main_pick:
                     hero_map[hero_id]["tier"] = stats_block["tier"]
                     hero_map[hero_id]["win_rate"] = stats_block["win_rate"]
                     hero_map[hero_id]["pick_rate"] = stats_block["pick_rate"]
                     hero_map[hero_id]["ban_rate"] = stats_block["ban_rate"]
                     hero_map[hero_id]["role"] = role # 更新为主位置

            except Exception as e:
                print(f"⚠️ 数据格式错误: {hero.get('name')} - {e}")

        # 3. 将字典转为列表并写入
        batch_docs = list(hero_map.values())

        if batch_docs:
            try:
                db.champions.insert_many(batch_docs)
                print(f"✅ 成功写入 {len(batch_docs)} 个英雄 (已合并 {len(champs_data)} 条分路数据)")
            except Exception as e:
                print(f"❌ 写入失败: {e}")
    else:
        print("⚠️ 未找到 champions.json，跳过更新")

    # =====================================================
    # 2. 同步 Prompts
    # =====================================================
    print("\n🚀 [2/4] 更新 Prompt 模板...")
    prompts_data = load_json("prompts.json")
    if prompts_data:
        db.prompt_templates.delete_many({}) 
        items = prompts_data if isinstance(prompts_data, list) else list(prompts_data.values())
        for item in items:
            p_id = item.get("id") or item.get("_id") or item.get("mode")
            if p_id:
                item["_id"] = p_id
                db.prompt_templates.replace_one({"_id": p_id}, item, upsert=True)
        print("✅ Prompts 已更新")

    # =====================================================
    # 3. 同步 S15 机制
    # =====================================================
    print("\n🚀 [3/4] 更新 S15 数据...")
    s15_json = load_json("s15_mechanics.json")
    if s15_json:
        s15_json["_id"] = "s15_rules"
        db.config.replace_one({"_id": "s15_rules"}, s15_json, upsert=True)
        print("✅ S15 规则已更新")

    # =====================================================
    # 4. 管理员账号
    # =====================================================
    print("\n🚀 [4/4] 检查管理员账号...")
    admin_pass = os.getenv("ADMIN_PASSWORD")
    if admin_pass:
        admin_user = os.getenv("ADMIN_USERNAME", "admin")
        if not db.users.find_one({"username": admin_user}):
            hashed = pwd_context.hash(admin_pass)
            db.users.insert_one({
                "username": admin_user, "password": hashed, "role": "admin", 
                "is_pro": True, "created_at": get_utc_now()
            })
            print(f"✅ 管理员 {admin_user} 创建成功")

    print("\n🎉 全部数据更新完毕！现在支持多位置胜率了。")

if __name__ == "__main__":
    seed_data()