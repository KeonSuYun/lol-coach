# backend/seed_data.py
from core.database import KnowledgeBase

# 初始化数据库连接
db = KnowledgeBase()

# 定义你要上传的固定“官方攻略”
# 可以是通用的英雄技巧，也可以是特定对局逻辑
official_guides = [
    {
        "hero": "Aatrox",
        "enemy": "general", # 通用技巧
        "content": "[官方数据] 剑魔Q技能前两段边缘有击飞，E技能可以重置普攻并穿墙。",
        "author_id": "official_guide",
        "is_general": True
    },
    {
        "hero": "Malphite",
        "enemy": "Sylas", # 特定对位
        "content": "[机制逻辑] 塞拉斯偷取石头人R后，虽然有AP加成，但石头人出肉可以有效规避爆发，且石头人E技能可以减少塞拉斯攻速。",
        "author_id": "official_guide",
        "is_general": False
    },
    # 你可以在这里添加成百上千条...
]

print(f"🚀 开始写入 {len(official_guides)} 条基础数据...")

for item in official_guides:
    # 复用你在 database.py 里写好的 add_tip 方法
    db.add_tip(
        hero=item["hero"],
        enemy=item["enemy"],
        content=item["content"],
        author_id=item["author_id"],
        is_general=item["is_general"]
    )

print("✅ 数据播种完成！")