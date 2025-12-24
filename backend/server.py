import os
import json
import uvicorn
import datetime
from typing import List, Optional, Dict
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ✨ 引入官方 SDK (简化调用，提升稳定性)
from openai import OpenAI, APIError

# 🔐 安全库
from passlib.context import CryptContext
from jose import JWTError, jwt

# 引入数据库逻辑
from core.database import KnowledgeBase

# ================= 配置 =================
SECRET_KEY = os.getenv("SECRET_KEY", "hexcoach_secret_key_change_me_please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token 7天过期
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")

# ✨ 初始化 OpenAI 客户端 (适配 DeepSeek)
client = OpenAI(
    api_key=DEEPSEEK_API_KEY, 
    base_url="https://api.deepseek.com"
)

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
    userRole: str = "" # 用户手动选的位置 (兼容旧版)
    
    # ✨ 明确的分路信息 (字典格式: {"TOP": "Aatrox", "JUNGLE": "Lee Sin"})
    # 前端如果有确定的数据 (LCU 或 用户手动修正)，传这两个字段
    myLaneAssignments: Optional[Dict[str, str]] = None 
    enemyLaneAssignments: Optional[Dict[str, str]] = None

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

# ================= 🧠 智能分路算法 (Helper) =================

def infer_team_roles(team_list: List[str], fixed_assignments: Optional[Dict[str, str]] = None):
    """
    根据英雄列表和数据库信息，推断每条路是谁。
    优先使用 fixed_assignments (用户手动修正的数据)。
    """
    if not team_list:
        return {}
        
    # 标准位置定义
    standard_roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]
    
    # 1. 初始化结果，先填入用户锁定的位置 (Manual Override)
    final_roles = {role: "Unknown" for role in standard_roles}
    assigned_heroes = set()

    if fixed_assignments:
        for role, hero in fixed_assignments.items():
            role_upper = role.upper()
            # 简单校验：该位置有效 且 英雄确实在队伍里
            if role_upper in standard_roles and hero in team_list:
                final_roles[role_upper] = hero
                assigned_heroes.add(hero)
    
    # 2. 找出还未分配的英雄
    remaining_heroes = [h for h in team_list if h not in assigned_heroes]
    
    # 3. 遍历未分配的英雄，查库进行“填空” (简单的贪心算法)
    for hero in remaining_heroes:
        # 查库获取英雄首选位置
        # 注意：这里安全调用 db.get_champion_info，防止方法不存在报错
        hero_info = getattr(db, 'get_champion_info', lambda x: None)(hero)
        
        pref_role = hero_info.get('role', 'mid').upper() if hero_info else "MID"
        
        # 映射数据库的 role 到标准 role (防止叫法不一致)
        role_map = {
            "TOP": "TOP", "JUNGLE": "JUNGLE", "MID": "MID", 
            "ADC": "ADC", "BOTTOM": "ADC", "SUPPORT": "SUPPORT", "SUP": "SUPPORT"
        }
        target = role_map.get(pref_role, "MID")

        # 如果该位置是空的 (Unknown)，就填进去
        if final_roles[target] == "Unknown":
            final_roles[target] = hero
        else:
            # 如果位置被占了 (比如两个中单)，暂时先找一个空位填进去 (兜底策略)
            for r in standard_roles:
                if final_roles[r] == "Unknown":
                    final_roles[r] = hero
                    break
    
    # 清理掉还是 Unknown 的位置
    return {k: v for k, v in final_roles.items() if v != "Unknown"}

# ================= 🚀 接口 API =================

@app.get("/")
def health_check():
    return {"status": "DeepCoach Backend Running", "version": "S15.SDK.Final"}

# --- 1. 注册与登录 ---

@app.post("/register")
def register(user: UserCreate):
    # 🚫 1. 定义保留字黑名单 (全部转小写比较)
    RESERVED_USERNAMES = [
        "admin", "administrator", "root", "system", "superuser", 
        "support", "official", "hexcoach", "gm", "master"
    ]
    
    # 🛡️ 2. 检查用户名是否违规
    clean_username = user.username.lower().strip()
    
    # 检查是否在黑名单中
    if clean_username in RESERVED_USERNAMES:
        raise HTTPException(
            status_code=400, 
            detail="该用户名包含保留字，无法注册"
        )
        
    # 检查是否包含 "admin" 字样 (防止 admin123 这种)
    if "admin" in clean_username:
        raise HTTPException(
            status_code=400, 
            detail="用户名不能包含 'admin' 字样"
        )
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

