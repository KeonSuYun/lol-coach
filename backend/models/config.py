"""
配置模型

定义系统配置相关的 Beanie 文档模型,包括 OTP、Prompt 模板、游戏配置等。
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any

from beanie import Document, Indexed
from pydantic import Field


class OTP(Document):
    """
    一次性验证码文档模型

    索引策略:
    - contact: 普通索引,用于查询验证码
    - expire_at: TTL 索引,自动删除过期验证码
    """

    # === 验证码信息 ===
    contact: Indexed(str)  # 联系方式 (邮箱或手机号)
    code: str  # 验证码

    # === 过期时间 ===
    expire_at: datetime  # 过期时间 (5 分钟后)

    class Settings:
        name = "otps"
        indexes = [
            "contact",
        ]
        # TTL 索引需要通过 timeseries 或手动创建
        # expire_at: TTL 索引,expireAfterSeconds=0

    class Config:
        json_schema_extra = {
            "example": {
                "contact": "player123@example.com",
                "code": "123456",
                "expire_at": "2026-01-09T12:05:00Z",
            }
        }


class PromptTemplate(Document):
    """
    AI Prompt 模板文档模型

    索引策略:
    - mode: 唯一索引,每种模式只有一个模板
    """

    # === 模板信息 ===
    mode: Indexed(str, unique=True)  # 模式标识 (如 "role_jungle_ganking", "role_mid")
    system_prompt: str  # 系统提示词
    user_prompt_template: str  # 用户提示词模板

    # === 时间戳 ===
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "prompt_templates"
        indexes = [
            "mode",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "mode": "role_jungle_ganking",
                "system_prompt": "你是一位专业的打野教练...",
                "user_prompt_template": "请分析以下阵容:\n我方: {ally}\n敌方: {enemy}",
            }
        }


class GameConfig(Document):
    """
    游戏配置文档模型

    存储游戏相关的配置数据,如 S16 机制规则、野区刷新时间等。
    使用 _id 作为配置标识。
    """

    # === 配置数据 ===
    # _id: str 作为配置标识 (如 "s16_rules")
    data: Dict[str, Any] = Field(default_factory=dict)  # 配置数据 (JSON 格式)

    # === 时间戳 ===
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "config"
        # _id 已经是唯一索引,无需额外定义

    class Config:
        json_schema_extra = {
            "example": {
                "_id": "s16_rules",
                "data": {
                    "jungle_spawn_time": "1:30",
                    "dragon_spawn_time": "5:00",
                    "void_grub_enabled": True,
                },
            }
        }


class ClientConfig(Document):
    """
    客户端下载配置文档模型

    存储客户端下载链接和提取码。
    """

    # === 配置信息 ===
    pan_url: str  # 网盘链接
    pan_pwd: Optional[str] = None  # 提取码

    # === 时间戳 ===
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "config"  # 复用 config 集合
        # 使用 _id = "client_download" 来标识

    class Config:
        json_schema_extra = {
            "example": {
                "_id": "client_download",
                "pan_url": "https://pan.baidu.com/s/xxxxx",
                "pan_pwd": "abcd",
            }
        }


class Feedback(Document):
    """
    反馈文档模型

    用于存储用户反馈和建议。
    """

    # === 反馈内容 ===
    user_id: str  # 反馈用户
    content: str  # 反馈内容
    contact: Optional[str] = None  # 联系方式

    # === 状态 ===
    status: str = Field(default="pending")  # 状态: "pending" | "resolved"
    adopted: bool = Field(default=False)  # 是否采纳
    reward_granted: int = Field(default=0)  # 发放的奖励数量
    reward_type: Optional[str] = None  # 奖励类型: "r1" | "chat" | None

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

    class Settings:
        name = "feedback"

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "player123",
                "content": "建议增加英雄 Ban 选阶段的分析功能",
                "contact": "player123@example.com",
                "status": "pending",
            }
        }


class Correction(Document):
    """
    错误修正文档模型

    用于强制修正 AI 的错误认知 (如"亚索风墙挡不住赛娜普攻")。

    索引策略:
    - hero + enemy: 复合索引,用于查询修正规则
    """

    # === 修正规则 ===
    hero: Indexed(str)  # 己方英雄 (或 "general", "role_jungle" 等)
    enemy: Indexed(str)  # 对手英雄 (或 "general")
    correction: str  # 修正内容

    # === 优先级 ===
    priority: int = Field(default=0)  # 优先级 (数字越大越优先)

    class Settings:
        name = "corrections"
        indexes = [
            [("hero", 1), ("enemy", 1)],
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "hero": "Yasuo",
                "enemy": "Senna",
                "correction": "亚索的风墙可以挡住赛娜的普攻 (属于弹道攻击)",
                "priority": 10,
            }
        }


class WikiSummary(Document):
    """
    Wiki 摘要文档模型

    用于存储英雄的 Wiki 总结内容。
    """

    # === 关联信息 ===
    hero_id: Indexed(str, unique=True)  # 关联英雄 ID

    # === 摘要内容 ===
    summary: str  # 摘要内容 (Markdown 格式)

    # === 时间戳 ===
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "wiki_summaries"
        indexes = [
            "hero_id",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "hero_id": "Yasuo",
                "summary": "# 亚索\n\n亚索是一位高机动战士英雄...",
            }
        }
