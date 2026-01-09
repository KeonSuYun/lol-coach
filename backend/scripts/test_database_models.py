#!/usr/bin/env python
"""
数据库模型验证脚本

用于验证 Beanie 模型定义和数据库连接是否正确配置。
"""

import asyncio
import sys
import os

# 添加项目根目录到 Python 路径
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from core.database_new import Database
from core.logger import logger


async def test_database_connection():
    """测试数据库连接和 Beanie 初始化"""
    try:
        logger.info("🧪 [Test] 开始测试数据库连接...")

        # 1. 连接数据库
        await Database.connect()
        logger.info("✅ [Test] 数据库连接成功")

        # 2. 验证数据库实例
        if Database.db is None:
            raise RuntimeError("数据库实例为空")
        logger.info(f"✅ [Test] 数据库名称: {Database.db.name}")

        # 3. 列出所有集合
        collections = await Database.db.list_collection_names()
        logger.info(f"✅ [Test] 现有集合数量: {len(collections)}")
        logger.info(f"📋 [Test] 集合列表: {', '.join(collections[:5])}...")

        # 4. 测试导入所有模型
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
        logger.info("✅ [Test] 所有模型导入成功")

        # 5. 验证模型数量
        model_count = len([
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
        ])
        logger.info(f"✅ [Test] 注册的模型数量: {model_count}")

        # 6. 测试简单查询 (不会修改数据)
        user_count = await User.count()
        logger.info(f"✅ [Test] 用户数量: {user_count}")

        champion_count = await Champion.count()
        logger.info(f"✅ [Test] 英雄数量: {champion_count}")

        logger.info("🎉 [Test] 所有测试通过!")

    except Exception as e:
        logger.error(f"❌ [Test] 测试失败: {e}")
        import traceback

        traceback.print_exc()
        return False

    finally:
        # 断开连接
        await Database.disconnect()
        logger.info("🔌 [Test] 数据库连接已关闭")

    return True


async def main():
    """主函数"""
    success = await test_database_connection()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
