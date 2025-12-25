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
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ✨ 关键修改：引入异步客户端，解决排队问题
from openai import AsyncOpenAI, APIError

# 🔐 安全库
from passlib.context import CryptContext
from jose import JWTError, jwt

# 引入数据库逻辑
from core.database import KnowledgeBase

# ================= 🔧 强制加载根目录 .env =================
current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent
env_path = root_dir / '.env'
load_dotenv(dotenv_path=env_path)

# ================= 🛡️ 生产环境安全配置 =================

# 1. 密钥配置 (生产环境强制检查)
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # 开发环境下给一个默认值，防止启动报错，但在生产环境应报错
    print("⚠️ [警告] 未配置 SECRET_KEY，使用开发默认值 (仅限本地测试)")
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
    # 👇👇👇 强制允许本地开发地址，不再依赖 ENV 变量 👇👇👇
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

# 允许通过环境变量扩展 CORS 域名
env_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
if env_origins:
    ORIGINS.extend([o.strip() for o in env_origins if o.strip()])

print(f"🔓 [CORS] 当前允许的跨域来源: {ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS, 
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"], 
    allow_headers=["*"],
)

# ================= 模型定义 =================

class UserCreate(BaseModel):
    username: str
    password: str
    email: str
    verify_code: str
    device_id: str = "unknown" 

class EmailRequest(BaseModel):
    email: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

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
            "name": hero['name'],
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

# ================= 🚀 API 接口 =================

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
async def serve_spa():
    # 检查前端文件是否存在
    index_path = Path("frontend/dist/index.html")
    if not index_path.exists():
        return {"error": "前端文件未找到，请检查构建流程 (npm run build)"}
    return FileResponse(index_path)

