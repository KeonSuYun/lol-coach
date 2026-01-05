import pytest
import requests
import random
import string
import datetime
from pymongo import MongoClient
from passlib.context import CryptContext

# ================= 配置区域 =================
BASE_URL = "http://127.0.0.1:8000"       # 后端地址
MONGO_URI = "mongodb://localhost:27017/" # 数据库地址
DB_NAME = "lol_community"                # 数据库名

# ================= 初始化工具 =================
try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    mongo_client.server_info() # 检查连接
    db = mongo_client[DB_NAME]
    users_col = db["users"]
except Exception as e:
    print(f"❌ 数据库连接失败: {e}")
    print("请确保 MongoDB 已启动且配置正确。")
    exit(1)

# 密码哈希工具 (用于生成 Mock 用户的密码)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def random_str(length=6):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def create_user_and_login(device_id="unknown", days_ago=0):
    """
    🔥 核心辅助函数：直接写库注册 (Mock)，然后调用接口登录
    :param days_ago: 模拟注册时间在几天前 (用于测试老用户限制)
    """
    username = f"test_{random_str()}"
    password = "password123"
    
    # 模拟注册时间
    created_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days_ago)

    # 1. 直接构造用户数据写入 MongoDB (跳过 /register 接口验证)
    user_doc = {
        "username": username,
        "password": pwd_context.hash(password),
        "email": f"{username}@test.com",
        "role": "user",
        "device_id": device_id,
        "ip": "127.0.0.1",
        "created_at": created_at, # 🔥 使用模拟的时间
        # 预设绑定相关字段，防止 KeyError
        "invite_change_count": 0,
        "invited_by": None,
        "membership_expire": None
    }
    users_col.insert_one(user_doc)

    # 2. 调用登录接口获取 Token
    login_data = {
        "username": username,
        "password": password
    }
    resp = requests.post(f"{BASE_URL}/token", data=login_data)
    
    if resp.status_code != 200:
        raise Exception(f"登录失败: {resp.text} (请检查后端服务是否启动)")
    
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return username, token, headers

def get_user_info(headers):
    """辅助：获取个人信息"""
    resp = requests.get(f"{BASE_URL}/users/me", headers=headers)
    assert resp.status_code == 200
    return resp.json()

# ================= 测试用例集 =================

def test_scenario_1_basic_binding():
    """测试场景1：基础双向绑定 (A <-> B)"""
    print("\n[测试] 场景1：基础双向绑定...")
    
    user_a, _, headers_a = create_user_and_login(device_id="dev_a")
    user_b, _, headers_b = create_user_and_login(device_id="dev_b")

    # A 填写 B 的邀请码
    payload = {"invite_code": user_b}
    resp = requests.post(f"{BASE_URL}/user/redeem_invite", json=payload, headers=headers_a)
    
    assert resp.status_code == 200, f"绑定失败: {resp.text}"
    
    # 验证 A 的状态
    info_a = get_user_info(headers_a)
    assert info_a["invited_by"] == user_b
    assert info_a["role"] == "pro"

    # 验证 B 的状态 (双向绑定)
    info_b = get_user_info(headers_b)
    assert info_b["invited_by"] == user_a
    assert info_b["role"] == "pro"
    
    print("✅ 场景1 通过：双向绑定成功，Pro权限已激活")

def test_scenario_2_self_invite():
    """测试场景2：不能绑定自己"""
    print("\n[测试] 场景2：自我绑定校验...")
    user_a, _, headers_a = create_user_and_login()
    
    resp = requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_a}, headers=headers_a)
    assert resp.status_code == 400
    assert "无法与自己" in resp.text
    print("✅ 场景2 通过：自我绑定被拦截")

def test_scenario_3_target_not_single():
    """测试场景3：目标已有战友 (唯一性校验)"""
    print("\n[测试] 场景3：目标非单身校验...")
    # A 和 B 绑定
    user_a, _, headers_a = create_user_and_login()
    user_b, _, _ = create_user_and_login()
    requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_b}, headers=headers_a)

    # C 试图绑定 B (B 已经有 A 了)
    user_c, _, headers_c = create_user_and_login()
    resp = requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_b}, headers=headers_c)
    
    assert resp.status_code == 400
    assert "已经有战友" in resp.text
    print("✅ 场景3 通过：第三者插足被拦截")

