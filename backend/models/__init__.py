"""
Beanie 文档模型模块

该模块包含所有数据库模型定义,使用 Beanie ORM 提供类型安全和异步支持。
"""

from .user import User, UserRole, UsageStats
from .champion import Champion
from .order import Order, SalesRecord
from .community import WikiPost, TavernPost, Comment, Tip
from .message import Message, MessageType
from .config import (
    OTP,
    PromptTemplate,
    GameConfig,
    ClientConfig,
    Feedback,
    Correction,
    WikiSummary,
)

__all__ = [
    # User models
    "User",
    "UserRole",
    "UsageStats",
    # Champion
    "Champion",
    # Order models
    "Order",
    "SalesRecord",
    # Community models
    "WikiPost",
    "TavernPost",
    "Comment",
    "Tip",
    # Message models
    "Message",
    "MessageType",
    # Config models
    "OTP",
    "PromptTemplate",
    "GameConfig",
    "ClientConfig",
    "Feedback",
    "Correction",
    "WikiSummary",
]
