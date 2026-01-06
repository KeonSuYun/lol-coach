import requests
import pymongo
import datetime
import sys
import json

# ================= 配置区域 =================
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "lol_community"
API_URL = "http://127.0.0.1:8000"

TEST_USERNAME = "sync_tester"
TEST_PASSWORD = "password123"

# 颜色代码
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"

def print_step(msg):
    print(f"\n{CYAN}>>> {msg}{RESET}")

def print_success(msg):
    print(f"{GREEN}✅ {msg}{RESET}")

def print_fail(msg):
    print(f"{RED}❌ {msg}{RESET}")

# ================= 辅助函数 =================

def get_db():
    try:
        client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        client.admin.command('ping')
        return client[DB_NAME]
    except Exception as e:
        print_fail(f"无法连接到数据库: {e}")
        sys.exit(1)

def setup_test_user(db):
    """初始化测试用户，插入旧战绩"""
    users_col = db['users']
    
    # 清理旧数据
    users_col.delete_one({"username": TEST_USERNAME})
    
    # 构造 20 场旧战绩 (ID: 100 -> 119)
    # 假设每场间隔 1 小时
    base_time = datetime.datetime.now() - datetime.timedelta(days=10)
    old_matches = []
    for i in range(20):
        game_id = 100 + i
        match = {
            "gameId": game_id,
            "championId": 1,
            "gameCreation": int((base_time + datetime.timedelta(hours=i)).timestamp() * 1000),
            "meta": "Old Match"
        }
        old_matches.append(match)
    
    # 插入用户（模拟已注册用户）
    # 注意：实际场景中通常通过 API 注册，这里为了方便直接写库，
    # 但为了能登录，我们需要一个合法的 hash 密码。
    # 这里我们简化流程：先调 API 注册，再改库写入旧战绩。
    
    # 1. 调用 API 注册
    reg_payload = {
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "email": "sync_test@hex.gg",
        "verify_code": "000000", # 假设你关掉了验证码校验或使用万能码，如果没有，请先确保 register 接口能跑通
        "device_id": "test_device"
    }
    
    # 为了测试方便，我们直接在数据库伪造一个用户，避免处理哈希密码和验证码的麻烦
    # 使用 bcrypt 随便生成一个 hash (这里是 'password123')
    # 如果你不想依懒 passlib，我们直接调用 API 注册是最稳的，
    # 但为了脚本独立性，我建议你先确保后端允许注册或我们手动插入。
    
    # 💡 策略：直接使用 pymongo 插入用户，跳过密码验证（我们在登录时会用到，所以还是得通过 API 注册比较好）
    # 但为了不卡在验证码，我们假设你已经把验证码逻辑通过了，或者我们在库里直接插一条带 OTP 的记录。
    
    # 简便起见：我们假设 'register' 接口在开发环境有后门，或者我们直接在库里创建。
    # 下面这段 Hash 是 "password123"
    password_hash = "$2b$12$UnK.HjW.T/eph0Lh.w1.Q.qXm/0.1.1.1.1.1.1.1.1.1.1.1" 
    
    user_doc = {
        "username": TEST_USERNAME,
        "password": password_hash, # 这里其实是个假的 hash，如果 login 校验不过，脚本会失败
        "role": "user",
        "matches": old_matches, # 🔥 注入旧战绩
        "created_at": datetime.datetime.now()
    }
    
    # 实际上，为了能通过 API 登录，最简单的方法是：
    # 1. 注册 (如果是新号)
    try:
        # 先尝试删除
        requests.post(f"{API_URL}/admin/user/update", json={"username": TEST_USERNAME, "action": "delete", "value": "confirm"})
    except: pass

    # 这里我们采用“先注册”的方式（需要后端放行验证码，或者我们在库里塞一个OTP）
    db['otps'].update_one(
        {"contact": "sync_test@hex.gg"}, 
        {"$set": {"code": "888888", "expire_at": datetime.datetime.now() + datetime.timedelta(minutes=10)}},
        upsert=True
    )
    
    reg_res = requests.post(f"{API_URL}/register", json={
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD,
        "email": "sync_test@hex.gg",
        "verify_code": "888888"
    })
    
    if reg_res.status_code != 200 and "已注册" not in reg_res.text:
        print_fail(f"注册失败: {reg_res.text}")
        sys.exit(1)
        
    # 注册成功后，强制把旧战绩塞进去
    users_col.update_one({"username": TEST_USERNAME}, {"$set": {"matches": old_matches}})
    print_success(f"测试用户已重置，预置旧战绩 {len(old_matches)} 场 (ID: 100-119)")

