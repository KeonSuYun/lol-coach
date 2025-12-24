import os
import json
import requests
import uvicorn
import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 🔐 安全库
from passlib.context import CryptContext
from jose import JWTError, jwt

# 引入数据库逻辑
from core.database import KnowledgeBase

# ================= 配置 =================
# ⚠️ 生产环境请务必修改 SECRET_KEY
SECRET_KEY = os.getenv("SECRET_KEY", "hexcoach_secret_key_change_me_please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token 7天过期

app = FastAPI()
db = KnowledgeBase()

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# OAuth2 方案
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 🟢 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= 模型定义 =================

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class TipInput(BaseModel):
    hero: str
    enemy: str
    content: str
    is_general: bool
    # author_id 不需要前端传，后端从 Token 解析

class LikeInput(BaseModel):
    tip_id: str
    # user_id 不需要前端传，后端从 Token 解析

class FeedbackInput(BaseModel):
    match_context: dict
    description: str

class AnalyzeRequest(BaseModel):
    mode: str
    myHero: str = ""
    enemyHero: str = ""
    myTeam: List[str] = []
    enemyTeam: List[str] = []
    userRole: str = "TOP"

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
    """验证 Token 并返回当前数据库中的 user 对象"""
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

# ================= 🚀 接口 API =================

@app.get("/")
def health_check():
    return {"status": "DeepCoach Backend Running", "version": "S15.Final"}

# --- 1. 注册与登录 ---

@app.post("/register")
def register(user: UserCreate):
    hashed_pw = get_password_hash(user.password)
    if db.create_user(user.username, hashed_pw):
        return {"status": "success", "msg": "注册成功，请登录"}
    raise HTTPException(status_code=400, detail="用户名已存在")

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

# --- 2. 绝活社区 (部分需登录) ---

@app.get("/tips")
def get_tips(hero: str, enemy: str = "None", is_general: bool = False):
    """公开接口：获取绝活列表"""
    return db.get_tips_for_ui(hero, enemy, is_general)

@app.post("/tips")
def add_tip(data: TipInput, current_user: dict = Depends(get_current_user)):
    """需登录：发布绝活"""
    db.add_tip(data.hero, data.enemy, data.content, current_user['username'], data.is_general)
    return {"status": "success"}

@app.post("/like")
def like_tip(data: LikeInput, current_user: dict = Depends(get_current_user)):
    """需登录：点赞"""
    if db.toggle_like(data.tip_id, current_user['username']):
        return {"status": "success"}
    raise HTTPException(status_code=400, detail="点赞失败或已点过")

@app.delete("/tips/{tip_id}")
def delete_tip_endpoint(tip_id: str, current_user: dict = Depends(get_current_user)):
    """
    需登录：删除评论
    权限: 只有 '作者本人' 或 '管理员'
    """
    tip = db.get_tip_by_id(tip_id)
    if not tip:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 简单的管理员判断 (实际可扩展 role 字段)
    is_admin = current_user.get('role') == 'admin' or current_user['username'] in ["admin", "root", "keonsuyun"]

    if tip['author_id'] != current_user['username'] and not is_admin:
        raise HTTPException(status_code=403, detail="你没有权限删除这条评论")
    
    if db.delete_tip(tip_id):
        return {"status": "success", "msg": "删除成功"}
    
    raise HTTPException(status_code=500, detail="删除失败")

# --- 3. 错误反馈 (需登录) ---

@app.post("/feedback")
def submit_feedback(data: FeedbackInput, current_user: dict = Depends(get_current_user)):
    try:
        feedback_entry = {
            "user_id": current_user['username'],
            "match_context": data.match_context,
            "description": data.description,
            "error_type": "user_report"
        }
        db.submit_feedback(feedback_entry)
        return {"status": "success", "msg": "反馈已提交"}
    except Exception as e:
        print(f"Feedback Error: {e}")
        raise HTTPException(status_code=500, detail="反馈提交失败")

# --- 4. AI 分析 (核心大脑) ---

@app.post("/analyze")
def analyze_match(data: AnalyzeRequest):
    # 1. 获取动态配置
    game_constants = db.get_game_constants()
    
    s15_context = f"""
    ### S15 核心环境数据
    - 虚空巢虫: {game_constants.get('void_grubs_spawn')}
    - Atakhan: {game_constants.get('atakhan_spawn')}
    - 版本特性: {game_constants.get('patch_notes')}
    """

    # 2. 获取知识库 (社区 + 纠错)
    top_tips = []
    corrections = []
    
    if data.myHero:
        # 绝活 Top 3
        knowledge = db.get_top_knowledge_for_ai(data.myHero, data.enemyHero)
        top_tips = knowledge.get("matchup", []) + knowledge.get("general", [])
        # 历史修正
        corrections = db.get_corrections(data.myHero, data.enemyHero)

    tips_text = "\n".join([f"- 玩家心得: {t}" for t in top_tips]) if top_tips else "(暂无)"
    
    correction_prompt = ""
    if corrections:
        c_list = "\n".join([f"🔴 修正规则: {c}" for c in corrections])
        correction_prompt = f"""
        【重要警告：历史错误修正库】
        AI 在以前的回答中曾犯过错误，已被管理员纠正。你必须无条件遵守以下规则，覆盖原有认知：
        {c_list}
        """

    # 3. 构建 Prompt
    system_role = "你是一名英雄联盟 S15 职业教练。"
    json_rule = """Output JSON only: {"concise": {"title": "...", "content": "..."}, "detailed_tabs": [{"title": "...", "content": "..."}]}"""
    
    user_instruction = f"""
    模式: {data.mode}
    我方: {data.myTeam} (我玩 {data.myHero})
    敌方: {data.enemyTeam}
    
    {s15_context}
    {correction_prompt}

    参考社区心得:
    {tips_text}
    
    请输出 JSON 分析结果。
    """

    # 4. 调用 DeepSeek
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key: 
        return {"concise": {"title": "Key Missing", "content": "No API Key configured."}}

    try:
        res = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_role + " " + json_rule},
                    {"role": "user", "content": user_instruction}
                ],
                "temperature": 0.7,
                "stream": False
            },
            timeout=30
        )
        content = res.json()['choices'][0]['message']['content']
        content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)
    except Exception as e:
        print(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail="AI分析服务异常")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)