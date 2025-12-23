import os
import json
import requests  # 用于调用 DeepSeek
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import uvicorn

# 引入数据库逻辑
from core.database import KnowledgeBase

app = FastAPI()
db = KnowledgeBase()

# 🟢 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 🧠 S15 核心知识库 (从 Laf 搬过来的秘密数据)
# ==========================================
GAME_CONSTANTS = {
    "void_grubs_spawn": "6:00",
    "void_grubs_count": "3 (每波)",
    "rift_herald_spawn": "14:00",
    "atakhan_spawn": "20:00",
    "patch_notes": "S15赛季: 虚空巢虫提供推塔真实伤害，Atakhan 会根据优势方自动在中路或下路生成。"
}

# ==========================================
# 📝 数据模型定义
# ==========================================

class TipInput(BaseModel):
    hero: str
    enemy: str
    content: str
    author_id: str
    is_general: bool

class LikeInput(BaseModel):
    tip_id: str
    user_id: str

# 定义前端发给 AI 的请求格式
class AnalyzeRequest(BaseModel):
    mode: str  # 'bp', 'personal', 'team'
    myHero: str = ""
    enemyHero: str = ""
    myTeam: List[str] = []
    enemyTeam: List[str] = []
    userRole: str = "TOP"

# ==========================================
# 🚀 核心接口 API
# ==========================================

@app.get("/")
def health_check():
    return {"status": "DeepCoach Backend is Running!", "version": "S15.1"}

# --- 1. 绝活社区接口 ---

@app.get("/tips")
def get_tips(hero: str, enemy: str = "None", is_general: bool = False):
    return db.get_tips_for_ui(hero, enemy, is_general)

@app.post("/tips")
def add_tip(data: TipInput):
    db.add_tip(data.hero, data.enemy, data.content, data.author_id, data.is_general)
    return {"status": "success"}

@app.post("/like")
def like_tip(data: LikeInput):
    if db.toggle_like(data.tip_id, data.user_id):
        return {"status": "success"}
    raise HTTPException(status_code=400, detail="Error")

# --- 2. AI 分析接口 (替代 Laf) ---

@app.post("/analyze")
def analyze_match(data: AnalyzeRequest):
    """
    这里是整个应用的'大脑'。
    1. 自动去数据库拉取绝活建议。
    2. 结合 S15 数据构建 Prompt。
    3. 调用 DeepSeek API。
    """
    
    # 1. 自动从数据库获取“绝活哥”的建议 (注入到 Prompt 里)
    top_tips = []
    if data.myHero:
        knowledge = db.get_top_knowledge_for_ai(data.myHero, data.enemyHero)
        top_tips = knowledge.get("matchup", []) + knowledge.get("general", [])
    
    tips_context = "\n".join([f"- 社区绝活: {t}" for t in top_tips[:3]]) if top_tips else "- (暂无社区绝活，请发挥你的通用理解)"

    # 2. 构建 Prompt (把 Laf 里的逻辑搬过来)
    system_role = ""
    user_instruction = ""
    
    # 这一段是给 AI 的“格式红线”，保证前端能渲染
    json_rule = """
    Output Format: JSON Only. No markdown fence.
    Structure: { 
        "concise": {"title": "String", "content": "String"}, 
        "detailed_tabs": [{"title": "String", "content": "Markdown String"}] 
    }
    """

    s15_context = f"""
    ### S15 核心机制 (必须遵守)
    - 巢虫刷新: {GAME_CONSTANTS['void_grubs_spawn']} (数量: {GAME_CONSTANTS['void_grubs_count']})
    - 先锋: {GAME_CONSTANTS['rift_herald_spawn']}
    - Atakhan: {GAME_CONSTANTS['atakhan_spawn']}
    """

    if data.mode == 'bp':
        system_role = "你是一名 LPL 职业战队的 BP 教练。风格冷静、毒舌。"
        user_instruction = f"""
        我方: {data.myTeam}
        敌方: {data.enemyTeam}
        请推荐 3 个英雄并分析优劣。
        {s15_context}
        """
        
    elif data.mode == 'personal':
        system_role = f"你是国服第一 {data.myHero}，说话极其口语化、带梗、像好兄弟。"
        user_instruction = f"""
        我玩: {data.myHero} ({data.userRole})。
        对位: {data.enemyHero}。
        
        【必须整合以下绝活哥经验】:
        {tips_context}

        {s15_context}
        请重点讲对线细节、几级强势、怎么打 {data.enemyHero}。
        不要讲废话，直接上干货。
        """
        
    else: # team
        system_role = "你是战队赛训总监。风格严肃，专注运营和资源置换。"
        user_instruction = f"""
        全局运营分析。
        我方: {data.myTeam}
        敌方: {data.enemyTeam}
        {s15_context}
        规划 6分钟巢虫团 和 20分钟 Atakhan 的决策。
        """

    # 3. 调用 DeepSeek (或 Sealos 的 AI 代理)
    # 注意：请确保你在 Sealos 的环境变量里配置了 DEEPSEEK_API_KEY
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        # 如果没有 Key，返回一个模拟数据防止报错 (本地调试用)
        return {
            "concise": {"title": "API Key 未配置", "content": "请在后端环境变量中配置 DEEPSEEK_API_KEY"},
            "detailed_tabs": [{"title": "错误", "content": "后端未检测到 Key"}]
        }

    try:
        response = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_role + "\n" + json_rule},
                    {"role": "user", "content": user_instruction}
                ],
                "temperature": 0.7,
                "stream": False
            },
            timeout=30 
        )
        
        # 4. 清洗数据
        res_json = response.json()
        content = res_json['choices'][0]['message']['content']
        
        # 去掉可能存在的 markdown 代码块符号
        content = content.replace("```json", "").replace("```", "").strip()
        
        return json.parse(content) if isinstance(content, str) else content

    except Exception as e:
        print(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail="AI分析失败，请稍后重试")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)