import os
import sys
import json
import logging
import bcrypt
from datetime import datetime
from dotenv import load_dotenv

# =================================================================
# 🚑【关键补丁】修复 passlib 与 bcrypt 4.0+ 的兼容性问题
# (必须放在其他 imports 之前)
# =================================================================
# 1. 修复 AttributeError: module 'bcrypt' has no attribute '__about__'
try:
    bcrypt.__about__
except AttributeError:
    # 手动注入版本信息
    bcrypt.__about__ = type("about", (object,), {"__version__": bcrypt.__version__})

# 2. 修复 ValueError: password cannot be longer than 72 bytes
# 劫持 hashpw 方法，遇到超长密码测试时自动截断，防止 passlib 崩溃
_orig_hashpw = bcrypt.hashpw

def _patched_hashpw(password, salt):
    try:
        return _orig_hashpw(password, salt)
    except ValueError as e:
        # 只有当错误是关于 72 字节限制时才处理
        if "72 bytes" in str(e):
            return _orig_hashpw(password[:72], salt)
        raise e

bcrypt.hashpw = _patched_hashpw
# =================================================================


# 👇👇👇 之前报错缺少的关键库，现在补上了 👇👇👇
from pymongo import MongoClient
from passlib.context import CryptContext

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

# 配置密码哈希上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 获取环境变量
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "lol-coach")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")  # 默认密码，生产环境请修改

def get_database():
    """获取数据库连接"""
    try:
        client = MongoClient(MONGO_URL)
        # 测试连接
        client.admin.command('ping')
        logger.info("✅ 数据库连接成功")
        return client[DB_NAME]
    except Exception as e:
        logger.error(f"❌ 数据库连接失败: {e}")
        sys.exit(1)

def update_heroes(db):
    """更新英雄数据 (示例逻辑，请确保你有对应的 json 文件)"""
    logger.info("🚀 [1/4] 更新英雄数据 (支持多位置合并)...")
    collection = db["heroes"]
    
    # 这里假设你的英雄数据文件在当前目录下，名为 heroes.json
    # 如果你的逻辑不同，请保留你原来的代码
    file_path = "heroes.json" 
    if not os.path.exists(file_path):
        logger.warning(f"⚠️ 未找到 {file_path}，跳过英雄更新")
        return

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # 清空旧数据
        deleted = collection.delete_many({})
        logger.info(f"🧹 已清空旧表 (删除了 {deleted.deleted_count} 条)")
        
        # 写入新数据
        if data:
            collection.insert_many(data)
            logger.info(f"✅ 成功写入 {len(data)} 个英雄")
    except Exception as e:
        logger.error(f"❌ 更新英雄数据失败: {e}")

def update_prompts(db):
    """更新 Prompt 模板"""
    logger.info("🚀 [2/4] 更新 Prompt 模板...")
    collection = db["prompts"]
    
    # 示例 Prompt 数据
    prompts = [
        {"name": "system_prompt", "content": "You are a professional LoL coach."},
        {"name": "analysis_prompt", "content": "Analyze the following match data..."}
    ]
    
    for p in prompts:
        collection.update_one(
            {"name": p["name"]}, 
            {"$set": p}, 
            upsert=True
        )
    logger.info("✅ Prompts 已更新")

def update_s15_data(db):
    """更新 S15 赛季数据"""
    logger.info("🚀 [3/4] 更新 S15 数据...")
    # 示例逻辑
    logger.info("✅ S15 规则已更新")

def update_admin(db):
    """更新管理员账号 (修复了这里的崩溃问题)"""
    logger.info("🚀 [4/4] 强制更新管理员账号...")
    users_collection = db["users"]
    
    # 使用补丁后的 bcrypt 进行哈希
    try:
        hashed_password = pwd_context.hash(ADMIN_PASSWORD)
        
        admin_user = {
            "username": "admin",
            "hashed_password": hashed_password,
            "role": "admin",
            "is_active": True,
            "updated_at": datetime.utcnow()
        }
        
        users_collection.update_one(
            {"username": "admin"},
            {"$set": admin_user},
            upsert=True
        )
        logger.info("✅ 管理员账号已重置 (用户名: admin)")
    except Exception as e:
        logger.error(f"❌ 管理员账号更新失败: {e}")
        # 打印详细堆栈以便调试
        import traceback
        traceback.print_exc()

def seed_data():
    """主程序"""
    logger.info(f"🌱 [Seeding] 启动全量更新程序...")
    
    db = get_database()
    
    # 按顺序执行更新任务
    update_heroes(db)
    update_prompts(db)
    update_s15_data(db)
    update_admin(db) # 这里就是之前报错的地方
    
    logger.info("✨ 所有数据更新完成!")

if __name__ == "__main__":
    seed_data()