import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

def fix_database():
    print("🧹 开始清洗数据库字段...")
    client = MongoClient(MONGO_URI)
    db = client['lol_community']
    
    cursor = db.champions.find({})
    count = 0
    
    for hero in cursor:
        hero_id = hero.get('id')
        alias = hero.get('alias')
        name = hero.get('name')
        
        needs_update = False
        update_fields = {}
        
        # 🛠️ 情况 1: alias 是列表 (你的报错原因)
        # 例如: alias = ["Aatrox", "亚托克斯"] 或 ["剑魔", "亚托克斯"]
        if isinstance(alias, list):
            # 尝试找到英文名 (通常 hero_id 就是英文名，如 Aatrox)
            # 我们把 alias 强制设为 ID (通常是英文 Key)
            update_fields['alias'] = hero_id 
            
            # 尝试从列表里提取中文名赋值给 name
            # 如果原来的 name 是空的，或者也是英文，我们就从 alias 列表里找中文
            if not name or name == hero_id:
                for item in alias:
                    # 简单判断：包含非ascii字符的大概率是中文
                    if any(ord(c) > 127 for c in item):
                        update_fields['name'] = item
                        break
            
            needs_update = True
            print(f"🔧 修复 {hero_id}: List -> Str")

        # 🛠️ 情况 2: alias 是中文 (会导致 OP.GG 404)
        elif isinstance(alias, str) and any(ord(c) > 127 for c in alias):
            # 把中文挪给 name，alias 重置为 id
            update_fields['name'] = alias
            update_fields['alias'] = hero_id
            needs_update = True
            print(f"🔧 修复 {hero_id}: Alias是中文 -> 重置为ID")

        # 执行更新
        if needs_update:
            db.champions.update_one(
                {"_id": hero["_id"]},
                {"$set": update_fields}
            )
            count += 1

    print(f"✅ 清洗完成！共修复了 {count} 个英雄的数据结构。")
    print("现在你可以重新运行 crawl_full_matchups.py 了。")

if __name__ == "__main__":
    fix_database()