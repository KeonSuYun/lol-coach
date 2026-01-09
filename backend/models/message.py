"""
私信模型

定义私信相关的 Beanie 文档模型。
"""

from datetime import datetime, timezone
from enum import Enum

from beanie import Document, Indexed
from pydantic import Field


class MessageType(str, Enum):
    """消息类型枚举"""
    USER = "user"  # 用户消息
    SYSTEM = "system"  # 系统广播消息


class Message(Document):
    """
    私信文档模型

    索引策略:
    - sender + receiver + created_at: 复合索引,用于查询对话历史
    - receiver + read: 复合索引,用于查询未读消息
    """

    # === 消息信息 ===
    sender: Indexed(str)  # 发送者用户名
    receiver: Indexed(str)  # 接收者用户名
    content: str  # 消息内容

    # === 消息类型 ===
    type: MessageType = Field(default=MessageType.USER)  # 消息类型

    # === 状态 ===
    read: Indexed(bool) = Field(default=False)  # 是否已读
    deleted_by: list[str] = Field(default_factory=list)  # 删除该消息的用户列表 (软删除)

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "messages"
        indexes = [
            [("sender", 1), ("receiver", 1), ("created_at", -1)],  # 对话历史索引
            [("receiver", 1), ("read", 1)],  # 未读消息索引
        ]

    def is_deleted_by(self, username: str) -> bool:
        """检查消息是否被指定用户删除"""
        return username in self.deleted_by

    class Config:
        json_schema_extra = {
            "example": {
                "sender": "player123",
                "receiver": "player456",
                "content": "你好,请问如何玩亚索?",
                "type": "user",
                "read": False,
                "deleted_by": [],
            }
        }
