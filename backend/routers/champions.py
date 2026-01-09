"""
英雄数据路由模块

包含英雄列表、分路信息、攻略Tips等功能
"""
import os
import re
import json
from pathlib import Path
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core.logger import logger
from .dependencies import get_current_user, get_author_name, db

# 创建路由器
router = APIRouter()

# 获取当前目录
current_dir = Path(__file__).resolve().parent.parent


# ================= 数据模型 =================

class TipInput(BaseModel):
    hero: str
    enemy: str
    content: str
    is_general: bool


class LikeInput(BaseModel):
    tip_id: str


# ================= 路由处理函数 =================

@router.get("/champions")
def get_local_champions():
    """获取英雄列表"""
    path = current_dir / "secure_data" / "champions.json"
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/champions/roles")
def get_champion_roles():
    """获取英雄分路映射"""
    try:
        # 读取数据源
        json_path = current_dir / "secure_data" / "champions.json"

        if not json_path.exists():
            logger.info("未找到 champions.json")
            return {}

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        mapping = {}

        # 映射表:将JSON里可能的各种写法,强制统一为前端能看懂的 Key
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

        # 名字清洗:去掉空格、标点,转小写 (Miss Fortune -> missfortune)
        def normalize_key(raw_name):
            if not raw_name:
                return ""
            return re.sub(r'[\s\.\'\-]+', '', raw_name).lower()

        for item in data:
            # 1. 尝试获取英文名 (优先 id,其次 name)
            raw_name = item.get("id") or item.get("name")
            if not raw_name:
                continue

            clean_key = normalize_key(raw_name)

            # 2. 获取分路 (JSON里可能是 "role": "bot" 或 "role": ["bot", "mid"])
            raw_roles = item.get("role")
            if not raw_roles:
                continue

            if isinstance(raw_roles, str):
                raw_roles = [raw_roles]  # 统一转列表处理

            # 3. 标准化分路
            final_roles = []
            for r in raw_roles:
                r_upper = str(r).upper().strip()
                # 查表转换
                standard_role = role_standardization.get(r_upper)
                if standard_role and standard_role not in final_roles:
                    final_roles.append(standard_role)

            # 4. 存入映射 (如果同一个英雄在JSON里出现多次,合并分路)
            if clean_key:
                if clean_key in mapping:
                    mapping[clean_key] = list(set(mapping[clean_key] + final_roles))
                else:
                    mapping[clean_key] = final_roles

        return mapping

    except Exception as e:
        logger.info(f"Role Load Error: {e}")
        return {}


@router.post("/tips")
def add_tip_endpoint(data: TipInput, current_user: dict = Depends(get_current_user)):
    """发布攻略 (纯净版 - 无AI介入)"""
    # 1. 获取用户当前的头衔
    user_doc = db.users_col.find_one({"username": current_user['username']})
    user_title = user_doc.get("active_title", "社区成员")

    # 2. 获取显示名称 (游戏ID)
    display_name = get_author_name(current_user)

    # 3. 存入数据库
    res = db.add_tip(data.hero, data.enemy, data.content, current_user['username'], data.is_general)

    # 4. 补充用户信息到帖子中
    if hasattr(res, 'inserted_id'):
        db.tips_col.update_one(
            {"_id": res.inserted_id},
            {"$set": {
                "author_title": user_title,
                "author_display_name": display_name,
                "is_polished": False  # 标记为未装修
            }}
        )

    return {"status": "success", "msg": "发布成功!"}


@router.get("/tips")
def get_tips_endpoint(hero: str, enemy: str = "general"):
    """使用混合流查询"""
    return db.get_mixed_tips(hero, enemy)


@router.delete("/tips/{tip_id}")
def delete_tip_endpoint(tip_id: str, current_user: dict = Depends(get_current_user)):
    """删除攻略"""
    tip = db.get_tip_by_id(tip_id)
    if not tip:
        raise HTTPException(status_code=404)
    # 权限检查:作者本人或管理员
    is_admin = current_user.get('role') in ['admin', 'root']
    if tip['author_id'] != current_user['username'] and not is_admin:
        raise HTTPException(status_code=403)
    if db.delete_tip(tip_id):
        return {"status": "success"}
    raise HTTPException(status_code=500)


@router.post("/like")
def like_tip(data: LikeInput, current_user: dict = Depends(get_current_user)):
    """点赞/取消点赞攻略"""
    if db.toggle_like(data.tip_id, current_user['username']):
        return {"status": "success"}
    raise HTTPException(status_code=400, detail="点赞失败")
