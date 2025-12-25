import requests
import json
import os
import time
import random
from bs4 import BeautifulSoup
from pymongo import MongoClient
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

# ==============================================================================
# 👇👇👇 你的真实浏览器凭证 (已填入) 👇👇👇
# ==============================================================================

# 1. 你的 Edge 浏览器 User-Agent
MANUAL_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0"

# 2. 你的 Cookie (非常长，已完整填入)
MANUAL_COOKIE = "_otm=true; _gcl_au=1.1.31597623.1760884263; _ga=GA1.1.727068952.1760884264; _olvt=false; ac_cclang=; _cc_id=8c36908b4c108aaadc49ddf5f2960665; FCCDCF=%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B32%2C%22%5B%5C%22a256ca98-d447-4e4f-870d-d484ba69ae57%5C%22%2C%5B1762697443%2C827000000%5D%5D%22%5D%5D%5D; _ol=zh_CN; NEXT_LOCALE=zh-cn; _ga_F5C7M64LHP=GS2.1.s1764100998$o1$g1$t1764101015$j60$l0$h0; _lr_env_src_ats=false; pbjs-unifiedid_cst=zix7LPQsHA%3D%3D; _sharedID=5b1284e2-b9e1-460f-90b8-6d2b44f7d79e; _sharedID_cst=zix7LPQsHA%3D%3D; __gads=ID=7de95d0ee9ce5662:T=1765102860:RT=1765102860:S=ALNI_MZ5E14sxLYn5gBPHaYwptcRuZJw3g; __gpi=UID=000011c4ad67c740:T=1765102860:RT=1765102860:S=ALNI_MZXXDbBHIaLsXvUVKrQgS9qOqvqGQ; __eoi=ID=81182042b2fb3a0f:T=1765102860:RT=1765102860:S=AA-Afja3izRYKV9DeWPuuQMyR3DM; _au_1d=AU1D-0100-001765286014-5YRF4OGD-S82Z; _ga_FVWZ0RM4DH=GS2.1.s1765299077$o1$g0$t1765299077$j60$l0$h0; _au_1d=AU1D-0100-001765286014-5YRF4OGD-S82Z; _ga_2H3SPEKBHV=GS2.1.s1765297727$o4$g1$t1765301671$j11$l0$h0; _tft_oft=%7B%22RANKED_TFT%22%3A%22ALL%22%7D; _clck=eiifxt%5E2%5Eg1u%5E0%5E2174; _ga_72NVL1C42W=GS2.1.s1765726404$o1$g0$t1765726430$j34$l0$h0; _ga_XE7Z66Y4W8=GS2.1.s1765726404$o1$g0$t1765726430$j34$l0$h203180518; _rs=%5B%7B%22key%22%3A%22SUMMONER%22%2C%22value%22%3A%22kr%22%7D%2C%7B%22key%22%3A%22CHAMPION%22%2C%22value%22%3A%22kr%22%7D%5D; pbjs-unifiedid=%7B%22TDID%22%3A%229649bd36-3b5d-48d7-adf8-7e862b0d624f%22%2C%22TDID_LOOKUP%22%3A%22FALSE%22%2C%22TDID_CREATED_AT%22%3A%222025-12-16T09%3A23%3A47%22%7D; cto_bundle=QDm8RV9FUEZrNnVCcTlkWFFLTmJMaXNyTnU2ZlNxc1NxeFpDb1MyMmxSVVdhUFVKV0p0UTRRNUp4RjJoOEFIeUpqcVFJOG4lMkZtQkVldFdlSEdNZlVLd2Mxb2JoUzVtVWNkTW1LZ3g5RmN2OFUlMkI1aXl3TSUyRlI3Tk9HcUN1VXQlMkZyWTZMU0NRRkpBUjRhN3BiOTd4R2V6UFhlRnMwUSUzRCUzRA; cto_bidid=CrFkBF9ZVGtTWGlWYUFFZEUwWElVN0VkeGdCc3JGJTJGSlpFdDFWdmNjZXRWWSUyQkFBR2JKZ080Y0RLTEtTWW5lJTJGZUhTdVBRaUJSMVJzejN1ZHRzclBSN1V0YVo5MThSQkpwYmhCNXlUNjJRcTk3ODRtOCUzRA; cto_dna_bundle=K0rxol9FUEZrNnVCcTlkWFFLTmJMaXNyTnUlMkJZT2I0Skl3a0slMkZrek0zJTJCeldKQnVETWRQSG9XdVVaRWFwMyUyQmh4eVhWYmZxbHQwcXIwNk5jS1JBY05HV2NVdWFRJTNEJTNE; _ga_M7E3P87KRC=GS2.1.s1765890886$o45$g1$t1765890900$j46$l0$h1274824721; _ga_G1664XX595=GS2.1.s1765986010$o10$g1$t1765988018$j60$l0$h0; _ga_LY7N9NQLGT=GS2.1.s1765986013$o10$g1$t1765988018$j60$l0$h685168383; ac_user_id=ac0hxs3s01laskmf6784d74e7df9d5cd361de0d4cd02c6d96b6b725080f189495f15ea0cba66830; _opvc=9; _ga_37HQ1LKWBE=GS2.1.s1766678713$o200$g1$t1766678724$j49$l0$h0; _ga_WCXGQGETWH=GS2.1.s1766678713$o188$g1$t1766678724$j49$l0$h1042701514; FCNEC=%5B%5B%22AKsRol9ffAMDV-F0ZgalGsAkiSRtibhPmTXwjciK9mQ0eL5BrGLWoCXvwxCaBEoPtbetjJvUmlXdZf5NQTpTuC8jnG-D4UKJLAte0flyepc_UVtQAK33N_HowzZM1-L9CRpTcF11urXDOFX0qWqNePlClZKoXm4aEQ%3D%3D%22%5D%5D; _ga_HKZFKE5JEL=GS2.1.s1766678713$o204$g1$t1766678767$j60$l0$h0; _ga_HG9DB5ECL8=GS2.1.s1766678713$o192$g1$t1766678767$j6$l0$h584204669; _awl=2.1766678638.5-5485f603fa4a94122532bed7313a77cc-6763652d617369612d6561737431-0"

