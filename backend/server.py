import os
import json
import datetime
from typing import List, Optional, Dict
from bson import ObjectId

# --- FastAPI 核心 ---
from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

# --- 数据库与 AI ---
from pymongo import MongoClient
from openai import OpenAI, APIError
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv

# 1. 加载环境变量
load_dotenv()

# ================= 配置区域 =================
SECRET_KEY = os.getenv("SECRET_KEY", "hexcoach_secret_key_change_me_please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天过期
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")

# 初始化 APP
app = FastAPI()

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= 数据库连接 (直接连接，不依赖旧代码) =================
try:
    client = MongoClient(MONGO_URL)
    db = client["lol_community"] # 确保和 seed_data.py 里的库名一致
    print("✅ MongoDB 连接成功")
except Exception as e:
    print(f"❌ MongoDB 连接失败: {e}")

# ================= 工具与安全 =================
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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
    
    user = db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user

# ================= 模型定义 =================

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class AnalyzeRequest(BaseModel):
    mode: str
    myHero: str = ""
    enemyHero: str = ""
    myTeam: List[str] = []
    enemyTeam: List[str] = []
    userRole: str = "" 
    # ✨ 保留了你的分路数据结构
    myLaneAssignments: Optional[Dict[str, str]] = None 
    enemyLaneAssignments: Optional[Dict[str, str]] = None

class TipInput(BaseModel):
    hero: str
    enemy: str = "None"
    content: str
    is_general: bool = False

class FeedbackInput(BaseModel):
    match_context: Optional[dict] = {}
    description: str

class LikeInput(BaseModel):
    tip_id: str

# ================= 🧠 核心逻辑工具函数 =================

def smart_context_formatter(doc):
    """
    🔥 智能通用格式化器：读取 s15_details 并转为 AI 易读文本
    """
    if not doc or "data_modules" not in doc:
        return ""

    lines = []
    # 遍历所有模块
    for module_key, module_data in doc["data_modules"].items():
        title = module_data.get("title", module_key)
        lines.append(f"\n### {title}")
        
        items = module_data.get("items", [])
        for item in items:
            name = item.get("name") or item.get("concept") or "未命名"
            rule = item.get("rule") or item.get("s15_rule") or ""
            note = item.get("note") or item.get("ai_implication") or ""
            
            line = f"- **{name}**: {rule}"
            if note:
                line += f" (⚠️ 注意: {note})"
            lines.append(line)

    return "\n".join(lines)

def infer_team_roles(team_list: List[str], fixed_assignments: Optional[Dict[str, str]] = None):
    """
    🔥 保留了你的智能分路算法
    """
    if not team_list: return {}
    standard_roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]
    final_roles = {role: "Unknown" for role in standard_roles}
    assigned_heroes = set()

    # 1. 用户修正优先
    if fixed_assignments:
        for role, hero in fixed_assignments.items():
            if role.upper() in standard_roles and hero in team_list:
                final_roles[role.upper()] = hero
                assigned_heroes.add(hero)
    
    # 2. 自动填补剩余位置
    remaining_heroes = [h for h in team_list if h not in assigned_heroes]
    for hero in remaining_heroes:
        # 从数据库查英雄定位 (兼容新结构)
        hero_doc = db.champions.find_one({"id": hero})
        pref_role = hero_doc.get('role', 'MID').upper() if hero_doc else "MID"
        
        # 简单映射
        if pref_role in ["BOTTOM", "BOT"]: pref_role = "ADC"
        if pref_role == "SUP": pref_role = "SUPPORT"
        
        if final_roles.get(pref_role) == "Unknown":
            final_roles[pref_role] = hero
        else:
            # 简单兜底：找第一个空位
            for r in standard_roles:
                if final_roles[r] == "Unknown":
                    final_roles[r] = hero
                    break
                    
    return {k: v for k, v in final_roles.items() if v != "Unknown"}

# ================= API 接口区域 =================

