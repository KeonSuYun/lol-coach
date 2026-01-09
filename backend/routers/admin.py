"""
管理员路由模块

包含用户管理、反馈处理、统计数据、配置管理等功能
"""
import os
import datetime
import traceback
import shutil
from typing import List
from bson import ObjectId
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Body
from pydantic import BaseModel

from core.logger import logger
from .dependencies import get_current_user, db

# 创建路由器
router = APIRouter()

# 获取当前目录
current_dir = Path(__file__).resolve().parent.parent

# 尝试导入 seed_data
try:
    from seed_data import seed_data
except ImportError:
    seed_data = None


# ================= 数据模型 =================

class ResolveFeedbackRequest(BaseModel):
    feedback_id: str
    adopt: bool = False
    reward: int = 1
    reward_type: str = "r1"


class AdminUserUpdate(BaseModel):
    username: str
    action: str  # "add_days", "set_role", "rename", "delete"
    value: str   # 天数/角色/新名字/空字符串


class AdminTitleUpdate(BaseModel):
    username: str
    titles: List[str]


class SettleRequest(BaseModel):
    username: str


class ClientConfigUpdate(BaseModel):
    pan_url: str
    pan_pwd: str


class BroadcastRequest(BaseModel):
    content: str


# ================= 路由处理函数 =================