# ==============================================================================

HEADERS = {
    "User-Agent": MANUAL_USER_AGENT,
    "Cookie": MANUAL_COOKIE,
    "Referer": "https://www.op.gg/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1"
}

def get_db_connection():
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        return client['lol_community']
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return None

def get_hero_list(db):
    """从数据库获取所有英雄"""
    # 优先获取 alias (英文名)，没有则用 id
    cursor = db.champions.find({}, {"id": 1, "alias": 1})
    heroes = []
    for h in cursor:
        if 'alias' in h:
            heroes.append((h['id'], h['alias']))
        elif 'id' in h:
            heroes.append((h['id'], h['id']))
    return heroes

def crawl_hero_matchups(session, hero_alias, hero_id, db):
    """抓取单个英雄数据"""
    
    # 清洗 alias，确保它是纯英文，去除空格
    target_key = hero_alias.strip() if isinstance(hero_alias, str) else str(hero_id)
    
    # 构造 URL (全球服 翡翠+ 段位)
    url = f"https://www.op.gg/champions/{target_key.lower()}?region=global&tier=emerald_plus"
    
    try:
        # 使用 Session 发送请求 (带超时)
        res = session.get(url, headers=HEADERS, timeout=15)
        
        # Cloudflare 拦截检测
        if res.status_code == 403 or "Just a moment" in res.text or "challenge-platform" in res.text:
            print(f"🚫 {target_key} 依然被拦截！Cookie 可能失效，请重新获取。")
            return

        if res.status_code == 404:
            print(f"⚠️ {target_key} 页面不存在 (404)")
            return

        if res.status_code != 200:
            print(f"⚠️ {target_key} 访问失败: {res.status_code}")
            return

        soup = BeautifulSoup(res.text, "html.parser")
        next_data = soup.find("script", {"id": "__NEXT_DATA__"})
        
        if not next_data:
            # 如果 Cookie 还有效但没数据，可能是结构变了
            print(f"⚠️ {target_key} 未找到数据标签 (可能 Cookie 失效或 IP 被限)")
            return

        json_data = json.loads(next_data.string)
        
        # 提取对位数据 (多路径容错)
        counters_data = None
        try:
            # 路径 1: 常规路径
            counters_data = json_data.get('props', {}).get('pageProps', {}).get('counters')
            # 路径 2: 备用路径 (Analysis)
            if not counters_data:
                counters_data = json_data.get('props', {}).get('pageProps', {}).get('championAnalysis', {}).get('counters')
        except:
            pass

        if not counters_data:
            # 部分英雄可能没有足够对局数据，这是正常的
            return

        matchup_docs = []
        for role, counters in counters_data.items():
            if not counters: continue
            
            for enemy in counters:
                # 过滤场次过少的数据
                total_games = enemy.get('play', 0)
                if total_games < 50: continue 
                
                win_rate = enemy.get('win', 0) / total_games
                lane_kill_rate = enemy.get('lane_kill', 0) / total_games
                first_tower_rate = enemy.get('first_tower', 0) / total_games
                
                doc = {
                    "hero_id": str(hero_id),
                    "hero_alias": str(target_key),
                    "enemy_id": str(enemy['champion_id']),
                    "role": role.upper(),
                    "win_rate": win_rate,
                    "lane_kill_rate": lane_kill_rate,
                    "kda": enemy.get('kda', 0),
                    "kill_participation": enemy.get('kill_participation', 0),
                    "first_tower": first_tower_rate,
                    "total_games": total_games,
                    "updated_at": time.time()
                }
                matchup_docs.append(doc)

        # 写入数据库 (Upsert)
        if matchup_docs:
            for doc in matchup_docs:
                db.matchups.update_one(
                    {"hero_id": doc['hero_id'], "enemy_id": doc['enemy_id'], "role": doc['role']},
                    {"$set": doc},
                    upsert=True
                )
            print(f"✅ {target_key}: 更新 {len(matchup_docs)} 条数据")
        
        # 既然用了手动 Cookie，可以适当减少延迟，但不要太快
        time.sleep(random.uniform(0.5, 1.5))

    except Exception as e:
        print(f"❌ {target_key} 异常: {str(e)[:50]}")

if __name__ == "__main__":
    db = get_db_connection()
    if db is not None:
        session = requests.Session()
        heroes = get_hero_list(db)
        print(f"📋 任务开始: 共 {len(heroes)} 个英雄 (Manual Cookie Mode)")
        
        for i, (hid, alias) in enumerate(heroes):
            # 打印进度，不换行 (直到成功或失败)
            print(f"[{i+1}/{len(heroes)}] ", end="")
            crawl_hero_matchups(session, alias, hid, db)
            
        print("\n🎉 全量抓取完成！现在你的数据库拥有最强的对位数据了。")