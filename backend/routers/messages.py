"""
私信系统路由模块

包含发送私信、获取聊天记录、会话列表等功能
"""
import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from core.logger import logger
from .dependencies import get_current_user, db


# 创建路由器
router = APIRouter()


# ================= 数据模型 =================

class MessageSend(BaseModel):
    receiver: str
    content: str


# ================= 辅助函数 =================

def parse_user_info(user_doc, default_name):
    """解析用户信息,优先读取同步后的游戏数据"""
    icon_id = 29
    display_name = default_name

    # 特殊账号处理
    if default_name in ['admin', 'root']:
        return 588, "管理员"  # 588 是提莫队长头像

    if not user_doc:
        return icon_id, display_name

    # 优先从根目录读取 (sync_profile 存的位置)
    if user_doc.get("profile_icon_id"):
        icon_id = user_doc.get("profile_icon_id")

    # 获取游戏昵称
    if user_doc.get("game_name"):
        gn = user_doc.get("game_name")
        tl = user_doc.get("tag_line") or user_doc.get("tagLine")
        if gn and gn != "Unknown":
            display_name = f"{gn} #{tl}" if tl else gn

    # 兜底兼容:如果根目录没有,再尝试从 game_profile 嵌套对象读取 (兼容旧数据)
    elif user_doc.get("game_profile"):
        profile = user_doc.get("game_profile")
        if isinstance(profile, str):
            try:
                profile = json.loads(profile)
            except:
                profile = {}

        if isinstance(profile, dict):
            # 兼容 camelCase 和 snake_case
            icon_id = profile.get("profileIconId") or profile.get("profile_icon_id") or icon_id
            gn = profile.get("gameName") or profile.get("game_name")
            tl = profile.get("tagLine") or profile.get("tag_line")
            if gn:
                display_name = f"{gn} #{tl}" if tl else gn

    return icon_id, display_name


# ================= 路由处理函数 =================

@router.post("/messages")
def send_msg(data: MessageSend, current_user: dict = Depends(get_current_user)):
    """发送私信 (含安全校验)"""
    # 1. 基础校验
    if data.receiver == current_user['username']:
        raise HTTPException(400, "不能给自己发消息")

    # 内容风控:禁止空消息和超长消息
    if not data.content.strip():
        raise HTTPException(400, "消息内容不能为空")
    if len(data.content) > 500:
        raise HTTPException(400, "消息过长 (上限500字)")

    # 2. 获取接收者并检查权限
    receiver_user = db.users_col.find_one({"username": data.receiver})
    if not receiver_user:
        raise HTTPException(404, "用户不存在")

    # 权限检查:普通用户禁止直接私信管理员 (防止骚扰)
    is_sender_admin = current_user.get("role") in ["admin", "root"]
    is_receiver_admin = receiver_user.get("role") in ["admin", "root"]

    if is_receiver_admin and not is_sender_admin:
        raise HTTPException(403, "普通用户无法直接私信管理员,请通过【反馈】功能联系")

    # 3. 发送
    success, msg = db.send_message(current_user['username'], data.receiver, data.content)
    if not success:
        raise HTTPException(400, msg)
    return {"status": "success"}


@router.get("/messages/conversations")
def get_conversations(current_user: dict = Depends(get_current_user)):
    """获取会话列表 (性能优化版:批量查询)"""
    raw = db.get_my_conversations(current_user['username'])
    res = []

    # 1. 提取所有联系人的 username
    contact_ids = [item['_id'] for item in raw if item['_id']]

    # 2. 批量查询所有相关用户,而不是在循环里一个个查
    users_cursor = db.users_col.find({"username": {"$in": contact_ids}})
    # 将结果转为字典方便查找: { "username": user_doc }
    users_map = {u['username']: u for u in users_cursor}

    for item in raw:
        contact_username = item['_id']
        if not contact_username:
            continue

        last_msg = item['last_message']

        # 3. 直接从内存字典里取数据,不再查库
        contact_user = users_map.get(contact_username)

        icon_id, nickname = parse_user_info(contact_user, contact_username)

        res.append({
            "id": contact_username,
            "nickname": nickname,
            "sender": contact_username,
            "content": last_msg['content'],
            "time": last_msg['created_at'].strftime("%H:%M"),
            "unread": item['unread_count'] > 0,
            "avatar": f"https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/{icon_id}.png"
        })

    return res


@router.get("/messages/{contact}")
def get_chat(contact: str, before: str = None, current_user: dict = Depends(get_current_user)):
    """获取聊天记录"""
    # 传递 before 参数给数据库
    messages = db.get_chat_history(current_user['username'], contact, limit=50, before_time=before)

    # 查对方资料
    contact_user = db.users_col.find_one({"username": contact})
    icon_id, nickname = parse_user_info(contact_user, contact)

    contact_info = {
        "username": contact,
        "nickname": nickname,
        "avatar": f"https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/{icon_id}.png"
    }

    return {
        "messages": messages,
        "contactInfo": contact_info
    }


@router.delete("/messages/{contact}")
def delete_conversation_endpoint(contact: str, current_user: dict = Depends(get_current_user)):
    """删除与某人的会话 (物理删除)"""
    success = db.delete_conversation(current_user['username'], contact)
    if not success:
        raise HTTPException(status_code=500, detail="删除失败")
    return {"status": "success"}
