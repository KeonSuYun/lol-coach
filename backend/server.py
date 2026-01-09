import os
import json
import uvicorn
import datetime
import traceback
import time
import random
import re
import smtplib
import requests
import hashlib
import sys
import asyncio
import edge_tts
import ssl

from pathlib import Path
from email.mime.text import MIMEText
from email.utils import formataddr
from dotenv import load_dotenv
from typing import List, Optional, Dict, Any
from fastapi.staticfiles import StaticFiles
# 🟢 [修改] 引入 RedirectResponse 用于重定向下载
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse, JSONResponse, Response
from fastapi import FastAPI, HTTPException, Depends, status, Request, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.concurrency import run_in_threadpool
from contextlib import asynccontextmanager
import shutil
app = FastAPI()
# ✨ 关键修改：引入异步客户端，解决排队问题
from bson import ObjectId
from openai import AsyncOpenAI, APIError

# 🔐 安全库
from passlib.context import CryptContext
from jose import JWTError, jwt

# 引入数据库逻辑
from core.database import KnowledgeBase

# 引入数据同步脚本 (用于启动时自动更新 Prompt)
try:
    from seed_data import seed_data
except ImportError:
    seed_data = None

# ================= 🔧 强制加载根目录 .env =================
RATE_LIMIT_STORE = {}      # 邮件发送频控
LOGIN_LIMIT_STORE = {}     # 登录接口频控
ANALYZE_LIMIT_STORE = {}   # AI分析频控
CHAMPION_CACHE = {}        # 全局英雄缓存
# 🟢 全局英雄名称映射表 (用于自动纠错)
CHAMPION_NAME_MAP = {}

current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)

# ================= 🛡️ 注册风控配置 (防薅羊毛) =================
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

# ================= 🛡️ 生产环境安全配置 =================

# 1. 密钥配置 (生产环境强制检查)
APP_ENV = os.getenv("APP_ENV", "development") # 获取当前环境
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if APP_ENV == "production":
        # 🛑 生产环境强制报错，禁止启动
        raise ValueError("❌ 严重安全错误：生产环境未配置 SECRET_KEY！服务拒绝启动。")
    else:
        print("⚠️ [警告] 开发模式使用默认密钥，请勿用于生产环境")
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

# ✨ 初始化异步 OpenAI 客户端
client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY, 
    base_url="https://api.deepseek.com"
)

# 🟢 2. 新增：名称归一化工具函数
def normalize_simple(name):
    """去除所有非字母数字字符并转小写 (Jarvan IV -> jarvaniv)"""
    if not name: return ""
    return re.sub(r'[^a-zA-Z0-9]+', '', name).lower()

# 🟢 3. 新增：预加载名称映射
def preload_champion_map():
    global CHAMPION_NAME_MAP
    try:
        json_path = current_dir / "secure_data" / "champions.json"
        if not json_path.exists(): 
            print("⚠️ 未找到 champions.json，名称自动纠错功能可能受限")
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
        CHAMPION_NAME_MAP["jarvaniv"] = "Jarvan IV" # 强制补充
        
        print(f"✅ [Init] 英雄名称自动纠错字典已加载: {len(CHAMPION_NAME_MAP)} 条索引")
        
    except Exception as e:
        print(f"❌ [Init] 名称映射加载失败: {e}")

# ================= 🚀 Lifespan (生命周期) 管理 =================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- 启动逻辑 ---
    # 🟢 4. 启动时加载映射
    preload_champion_map()

    if seed_data:
        print("🔄 [Startup] 检测到 seed_data 模块，正在尝试同步数据库...")
        try:
            seed_data()
            print("✅ [Startup] 数据库同步完成！")
        except Exception as e:
            print(f"⚠️ [Startup] 数据库同步失败 (非致命): {e}")
    
    yield  # 服务运行中...
    
    # --- 关闭逻辑 (如果有) ---
    pass

# 🔒 生产环境关闭 Swagger UI，并注册 lifespan
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

@app.get("/download/client")
async def download_client():
    url = os.getenv("CLIENT_DOWNLOAD_URL")
    if not url:
        return {"error": "Download URL not configured"}
    return RedirectResponse(url=url)

# 挂载静态资源
if os.path.exists("frontend/dist/assets"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# 🟢 3. 严格 CORS 配置 (强制包含本地开发地址)
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

# 🛡️ [安全增强] 生产环境自动移除本地调试地址
if APP_ENV == "production":
    print("🔒 [Security] 生产模式：移除 Localhost 跨域支持")
    ORIGINS = [origin for origin in ORIGINS if "localhost" not in origin and "127.0.0.1" not in origin]

print(f"🔓 [CORS] 当前允许的跨域来源: {ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS, 
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"], 
    allow_headers=["*"],
)

# ================= 模型定义 =================

class MessageSend(BaseModel):  # <--- 确保这个类定义存在
    receiver: str
    content: str

class ClientConfigUpdate(BaseModel):
    pan_url: str
    pan_pwd: str

class BroadcastRequest(BaseModel):
    content: str

class WikiPostCreate(BaseModel):
    title: str
    content: str
    category: str
    heroId: str
    opponentId: Optional[str] = None
    tags: List[str] = []

class TavernPostCreate(BaseModel):
    content: str
    topic: str
    heroId: str # 发帖人当前选择的英雄头像
    image: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    email: str
    verify_code: str
    device_id: str = "unknown" 
    sales_ref: Optional[str] = None

class AdminUserUpdate(BaseModel):
    username: str
    action: str  # "add_days", "set_role", "rename", "delete"
    value: str   # 天数/角色/新名字/空字符串

# 🔥 [新增] 头衔管理模型
class AdminTitleUpdate(BaseModel):
    username: str
    titles: List[str]

class UserSetTitle(BaseModel):
    active_title: str

class EmailRequest(BaseModel):
    email: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class InviteRequest(BaseModel):
    invite_code: str

class TipInput(BaseModel):
    hero: str
    enemy: str
    content: str
    is_general: bool

class ResolveFeedbackRequest(BaseModel):
    feedback_id: str
    adopt: bool = False
    reward: int = 1
    reward_type: str = "r1"

class BlockRequest(BaseModel):
    target_username: str

class SettleRequest(BaseModel):
    username: str

class LikeInput(BaseModel):
    tip_id: str

class FeedbackInput(BaseModel):
    match_context: dict
    description: str

class AnalyzeRequest(BaseModel):
    mode: str
    myHero: str = ""
    enemyHero: str = ""
    myTeam: List[str] = []
    enemyTeam: List[str] = []
    userRole: str = "" 
    
    # ✨ 新增段位字段，默认为黄金/白金
    rank: str = "Gold"
    # 🔥🔥🔥 [新增] 接收地图方位参数
    mapSide: str = "unknown" 
    
    myLaneAssignments: Optional[Dict[str, str]] = None 
    enemyLaneAssignments: Optional[Dict[str, str]] = None
    model_type: str = "chat" # 'chat' or 'reasoner'
    
    # 🔥🔥🔥 [关键修复] 添加 extraMechanics 字段
    # 允许接收 HexLite 发送的实时技能包 (Dict: 英雄名 -> 技能描述文本)
    extraMechanics: Optional[Dict[str, str]] = {} 

class UserProfileSync(BaseModel):
    gameName: str = "Unknown"
    tagLine: str = ""
    level: int = 1
    rank: str = "Unranked"
    lp: int = 0
    winRate: int = 0
    kda: str = "0.0"
    profileIconId: int = 29
    mastery: List[int] = []
    matches: List[dict] = []

class CommentCreate(BaseModel):
    postId: str
    content: str

class WikiPostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

class TavernPostUpdate(BaseModel):
    content: Optional[str] = None
    topic: Optional[str] = None
    image: Optional[str] = None

class MessageSend(BaseModel):
    receiver: str
    content: str
# ================= 🔐 核心权限逻辑 =================

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

# ================= 🧠 智能分路与算法 =================

def infer_team_roles(team_list: List[str], fixed_assignments: Optional[Dict[str, str]] = None):
    clean_team = [h.strip() for h in team_list if h] if team_list else []
    standard_roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]
    final_roles = {role: "Unknown" for role in standard_roles}
    assigned_heroes = set()

    if fixed_assignments:
        for role, hero_raw in fixed_assignments.items():
            if not hero_raw: continue
            role_upper = role.upper()
            hero = hero_raw.strip()
            if role_upper in standard_roles:
                final_roles[role_upper] = hero
                assigned_heroes.add(hero)
    
    remaining_heroes = []
    for h in clean_team:
        is_assigned = False
        for assigned in assigned_heroes:
            if h.lower() == assigned.lower():
                is_assigned = True
                break
        if not is_assigned:
            remaining_heroes.append(h)
    
    for hero in remaining_heroes:
        # 安全调用：如果 db 没有 get_champion_info 方法则返回 None
        hero_info = getattr(db, 'get_champion_info', lambda x: None)(hero)
        # 适配新版数据：role 已经是大写 TOP/MID 等
        pref_role = hero_info.get('role', 'MID').upper() if hero_info else "MID"
        
        target = pref_role
        if target not in standard_roles: target = "MID"

        if final_roles[target] == "Unknown":
            final_roles[target] = hero
        else:
            for r in standard_roles:
                if final_roles[r] == "Unknown":
                    final_roles[r] = hero
                    break
    
    return {k: v for k, v in final_roles.items() if v != "Unknown"}

# ==========================================
# 🧠 V6.0 混合驱动核心算法 (Hybrid Engine)
# ==========================================

def analyze_composition_tags(team_list, db_instance):
    """
    [V6.0] 快速扫描阵容成分 (基于数据库 Tags)
    """
    stats = {
        "ap_count": 0,
        "ad_count": 0,
        "tank_count": 0,
        "engagers": 0  # 开团点
    }
    
    for hero_name in team_list:
        if not hero_name or hero_name == "None": continue
        
        # 模糊查找英雄数据
        hero_data = db_instance.champions_col.find_one({"name": hero_name})
        if not hero_data: continue
        
        tags = [t.lower() for t in hero_data.get('tags', [])]
        
        # 1. 伤害类型估算
        if 'mage' in tags or 'support' in tags or 'ap' in tags: 
            stats['ap_count'] += 1
        else:
            stats['ad_count'] += 1
            
        # 2. 前排估算
        if 'tank' in tags or 'fighter' in tags:
            stats['tank_count'] += 1
            
    return stats

def recommend_heroes_hybrid(db_instance, user_role, rank_tier, my_team, enemy_team, enemy_laner):
    """
    [V6.0] 混合推荐逻辑
    Python 负责海选 (WinRate + Basic Synergy) -> Top 10 Candidates
    LLM 负责精选 (Three-Dimensional Logic) -> Final 3
    """
    current_role = user_role.lower() # 数据库通常存小写 role
    
    # 1. 分析局势
    comp_stats = analyze_composition_tags(my_team, db_instance)
    
    # 2. 设定海选池 (从数据库拉取该位置所有英雄)
    # 注意：确保你的数据库 champions_col 里有 role 字段
    cursor = db_instance.champions_col.find({"role": current_role})
    
    candidates = []
    
    for hero in cursor:
        # --- A. 基础分：版本强度 (Win Rate) ---
        try:
            # 处理 "50.52%" -> 50.52
            win_rate_str = hero.get('win_rate', '50%').replace('%', '')
            win_rate = float(win_rate_str)
        except:
            win_rate = 50.0
            
        score = win_rate * 2  # 基础分 (约 100 分)
        tags = [t.lower() for t in hero.get('tags', [])]
        
        # --- B. 阵容修补加分 (诱导 AI 关注) ---
        
        # 1. 菜刀队修正 (全队缺 AP)
        # 如果队友 AD >= 3 且 AP < 1，给法伤英雄加分
        if comp_stats['ad_count'] >= 3 and comp_stats['ap_count'] < 1:
            if 'mage' in tags or 'ap' in tags:
                score += 15 
        
        # 2. 零前排修正
        # 如果全队无前排，给坦克/战士加分
        if comp_stats['tank_count'] == 0:
            if 'tank' in tags or 'fighter' in tags:
                score += 10
        
        # 3. Tier 加分 (T1 > T2 > T3)
        tier = hero.get('tier', 'T3')
        if tier == 'T1': score += 12
        elif tier == 'T2': score += 6
        
        # --- C. 封装数据 ---
        # 必须把 tags 传给 LLM，让它判断 "是否有位移"、"是否能清线"
        candidates.append({
            "name": hero['name'],
            "alias": hero.get('alias', [hero['name']])[0], # 中文名
            "win_rate": hero.get('win_rate', '50%'),
            "tags": tags,
            "tier": tier,
            "score": score
        })
    
    # 3. 按分数排序，取 Top 12 个 "入围者"
    candidates.sort(key=lambda x: x['score'], reverse=True)
    top_candidates = candidates[:12] 
    
    return top_candidates, comp_stats

