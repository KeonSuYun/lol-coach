import os
import json
import uvicorn
import datetime
import time
import random
import re
import smtplib
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

# ✨ 引入官方 SDK
from openai import OpenAI, APIError

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
    # 🚨 生产环境严禁使用默认密钥，如果没有配置，直接报错停止启动
    print("❌ [致命错误] 生产环境必须配置 SECRET_KEY 环境变量！")
    # 为了保证您能先跑起来，这里给一个临时兜底，但在正式商业运营中请务必在 .env 设置
    SECRET_KEY = "prod_secret_key_please_change_this_in_env_file_immediately" 

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token 7天过期
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")

# 2. 邮件配置 (优先读取环境变量，保留默认值以便您直接运行)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.qq.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER", "904085736@qq.com") 
# ⚠️ 强烈建议在 .env 中设置 SMTP_PASSWORD，不要直接硬编码在代码里
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "fjgdtorjrkkdbgae") 

# ✨ 初始化 OpenAI 客户端
client = OpenAI(
    api_key=DEEPSEEK_API_KEY, 
    base_url="https://api.deepseek.com"
)

# 🔒 生产环境关闭 Swagger UI (docs_url=None) 以防接口泄露，如需调试可删去参数
app = FastAPI(docs_url=None, redoc_url=None) 
db = KnowledgeBase()

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# OAuth2 方案
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 挂载静态资源
if os.path.exists("frontend/dist/assets"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# 🟢 3. 严格 CORS 配置 (生产环境)
ORIGINS = [
    "https://psmcmulapyqb.cloud.sealos.io",
    "https://www.haxcoach.com",
    "https://haxcoach.com", 
]

# ✨ 新增：如果是开发模式，自动把 localhost 加回去
# 在本地运行时，您可以在终端设置 export ENV=dev (Linux/Mac) 或 set ENV=dev (Windows)
# 或者直接在 IDE 的运行配置里加环境变量
if os.getenv("ENV") == "dev" or os.getenv("DEBUG") == "true":
    print("🔓 [CORS] 开发模式：允许 Localhost 跨域请求")
    ORIGINS.extend([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ])

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
    
    myLaneAssignments: Optional[Dict[str, str]] = None 
    enemyLaneAssignments: Optional[Dict[str, str]] = None
    model_type: str = "chat" 

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

# ================= 🧠 智能分路算法 =================

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
        hero_info = getattr(db, 'get_champion_info', lambda x: None)(hero)
        pref_role = hero_info.get('role', 'mid').upper() if hero_info else "MID"
        role_map = {"TOP": "TOP", "JUNGLE": "JUNGLE", "MID": "MID", "ADC": "ADC", "BOTTOM": "ADC", "SUPPORT": "SUPPORT", "SUP": "SUPPORT"}
        target = role_map.get(pref_role, "MID")

        if final_roles[target] == "Unknown":
            final_roles[target] = hero
        else:
            for r in standard_roles:
                if final_roles[r] == "Unknown":
                    final_roles[r] = hero
                    break
    
    return {k: v for k, v in final_roles.items() if v != "Unknown"}

# ================= 🚀 API 接口 =================

@app.get("/")
def health_check():
    # 生产环境仅返回简单状态，隐藏具体版本号
    return {"status": "ok"}

# --- 1. 邮箱验证码发送 (生产环境: 真实 SMTP + 数据库存储) ---

@app.post("/send-email")
def send_email_code(req: EmailRequest):
    if not re.match(r"[^@]+@[^@]+\.[^@]+", req.email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")

    # 生成验证码
    code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    
    # 存入数据库 (使用 database.py 的 save_otp 方法，5分钟过期)
    # 相比内存缓存，这能防止服务器重启丢失验证码
    try:
        db.save_otp(req.email, code)
    except Exception as e:
        # 生产环境日志记录 error，但不返回给前端具体错误堆栈
        print(f"❌ DB Error: {e}")
        raise HTTPException(status_code=500, detail="系统繁忙，请稍后重试")

    # ==========================================
    # 🚀 真实发送：使用 SMTP
    # ==========================================
    try:
        msg = MIMEText(f'您的注册验证码是：{code}，5分钟内有效。请勿泄露给他人。', 'plain', 'utf-8')
        msg['From'] = formataddr(["HexCoach", SMTP_USER])
        msg['To'] = formataddr(["User", req.email])
        msg['Subject'] = "HexCoach 注册验证"
        
        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [req.email], msg.as_string())
        server.quit()
    except Exception as e:
        print(f"❌ SMTP Send Error: {e}")
        # 生产环境不暴露具体 SMTP 错误，防止泄露服务器信息
        raise HTTPException(status_code=500, detail="邮件发送失败，请检查邮箱是否正确或稍后重试")

    return {"status": "success", "msg": "验证码已发送至您的邮箱"}

# --- 2. 注册与登录 ---

@app.post("/register")
def register(user: UserCreate, request: Request):
    RESERVED = ["admin", "root", "system", "hexcoach", "gm", "master", "keonsuyun"]
    if any(r in user.username.lower() for r in RESERVED):
        raise HTTPException(status_code=400, detail="用户名包含保留字")

    # 1. 数据库校验验证码 (替代了原有的 OTP_CACHE)
    if not db.validate_otp(user.email, user.verify_code):
        raise HTTPException(status_code=400, detail="验证码错误或已失效")

    hashed_pw = get_password_hash(user.password)
    
    # 2. 创建用户 (带设备ID和IP)
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
    elif result == "USERNAME_TAKEN":
        raise HTTPException(status_code=400, detail="用户名已被占用")
    elif result == "EMAIL_TAKEN":
        raise HTTPException(status_code=400, detail="该邮箱已注册，请直接登录")
    elif result == "DEVICE_LIMIT":
        raise HTTPException(status_code=403, detail="该设备注册账号已达上限")
    elif result == "IP_LIMIT":
        raise HTTPException(status_code=403, detail="当前IP注册过于频繁")
    else:
        raise HTTPException(status_code=400, detail="注册失败，请稍后重试")

@app.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.get_user(form_data.username)
    if not user or not verify_password(form_data.password, user['password']):
        # 生产环境使用统一的错误提示，防止枚举攻击
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user['username']})
    return {"access_token": access_token, "token_type": "bearer", "username": user['username']}

