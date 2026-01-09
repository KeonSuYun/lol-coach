import os
import datetime
import time
import requests
import json
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv

# ================= ⚙️ 配置区域 =================
# 1. 后端 API 地址
API_URL = "http://localhost:8000"

# 2. 数据库地址 (尝试从环境变量读，读不到就用默认的)
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017/"

# 3. 测试账号信息
TEST_USER = "testuser"
TEST_PASS = "password123"

# 4. 模拟的“王者”档案
FAKE_PROFILE = {
    "gameName": "Hex测试员",    
    "tagLine": "AUTO",
    "rank": "CHALLENGER I",     # 存入档案的段位
    "level": 888,
    "profileIconId": 29,
    "mastery": [],
    "matches": []
}

# 5. 模拟 BP 请求 (带段位)
BP_PAYLOAD = {
    "mode": "bp",
    "myHero": "None",
    "enemyHero": "None",
    "myTeam": [],
    "enemyTeam": [],
    "userRole": "MID",
    "rank": "CHALLENGER",       # 🔥 传给 AI 的段位
    "mapSide": "blue",
    "model_type": "chat"
}

# ================= 🛠️ 工具函数 =================
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def step_1_reset_db():
    print(f"\n🧹 [步骤 1/4] 清理并重建账号: {TEST_USER} ...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        try:
            db = client.get_default_database()
        except:
            db = client['lol_community']
        
        users = db['users']
        
        # 1. 删除旧号
        users.delete_many({"username": TEST_USER})
        
        # 2. 创建新号
        new_user = {
            "username": TEST_USER,
            "password": pwd_context.hash(TEST_PASS), # 加密密码
            "role": "user",
            "email": f"{TEST_USER}@auto.test",
            "is_pro": True, # 给个 Pro 方便测试
            "created_at": datetime.datetime.now(datetime.timezone.utc),
            "game_profile": {}, 
            "usage_stats": {"counts_chat": {}, "counts_reasoner": {}, "last_access": {}, "hourly_count": 0, "bonus_r1": 100}
        }
        users.insert_one(new_user)
        print("   ✅ 数据库操作成功：旧号已删，新号已建。")
        return True
    except Exception as e:
        print(f"   ❌ 数据库连接失败 (请检查 MongoDB 是否启动): {e}")
        return False

def step_2_login_and_sync():
    print(f"\n🔄 [步骤 2/4] 登录并同步 LCU 数据...")
    session = requests.Session()
    
    # 1. 登录
    try:
        res = session.post(f"{API_URL}/token", data={"username": TEST_USER, "password": TEST_PASS})
        if res.status_code != 200:
            print(f"   ❌ 登录失败: {res.text}")
            return None, None
        
        token = res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        print("   ✅ 登录成功，Token 获取完成。")
    except Exception as e:
        print(f"   ❌ API 连接失败 (请检查 server.py 是否运行): {e}")
        return None, None

    # 2. 同步
    try:
        res = session.post(f"{API_URL}/users/sync_profile", json=FAKE_PROFILE, headers=headers)
        if res.status_code == 200:
            print(f"   ✅ 同步请求发送成功 (GameName: {FAKE_PROFILE['gameName']})")
        else:
            print(f"   ❌ 同步失败: {res.text}")
            return None, None
            
    except Exception as e:
        print(f"   ❌ 同步请求异常: {e}")
        return None, None

    return session, headers

def step_3_verify_display_name(session, headers):
    print(f"\n🕵️ [步骤 3/4] 验证 [用户名显示] ...")
    try:
        # 获取个人信息
        res = session.get(f"{API_URL}/users/me", headers=headers)
        data = res.json()
        
        # 提取后端存储的 profile
        gp = data.get('game_profile', {})
        saved_name = gp.get('gameName')
        saved_tag = gp.get('tagLine')
        
        print(f"   - 后端存储数据: {saved_name} #{saved_tag}")
        
        if saved_name == FAKE_PROFILE['gameName'] and saved_tag == FAKE_PROFILE['tagLine']:
            print("   ✅ [验证通过] 后端正确存储了游戏昵称！前端/后台应该能正常显示了。")
        else:
            print("   ❌ [验证失败] 后端数据与上传数据不一致。")
            
    except Exception as e:
        print(f"   ❌ 验证异常: {e}")

def step_4_verify_bp_rank(session, headers):
    print(f"\n🧠 [步骤 4/4] 验证 [BP段位接收] ...")
    print(f"   - 发送段位参数: {BP_PAYLOAD['rank']}")
    
    try:
        # 发送 BP 请求 (流式)
        start_time = time.time()
        res = session.post(f"{API_URL}/analyze", json=BP_PAYLOAD, headers=headers, stream=True)
        
        if res.status_code == 200:
            print("   ✅ 请求连接成功 (Status 200)")
            
            # 读取一点流数据，确保 AI 开始响应
            content_received = False
            for chunk in res.iter_content(chunk_size=1024):
                if chunk:
                    content_received = True
                    break # 只要收到第一个包，就说明通了
            
            if content_received:
                print(f"   ✅ 成功接收到 AI 流数据 (耗时 {time.time() - start_time:.2f}s)")
                print("   💡 [提示] 请查看 Server 后台日志，确认是否输出了 '...request with rank: CHALLENGER...'")
            else:
                print("   ⚠️ 连接通了但没收到数据流。")
        else:
            print(f"   ❌ 请求被拒绝: {res.status_code} - {res.text}")
            
    except Exception as e:
        print(f"   ❌ BP 请求异常: {e}")

# ================= ▶️ 主程序 =================
if __name__ == "__main__":
    print("="*50)
    print("      HexLite 全自动集成测试脚本")
    print("="*50)
    
    # 1. 重置数据库
    if step_1_reset_db():
        # 2. 登录同步
        session, headers = step_2_login_and_sync()
        
        if session and headers:
            # 3. 验证用户名显示
            step_3_verify_display_name(session, headers)
            
            # 4. 验证 BP 段位
            step_4_verify_bp_rank(session, headers)
            
    print("\n" + "="*50)
    print("测试结束。")