# 🟢 FastAPI 版本的邀请码接口 (已增加 30 天上限逻辑)
# ================= 辅助函数 (请确保定义在接口上方) =================
def calculate_new_expire(user_obj, days=3):
    """计算会员过期时间：在当前剩余时间基础上增加，或从现在开始计算"""
    now = datetime.datetime.now(datetime.timezone.utc)
    current_expire = user_obj.get('membership_expire')
    
    # 确保数据库取出的时间带时区信息
    if current_expire and current_expire.tzinfo is None:
        current_expire = current_expire.replace(tzinfo=datetime.timezone.utc)
        
    # 如果已过期或没有记录，从现在开始算
    if not current_expire or current_expire < now:
        return now + datetime.timedelta(days=days)
    else:
        # 如果没过期，在原基础上顺延
        return current_expire + datetime.timedelta(days=days)

# ================= 🔥🔥🔥 [重构] 双向绑定 + 连坐扣次接口 =================
@app.post("/user/redeem_invite")
async def redeem_invite(
    payload: InviteRequest, 
    current_user: dict = Depends(get_current_user) 
):
    target_username = payload.invite_code.strip()
    if not target_username:
        raise HTTPException(status_code=400, detail="请输入战友的契约代码")

    if target_username == current_user['username']:
        raise HTTPException(status_code=400, detail="无法与自己缔结契约")

    # 1. 获取当前用户 (操作人 A)
    user_a = db.users_col.find_one({"_id": current_user["_id"]})
    if not user_a: 
        raise HTTPException(status_code=404, detail="用户数据同步错误")

    # 2. 获取目标用户 (战友 B)
    user_b = db.users_col.find_one({"username": target_username})
    if not user_b:
        raise HTTPException(status_code=404, detail="未找到该用户，请检查ID是否正确")

    # 3. 校验：战友 B 必须是“单身” (invited_by 字段必须为空)
    if user_b.get('invited_by'):
        raise HTTPException(status_code=400, detail=f"用户 [{target_username}] 已经有战友了，无法进行绑定。")

    # 4. 防同设备刷号风控 (防止自己建小号互刷)
    user_device = str(user_a.get("device_id", "unknown")).lower()
    target_device = str(user_b.get("device_id", "unknown")).lower()
    invalid_fps = ["unknown", "unknown_client_error", "none", ""]
    
    if (user_device not in invalid_fps) and (user_device == target_device):
        print(f"🚫 [Security] 拦截同设备互刷: {user_a['username']} <-> {user_b['username']}")
        raise HTTPException(status_code=400, detail="系统检测到设备环境异常 (同设备无法建立契约)")

    # === 核心逻辑：更换次数与解绑处理 ===
    
    MAX_CHANGES = 4
    a_change_count = user_a.get('invite_change_count', 0)
    
    # 场景 A: 当前用户已有旧战友 (执行更换逻辑)
    if user_a.get('invited_by'):
        # 检查剩余次数
        if a_change_count >= MAX_CHANGES:
            raise HTTPException(status_code=400, detail=f"您的更换次数已耗尽 (0/{MAX_CHANGES})，契约已锁定。")
        
        old_partner_id = user_a['invited_by']
        
        # --- 对【旧战友 (C)】执行“连坐”处理 ---
        # 1. 解除绑定 (恢复自由身)
        # 2. 强制扣除 1 次更换机会 (因为关系破裂)
        db.users_col.update_one(
            {"_id": old_partner_id},
            {
                "$set": {"invited_by": None},
                "$inc": {"invite_change_count": 1} 
            }
        )
        
        # A 的扣次将在下方 update_one 中统一执行 (原子操作)

    # 场景 B: 当前用户是第一次绑定 -> 不扣次，直接建立关系
    
    # === 执行双向绑定 (A <-> B) ===
    
    # 1. 更新 A (操作人)
    db.users_col.update_one(
        {"_id": user_a['_id']},
        {
            "$set": {
                "invited_by": user_b['_id'],           # 指向 B
                "role": "pro",                         # 激活 Pro 身份
                "membership_expire": calculate_new_expire(user_a, 3), # 加 3 天
                "invite_time": datetime.datetime.now(datetime.timezone.utc)
            },
            # 如果 A 原本有战友，则本次操作算“更换”，次数+1；否则+0
            "$inc": {"invite_change_count": 1 if user_a.get('invited_by') else 0}
        }
    )
    
    # 2. 更新 B (被绑定人)
    # B 是被动绑定的，不扣除更换次数，直接获得奖励
    db.users_col.update_one(
        {"_id": user_b['_id']},
        {
            "$set": {
                "invited_by": user_a['_id'],           # 指向 A (双向)
                "role": "pro",                         # 激活 Pro 身份
                "membership_expire": calculate_new_expire(user_b, 3)  # 加 3 天
            }
        }
    )

    return {"status": "success", "msg": "🎉 契约缔结成功！双方 Pro 权限已激活。"}

# 🔥 [修改 2] 直接读取本地 champions.json，复用主控台的数据源
@app.get("/champions")
def get_local_champions():
    path = current_dir / "secure_data" / "champions.json"
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ================= 🚀 API 接口 =================

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# 🟢 修改：严格基于 champions.json 的分路获取接口
@app.get("/champions/roles")
def get_champion_roles():
    try:
        # 读取数据源
        json_path = current_dir / "secure_data" / "champions.json"
        
        if not json_path.exists():
            print("⚠️ 未找到 champions.json")
            return {}

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        mapping = {}
        
        # 🛡️ 映射表：将您 JSON 里可能的各种写法，强制统一为前端能看懂的 Key
        role_standardization = {
            # 下路 (JSON 可能是 bot, bottom, marksman -> 统一为 ADC)
            "BOT": "ADC", "BOTTOM": "ADC", "ADC": "ADC", "MARKSMAN": "ADC",
            # 辅助 (JSON 可能是 sup, support, utility -> 统一为 SUPPORT)
            "SUP": "SUPPORT", "SUPPORT": "SUPPORT", "UTILITY": "SUPPORT", "AUX": "SUPPORT",
            # 打野
            "JUN": "JUNGLE", "JUG": "JUNGLE", "JUNGLE": "JUNGLE",
            # 中路
            "MID": "MID", "MIDDLE": "MID",
            # 上路
            "TOP": "TOP"
        }

        # 🛡️ 名字清洗：去掉空格、标点，转小写 (Miss Fortune -> missfortune)
        def normalize_key(raw_name):
            if not raw_name: return ""
            return re.sub(r'[\s\.\'\-]+', '', raw_name).lower()

        for item in data:
            # 1. 尝试获取英文名 (优先 id，其次 name)
            raw_name = item.get("id") or item.get("name")
            if not raw_name: continue
            
            clean_key = normalize_key(raw_name)
            
            # 2. 获取分路 (JSON里可能是 "role": "bot" 或 "role": ["bot", "mid"])
            raw_roles = item.get("role")
            if not raw_roles: continue 
            
            if isinstance(raw_roles, str):
                raw_roles = [raw_roles] # 统一转列表处理
            
            # 3. 标准化分路
            final_roles = []
            for r in raw_roles:
                r_upper = str(r).upper().strip()
                # 查表转换
                standard_role = role_standardization.get(r_upper)
                if standard_role and standard_role not in final_roles:
                    final_roles.append(standard_role)
            
            # 4. 存入映射 (如果同一个英雄在JSON里出现多次，合并分路)
            if clean_key:
                if clean_key in mapping:
                    mapping[clean_key] = list(set(mapping[clean_key] + final_roles))
                else:
                    mapping[clean_key] = final_roles
                    
        return mapping

    except Exception as e:
        print(f"❌ Role Load Error: {e}")
        return {}

@app.post("/tips")
def add_tip_endpoint(data: TipInput, current_user: dict = Depends(get_current_user)):
    """
    发布攻略 (纯净版 - 无AI介入)
    """
    # 1. 获取用户当前的头衔
    user_doc = db.users_col.find_one({"username": current_user['username']})
    user_title = user_doc.get("active_title", "社区成员")
    
    # 2. 获取显示名称 (游戏ID)
    display_name = get_author_name(current_user)

    # 3. 存入数据库
    # 注意：这里直接存入，不再需要等待 AI
    res = db.add_tip(data.hero, data.enemy, data.content, current_user['username'], data.is_general)
    
    # 4. 补充用户信息到帖子中
    if hasattr(res, 'inserted_id'):
        db.tips_col.update_one(
            {"_id": res.inserted_id}, 
            {"$set": {
                "author_title": user_title,
                "author_display_name": display_name,
                "is_polished": False # 标记为未装修
            }}
        )
    
    return {"status": "success", "msg": "发布成功！"}

@app.get("/tips")
def get_tips_endpoint(hero: str, enemy: str = "general"):
    """使用混合流查询"""
    return db.get_mixed_tips(hero, enemy)

@app.get("/")
async def serve_spa():
    # 检查前端文件是否存在
    index_path = Path("frontend/dist/index.html")
    if not index_path.exists():
        return {"error": "前端文件未找到，请检查构建流程 (npm run build)"}
    return FileResponse(index_path)

def get_real_ip(request: Request):
    # 尝试从 X-Forwarded-For 获取真实 IP (通常是列表第一个)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host

@app.post("/send-email")
def send_email_code(req: EmailRequest, request: Request): 
    # 1. 获取真实 IP
    client_ip = get_real_ip(request)
    now = time.time()
    
    # 2. IP 频控 (1分钟1次)
    last_time = RATE_LIMIT_STORE.get(client_ip, 0)
    if now - last_time < 60:
        raise HTTPException(status_code=429, detail="请求过于频繁，请1分钟后再试")
    
    RATE_LIMIT_STORE[client_ip] = now # 更新时间

    # 3. 基础格式校验
    if not re.match(r"[^@]+@[^@]+\.[^@]+", req.email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")

    # ================= 🛡️ 新增：防薅羊毛逻辑 =================
    email_lower = req.email.lower().strip()
    try:
        domain = email_lower.split("@")[1]
    except IndexError:
        raise HTTPException(status_code=400, detail="邮箱格式错误")

    # A. 域名白名单检查
    if domain not in ALLOWED_EMAIL_DOMAINS:
        print(f"🚫 [Security] 拦截非白名单域名注册: {req.email} (IP: {client_ip})")
        raise HTTPException(
            status_code=400, 
            detail="不支持该邮箱服务商，请使用 QQ/微信/Gmail/Outlook 等常用邮箱"
        )

    # B. Gmail 别名拦截 (防止 user+123@gmail.com 无限注册)
    if "gmail.com" in domain and "+" in email_lower:
        print(f"🚫 [Security] 拦截 Gmail 别名注册: {req.email} (IP: {client_ip})")
        raise HTTPException(status_code=400, detail="不支持使用别名邮箱，请使用原始邮箱地址")
    # ========================================================

    # 生成验证码
    code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    
    try:
        db.save_otp(req.email, code)
    except Exception as e:
        print(f"❌ DB Error: {e}")
        raise HTTPException(status_code=500, detail="系统繁忙，请稍后重试")

    # 发送邮件
    try:
        msg = MIMEText(f'HexCoach 验证码：{code}，5分钟有效。请勿泄露给他人。', 'plain', 'utf-8')
        msg['From'] = formataddr(["HexCoach", SMTP_USER])
        msg['To'] = formataddr(["User", req.email])
        msg['Subject'] = "HexCoach 注册验证"
        
        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [req.email], msg.as_string())
        server.quit()
    except Exception as e:
        print(f"❌ SMTP Send Error: {e}")
        raise HTTPException(status_code=500, detail="邮件发送失败，请检查邮箱地址是否正确")

    return {"status": "success", "msg": "验证码已发送至您的邮箱"}

