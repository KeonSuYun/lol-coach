"""
社区模型

定义社区相关的 Beanie 文档模型,包括 Wiki 帖子、酒馆帖子、评论和技巧。
"""

from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class Tip(Document):
    """
    技巧/经验文档模型

    用于存储玩家分享的英雄对位技巧和通用经验。

    索引策略:
    - hero + enemy: 复合索引,用于查询特定对位技巧
    - is_fake + liked_by: 复合索引,用于排序 (真实经验优先,高赞优先)
    """

    # === 关联信息 ===
    hero: Indexed(str)  # 己方英雄
    enemy: Indexed(str)  # 对手英雄 (或 "general" 表示通用技巧)

    # === 内容信息 ===
    title: str  # 标题
    content: str  # 技巧内容
    tags: list[str] = Field(default_factory=list)  # 标签 (如 ["实战经验", "对线技巧"])

    # === 作者与互动 ===
    author_id: Indexed(str)  # 作者用户名
    liked_by: list[str] = Field(default_factory=list)  # 点赞用户列表

    # === 奖励与标记 ===
    reward_granted: bool = Field(default=False)  # 是否已发放奖励 (10赞奖励 3 天会员)
    is_fake: bool = Field(default=False)  # 是否为系统填充的示例数据
    is_polished: bool = Field(default=False)  # 是否为 AI 润色内容

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "tips"
        indexes = [
            [("hero", 1), ("enemy", 1)],  # 复合索引
            [("is_fake", 1), ("liked_by", -1)],  # 排序索引
        ]

    def get_likes_count(self) -> int:
        """获取点赞数"""
        return len(self.liked_by)

    class Config:
        json_schema_extra = {
            "example": {
                "hero": "Yasuo",
                "enemy": "Zed",
                "title": "亚索打劫技巧",
                "content": "劫 R 落地瞬间用 W 风墙挡住他的回旋镖...",
                "tags": ["对线技巧", "操作技巧"],
                "author_id": "player123",
                "liked_by": ["user1", "user2"],
                "reward_granted": False,
                "is_fake": False,
            }
        }


class WikiPost(Document):
    """
    Wiki 帖子文档模型

    用于存储英雄攻略、机制解析等结构化内容。

    索引策略:
    - hero_id + category: 复合索引,用于按英雄和分类查询
    """

    # === 关联信息 ===
    hero_id: Indexed(str)  # 关联英雄 ID
    category: Indexed(str)  # 分类 (如 "出装", "符文", "机制解析")

    # === 内容信息 ===
    title: str  # 标题
    content: str  # Markdown 格式内容
    ref_id: str  # 引用 ID (如 "#U-1234")

    # === 作者与互动 ===
    author_id: str  # 作者用户名
    likes: int = Field(default=0)  # 点赞数
    views: int = Field(default=0)  # 浏览数
    comments: int = Field(default=0)  # 评论数

    # === 标记 ===
    is_ai_pick: bool = Field(default=False)  # 是否为 AI 精选

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

    class Settings:
        name = "wiki_posts"
        indexes = [
            [("hero_id", 1), ("category", 1)],
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "hero_id": "Yasuo",
                "category": "出装",
                "title": "S16 亚索最强出装",
                "content": "# 核心三件套\n1. 饮血剑\n2. 无尽...",
                "ref_id": "#U-1234",
                "author_id": "pro_player",
                "likes": 42,
                "views": 300,
                "is_ai_pick": True,
            }
        }


class TavernPost(Document):
    """
    酒馆帖子文档模型

    用于存储社区讨论、闲聊等非结构化内容。

    索引策略:
    - topic: 普通索引,用于按话题查询
    - created_at: 降序索引,用于时间线排序
    """

    # === 内容信息 ===
    topic: Indexed(str)  # 话题标签 (如 "闲聊", "求助", "吐槽")
    title: str  # 标题
    content: str  # 内容

    # === 作者与互动 ===
    author_id: str  # 作者用户名
    likes: int = Field(default=0)  # 点赞数
    comments: int = Field(default=0)  # 评论数

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "tavern_posts"
        indexes = [
            [("topic", 1), ("created_at", -1)],
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "topic": "闲聊",
                "title": "今天被亚索秀了",
                "content": "太难受了,被 0-10 的亚索 solo 杀了...",
                "author_id": "player123",
                "likes": 5,
                "comments": 12,
            }
        }


class Comment(Document):
    """
    评论文档模型

    用于存储对 Wiki 帖子或酒馆帖子的评论。

    索引策略:
    - post_id + created_at: 复合索引,用于查询特定帖子的评论并按时间排序
    """

    # === 关联信息 ===
    post_id: Indexed(str)  # 关联的帖子 ID

    # === 内容信息 ===
    content: str  # 评论内容

    # === 作者与互动 ===
    user_id: str  # 评论者用户 ID
    user_name: str  # 评论者用户名
    likes: int = Field(default=0)  # 点赞数

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "comments"
        indexes = [
            [("post_id", 1), ("created_at", 1)],
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "post_id": "507f1f77bcf86cd799439011",
                "content": "感谢分享,学到了!",
                "user_id": "user123",
                "user_name": "玩家123",
                "likes": 3,
            }
        }