def login():
    """登录获取 Token"""
    res = requests.post(f"{API_URL}/token", data={
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if res.status_code != 200:
        print_fail(f"登录失败: {res.text}")
        sys.exit(1)
    return res.json()["access_token"]

def main():
    print_step("正在连接数据库...")
    db = get_db()
    
    print_step("初始化测试环境...")
    setup_test_user(db)
    
    print_step("登录获取权限...")
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    
    # ================= 核心测试逻辑 =================
    print_step("执行同步测试：上传新战绩...")
    
    # 构造新战绩：20 场 (ID: 115 -> 134)
    # 注意：115-119 是与旧战绩重叠的，120-134 是全新的
    new_matches = []
    base_time = datetime.datetime.now()
    for i in range(20):
        game_id = 115 + i
        match = {
            "gameId": game_id,
            "championId": 2, # 假装用了另一个英雄
            "gameCreation": int((base_time + datetime.timedelta(hours=i)).timestamp() * 1000),
            "meta": "New Match"
        }
        new_matches.append(match)
        
    payload = {
        "gameName": "SyncTester",
        "tagLine": "HEX",
        "matches": new_matches
    }
    
    # 调用同步接口
    res = requests.post(f"{API_URL}/users/sync_profile", json=payload, headers=headers)
    
    if res.status_code == 200:
        print_success("API 调用成功")
        print(f"   响应: {res.json().get('msg')}")
    else:
        print_fail(f"API 调用失败: {res.status_code} - {res.text}")
        return

    # ================= 验证结果 =================
    print_step("验证数据库最终状态...")
    
    user = db['users'].find_one({"username": TEST_USERNAME})
    final_matches = user.get("matches", [])
    count = len(final_matches)
    
    # 1. 验证数量
    # 旧数据: 100-119 (20个)
    # 新数据: 115-134 (20个)
    # 重叠: 115,116,117,118,119 (5个)
    # 理论结果: 100-134 (共 35 个)
    expected_count = 35
    
    if count == expected_count:
        print_success(f"数量验证通过: 现有 {count} 场 (预期 {expected_count} 场)")
    else:
        print_fail(f"数量验证失败! 现有 {count} 场 (预期 {expected_count} 场)")
        if count == 20:
            print(f"{YELLOW}   -> 警告：数量仍为 20，说明覆盖逻辑未修复！{RESET}")
    
    # 2. 验证去重 (ID 是否唯一)
    ids = [m.get("gameId") for m in final_matches]
    if len(ids) == len(set(ids)):
        print_success("去重验证通过: 所有 GameID 唯一")
    else:
        print_fail("去重验证失败: 存在重复 ID")
        
    # 3. 验证是否包含最早的数据 (ID 100)
    if 100 in ids:
        print_success("保留验证通过: 最早的战绩 (ID:100) 依然存在")
    else:
        print_fail("保留验证失败: 最早的战绩丢失了")
        
    # 4. 验证最新数据是否在最前面
    if final_matches[0]["gameId"] == 134:
        print_success("排序验证通过: 最新战绩 (ID:134) 排在首位")
    else:
        print_fail(f"排序验证失败: 首位 ID 是 {final_matches[0].get('gameId')}")

if __name__ == "__main__":
    main()