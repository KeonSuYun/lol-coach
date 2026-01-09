"""
用户模型

定义用户相关的 Beanie 文档模型,包括用户基础信息、会员状态、使用统计等。
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict

from beanie import Document, Indexed
from pydantic import Field, EmailStr


class UserRole(str, Enum):
    """用户角色枚举"""
    USER = "user"
    PRO = "pro"
    VIP = "vip"
    SVIP = "svip"
    ADMIN = "admin"
    ROOT = "root"


class UsageStats(dict):
    """
    使用统计嵌套文档

    字段说明:
    - last_reset_date: 最后重置日期 (YYYY-MM-DD)
    - counts_chat: 快速模式使用次数统计 {mode: count}
    - counts_reasoner: 深度思考模式使用次数统计 {mode: count}
    - last_access: 最后访问时间 {mode: iso_time}
    - hourly_start: 当前小时窗口起始时间
    - hourly_count: 当前小时内使用次数
    - bonus_r1: 深度思考奖励次数
    - bonus_chat: 快速模式奖励次数
    """
    pass


class User(Document):
    """
    用户文档模型

    索引策略:
    - username: 唯一索引,用于登录和查询
    - device_id: 普通索引,用于设备频控
    - ip: 普通索引,用于 IP 频控
    - email: 唯一索引,用于邮箱验证
    """

    # === 基础信息 ===
    username: Indexed(str, unique=True)
    password: str  # BCrypt 哈希后的密码
    email: Indexed(EmailStr, unique=True)
    role: UserRole = Field(default=UserRole.USER)

    # === 设备与安全信息 ===
    device_id: Indexed(str) = Field(default="unknown")
    ip: Indexed(str) = Field(default="unknown")
    blocked_users: list[str] = Field(default_factory=list)  # 屏蔽的用户列表

    # === 会员信息 ===
    is_pro: bool = Field(default=False)
    membership_expire: Optional[datetime] = None

    # === 邀请与销售信息 ===
    sales_ref: Optional[str] = None  # 推荐人用户名

    # === 游戏信息 ===
    game_profile: Optional[Dict] = None  # LCU 同步的游戏信息

    # === 使用统计 ===
    usage_stats: UsageStats = Field(default_factory=dict)

    # === 深度思考余额 (显式字段) ===
    r1_remaining: Optional[int] = None  # 深度思考剩余次数,None 表示无限制

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"
        indexes = [
            "username",
            "device_id",
            "ip",
            "email",
        ]

    def is_premium(self) -> bool:
        """检查用户是否为付费会员"""
        return self.role in [UserRole.PRO, UserRole.VIP, UserRole.SVIP, UserRole.ADMIN]

    def check_membership_expired(self) -> bool:
        """检查会员是否过期"""
        if not self.membership_expire:
            return False

        now = datetime.now(timezone.utc)
        if self.membership_expire.tzinfo is None:
            self.membership_expire = self.membership_expire.replace(tzinfo=timezone.utc)

        return self.membership_expire < now

    def update_timestamp(self):
        """更新 updated_at 时间戳"""
        self.updated_at = datetime.now(timezone.utc)

    class Config:
        json_schema_extra = {
            "example": {
                "username": "player123",
                "email": "player123@example.com",
                "role": "user",
                "device_id": "abc123",
                "ip": "192.168.1.1",
                "is_pro": False,
                "sales_ref": "agent001",
            }
        }
