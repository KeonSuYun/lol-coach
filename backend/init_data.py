# init_data.py
import os
import sys
import json
from dotenv import load_dotenv

# 引入后端逻辑
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from core.database import KnowledgeBase

# 颜色
GREEN = "\033[92m"
YELLOW = "\033[93m"
RESET = "\033[0m"

def seed_champions():
    print(f"{YELLOW}🌱 [数据初始化] 开始导入英雄数据...{RESET}")
    
    try:
        db = KnowledgeBase()
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return

    # 1. 定位 JSON 文件
    json_path = os.path.join(os.path.dirname(__file__), "secure_data", "champions.json")
    
    if not os.path.exists(json_path):
        print(f"❌ 未找到数据文件: {json_path}")
        print("   请确保您已将 champions.json 放入 backend/secure_data/ 目录。")
        return

    # 2. 读取数据
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print(f"   📖 读取到 {len(data)} 个英雄数据")

    # 3. 写入数据库
    # 先清空旧数据，防止重复
    db.champions_col.delete_many({})
    
    if isinstance(data, list):
        db.champions_col.insert_many(data)
    else:
        print("❌ JSON 格式错误：根节点应该是列表")
        return

    # 4. 验证
    count = db.champions_col.count_documents({})
    print(f"{GREEN}✅ 成功导入 {count} 个英雄到数据库！{RESET}")
    
    # 5. 简单测试
    test_hero = db.get_champion_info("LeeSin")
    if test_hero and test_hero.get("name") == "Lee Sin":
        print(f"{GREEN}   🔍 验证查询成功: LeeSin -> {test_hero['name']}{RESET}")
    else:
        print(f"   ⚠️ 验证查询异常 (但这不影响数据已导入)")

if __name__ == "__main__":
    seed_champions()