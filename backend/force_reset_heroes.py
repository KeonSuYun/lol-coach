import requests
import os
from pymongo import MongoClient
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

def force_reset():
    print("🔥 正在初始化强制重置程序...")
    
    # 1. 连接数据库
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        db = client['lol_community']
        print("🔌 数据库连接成功")
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return

    # 2. 获取最新版本号
    try:
        ver_res = requests.get("https://ddragon.leagueoflegends.com/api/versions.json")
        version = ver_res.json()[0]
        print(f"📦 检测到最新版本: {version}")
    except:
        print("❌ 无法获取版本号，请检查网络")
        return

    # 3. 下载官方标准数据
    print("⬇️ 正在从 Riot DDragon 下载标准数据...")
    url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/zh_CN/championFull.json"
    res = requests.get(url)
    if res.status_code != 200:
        print("❌ 下载失败")
        return
    
    data = res.json()["data"]
    
    # 4. 彻底清空旧表
    count_before = db.champions.count_documents({})
    db.champions.delete_many({})
    print(f"🧹 已清空旧数据 (共删除 {count_before} 条)")

    # 5. 写入标准数据
    new_heroes = []
    for key, hero in data.items():
        # ⚡⚡⚡ 核心逻辑：强制规范化字段 ⚡⚡⚡
        # OP.GG 爬虫需要英文名 (例如 Aatrox)
        # 前端显示需要中文名 (例如 亚托克斯)
        
        doc = {
            "id": hero["key"],          # 数字 ID "266"
            "alias": hero["id"],        # 英文名 "Aatrox" (❌ 绝对不会是列表!)
            "name": hero["name"],       # 中文名 "亚托克斯"
            "title": hero["title"],     # 称号 "暗裔剑魔"
            "image_url": f"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{hero['id']}.png",
            "tags": hero["tags"],
            "stats": hero["stats"]
        }
        new_heroes.append(doc)

    if new_heroes:
        db.champions.insert_many(new_heroes)
        print(f"✅ 写入成功！共 {len(new_heroes)} 个英雄。")
        print("✨ 数据结构已完美修复：alias=英文, name=中文。")
        
        # 顺便更新一下 config 里的版本号
        db.config.update_one(
            {"_id": "s15_rules"}, 
            {"$set": {"patch_version": version}},
            upsert=True
        )
    else:
        print("⚠️ 数据处理异常，列表为空")

if __name__ == "__main__":
    force_reset()