# --- 注册与登录 ---

@app.post("/register")
def register(user: UserCreate, request: Request):
    RESERVED = ["admin", "root", "system", "hexcoach", "gm", "master"]
    if user.device_id and user.device_id != "unknown":
        device_count = db.users_col.count_documents({"device_id": user.device_id})
        if device_count >= 3: # 您可以把这个数字调大，比如 5 或 10
            raise HTTPException(
                status_code=400, 
                detail="⛔ 该设备注册账号数量已达上限"
            )
    client_ip = request.client.host
    if any(r in user.username.lower() for r in RESERVED):
        raise HTTPException(status_code=400, detail="用户名包含保留字")

    if not db.validate_otp(user.email, user.verify_code):
        raise HTTPException(status_code=400, detail="验证码错误或已失效")
    if user.sales_ref:
    # 检查推荐人是否存在
        referrer = db.users_col.find_one({"username": user.sales_ref})
        if not referrer:
            # 策略A：报错拒绝注册（严格）
            # raise HTTPException(status_code=400, detail="推荐人不存在")
            # 策略B：静默置空（推荐）
            user.sales_ref = None
    hashed_pw = get_password_hash(user.password)
    
    result = db.create_user(
        user.username, 
        hashed_pw, 
        role="user", 
        email=user.email,
        device_id=user.device_id,
        ip=request.client.host,
        sales_ref=user.sales_ref
    )
    
    if result == True:
        return {"status": "success", "msg": "注册成功，请登录"}
    
    err_map = {
        "USERNAME_TAKEN": "用户名已被占用",
        "EMAIL_TAKEN": "该邮箱已注册，请直接登录",
        "DEVICE_LIMIT": "该设备注册账号已达上限",
        "IP_LIMIT": "当前IP注册过于频繁"
    }
    raise HTTPException(status_code=400, detail=err_map.get(result, "注册失败"))

@app.post("/token", response_model=Token)
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    # ================= 🛡️ 新增：防爆破限流 (1分钟10次) =================
    client_ip = get_real_ip(request)
    now = time.time()
    
    last_attempt = LOGIN_LIMIT_STORE.get(client_ip, {"count": 0, "time": 0})
    
    if now - last_attempt["time"] < 60:
        if last_attempt["count"] >= 10:
             raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="登录尝试次数过多，请1分钟后再试",
             )
    else:
        # 超过1分钟，重置计数
        last_attempt = {"count": 0, "time": now}
    
    LOGIN_LIMIT_STORE[client_ip] = last_attempt
    # =================================================================

    user = db.get_user(form_data.username)
    if not user or not verify_password(form_data.password, user['password']):
        LOGIN_LIMIT_STORE[client_ip]["count"] += 1 # 失败+1
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.get("role") == "banned":
        LOGIN_LIMIT_STORE[client_ip]["count"] += 1 
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该账号已被封禁 (Banned)，无法登录",
        )
    # 登录成功，清除计数
    LOGIN_LIMIT_STORE[client_ip]["count"] = 0
    
    access_token = create_access_token(data={"sub": user['username']})
    return {"access_token": access_token, "token_type": "bearer", "username": user['username']}

# ✨ 增强版用户信息接口 (返回 R1 使用情况)

# 🔥🔥🔥 [修复] 个人档案同步 (使用 db.users_col + 修复时间) 🔥🔥🔥
@app.post("/users/sync_profile")
async def sync_user_profile(data: UserProfileSync, current_user: dict = Depends(get_current_user)):
    # 1. 载入旧战绩
    user_in_db = db.users_col.find_one({"_id": current_user["_id"]})
    existing_matches = user_in_db.get("matches", []) if user_in_db else []
    
    print(f"🔄 [Sync] 用户 {current_user['username']} 请求同步。库内已有: {len(existing_matches)} 场, LCU传来: {len(data.matches)} 场")

    # 2. 合并新旧战绩 (去重)
    # 使用字典去重：key是gameId，value是战绩对象
    matches_map = {}
    
    # A. 先放旧数据
    for m in existing_matches:
        gid = m.get("gameId") or m.get("id") 
        if gid: matches_map[str(gid)] = m
            
    # B. 再放新数据 (新数据会覆盖旧数据)
    for m in data.matches:
        gid = m.get("gameId") or m.get("id")
        if gid: matches_map[str(gid)] = m
            
    # 3. 转回列表并按时间倒序
    merged_matches = list(matches_map.values())
    merged_matches.sort(key=lambda x: x.get("gameCreation", 0), reverse=True)
    
    # [性能保护] 只保留最近 50 场
    merged_matches = merged_matches[:50]
    
    print(f"✅ [Sync] 合并完成。最终保存: {len(merged_matches)} 场")

    # 4. 存入数据库
    update_doc = {
        "game_name": data.gameName,
        "tag_line": data.tagLine,
        "level": data.level,
        "rank": data.rank,
        "lp": data.lp,
        "win_rate": data.winRate,
        "kda": data.kda,
        "profile_icon_id": data.profileIconId,
        "mastery": data.mastery,
        "matches": merged_matches, # 🔥 存入合并后的数据
        "last_synced_at": datetime.datetime.now(datetime.timezone.utc)
    }
    
    try:
        db.users_col.update_one({"_id": current_user['_id']}, {"$set": update_doc})
    except Exception as e:
        print(f"Sync DB Error: {e}")
        raise HTTPException(status_code=500, detail="数据库更新失败")
            
    return {"status": "success", "msg": f"同步成功 (库内 {len(merged_matches)} 场)"}

@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    status_info = db.get_user_usage_status(current_user['username'])
    user_doc = db.users_col.find_one({"_id": current_user["_id"]}) # 重新查库保鲜
    
    my_titles = user_doc.get("available_titles", [])
    if "社区成员" not in my_titles: my_titles.append("社区成员")
    
    unread_count = db.get_unread_count_total(current_user['username'])

    # 获取战友名字
    partner_name = None
    if user_doc.get("invited_by"):
        partner = db.users_col.find_one({"_id": user_doc["invited_by"]})
        if partner: partner_name = partner["username"]

    return {
        "username": user_doc['username'],
        "role": status_info.get("role", "user"),
        "is_pro": status_info.get("is_pro", False),
        "expire_at": user_doc.get("membership_expire"),
        "r1_limit": status_info.get("r1_limit", 10),
        "r1_used": status_info.get("r1_used", 0),
        "r1_remaining": status_info.get("r1_remaining", 0),
        "chat_hourly_limit": status_info.get("chat_hourly_limit", 10),
        "chat_used": status_info.get("chat_used", 0),
        "available_titles": my_titles,
        "active_title": user_doc.get("active_title", "社区成员"),
        "unread_msg_count": unread_count,
        "invited_by": partner_name, 
        "invite_change_count": user_doc.get("invite_change_count", 0),

        # 🔥 关键：构造标准化的 game_profile 对象供前端 Header/Profile 使用
        "game_profile": {
            "gameName": user_doc.get("game_name", "Unknown"),
            "tagLine": user_doc.get("tag_line", ""),
            "level": user_doc.get("level", 1),
            "rank": user_doc.get("rank", "Unranked"),
            "lp": user_doc.get("lp", 0),
            "winRate": user_doc.get("win_rate", 0),
            "kda": user_doc.get("kda", "0.0"),
            "profileIconId": user_doc.get("profile_icon_id", 29),
            "mastery": user_doc.get("mastery", []),
            "matches": user_doc.get("matches", [])
        }
    }
@app.get("/users/profile/{target_input}")
def get_user_public_profile(target_input: str, current_user: dict = Depends(get_current_user)):
    target = target_input.strip()
    if not target: raise HTTPException(status_code=400, detail="请输入用户名")

    # 优先级 1: 登录账号 (Username)
    user = db.users_col.find_one({"username": target})
    
    # 优先级 2: 游戏名#Tag (GameName#TagLine)
    if not user and "#" in target:
        try:
            parts = target.split("#")
            gn = parts[0].strip()
            tl = parts[1].strip()
            user = db.users_col.find_one({
                "game_name": {"$regex": f"^{re.escape(gn)}$", "$options": "i"},
                "tag_line": {"$regex": f"^{re.escape(tl)}$", "$options": "i"}
            })
        except: pass

    # 优先级 3: 仅游戏名 (GameName)
    if not user:
        user = db.users_col.find_one({
            "game_name": {"$regex": f"^{re.escape(target)}$", "$options": "i"}
        })

    # 兜底：管理员虚拟账号
    if not user:
        if target.lower() in ['admin', 'root']:
            return {
                "username": "Admin",
                "game_profile": {
                    "gameName": "管理员", "tagLine": "HEX", "rank": "Challenger", 
                    "level": 999, "profileIconId": 588, "mastery": [], "matches": []
                },
                "avatar_url": "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/588.png",
                "active_title": "官方/传说\u200C", 
                "bio": "系统管理员", "is_pro": True
            }
        raise HTTPException(status_code=404, detail="未找到该用户")
    
    # 构造返回 (与 UserProfile 组件对齐)
    icon_id = user.get("profile_icon_id", 29)
    
    return {
        "username": user['username'],
        "role": user.get("role", "user"),
        "is_pro": user.get("role") in ["pro", "vip", "admin", "root"],
        "active_title": user.get("active_title", "社区成员"),
        "bio": user.get("bio", "这个人很懒，什么都没写。"),
        "avatar_url": f"https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/{icon_id}.png",
        
        # 统一数据结构
        "game_profile": {
            "gameName": user.get("game_name", "Unknown"),
            "tagLine": user.get("tag_line", ""),
            "rank": user.get("rank", "Unranked"),
            "lp": user.get("lp", 0),
            "winRate": user.get("win_rate", 0),
            "kda": user.get("kda", "0.0"),
            "level": user.get("level", 1),
            "mastery": user.get("mastery", []),
            "matches": user.get("matches", [])
        }
    }
# ==========================
# 💬 私信 API 接口
# ==========================
@app.post("/messages")
def send_msg(data: MessageSend, current_user: dict = Depends(get_current_user)):
    """发送私信 (含安全校验)"""
    # 1. 基础校验
    if data.receiver == current_user['username']:
        raise HTTPException(400, "不能给自己发消息")
    
    # 🔥 [新增] 内容风控：禁止空消息和超长消息
    if not data.content.strip():
        raise HTTPException(400, "消息内容不能为空")
    if len(data.content) > 500:
        raise HTTPException(400, "消息过长 (上限500字)")

    # 2. 获取接收者并检查权限
    receiver_user = db.users_col.find_one({"username": data.receiver})
    if not receiver_user:
        raise HTTPException(404, "用户不存在")
        
    # 权限检查：普通用户禁止直接私信管理员 (防止骚扰)
    is_sender_admin = current_user.get("role") in ["admin", "root"]
    is_receiver_admin = receiver_user.get("role") in ["admin", "root"]
    
    if is_receiver_admin and not is_sender_admin:
        raise HTTPException(403, "普通用户无法直接私信管理员，请通过【反馈】功能联系")

    # 3. 发送
    success, msg = db.send_message(current_user['username'], data.receiver, data.content)
    if not success: raise HTTPException(400, msg)
    return {"status": "success"}

@app.post("/users/block")
def block_user_endpoint(data: BlockRequest, current_user: dict = Depends(get_current_user)):
    """拉黑/解除拉黑 用户"""
    if data.target_username == current_user['username']:
        raise HTTPException(400, "不能拉黑自己")
        
    target = db.users_col.find_one({"username": data.target_username})
    if not target:
        raise HTTPException(404, "用户不存在")

    my_username = current_user['username']
    
    # 检查是否已拉黑
    me = db.users_col.find_one({"username": my_username})
    blocked_list = me.get("blocked_users", [])
    
    if data.target_username in blocked_list:
        # 已拉黑 -> 解除
        db.users_col.update_one(
            {"username": my_username},
            {"$pull": {"blocked_users": data.target_username}}
        )
        return {"status": "success", "msg": "已解除拉黑", "is_blocked": False}
    else:
        # 未拉黑 -> 拉黑
        db.users_col.update_one(
            {"username": my_username},
            {"$addToSet": {"blocked_users": data.target_username}}
        )
        return {"status": "success", "msg": "已拉黑该用户，对方将无法给您发送私信", "is_blocked": True}

