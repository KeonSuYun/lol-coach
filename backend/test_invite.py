import requests
import random
import string
import datetime
from pymongo import MongoClient
from passlib.context import CryptContext

# ================= ⚙️ 配置区域 =================
API_URL = "http://localhost:8000"
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "lol_community" # 请确认数据库名

# 密码加密工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class C:
    OK = '\033[92m'       # 绿
    WARN = '\033[93m'     # 黄
    FAIL = '\033[91m'     # 红
    CYAN = '\033[96m'     # 青
    END = '\033[0m'

def rand_str(k=6):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=k))

def inject_user_db(username, device_id=None, r1_remaining=10):
    """直接注入用户，可自定义设备ID和余额"""
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        db = client[DB_NAME]
        users_col = db['users'] 
        
        # 如果存在先删除，保证测试环境干净
        users_col.delete_one({"username": username})

        user_doc = {
            "username": username,
            "password": pwd_context.hash("Password123!"),
            "email": f"{username}@test.com",
            "role": "user",
            "created_at": datetime.datetime.now(),
            "invite_count": 0,
            "invited_by": None,
            "device_id": device_id or f"dev_{rand_str()}", # 🔥 关键：设备指纹
            "r1_remaining": r1_remaining # 🔥 关键：R1 余额
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

# ================= 🧪 测试用例 1: 设备指纹 (Device Fingerprint) =================
def test_device_fingerprint():
    print(f"\n{C.CYAN}🧪 [测试 1] 设备指纹防刷检测...{C.END}")
    
    # 模拟同一台设备的指纹
    SAME_DEVICE_ID = "fp_1234567890_test"
    
    # 1. 创建邀请人 (Inviter)
    inviter = f"Cheater_A_{rand_str(3)}"
    inject_user_db(inviter, device_id=SAME_DEVICE_ID)
    
    # 2. 创建作弊小号 (Cheater B)，使用相同的 Device ID
    cheater = f"Cheater_B_{rand_str(3)}"
    inject_user_db(cheater, device_id=SAME_DEVICE_ID)
    token_b = login_get_token(cheater)
    
    print(f"   - 场景: 用户 [{cheater}] 尝试填写 [{inviter}] 的邀请码")
    print(f"   - 特征: 两人 DeviceID 均为 '{SAME_DEVICE_ID}' (同一台电脑)")
    
    # 3. 尝试兑换
    res = requests.post(
        f"{API_URL}/user/redeem_invite",
        json={"invite_code": inviter},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    if res.status_code != 200:
        # 如果返回非 200，检查错误信息
        detail = res.json().get("detail", "")
        if "设备" in detail or "同设备" in detail:
            print(f"{C.OK}   ✅ 通过: 系统成功拦截同设备互刷 (提示: {detail}){C.END}")
        else:
            print(f"{C.FAIL}   ❌ 失败: 请求被拒绝但原因不明 ({detail}){C.END}")
    else:
        # 如果返回 200，说明没防住
        print(f"{C.FAIL}   ❌ 严重失败: 同设备互刷成功了！(存在薅羊毛漏洞){C.END}")

# ================= 🧪 测试 2: R1 模型零余额保护 (Zero Balance) =================
def test_r1_zero_balance():
    print(f"\n{C.CYAN}🧪 [测试 2] R1 模型零余额保护 (不消耗API)...{C.END}")
    
    # 1. 创建一个穷光蛋用户 (R1余额 = 0)
    poor_guy = f"Poor_{rand_str(3)}"
    inject_user_db(poor_guy, r1_remaining=0)
    token = login_get_token(poor_guy)
    
    print(f"   - 场景: 用户 [{poor_guy}] (余额: 0) 尝试调用 R1 模型")
    
    # 2. 尝试调用 /analyze 接口
    # 注意：这里只发空数据，足以触发权限校验，不需要真实的比赛数据
    payload = {
        "mode": "personal",
        "model_type": "reasoner", # 🔥 关键：请求 R1 模型
        "myHero": "LeeSin",
        "myTeam": [], "enemyTeam": [], "userRole": "JUNGLE", 
        "mapSide": "blue", "rank": "Gold"
    }
    
    try:
        res = requests.post(
            f"{API_URL}/analyze",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=5 # 设置短超时，如果真调用了API会很慢，超时也没事
        )
        
        if res.status_code == 403 or res.status_code == 402:
            print(f"{C.OK}   ✅ 通过: 后端在本地拦截了请求 (余额不足){C.END}")
        elif res.status_code == 200:
            print(f"{C.FAIL}   ❌ 失败: 请求成功了！(您的 DeepSeek API 被消耗了！){C.END}")
        else:
            # 可能是参数错误的 400，也算通过（因为没进到API调用环节）
            # 但最好是明确的 403
            err = res.json().get("detail", "")
            if "次数不足" in err or "升级" in err:
                print(f"{C.OK}   ✅ 通过: 后端拦截提示 '{err}'{C.END}")
            else:
                print(f"{C.WARN}   ⚠️ 警告: 返回了 {res.status_code} ({err})，可能已拦截但状态码不明确{C.END}")
                
    except Exception as e:
        print(f"{C.WARN}   ⚠️ 请求异常: {e} (只要不是200成功，通常就说明没扣费){C.END}")

# ================= 🧪 测试 3: 邀请上限 (Invite Cap) =================
def test_invite_cap():
    print(f"\n{C.CYAN}🧪 [测试 3] 15天邀请上限复测...{C.END}")
    
    # 1. 创建大佬
    boss = f"Boss_{rand_str(3)}"
    inject_user_db(boss)
    
    # 2. 模拟数据库已有 5 个有效邀请 (直接改库，省去调接口的时间)
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    db['users'].update_one(
        {"username": boss}, 
        {"$set": {"invite_count": 5}} # 🔥 直接设为 5
    )
    
    # 3. 第 6 个人尝试邀请
    newbie = f"Last_{rand_str(3)}"
    inject_user_db(newbie)
    token = login_get_token(newbie)
    
    res = requests.post(
        f"{API_URL}/user/redeem_invite",
        json={"invite_code": boss},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if res.status_code == 200:
        msg = res.json().get("msg", "")
        if "上限" in msg:
            print(f"{C.OK}   ✅ 通过: 准确识别已达 5 人上限{C.END}")
        else:
            print(f"{C.FAIL}   ❌ 失败: 没有触发上限提示{C.END}")
    else:
        print(f"{C.FAIL}   ❌ 请求错误{C.END}")

def main():
    print("========================================")
    print("🛡️  海克斯安全系统 · 深度体检")
    print("========================================")
    test_device_fingerprint()
    test_r1_zero_balance()
    test_invite_cap()
    print("\n========================================")

if __name__ == "__main__":
    main()