def test_scenario_4_change_partner_penalty():
    """测试场景4：更换战友与连坐扣次 (A 换 C，B 受罚)"""
    print("\n[测试] 场景4：更换战友与连坐机制...")
    
    # 1. 初始：A <-> B
    user_a, _, headers_a = create_user_and_login(device_id="dev_a")
    user_b, _, headers_b = create_user_and_login(device_id="dev_b")
    requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_b}, headers=headers_a)
    
    # 2. 新人 C
    user_c, _, headers_c = create_user_and_login(device_id="dev_c")
    
    # 3. A 移情别恋，绑定 C
    resp = requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_c}, headers=headers_a)
    assert resp.status_code == 200
    
    # 4. 验证 A (发起者)：绑定了 C，次数+1
    info_a = get_user_info(headers_a)
    assert info_a["invited_by"] == user_c
    assert info_a["invite_change_count"] == 1 
    
    # 5. 验证 B (前任)：恢复单身，次数+1 (连坐)
    info_b = get_user_info(headers_b)
    assert info_b["invited_by"] is None
    assert info_b["invite_change_count"] == 1
    
    # 6. 验证 C (现任)：绑定了 A，次数不变
    info_c = get_user_info(headers_c)
    assert info_c["invited_by"] == user_a
    assert info_c["invite_change_count"] == 0
    
    print("✅ 场景4 通过：关系重组正确，连坐扣次生效")

def test_scenario_5_same_device_check():
    """测试场景5：同设备风控"""
    print("\n[测试] 场景5：同设备互刷拦截...")
    # D 和 E 使用相同的 device_id
    user_d, _, headers_d = create_user_and_login(device_id="same_iphone_uuid")
    user_e, _, _ = create_user_and_login(device_id="same_iphone_uuid")
    
    resp = requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_e}, headers=headers_d)
    
    assert resp.status_code == 400
    assert "同设备" in resp.text
    print("✅ 场景5 通过：同设备请求被拦截")

def test_scenario_6_max_limit():
    """测试场景6：次数耗尽锁定"""
    print("\n[测试] 场景6：最大更换次数限制...")
    
    # A <-> B (首次不扣次)
    user_a, _, headers_a = create_user_and_login(device_id="dev_a")
    user_b, _, _ = create_user_and_login(device_id="dev_b")
    requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_b}, headers=headers_a)
    
    # 模拟更换 4 次 (达到上限)
    for i in range(4):
        u, _, _ = create_user_and_login(device_id=f"dev_{random_str()}")
        resp = requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": u}, headers=headers_a)
        assert resp.status_code == 200, f"第{i+1}次更换失败"
        
    info_a = get_user_info(headers_a)
    print(f"   当前更换次数: {info_a['invite_change_count']}/4")
    
    # 尝试第 5 次更换 (应该失败)
    user_final, _, _ = create_user_and_login(device_id="dev_final")
    resp = requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_final}, headers=headers_a)
    
    assert resp.status_code == 400
    assert "次数已耗尽" in resp.text
    print("✅ 场景6 通过：达到上限后锁定成功")

def test_scenario_7_old_user_no_limit():
    """🔥 新增测试场景7：老用户 (注册超过3天) 无限制绑定"""
    print("\n[测试] 场景7：去门槛验证 (老用户)...")
    
    # 1. 创建一个 30 天前注册的老用户 (Old User)
    user_old, _, headers_old = create_user_and_login(device_id="dev_old", days_ago=30)
    
    # 2. 创建一个新用户作为绑定对象 (Target)
    user_target, _, _ = create_user_and_login(device_id="dev_target")
    
    # 3. 尝试绑定
    # 如果后端还保留着 `if (now - register_time).days > 3` 的逻辑，这里会报错 400
    resp = requests.post(f"{BASE_URL}/user/redeem_invite", json={"invite_code": user_target}, headers=headers_old)
    
    if resp.status_code == 200:
        print(f"   绑定成功！用户 {user_old} (注册于30天前) 成功绑定了 {user_target}")
        print("✅ 场景7 通过：老用户限制已移除")
    else:
        print(f"❌ 场景7 失败：状态码 {resp.status_code}, 响应: {resp.text}")
        raise AssertionError("老用户绑定失败，去门槛逻辑未生效")

if __name__ == "__main__":
    # 检查依赖
    try:
        import passlib
    except ImportError:
        print("❌ 缺少依赖，请运行: pip install passlib bcrypt requests pymongo")
        exit(1)

    print("🚀 开始全量测试...\n")
    try:
        test_scenario_1_basic_binding()
        test_scenario_2_self_invite()
        test_scenario_3_target_not_single()
        test_scenario_4_change_partner_penalty()
        test_scenario_5_same_device_check()
        test_scenario_6_max_limit()
        test_scenario_7_old_user_no_limit()
        print("\n🎉🎉🎉 所有 7 个测试用例全部通过！逻辑验证完成。")
    except AssertionError as e:
        print(f"\n❌ 测试断言失败: {e}")
    except Exception as e:
        print(f"\n❌ 发生运行错误: {e}")