# --- 3. 绝活社区 ---

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
    # 硬编码管理员列表检查 (生产环境最后的防线)
    is_admin = current_user.get('role') == 'admin' or current_user['username'] in ["admin", "root", "keonsuyun"]
    if tip['author_id'] != current_user['username'] and not is_admin: raise HTTPException(status_code=403)
    if db.delete_tip(tip_id): return {"status": "success"}
    raise HTTPException(status_code=500)

@app.post("/feedback")
def submit_feedback(data: FeedbackInput, current_user: dict = Depends(get_current_user)):
    db.submit_feedback({"user_id": current_user['username'], "match_context": data.match_context, "description": data.description})
    return {"status": "success"}

# --- 4. AI 分析 (含安全清洗) ---

@app.post("/analyze")
async def analyze_match(data: AnalyzeRequest, current_user: dict = Depends(get_current_user)): 
    # 1. API Key 检查
    if not DEEPSEEK_API_KEY:
         def err(): yield json.dumps({"concise": {"title":"维护中", "content":"服务暂时不可用 (Configuration Error)"}})
         return StreamingResponse(err(), media_type="application/json")

    # 2. 频控检查
    allowed, msg, remaining = db.check_and_update_usage(current_user['username'], data.mode)
    if not allowed:
        def limit_err(): 
            yield json.dumps({
                "concise": {
                    "title": "请求被拒绝", 
                    "content": msg + ("\n💡 升级 VIP 可解锁无限次使用！" if remaining == -1 else "")
                }
            })
        return StreamingResponse(limit_err(), media_type="application/json")

    # 🔥 3. Input Sanitization (输入清洗 - 防止 Prompt 注入)
    # 强制检查 myHero 和 enemyHero 是否在数据库的白名单中
    if data.myHero:
        hero_info = db.get_champion_info(data.myHero)
        if not hero_info:
            print(f"⚠️ [Security] 拦截非法输入 myHero: {data.myHero} from {current_user['username']}")
            def attack_err(): yield json.dumps({"concise": {"title": "输入错误", "content": f"系统未识别英雄 '{data.myHero}'。"}})
            return StreamingResponse(attack_err(), media_type="application/json")

    if data.enemyHero:
        hero_info = db.get_champion_info(data.enemyHero)
        if not hero_info:
            print(f"⚠️ [Security] 拦截非法输入 enemyHero: {data.enemyHero} from {current_user['username']}")
            def attack_err(): yield json.dumps({"concise": {"title": "输入错误", "content": f"系统未识别英雄 '{data.enemyHero}'。"}})
            return StreamingResponse(attack_err(), media_type="application/json")

    # 4. 数据准备
    game_constants = db.get_game_constants()
    s15_context = f"S15数据: 巢虫{game_constants.get('void_grubs_spawn')}, {game_constants.get('patch_notes')}"

    # 5. 分路计算
    my_roles_map = infer_team_roles(data.myTeam, data.myLaneAssignments)
    enemy_roles_map = infer_team_roles(data.enemyTeam, data.enemyLaneAssignments)

    user_role_key = "MID" 
    if data.userRole and data.userRole.upper() in ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]:
        user_role_key = data.userRole.upper()
    elif data.myHero:
        for r, h in my_roles_map.items():
            if h == data.myHero: user_role_key = r; break

    primary_enemy = enemy_roles_map.get(user_role_key, "Unknown")
    if primary_enemy == "Unknown" and data.enemyHero: primary_enemy = data.enemyHero

    # 6. RAG 检索
    top_tips = []
    corrections = []
    if data.myHero:
        knowledge = db.get_top_knowledge_for_ai(data.myHero, primary_enemy)
        top_tips = knowledge.get("matchup", []) + knowledge.get("general", [])
        corrections = db.get_corrections(data.myHero, primary_enemy)

    tips_text = "\n".join([f"- 社区心得: {t}" for t in top_tips]) if top_tips else "(暂无)"
    correction_prompt = f"修正: {'; '.join(corrections)}" if corrections else ""

    # 7. Prompt 构建
    target_mode = "personal_jungle" if user_role_key == "JUNGLE" and data.mode == "personal" else ("personal_lane" if data.mode == "personal" else data.mode)
    
    hero_info = db.get_champion_info(data.myHero)
    if hero_info:
        s15_context += f"\n- 英雄评级: {hero_info.get('tier', '未知')}, 定位: {hero_info.get('role')}"

    tpl = db.get_prompt_template(target_mode)
    if not tpl:
        def err(): yield json.dumps({"concise": {"title": "系统维护", "content": f"功能 [{target_mode}] 暂时维护中。"}})
        return StreamingResponse(err(), media_type="application/json")

    def format_roles(role_map):
        return " | ".join([f"{k}: {v}" for k, v in role_map.items() if v != "Unknown"])

    user_content = tpl['user_template'].format(
        mode=data.mode,
        myTeam=f"{format_roles(my_roles_map)} (原始: {str(data.myTeam)})",
        enemyTeam=f"{format_roles(enemy_roles_map)} (原始: {str(data.enemyTeam)})",
        myHero=data.myHero,
        enemyHero=primary_enemy,   
        userRole=user_role_key,    
        s15_context=s15_context,
        bot_lane_context="",
        tips_text=tips_text,
        correction_prompt=correction_prompt
    )
    
    system_content = tpl['system_template'] + ' Output JSON only: {"concise": {"title": "...", "content": "..."}, "detailed_tabs": []}'

    # 8. AI 调用
    if data.model_type == "reasoner":
        MODEL_NAME = "deepseek-reasoner"
        print(f"🧠 [AI] R1 Request - User: {current_user['username']}")
    else:
        MODEL_NAME = "deepseek-chat"
        print(f"🚀 [AI] V3 Request - User: {current_user['username']}")

    def event_stream():
        try:
            stream = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[{"role": "system", "content": system_content}, {"role": "user", "content": user_content}],
                stream=True, temperature=0.6, max_tokens=4000
            )
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            # 生产环境仅打印日志，不给前端返回具体错误堆栈
            print(f"❌ AI Error: {e}")
            yield json.dumps({"concise": {"title": "响应超时", "content": "AI思考时间过长或服务繁忙，请重试。"}})

    return StreamingResponse(event_stream(), media_type="text/plain")

@app.get("/admin/feedbacks")
def get_admin_feedbacks(current_user: dict = Depends(get_current_user)):
    is_db_admin = current_user.get("role") == "admin"
    SUPER_ADMINS = ["admin", "root", "keonsuyun", "HexCoach"] 
    if not (is_db_admin or current_user["username"] in SUPER_ADMINS):
        raise HTTPException(status_code=403, detail="权限不足")
    return db.get_all_feedbacks()

@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    if os.path.exists("frontend/dist/index.html"): return FileResponse("frontend/dist/index.html")
    return {"error": "Frontend build not found"}

if __name__ == "__main__":
    # 🚨 生产环境注意：host设为 0.0.0.0 允许公网访问
    # 建议使用 gunicorn 或其他 process manager 运行，而不是直接运行 python server.py
    uvicorn.run(app, host="0.0.0.0", port=8000)