def parse_user_info(user_doc, default_name):
    """
    解析用户信息，优先读取同步后的游戏数据
    """
    icon_id = 29
    display_name = default_name
    
    # 特殊账号处理
    if default_name in ['admin', 'root']:
        return 588, "管理员" # 588 是提莫队长头像

    if not user_doc:
        return icon_id, display_name

    # 🔥 [核心修复] 优先从根目录读取 (sync_profile 存的位置)
    # 你的数据库里存的是 profile_icon_id (下划线)，不是驼峰
    if user_doc.get("profile_icon_id"):
        icon_id = user_doc.get("profile_icon_id")
    
    # 获取游戏昵称
    if user_doc.get("game_name"):
        gn = user_doc.get("game_name")
        tl = user_doc.get("tag_line") or user_doc.get("tagLine")
        if gn and gn != "Unknown":
            display_name = f"{gn} #{tl}" if tl else gn
    
    # 🍂 [兜底兼容] 如果根目录没有，再尝试从 game_profile 嵌套对象读取 (兼容旧数据)
    elif user_doc.get("game_profile"):
        profile = user_doc.get("game_profile")
        if isinstance(profile, str):
            try: profile = json.loads(profile)
            except: profile = {}
        
        if isinstance(profile, dict):
            # 兼容 camelCase 和 snake_case
            icon_id = profile.get("profileIconId") or profile.get("profile_icon_id") or icon_id
            gn = profile.get("gameName") or profile.get("game_name")
            tl = profile.get("tagLine") or profile.get("tag_line")
            if gn:
                display_name = f"{gn} #{tl}" if tl else gn

    return icon_id, display_name

@app.delete("/messages/{contact}")
def delete_conversation_endpoint(contact: str, current_user: dict = Depends(get_current_user)):
    """删除与某人的会话 (物理删除)"""
    success = db.delete_conversation(current_user['username'], contact)
    if not success:
        raise HTTPException(status_code=500, detail="删除失败")
    return {"status": "success"}

@app.get("/messages/conversations")
def get_conversations(current_user: dict = Depends(get_current_user)):
    """获取会话列表 (🚀 性能优化版：批量查询)"""
    raw = db.get_my_conversations(current_user['username'])
    res = []
    
    # 1. 提取所有联系人的 username
    contact_ids = [item['_id'] for item in raw if item['_id']]
    
    # 2. 🔥 [优化] 批量查询所有相关用户，而不是在循环里一个个查
    users_cursor = db.users_col.find({"username": {"$in": contact_ids}})
    # 将结果转为字典方便查找: { "username": user_doc }
    users_map = {u['username']: u for u in users_cursor}
    
    for item in raw:
        contact_username = item['_id']
        if not contact_username: continue
            
        last_msg = item['last_message']
        
        # 3. 直接从内存字典里取数据，不再查库
        contact_user = users_map.get(contact_username)
        
        icon_id, nickname = parse_user_info(contact_user, contact_username)

        res.append({
            "id": contact_username,
            "nickname": nickname,
            "sender": contact_username,
            "content": last_msg['content'],
            "time": last_msg['created_at'].strftime("%H:%M"),
            "unread": item['unread_count'] > 0,
            "avatar": f"https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/{icon_id}.png"
        })
        
    return res

@app.get("/messages/{contact}")
def get_chat(contact: str, before: str = None, current_user: dict = Depends(get_current_user)):
    """
    获取聊天记录
    :param before: 可选，分页游标 (上一页第一条消息的 iso_time)
    """
    # 传递 before 参数给数据库
    messages = db.get_chat_history(current_user['username'], contact, limit=50, before_time=before)
    
    # 查对方资料 (保持原逻辑)
    contact_user = db.users_col.find_one({"username": contact})
    icon_id, nickname = parse_user_info(contact_user, contact)

    contact_info = {
        "username": contact,
        "nickname": nickname,
        "avatar": f"https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/{icon_id}.png"
    }

    return {
        "messages": messages,
        "contactInfo": contact_info
    }

class TTSRequest(BaseModel):
    text: str
    voice_id: str = "guide"  # 默认为"guide"(领航员)

# 2. 定义音色映射配置 (方便后续调整)
VOICE_CONFIG = {
    "guide": "zh-CN-XiaoxiaoNeural",      # 晓晓 (小美/默认)
    "commander": "zh-CN-YunjianNeural",   # 云健 (大帅/指挥)
    "partner": "zh-CN-YunxiNeural"        # 云希 (小帅/搭档)
}

@app.post("/api/tts")
async def tts_proxy(req: TTSRequest):
    if not req.text:
        raise HTTPException(status_code=400, detail="文本不能为空")

    # 根据前端传来的 voice_id 选择音色，默认用 guide
    target_voice = VOICE_CONFIG.get(req.voice_id, VOICE_CONFIG["guide"])

    # 简单清洗文本
    clean_text = re.sub(r'\([^)]*\)|（[^）]*）|\[[^\]]*\]|【[^】]*】', '', req.text)
    
    # 2. 替换冒号为句号 (增加停顿)
    clean_text = clean_text.replace(':', '。').replace('：', '。')
    
    # 3. 清理剩余的非法字符，保留中英文、数字和基本标点
    #    增加对书名号《》的支持，防止报错
    clean_text = re.sub(r'[^\w\u4e00-\u9fa5,.!?，。：！？“”‘’《》\s-]', '', clean_text)
    # 3. 最后清理非法字符 (Emoji、特殊符号等)，保留中英文、数字和基本标点
    clean_text = re.sub(r'[^\w\u4e00-\u9fa5,.!?，。！？\s-]', '', clean_text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="无可读文本")

    try:
        # 使用 Edge-TTS 生成音频流
        communicate = edge_tts.Communicate(clean_text, target_voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        
        if not audio_data:
             raise HTTPException(status_code=500, detail="语音生成为空")

        # 返回音频流
        return Response(content=audio_data, media_type="audio/mp3")

    except Exception as e:
        print(f"❌ [TTS] Error: {e}")
        raise HTTPException(status_code=500, detail="语音服务生成失败")

# ==========================
# ⚡ 爱发电 Webhook 接口
# ==========================
@app.post("/api/webhook/afdian")
async def afdian_webhook(request: Request):
    """
    接收爱发电的订单回调
    """
    try:
        data = await request.json()
    except:
        return {"ec": 400, "em": "Invalid JSON"}

    if data.get('ec') != 200:
        return {"ec": 200} # 忽略错误回调
    
    order_data = data.get('data', {}).get('order', {})
    out_trade_no = order_data.get('out_trade_no')
    remark = order_data.get('remark', '').strip() # 用户名
    amount = order_data.get('total_amount')
    sku_detail = order_data.get('sku_detail', [])

    if not out_trade_no:
        return {"ec": 200}

    # 🛡️ 安全验证 (防止伪造回调)
    if AFDIAN_USER_ID and AFDIAN_TOKEN:
        verified = verify_afdian_order(out_trade_no, amount)
        if not verified:
            print(f"🚨 [Security] 拦截伪造的爱发电订单: {out_trade_no}")
            return {"ec": 200}
    else:
        print("⚠️ 未配置爱发电 Token，跳过二次验证 (仅开发环境建议)")

    if not remark:
        print(f"⚠️ 订单 {out_trade_no} 未填写用户名，需人工处理")
        return {"ec": 200}

    # 调用数据库处理
    db.process_afdian_order(out_trade_no, remark, amount, sku_detail)

    return {"ec": 200} 

def verify_afdian_order(order_no, amount_str):
    """辅助函数：调用爱发电 API 查单"""
    try:
        ts = int(time.time())
        params = json.dumps({"out_trade_no": order_no})
        sign_str = f"{AFDIAN_TOKEN}params{params}ts{ts}user_id{AFDIAN_USER_ID}"
        sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest()

        url = "https://afdian.com/api/open/query-order"
        payload = {
            "user_id": AFDIAN_USER_ID,
            "params": params,
            "ts": ts,
            "sign": sign
        }
        
        resp = requests.get(url, params=payload, timeout=5)
        res_json = resp.json()
        
        if res_json['ec'] != 200:
            return False
            
        order_list = res_json.get('data', {}).get('list', [])
        for order in order_list:
            if order['out_trade_no'] == order_no:
                if str(order['total_amount']) == str(amount_str):
                    return True
        return False
    except Exception as e:
        print(f"Verification Error: {e}")
        return False

# --- 绝活社区 ---

@app.post("/like")
def like_tip(data: LikeInput, current_user: dict = Depends(get_current_user)):
    if db.toggle_like(data.tip_id, current_user['username']):
        return {"status": "success"}
    raise HTTPException(status_code=400, detail="点赞失败")

@app.delete("/tips/{tip_id}")
def delete_tip_endpoint(tip_id: str, current_user: dict = Depends(get_current_user)):
    tip = db.get_tip_by_id(tip_id)
    if not tip: raise HTTPException(status_code=404)
    # 权限检查：作者本人或管理员
    is_admin = current_user.get('role') in ['admin', 'root']
    if tip['author_id'] != current_user['username'] and not is_admin: 
        raise HTTPException(status_code=403)
    if db.delete_tip(tip_id): 
        return {"status": "success"}
    raise HTTPException(status_code=500)

@app.post("/feedback")
def submit_feedback(data: FeedbackInput, current_user: dict = Depends(get_current_user)):
    db.submit_feedback({"user_id": current_user['username'], "match_context": data.match_context, "description": data.description})
    return {"status": "success"}

@app.get("/admin/feedbacks")
def get_admin_feedbacks(status: str = "pending", current_user: dict = Depends(get_current_user)):
    allowed_roles = ["admin", "root", "vip_admin"] 
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="权限不足")
    return db.get_all_feedbacks(status=status)
@app.post("/admin/feedbacks/resolve")
def resolve_feedback_endpoint(req: ResolveFeedbackRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "root"]:
        raise HTTPException(status_code=403, detail="权限不足")
        
    # 调用数据库新方法
    if db.resolve_feedback(req.feedback_id, adopt=req.adopt, reward=req.reward, reward_type=req.reward_type):
        
        # 构造提示信息
        msg_suffix = ""
        if req.adopt:
            if req.reward_type == "r1":
                msg_suffix = f" (已奖励 {req.reward} 次核心模型)"
            elif req.reward_type == "chat":
                msg_suffix = f" (已奖励 {req.reward} 次快速模型)"
        
        return {"status": "success", "msg": f"反馈已处理{msg_suffix}"}
    
    raise HTTPException(status_code=500, detail="操作失败")
# 🟢 新增：获取用户列表接口
@app.get("/admin/users")
def get_admin_users(
    search: str = "", 
    page: int = 1, 
    limit: int = 10, 
    current_user: dict = Depends(get_current_user)
):
    # --- 1. 权限检查 ---
    allowed_roles = ["admin", "root", "vip_admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="需要管理员权限")

    try:
        def safe_serialize(obj):
            if isinstance(obj, list): return [safe_serialize(item) for item in obj]
            if isinstance(obj, dict): return {k: safe_serialize(v) for k, v in obj.items()}
            if isinstance(obj, ObjectId): return str(obj)
            if isinstance(obj, (datetime.datetime, datetime.date)):
                if obj.tzinfo is None: obj = obj.replace(tzinfo=datetime.timezone.utc)
                return obj.isoformat()
            return obj

        # --- 2. 计算分页 ---
        skip = (page - 1) * limit
        
        # --- 3. 查询数据 (接收元组) ---
        raw_users, total = db.get_all_users(limit=limit, search=search, skip=skip)
        
        # --- 4. 返回标准分页结构 ---
        cleaned_users = safe_serialize(raw_users)
        
        return {
            "items": cleaned_users,
            "total": total,
            "page": page,
            "size": limit
        }

    except Exception as e:
        print(f"❌ [Admin Users Error]: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")

# 🟢 新增：管理员更新用户信息接口
@app.post("/admin/user/update")
def update_user_admin(data: AdminUserUpdate, current_user: dict = Depends(get_current_user)):
    # 严格限制：普通 Admin 是只读的，只有 Root 能改
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足：普通管理员仅拥有查看权限，无法修改用户信息")

    # 🛡️ 安全检查：禁止对自己进行破坏性操作 (删除/封禁)
    if data.username == current_user['username']:
        if data.action == 'delete':
            raise HTTPException(status_code=400, detail="为了安全，您不能删除自己的管理员账号")
        if data.action == 'set_role' and data.value not in ['admin', 'root']:
            raise HTTPException(status_code=400, detail="您不能取消自己的管理员权限")

    # 2. 执行操作
    success, msg = db.admin_update_user(data.username, data.action, data.value)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "msg": msg}

