"""
认证相关路由模块

包含用户注册、登录、个人信息管理等功能
"""
import os
import re
import time
import random
import smtplib
import datetime
from pathlib import Path
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt

from core.logger import logger
from .dependencies import get_current_user, get_real_ip, get_author_name, db, SECRET_KEY, ALGORITHM

# 创建路由器
router = APIRouter()

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 频控存储
RATE_LIMIT_STORE = {}
LOGIN_LIMIT_STORE = {}

# JWT 配置
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token 7天过期

# SMTP 配置
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.exmail.qq.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

# 邮箱域名白名单
ALLOWED_EMAIL_DOMAINS = [
    "qq.com", "163.com", "126.com", "gmail.com", "outlook.com",
    "hotmail.com", "icloud.com", "foxmail.com", "sina.com"
]

# 保留用户名
RESERVED = ["admin", "root", "system", "hexcoach", "gm", "master"]


# ================= 数据模型 =================

class EmailRequest(BaseModel):
    email: str


class UserCreate(BaseModel):
    username: str
    password: str
    email: str
    verify_code: str
    device_id: str = "unknown"
    sales_ref: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str


class UserProfileSync(BaseModel):
    gameName: str = "Unknown"
    tagLine: str = ""
    level: int = 1
    rank: str = "Unranked"
    lp: int = 0
    winRate: int = 0
    kda: str = "0.0"
    profileIconId: int = 29
    mastery: List[int] = []
    matches: List[dict] = []


class UserSetTitle(BaseModel):
    active_title: str


class BlockRequest(BaseModel):
    target_username: str


# ================= 辅助函数 =================

def verify_password(plain_password, hashed_password):
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    """密码哈希"""
    return pwd_context.hash(password)


def create_access_token(data: dict):
    """创建 JWT Token"""
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# ================= 路由处理函数 =================

@router.post("/send-email")
def send_email_code(req: EmailRequest, request: Request):
    """发送注册验证码"""
    # 1. 获取真实 IP
    client_ip = get_real_ip(request)
    now = time.time()

    # 2. IP 频控 (1分钟1次)
    last_time = RATE_LIMIT_STORE.get(client_ip, 0)
    if now - last_time < 60:
        raise HTTPException(status_code=429, detail="请求过于频繁,请1分钟后再试")

    RATE_LIMIT_STORE[client_ip] = now  # 更新时间

    # 3. 基础格式校验
    if not re.match(r"[^@]+@[^@]+\.[^@]+", req.email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")

    # 4. 防薅羊毛逻辑
    email_lower = req.email.lower().strip()
    try:
        domain = email_lower.split("@")[1]
    except IndexError:
        raise HTTPException(status_code=400, detail="邮箱格式错误")

    # A. 域名白名单检查
    if domain not in ALLOWED_EMAIL_DOMAINS:
        logger.info(f"[Security] 拦截非白名单域名注册: {req.email} (IP: {client_ip})")
        raise HTTPException(
            status_code=400,
            detail="不支持该邮箱服务商,请使用 QQ/微信/Gmail/Outlook 等常用邮箱"
        )

    # B. Gmail 别名拦截 (防止 user+123@gmail.com 无限注册)
    if "gmail.com" in domain and "+" in email_lower:
        logger.info(f"[Security] 拦截 Gmail 别名注册: {req.email} (IP: {client_ip})")
        raise HTTPException(status_code=400, detail="不支持使用别名邮箱,请使用原始邮箱地址")

    # 生成验证码
    code = "".join([str(random.randint(0, 9)) for _ in range(6)])

    try:
        db.save_otp(req.email, code)
    except Exception as e:
        logger.info(f"DB Error: {e}")
        raise HTTPException(status_code=500, detail="系统繁忙,请稍后重试")

    # 发送邮件
    try:
        msg = MIMEText(f'HexCoach 验证码:{code},5分钟有效。请勿泄露给他人。', 'plain', 'utf-8')
        msg['From'] = formataddr(["HexCoach", SMTP_USER])
        msg['To'] = formataddr(["User", req.email])
        msg['Subject'] = "HexCoach 注册验证"

        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [req.email], msg.as_string())
        server.quit()
    except Exception as e:
        logger.info(f"SMTP Send Error: {e}")
        raise HTTPException(status_code=500, detail="邮件发送失败,请检查邮箱地址是否正确")

    return {"status": "success", "msg": "验证码已发送至您的邮箱"}


