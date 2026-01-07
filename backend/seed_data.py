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
    print("\n🚀 [5/5] 同步 RAG 修正数据 (Corrections)...")
    
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
        try:
            db.champions.drop_indexes()
            print("🔧 已清理旧索引 (解决重名冲突问题)")
        except Exception as e:
            print(f"⚠️ 索引清理跳过: {e}")

        delete_result = db.champions.delete_many({})
        print(f"🧹 已清空旧表 (删除了 {delete_result.deleted_count} 条)")
        
        hero_map = {}

        for hero in champs_data:
            try:
                hero_english_id = hero.get("name") 
                if not hero_english_id: continue
                
                role_raw = hero.get("role", "mid")
                role_upper = role_raw.upper()
                role_lower = role_raw.lower()
                
                stats_block = {
                    "role": role_lower,
                    "tier": parse_tier(hero.get("tier")),
                    "win_rate": parse_percent(hero.get("win_rate")),
                    "pick_rate": parse_percent(hero.get("pick_rate")),
                    "ban_rate": parse_percent(hero.get("ban_rate"))
                }

                if hero_english_id not in hero_map:
                    alias_list = hero.get("alias", [])
                    chinese_aliases = [a for a in alias_list if has_chinese(a)]
                    
                    display_name_cn = hero_english_id
                    if chinese_aliases:
                        display_name_cn = chinese_aliases[0]
                    final_aliases = hero.get("alias", [])
                    if str(hero_english_id) not in final_aliases:
                        final_aliases.append(str(hero_english_id))

                    hero_map[hero_english_id] = {
                        "id": str(hero_english_id),
                        "_id": str(hero_english_id),
                        "alias": final_aliases,          # ✅ 修正：保存为列表，包含 ["盲僧", "李青", "Lee Sin"]
                        "title": display_name_cn,
                        "name": display_name_cn,
                        "key": str(hero_english_id),
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
    # 3. 同步 S16 机制
    # =====================================================
    print("\n🚀 [3/5] 更新 S16 数据...")
    s16_json = load_json("s16_mechanics.json")
    if s16_json:
        s16_json["_id"] = "s16_rules"
        db.config.replace_one({"_id": "s16_rules"}, s16_json, upsert=True)
        print("✅ S16 规则已更新")

    # =====================================================
    # 4. 🔥🔥🔥 [核心] 管理员权限自动修复 🔥🔥🔥
    # =====================================================
    print("\n🚀 [4/5] 🛡️ 检查并修复管理员 (Root) 权限...")
    
    target_username = "admin" # 您的管理员用户名
    users_col = db['users']
    
    # 查找该用户
    admin_user = users_col.find_one({"username": target_username})
    
    # 定义 Root 权限属性
    root_attributes = {
        "role": "root",          # 最高权限
        "is_pro": True,          # 也是 Pro 会员
        "active_title": "官方/传说", # 自动佩戴传说头衔
        # 永不过期的会员时间 (设为 2099 年)
        "membership_expire": datetime.datetime(2099, 12, 31, tzinfo=datetime.timezone.utc),
        # 赋予无限额度 (或者极大值)
        "r1_remaining": 99999
    }

    if admin_user:
        # 场景 A: 账号已存在 -> 强制覆盖权限 (提权)
        # 只有当权限不对时才打印日志，避免每次重启都刷屏
        if admin_user.get("role") != "root" or not admin_user.get("is_pro"):
            users_col.update_one(
                {"username": target_username},
                {"$set": root_attributes}
            )
            print(f"   🔧 检测到 [{target_username}] 权限异常，已强制修复为 ROOT (超级管理员)")
        else:
            print(f"   ✅ [{target_username}] 权限正常 (Root)")
            
    else:
        # 场景 B: 账号不存在 -> 自动创建默认管理员
        print(f"   ⚠️ 用户 [{target_username}] 不存在，正在自动初始化...")
        
        default_password = "admin" # 初始密码
        
        new_admin_doc = {
            "username": target_username,
            "password": pwd_context.hash(default_password),
            "email": "admin@hex.gg", # 默认邮箱
            "created_at": get_utc_now(),
            **root_attributes # 展开 root 属性
        }
        
        users_col.insert_one(new_admin_doc)
        print(f"   🎉 超级管理员已创建! 账号: {target_username} / 密码: {default_password}")

    # =====================================================
    # 5. 调用修正数据
    # =====================================================
    sync_corrections_from_json(db)

    print("\n🎉 所有数据同步完成！")

if __name__ == "__main__":
    seed_data()