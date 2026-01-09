"""
订单与销售模型

定义订单和销售记录相关的 Beanie 文档模型。
"""

from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class Order(Document):
    """
    订单文档模型

    索引策略:
    - order_no: 唯一索引,订单号 (防止重复处理)
    - username: 普通索引,用于查询用户订单历史
    """

    # === 订单信息 ===
    order_no: Indexed(str, unique=True)  # 订单号 (如爱发电订单号)
    username: Indexed(str)  # 购买用户名
    amount: float  # 订单金额 (元)

    # === 充值信息 ===
    days_added: int  # 增加的会员天数
    sku: str  # 商品详情

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "orders"
        indexes = [
            "order_no",
            "username",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "order_no": "20260109123456",
                "username": "player123",
                "amount": 19.90,
                "days_added": 30,
                "sku": "月度会员",
            }
        }


class SalesRecord(Document):
    """
    销售记录文档模型

    用于记录推荐佣金,支持阶梯佣金策略 (首单 40%, 复购 15%)。

    索引策略:
    - order_no: 唯一索引,防止同一订单产生多条佣金记录
    - salesperson: 普通索引,用于查询代理业绩
    - source_user: 部分唯一索引 (type="首单奖励" 时),防止同一用户多次触发首单奖励
    - status: 普通索引,用于区分待结算/已结算订单
    """

    # === 销售信息 ===
    salesperson: Indexed(str)  # 推荐人/代理用户名
    source_user: str  # 购买用户名
    order_amount: float  # 订单金额 (元)

    # === 佣金信息 ===
    commission: float  # 佣金金额 (元)
    rate: str  # 佣金比例 (如 "40%", "15%")
    type: str  # 佣金类型 ("首单奖励", "复购奖励", "老用户复购")

    # === 订单关联 ===
    order_no: Indexed(str, unique=True)  # 关联的订单号 (防止重复佣金)

    # === 结算状态 ===
    status: Indexed(str) = Field(default="pending")  # 状态: "pending" | "paid"
    settled_at: Optional[datetime] = None  # 结算时间
    settled_by: Optional[str] = None  # 结算操作员

    # === 时间戳 ===
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "sales_records"
        indexes = [
            "salesperson",
            [("salesperson", 1), ("created_at", -1)],  # 复合索引,用于查询代理时间线
            [("salesperson", 1), ("status", 1)],  # 复合索引,用于筛选待结算订单
            "order_no",
            "status",
            # 部分唯一索引:防止同一用户多次触发首单奖励
            # 注意:这需要在初始化时通过 create_indexes() 手动创建
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "salesperson": "agent001",
                "source_user": "player123",
                "order_amount": 19.90,
                "commission": 7.96,
                "rate": "40%",
                "type": "首单奖励",
                "order_no": "20260109123456",
                "status": "pending",
            }
        }