# 🔥🔥🔥 [修复] 管理员给用户分配头衔 (使用 db.users_col) 🔥🔥🔥
@app.post("/admin/user/titles")
def admin_update_titles(data: AdminTitleUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "root"]: 
        raise HTTPException(status_code=403, detail="权限不足")
    
    # ✅ 修复
    db.users_col.update_one(
        {"username": data.username}, 
        {"$set": {"available_titles": data.titles}}
    )
    
    user = db.users_col.find_one({"username": data.username})
    if user.get("active_title") and user.get("active_title") not in data.titles:
        db.users_col.update_one({"username": data.username}, {"$set": {"active_title": "社区成员"}})
        
    return {"status": "success", "msg": "头衔列表已更新"}

# 🔥🔥🔥 [修复] 用户选择佩戴头衔 (使用 db.users_col) 🔥🔥🔥
@app.post("/users/set_active_title")
def set_active_title(data: UserSetTitle, current_user: dict = Depends(get_current_user)):
    # ✅ 修复
    user = db.users_col.find_one({"username": current_user['username']})
    available = user.get("available_titles", [])
    if "社区成员" not in available: available.append("社区成员")

    if data.active_title not in available:
        raise HTTPException(status_code=400, detail="你没有获得该头衔")
    
    db.users_col.update_one(
        {"username": current_user['username']}, 
        {"$set": {"active_title": data.active_title}}
    )
    return {"status": "success", "msg": "佩戴成功"}

# ==========================
# 📘 绝活社区 API
# ==========================

@app.get("/community/posts")
def get_community_posts(heroId: str = None, category: str = None):
    # 转换字段以匹配前端驼峰命名
    raw_posts = db.get_wiki_posts(hero_id=heroId, category=category)
    return [
        {
            "id": p["id"],
            "refId": p.get("ref_id"),
            "title": p.get("title"),
            "author": p.get("author_name", "匿名"),
            "likes": p.get("likes", 0),
            "views": p.get("views", 0),
            "category": p.get("category"),
            "heroId": p.get("hero_id"),
            "opponentId": p.get("opponent_id"),
            "isAiPick": p.get("is_ai_pick", False),
            "date": p.get("created_at").strftime("%Y-%m-%d") if p.get("created_at") else "刚刚",
            "content": p.get("content"),
            "tags": p.get("tags", [])
        }
        for p in raw_posts
    ]

@app.post("/community/posts")
def publish_community_post(data: WikiPostCreate, current_user: dict = Depends(get_current_user)):
    # 🔥 [新增] 获取显示名称
    display_name = get_author_name(current_user)

    post_data = {
        "title": data.title,
        "content": data.content,
        "category": data.category,
        "hero_id": data.heroId,
        "opponent_id": data.opponentId,
        "tags": data.tags,
        "author_id": str(current_user["_id"]),
        "author_name": display_name # 🔥 使用游戏ID
    }
    new_post = db.create_wiki_post(post_data)
    
    # 返回前端需要的格式 (保留您原来的完整格式)
    return {
        "id": new_post["id"],
        "refId": new_post["ref_id"],
        "title": new_post["title"],
        "author": new_post["author_name"],
        "likes": 0,
        "views": 0,
        "date": "刚刚",
        "content": new_post["content"],
        "tags": new_post["tags"],
        "isAiPick": False
    }

@app.get("/community/tavern")
def get_tavern_posts(topic: str = None):
    raw_posts = db.get_tavern_posts(topic=topic)
    return [
        {
            "id": p["id"],
            "author": p.get("author_name", "酒馆路人"),
            "avatar": p.get("avatar_hero", "Teemo"), # 默认提莫头像
            "heroId": p.get("hero_id"),
            "content": p.get("content"),
            "tags": [],
            "likes": p.get("likes", 0),
            "comments": p.get("comments", 0),
            "time": p.get("created_at").strftime("%H:%M") if p.get("created_at") else "刚刚",
            "topic": p.get("topic"),
            "image": p.get("image")
        }
        for p in raw_posts
    ]

@app.post("/community/tavern")
def publish_tavern_post(data: TavernPostCreate, current_user: dict = Depends(get_current_user)):
    # 获取英雄别名作为头像 (保留原逻辑)
    hero_info = db.get_champion_info(data.heroId)
    avatar_alias = hero_info.get("alias", "Teemo") if hero_info else "Teemo"

    # 🔥 [新增] 获取显示名称
    display_name = get_author_name(current_user)

    post_data = {
        "content": data.content,
        "topic": data.topic,
        "hero_id": data.heroId,
        "avatar_hero": avatar_alias,
        "image": data.image,
        "author_id": str(current_user["_id"]),
        "author_name": display_name # 🔥 使用游戏ID
    }
    new_post = db.create_tavern_post(post_data)
    
    # (保留您原来的完整格式)
    return {
        "id": new_post["id"],
        "author": new_post["author_name"],
        "avatar": new_post["avatar_hero"],
        "content": new_post["content"],
        "likes": 0,
        "comments": 0,
        "time": "刚刚",
        "tags": []
    }

@app.get("/community/wiki/{hero_id}")
def get_wiki_summary_endpoint(hero_id: str):
    summary = db.get_wiki_summary(hero_id)
    if not summary:
        # 如果数据库没有，返回一个默认空结构，防止前端报错
        return {
            "overview": "暂无该英雄的详细百科数据，快来贡献第一篇攻略吧！",
            "keyMechanics": [],
            "commonMatchups": [],
            "buildPath": "暂无推荐"
        }
    return {
        "overview": summary.get("overview"),
        "keyMechanics": summary.get("key_mechanics", []),
        "commonMatchups": summary.get("common_matchups", []),
        "buildPath": summary.get("build_path", "")
    }

@app.get("/community/comments/{post_id}")
def get_post_comments(post_id: str):
    return db.get_comments(post_id)

@app.post("/community/comments")
def add_post_comment(data: CommentCreate, current_user: dict = Depends(get_current_user)):
    # 保留您的非空检查
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="内容不能为空")
    
    # 🔥 [新增] 获取显示名称
    display_name = get_author_name(current_user)

    new_comment = db.add_comment(
        data.postId, 
        current_user["_id"], 
        display_name, # 🔥 使用游戏ID
        data.content
    )
    return new_comment
# --- 4. AI 分析 (集成推荐算法) ---

