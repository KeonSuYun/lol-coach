import json
import os
import datetime
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# 1. 加载环境变量 (用于本地测试读取 .env，生产环境会自动读取系统变量)
load_dotenv()

# 2. 配置密码加密工具 (用于创建管理员密码)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def load_json(filename):
    """
    辅助函数：从 backend/secure_data/ 目录安全读取 JSON 文件
    """
    # 获取当前脚本所在目录 (backend/)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # 拼接完整路径
    file_path = os.path.join(base_dir, "secure_data", filename)
    
    if not os.path.exists(file_path):
        print(f"⚠️ [警告] 文件未找到: {filename} (跳过此项同步)")
        return None
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ [错误] 读取 {filename} 失败: {e}")
        return None

def seed_data():
    print("🌱 [Seeding] 正在初始化数据库数据...")
    
    # 3. 连接数据库
    # 优先读取环境变量里的 MONGO_URL，读不到则默认为本地
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
    client = MongoClient(mongo_url)
    
    # ⚠️ 确保这里的数据库名和你 server.py 里的一致
    db = client["lol_community"] 

    # ================= 4. 同步 Prompts (提示词) =================
    print("\n🚀 [1/4] 同步 AI 提示词 (Prompts)...")
    prompts_data = load_json("prompts.json")
    
    if prompts_data:
        # 假设 prompts.json 格式为: {"system_coach": "你是一个...", "analysis_rule": "..."}
        for key, content in prompts_data.items():
            db.prompts.replace_one(
                {"_id": key},         # 查询条件：按 _id 查找
                {"content": content}, # 更新内容
                upsert=True           # 如果不存在则插入，存在则更新
            )
        print("✅ Prompts 同步完成")

    # ================= 5. 同步 Champions (英雄数据) =================
    print("\n🚀 [2/4] 同步英雄数据 (Champions)...")
    champs_data = load_json("champions.json")
    
    if champs_data:
        # 假设 champions.json 是列表: [{"id": "Aatrox", "tier": "T1", ...}, ...]
        count = 0
        for hero in champs_data:
            if "id" in hero:
                db.champions.replace_one(
                    {"id": hero["id"]}, # 使用英雄英文名 ID 作为主键
                    hero, 
                    upsert=True
                )
                count += 1
        print(f"✅ 已同步 {count} 个英雄的数据")

    # ================= 6. 同步 S15 机制 (S15 Mechanics) =================
    print("\n🚀 [3/4] 同步 S15 赛季核心机制...")
    s15_data = load_json("s15_mechanics.json")
    
    if s15_data:
        # 将整个 JSON 存为一个单独的文档，ID 固定为 "s15_details"
        # 这样 server.py 可以一次性读出所有配置
        db.constants.replace_one(
            {"_id": "s15_details"}, 
            s15_data, 
            upsert=True
        )
        print("✅ S15 机制数据已覆盖旧版数据")

    # ================= 7. 创建/检查 管理员账号 =================
    print("\n🚀 [4/4] 检查管理员账号...")
    
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD") # 生产环境务必设置此环境变量

    if not admin_pass:
        print("⚠️ [跳过] 未检测到 ADMIN_PASSWORD 环境变量，不执行管理员创建。")
        print("   (如果是本地测试，请在 .env 文件中设置 ADMIN_PASSWORD)")
    else:
        # 检查管理员是否已存在
        existing_admin = db.users.find_one({"username": admin_user})
        
        if not existing_admin:
            hashed_pw = pwd_context.hash(admin_pass)
            new_admin = {
                "username": admin_user,
                "password": hashed_pw,
                "role": "admin", # 🔥 关键：赋予管理员权限
                "created_at": datetime.datetime.utcnow(),
                "last_analysis_time": None
            }
            db.users.insert_one(new_admin)
            print(f"✅ 管理员账号已创建: {admin_user}")
        else:
            # 可选：强制确保现有 admin 账号拥有 admin 权限
            db.users.update_one(
                {"username": admin_user},
                {"$set": {"role": "admin"}}
            )
            print(f"ℹ️ 管理员账号 {admin_user} 已存在 (权限已确认)")

    print("\n🎉 =========================================")
    print("🎉 所有数据播种完成！后端已准备就绪。")
    print("🎉 =========================================")

if __name__ == "__main__":
    seed_data()