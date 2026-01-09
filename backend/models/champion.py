"""
英雄模型

定义英雄相关的 Beanie 文档模型。
"""

from beanie import Document, Indexed
from pydantic import Field


class Champion(Document):
    """
    英雄文档模型

    索引策略:
    - id: 唯一索引,英雄 ID (如 "Yasuo")
    - name: 普通索引,英雄名称
    - alias: 多值索引,英雄别名列表
    """

    # === 基础信息 ===
    id: Indexed(str, unique=True)  # 英雄唯一标识符 (如 "Yasuo")
    name: Indexed(str)  # 英雄名称 (如 "亚索")
    alias: list[str] = Field(default_factory=list)  # 别名列表 (如 ["快乐风男", "托儿索"])

    # === 游戏属性 ===
    role: str  # 主定位 (如 "Fighter", "Mage")
    tier: str = Field(default="unknown")  # 强度评级 (如 "S", "A", "B")
    positions: list[str] = Field(default_factory=list)  # 可用位置 (如 ["mid", "top"])

    # === 机制与特性 ===
    mechanic_type: str = Field(default="通用英雄")  # 机制类型 (如 "风墙英雄", "突进英雄")
    power_spike: str = Field(default="全期")  # 强势期 (如 "前期", "中期", "后期")

    # === 额外数据 ===
    tags: list[str] = Field(default_factory=list)  # 标签 (如 ["高机动", "高爆发"])
    difficulty: str = Field(default="medium")  # 难度 (如 "easy", "medium", "hard")

    class Settings:
        name = "champions"
        indexes = [
            "id",
            "name",
            "alias",
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "id": "Yasuo",
                "name": "亚索",
                "alias": ["快乐风男", "托儿索", "0-10"],
                "role": "Fighter",
                "tier": "S",
                "positions": ["mid", "top"],
                "mechanic_type": "风墙英雄",
                "power_spike": "中期",
                "tags": ["高机动", "高风险高回报"],
                "difficulty": "hard",
            }
        }
