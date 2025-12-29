import os
import json
import uvicorn
import datetime
import time
import random
import re
import smtplib
import requests
import hashlib
import sys
from pathlib import Path
from email.mime.text import MIMEText
from email.utils import formataddr
from dotenv import load_dotenv
from typing import List, Optional, Dict
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
# 🟢 修复：这里添加了 BackgroundTasks
from fastapi import FastAPI, HTTPException, Depends, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.concurrency import run_in_threadpool
from datetime import datetime, timedelta
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
LOGIN_LIMIT_STORE = {}     # 🟢 [新增] 登录接口频控
ANALYZE_LIMIT_STORE = {}   # AI分析频控
CHAMPION_CACHE = {}        # 🟢 全局英雄缓存

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
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.qq.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

# ✨ 初始化异步 OpenAI 客户端
client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY, 
    base_url="https://api.deepseek.com"
)

# 🔒 生产环境关闭 Swagger UI
app = FastAPI(docs_url=None, redoc_url=None) 
db = KnowledgeBase()

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# OAuth2 方案
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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
    "http://127.0.0.1:3000"
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

# 🚀 启动时自动同步 Prompts
@app.on_event("startup")
async def startup_event():
    if seed_data:
        print("🔄 [Startup] 检测到 seed_data 模块，正在尝试同步数据库...")
        try:
            seed_data()
            print("✅ [Startup] 数据库同步完成！")
        except Exception as e:
            print(f"⚠️ [Startup] 数据库同步失败 (非致命): {e}")

# ================= 模型定义 =================

class UserCreate(BaseModel):
    username: str
    password: str
    email: str
    verify_code: str
    device_id: str = "unknown" 

class AdminUserUpdate(BaseModel):
    username: str
    action: str  # "add_days", "set_role", "rename", "delete"
    value: str   # 天数/角色/新名字/空字符串

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
    
    myLaneAssignments: Optional[Dict[str, str]] = None 
    enemyLaneAssignments: Optional[Dict[str, str]] = None
    model_type: str = "chat" # 'chat' or 'reasoner'

# 🟢 新增：管理员修改用户请求模型
class AdminUserUpdate(BaseModel):
    username: str
    action: str  # "add_days" 或 "set_role"
    value: str   # 天数 "30" 或 角色名 "admin"

# ================= 🔐 核心权限逻辑 =================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
# 🧮 核心算法：推荐英雄 (纯净版 - 无对位数据)
# ==========================================
def recommend_heroes_algo(db_instance, user_role, rank_tier, enemy_hero_doc=None):
    """
    根据段位和当前分路，计算推荐列表。
    完全移除对位 (Matchup) 逻辑，仅基于版本强度 (Tier/WinRate/PickRate)。
    """
    recommendations = []
    current_role = user_role.upper() # 确保是大写 (TOP/MID...)
    
    # 1. 获取所有英雄
    cursor = db_instance.champions_col.find({})
    
    candidates = []

    for hero in cursor:
        # ✨ 核心：只读取 seed_data.py 生成的 positions 字段
        positions_data = hero.get('positions', {})
        role_stats = positions_data.get(current_role)
        
        # 如果该英雄不打这个位置，跳过
        if not role_stats:
            continue

        # 2. 提取关键指标
        tier = role_stats.get('tier', 5)
        win_rate = role_stats.get('win_rate', 0)
        pick_rate = role_stats.get('pick_rate', 0)
        ban_rate = role_stats.get('ban_rate', 0)
        
        # 3. 计算得分 (Score)
        # 基础分：胜率 (0.50 -> 50分)
        score = win_rate * 100 
        
        # 层级加权: T1=+25, T2=+15, T3=+5
        if tier == 1: score += 25
        elif tier == 2: score += 15
        elif tier == 3: score += 5
        else: score -= 5

        reason = ""
        
        # 4. 段位偏好逻辑
        if rank_tier == "Diamond+":
            # 💎 高分段：看重 Meta (Pick率)
            score += pick_rate * 50
            reason = f"高分段T{tier}热门 (Pick: {pick_rate:.1%})"
        else:
            # 🥇 低分段：看重 胜率 & Ban率
            score += ban_rate * 20
            score += (win_rate - 0.5) * 100 
            reason = f"当前版本T{tier}强势 (Win: {win_rate:.1%})"

        # ⚠️ 已移除所有克制微调逻辑

        candidates.append({
            "name": hero['name'], # 存英文ID
            "score": score,
            "tier": f"T{tier}",
            "data": {
                # 统一口径：因为没有对位数据，这里填全局胜率，并在 Prompt 里修改解释
                "vs_win": f"{win_rate:.1%}",      
                "lane_kill": "-",               # 明确标识无数据
                "win_rate": f"{win_rate:.1%}",
                "pick_rate": f"{pick_rate:.1%}",
                "games": "High"                 
            },
            "reason": reason
        })

    # 5. 排序并取 Top 3
    candidates.sort(key=lambda x: x['score'], reverse=True)
    return candidates[:3]