@app.post("/send-email")
def send_email_code(req: EmailRequest):
    if not re.match(r"[^@]+@[^@]+\.[^@]+", req.email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")

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
        raise HTTPException(status_code=500, detail="邮件发送失败")

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
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.get_user(form_data.username)
    if not user or not verify_password(form_data.password, user['password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
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

# --- 4. AI 分析 (集成推荐算法) ---

@app.post("/analyze")
async def analyze_match(data: AnalyzeRequest, current_user: dict = Depends(get_current_user)): 
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

    # 4. 数据准备
    game_constants = db.get_game_constants()
    s15_context = f"S15数据: 巢虫{game_constants.get('void_grubs_spawn')}, {game_constants.get('patch_notes')}"

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
            # 如果英雄主定位是打野，且当前被推断为单人路，强制修正为打野
            if user_role_key in ["TOP", "MID"]:
                user_role_key = "JUNGLE"

    # ---------------------------------------------------------
    # ⚡ 核心逻辑：对位判定与生态构建 (Matchup Logic)
    # ---------------------------------------------------------
    primary_enemy = "Unknown"
    bot_lane_context = "" 
    
    # A. 打野逻辑
    if user_role_key == "JUNGLE":
        # 优先找对面打野
        primary_enemy = enemy_roles_map.get("JUNGLE", "Unknown")
        if primary_enemy == "Unknown": primary_enemy = "Unknown Jungle"
        
        # 如果主要敌人不是对面打野（说明用户在针对线上），需要标记
        # (后续在 prompt 里处理 display name)

    # B. 下路双人组逻辑
    elif user_role_key in ["ADC", "SUPPORT"]:
        primary_enemy = enemy_roles_map.get(user_role_key, "Unknown")
        # 构建 2v2 上下文
        my_ad = my_roles_map.get("ADC", "Unknown")
        my_sup = my_roles_map.get("SUPPORT", "Unknown")
        en_ad = enemy_roles_map.get("ADC", "Unknown")
        en_sup = enemy_roles_map.get("SUPPORT", "Unknown")
        
        # 简单查库翻译一下名字，方便阅读
        def get_cn(name):
            i = db.get_champion_info(name)
            return i['name'] if i else name
            
        bot_lane_context = f"""
        \n--------- ⚔️ 下路2v2生态分析 ⚔️ ---------
        【我方组合】: {get_cn(my_ad)} (AD) + {get_cn(my_sup)} (辅助)
        【敌方组合】: {get_cn(en_ad)} (AD) + {get_cn(en_sup)} (辅助)
        请注意：必须结合双方辅助的开团/保护能力，以及AD的爆发/消耗能力进行综合分析。
        ------------------------------------------
        """
        
    # C. 单人路
    else:
        primary_enemy = enemy_roles_map.get(user_role_key, "Unknown")

    # 兜底：如果没找到对位，尝试使用前端传来的 enemyHero
    if primary_enemy == "Unknown" and data.enemyHero: 
        primary_enemy = data.enemyHero

    # 6. ⚡⚡⚡ 触发推荐算法 (纯净版) ⚡⚡⚡
    rank_type = "Diamond+" if data.rank in ["Diamond", "Master", "Challenger"] else "Platinum-"
    algo_recommendations = recommend_heroes_algo(db, user_role_key, rank_type, None)
    
    rec_str = ""
    for idx, rec in enumerate(algo_recommendations):
        rec_str += f"{idx+1}. {rec['name']} ({rec['tier']}) - {rec['reason']}\n"
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

        knowledge = db.get_top_knowledge_for_ai(data.myHero, rag_enemy)
        if rag_enemy == "general":
            top_tips = knowledge.get("general", [])
        else:
            top_tips = knowledge.get("matchup", []) + knowledge.get("general", [])
            
        corrections = db.get_corrections(data.myHero, rag_enemy)

    tips_text = "\n".join([f"- 社区心得: {t}" for t in top_tips]) if top_tips else "(暂无)"
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
            if not hero_id or hero_id == "Unknown":
                translated_map[role] = "未知"
                continue
            info = db.get_champion_info(hero_id)
            if info and 'name' in info:
                translated_map[role] = info['name'] 
            else:
                translated_map[role] = hero_id
        return translated_map

    my_roles_cn = translate_roles(my_roles_map)
    enemy_roles_cn = translate_roles(enemy_roles_map)
    
    # 翻译核心英雄
    my_hero_cn = data.myHero
    info = db.get_champion_info(data.myHero)
    if info: my_hero_cn = info['name']

    enemy_hero_cn = primary_enemy
    if primary_enemy != "Unknown":
        info = db.get_champion_info(primary_enemy)
        if info: 
            enemy_hero_cn = info['name']
            # 如果打野针对非对位，加备注
            real_jg = enemy_roles_map.get("JUNGLE")
            if user_role_key == "JUNGLE" and primary_enemy != real_jg:
                enemy_hero_cn += " (Gank目标)"

    def format_roles_str(role_map):
        return " | ".join([f"{k}: {v}" for k, v in role_map.items()])

    # 填充 User Prompt
    user_content = tpl['user_template'].format(
        mode=data.mode,
        user_rank=data.rank,        
        db_suggestions=rec_str,     
        myTeam=format_roles_str(my_roles_cn),       # ✅ 中文阵容
        enemyTeam=format_roles_str(enemy_roles_cn), # ✅ 中文阵容
        myHero=my_hero_cn,          # ✅ 中文名
        enemyHero=enemy_hero_cn,    # ✅ 中文名
        userRole=user_role_key,    
        s15_context=s15_context,
        bot_lane_context=bot_lane_context,
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

@app.get("/admin/feedbacks")
def get_admin_feedbacks(current_user: dict = Depends(get_current_user)):
    # 权限检查
    allowed_roles = ["admin", "root", "vip_admin"] 
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="权限不足")
    return db.get_all_feedbacks()

@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    if os.path.exists("frontend/dist/index.html"): return FileResponse("frontend/dist/index.html")
    return {"error": "Frontend build not found"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)