# --- 1. 注册与登录 ---
@app.post("/register")
def register(user: UserCreate):
    RESERVED = ["admin", "root", "system", "support", "hexcoach"]
    clean_name = user.username.lower().strip()
    
    if clean_name in RESERVED or "admin" in clean_name:
        raise HTTPException(status_code=400, detail="该用户名包含保留字")
        
    if db.users.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="用户名已存在")
        
    hashed_pw = get_password_hash(user.password)
    new_user = {
        "username": user.username,
        "password": hashed_pw,
        "role": "user",
        "created_at": datetime.datetime.utcnow(),
        "last_analysis_time": None
    }
    db.users.insert_one(new_user)
    return {"status": "success", "msg": "注册成功"}

@app.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user['password']):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
        
    access_token = create_access_token(data={"sub": user['username'], "role": user.get("role", "user")})
    return {"access_token": access_token, "token_type": "bearer", "username": user['username']}

# --- 2. 绝活社区 (Tip Community) - 已恢复 ---

@app.get("/tips")
def get_tips(hero: Optional[str] = None, enemy: Optional[str] = None, limit: int = 50):
    """获取绝活列表，支持按英雄筛选"""
    query = {}
    if hero: query["hero"] = hero
    if enemy and enemy != "None": query["enemy"] = enemy
    
    # 按点赞数倒序
    cursor = db.tips.find(query).sort("likes", -1).limit(limit)
    
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results

@app.post("/tips")
def add_tip(data: TipInput, current_user: dict = Depends(get_current_user)):
    """发布新 Tip"""
    new_tip = {
        "hero": data.hero,
        "enemy": data.enemy,
        "content": data.content,
        "is_general": data.is_general,
        "author": current_user["username"],
        "likes": 0,
        "liked_by": [],
        "created_at": datetime.datetime.utcnow()
    }
    db.tips.insert_one(new_tip)
    return {"status": "success"}

@app.post("/like")
def like_tip(data: LikeInput, current_user: dict = Depends(get_current_user)):
    """点赞/取消点赞"""
    try:
        oid = ObjectId(data.tip_id)
    except:
        raise HTTPException(status_code=400, detail="ID格式错误")
        
    tip = db.tips.find_one({"_id": oid})
    if not tip:
        raise HTTPException(status_code=404, detail="Tip不存在")
        
    username = current_user['username']
    if username in tip.get('liked_by', []):
        # 取消点赞
        db.tips.update_one({"_id": oid}, {"$inc": {"likes": -1}, "$pull": {"liked_by": username}})
    else:
        # 点赞
        db.tips.update_one({"_id": oid}, {"$inc": {"likes": 1}, "$push": {"liked_by": username}})
    
    return {"status": "success"}

@app.delete("/tips/{tip_id}")
def delete_tip(tip_id: str, current_user: dict = Depends(get_current_user)):
    """删除 Tip (仅作者或管理员)"""
    try:
        oid = ObjectId(tip_id)
    except:
        raise HTTPException(status_code=400, detail="ID格式错误")
        
    tip = db.tips.find_one({"_id": oid})
    if not tip:
        raise HTTPException(status_code=404, detail="Tip不存在")
        
    is_admin = current_user.get('role') == 'admin' or current_user['username'] in ["admin", "root", "keonsuyun"]
    is_author = tip.get('author') == current_user['username']
    
    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="无权删除")
        
    db.tips.delete_one({"_id": oid})
    return {"status": "success"}

# --- 3. AI 分析接口 (集成新数据源 + 智能分路 + 防刷) ---