# 🟢 FastAPI 版本的邀请码接口
@app.post("/user/redeem_invite")
async def redeem_invite(
    payload: InviteRequest, 
    # 👇 这里非常关键：请查看您代码里其他接口（如 /users/me）是用什么获取当前用户的
    # 通常是 current_user: dict = Depends(get_current_user)
    current_user: dict = Depends(get_current_user) 
):
    invite_code = payload.invite_code.strip()
    if not invite_code:
        raise HTTPException(status_code=400, detail="请输入邀请码")

    # 1. 这里的 db 应该是您全局定义的数据库对象
    # 如果您是用 request.app.state.db 或者依赖注入，请相应调整
    user = await db.users.find_one({"_id": current_user["_id"]})
    
    if not user:
        raise HTTPException(status_code=404, detail="用户数据同步错误")

    # 2. 检查：是否已经填写过
    if user.get('invited_by'):
        raise HTTPException(status_code=400, detail="您已经领取过新手福利了，无法重复领取")

    # 3. 检查：邀请码有效性 (用户名即邀请码)
    inviter = await db.users.find_one({"username": invite_code})

    if not inviter:
        raise HTTPException(status_code=404, detail="无效的邀请码（请输入朋友的用户名）")

    # 4. 检查：不能邀请自己
    if str(inviter['_id']) == str(user['_id']):
        raise HTTPException(status_code=400, detail="不能邀请自己哦")

    # === 核心逻辑：加时间函数 ===
    def calculate_new_expire(user_obj, days=3):
        now = datetime.utcnow()
        current_expire = user_obj.get('membership_expire')
        # 如果当前没会员或已过期，从现在开始算
        if not current_expire or current_expire < now:
            return now + timedelta(days=days)
        else:
            # 如果还有会员，顺延
            return current_expire + timedelta(days=days)

    # 更新当前用户 (受邀者)
    new_expire_user = calculate_new_expire(user)
    await db.users.update_one(
        {"_id": user['_id']},
        {
            "$set": {
                "membership_expire": new_expire_user,
                "invited_by": inviter['_id'],
                # 如果是普通用户，升级为Pro
                "role": "pro" if user.get('role', 'user') == 'user' else user.get('role')
            }
        }
    )

    # 更新邀请人
    new_expire_inviter = calculate_new_expire(inviter)
    await db.users.update_one(
        {"_id": inviter['_id']},
        {
            "$set": {
                "membership_expire": new_expire_inviter,
                "role": "pro" if inviter.get('role', 'user') == 'user' else inviter.get('role')
            },
            "$inc": {"invite_count": 1}
        }
    )

    return {
        "msg": "兑换成功！您和您的朋友都获得了 3 天 Pro 会员！",
        "new_expire": new_expire_user.isoformat()
    }


# ================= 🚀 API 接口 =================

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
# 🟢 新增：获取英雄分路映射接口
# backend/server.py

# ... (保留之前的 import，务必确保引入了 re) ...

# ... (保留前面的代码，直到 get_champion_roles 接口) ...

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

async def polish_tip_content(tip_id: str, content: str):
    """后台任务：使用 AI 为玩家攻略生成标题和标签"""
    try:
        # 使用更便宜、更快的 V3 模型
        prompt = f"请为这条LOL攻略生成一个6-10字的吸引人标题和2个分类标签（如：对线、团战、出装）。攻略内容：{content}"
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"} # 强制输出 JSON
        )
        res = json.loads(response.choices[0].message.content)
        
        # 更新数据库
        db.tips_col.update_one(
            {"_id": ObjectId(tip_id)},
            {"$set": {
                "title": res.get("title"),
                "tags": res.get("tags"),
                "is_polished": True
            }}
        )
    except Exception as e:
        print(f"AI Polishing Error: {e}")

