import requests
from core.logger import logger
import sys
import datetime
from pymongo import MongoClient
from passlib.context import CryptContext # 用于生成密码哈希

# =================  配置区域 =================
# 数据库地址 (通常是这个，如果您的不一样请修改)
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "lol_community" # 如果您没改过，默认是这个

API_URL = "http://localhost:8000"

#  管理员账号 (用于执行封号操作)
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Su123123"

#  测试账号 (脚本会自动创建这个账号)
TEST_USERNAME = "hex_tester"
TEST_PASSWORD = "TestPassword123!"
# ===============================================

def ensure_test_user_in_db():
    """直接操作数据库，创建或重置测试账号"""
    logger.info(f" [DB] 正在连接数据库，准备注入测试账号 [{TEST_USERNAME}]...")
    
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        client.admin.command('ping') # 测试连接
        
        # 尝试获取数据库
        try:
            db = client.get_default_database()
        except:
            db = client[DB_NAME]
            
        users_col = db['users']
        
        # 生成密码哈希
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed_pw = pwd_context.hash(TEST_PASSWORD)
        
        # 构造用户数据
        user_doc = {
            "username": TEST_USERNAME,
            "password": hashed_pw,
            "role": "user",
            "email": "simulated@hex.test", # 虚拟邮箱
            "device_id": "test_script_bot",
            "created_at": datetime.datetime.now(),
            "sales_ref": None,
            "blocked_users": []
        }
        
        # 执行 Upsert (存在则更新，不存在则插入)
        users_col.update_one(
            {"username": TEST_USERNAME},
            {"$set": user_doc},
            upsert=True
        )
        logger.info(f" [DB] 注入成功！账号: {TEST_USERNAME} / 密码: {TEST_PASSWORD}")
        return True
        
    except Exception as e:
        logger.info(f" [DB] 数据库操作失败: {e}")
        logger.info(" 请确保您已安装 pymongo 和 passlib 库，且 MongoDB 正在运行。")
        return False

def login(username, password):
    """尝试登录并返回 Token"""
    try:
        response = requests.post(
            f"{API_URL}/token",
            data={"username": username, "password": password}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    except Exception as e:
        logger.info(f" 连接 API 失败: {e}")
        return None

def set_user_role(admin_token, target_user, role):
    """管理员修改用户角色"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "username": target_user,
        "action": "set_role",
        "value": role
    }
    response = requests.post(f"{API_URL}/admin/user/update", json=payload, headers=headers)
    return response.status_code == 200

def check_sales_access(user_token):
    """尝试访问销售数据接口"""
    headers = {"Authorization": f"Bearer {user_token}"}
    response = requests.get(f"{API_URL}/sales/dashboard", headers=headers)
    return response.status_code

# ================= 主程序 =================
def run():
    logger.info(f" HexCoach 数据库直连测试脚本 V3.0\n")

    # 1. 数据库注入账号
    if not ensure_test_user_in_db():
        return

    # 2. 验证管理员
    logger.info(f"\n🔹 [Step 1] 验证管理员账号 ({ADMIN_USERNAME})...")
    admin_token = login(ADMIN_USERNAME, ADMIN_PASSWORD)
    if not admin_token:
        logger.info(f" 管理员登录失败！请检查 admin 账号密码是否正确。")
        return
    logger.info(" 管理员认证成功。")

    # 3. 验证测试账号登录
    logger.info(f"\n🔹 [Step 2] 验证测试账号登录 ({TEST_USERNAME})...")
    test_token = login(TEST_USERNAME, TEST_PASSWORD)
    if not test_token:
        logger.info(" 测试账号登录失败，API 可能未同步数据库更改？")
        return
    logger.info(" 测试账号登录成功。")

    # =================  测试 A：销售合伙人权限 =================
    logger.info(f"\n [测试 A] 销售合伙人权限隔离测试")
    
    # A1. 重置为普通用户
    logger.info(f"   1. 将测试账号设为普通用户 'user'...")
    set_user_role(admin_token, TEST_USERNAME, "user")
    
    # A2. 尝试访问
    logger.info(f"   2. 普通用户尝试访问销售面板...")
    if check_sales_access(test_token) == 403:
        logger.info("       成功拦截 (403 Forbidden) - 普通用户无法查看。")
    else:
        logger.info("       测试失败：普通用户竟然能看到数据！")

    # A3. 提权为销售
    logger.info(f"   3. 管理员将账号设为 'sales'...")
    set_user_role(admin_token, TEST_USERNAME, "sales")
    
    # A4. 再次访问
    logger.info(f"   4. 销售用户尝试访问销售面板...")
    if check_sales_access(test_token) == 200:
        logger.info("       访问成功 (200 OK) - 销售用户权限正常。")
    else:
        logger.info("       测试失败：销售用户无法访问。")

    # =================  测试 B：账号封禁功能 =================
    logger.info(f"\n [测试 B] 账号封禁 (Ban) 测试")

    # B1. 封号
    logger.info(f"   1. 管理员将账号设为 'banned'...")
    set_user_role(admin_token, TEST_USERNAME, "banned")

    # B2. 尝试登录
    logger.info(f"   2. 尝试使用被封禁账号登录...")
    try:
        resp = requests.post(f"{API_URL}/token", data={"username": TEST_USERNAME, "password": TEST_PASSWORD})
        if resp.status_code == 400 and "banned" in resp.text.lower():
            logger.info(f"       登录被拦截! 系统返回: {resp.json().get('detail')}")
        else:
            logger.info(f"       测试失败：状态码 {resp.status_code}，未按预期拦截。")
    except Exception as e:
        logger.info(f"       请求异常: {e}")

    # =================  清理工作 =================
    logger.info(f"\n [Cleanup] 正在恢复测试账号状态...")
    set_user_role(admin_token, TEST_USERNAME, "user")
    logger.info(" 已恢复为普通用户状态。")
    
    logger.info("\n 所有功能验证通过！无需邮箱注册即可测试。")

if __name__ == "__main__":
    run()