@app.post("/analyze")
async def analyze_match(data: AnalyzeRequest, current_user: dict = Depends(get_current_user)): 
    # 🟢 [防刷] 3秒冷却机制
    username = current_user['username']
    now = time.time()
    last_request_time = ANALYZE_LIMIT_STORE.get(username, 0)
    
    # 如果距离上次请求不足 3 秒，直接拒绝
    if now - last_request_time < 3:
        # 这里用 JSONResponse 返回 429 也行，或者保持原样返回流式错误
        # 为了统一体验，这里也建议改用 JSONResponse
        return JSONResponse(
            status_code=429,
            content={
                "concise": {
                    "title": "操作太快了", 
                    "content": "请等待 AI 思考完毕后再试 (冷却中...)"
                }
            }
        )
    
    # 更新最后请求时间
    ANALYZE_LIMIT_STORE[username] = now

    # 1. API Key 检查
    if not DEEPSEEK_API_KEY:
         async def err(): yield json.dumps({"concise": {"title":"维护中", "content":"服务暂时不可用 (Configuration Error)"}})
         return StreamingResponse(err(), media_type="application/json")
    
    # 模式别名处理
    MODE_ALIASES = {
        "jungle_farming": "role_jungle_farming",
        # 未来你还可以加更多别名
    }

    def normalize_mode(mode: str) -> str:
        return MODE_ALIASES.get(mode, mode)

    # 在 check_and_update_usage 之前
    data.mode = normalize_mode(data.mode)
    
    # 2. 频控检查 (传入 model_type 进行分级计费)
    allowed, msg, remaining = db.check_and_update_usage(current_user['username'], data.mode, data.model_type)
    
    # 🔥🔥🔥 [修复核心] Test 2 零余额保护：明确返回 403 状态码
    if not allowed:
        return JSONResponse(
            status_code=403,
            content={
                "concise": {
                    "title": "请求被拒绝", 
                    "content": msg + ("\n💡 升级 Pro 可解锁无限次使用！" if remaining == -1 else "")
                }
            }
        )

    # 🟢 5. 输入自动纠错 (JarvanIV -> Jarvan IV)
    def fix_name(n):
        if not n: return ""
        # 🔥 关键：放行 None，允许未选英雄
        if n == "None": return "None"
        # 优先查表修正，如果没查到则尝试归一化查，最后保留原值
        return CHAMPION_NAME_MAP.get(n) or CHAMPION_NAME_MAP.get(normalize_simple(n)) or n

    # 对所有可能涉及英雄名的字段进行清洗
    data.myHero = fix_name(data.myHero)
    data.enemyHero = fix_name(data.enemyHero)
    data.myTeam = [fix_name(h) for h in data.myTeam]
    data.enemyTeam = [fix_name(h) for h in data.enemyTeam]
    
    if data.myLaneAssignments:
        data.myLaneAssignments = {k: fix_name(v) for k, v in data.myLaneAssignments.items()}
    if data.enemyLaneAssignments:
        data.enemyLaneAssignments = {k: fix_name(v) for k, v in data.enemyLaneAssignments.items()}

    # 3. Input Sanitization (输入清洗 - 验证清洗后的名称)
    # 🔥 关键修改：如果是 "None"，跳过数据库校验
    if data.myHero and data.myHero != "None":
        hero_info = db.get_champion_info(data.myHero)
        if not hero_info:
            async def attack_err(): yield json.dumps({"concise": {"title": "输入错误", "content": f"系统未识别英雄 '{data.myHero}'。"}})
            return StreamingResponse(attack_err(), media_type="application/json")

    if data.enemyHero and data.enemyHero != "None":
        hero_info = db.get_champion_info(data.enemyHero)
        if not hero_info:
            async def attack_err(): yield json.dumps({"concise": {"title": "输入错误", "content": f"系统未识别英雄 '{data.enemyHero}'。"}})
            return StreamingResponse(attack_err(), media_type="application/json")

    # 4. 数据准备 (修复版：正确读取 JSON 结构)
    game_constants = await run_in_threadpool(db.get_game_constants)
    
    # =========================================================
    # 🛠️ 【关键位置调整】辅助函数定义提前到这里！ (解决 NameError)
    # =========================================================
    def get_hero_cn_name(hero_id):
        """优先提取中文名 (Alias > Name)"""
        if not hero_id or hero_id == "Unknown" or hero_id == "None": return hero_id
        
        info = CHAMPION_CACHE.get(hero_id) or db.get_champion_info(hero_id)
        if not info: return hero_id
        
        # 1. 尝试从 alias 列表取第一个 (通常是中文名，如 "赏金猎人")
        if info.get("alias") and isinstance(info["alias"], list) and len(info["alias"]) > 0:
            return info["alias"][0]
            
        # 2. 尝试 title (如 "赏金猎人")，如果有这个字段的话
        if info.get("title"):
            return info["title"]
            
        # 3. 兜底使用 name (Miss Fortune)
        return info.get("name", hero_id)

    def get_champ_meta(name):
        """获取英雄战术标签 (应用中文名)"""
        info = CHAMPION_CACHE.get(name) or db.get_champion_info(name)
        if info: CHAMPION_CACHE[name] = info
            
        if not info:
            return name, "常规英雄", "全期"
        
        # 🟢 修正点：使用 get_hero_cn_name 翻译名字
        c_name = get_hero_cn_name(name)
        
        # 1. 尝试获取自定义标签 (mechanic_type)
        c_type = info.get('mechanic_type')
        # 2. 如果没有，使用官方 tags 并简单汉化
        if not c_type:
            tags = info.get('tags', [])
            tag_map = {"Fighter":"战士", "Mage":"法师", "Assassin":"刺客", "Tank":"坦克", "Marksman":"射手", "Support":"辅助"}
            c_type = tag_map.get(tags[0], tags[0]) if tags else "常规英雄"
            
        c_power = info.get('power_spike', '全期') 
        return c_name, c_type, c_power

    # 5. 分路计算
    my_roles_map = infer_team_roles(data.myTeam, data.myLaneAssignments)
    enemy_roles_map = infer_team_roles(data.enemyTeam, data.enemyLaneAssignments)

    # ---------------------------------------------------------
    # ⚡ 核心逻辑：智能身份推断 (User Role Logic)
    # ---------------------------------------------------------
    user_role_key = "MID" 
    manual_role_set = False

    # 优先级 1: 用户手动指定 (且有效)
    if data.userRole and data.userRole.upper() in ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]:
        user_role_key = data.userRole.upper()
        manual_role_set = True
    # 优先级 2: 根据选择的英雄在己方阵容中的位置推断 (仅当已选英雄时)
    elif data.myHero and data.myHero != "None":
        for r, h in my_roles_map.items():
            if h == data.myHero: user_role_key = r; break

    # ⚡ 修正：如果用户没手动指定，且推断出的位置很奇怪（比如盲僧上单）
    # 我们查库看看这个英雄的"本命位置"是不是打野
    if not manual_role_set and data.myHero and data.myHero != "None":
        hero_info_doc = db.get_champion_info(data.myHero)
        if hero_info_doc and hero_info_doc.get('role') == 'jungle':
            # 检查队友里有没有更像打野的人
            teammate_roles = [db.get_champion_info(h).get('role') for h in data.myTeam if db.get_champion_info(h)]
            
            # 如果我是单人路，且队友里没人是主玩打野的，那大概率系统判错了，我才是打野
            if user_role_key in ["TOP", "MID"] and 'jungle' not in teammate_roles:
                user_role_key = "JUNGLE"
    # =========================================================
    # 🔥 [新增/搬运] 机制库动态过滤 (必须放在 user_role_key 确定之后)
    # =========================================================
    modules = game_constants.get('data_modules', {})
    mechanics_list = []

    for cat_key, cat_val in modules.items():
        if isinstance(cat_val, dict) and 'items' in cat_val:
            
            # 1. 屏蔽打野专属数据 (如果是线上玩家)
            if cat_key == 'jungle_data' and user_role_key != 'JUNGLE':
                continue
            
            # 2. 屏蔽打野高阶博弈
            if cat_key == 'jungle_pro_logic' and user_role_key != 'JUNGLE':
                continue

            for item in cat_val['items']:
                # 🔥🔥🔥 [新增核心逻辑] 分路任务精确过滤 🔥🔥🔥
                # 如果 item 中定义了 role_key (例如 "TOP"), 且与当前 user_role_key 不一致，则跳过
                target_role = item.get('role_key')
                if target_role and target_role != user_role_key:
                    continue

                mechanics_list.append(f"{item.get('name')}: {item.get('rule')} ({item.get('note')})")

    s16_details = "; ".join(mechanics_list)
    s16_context = f"【S16/分路与机制库】: {s16_details if s16_details else '暂无特殊机制数据'}"
    # ---------------------------------------------------------
    # ⚡ 核心逻辑：智能生态构建 (Smart Context Logic)
    # ---------------------------------------------------------
    primary_enemy = "Unknown"
    
    # 🌟 统一变量：无论哪路，分析结果都存入这里，传给 Prompt 的 {compInfo} 插槽
    lane_matchup_context = "" 

    # === A. 下路 (ADC/SUPPORT) 生态 ===
    if user_role_key in ["ADC", "SUPPORT"]:
        primary_enemy = enemy_roles_map.get(user_role_key, "Unknown")
        
        my_ad = my_roles_map.get("ADC", "Unknown")
        my_sup = my_roles_map.get("SUPPORT", "Unknown")
        en_ad = enemy_roles_map.get("ADC", "Unknown")
        en_sup = enemy_roles_map.get("SUPPORT", "Unknown")

        my_ad_n, my_ad_t, _ = get_champ_meta(my_ad)
        my_sup_n, my_sup_t, _ = get_champ_meta(my_sup)
        en_ad_n, en_ad_t, _ = get_champ_meta(en_ad)
        en_sup_n, en_sup_t, _ = get_champ_meta(en_sup)

        lane_matchup_context = f"""
        \n--------- ⚔️ 下路2v2生态系统 (Bot Lane Ecosystem) ⚔️ ---------
        【我方体系】：{my_ad_n} ({my_ad_t}) + {my_sup_n} ({my_sup_t})
        - 化学反应：这是一组由“{my_ad_t}”配合“{my_sup_t}”构建的防线。
        
        【敌方体系】：{en_ad_n} ({en_ad_t}) + {en_sup_n} ({en_sup_t})
        - 威胁来源：面对“{en_sup_t}”类型的辅助，请重点分析其开团手段或消耗能力。
        
        【博弈定性】：
        这是一场 [{my_ad_t}+{my_sup_t}] 对抗 [{en_ad_t}+{en_sup_t}] 的对局。
        请在【对线期博弈】中直接回答：
        1. 谁拥有线权？
        2. 谁拥有击杀压力？
        3. 2v2 打到底谁赢面大？
        -------------------------------------------------------------
        """

    # === B. 中单 (MID) ===
    # 🟢 修正：只针对中单生成“中野联动”Prompt，不包含打野
    elif user_role_key == "MID":
        primary_enemy = enemy_roles_map.get("MID", "Unknown")

        my_mid = my_roles_map.get("MID", "Unknown")
        my_jg = my_roles_map.get("JUNGLE", "Unknown")
        en_mid = enemy_roles_map.get("MID", "Unknown")
        en_jg = enemy_roles_map.get("JUNGLE", "Unknown")

        my_mid_n, my_mid_t, _ = get_champ_meta(my_mid)
        my_jg_n,  my_jg_t,  my_jg_p  = get_champ_meta(my_jg)
        en_mid_n, en_mid_t, _ = get_champ_meta(en_mid)
        en_jg_n,  en_jg_t,  _  = get_champ_meta(en_jg)

        lane_matchup_context = f"""
        \n--------- 🌪️ 中野2v2节奏引擎 (Mid-Jungle Engine) 🌪️ ---------
        【我方中野】：{my_mid_n} ({my_mid_t}) ➕ {my_jg_n} ({my_jg_t})
        - 联动逻辑：基于我方打野是“{my_jg_t}”，中单应扮演什么角色？
        - 强势期：注意 {my_jg_n} 的强势期在【{my_jg_p}】，请据此规划前15分钟节奏。
        
        【敌方中野】：{en_mid_n} ({en_mid_t}) ➕ {en_jg_n} ({en_jg_t})
        - 警报：敌方是“{en_mid_t}”+“{en_jg_t}”的组合。请计算他们在中路或河道的 2v2 爆发能力。
        
        【博弈定性】：
        这是一场 [{my_mid_t}+{my_jg_t}] VS [{en_mid_t}+{en_jg_t}] 的节奏对抗。
        请在【前期博弈】中明确回答：
        1. 河道主权：3分30秒河蟹刷新时，哪边中野更强？
        2. 先手权：谁拥有推线游走的主动权？
        -------------------------------------------------------------
        """

    # === C. 打野 (JUNGLE) ===
    # 🟢 修正：打野使用专属的 Prompts 模板，不生成额外的 Python Context 指令
    # === C. 打野 (JUNGLE) ===
    # 🟢 修正：为打野注入全图对线生态，防止敌我不分
    elif user_role_key == "JUNGLE":
        primary_enemy = enemy_roles_map.get("JUNGLE", "Unknown")
        if primary_enemy == "Unknown" and data.enemyHero and data.enemyHero != "None":
            primary_enemy = data.enemyHero
            
        # 获取各路英雄名称 (带中文翻译)
        my_top_n, _, _ = get_champ_meta(my_roles_map.get("TOP", "Unknown"))
        en_top_n, _, _ = get_champ_meta(enemy_roles_map.get("TOP", "Unknown"))
        my_mid_n, _, _ = get_champ_meta(my_roles_map.get("MID", "Unknown"))
        en_mid_n, _, _ = get_champ_meta(enemy_roles_map.get("MID", "Unknown"))
        my_ad_n, _, _ = get_champ_meta(my_roles_map.get("ADC", "Unknown"))
        my_sup_n, _, _ = get_champ_meta(my_roles_map.get("SUPPORT", "Unknown"))
        en_ad_n, _, _ = get_champ_meta(enemy_roles_map.get("ADC", "Unknown"))
        en_sup_n, _, _ = get_champ_meta(enemy_roles_map.get("SUPPORT", "Unknown"))

        # 🔥 关键修复：构建清晰的对线列表，强制 AI 理解敌我关系
        lane_matchup_context = f"""
        \n--------- 🌲 全局对线生态 (Jungle Perspective) 🌲 ---------
        【上路对位】：我方 [{my_top_n}] VS 敌方 [{en_top_n}]
        【中路对位】：我方 [{my_mid_n}] VS 敌方 [{en_mid_n}]
        【下路对位】：我方 [{my_ad_n}+{my_sup_n}] VS 敌方 [{en_ad_n}+{en_sup_n}]
        -------------------------------------------------------
        """

    # === D. 上路 (TOP) / 其他 ===
    else:
        primary_enemy = enemy_roles_map.get("TOP", "Unknown")
        # 兜底
        if primary_enemy == "Unknown" and data.enemyHero and data.enemyHero != "None": 
            primary_enemy = data.enemyHero
            
        # 简单的上路 Context
        lane_matchup_context = "(上路是孤岛，请专注于 1v1 兵线与换血细节分析)"

    # 兜底：如果没找到对位，尝试使用前端传来的 enemyHero
    if primary_enemy == "Unknown" and data.enemyHero and data.enemyHero != "None": 
        primary_enemy = data.enemyHero

    # 6. ⚡⚡⚡ 触发推荐算法 (纯净版) ⚡⚡⚡
    rank_type = "Diamond+" if data.rank in ["Diamond", "Master", "Challenger"] else "Platinum-"
    
    # 🔥 [修复] 调用正确的函数名 recommend_heroes_hybrid，并正确传参
    # 注意：该函数返回两个值 (推荐列表, 阵容统计)，需要解包
    try:
        algo_recommendations, comp_stats = recommend_heroes_hybrid(
            db_instance=db, 
            user_role=user_role_key, 
            rank_tier=rank_type, 
            my_team=data.myTeam,       # 对应定义的 my_team
            enemy_team=data.enemyTeam, # 对应定义的 enemy_team
            enemy_laner=primary_enemy  # 对应定义的 enemy_laner
        )
    except Exception as e:
        print(f"❌ 推荐算法错误: {e}")
        algo_recommendations = []
        comp_stats = {}
    
    rec_str = ""
    for idx, rec in enumerate(algo_recommendations):
        # ✅ 使用定义好的 get_hero_cn_name 翻译
        rec_name_cn = get_hero_cn_name(rec['name'])
        # 🔥 [修复] 新算法返回的是 'score' 而不是 'reason'，这里做适配
        score_val = rec.get('score', 0)
        rec_str += f"{idx+1}. {rec_name_cn} ({rec.get('tier', 'T?')}级) - 适配分: {score_val:.1f}\n"
        
    if not rec_str: rec_str = "(暂无数据)"

    # =========================================================================
    # 7. RAG 检索 & 模式修正 (核心修复区)
    # =========================================================================
    top_tips = []
    corrections = []
    
    # 🔥 A. 定义模式 (Template vs Style)
    target_mode = data.mode
    style_mode = "default"

    if data.myHero == "None":
        target_mode = "bp"
        style_mode = "default"

    # 野核：兼容新旧mode写法
    elif data.mode in ("role_jungle_farming", "jungle_farming"):
        target_mode = "role_jungle_farming"
        style_mode = "role_jungle_farming"

    elif data.mode == "personal":
        if user_role_key == "JUNGLE":
            target_mode = "personal_jungle"
            style_mode = "role_jungle_ganking"  # 默认节奏/抓人倾向
        else:
            target_mode = "personal_lane"
            style_mode = "default"


    if data.myHero and data.myHero != "None":
        rag_enemy = primary_enemy
        if user_role_key == "JUNGLE":
            real_enemy_jg = enemy_roles_map.get("JUNGLE", "Unknown")
            if primary_enemy != real_enemy_jg:
                rag_enemy = "general"

        knowledge = await run_in_threadpool(db.get_top_knowledge_for_ai, data.myHero, rag_enemy)
        if rag_enemy == "general":
            top_tips = knowledge.get("general", [])
        else:
            top_tips = knowledge.get("matchup", []) + knowledge.get("general", [])
            
        # 🔥 B. 获取修正数据 (传入 style_mode)
        # 注意：这里不再会被覆盖了！
        corrections = await run_in_threadpool(
            db.get_corrections, 
            data.myHero, 
            rag_enemy, 
            user_role_key,
            style_mode  # <--- 传入流派模式
        )

    # 🔥 C. 处理修正数据格式 (Dict -> String)
    correction_texts = []
    if corrections:
        for c in corrections:
            # 兼容：如果是对象取 content，如果是字符串直接用
            if isinstance(c, dict):
                content = c.get("content")
                if content: correction_texts.append(content)
            elif isinstance(c, str):
                correction_texts.append(c)
                
    correction_prompt = "修正:\n" + "\n".join([f"- {t}" for t in correction_texts]) if correction_texts else ""

    # 🛡️ 安全修改：使用 XML 标签隔离不可信内容
    if top_tips:
        safe_tips = []
        for t in top_tips:
            # 简单过滤：移除可能导致注入的关键词
            clean_t = t.replace("System:", "").replace("User:", "").replace("Instruction:", "")
            safe_tips.append(f"<tip>{clean_t}</tip>")
        tips_text = "<community_knowledge>\n" + "\n".join(safe_tips) + "\n</community_knowledge>"
    else:
        tips_text = "(暂无社区数据)"
   # =================================================
    # 🧠 BP 推荐策略：三层分级 Prompt (High / Mid / Low)
    # =================================================
    rank_str = str(data.rank).lower()

    # 1. 【顶尖分段】大师、宗师、王者 (Master+)
    if any(r in rank_str for r in ["master", "grandmaster", "challenger"]):
        strategy_instruction = (
            f"**当前为高分段 ({data.rank})**：\n"
            "- 你的推荐逻辑必须优先考虑 **全局阵容适配性 (Team Synergy)**。\n"
            "- 如果某个英雄对线微劣但团战能产生巨大化学反应，可以推荐。\n"
            "- 你可以在分析中明确指出这是基于高分段环境的建议。"
        )

    # 2. 【进阶分段】翡翠、钻石 (Emerald & Diamond) —— 承上启下的分水岭
    elif any(r in rank_str for r in ["emerald", "diamond", "翡翠", "钻"]):
        strategy_instruction = (
            f"**当前为进阶分段 ({data.rank})**：\n"
            "- 你的推荐逻辑需要在 **个人强势度** 与 **团队适配性** 之间寻找平衡。\n"
            "- **权重分配**：请保持 **60% 侧重对线克制**（保证自己不崩），**40% 侧重团队互补**（稍微照顾阵容）。\n"
            "- **推荐原则**：\n"
            "  1. 避免推荐纯粹为了凑阵容而导致的“坐牢”对线。\n"
            "  2. 优先推荐那些“线上有声音，打团也能配合”的万金油英雄（如带控C位、重装战士）。\n"
            "- 理由包装：强调“既能保证发育，又能补足团队短板”。"
        )

    # 3. 【普通分段】铂金及以下 (Platinum & Below)
    else:
        # 核心是“对线克制”，但严禁 AI 说用户菜
        strategy_instruction = (
            f"**当前对局环境策略**：\n"
            "- 你的推荐逻辑必须优先保证 **对线克制 (Lane Counter)**。\n"
            "- **严禁**推荐对线会被打爆的英雄，哪怕它跟阵容很搭。\n"
            "- 核心思路是：只有对线活下来，才有资格谈打团。\n"
            "⛔ **输出禁忌（严格执行）**：\n"
            "- **绝对不要**在输出内容中提及“因为是低分段”、“鉴于段位较低”、“新手”等字眼。\n"
            "- 请将推荐理由包装为“为了最大化对线压制力”或“最稳健的克制选择”。"
        )

        # 将此指令追加到 tips_text 中 (System Context 会自动包含它)
        tips_text = f"{tips_text}\n\n=== 👑 决策核心指令 (Strategy Core) ===\n{strategy_instruction}"
    # =========================================================================
    # 8. Prompt 构建 (🔥 终极缓存优化版：Global Prefix + Sandwich Structure)
    # =========================================================================
    
    # 1. 准备基础 Context 变量
    full_s16_context = f"{s16_context}"

    # 🔥 [Global Prefix] 全局元规则 (所有模式共享，确保 100% 缓存命中头部)
    META_SYSTEM_PROMPT = """
【元规则 (系统底层指令)】
1. **身份定义**：你是 HexCoach 战术副官，服务于英雄联盟玩家。
2. **输出协议**：
   - 必须输出纯 JSON 格式，严格遵守 `user_template` 定义的结构。
   - 语言仅限中文。
3. **排版视觉规范 (强制执行)**：
   - **摘要(concise)卡片化**：必须使用 `### 【小标题】` 来分割不同维度的分析（前端依赖此标签生成可视化卡片）。
   - **列表结构**：内容必须按点分行，每一项以 `- ` 开头。
   - **视觉降噪**：严禁使用 `**` 加粗（星号），重点内容仅允许使用【】包裹。
   - **拒绝堆砌**：不要把所有信息塞进一段，必须换行。
"""

    # 🔥 [Mode Specific] 野核专属校验 (仅野核模式追加)
    JUNGLE_FARM_RECAP = """
=== 🛑 最终校验 (FINAL CHECK) ===
1. **逻辑自检**：
   - 0-4分钟：必须包含【黄金路线】(F6-石-红-狼-蛙-蓝)。
   - 5:30节点：必须包含【三狼(2)+蛤蟆(2)】的决策。
2. **巢虫落地**：必须解释【先布阵】的具体操作。
请基于上述规则生成最终 JSON。
"""

    # 2. 确定 Recap 内容 (动态追加在末尾)
    recap_section = ""
    # 兼容 new mode names
    if data.mode in ["role_jungle_farming", "jungle_farming"]:
        recap_section = JUNGLE_FARM_RECAP

    # 3. 获取数据库中的模板 (Body)
    tpl = db.get_prompt_template(target_mode) or db.get_prompt_template("personal_lane")
    sys_tpl_body = tpl['system_template']
    
    # 判断 User 端是否需要填充 Tips (如果 System 里没写 {tips_text}，则传给 User)
    tips_in_system = "{tips_text}" in sys_tpl_body

    # 4. 智能组装 System Content
    # 结构：[Global Meta] + [DB Template (含 S16/Tips/Corrections)] + [Recap]
    try:
        # A. 格式化数据库模板部分
        # 检查模板是否包含占位符，如果有则填充
        if "{s16_context}" in sys_tpl_body:
            formatted_body = sys_tpl_body.format(
                s16_context=full_s16_context, 
                tips_text=tips_text if tips_in_system else "", 
                correction_prompt=correction_prompt
            )
        else:
            # 兜底：如果模板里没写占位符，手动拼接
            formatted_body = (
                f"{sys_tpl_body}\n\n"
                f"=== 🌍 S16 Context ===\n{full_s16_context}\n\n"
                f"=== 📚 Community Tips ===\n{tips_text}\n\n"
                f"{correction_prompt}"
            )
            tips_in_system = True 

        # B. 最终拼接 (三明治结构)
        system_content = f"{META_SYSTEM_PROMPT}\n\n{formatted_body}\n\n{recap_section}"

    except Exception as e:
        print(f"⚠️ Prompt Formatting Warning: {e}")
        # 降级方案
        system_content = f"{META_SYSTEM_PROMPT}\n\n{sys_tpl_body}\n\nContext: {full_s16_context}\n\n{recap_section}"

    # 5. JSON 强制约束兜底
    if "Output JSON only" not in system_content:
        system_content += "\n⚠️ IMPORTANT: You must return PURE JSON only."
    # ---------------------------------------------------------
    # ⚡ 关键步骤：中文翻译 (确保 AI 输出中文)
    # ---------------------------------------------------------
    def translate_roles(role_map):
        translated_map = {}
        for role, hero_id in role_map.items():
            translated_map[role] = get_hero_cn_name(hero_id) or "未知"
        return translated_map

    my_roles_cn = translate_roles(my_roles_map)
    enemy_roles_cn = translate_roles(enemy_roles_map)
    
    # 翻译核心英雄
    my_hero_cn = get_hero_cn_name(data.myHero)
    
    enemy_hero_cn = "未知"
    if primary_enemy != "Unknown" and primary_enemy != "None":
        enemy_hero_cn = get_hero_cn_name(primary_enemy)
        # 如果打野针对非对位，加备注
        real_jg = enemy_roles_map.get("JUNGLE")
        if user_role_key == "JUNGLE" and primary_enemy != real_jg:
            enemy_hero_cn += " (Gank目标)"

    def format_roles_str(role_map):
        return " | ".join([f"{k}: {v}" for k, v in role_map.items()])

    # B. 组装 User Content (动态部分)
    # 🔥🔥🔥 接收并处理 mapSide 参数
    map_side_desc = "未知阵营"
    enemy_side_desc = "未知阵营" 

    if data.mapSide == "blue":
        map_side_desc = "🔵 蓝色方 (基地左下)"
        enemy_side_desc = "🔴 红色方 (基地右上)" 
    elif data.mapSide == "red":
        map_side_desc = "🔴 红色方 (基地右上)"
        enemy_side_desc = "🔵 蓝色方 (基地左下)" 

    # 🔥 决定传给 User 的 Tips 内容
    # 如果 System 已经包含了 Tips，User 端就传个占位符省流量
    # 如果 System 没包含 (例如 personal_jungle 模板)，User 端必须传真实内容
    user_tips_content = "(已加载至 System Context)" if tips_in_system else tips_text

    user_content = tpl['user_template'].format(
        mode=data.mode,
        user_rank=data.rank,        
        db_suggestions=rec_str,     
        myTeam=format_roles_str(my_roles_cn),       # ✅ 中文阵容 (别名)
        enemyTeam=format_roles_str(enemy_roles_cn), # ✅ 中文阵容 (别名)
        myHero=my_hero_cn,          # ✅ 中文名 (别名)
        enemyHero=enemy_hero_cn,    # ✅ 中文名 (别名)
        userRole=user_role_key,    
        
        # 🔥 注入红蓝方信息
        mapSide=map_side_desc,
        enemySide=enemy_side_desc,

        # 👇 关键优化：不再重复传输大段文本
        s16_context="(机制库已加载至 System Context)", 
        
        compInfo=lane_matchup_context,
        tips_text=user_tips_content, # 🔥 智能填充
        correction_prompt=""         # 修正内容通常在 System 中处理
    )

    # 9. AI 调用
    if data.model_type == "reasoner":
        MODEL_NAME = "deepseek-reasoner"
        print(f"🧠 [AI] 核心算力 Request - User: {current_user['username']}")
    else:
        MODEL_NAME = "deepseek-chat"
        print(f"🚀 [AI] 基础算力 Request - User: {current_user['username']}")

    async def event_stream():
        try:
            stream = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "system", "content": system_content}, {"role": "user", "content": user_content}],
                stream=True, temperature=0.6, max_tokens=4000
            )
            
            # 🟢 新增状态标记：是否正在输出思考过程
            is_thinking = False
            
            async for chunk in stream:
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    
                    # 1. 尝试获取思考内容 (DeepSeek R1 特有字段 reasoning_content)
                    reasoning = getattr(delta, 'reasoning_content', None)
                    
                    if reasoning:
                        if not is_thinking:
                            yield "<think>" # 💡 手动加上开始标签，前端才能识别
                            is_thinking = True
                        yield reasoning
                    
                    # 2. 处理正式回复 (content)
                    elif delta.content:
                        if is_thinking:
                            yield "</think>" # 💡 思考结束，闭合标签
                            is_thinking = False
                        yield delta.content
                        
            # 🛡️ 兜底：防止流结束时思考标签没闭合
            if is_thinking:
                yield "</think>"
                
        except Exception as e:
            print(f"❌ AI Error: {e}")
            yield json.dumps({"concise": {"title": "错误", "content": "AI服务繁忙，请稍后重试。"}})

    return StreamingResponse(event_stream(), media_type="text/plain")