@router.post("/register")
def register(user: UserCreate, request: Request):
    """用户注册"""
    if user.device_id and user.device_id != "unknown":
        device_count = db.users_col.count_documents({"device_id": user.device_id})
        if device_count >= 3:  # 您可以把这个数字调大,比如 5 或 10
            raise HTTPException(
                status_code=400,
                detail="该设备注册账号数量已达上限"
            )

    client_ip = request.client.host
    if any(r in user.username.lower() for r in RESERVED):
        raise HTTPException(status_code=400, detail="用户名包含保留字")

    if not db.validate_otp(user.email, user.verify_code):
        raise HTTPException(status_code=400, detail="验证码错误或已失效")

    if user.sales_ref:
        # 检查推荐人是否存在
        referrer = db.users_col.find_one({"username": user.sales_ref})
        if not referrer:
            # 策略B:静默置空(推荐)
            user.sales_ref = None

    hashed_pw = get_password_hash(user.password)

    result = db.create_user(
        user.username,
        hashed_pw,
        role="user",
        email=user.email,
        device_id=user.device_id,
        ip=request.client.host,
        sales_ref=user.sales_ref
    )

    if result == True:
        return {"status": "success", "msg": "注册成功,请登录"}

    err_map = {
        "USERNAME_TAKEN": "用户名已被占用",
        "EMAIL_TAKEN": "该邮箱已注册,请直接登录",
        "DEVICE_LIMIT": "该设备注册账号已达上限",
        "IP_LIMIT": "当前IP注册过于频繁"
    }
    raise HTTPException(status_code=400, detail=err_map.get(result, "注册失败"))


@router.post("/token", response_model=Token)
def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """用户登录"""
    # 防爆破限流 (1分钟10次)
    client_ip = get_real_ip(request)
    now = time.time()

    last_attempt = LOGIN_LIMIT_STORE.get(client_ip, {"count": 0, "time": 0})

    if now - last_attempt["time"] < 60:
        if last_attempt["count"] >= 10:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="登录尝试次数过多,请1分钟后再试",
            )
    else:
        # 超过1分钟,重置计数
        last_attempt = {"count": 0, "time": now}

    LOGIN_LIMIT_STORE[client_ip] = last_attempt

    user = db.get_user(form_data.username)
    if not user or not verify_password(form_data.password, user['password']):
        LOGIN_LIMIT_STORE[client_ip]["count"] += 1  # 失败+1
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.get("role") == "banned":
        LOGIN_LIMIT_STORE[client_ip]["count"] += 1
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该账号已被封禁 (Banned),无法登录",
        )
    # 登录成功,清除计数
    LOGIN_LIMIT_STORE[client_ip]["count"] = 0

    access_token = create_access_token(data={"sub": user['username']})
    return {"access_token": access_token, "token_type": "bearer", "username": user['username']}


@router.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    status_info = db.get_user_usage_status(current_user['username'])

    my_titles = current_user.get("available_titles", [])
    if "社区成员" not in my_titles:
        my_titles.append("社区成员")

    try:
        unread_count = db.get_unread_count_total(current_user['username'])
    except:
        unread_count = 0

    # 获取战友名字 (将 invited_by 的 ObjectId 转为 username)
    partner_name = None
    if current_user.get("invited_by"):
        partner = db.users_col.find_one({"_id": current_user["invited_by"]})
        if partner:
            partner_name = partner["username"]

    return {
        "username": current_user['username'],
        "role": status_info.get("role", "user"),
        "is_pro": status_info.get("is_pro", False),
        "expire_at": current_user.get("membership_expire"),
        "r1_limit": status_info.get("r1_limit", 10),
        "r1_used": status_info.get("r1_used", 0),
        "r1_remaining": status_info.get("r1_remaining", 0),
        "chat_hourly_limit": status_info.get("chat_hourly_limit", 10),
        "chat_used": status_info.get("chat_used", 0),
        "available_titles": my_titles,
        "active_title": current_user.get("active_title", "社区成员"),
        "unread_msg_count": unread_count,
        "invited_by": partner_name,
        "invite_change_count": current_user.get("invite_change_count", 0),
        "game_profile": {
            "gameName": current_user.get("game_name"),
            "tagLine": current_user.get("tag_line"),
            "level": current_user.get("level"),
            "rank": current_user.get("rank"),
            "lp": current_user.get("lp"),
            "winRate": current_user.get("win_rate"),
            "kda": current_user.get("kda"),
            "profileIconId": current_user.get("profile_icon_id"),
            "mastery": current_user.get("mastery", []),
            "matches": current_user.get("matches", [])
        }
    }


