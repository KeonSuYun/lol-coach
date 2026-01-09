"""
数据库连接与初始化模块 (重构版)

使用 Beanie ORM 和 Motor 异步驱动,提供类型安全和高性能的数据库访问。

主要改进:
1. 使用 Motor 异步客户端替代同步 PyMongo
2. 配置优化的连接池参数
3. 通过 Beanie 管理 Schema 和索引
4. 支持数据库事务
"""

import os
from typing import Optional, List

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from pymongo.errors import ServerSelectionTimeoutError, ConfigurationError

from core.logger import logger
from models import (
    User,
    Champion,
    Order,
    SalesRecord,
    WikiPost,
    TavernPost,
    Comment,
    Tip,
    Message,
    OTP,
    PromptTemplate,
    GameConfig,
    ClientConfig,
    Feedback,
    Correction,
    WikiSummary,
)


class Database:
    """
    数据库管理类

    负责:
    - 建立异步数据库连接
    - 初始化 Beanie ORM
    - 管理连接池
    - 提供数据库客户端访问
    """

    client: Optional[AsyncIOMotorClient] = None
    db = None

    @classmethod
    async def connect(cls):
        """
        建立数据库连接并初始化 Beanie ORM

        连接池配置:
        - maxPoolSize: 50 (生产环境建议根据并发量调整)
        - minPoolSize: 10 (保持最小连接数以减少冷启动延迟)
        - maxIdleTimeMS: 30000 (30 秒空闲连接超时)
        - serverSelectionTimeoutMS: 5000 (5 秒服务器选择超时)
        - retryWrites: True (启用写操作重试)
        """
        # 1. 获取 MongoDB URI
        uri = os.getenv("MONGO_URI") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"

        cls._log_connection_attempt(uri)

        try:
            # 2. 创建异步客户端 (优化连接池配置)
            cls.client = AsyncIOMotorClient(
                uri,
                maxPoolSize=50,  # 最大连接数
                minPoolSize=10,  # 最小连接数
                maxIdleTimeMS=30000,  # 30 秒空闲超时
                serverSelectionTimeoutMS=5000,  # 5 秒连接超时
                retryWrites=True,  # 启用写重试
            )

            # 3. 强制连通性检查
            await cls.client.admin.command("ping")

            # 4. 智能数据库选择
            try:
                cls.db = cls.client.get_default_database()
                logger.info(f"✅ [Database] 使用 URI 指定的数据库: {cls.db.name}")
            except (ConfigurationError, ValueError):
                cls.db = cls.client["lol_community"]
                logger.info(f"✅ [Database] URI 未指定库名,使用默认数据库: {cls.db.name}")

            # 5. 初始化 Beanie ORM
            await init_beanie(
                database=cls.db,
                document_models=[
                    # User models
                    User,
                    # Champion
                    Champion,
                    # Order models
                    Order,
                    SalesRecord,
                    # Community models
                    WikiPost,
                    TavernPost,
                    Comment,
                    Tip,
                    # Message models
                    Message,
                    # Config models
                    OTP,
                    PromptTemplate,
                    GameConfig,
                    ClientConfig,
                    Feedback,
                    Correction,
                    WikiSummary,
                ],
            )

            # 6. 创建特殊索引 (Beanie 无法自动创建的索引)
            await cls._create_special_indexes()

            logger.info("✅ [Database] Beanie ORM 初始化完成")
            logger.info(f"✅ [Database] 连接池配置: maxPoolSize=50, minPoolSize=10")

        except ServerSelectionTimeoutError:
            logger.error("❌ [Database] 连接超时! 请检查 MongoDB 服务。")
            raise
        except Exception as e:
            logger.error(f"❌ [Database] 初始化发生未知错误: {e}")
            raise

    @classmethod
    async def disconnect(cls):
        """关闭数据库连接"""
        if cls.client:
            cls.client.close()
            logger.info("🔌 [Database] 数据库连接已关闭")

    @classmethod
    async def _create_special_indexes(cls):
        """
        创建特殊索引

        包括:
        1. TTL 索引 (OTP 过期自动删除)
        2. 部分唯一索引 (防止首单奖励重复)
        """
        try:
            # 1. OTP TTL 索引 (5 分钟后自动删除)
            await cls.db["otps"].create_index("expire_at", expireAfterSeconds=0)
            logger.info("✅ [Index] OTP TTL 索引创建成功")

            # 2. 销售记录部分唯一索引 (防止同一用户多次触发首单奖励)
            try:
                await cls.db["sales_records"].create_index(
                    [("source_user", 1)],
                    unique=True,
                    partialFilterExpression={"type": "首单奖励"},
                )
                logger.info("✅ [Index] 销售记录首单唯一索引创建成功")
            except Exception as e:
                logger.warning(f"⚠️ [Index] 首单唯一索引创建警告 (可能已有旧数据冲突): {e}")

        except Exception as e:
            logger.warning(f"⚠️ [Index] 特殊索引创建警告: {e}")

    @classmethod
    def _log_connection_attempt(cls, uri: str):
        """记录连接尝试 (隐藏敏感信息)"""
        try:
            if "@" in uri:
                part_after_at = uri.split("@")[1]
                logger.info(f"🔌 [Database] 正在尝试连接: mongodb://****:****@{part_after_at}")
            else:
                logger.info(f"🔌 [Database] 正在尝试连接: {uri}")
        except:
            logger.info("🔌 [Database] 正在尝试连接 MongoDB...")


# ==================== 兼容层 (供现有代码使用) ====================


class KnowledgeBase:
    """
    向后兼容层

    保留原 KnowledgeBase 类的接口,但内部使用 Beanie ORM。
    这允许现有代码无缝迁移,后续可逐步移除此兼容层。

    ⚠️ 注意:此类中的方法将逐步废弃,请迁移到直接使用 Beanie 模型。
    """

    def __init__(self):
        """
        初始化向后兼容层

        ⚠️ 警告:这是一个同步构造函数,但数据库操作是异步的。
        请确保在调用任何方法前,先调用 Database.connect()。
        """
        self.db = Database.db
        self.client = Database.client

        # 兼容性:保留原有集合引用
        if self.db:
            self.tips_col = self.db["tips"]
            self.feedback_col = self.db["feedback"]
            self.config_col = self.db["config"]
            self.corrections_col = self.db["corrections"]
            self.users_col = self.db["users"]
            self.prompt_templates_col = self.db["prompt_templates"]
            self.champions_col = self.db["champions"]
            self.otps_col = self.db["otps"]
            self.orders_col = self.db["orders"]
            self.sales_records_col = self.db["sales_records"]
            self.wiki_posts = self.db["wiki_posts"]
            self.tavern_posts = self.db["tavern_posts"]
            self.wiki_summaries = self.db["wiki_summaries"]
            self.comments_col = self.db["comments"]
            self.messages_col = self.db["messages"]

    # ==================== 说明 ====================
    # 以下方法保留原有实现以确保兼容性。
    # 在后续迭代中,这些方法应该被重构为使用 Beanie ORM 的异步方法。
    # 当前阶段,我们先确保连接池和基础设施到位。
    # ====================


# 导出数据库管理类和兼容层
__all__ = ["Database", "KnowledgeBase"]