@app.websocket("/ws/bridge")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 保持连接，接收心跳或指令 (目前只需保持连接即可)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"❌ WS Error: {e}")
        manager.disconnect(websocket)

@app.get("/admin/stats")
def get_admin_stats_endpoint(current_user: dict = Depends(get_current_user)):
    # 允许 admin 和 root 访问，但返回数据不同
    if current_user.get("role") not in ["admin", "root"]:
        raise HTTPException(status_code=403, detail="权限不足")
    
    # 获取原始数据
    stats = db.get_admin_stats()
    
    # 🔥🔥🔥 核心：如果不是 root，屏蔽敏感财务数据
    if current_user.get("role") != "root":
        stats["total_revenue"] = 0
        stats["total_commissions"] = 0
        stats["total_api_calls"] = 0 # 也可以选择让 Admin 看调用量，如果不涉及金额的话
        # 这里您可以选择是否让 Admin 看 API 调用量，如果觉得这也是成本隐私，就设为 0
    
    return stats

# 2. 🔥 [修改] 销售报表 (仅限 Root)
@app.get("/admin/sales/summary")
def get_admin_sales_summary_endpoint(current_user: dict = Depends(get_current_user)):
    # 严格限制：只有 root 能看钱
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足：仅超级管理员可查看财务数据")
    return db.get_admin_sales_summary()