@router.get("/admin/feedbacks")
def get_admin_feedbacks(status: str = "pending", current_user: dict = Depends(get_current_user)):
    """获取反馈列表"""
    allowed_roles = ["admin", "root", "vip_admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="权限不足")
    return db.get_all_feedbacks(status=status)


@router.post("/admin/feedbacks/resolve")
def resolve_feedback_endpoint(req: ResolveFeedbackRequest, current_user: dict = Depends(get_current_user)):
    """处理反馈"""
    if current_user.get("role") not in ["admin", "root"]:
        raise HTTPException(status_code=403, detail="权限不足")

    if db.resolve_feedback(req.feedback_id, adopt=req.adopt, reward=req.reward, reward_type=req.reward_type):
        # 构造提示信息
        msg_suffix = ""
        if req.adopt:
            if req.reward_type == "r1":
                msg_suffix = f" (已奖励 {req.reward} 次核心模型)"
            elif req.reward_type == "chat":
                msg_suffix = f" (已奖励 {req.reward} 次快速模型)"

        return {"status": "success", "msg": f"反馈已处理{msg_suffix}"}

    raise HTTPException(status_code=500, detail="操作失败")


@router.get("/admin/users")
def get_admin_users(
    search: str = "",
    page: int = 1,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """获取用户列表"""
    # 权限检查
    allowed_roles = ["admin", "root", "vip_admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="需要管理员权限")

    try:
        def safe_serialize(obj):
            if isinstance(obj, list):
                return [safe_serialize(item) for item in obj]
            if isinstance(obj, dict):
                return {k: safe_serialize(v) for k, v in obj.items()}
            if isinstance(obj, ObjectId):
                return str(obj)
            if isinstance(obj, (datetime.datetime, datetime.date)):
                if obj.tzinfo is None:
                    obj = obj.replace(tzinfo=datetime.timezone.utc)
                return obj.isoformat()
            return obj

        # 计算分页
        skip = (page - 1) * limit

        # 查询数据 (接收元组)
        raw_users, total = db.get_all_users(limit=limit, search=search, skip=skip)

        # 返回标准分页结构
        cleaned_users = safe_serialize(raw_users)

        return {
            "items": cleaned_users,
            "total": total,
            "page": page,
            "size": limit
        }

    except Exception as e:
        logger.info(f"[Admin Users Error]: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"服务器内部错误: {str(e)}")


@router.post("/admin/user/update")
def update_user_admin(data: AdminUserUpdate, current_user: dict = Depends(get_current_user)):
    """更新用户信息"""
    # 严格限制:普通 Admin 是只读的,只有 Root 能改
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足:普通管理员仅拥有查看权限,无法修改用户信息")

    # 安全检查:禁止对自己进行破坏性操作 (删除/封禁)
    if data.username == current_user['username']:
        if data.action == 'delete':
            raise HTTPException(status_code=400, detail="为了安全,您不能删除自己的管理员账号")
        if data.action == 'set_role' and data.value not in ['admin', 'root']:
            raise HTTPException(status_code=400, detail="您不能取消自己的管理员权限")

    # 执行操作
    success, msg = db.admin_update_user(data.username, data.action, data.value)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "msg": msg}


@router.post("/admin/user/titles")
def admin_update_titles(data: AdminTitleUpdate, current_user: dict = Depends(get_current_user)):
    """管理员给用户分配头衔"""
    if current_user.get("role") not in ["admin", "root"]:
        raise HTTPException(status_code=403, detail="权限不足")

    db.users_col.update_one(
        {"username": data.username},
        {"$set": {"available_titles": data.titles}}
    )

    user = db.users_col.find_one({"username": data.username})
    if user.get("active_title") and user.get("active_title") not in data.titles:
        db.users_col.update_one({"username": data.username}, {"$set": {"active_title": "社区成员"}})

    return {"status": "success", "msg": "头衔列表已更新"}


@router.get("/admin/stats")
def get_admin_stats_endpoint(current_user: dict = Depends(get_current_user)):
    """获取统计数据"""
    # 允许 admin 和 root 访问,但返回数据不同
    if current_user.get("role") not in ["admin", "root"]:
        raise HTTPException(status_code=403, detail="权限不足")

    # 获取原始数据
    stats = db.get_admin_stats()

    # 核心:如果不是 root,屏蔽敏感财务数据
    if current_user.get("role") != "root":
        stats["total_revenue"] = 0
        stats["total_commissions"] = 0
        stats["total_api_calls"] = 0

    return stats


@router.get("/admin/sales/summary")
def get_admin_sales_summary_endpoint(current_user: dict = Depends(get_current_user)):
    """获取销售报表"""
    # 严格限制:只有 root 能看钱
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足:仅超级管理员可查看财务数据")
    return db.get_admin_sales_summary()


@router.post("/admin/sales/settle")
def settle_sales_endpoint(req: SettleRequest, current_user: dict = Depends(get_current_user)):
    """结算销售佣金"""
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足:仅超级管理员可进行资金结算")

    success, msg = db.settle_sales_partner(req.username, current_user['username'])
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"status": "success", "msg": msg}


@router.post("/admin/hot-update")
async def hot_update_config(
    file: UploadFile = File(...),
    file_type: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """热更新配置文件"""
    # 权限检查 (必须是管理员)
    if current_user.get("role") not in ["admin", "root"]:
        raise HTTPException(status_code=403, detail="权限不足")

    # 映射文件名
    filename_map = {
        "prompts": "prompts.json",
        "mechanics": "s16_mechanics.json",
        "corrections": "corrections.json",
        "champions": "champions.json"
    }

    target_filename = filename_map.get(file_type)
    if not target_filename:
        raise HTTPException(status_code=400, detail="无效的文件类型,请选择: prompts, mechanics, corrections, champions")

    target_path = current_dir / "secure_data" / target_filename

    # 覆盖服务器本地文件
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"[HotUpdate] {target_filename} 文件已覆盖")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件写入失败: {str(e)}")

    # 触发内存/数据库刷新逻辑
    try:
        # 如果是英雄数据,刷新名称映射表 (需要在server.py中实现)
        # if file_type == "champions":
        #     preload_champion_map()

        # 重新运行 seed_data 同步到 MongoDB
        if seed_data:
            seed_data()
            logger.info("[HotUpdate] 数据库已同步")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"数据同步失败: {str(e)}")

    return {"status": "success", "msg": f"成功!{target_filename} 已更新并生效,无需重启。"}


@router.post("/admin/config/client")
def update_client_config_endpoint(data: ClientConfigUpdate, current_user: dict = Depends(get_current_user)):
    """更新客户端配置"""
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足:仅超级管理员可修改系统配置")

    if db.update_client_config(data.pan_url, data.pan_pwd):
        return {"status": "success", "msg": "下载链接已更新"}

    raise HTTPException(status_code=500, detail="更新失败")


@router.post("/admin/broadcast")
def broadcast_message_endpoint(req: BroadcastRequest, current_user: dict = Depends(get_current_user)):
    """广播消息给所有用户"""
    # 严格权限检查:仅限 root
    if current_user.get("role") != "root":
        raise HTTPException(status_code=403, detail="权限不足:仅超级管理员(Root)可使用广播功能")

    if not req.content.strip():
        raise HTTPException(status_code=400, detail="广播内容不能为空")

    # 执行广播
    success, msg = db.broadcast_message(current_user['username'], req.content)

    if not success:
        raise HTTPException(status_code=500, detail=msg)

    return {"status": "success", "msg": msg}
