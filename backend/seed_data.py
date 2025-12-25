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

# ✨ 辅助函数：清洗百分比字符串 (42.18% -> 0.4218)
def parse_percent(val):
    if isinstance(val, str):
        # 移除 % 并转为浮点
        clean = val.replace("%", "").strip()
        try:
            return float(clean) / 100.0
        except:
            return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    return 0.0

# ✨ 辅助函数：清洗层级 (T1 -> 1)
def parse_tier(val):
    if isinstance(val, int): return val
    if isinstance(val, str):
        # 移除 T，如 T5 -> 5
        clean = val.upper().replace("T", "").strip()
        if clean.isdigit():
            return int(clean)
    return 5 # 默认 T5 (垫底)

def seed_data():
    print("🌱 [Seeding] 正在根据新格式初始化数据库...")
    
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ 数据库连接成功！")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return

    db = client["lol_community"]

    # =====================================================
    # 1. 同步英雄数据 (Champions) - ✨ 核心修改
    # =====================================================
    print("\n🚀 [1/4] 同步英雄数据 (适配新 JSON 格式)...")
    
    champs_data = load_json("champions.json")
    if champs_data:
        # 🧹 1. 彻底清空旧数据
        db.champions.delete_many({}) 
        print("🧹 已清空旧 Champions 集合")
        
        success_count = 0
        batch_docs = []

        for hero in champs_data:
            # ✨ 2. 字段清洗与映射
            try:
                # 如果没有 id 字段，使用 name (英文名) 作为唯一ID
                hero_id = hero.get("id") or hero.get("name")
                if not hero_id: continue

                clean_doc = {
                    "id": str(hero_id),
                    "_id": str(hero_id),
                    "name": hero.get("name", "Unknown"),
                    # 确保 alias 是列表，方便搜索 ["中文", "外号"]
                    "alias": hero.get("alias", []), 
                    "title": hero.get("title", ""),
                    
                    # 转换 role 为大写 (top -> TOP)
                    "role": hero.get("role", "MID").upper(),
                    
                    # ✨ 数值转换
                    "tier": parse_tier(hero.get("tier")),
                    "win_rate": parse_percent(hero.get("win_rate")),
                    "pick_rate": parse_percent(hero.get("pick_rate")),
                    "ban_rate": parse_percent(hero.get("ban_rate")),
                    
                    "tags": hero.get("tags", []),
                    "image_url": hero.get("image_url", ""), # 如果 JSON 里有图片链接
                    "updated_at": datetime.datetime.utcnow()
                }
                
                batch_docs.append(clean_doc)
                success_count += 1
            except Exception as e:
                print(f"⚠️ 跳过异常数据: {hero.get('name')} - {e}")

        # 批量写入
        if batch_docs:
            db.champions.insert_many(batch_docs)
            
        print(f"✅ 成功导入 {success_count} 个英雄 (格式已自动修正)")
    else:
        print("⚠️ 未找到 champions.json，跳过英雄数据更新")

    # =====================================================
    # 2. 同步 Prompts
    # =====================================================
    print("\n🚀 [2/4] 同步 AI 提示词...")
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
    print("\n🚀 [3/4] 同步 S15 赛季数据...")
    s15_json = load_json("s15_mechanics.json")
    if s15_json:
        s15_json["_id"] = "s15_rules"
        db.config.replace_one({"_id": "s15_rules"}, s15_json, upsert=True)
        print("✅ S15 规则数据已更新")

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
                "username": admin_user, 
                "password": hashed, 
                "role": "admin", 
                "is_pro": True,
                "created_at": datetime.datetime.utcnow()
            })
            print(f"✅ 管理员 {admin_user} 创建成功")

    print("\n🎉 数据库重置完成！现在后端可以正确读取 T5 和胜率了。")

if __name__ == "__main__":
    seed_data()