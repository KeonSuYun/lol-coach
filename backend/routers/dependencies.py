"""
共享依赖模块 - 提供通用的依赖注入函数

这个模块包含所有路由模块需要的共享依赖,避免循环导入问题。
"""
import os
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from core.database import KnowledgeBase
import time

# OAuth2 方案
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# JWT 配置
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    APP_ENV = os.getenv("APP_ENV", "development")
    if APP_ENV == "production":
        raise ValueError("严重安全错误:生产环境未配置 SECRET_KEY!服务拒绝启动。")
    else:
        SECRET_KEY = "dev_secret_key_please_change_in_production"

ALGORITHM = "HS256"

# 初始化数据库实例
db = KnowledgeBase()


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """获取当前登录用户"""
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


def get_real_ip(request: Request):
    """获取真实 IP 地址"""
    # 尝试从 X-Forwarded-For 获取真实 IP (通常是列表第一个)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host


def get_author_name(user):
    """获取作者显示名称(优先游戏名)"""
    gn = user.get("game_name")
    # 如果有游戏名且不为 Unknown,优先使用游戏名
    if gn and gn != "Unknown":
        return gn
    # 否则使用注册时的用户名
    return user["username"]