@app.post("/tips")
async def add_tip_endpoint(data: TipInput, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """发布攻略并触发 AI 装修"""
    res = db.add_tip(data.hero, data.enemy, data.content, current_user['username'], data.is_general)
    
    # 开启后台任务，不阻塞用户响应
    background_tasks.add_task(polish_tip_content, str(res.inserted_id), data.content)
    
    return {"status": "success", "msg": "发布成功，AI 正在为您优化排版..."}

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
    if any(r in user.username.lower() for r in RESERVED):
        raise HTTPException(status_code=400, detail="用户名包含保留字")

    if not db.validate_otp(user.email, user.verify_code):
        raise HTTPException(status_code=400, detail="验证码错误或已失效")

    hashed_pw = get_password_hash(user.password)
    
    result = db.create_user(
        user.username, 
        hashed_pw, 
        role="user", 
        email=user.email,
        device_id=user.device_id,
        ip=request.client.host
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
    
    # 登录成功，清除计数
    LOGIN_LIMIT_STORE[client_ip]["count"] = 0
    
    access_token = create_access_token(data={"sub": user['username']})
    return {"access_token": access_token, "token_type": "bearer", "username": user['username']}

# ✨ 增强版用户信息接口 (返回 R1 使用情况)
@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    # 调用数据库新方法，获取详细的使用情况
    status_info = db.get_user_usage_status(current_user['username'])
    
    return {
        "username": current_user['username'],
        "role": status_info.get("role", "user"),
        "is_pro": status_info.get("is_pro", False),
        "expire_at": current_user.get("membership_expire"),
        # 返回 R1 的使用情况
        "r1_limit": status_info.get("r1_limit", 10),
        "r1_used": status_info.get("r1_used", 0),
        "r1_remaining": status_info.get("r1_remaining", 0)
    }

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

@app.get("/tips")
def get_tips(hero: str, enemy: str = "None", is_general: bool = False):
    return db.get_tips_for_ui(hero, enemy, is_general)

@app.post("/tips")
def add_tip(data: TipInput, current_user: dict = Depends(get_current_user)):
    db.add_tip(data.hero, data.enemy, data.content, current_user['username'], data.is_general)
    return {"status": "success"}

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
def get_admin_feedbacks(current_user: dict = Depends(get_current_user)):
    # 权限检查
    allowed_roles = ["admin", "root", "vip_admin"] 
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="权限不足")
    return db.get_all_feedbacks()

# 🟢 新增：获取用户列表接口
@app.get("/admin/users")
def get_admin_users(search: str = "", current_user: dict = Depends(get_current_user)):
    # 1. 权限检查 (安全核心)
    allowed_roles = ["admin", "root", "vip_admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    
    # 2. 查询数据
    return db.get_all_users(limit=50, search=search)

# 🟢 新增：管理员更新用户信息接口
@app.post("/admin/user/update")
def update_user_admin(data: AdminUserUpdate, current_user: dict = Depends(get_current_user)):
    # 1. 权限检查
    if current_user.get("role") not in ["admin", "root"]:
        raise HTTPException(status_code=403, detail="权限不足")

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


# --- 4. AI 分析 (集成推荐算法) ---

@app.post("/analyze")
async def analyze_match(data: AnalyzeRequest, current_user: dict = Depends(get_current_user)): 
    # 🟢 [新增] 3秒冷却防刷机制
    username = current_user['username']
    now = time.time()
    last_request_time = ANALYZE_LIMIT_STORE.get(username, 0)
    
    # 如果距离上次请求不足 3 秒，直接拒绝
    if now - last_request_time < 3:
        async def fast_err(): 
            yield json.dumps({
                "concise": {
                    "title": "操作太快了", 
                    "content": "请等待 AI 思考完毕后再试 (冷却中...)"
                }
            })
        return StreamingResponse(fast_err(), media_type="application/json")
    
    # 更新最后请求时间
    ANALYZE_LIMIT_STORE[username] = now
    # 1. API Key 检查
    if not DEEPSEEK_API_KEY:
         async def err(): yield json.dumps({"concise": {"title":"维护中", "content":"服务暂时不可用 (Configuration Error)"}})
         return StreamingResponse(err(), media_type="application/json")

    # 2. 频控检查 (传入 model_type 进行分级计费)
    allowed, msg, remaining = db.check_and_update_usage(current_user['username'], data.mode, data.model_type)
    if not allowed:
        async def limit_err(): 
            yield json.dumps({
                "concise": {
                    "title": "请求被拒绝", 
                    "content": msg + ("\n💡 升级 Pro 可解锁无限次使用！" if remaining == -1 else "")
                }
            })
        return StreamingResponse(limit_err(), media_type="application/json")

    # 3. Input Sanitization (输入清洗)
    if data.myHero:
        hero_info = db.get_champion_info(data.myHero)
        if not hero_info:
            async def attack_err(): yield json.dumps({"concise": {"title": "输入错误", "content": f"系统未识别英雄 '{data.myHero}'。"}})
            return StreamingResponse(attack_err(), media_type="application/json")

    if data.enemyHero:
        hero_info = db.get_champion_info(data.enemyHero)
        if not hero_info:
            async def attack_err(): yield json.dumps({"concise": {"title": "输入错误", "content": f"系统未识别英雄 '{data.enemyHero}'。"}})
            return StreamingResponse(attack_err(), media_type="application/json")

    # 4. 数据准备 (修复版：正确读取 JSON 结构)
    game_constants = await run_in_threadpool(db.get_game_constants)
    
    # 提取核心机制数据 (防止 None)
    modules = game_constants.get('data_modules', {})
    mechanics_list = []
    
    # 遍历所有模块提取规则 (game_flow, items, user_feedback 等)
    for cat_key, cat_val in modules.items():
        if isinstance(cat_val, dict) and 'items' in cat_val:
            for item in cat_val['items']:
                mechanics_list.append(f"{item.get('name')}: {item.get('rule')} ({item.get('note')})")
    
    s15_details = "; ".join(mechanics_list)
    s15_context = f"【S15/峡谷常识库】: {s15_details if s15_details else '暂无特殊机制数据'}"
    
    # =========================================================
    # 🛠️ 【关键位置调整】辅助函数定义提前到这里！ (解决 NameError)
    # =========================================================
    def get_hero_cn_name(hero_id):
        """优先提取中文名 (Alias > Name)"""
        if not hero_id or hero_id == "Unknown": return hero_id
        
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
    # 优先级 2: 根据选择的英雄在己方阵容中的位置推断
    elif data.myHero:
        for r, h in my_roles_map.items():
            if h == data.myHero: user_role_key = r; break

    # ⚡ 修正：如果用户没手动指定，且推断出的位置很奇怪（比如盲僧上单）
    # 我们查库看看这个英雄的"本命位置"是不是打野
    if not manual_role_set and data.myHero:
        hero_info_doc = db.get_champion_info(data.myHero)
        if hero_info_doc and hero_info_doc.get('role') == 'jungle':
            # 检查队友里有没有更像打野的人
            teammate_roles = [db.get_champion_info(h).get('role') for h in data.myTeam if db.get_champion_info(h)]
            
            # 如果我是单人路，且队友里没人是主玩打野的，那大概率系统判错了，我才是打野
            if user_role_key in ["TOP", "MID"] and 'jungle' not in teammate_roles:
                user_role_key = "JUNGLE"

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
        1. 河道主权：3分15秒河蟹刷新时，哪边中野更强？
        2. 先手权：谁拥有推线游走的主动权？
        -------------------------------------------------------------
        """

    # === C. 打野 (JUNGLE) ===
    # 🟢 修正：打野使用专属的 Prompts 模板，不生成额外的 Python Context 指令
    elif user_role_key == "JUNGLE":
        primary_enemy = enemy_roles_map.get("JUNGLE", "Unknown")
        # 如果打野针对的是线上英雄
        if primary_enemy == "Unknown" and data.enemyHero:
            primary_enemy = data.enemyHero
            
        # ⚠️ 关键点：留空 Context，让 JSON 里的 personal_jungle 模板完全接管
        lane_matchup_context = "" 

    # === D. 上路 (TOP) / 其他 ===
    else:
        primary_enemy = enemy_roles_map.get("TOP", "Unknown")
        # 兜底
        if primary_enemy == "Unknown" and data.enemyHero: 
            primary_enemy = data.enemyHero
            
        # 简单的上路 Context
        lane_matchup_context = "(上路是孤岛，请专注于 1v1 兵线与换血细节分析)"

    # 兜底：如果没找到对位，尝试使用前端传来的 enemyHero
    if primary_enemy == "Unknown" and data.enemyHero: 
        primary_enemy = data.enemyHero

    # 6. ⚡⚡⚡ 触发推荐算法 (纯净版) ⚡⚡⚡
    rank_type = "Diamond+" if data.rank in ["Diamond", "Master", "Challenger"] else "Platinum-"
    algo_recommendations = recommend_heroes_algo(db, user_role_key, rank_type, None)
    
    rec_str = ""
    for idx, rec in enumerate(algo_recommendations):
        # ✅ 使用定义好的 get_hero_cn_name 翻译，推荐列表也变中文了
        rec_name_cn = get_hero_cn_name(rec['name'])
        rec_str += f"{idx+1}. {rec_name_cn} ({rec['tier']}) - {rec['reason']}\n"
    if not rec_str: rec_str = "(暂无数据)"

    # 7. RAG 检索 (防止打野被线上Tips误导)
    top_tips = []
    corrections = []
    if data.myHero:
        rag_enemy = primary_enemy
        # 如果我是打野，且目标不是对面打野，强制查通用技巧，不查对线技巧
        if user_role_key == "JUNGLE":
            real_enemy_jg = enemy_roles_map.get("JUNGLE", "Unknown")
            if primary_enemy != real_enemy_jg:
                rag_enemy = "general"

        knowledge = await run_in_threadpool(db.get_top_knowledge_for_ai, data.myHero, rag_enemy)
        if rag_enemy == "general":
            top_tips = knowledge.get("general", [])
        else:
            top_tips = knowledge.get("matchup", []) + knowledge.get("general", [])
            
        corrections = db.get_corrections(data.myHero, rag_enemy)

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
    correction_prompt = f"修正: {'; '.join(corrections)}" if corrections else ""

    # 8. Prompt 构建
    # 确定模板 ID
    target_mode = data.mode
    if data.mode == "personal":
        if user_role_key == "JUNGLE": target_mode = "personal_jungle"
        else: target_mode = "personal_lane"
    
    tpl = db.get_prompt_template(target_mode) or db.get_prompt_template("personal_lane")

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
    if primary_enemy != "Unknown":
        enemy_hero_cn = get_hero_cn_name(primary_enemy)
        # 如果打野针对非对位，加备注
        real_jg = enemy_roles_map.get("JUNGLE")
        if user_role_key == "JUNGLE" and primary_enemy != real_jg:
            enemy_hero_cn += " (Gank目标)"

    def format_roles_str(role_map):
        return " | ".join([f"{k}: {v}" for k, v in role_map.items()])

    # 填充 User Prompt (包含 compInfo 修复)
    user_content = tpl['user_template'].format(
        mode=data.mode,
        user_rank=data.rank,        
        db_suggestions=rec_str,     
        myTeam=format_roles_str(my_roles_cn),       # ✅ 中文阵容 (别名)
        enemyTeam=format_roles_str(enemy_roles_cn), # ✅ 中文阵容 (别名)
        myHero=my_hero_cn,          # ✅ 中文名 (别名)
        enemyHero=enemy_hero_cn,    # ✅ 中文名 (别名)
        userRole=user_role_key,    
        s15_context=s15_context,
        compInfo=lane_matchup_context,  # ✅ 智能生态 (含别名)
        tips_text=tips_text,
        correction_prompt=correction_prompt
    )
    
    system_content = tpl['system_template'] + ' Output JSON only.'

    # 9. AI 调用
    if data.model_type == "reasoner":
        MODEL_NAME = "deepseek-reasoner"
        print(f"🧠 [AI] R1 Request - User: {current_user['username']}")
    else:
        MODEL_NAME = "deepseek-chat"
        print(f"🚀 [AI] V3 Request - User: {current_user['username']}")

    async def event_stream():
        try:
            stream = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "system", "content": system_content}, {"role": "user", "content": user_content}],
                stream=True, temperature=0.6, max_tokens=4000
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            print(f"❌ AI Error: {e}")
            yield json.dumps({"concise": {"title": "错误", "content": "AI服务繁忙，请稍后重试。"}})

    return StreamingResponse(event_stream(), media_type="text/plain")


# ==========================================
# 🌟 静态文件与路由修复 
# ==========================================

# 定义前端构建目录的路径 (根据你的 Dockerfile 结构)
DIST_DIR = Path("frontend/dist") 

# 1. 专门处理 favicon.png (解决图标不显示的问题)
@app.get("/favicon.png")
async def favicon():
    # 尝试在 dist 根目录找
    file_path = DIST_DIR / "favicon.png"
    # 或者尝试在 public 目录找 (视构建情况而定)
    if not file_path.exists():
        file_path = DIST_DIR / "public" / "favicon.png"
        
    if file_path.exists():
        # 🌟 关键：返回 image/png 类型，而不是 html
        return FileResponse(file_path, media_type="image/png")
    
    # 如果真的找不到，返回 404，不要返回 index.html 误导浏览器
    raise HTTPException(status_code=404, detail="Favicon not found on server")

# 2. 捕获所有其他路径 -> 返回 index.html (SPA 路由)
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    # 如果请求的是 API 或静态资源但没找到，返回 404
    if full_path.startswith("api/") or full_path.startswith("assets/"):
        raise HTTPException(status_code=404)
        
    # 其他页面路径返回 index.html
    index_path = DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "Frontend build not found. Did you run 'npm run build'?"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)