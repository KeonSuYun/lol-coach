import os
from pymongo import MongoClient
from dotenv import load_dotenv

# 加载环境变量 (确保能连上数据库)
load_dotenv()

# 获取数据库连接
MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
client = MongoClient(MONGO_URI)

# 选择数据库
db = client['lol_community'] # 或者是您的具体数据库名

def delete_user_by_email(email):
    print(f"🔍 正在查找邮箱: {email} ...")
    
    # 1. 查找用户
    user = db.users.find_one({"email": email})
    
    if not user:
        print("❌ 未找到该邮箱注册的用户。")
        return

    username = user['username']
    print(f"✅ 找到用户: {username} (ID: {user['_id']})")
    
    # 2. 删除用户主记录 (这是最关键的，删了就能重注)
    result = db.users.delete_one({"_id": user['_id']})
    print(f"🗑️  已删除用户记录: {result.deleted_count} 条")

    # 3. (可选) 删除关联数据 - 如果你想删得干干净净
    # 删除该用户的验证码记录
    db.otps.delete_many({"contact": email})
    print(f"🧹 已清理验证码记录")
    
    # 删除该用户的订单记录 (如果有)
    db.orders.delete_many({"username": username})
    print(f"🧹 已清理订单记录")

    # 注意：该用户发的帖子(Tips)和反馈(Feedback)通常保留，或者按需删除
    # db.tips.delete_many({"author_id": username})
    
    print("\n🎉 清除完成！现在您可以重新注册了。")

if __name__ == "__main__":
    target_email = input("请输入要清除的注册邮箱: ").strip()
    delete_user_by_email(target_email)