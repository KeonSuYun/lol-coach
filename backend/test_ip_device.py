import requests
import random
import string
import datetime
from pymongo import MongoClient
from passlib.context import CryptContext

# ================= ⚙️ 配置区域 =================
API_URL = "http://localhost:8000"
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "lol_community" 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class C:
    OK = '\033[92m'       # 绿
    WARN = '\033[93m'     # 黄
    FAIL = '\033[91m'     # 红
    CYAN = '\033[96m'     # 青
    END = '\033[0m'

def rand_str(k=6):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=k))

def inject_user_db(username, device_id=None):
    """注入用户 (绕过注册验证码)"""
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        db = client[DB_NAME]
        users_col = db['users'] 
        
        if users_col.find_one({"username": username}): return True

        user_doc = {
            "username": username,
            "password": pwd_context.hash("Password123!"),
            "email": f"{username}@test.com",
            "role": "user",
            "created_at": datetime.datetime.now(),
            "invite_count": 0,
            "invited_by": None,
            # 🔥 关键：如果没传 device_id，就随机生成一个（模拟不同设备）
            "device_id": device_id or f"dev_{rand_str(10)}", 
            "r1_remaining": 10
        }
        users_col.insert_one(user_doc)
        return True
    except Exception as e:
        print(f"{C.FAIL}❌ 数据库连接失败: {e}{C.END}")
        return False

def login_get_token(username):
    try:
        resp = requests.post(f"{API_URL}/token", data={"username": username, "password": "Password123!"})
        if resp.status_code == 200: return resp.json().get("access_token")
    except: pass
    return None

# ================= 🧪 测试 1: 设备指纹限制 (Device Fingerprint) =================
def test_same_device():
    print(f"\n{C.CYAN}🧪 [测试 1] 同设备指纹 (Same Device ID) 限制测试...{C.END}")
    
    # 1. 设定一个固定的特征码
    HACKER_DEVICE_ID = "fp_same_device_check_123"
    
    # 2. 创建邀请人
    boss = f"Boss_{rand_str(3)}"
    inject_user_db(boss, device_id="fp_boss_unique") # 正常设备
    
    # 3. 循环尝试 3 次，每次换新账号，但用同一个 Device ID
    print(f"   - 场景: 3 个不同的新账号，使用同一个 DeviceID [{HACKER_DEVICE_ID}] 尝试领奖")
    
    success_count = 0
    for i in range(1, 4):
        hacker = f"Hacker_Dev_{i}_{rand_str(3)}"
        inject_user_db(hacker, device_id=HACKER_DEVICE_ID) # 🔥 注入相同指纹
        token = login_get_token(hacker)
        
        res = requests.post(
            f"{API_URL}/user/redeem_invite",
            json={"invite_code": boss},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            print(f"   ⚠️ 第 {i} 次: 成功 (未拦截)")
            success_count += 1
        else:
            detail = res.json().get("detail", "未知错误")
            print(f"   🛡️ 第 {i} 次: 被拦截 ({detail})")

    # 结果判定
    if success_count < 3:
        print(f"{C.OK}✅ 通过: 系统成功拦截了重复设备的请求 (成功 {success_count}/3){C.END}")
    else:
        print(f"{C.FAIL}❌ 失败: 设备指纹限制未生效 (全部成功){C.END}")

# ================= 🧪 测试 2: 同 IP 限制 (Same IP) =================
def test_same_ip():
    print(f"\n{C.CYAN}🧪 [测试 2] 同 IP (Same IP Address) 限制测试...{C.END}")
    print(f"   - 场景: 10 个不同的新账号，不同的设备 ID，但来自同一个 IP (本机)")
    
    # 1. 创建邀请人
    boss = f"Boss_IP_{rand_str(3)}"
    inject_user_db(boss)
    
    success_count = 0
    # 尝试 10 次
    for i in range(1, 11):
        # 每个账号都是全新的，设备ID也是随机的
        # 唯独 IP 是相同的（因为都是从本机发出的请求）
        newbie = f"Newbie_IP_{i}_{rand_str(3)}"
        inject_user_db(newbie, device_id=None) # device_id=None 会自动生成随机的
        token = login_get_token(newbie)
        
        if not token: continue

        res = requests.post(
            f"{API_URL}/user/redeem_invite",
            json={"invite_code": boss},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if res.status_code == 200:
            print(f"   ✅ 第 {i} 个账号: 成功", end="\r")
            success_count += 1
        else:
            detail = res.json().get("detail", "")
            print(f"\n   🛡️ 第 {i} 个账号: 被拦截! ({detail})")
            break # 一旦被拦截，测试结束
    
    print(f"\n   📊 统计: 在同 IP 下，连续成功了 {success_count} 次")
    
    if success_count == 10:
        print(f"{C.WARN}⚠️ 警告: 未检测到 IP 限制 (10次全部通过)。{C.END}")
        print(f"   (注: 如果您未在后端专门配置 IP 限制，这是正常现象)")
    else:
        print(f"{C.OK}✅ 通过: 触发了 IP 频率限制 (阈值约为 {success_count}){C.END}")

def main():
    test_same_device()
    test_same_ip()

if __name__ == "__main__":
    main()