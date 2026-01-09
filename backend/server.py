import datetime
import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

import edge_tts
import requests
import uvicorn
from bson import ObjectId
from core.database import KnowledgeBase
from core.logger import logger
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status, Request, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File, Body
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse, JSONResponse, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from openai import AsyncOpenAI, APIError
from passlib.context import CryptContext
from pydantic import BaseModel
from routers import auth, payment, champions, utils, messages, community, admin, static, websocket, ai

# 引入数据同步脚本 (用于启动时自动更新 Prompt)
try:
    from scripts.seed_data import seed_data
except ImportError:
    seed_data = None

# =================  强制加载根目录 .env =================
RATE_LIMIT_STORE = {}  # 邮件发送频控
LOGIN_LIMIT_STORE = {}  # 登录接口频控
ANALYZE_LIMIT_STORE = {}  # AI分析频控
CHAMPION_CACHE = {}  # 全局英雄缓存
#  全局英雄名称映射表 (用于自动纠错)
CHAMPION_NAME_MAP = {}

current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)

# =================  注册风控配置 (防薅羊毛) =================
# 定义允许注册的邮箱域名白名单
ALLOWED_EMAIL_DOMAINS = [
    "qq.com",
    "163.com",
    "126.com",
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "foxmail.com",
    "sina.com"
]

# =================  生产环境安全配置 =================

# 1. 密钥配置 (生产环境强制检查)
APP_ENV = os.getenv("APP_ENV", "development")  # 获取当前环境
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if APP_ENV == "production":
        #  生产环境强制报错，禁止启动
        raise ValueError(" 严重安全错误：生产环境未配置 SECRET_KEY！服务拒绝启动。")
    else:
        logger.info(" [警告] 开发模式使用默认密钥，请勿用于生产环境")
        SECRET_KEY = "dev_secret_key_please_change_in_production"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token 7天过期
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017/"

# 爱发电配置
AFDIAN_USER_ID = os.getenv("AFDIAN_USER_ID")
AFDIAN_TOKEN = os.getenv("AFDIAN_TOKEN")

# 2. 邮件配置
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.exmail.qq.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

#  初始化异步 OpenAI 客户端
client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)


#  2. 新增：名称归一化工具函数
def normalize_simple(name):
    """去除所有非字母数字字符并转小写 (Jarvan IV -> jarvaniv)"""
    if not name: return ""
    return re.sub(r'[^a-zA-Z0-9]+', '', name).lower()


#  3. 新增：预加载名称映射
def preload_champion_map():
    global CHAMPION_NAME_MAP
    try:
        json_path = current_dir / "secure_data" / "champions.json"
        if not json_path.exists():
            logger.info(" 未找到 champions.json，名称自动纠错功能可能受限")
            return

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        count = 0
        for item in data:
            real_name = item.get("name")
            if not real_name: continue

            # 1. 记录标准名
            CHAMPION_NAME_MAP[real_name] = real_name
            # 2. 记录归一化名 (核心修复逻辑)
            CHAMPION_NAME_MAP[normalize_simple(real_name)] = real_name

            # 3. 记录别名 (如中文名)
            for alias in item.get("alias", []):
                CHAMPION_NAME_MAP[alias] = real_name
                CHAMPION_NAME_MAP[normalize_simple(alias)] = real_name
            count += 1

        # 4. 手动补丁 (处理 Riot API 特殊命名)
        CHAMPION_NAME_MAP["monkeyking"] = "Wukong"
        CHAMPION_NAME_MAP["wukong"] = "Wukong"
        CHAMPION_NAME_MAP["jarvaniv"] = "Jarvan IV"  # 强制补充

        logger.info(f" [Init] 英雄名称自动纠错字典已加载: {len(CHAMPION_NAME_MAP)} 条索引")

    except Exception as e:
        logger.info(f" [Init] 名称映射加载失败: {e}")


# =================  Lifespan (生命周期) 管理 =================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- 启动逻辑 ---
    #  4. 启动时加载映射
    preload_champion_map()

    # 初始化 AI 路由模块的全局变量
    ai.init_ai_router(
        deepseek_api_key=DEEPSEEK_API_KEY,
        champion_name_map=CHAMPION_NAME_MAP,
        champion_cache=CHAMPION_CACHE,
        analyze_limit_store=ANALYZE_LIMIT_STORE,
        client=client
    )

    if seed_data:
        logger.info(" [Startup] 检测到 seed_data 模块，正在尝试同步数据库...")
        try:
            seed_data()
            logger.info(" [Startup] 数据库同步完成！")
        except Exception as e:
            logger.info(f" [Startup] 数据库同步失败 (非致命): {e}")

    yield  # 服务运行中...

    # --- 关闭逻辑 (如果有) ---
    pass


#  生产环境关闭 Swagger UI，并注册 lifespan
app = FastAPI(docs_url=None, redoc_url=None, lifespan=lifespan)
db = KnowledgeBase()
assets_path = current_dir / "assets"
# 确保文件夹存在，防止报错
if not assets_path.exists():
    os.makedirs(assets_path, exist_ok=True)
app.mount("/champion-icons", StaticFiles(directory=assets_path), name="champion-icons")
# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# OAuth2 方案
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 挂载静态资源
if os.path.exists("frontend/dist/assets"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

#  3. 严格 CORS 配置 (强制包含本地开发地址)
ORIGINS = [
    "https://www.haxcoach.com",
    "https://haxcoach.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://www.hexcoach.gg",
    "https://hexcoach.gg",
]

# 允许通过环境变量扩展 CORS 域名
env_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
if env_origins:
    ORIGINS.extend([o.strip() for o in env_origins if o.strip()])

#  [安全增强] 生产环境自动移除本地调试地址
if APP_ENV == "production":
    logger.info(" [Security] 生产模式：移除 Localhost 跨域支持")
    ORIGINS = [origin for origin in ORIGINS if "localhost" not in origin and "127.0.0.1" not in origin]

logger.info(f" [CORS] 当前允许的跨域来源: {ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ================= 注册路由模块 =================
app.include_router(auth.router)
app.include_router(payment.router)
app.include_router(champions.router)
app.include_router(utils.router)
app.include_router(messages.router)
app.include_router(community.router)
app.include_router(admin.router)
app.include_router(ai.router)
app.include_router(websocket.router)
# static router 必须最后 (避免与 API 路由冲突)
app.include_router(static.router)


# ================= 核心权限逻辑 (共享函数，保留供其他模块使用) =================

# 这些函数由路由模块通过 dependencies 引入,此处保留是为了避免依赖问题
# 实际使用时应从 routers.dependencies 导入

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.get_user(username)
    if user is None:
        raise credentials_exception
    return user


def get_author_name(user):
    gn = user.get("game_name")
    # 如果有游戏名且不为 Unknown，优先使用游戏名
    if gn and gn != "Unknown": return gn
    # 否则使用注册时的用户名
    return user["username"]


# ================= 服务启动入口 =================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