# 3. 🔥 [修改] 销售结算操作 (仅限 Root)
@app.post("/admin/sales/settle")
def settle_sales_endpoint(req: SettleRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足：仅超级管理员可进行资金结算")
        
    success, msg = db.settle_sales_partner(req.username, current_user['username'])
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"status": "success", "msg": msg}
# ==========================================
# 🌟 静态文件与路由修复 
# ==========================================

# 定义前端构建目录的路径 (根据你的 Dockerfile 结构)
DIST_DIR = Path("frontend/dist") 

# 🟢 [新增] 全员公开下载接口 (无需 Token，支持对象存储重定向)
@app.get("/api/download/client")
async def download_client_public():
    """
    全员开放的直链下载通道
    为了节省 Sealos 服务器流量，这里使用 HTTP 重定向 (307)
    让用户直接从 Sealos 对象存储 (OSS) 下载文件
    """
    # 1. 优先读取环境变量中的对象存储链接
    # 您需要在 Sealos 的“环境变量”中设置 CLIENT_DOWNLOAD_URL
    # 例如: https://your-bucket.oss-cn-hangzhou.sealos.run/HexCoach-Lite-1.0.0.exe
    oss_url = os.getenv("CLIENT_DOWNLOAD_URL")
    
    if oss_url:
        return RedirectResponse(url=oss_url)

    # 2. 如果没配置，尝试本地文件 (兜底)
    file_path = current_dir / "secure_data" / "HexCoach-Lite-1.0.0.exe"
    
    # 兼容旧文件名
    if not file_path.exists():
        file_path = current_dir / "secure_data" / "HexClient.exe"

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="下载服务配置错误：未找到文件或OSS链接")

    # 如果是本地文件，依然使用流式传输 (消耗服务器流量)
    return FileResponse(
        path=file_path, 
        filename="HexCoach-Lite-1.0.0.exe", 
        media_type="application/vnd.microsoft.portable-executable"
    )

# 1. 专门处理 favicon.png (解决图标不显示的问题)
@app.get("/favicon.{ext}")
async def favicon(ext: str):
    # 只允许特定后缀，防止任意文件读取
    if ext not in ["ico", "svg", "png"]:
        raise HTTPException(status_code=404)
        
    file_path = DIST_DIR / f"favicon.{ext}"
    if not file_path.exists():
        # 尝试去 public 找
        file_path = DIST_DIR / "public" / f"favicon.{ext}"
    
    if file_path.exists():
        # 简单判断 mime type
        media_type = "image/svg+xml" if ext == "svg" else f"image/{ext}"
        if ext == "ico": media_type = "image/x-icon"
        
        return FileResponse(file_path, media_type=media_type)
        
    raise HTTPException(status_code=404)

# ================= 🚀 热更新接口 (无需重启) =================

@app.post("/admin/hot-update")
async def hot_update_config(
    file: UploadFile = File(...), 
    file_type: str = Body(..., embed=True), # 选项: "prompts", "mechanics", "corrections", "champions"
    current_user: dict = Depends(get_current_user)
):
    """
    🚀 零停机更新配置！
    用法：在 Postman 中 POST /admin/hot-update
    Body (form-data):
      - file: 选择你的 json 文件
      - file_type: 输入 "prompts" 或 "champions"
    """
    # 1. 权限检查 (必须是管理员)
    if current_user.get("role") not in ["admin", "root"]:
        raise HTTPException(status_code=403, detail="权限不足")

    # 2. 映射文件名
    filename_map = {
        "prompts": "prompts.json",
        "mechanics": "s16_mechanics.json",
        "corrections": "corrections.json",
        "champions": "champions.json"
    }
    
    target_filename = filename_map.get(file_type)
    if not target_filename:
        raise HTTPException(status_code=400, detail="无效的文件类型，请选择: prompts, mechanics, corrections, champions")

    target_path = current_dir / "secure_data" / target_filename

    # 3. 覆盖服务器本地文件
    try:
        # 写入新文件
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"🔥 [HotUpdate] {target_filename} 文件已覆盖")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件写入失败: {str(e)}")

    # 4. 触发内存/数据库刷新逻辑
    try:
        # A. 如果是英雄数据，刷新名称映射表
        if file_type == "champions":
            preload_champion_map()
            print("🔄 [HotUpdate] 英雄名称映射表已重载")

        # B. 重新运行 seed_data 同步到 MongoDB
        # 你的 seed_data 脚本会自动读取刚才覆盖的新文件，并更新到数据库
        if seed_data:
            seed_data()
            print("🔄 [HotUpdate] 数据库已同步")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"数据同步失败: {str(e)}")

    return {"status": "success", "msg": f"成功！{target_filename} 已更新并生效，无需重启。"}

# --- Wiki 攻略管理 ---

@app.delete("/community/posts/{post_id}")
def delete_community_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = db.get_wiki_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    # 权限检查：管理员 或 作者本人
    is_admin = current_user.get("role") in ["admin", "root"]
    is_author = str(post.get("author_id")) == str(current_user["_id"])
    
    if not (is_admin or is_author):
        raise HTTPException(status_code=403, detail="权限不足")
    
    if db.delete_wiki_post(post_id):
        return {"status": "success", "msg": "攻略已删除"}
    raise HTTPException(status_code=500, detail="删除失败")

@app.put("/community/posts/{post_id}")
def update_community_post(post_id: str, data: WikiPostUpdate, current_user: dict = Depends(get_current_user)):
    post = db.get_wiki_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
        
    # 🔥 [修改] 权限放开：作者本人 OR 管理员
    is_author = str(post.get("author_id")) == str(current_user["_id"])
    is_admin = current_user.get("role") in ["admin", "root"]
    
    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="权限不足")
        
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if db.update_wiki_post(post_id, updates):
        return {"status": "success", "msg": "攻略已更新"}
    raise HTTPException(status_code=500, detail="更新失败")

@app.put("/community/tavern/{post_id}")
def update_tavern_post(post_id: str, data: TavernPostUpdate, current_user: dict = Depends(get_current_user)):
    post = db.get_tavern_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
        
    # 🔥 [修改] 权限逻辑：作者本人 OR 管理员
    is_author = str(post.get("author_id")) == str(current_user["_id"])
    is_admin = current_user.get("role") in ["admin", "root"]

    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="权限不足，只能编辑自己的动态")
        
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if db.update_tavern_post(post_id, updates):
        return {"status": "success", "msg": "动态已更新"}
    raise HTTPException(status_code=500, detail="更新失败")
# --- 酒馆动态管理 ---

@app.delete("/community/tavern/{post_id}")
def delete_tavern_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = db.get_tavern_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
        
    is_admin = current_user.get("role") in ["admin", "root"]
    is_author = str(post.get("author_id")) == str(current_user["_id"])
    
    if not (is_admin or is_author):
        raise HTTPException(status_code=403, detail="权限不足")
        
    if db.delete_tavern_post(post_id):
        return {"status": "success", "msg": "动态已删除"}
    raise HTTPException(status_code=500, detail="删除失败")

@app.put("/community/posts/{post_id}")
def update_community_post(post_id: str, data: WikiPostUpdate, current_user: dict = Depends(get_current_user)):
    post = db.get_wiki_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    
    # 🔥 [修改] 权限逻辑
    is_author = str(post.get("author_id")) == str(current_user["_id"])
    is_admin = current_user.get("role") in ["admin", "root"]

    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="权限不足")

    updates = {k: v for k, v in data.dict().items() if v is not None}
    if db.update_wiki_post(post_id, updates):
        return {"status": "success", "msg": "攻略已更新"}
    raise HTTPException(status_code=500, detail="更新失败")

@app.put("/community/tavern/{post_id}")
def update_tavern_post(post_id: str, data: TavernPostUpdate, current_user: dict = Depends(get_current_user)):
    post = db.get_tavern_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
        
    # 🔥 [修改] 权限逻辑：作者本人 OR 管理员
    is_author = str(post.get("author_id")) == str(current_user["_id"])
    is_admin = current_user.get("role") in ["admin", "root"]

    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="权限不足，只能编辑自己的动态")
        
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if db.update_tavern_post(post_id, updates):
        return {"status": "success", "msg": "动态已更新"}
    raise HTTPException(status_code=500, detail="更新失败")
@app.get("/sales/dashboard")
def get_sales_dashboard(current_user: dict = Depends(get_current_user)):
    # 🔥🔥🔥 [修改] 增加权限验证：只有 管理员 或 销售 才能看
    allowed_roles = ['admin', 'root', 'sales']
    if current_user.get('role') not in allowed_roles:
        raise HTTPException(status_code=403, detail="您不是销售合伙人，无法查看此数据")
    
    data = db.get_sales_dashboard_data(current_user['username'])
    return data
# ==========================
# ⚙️ 系统配置 API
# ==========================

# 1. 公开接口：获取下载链接 (给 DownloadModal 用)
@app.get("/api/config/client")
def get_client_config_endpoint():
    # 注意：db 是 server.py 全局初始化的 KnowledgeBase 实例
    config = db.get_client_config()
    return {
        "pan_url": config.get("pan_url", ""),
        "pan_pwd": config.get("pan_pwd", "")
    }

# 2. 管理接口：更新下载链接 (给 AdminDashboard 用) - 这就是你报错 405 的那个接口
@app.post("/admin/config/client")
def update_client_config_endpoint(data: ClientConfigUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足：仅超级管理员可修改系统配置")
    
    if db.update_client_config(data.pan_url, data.pan_pwd):
        return {"status": "success", "msg": "下载链接已更新"}
    
    raise HTTPException(status_code=500, detail="更新失败")
# 2. 在 API 路由区域添加广播接口
@app.post("/admin/broadcast")
def broadcast_message_endpoint(req: BroadcastRequest, current_user: dict = Depends(get_current_user)):
    # 🛡️ 严格权限检查：仅限 root
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足：仅超级管理员(Root)可使用广播功能")
    
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="广播内容不能为空")
        
    # 执行广播
    success, msg = db.broadcast_message(current_user['username'], req.content)
    
    if not success:
        raise HTTPException(status_code=500, detail=msg)
        
    return {"status": "success", "msg": msg}
# ========================================
# 🚨 兜底路由 (必须放在所有 API 之后)
# ==========================================

# 2. 捕获所有其他路径 -> 智能判断是文件还是页面
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    # A. 优先检查静态文件
    file_path = DIST_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)

    # B. API 404 处理 (避免返回 HTML)
    if full_path.startswith("api/") or full_path.startswith("assets/"):
        raise HTTPException(status_code=404)
        
    # C. SPA 路由兜底：返回 index.html
    index_path = DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "Frontend build not found. Did you run 'npm run build'?"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)