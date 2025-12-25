import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

# 🇨🇳 国服常见外号字典
# Key = 英文ID (Alias), Value = 外号列表
NICKNAMES = {
    "Malphite": ["石头人", "混分巨兽"],
    "Blitzcrank": ["机器人"],
    "JarvanIV": ["皇子"],
    "KogMaw": ["大嘴"],
    "Twitch": ["老鼠"],
    "Cassiopeia": ["蛇女"],
    "MonkeyKing": ["猴子"],
    "Alistar": ["牛头"],
    "Sivir": ["轮子妈"],
    "Vayne": ["VN", "薇恩"],
    "LeeSin": ["瞎子", "盲僧"],
    "Lucian": ["卢仙", "奥巴马"],
    "Hecarim": ["人马"],
    "Rengar": ["狮子狗"],
    "Khazix": ["螳螂"],
    "Vladimir": ["吸血鬼"],
    "Fizz": ["小鱼人"],
    "TwistedFate": ["卡牌"],
    "MissFortune": ["女枪", "好运姐"],
    "Irelia": ["刀妹"],
    "Jax": ["武器大师", "武器"],
    "Karthus": ["死歌"],
    "ChoGath": ["大虫子"],
    "Amumu": ["阿木木"],
    "Anivia": ["冰鸟"],
    "Rammus": ["龙龟"],
    "Warwick": ["狼人"],
    "Teemo": ["提莫", "提百万"],
    "Tristana": ["小炮"],
    "Ryze": ["瑞兹", "光头"],
    "Tryndamere": ["蛮王"],
    "MasterYi": ["剑圣", "JS"],
    "Kalista": ["滑板鞋"],
    "Kindred": ["千珏"],
    "TahmKench": ["塔姆", "蛤蟆"],
    "AurelionSol": ["龙王"],
    "Jhin": ["烬", "望远烬"],
    "Volibear": ["狗熊"],
    "Yuumi": ["猫咪", "挂件"]
}

def inject_nicknames():
    print("💉 正在注入国服外号库...")
    client = MongoClient(MONGO_URI)
    db = client['lol_community']
    
    count = 0
    for alias, nicknames in NICKNAMES.items():
        # 我们把外号加到 'keywords' 字段，不破坏原有的 name 和 alias
        # 或者更简单粗暴一点：直接拼接到 name 后面，方便前端直接搜
        
        # 方案：新增 keywords 字段
        result = db.champions.update_one(
            {"alias": alias}, # 查找英文名为 Malphite 的英雄
            {"$set": {"keywords": nicknames}}
        )
        if result.modified_count > 0:
            print(f"✅ {alias} -> {nicknames}")
            count += 1
            
    print(f"🎉 注入完成！共更新 {count} 个英雄的外号。")

if __name__ == "__main__":
    inject_nicknames()