# --- 2. 绝活社区 ---

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
    raise HTTPException(status_code=400, detail="点赞失败或已点过")

@app.delete("/tips/{tip_id}")
def delete_tip_endpoint(tip_id: str, current_user: dict = Depends(get_current_user)):
    tip = db.get_tip_by_id(tip_id)
    if not tip:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    is_admin = current_user.get('role') == 'admin' or current_user['username'] in ["admin", "root", "keonsuyun"]

    if tip['author_id'] != current_user['username'] and not is_admin:
        raise HTTPException(status_code=403, detail="你没有权限删除这条评论")
    
    if db.delete_tip(tip_id):
        return {"status": "success", "msg": "删除成功"}
    
    raise HTTPException(status_code=500, detail="删除失败")

# --- 3. 错误反馈 ---

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

# --- 4. AI 分析 (深度思考 R1 模式 - SDK 流式增强版) ---

@app.post("/analyze")
async def analyze_match(data: AnalyzeRequest):
    # ==========================================
    # 1. 基础 S15 数据获取与环境构建
    # ==========================================
    game_constants = db.get_game_constants()
    
    s15_context = f"""
    ### S15 核心环境数据
    - 虚空巢虫: {game_constants.get('void_grubs_spawn')} (每波数量: {game_constants.get('void_grubs_count')})
    - Atakhan: {game_constants.get('atakhan_spawn')}
    - 版本特性: {game_constants.get('patch_notes')}
    """

    # ==========================================
    # 2. 🚀 智能位置识别逻辑 (Core Logic)
    # ==========================================
    
    # A. 计算我方分路
    my_roles_map = infer_team_roles(data.myTeam, data.myLaneAssignments)
    
    # B. 计算敌方分路
    enemy_roles_map = infer_team_roles(data.enemyTeam, data.enemyLaneAssignments)

    # C. 确定用户自己的位置
    user_role_key = "MID" 
    
    if data.userRole and data.userRole.upper() in ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]:
        user_role_key = data.userRole.upper()
    elif data.myHero:
        for r, h in my_roles_map.items():
            if h == data.myHero:
                user_role_key = r
                break

    # D. 确定我的对位英雄
    primary_enemy = enemy_roles_map.get(user_role_key, "Unknown")
    
    if primary_enemy == "Unknown" and data.enemyHero:
        primary_enemy = data.enemyHero

    # E. 构建上下文数据
    bot_lane_context = ""
    if user_role_key in ["ADC", "SUPPORT", "BOTTOM"]:
        bot_lane_context = "【双人路特别提示】请特别关注我方辅助与ADC的技能配合，以及对线期谁更有线权。"

    def format_roles(role_map):
        return " | ".join([f"{k}: {v}" for k, v in role_map.items() if v != "Unknown"])

    my_team_str = format_roles(my_roles_map)
    enemy_team_str = format_roles(enemy_roles_map)

    # ==========================================
    # 3. 知识库检索 (RAG)
    # ==========================================
    top_tips = []
    corrections = []
    
    if data.myHero:
        knowledge = db.get_top_knowledge_for_ai(data.myHero, primary_enemy)
        top_tips = knowledge.get("matchup", []) + knowledge.get("general", [])
        corrections = db.get_corrections(data.myHero, primary_enemy)

    tips_text = "\n".join([f"- 社区心得: {t}" for t in top_tips]) if top_tips else "(暂无)"
    
    correction_prompt = ""
    if corrections:
        c_list = "\n".join([f"🔴 修正规则: {c}" for c in corrections])
        correction_prompt = f"【已知错误修正】AI历史回答曾犯错，请务必遵守：\n{c_list}"

    # ==========================================
    # 4. 角色与 Prompt 模式选择
    # ==========================================
    target_mode = data.mode 
    hero_tier_info = ""

    if data.mode == "personal":
        if not data.myHero:
            def error_gen(): yield json.dumps({"concise": {"title": "缺少信息", "content": "请先选择你的英雄！"}})
            return StreamingResponse(error_gen(), media_type="application/json")

        hero_info = getattr(db, 'get_champion_info', lambda x: None)(data.myHero)
        if hero_info:
            print(f"📘 [DB] 英雄命中: {hero_info['name']} (定位: {hero_info['role']}, Tier: {hero_info['tier']})")
            hero_tier_info = f"- 英雄强度情报: {data.myHero} 当前版本评级为 {hero_info.get('tier', '未知')}，主定位 {hero_info.get('role')}。"

        if user_role_key == "JUNGLE":
            target_mode = "personal_jungle"
        else:
            target_mode = "personal_lane"
        
        if hero_tier_info:
            s15_context += f"\n{hero_tier_info}"

    # ==========================================
    # 5. Prompt 模板获取与动态注入
    # ==========================================
    template_doc = db.get_prompt_template(target_mode)
    
    if not template_doc:
        def error_gen(): yield json.dumps({
            "concise": {"title": "配置缺失", "content": f"未找到模式 [{target_mode}] 的提示词模板。"}, 
            "detailed_tabs": [{"title": "系统提示", "content": "请管理员运行 `seed_data.py` 初始化 Prompt 库。"}]
        })
        return StreamingResponse(error_gen(), media_type="application/json")

    try:
        user_content = template_doc['user_template'].format(
            mode=data.mode,
            myTeam=f"{my_team_str} (原始: {str(data.myTeam)})",
            enemyTeam=f"{enemy_team_str} (原始: {str(data.enemyTeam)})",
            myHero=data.myHero,
            enemyHero=primary_enemy,   # ✨ 传入智能计算后的对位英雄
            userRole=user_role_key,    # ✨ 传入智能计算后的位置
            s15_context=s15_context,
            bot_lane_context=bot_lane_context,
            tips_text=tips_text,
            correction_prompt=correction_prompt
        )
        
        system_content = template_doc['system_template'] + """ Output JSON only: {"concise": {"title": "...", "content": "..."}, "detailed_tabs": [{"title": "...", "content": "..."}]}"""

    except KeyError as e:
        def error_gen(): yield json.dumps({"concise": {"title": "模板渲染错误", "content": f"Prompt 模板中缺少变量占位符: {e}"}})
        return StreamingResponse(error_gen(), media_type="application/json")

    # ==========================================
    # 6. 调用 OpenAI SDK (核心修改)
    # ==========================================
    if not DEEPSEEK_API_KEY: 
        def error_gen(): yield json.dumps({"concise": {"title": "API Key Missing", "content": "No API Key configured in env."}})
        return StreamingResponse(error_gen(), media_type="application/json")

    # 你可以在这里切换 "deepseek-chat" (V3) 或 "deepseek-reasoner" (R1)
    # 建议先用 chat 调试，稳定后再换 reasoner
    MODEL_NAME = "deepseek-chat" 

    def event_stream():
        try:
            print(f"🔄 [AI SDK] Requesting {MODEL_NAME} for {user_role_key} {data.myHero}...")
            
            # ✨ 使用官方 SDK 的 stream 功能
            stream = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_content}
                ],
                stream=True, # 开启流式
                temperature=0.6,
                max_tokens=4000
            )

            print("✅ [AI SDK] Stream started.")

            for chunk in stream:
                # 🛡️ 安全获取 delta 对象
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    
                    # 🟢 只提取 content (忽略 reasoning_content)
                    # 这样即使你将来切到 R1 模型，这里也会自动过滤掉思考过程
                    if delta.content:
                        print(delta.content, end="", flush=True)
                        yield delta.content
                    
        except APIError as e:
            print(f"❌ [AI SDK Error] {e}")
            yield json.dumps({"concise": {"title": "API 错误", "content": str(e.message)}})
        except Exception as e:
            print(f"❌ [Server Error] {e}")
            yield json.dumps({"concise": {"title": "系统异常", "content": str(e)}})

    # 返回流式响应
    return StreamingResponse(event_stream(), media_type="text/plain")

# backend/server.py

# ================= 🛡️ 管理员后台接口 =================

@app.get("/admin/feedbacks")
def get_admin_feedbacks(current_user: dict = Depends(get_current_user)):
    """
    获取用户反馈列表。
    🔒 安全机制：
    1. Depends(get_current_user): 确保请求头带了有效 Token
    2. 白名单检查: 确保用户名在管理员列表里
    """
    
    # ⚠️ 请务必把你的注册用户名填在这里！
    ADMIN_WHITELIST = ["admin", "root", "keonsuyun", "HexCoach"] 
    
    # 也可以扩展为检查数据库里的 role 字段
    is_admin = current_user.get('role') == 'admin' or current_user['username'] in ADMIN_WHITELIST
    
    if not is_admin:
        # 403 Forbidden: 哪怕你登录了，权限不够也不让看
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="权限不足：仅管理员可访问此数据"
        )

    # 只有通过验证才会执行查库
    feedbacks = db.get_all_feedbacks()
    return feedbacks

app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# 2. 任何其他路径都返回 index.html (让 React 路由生效)
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    return FileResponse("frontend/dist/index.html")
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)