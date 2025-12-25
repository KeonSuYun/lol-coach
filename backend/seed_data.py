import json
import os
import datetime
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

def load_json(filename):
    """
    辅助函数：尝试从 secure_data 文件夹读取 JSON
    """
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

def seed_data():
    print("🌱 [Seeding] 正在初始化数据库...")
    
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ 数据库连接成功！")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return

    db = client["lol_community"]

    # =====================================================
    # 1. 同步 Prompts (彻底修复 DuplicateKeyError)
    # =====================================================
    print("\n🚀 [1/4] 同步 AI 提示词 (Prompts)...")
    
    prompts_data = load_json("prompts.json")
    
    if prompts_data:
        # 🔥🔥🔥 关键修复：先清空旧数据，防止 ID 冲突和唯一性索引报错 🔥🔥🔥
        db.prompt_templates.delete_many({})
        print("🧹 已清空旧 Prompt 数据，准备写入新配置...")

        count = 0
        # 兼容 List 或 Dict 格式
        items = prompts_data if isinstance(prompts_data, list) else list(prompts_data.values())
        
        for item in items:
            # 获取 ID
            p_id = item.get("id") or item.get("_id") or item.get("mode")
            
            if p_id:
                item["_id"] = p_id # 确保数据库主键一致
                # 因为前面已经清空了，这里直接 insert 或者 replace 都可以
                # 使用 replace_one + upsert 是为了双重保险
                db.prompt_templates.replace_one({"_id": p_id}, item, upsert=True)
                count += 1
                
        print(f"✅ 已从 JSON 同步 {count} 条 Prompt 模板")
    else:
        print("⚠️ 未找到 prompts.json 或文件为空，跳过更新 Prompt。")

    # =====================================================
    # 2. 同步 Champions (保持原有逻辑)
    # =====================================================
    print("\n🚀 [2/4] 同步英雄数据 (Champions)...")
    
    champs_data = load_json("champions.json")
    if champs_data:
        # ⚠️ 只有读取到数据才清空，防止误删
        db.champions.delete_many({}) 
        print("🧹 已清空旧英雄数据，准备重新写入...")
        
        success_count = 0
        for hero in champs_data:
            hero_id = hero.get("id") or hero.get("key")
            
            if hero_id:
                hero["id"] = str(hero_id) 
                hero["_id"] = str(hero_id)
                db.champions.replace_one({"_id": str(hero_id)}, hero, upsert=True)
                success_count += 1
                
        print(f"✅ 已同步 {success_count} 条英雄数据")
    else:
        print("⚠️ 未找到 champions.json，跳过英雄数据更新")

    # =====================================================
    # 3. 同步 S15 机制
    # =====================================================
    print("\n🚀 [3/4] 同步 S15 赛季数据...")
    s15_json = load_json("s15_mechanics.json")
    if s15_json:
        s15_json["_id"] = "s15_rules"
        db.config.replace_one({"_id": "s15_rules"}, s15_json, upsert=True)
        print("✅ S15 规则数据已更新")
    else:
        print("⚠️ 未找到 S15 数据，跳过")

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
        else:
            print("ℹ️ 管理员已存在")
    
    print("\n🎉 数据同步完成！请记得运行 fix_db_aliases.py 清洗中英文名。")

if __name__ == "__main__":
    seed_data()