@app.post("/analyze")
async def analyze_match(data: AnalyzeRequest, current_user: dict = Depends(get_current_user)):
    # 🛡️ 1. API Key 检查
    if not DEEPSEEK_API_KEY:
         def err(): yield json.dumps({"concise": {"title":"配置错误", "content":"服务端未配置 API Key"}})
         return StreamingResponse(err(), media_type="application/json")

    # 🛡️ 2. 60秒冷却检查
    last_time = current_user.get("last_analysis_time")
    now = datetime.datetime.utcnow()
    if last_time:
        if isinstance(last_time, str): last_time = datetime.datetime.fromisoformat(last_time)
        delta = (now - last_time).total_seconds()
        if delta < 60:
            remaining = int(60 - delta)
            def cooldown_err(): 
                yield json.dumps({"concise": {"title": "技能冷却中", "content": f"请休息 {remaining} 秒后再提问！"}})
            return StreamingResponse(cooldown_err(), media_type="application/json")
    
    # 更新时间
    db.users.update_one({"username": current_user['username']}, {"$set": {"last_analysis_time": now}})

    # ================= 数据准备 =================
    
    # 1. 智能推断分路 (使用你保留的逻辑)
    my_roles_map = infer_team_roles(data.myTeam, data.myLaneAssignments)
    enemy_roles_map = infer_team_roles(data.enemyTeam, data.enemyLaneAssignments)
    
    # 确定用户位置
    user_role_key = data.userRole.upper() if data.userRole else "MID"
    # 如果没传位置但选了英雄，尝试反推
    if not data.userRole and data.myHero:
        for r, h in my_roles_map.items():
            if h == data.myHero: user_role_key = r; break
            
    # 确定对位英雄
    primary_enemy = enemy_roles_map.get(user_role_key, "Unknown")
    if primary_enemy == "Unknown" and data.enemyHero:
        primary_enemy = data.enemyHero

    # 2. 读取 S15 机制 (使用新的智能格式化器)
    s15_doc = db.constants.find_one({"_id": "s15_details"})
    s15_context_text = smart_context_formatter(s15_doc)

    # 3. 读取英雄数据
    hero_doc = db.champions.find_one({"id": data.myHero})
    hero_info_text = ""
    if hero_doc:
        hero_info_text = f"""
        【我方英雄: {hero_doc.get('name', data.myHero)}】
        - 定位: {hero_doc.get('role', '未知')}
        - 梯队: {hero_doc.get('tier', '未知')}
        - 标签: {', '.join(hero_doc.get('tags', []))}
        """
    else:
        hero_info_text = f"【我方英雄】: {data.myHero} (暂无详细数据)"

    # 4. 读取 Prompt 模板 (假设你在 prompts.json 里定义了 coach_system)
    prompt_doc = db.prompts.find_one({"_id": "coach_system"})
    base_prompt = prompt_doc['content'] if prompt_doc else "你是一个专业的LOL S15 教练。"

    # 5. 组装 System Prompt
    final_system_message = f"""
    {base_prompt}
    
    {s15_context_text}
    
    {hero_info_text}
    """

    # 6. 组装 User Input
    user_input_message = f"""
    模式: {data.mode}
    我方阵容: {', '.join([f'{k}:{v}' for k,v in my_roles_map.items()])}
    敌方阵容: {', '.join([f'{k}:{v}' for k,v in enemy_roles_map.items()])}
    我的英雄: {data.myHero} (位置: {user_role_key})
    对位英雄: {primary_enemy}
    """

    # ================= AI 调用 (流式) =================
    client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

    async def generate_stream():
        try:
            stream = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": final_system_message},
                    {"role": "user", "content": user_input_message}
                ],
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            print(f"AI Error: {e}")
            yield json.dumps({"concise": {"title": "API Error", "content": "AI 服务连接失败，请检查 Key 或网络"}})

    return StreamingResponse(generate_stream(), media_type="application/json")

# --- 4. 反馈与管理 ---

@app.post("/feedback")
def submit_feedback(data: FeedbackInput, current_user: dict = Depends(get_current_user)):
    """用户提交反馈"""
    doc = {
        "user_id": current_user['username'],
        "description": data.description,
        "match_context": data.match_context,
        "created_at": datetime.datetime.utcnow(),
        "status": "pending"
    }
    db.feedback.insert_one(doc)
    return {"status": "success", "msg": "反馈已提交"}

@app.get("/admin/feedbacks")
def get_admin_feedbacks(current_user: dict = Depends(get_current_user)):
    """管理员查看反馈"""
    ADMINS = ["admin", "root", "keonsuyun", "HexCoach"]
    if current_user.get('role') != 'admin' and current_user['username'] not in ADMINS:
        raise HTTPException(status_code=403, detail="权限不足")
    
    cursor = db.feedback.find().sort("created_at", -1).limit(50)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results

# ================= 静态文件托管 (Docker/Sealos 部署用) =================
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        # 排除 API 路径，避免 404 被前端路由捕获
        if any(full_path.startswith(prefix) for prefix in ["api", "tips", "token", "register", "analyze", "feedback"]):
            raise HTTPException(status_code=404)
        return FileResponse("frontend/dist/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)