@router.post("/users/sync_profile")
async def sync_user_profile(data: UserProfileSync, current_user: dict = Depends(get_current_user)):
    """同步用户游戏资料"""
    # 1. 获取数据库中已有的旧战绩
    existing_matches = current_user.get("matches", [])
    if not isinstance(existing_matches, list):
        existing_matches = []

    # 2. 构建去重字典 (以 gameId 为唯一键)
    matches_map = {}

    # A. 先载入旧数据
    for m in existing_matches:
        # 兼容 gameId 或 id 字段
        gid = m.get("gameId") or m.get("id")
        if gid:
            matches_map[str(gid)] = m

    # B. 再载入新数据 (如有重复 gameId,新数据会覆盖旧数据)
    for m in data.matches:
        gid = m.get("gameId") or m.get("id")
        if gid:
            matches_map[str(gid)] = m

    # 3. 转回列表并排序
    merged_matches = list(matches_map.values())

    # 按 gameCreation (时间戳) 倒序排列,确保最新的在最上面
    merged_matches.sort(key=lambda x: x.get("gameCreation", 0), reverse=True)

    # 4. 性能保护:设置存储上限 (保留最近 200 场),防止数据库无限膨胀
    MAX_HISTORY = 200
    if len(merged_matches) > MAX_HISTORY:
        merged_matches = merged_matches[:MAX_HISTORY]

    update_doc = {
        "game_name": data.gameName,
        "tag_line": data.tagLine,
        "level": data.level,
        "rank": data.rank,
        "lp": data.lp,
        "win_rate": data.winRate,
        "kda": data.kda,
        "profile_icon_id": data.profileIconId,
        "mastery": data.mastery,
        "matches": merged_matches,
        "last_synced_at": datetime.datetime.now(datetime.timezone.utc)
    }

    # 更新数据库
    try:
        db.users_col.update_one({"username": current_user['username']}, {"$set": update_doc})
    except Exception as e:
        logger.info(f"Sync DB Error: {e}")
        raise HTTPException(status_code=500, detail="数据库更新失败")

    return {"status": "success", "msg": f"同步成功 (已存储 {len(merged_matches)} 场战绩)"}


