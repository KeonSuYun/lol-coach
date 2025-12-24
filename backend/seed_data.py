import json
import os
import datetime
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def load_json(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "secure_data", filename)
    if not os.path.exists(file_path):
        print(f"⚠️ [警告] 文件未找到: {filename}")
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ [错误] 读取 {filename} 失败: {e}")
        return None

def seed_data():
    print("🌱 [Seeding] 正在初始化数据库...")
    
    # 1. 打印连接串 (隐去密码，方便调试)
    raw_url = os.getenv("MONGO_URL", "")
    if "@" in raw_url:
        print(f"🔌 使用连接串: {raw_url.split('@')[1]}") # 只打印 @ 后面的部分
    else:
        print(f"🔌 使用连接串: {raw_url} (⚠️ 警告: 未检测到密码，可能导致权限错误)")

    try:
        client = MongoClient(raw_url)
        # 强制发起一次连接检查，如果有权限问题立刻报错
        client.admin.command('ping')
        print("✅ 数据库连接 & 认证成功！")
    except Exception as e:
        print(f"❌ 数据库连接失败！请检查 MONGO_URL 里的密码。错误信息:\n{e}")
        return

    db = client["lol_community"]

    # ================= 1. 同步 Prompts (兼容列表/字典) =================
    print("\n🚀 [1/4] 同步 AI 提示词 (Prompts)...")
    prompts_data = load_json("prompts.json")
    
    if prompts_data:
        count = 0
        # 如果是列表 (你的 prompts.json 是这种情况)
        if isinstance(prompts_data, list):
            for item in prompts_data:
                # 🔥 修改点 1: 增加对 'mode' 字段的识别
                p_id = item.get("id") or item.get("_id") or item.get("name") or item.get("mode")
                
                # 🔥 修改点 2: 只要有 ID 就直接存整个对象，不再强制要求 'content' 字段
                # 这样你的 system_template 和 user_template 都会被完整存入数据库
                if p_id:
                    # 确保 _id 存在，方便后续查询
                    item["_id"] = p_id
                    db.prompts.replace_one({"_id": p_id}, item, upsert=True)
                    count += 1
        
        # 如果是字典 (旧格式兼容)
        elif isinstance(prompts_data, dict):
            for key, content in prompts_data.items():
                real_content = content
                # 如果 content 是个字典，确保里面有 _id
                if isinstance(content, dict):
                     content["_id"] = key
                     real_content = content
                else:
                     # 如果是纯字符串，包装一下
                     real_content = {"_id": key, "content": content}
                     
                db.prompts.replace_one({"_id": key}, real_content, upsert=True)
                count += 1
        print(f"✅ 已同步 {count} 条 Prompt")

    # ================= 2. 同步 Champions (智能 ID 识别) =================
    print("\n🚀 [2/4] 同步英雄数据 (Champions)...")
    
    # 👇👇👇 【新增这两行】 👇👇👇
    db.champions.delete_many({}) 
    print("🧹 已清空旧英雄数据，准备重新写入...")
    # 👆👆👆 
    
    champs_data = load_json("champions.json")

    if champs_data:
        success_count = 0
        
        # 🔍 调试：打印第一条数据，看看它的 Key 到底长什么样
        if len(champs_data) > 0:
            print(f"🔍 [调试] 第一条英雄数据的 Keys: {list(champs_data[0].keys())}")
        
        for hero in champs_data:
            # 🔥 智能识别：尝试所有可能的 ID 字段名
            hero_id = (
                hero.get("id") or 
                hero.get("key") or 
                hero.get("championId") or 
                hero.get("name") or # 实在不行用名字当ID
                hero.get("_id")
            )
            
            if hero_id:
                # 统一转成字符串，防止数字ID报错
                hero["id"] = str(hero_id) 
                db.champions.replace_one({"id": str(hero_id)}, hero, upsert=True)
                success_count += 1
            else:
                # 如果没找到 ID，打印出来看看到底是个啥
                print(f"⚠️ 跳过一条无法识别 ID 的数据: {str(hero)[:50]}...")
                
        print(f"✅ 已同步 {success_count} 个英雄的数据")

    # ================= 3. 同步 S15 机制 =================
    print("\n🚀 [3/4] 同步 S15 赛季核心机制...")
    s15_data = load_json("s15_mechanics.json")
    if s15_data:
        db.constants.replace_one({"_id": "s15_details"}, s15_data, upsert=True)
        print("✅ S15 机制数据已覆盖")

    # ================= 4. 管理员 =================
    print("\n🚀 [4/4] 检查管理员账号...")
    admin_pass = os.getenv("ADMIN_PASSWORD")
    if admin_pass:
        admin_user = os.getenv("ADMIN_USERNAME", "admin")
        existing = db.users.find_one({"username": admin_user})
        if not existing:
            hashed = pwd_context.hash(admin_pass)
            db.users.insert_one({
                "username": admin_user, 
                "password": hashed, 
                "role": "admin", 
                "created_at": datetime.datetime.utcnow()
            })
            print(f"✅ 管理员 {admin_user} 创建成功")
        else:
            print("ℹ️ 管理员已存在")
    
    print("\n🎉 全部完成！")

if __name__ == "__main__":
    seed_data()