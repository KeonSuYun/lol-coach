import json
import os
from pymongo import MongoClient
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_admin_user(db):
    print("\n🚀 [4/4] 正在检查/创建管理员账号...")
    
    # 这里定义你的超级管理员账号密码
    ADMIN_USER = "admin"
    ADMIN_PASS = "admin123" # ⚠️ 生产环境请务必修改这里的密码！
    
    existing_admin = db.users.find_one({"username": ADMIN_USER})
    
    if not existing_admin:
        hashed_pw = pwd_context.hash(ADMIN_PASS)
        admin_doc = {
            "username": ADMIN_USER,
            "password": hashed_pw,
            "role": "admin", # 🔥 这里赋予至高无上的 admin 权限
            "created_at": "SYSTEM_INIT"
        }
        db.users.insert_one(admin_doc)
        print(f"✅ 管理员账号已创建: {ADMIN_USER} / {ADMIN_PASS}")
    else:
        # 如果你想强制重置管理员权限，可以在这里 update_one
        db.users.update_one(
            {"username": ADMIN_USER},
            {"$set": {"role": "admin"}}
        )
        print("✅ 管理员账号已存在 (权限已确认)")

def load_json(filename):
    """安全加载 JSON 文件"""
    # 获取 seed_data.py 所在的文件夹 (即 backend) 的绝对路径
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # 拼接目标路径
    file_path = os.path.join(base_dir, 'secure_data', filename)
    
    # 🔍 调试打印
    print(f"🔍 [Debug] 正在尝试读取文件: {file_path}")

    if not os.path.exists(file_path):
        print(f"⚠️ 警告: 找不到 {filename}，请确保你已在本地创建了此敏感数据文件。")
        return None  # 如果找不到文件返回 None
        
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def seed_data():
    """主播种函数"""
    print("🔌 [Database] 正在尝试连接: mongodb://localhost:27017")
    try:
        client = MongoClient("mongodb://localhost:27017/")
        db = client["lol_community"]
        print("✅ [Database] 连接成功")
    except Exception as e:
        print(f"❌ [Database] 连接失败: {e}")
        return

    # --- 1. Prompts ---
    print("\n🚀 [1/3] 正在同步 Prompts...")
    prompts = load_json("prompts.json")
    if prompts:
        db.prompts.delete_many({})
        db.prompts.insert_many(prompts)
        print(f"✅ 成功更新 {len(prompts)} 条 Prompt 模板")
    else:
        print("❌ 跳过 Prompt 更新 (无数据或文件缺失)")

    # --- 2. Champions ---
    print("\n🚀 [2/3] 正在同步英雄数据...")
    champions = load_json("champions.json")
    if champions:
        db.champions.delete_many({})
        db.champions.insert_many(champions)
        print(f"✅ 成功更新 {len(champions)} 个英雄数据")
    else:
        print("❌ 跳过英雄更新 (无数据或文件缺失)")

    # --- 3. Game Constants (S15 Rules) ---
    print("\n🚀 [3/3] 正在同步峡谷规则 (S15)...")
    constants = load_json("game_constants.json")
    
    if constants:
        # 使用 replace_one 确保只有一份配置，upsert=True 表示不存在则创建
        db.constants.replace_one(
            {"_id": "s15_rules"}, 
            constants, 
            upsert=True
        )
        print("✅ 成功更新 S15 峡谷规则数据库")
    else:
        print("❌ 跳过规则更新 (无数据或文件缺失)")
        
    client = MongoClient("mongodb://localhost:27017/")
    db = client["lol_community"]
        
    # ... Prompts, Champions, Constants 的同步 ...

    # ✨ 执行管理员注入
    seed_admin_user(db)

    print("\n🎉 所有机密数据同步完成！")

if __name__ == "__main__":
    seed_data()