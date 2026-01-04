import json
import os
import datetime
import re
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
# 👆 修复点1：已移除了 'ValueError' 导入
from passlib.context import CryptContext
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

def load_json(filename):
    """尝试从当前目录或 secure_data 文件夹读取 JSON"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 优先找当前目录
    file_path = os.path.join(base_dir, filename)
    if not os.path.exists(file_path):
        # 找不到再去 secure_data 找
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

# ✨✨✨ 同步 RAG 修正数据 (Corrections) ✨✨✨
def sync_corrections_from_json(db):
    print("\n🚀 [6/6] 同步 RAG 修正数据 (Corrections)...")
    
    collection = db['corrections']
    all_data = []
    
    # 1. 定义文件夹路径
    base_dir = os.path.dirname(os.path.abspath(__file__))
    corrections_dir = os.path.join(base_dir, "secure_data", "corrections")
    
    # 2. 尝试从文件夹读取 (新模式)
    if os.path.exists(corrections_dir) and os.path.isdir(corrections_dir):
        print(f"📂 发现修正数据文件夹: {corrections_dir}")
        for filename in os.listdir(corrections_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(corrections_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        file_data = json.load(f)
                        if isinstance(file_data, list):
                            all_data.extend(file_data)
                            print(f"   - 已加载: {filename} ({len(file_data)} 条)")
                        else:
                            print(f"⚠️  跳过 {filename}: 格式必须是列表数组 []")
                except Exception as e:
                    print(f"❌ 读取 {filename} 失败: {e}")
    else:
        # 3. 降级回退 (旧模式)
        print("⚠️ 未找到 corrections/ 文件夹，尝试读取单个 corrections.json...")
        single_data = load_json("corrections.json")
        if single_data:
            all_data = single_data

    if not all_data:
        print("⚠️ 没有找到任何修正数据，跳过同步。")
        return

    # 4. 清空旧数据
    delete_res = collection.delete_many({})
    print(f"🧹 已清空旧修正数据 (删除了 {delete_res.deleted_count} 条)")
    
    # 5. 处理数据 (含自动裂变)
    final_docs = []
    for item in all_data:
        # 补全默认优先级 (如果没写的话)
        if "priority" not in item:
            if item.get("type") == "RULE": item["priority"] = 100
            elif item.get("type") == "GUIDE": item["priority"] = 75
            else: item["priority"] = 50
            
        final_docs.append(item)
        
        # 镜像处理
        if item.get("mutual") is True:
            mirror_item = item.copy()
            original_hero = item.get("hero", "general")
            original_enemy = item.get("enemy", "general")
            mirror_item["hero"] = original_enemy
            mirror_item["enemy"] = original_hero
            mirror_item["_is_auto_mirror"] = True
            final_docs.append(mirror_item)

    # 6. 写入数据库
    try:
        collection.insert_many(final_docs)
        print(f"✅ 成功写入 {len(final_docs)} 条修正数据！")
    except Exception as e:
        print(f"❌ 写入失败: {e}")


def seed_data():
    print("🌱 [Seeding] 启动全量更新程序 (文件读取版)...")
    
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ 数据库连接成功")
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        return

    # 🔥 统一数据库选择逻辑 (确保和 database.py 一致)
    try:
        db = client.get_default_database()
        print(f"✅ 使用 URI 指定的数据库: {db.name}")
    except (ConfigurationError, ValueError):
        db = client['lol_community']
        print(f"✅ URI 未指定库名，使用默认数据库: {db.name}")

    # =====================================================
    # 1. 同步英雄数据 (Champions) - 以 champions.json 为准
    # =====================================================
    print("\n🚀 [1/5] 更新英雄基础数据 (支持多位置合并)...")
    
    champs_data = load_json("champions.json")
    if champs_data:
        # 🔥🔥🔥 修复点2：先删除旧索引，防止 "duplicate key error" 🔥🔥🔥
        try:
            db.champions.drop_indexes()
            print("🔧 已清理旧索引 (解决重名冲突问题)")
        except Exception as e:
            print(f"⚠️ 索引清理跳过: {e}")

        # 1. 清空旧数据
        delete_result = db.champions.delete_many({})
        print(f"🧹 已清空旧表 (删除了 {delete_result.deleted_count} 条)")
        
        # 2. 内存字典：用于合并同一个英雄的不同分路数据
        hero_map = {}

        for hero in champs_data:
            try:
                # 在 champions.json 中，"name" 是英文ID (如 "Malphite")
                hero_english_id = hero.get("name") 
                if not hero_english_id: continue
                
                role_raw = hero.get("role", "mid")
                role_upper = role_raw.upper() # "TOP"
                role_lower = role_raw.lower() # "top"
                
                stats_block = {
                    "role": role_lower, # 存小写
                    "tier": parse_tier(hero.get("tier")),
                    "win_rate": parse_percent(hero.get("win_rate")),
                    "pick_rate": parse_percent(hero.get("pick_rate")),
                    "ban_rate": parse_percent(hero.get("ban_rate"))
                }

                if hero_english_id not in hero_map:
                    # 处理中文名显示
                    alias_list = hero.get("alias", [])
                    chinese_aliases = [a for a in alias_list if has_chinese(a)]
                    
                    # 默认使用英文ID，如果有中文名则优先用中文名作为显示名称
                    display_name_cn = hero_english_id
                    if chinese_aliases:
                        # 优先取列表第一个中文作为主要名字
                        display_name_cn = chinese_aliases[0]

                    hero_map[hero_english_id] = {
                        "id": str(hero_english_id),      # 英文ID: "Malphite"
                        "_id": str(hero_english_id),     # 数据库主键 (强制唯一)
                        
                        "alias": str(hero_english_id),   
                        "title": display_name_cn,        # "石头人"
                        "name": display_name_cn,         # "石头人" (这里可能会重复，所以我们删除了索引)
                        
                        "key": str(hero_english_id),     # 冗余英文字段，双重保险
                        "tags": [t.capitalize() for t in hero.get("tags", [])],
                        "updated_at": get_utc_now(),
                        
                        "positions": {},
                        "roles": [role_lower],
                        
                        "tier": stats_block["tier"],
                        "win_rate": stats_block["win_rate"],
                        "pick_rate": stats_block["pick_rate"],
                        "ban_rate": stats_block["ban_rate"],
                        "role": role_lower 
                    }
                
                hero_map[hero_english_id]["positions"][role_upper] = stats_block
                
                if role_lower not in hero_map[hero_english_id]["roles"]:
                    hero_map[hero_english_id]["roles"].append(role_lower)

                current_main_pick = hero_map[hero_english_id].get("pick_rate", 0)
                if stats_block["pick_rate"] > current_main_pick:
                     hero_map[hero_english_id]["tier"] = stats_block["tier"]
                     hero_map[hero_english_id]["win_rate"] = stats_block["win_rate"]
                     hero_map[hero_english_id]["pick_rate"] = stats_block["pick_rate"]
                     hero_map[hero_english_id]["ban_rate"] = stats_block["ban_rate"]
                     hero_map[hero_english_id]["role"] = role_lower 

            except Exception as e:
                print(f"⚠️ 数据格式错误: {hero.get('name')} - {e}")

        batch_docs = list(hero_map.values())

        if batch_docs:
            try:
                db.champions.insert_many(batch_docs)
                print(f"✅ 成功写入 {len(batch_docs)} 个英雄")
            except Exception as e:
                print(f"❌ 写入失败: {e}")
    else:
        print("⚠️ 未找到 champions.json，跳过更新")

    # =====================================================
    # 2. 同步 Prompts
    # =====================================================
    print("\n🚀 [2/5] 更新 Prompt 模板...")
    prompts_data = load_json("prompts.json")
    
    if prompts_data:
        db.prompt_templates.delete_many({}) 
        items = prompts_data if isinstance(prompts_data, list) else list(prompts_data.values())
        for item in items:
            p_id = item.get("id") or item.get("_id") or item.get("mode")
            if p_id:
                item["_id"] = p_id
                db.prompt_templates.replace_one({"_id": p_id}, item, upsert=True)
        print("✅ Prompts 已根据文件更新")
    else:
        print("❌ 严重警告：未找到 prompts.json 文件！")

    # =====================================================
    # 3. 同步 S15 机制
    # =====================================================
    print("\n🚀 [3/5] 更新 S15 数据...")
    s15_json = load_json("s15_mechanics.json")
    if s15_json:
        s15_json["_id"] = "s15_rules"
        db.config.replace_one({"_id": "s15_rules"}, s15_json, upsert=True)
        print("✅ S15 规则已更新")

    # =====================================================
    # 5. 调用修正数据
    # =====================================================
    sync_corrections_from_json(db)

    print("\n🎉 所有数据同步完成！")

if __name__ == "__main__":
    seed_data()