import json
import os
import datetime
import re
import sys
import bcrypt
# 1. 修复 AttributeError: module 'bcrypt' has no attribute '__about__'
# bcrypt 4.0+ 移除了这个属性，但 passlib 依赖它来检测版本。
try:
    bcrypt.__about__
except AttributeError:
    # 手动注入一个伪造的 __about__ 属性
    bcrypt.__about__ = type("about", (object,), {"__version__": bcrypt.__version__})


# 2. 修复 ValueError: password cannot be longer than 72 bytes
# passlib 启动时会故意传入一个超长密码给 bcrypt 跑测试，旧版会自动截断，新版会报错。
# 我们劫持 bcrypt.hashpw 方法，当遇到这个特定错误时，模仿旧版行为（自动截断）。
_orig_hashpw = bcrypt.hashpw

def _patched_hashpw(password, salt):
    try:
        return _orig_hashpw(password, salt)
    except ValueError as e:
        # 只有当错误信息明确是关于 72 字节长度限制时，才进行拦截处理
        if "72 bytes" in str(e):
            # 将密码截断到 72 字节，骗过 passlib 的启动检测
            # 注意：这不会影响你正常的管理员密码，除非你的管理员密码真有 72 位长
            return _orig_hashpw(password[:72], salt)
        # 如果是其他错误，照常抛出
        raise e
bcrypt.hashpw = _patched_hashpw
from pymongo import MongoClient
from passlib.context import CryptContext
from dotenv import load_dotenv
import openai
# 加载环境变量
load_dotenv()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

