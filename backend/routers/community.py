"""
社区功能路由模块

包含Wiki攻略、酒馆动态、评论系统等功能
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core.logger import logger
from .dependencies import get_current_user, get_author_name, db

# 创建路由器
router = APIRouter()


# ================= 数据模型 =================

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
    heroId: str
    image: Optional[str] = None


class WikiPostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class TavernPostUpdate(BaseModel):
    content: Optional[str] = None
    topic: Optional[str] = None
    image: Optional[str] = None


class CommentCreate(BaseModel):
    postId: str
    content: str


# ================= 路由处理函数 =================

@router.get("/community/posts")
def get_community_posts(heroId: str = None, category: str = None):
    """获取Wiki攻略列表"""
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


@router.post("/community/posts")
def publish_community_post(data: WikiPostCreate, current_user: dict = Depends(get_current_user)):
    """发布Wiki攻略"""
    display_name = get_author_name(current_user)

    post_data = {
        "title": data.title,
        "content": data.content,
        "category": data.category,
        "hero_id": data.heroId,
        "opponent_id": data.opponentId,
        "tags": data.tags,
        "author_id": str(current_user["_id"]),
        "author_name": display_name
    }
    new_post = db.create_wiki_post(post_data)

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


@router.put("/community/posts/{post_id}")
def update_community_post(post_id: str, data: WikiPostUpdate, current_user: dict = Depends(get_current_user)):
    """更新Wiki攻略"""
    post = db.get_wiki_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    # 权限检查:作者本人 OR 管理员
    is_author = str(post.get("author_id")) == str(current_user["_id"])
    is_admin = current_user.get("role") in ["admin", "root"]

    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="权限不足")

    updates = {k: v for k, v in data.dict().items() if v is not None}
    if db.update_wiki_post(post_id, updates):
        return {"status": "success", "msg": "攻略已更新"}
    raise HTTPException(status_code=500, detail="更新失败")


@router.delete("/community/posts/{post_id}")
def delete_community_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """删除Wiki攻略"""
    post = db.get_wiki_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    # 权限检查:管理员 或 作者本人
    is_admin = current_user.get("role") in ["admin", "root"]
    is_author = str(post.get("author_id")) == str(current_user["_id"])

    if not (is_admin or is_author):
        raise HTTPException(status_code=403, detail="权限不足")

    if db.delete_wiki_post(post_id):
        return {"status": "success", "msg": "攻略已删除"}
    raise HTTPException(status_code=500, detail="删除失败")


@router.get("/community/tavern")
def get_tavern_posts(topic: str = None):
    """获取酒馆动态列表"""
    raw_posts = db.get_tavern_posts(topic=topic)
    return [
        {
            "id": p["id"],
            "author": p.get("author_name", "酒馆路人"),
            "avatar": p.get("avatar_hero", "Teemo"),
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


@router.post("/community/tavern")
def publish_tavern_post(data: TavernPostCreate, current_user: dict = Depends(get_current_user)):
    """发布酒馆动态"""
    # 获取英雄别名作为头像
    hero_info = db.get_champion_info(data.heroId)
    avatar_alias = hero_info.get("alias", "Teemo") if hero_info else "Teemo"

    display_name = get_author_name(current_user)

    post_data = {
        "content": data.content,
        "topic": data.topic,
        "hero_id": data.heroId,
        "avatar_hero": avatar_alias,
        "image": data.image,
        "author_id": str(current_user["_id"]),
        "author_name": display_name
    }
    new_post = db.create_tavern_post(post_data)

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


@router.put("/community/tavern/{post_id}")
def update_tavern_post(post_id: str, data: TavernPostUpdate, current_user: dict = Depends(get_current_user)):
    """更新酒馆动态"""
    post = db.get_tavern_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    # 权限逻辑:作者本人 OR 管理员
    is_author = str(post.get("author_id")) == str(current_user["_id"])
    is_admin = current_user.get("role") in ["admin", "root"]

    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="权限不足,只能编辑自己的动态")

    updates = {k: v for k, v in data.dict().items() if v is not None}
    if db.update_tavern_post(post_id, updates):
        return {"status": "success", "msg": "动态已更新"}
    raise HTTPException(status_code=500, detail="更新失败")


@router.delete("/community/tavern/{post_id}")
def delete_tavern_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """删除酒馆动态"""
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


@router.get("/community/wiki/{hero_id}")
def get_wiki_summary_endpoint(hero_id: str):
    """获取英雄Wiki摘要"""
    summary = db.get_wiki_summary(hero_id)
    if not summary:
        return {
            "overview": "暂无该英雄的详细百科数据,快来贡献第一篇攻略吧!",
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


@router.get("/community/comments/{post_id}")
def get_post_comments(post_id: str):
    """获取帖子评论列表"""
    return db.get_comments(post_id)


@router.post("/community/comments")
def add_post_comment(data: CommentCreate, current_user: dict = Depends(get_current_user)):
    """添加评论"""
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="内容不能为空")

    display_name = get_author_name(current_user)

    new_comment = db.add_comment(
        data.postId,
        current_user["_id"],
        display_name,
        data.content
    )
    return new_comment
