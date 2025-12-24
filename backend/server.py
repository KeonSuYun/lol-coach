import os
import json
import uvicorn
import datetime
from pathlib import Path
from dotenv import load_dotenv
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

# ================= 🔧 强制加载根目录 .env =================
# 1. 获取 server.py 所在的目录 (即 backend)
current_dir = Path(__file__).resolve().parent
# 2. 获取根目录
root_dir = current_dir.parent
# 3. 拼接出 .env 的绝对路径
env_path = root_dir / '.env'
# 4. 加载指定路径的 .env
load_dotenv(dotenv_path=env_path)

# ================= 🛡️ 安全配置 =================
# 1. 强制从环境变量读取 SECRET_KEY
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    print("⚠️ 警告: 未检测到 SECRET_KEY 环境变量！")
    # 如果是生产环境，建议抛出异常阻止启动
    # raise ValueError("❌ 严重错误: 生产环境必须配置 SECRET_KEY 环境变量！")
    print("⚠️ 开发模式使用临时密钥 (切勿用于生产)")
    SECRET_KEY = "dev_secret_key_change_me_immediately"

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

# 挂载静态资源 (确保 dist 目录存在，用于前端页面托管)
if os.path.exists("frontend/dist/assets"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# 🟢 2. 限制 CORS (跨域资源共享)
ORIGINS = [
    "http://localhost:5173",             # 本地前端开发端口
    "http://127.0.0.1:5173",             # 本地前端开发端口
    "https://kozzbluxklwn.sealosbja.site" # 🟢 你的生产环境前端域名
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
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
    
    # ✨ 核心升级：接收分路修正 + 模型选择
    myLaneAssignments: Optional[Dict[str, str]] = None 
    enemyLaneAssignments: Optional[Dict[str, str]] = None
    model_type: str = "chat" # 默认 V3 (chat)，可选 "reasoner" (R1)

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
    优先使用 fixed_assignments (用户手动修正或LCU提供的数据)。
    """
    if not team_list:
        return {}
        
    # 标准位置定义
    standard_roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]
    
    # 1. 初始化结果，先填入确定的位置
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
        hero_info = getattr(db, 'get_champion_info', lambda x: None)(hero)
        
        pref_role = hero_info.get('role', 'mid').upper() if hero_info else "MID"
        
        # 映射数据库的 role 到标准 role
        role_map = {
            "TOP": "TOP", "JUNGLE": "JUNGLE", "MID": "MID", 
            "ADC": "ADC", "BOTTOM": "ADC", "SUPPORT": "SUPPORT", "SUP": "SUPPORT"
        }
        target = role_map.get(pref_role, "MID")

        # 如果该位置是空的 (Unknown)，就填进去
        if final_roles[target] == "Unknown":
            final_roles[target] = hero
        else:
            # 如果位置被占了，暂时先找一个空位填进去
            for r in standard_roles:
                if final_roles[r] == "Unknown":
                    final_roles[r] = hero
                    break
    
    # 清理掉还是 Unknown 的位置
    return {k: v for k, v in final_roles.items() if v != "Unknown"}

# ================= 🔧 通用清洗工具 =================

def dynamic_context_formatter(doc):
    """
    🔥 万能清洗器：动态读取数据库文档里的 data_modules
    以后你加新的反馈、新的绝活、新的版本改动，只要 JSON 格式对，这里自动适配。
    """
    if not doc or "data_modules" not in doc:
        return ""

    prompt_lines = []
    
    # 遍历所有模块
    for module_key, module_data in doc["data_modules"].items():
        title = module_data.get("title", module_key)
        prompt_lines.append(f"\n### {title}")
        
        items = module_data.get("items", [])
        for item in items:
            name = item.get("name", "未命名技巧")
            rule = item.get("rule", "")
            note = item.get("note", "")
            
            line = f"- **{name}**: {rule}"
            if note:
                line += f" (💡 注意: {note})"
            prompt_lines.append(line)

    return "\n".join(prompt_lines)

# ================= 🚀 API 接口 =================

@app.get("/")
def health_check():
    return {"status": "DeepCoach Backend Running", "version": "S15.SDK.Final"}

# --- 1. 注册与登录 ---

@app.post("/register")
def register(user: UserCreate):
    RESERVED_USERNAMES = ["admin", "root", "system", "hexcoach", "gm", "master"]
    clean_username = user.username.lower().strip()
    
    if clean_username in RESERVED_USERNAMES or "admin" in clean_username:
        raise HTTPException(status_code=400, detail="该用户名包含保留字，无法注册")

    hashed_pw = get_password_hash(user.password)
    # 创建用户 (默认为 user 角色)
    if db.create_user(user.username, hashed_pw, role="user"):
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
    
    # 权限检查：作者本人 或 管理员
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

# --- 4. AI 分析 (核心业务) ---

@app.post("/analyze")
async def analyze_match(data: AnalyzeRequest, current_user: dict = Depends(get_current_user)): 
    # 🛡️ 1. 检查 API Key
    if not DEEPSEEK_API_KEY:
         def err(): yield json.dumps({"concise": {"title":"配置错误", "content":"服务端未配置 API Key"}})
         return StreamingResponse(err(), media_type="application/json")

    # 🛡️ 2. 频控检查 (15秒CD + 分栏目)
    allowed, msg, remaining = db.check_and_update_usage(current_user['username'], data.mode)
    
    if not allowed:
        # 如果被拒绝，返回特定错误
        def limit_err(): 
            yield json.dumps({
                "concise": {
                    "title": "请求被拒绝", 
                    "content": msg + ("\n💡 升级 VIP 可解锁无限次使用！" if remaining == -1 else "")
                }
            })
        return StreamingResponse(limit_err(), media_type="application/json")

    # ==========================================
    # 3. 基础 S15 数据获取
    # ==========================================
    game_constants = db.get_game_constants()
    s15_context = f"""
    ### S15 核心环境数据
    - 虚空巢虫: {game_constants.get('void_grubs_spawn')} (每波数量: {game_constants.get('void_grubs_count')})
    - Atakhan: {game_constants.get('atakhan_spawn')}
    - 版本特性: {game_constants.get('patch_notes')}
    """

    # ==========================================
    # 4. 🚀 智能位置识别逻辑 (使用前端传来的 assignments)
    # ==========================================
    
    # A. 计算我方分路 (传入前端整理好的 myLaneAssignments)
    my_roles_map = infer_team_roles(data.myTeam, data.myLaneAssignments)
    
    # B. 计算敌方分路 (传入 enemyLaneAssignments)
    enemy_roles_map = infer_team_roles(data.enemyTeam, data.enemyLaneAssignments)

    # C. 确定用户自己的位置
    user_role_key = "MID" 
    
    # 优先信任前端明确传来的 userRole (LCU读取的)
    if data.userRole and data.userRole.upper() in ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]:
        user_role_key = data.userRole.upper()
    # 兜底：如果 userRole 没传，尝试从 myHero 推断
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
    # 5. 知识库检索 (RAG)
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
    # 6. Prompt 模板获取
    # ==========================================
    target_mode = data.mode 
    hero_tier_info = ""

    if data.mode == "personal":
        if not data.myHero:
            def error_gen(): yield json.dumps({"concise": {"title": "缺少信息", "content": "请先选择你的英雄！"}})
            return StreamingResponse(error_gen(), media_type="application/json")

        hero_info = getattr(db, 'get_champion_info', lambda x: None)(data.myHero)
        if hero_info:
            hero_tier_info = f"- 英雄强度情报: {data.myHero} 当前版本评级为 {hero_info.get('tier', '未知')}，主定位 {hero_info.get('role')}。"

        if user_role_key == "JUNGLE":
            target_mode = "personal_jungle"
        else:
            target_mode = "personal_lane"
        
        if hero_tier_info:
            s15_context += f"\n{hero_tier_info}"

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
            enemyHero=primary_enemy,   
            userRole=user_role_key,    
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
    # 7. 调用 OpenAI SDK (动态切换模型)
    # ==========================================
    # 🔥 根据前端参数切换模型
    if data.model_type == "reasoner":
        MODEL_NAME = "deepseek-reasoner" # R1
        print(f"🧠 [AI] 用户 {current_user['username']} 启用思考模式 (R1)")
    else:
        MODEL_NAME = "deepseek-chat"     # V3
        print(f"🚀 [AI] 用户 {current_user['username']} 使用极速模式 (V3)")

    def event_stream():
        try:
            print(f"🔄 [AI SDK] Requesting {MODEL_NAME} for {user_role_key} {data.myHero}...")
            
            stream = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_content}
                ],
                stream=True, 
                temperature=0.6,
                max_tokens=4000
            )

            for chunk in stream:
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        yield delta.content
                    
        except APIError as e:
            print(f"❌ [AI SDK Error] {e}")
            yield json.dumps({"concise": {"title": "API 错误", "content": str(e.message)}})
        except Exception as e:
            print(f"❌ [Server Error] {e}")
            yield json.dumps({"concise": {"title": "系统异常", "content": str(e)}})

    return StreamingResponse(event_stream(), media_type="text/plain")

# ================= 🛡️ 管理员后台接口 =================

@app.get("/admin/feedbacks")
def get_admin_feedbacks(current_user: dict = Depends(get_current_user)):
    """
    获取用户反馈列表。
    🔒 安全机制：双重验证 (DB Role + Hardcoded Whitelist)
    """
    is_db_admin = current_user.get("role") == "admin"
    SUPER_ADMINS = ["admin", "root", "keonsuyun", "HexCoach"] 
    is_super_admin = current_user["username"] in SUPER_ADMINS
    
    if not (is_db_admin or is_super_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="权限不足：仅管理员可访问此数据"
        )

    feedbacks = db.get_all_feedbacks()
    return feedbacks

# 2. 任何其他路径都返回 index.html (让 React 路由生效)
@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    if os.path.exists("frontend/dist/index.html"):
        return FileResponse("frontend/dist/index.html")
    return {"error": "Frontend build not found. Please run 'npm run build' in frontend folder."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)