def load_json(filename):
    """尝试从 secure_data 文件夹读取 JSON"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "secure_data", filename)
    if not os.path.exists(file_path):
        print(f"⚠️ [提示] 本地文件未找到: {filename}")
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ [错误] 读取 {filename} 失败: {e}")
        return None

# ✨ 辅助函数：清洗百分比字符串 ("50.87%" -> 0.5087)
def parse_percent(val):
    if isinstance(val, str):
        clean = val.replace("%", "").strip()
        try:
            return float(clean) / 100.0
        except:
            return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    return 0.0

# ✨ 辅助函数：清洗层级 ("T1" -> 1)
def parse_tier(val):
    if isinstance(val, int): return val
    if isinstance(val, str):
        clean = val.upper().replace("T", "").strip()
        if clean.isdigit():
            return int(clean)
    return 5 # 默认 T5

# ✨ 辅助函数：判断是否包含中文字符
def has_chinese(text):
    for char in text:
        if '\u4e00' <= char <= '\u9fff':
            return True
    return False

# ✨ 新增：获取当前 UTC 时间
def get_utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

def seed_data():
    print("🌱 [Seeding] 启动全量更新程序 (多分路适配版)...")
    
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        print("✅ 数据库连接成功")
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        return

    db = client["lol_community"]

    # =====================================================
    # 1. 同步英雄数据 (Champions) - 核心升级逻辑
    # =====================================================
    print("\n🚀 [1/4] 更新英雄数据 (支持多位置合并)...")
    
    champs_data = load_json("champions.json")
    if champs_data:
        # 1. 清空旧数据
        delete_result = db.champions.delete_many({})
        print(f"🧹 已清空旧表 (删除了 {delete_result.deleted_count} 条)")
        
        # 2. 内存字典：用于合并同一个英雄的不同分路数据
        # 结构: { "Ambessa": { base_info..., positions: { "TOP": {...}, "MID": {...} } } }
        hero_map = {}

        for hero in champs_data:
            try:
                # 确定英文 ID
                hero_id = hero.get("name") 
                if not hero_id: continue
                
                # 当前这条数据的分路 (标准化为大写)
                role = hero.get("role", "MID").upper()
                
                # 准备这条数据的 详细Stats
                stats_block = {
                    "role": role,
                    "tier": parse_tier(hero.get("tier")),
                    "win_rate": parse_percent(hero.get("win_rate")),
                    "pick_rate": parse_percent(hero.get("pick_rate")),
                    "ban_rate": parse_percent(hero.get("ban_rate"))
                }

                # 如果是第一次遇到这个英雄，初始化基础信息
                if hero_id not in hero_map:
                    # 智能提取中文名
                    display_name = hero_id
                    alias_list = hero.get("alias", [])
                    chinese_aliases = [a for a in alias_list if has_chinese(a)]
                    if chinese_aliases:
                        chinese_aliases.sort(key=len)
                        display_name = chinese_aliases[0]

                    hero_map[hero_id] = {
                        "id": str(hero_id),
                        "_id": str(hero_id),
                        "name": display_name,
                        "alias": alias_list,
                        "tags": [t.capitalize() for t in hero.get("tags", [])],
                        "updated_at": get_utc_now(),
                        
                        # ✨ 核心：初始化 positions 字典
                        "positions": {},
                        
                        # 保留一份“主数据”在根目录，防止某些旧逻辑报错
                        # (默认存第一条遇到的，后面会根据 Pick率 修正)
                        "tier": stats_block["tier"],
                        "win_rate": stats_block["win_rate"],
                        "role": role 
                    }
                
                # 将当前分路数据 存入 positions
                hero_map[hero_id]["positions"][role] = stats_block
                
                # (可选) 更新主数据：如果当前分路的 Pick 率更高，就把它作为主显示数据
                current_main_pick = hero_map[hero_id].get("pick_rate", 0)
                if stats_block["pick_rate"] > current_main_pick:
                     hero_map[hero_id]["tier"] = stats_block["tier"]
                     hero_map[hero_id]["win_rate"] = stats_block["win_rate"]
                     hero_map[hero_id]["pick_rate"] = stats_block["pick_rate"]
                     hero_map[hero_id]["ban_rate"] = stats_block["ban_rate"]
                     hero_map[hero_id]["role"] = role # 更新为主位置

            except Exception as e:
                print(f"⚠️ 数据格式错误: {hero.get('name')} - {e}")

        # 3. 将字典转为列表并写入
        batch_docs = list(hero_map.values())

        if batch_docs:
            try:
                db.champions.insert_many(batch_docs)
                print(f"✅ 成功写入 {len(batch_docs)} 个英雄 (已合并 {len(champs_data)} 条分路数据)")
            except Exception as e:
                print(f"❌ 写入失败: {e}")
    else:
        print("⚠️ 未找到 champions.json，跳过更新")

    # =====================================================
    # 2. 同步 Prompts
    # =====================================================
    print("\n🚀 [2/4] 更新 Prompt 模板...")
    prompts_data = load_json("prompts.json")
    if prompts_data:
        db.prompt_templates.delete_many({}) 
        items = prompts_data if isinstance(prompts_data, list) else list(prompts_data.values())
        for item in items:
            p_id = item.get("id") or item.get("_id") or item.get("mode")
            if p_id:
                item["_id"] = p_id
                db.prompt_templates.replace_one({"_id": p_id}, item, upsert=True)
        print("✅ Prompts 已更新")

    # =====================================================
    # 3. 同步 S15 机制
    # =====================================================
    print("\n🚀 [3/4] 更新 S15 数据...")
    s15_json = load_json("s15_mechanics.json")
    if s15_json:
        s15_json["_id"] = "s15_rules"
        db.config.replace_one({"_id": "s15_rules"}, s15_json, upsert=True)
        print("✅ S15 规则已更新")

    # =====================================================
    # 4. 管理员账号
    # =====================================================
    print("\n🚀 [4/4] 强制更新管理员账号...")
    admin_pass = os.getenv("ADMIN_PASSWORD")
    if admin_pass:
        admin_user = os.getenv("ADMIN_USERNAME", "admin")
        hashed = pwd_context.hash(admin_pass)
        
        # 👇 新逻辑：不管有没有，强制把密码和权限刷进去
        db.users.update_one(
            {"username": admin_user},
            {
                "$set": {
                    "password": hashed, 
                    "role": "admin", 
                    "is_pro": True
                },
                "$setOnInsert": {"created_at": get_utc_now()} # 只有新建时才写入创建时间
            },
            upsert=True # 如果不存在就创建，存在就更新
        )
        print(f"✅ 管理员 {admin_user} 密码已强制重置！")

if __name__ == "__main__":
    seed_data()