from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 引入我们刚才写的数据库逻辑
from core.database import KnowledgeBase

app = FastAPI()
db = KnowledgeBase()

# 🟢 允许跨域 (CORS)
# 这步非常重要！因为 React 运行在 5173 端口，Python 运行在 8000 端口
# 如果不加这个，浏览器会拦截请求。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源 (生产环境可以改为 ["http://localhost:5173"])
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 定义前端传过来的数据格式 ---
class TipInput(BaseModel):
    hero: str
    enemy: str
    content: str
    author_id: str
    is_general: bool

class LikeInput(BaseModel):
    tip_id: str
    user_id: str

# --- 接口 API ---

@app.get("/")
def health_check():
    return {"status": "DeepCoach Backend is Running!"}

@app.get("/tips")
def get_tips(hero: str, enemy: str = "None", is_general: bool = False):
    """获取绝活列表接口"""
    return db.get_tips_for_ui(hero, enemy, is_general)

@app.get("/ai-knowledge")
def get_ai_knowledge(hero: str, enemy: str):
    """获取给 AI 用的 Top3 数据"""
    return db.get_top_knowledge_for_ai(hero, enemy)

@app.post("/tips")
def add_tip(data: TipInput):
    """发布绝活接口"""
    db.add_tip(data.hero, data.enemy, data.content, data.author_id, data.is_general)
    return {"status": "success"}

@app.post("/like")
def like_tip(data: LikeInput):
    """点赞接口"""
    if db.toggle_like(data.tip_id, data.user_id):
        return {"status": "success"}
    raise HTTPException(status_code=400, detail="Already liked or Error")

@app.delete("/tips/{tip_id}")
def delete_tip(tip_id: str):
    """删除接口"""
    db.delete_tip(tip_id)
    return {"status": "deleted"}

if __name__ == "__main__":
    # 启动服务，监听 8000 端口
    uvicorn.run(app, host="0.0.0.0", port=8000)