@router.get("/users/profile/{target_input}")
def get_user_public_profile(target_input: str, current_user: dict = Depends(get_current_user)):
    """智能搜索用户:支持 登录账号、游戏昵称、昵称#Tag"""
    target = target_input.strip()
    if not target:
        raise HTTPException(status_code=400, detail="请输入用户名")

    # 1. 查找逻辑 (保留原有的三级查找)
    user = db.users_col.find_one({"username": target})

    if not user and "#" in target:
        try:
            parts = target.split("#")
            gn_query = parts[0].strip()
            tl_query = parts[1].strip()
            user = db.users_col.find_one({
                "game_name": {"$regex": f"^{re.escape(gn_query)}$", "$options": "i"},
                "tag_line": {"$regex": f"^{re.escape(tl_query)}$", "$options": "i"}
            })
        except:
            pass

    if not user:
        user = db.users_col.find_one({
            "game_name": {"$regex": f"^{re.escape(target)}$", "$options": "i"}
        })

    # 兜底:管理员虚拟账号
    if not user:
        if target.lower() in ['admin', 'root']:
            return {
                "username": target,
                "game_profile": {"gameName": "管理员", "tagLine": "HEX", "rank": "Challenger", "level": 999},
                "avatar_url": "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/588.png",
                "active_title": "官方/传说\u200C",  # 带标记
                "bio": "系统管理员",
                "is_pro": True
            }
        raise HTTPException(status_code=404, detail="未找到该用户")

    # 辅助函数:解析用户信息
    def parse_user_info(user_doc, default_name):
        icon_id = 29
        display_name = default_name

        # 特殊账号处理
        if default_name in ['admin', 'root']:
            return 588, "管理员"

        if not user_doc:
            return icon_id, display_name

        # 优先从根目录读取
        if user_doc.get("profile_icon_id"):
            icon_id = user_doc.get("profile_icon_id")

        # 获取游戏昵称
        if user_doc.get("game_name"):
            gn = user_doc.get("game_name")
            tl = user_doc.get("tag_line") or user_doc.get("tagLine")
            if gn and gn != "Unknown":
                display_name = f"{gn} #{tl}" if tl else gn

        return icon_id, display_name

    # 构造返回数据
    real_username = user['username']
    icon_id, nickname = parse_user_info(user, real_username)

    # 构造游戏档案
    import json
    game_profile = user.get("game_profile", {})
    if isinstance(game_profile, str):
        try:
            game_profile = json.loads(game_profile)
        except:
            game_profile = {}

    return {
        "username": real_username,
        "role": user.get("role", "user"),
        "is_pro": user.get("role") in ["pro", "vip", "admin", "root"],
        "active_title": user.get("active_title", "社区成员"),
        "bio": user.get("bio", "这个人很懒,什么都没写。"),
        "avatar_url": f"https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/{icon_id}.png",
        "game_profile": {
            "gameName": game_profile.get("gameName") or game_profile.get("game_name"),
            "tagLine": game_profile.get("tagLine") or game_profile.get("tag_line"),
            "rank": game_profile.get("rank", "Unranked"),
            "lp": game_profile.get("lp", 0),
            "winRate": game_profile.get("winRate") or game_profile.get("win_rate", 0),
            "kda": game_profile.get("kda", "0.0"),
            "level": game_profile.get("level", 1),
            "mastery": game_profile.get("mastery", []),
            "matches": game_profile.get("matches", [])
        }
    }


@router.post("/users/set_active_title")
def set_active_title(data: UserSetTitle, current_user: dict = Depends(get_current_user)):
    """设置佩戴头衔"""
    user = db.users_col.find_one({"username": current_user['username']})
    available = user.get("available_titles", [])
    if "社区成员" not in available:
        available.append("社区成员")

    if data.active_title not in available:
        raise HTTPException(status_code=400, detail="你没有获得该头衔")

    db.users_col.update_one(
        {"username": current_user['username']},
        {"$set": {"active_title": data.active_title}}
    )
    return {"status": "success", "msg": "佩戴成功"}


@router.post("/users/block")
def block_user_endpoint(data: BlockRequest, current_user: dict = Depends(get_current_user)):
    """拉黑/解除拉黑 用户"""
    if data.target_username == current_user['username']:
        raise HTTPException(400, "不能拉黑自己")

    target = db.users_col.find_one({"username": data.target_username})
    if not target:
        raise HTTPException(404, "用户不存在")

    my_username = current_user['username']

    # 检查是否已拉黑
    me = db.users_col.find_one({"username": my_username})
    blocked_list = me.get("blocked_users", [])

    if data.target_username in blocked_list:
        # 已拉黑 -> 解除
        db.users_col.update_one(
            {"username": my_username},
            {"$pull": {"blocked_users": data.target_username}}
        )
        return {"status": "success", "msg": "已解除拉黑", "is_blocked": False}
    else:
        # 未拉黑 -> 拉黑
        db.users_col.update_one(
            {"username": my_username},
            {"$addToSet": {"blocked_users": data.target_username}}
        )
        return {"status": "success", "msg": "已拉黑该用户,对方将无法给您发送私信", "is_blocked": True}
