import json
import re
import os
from pathlib import Path

# ================= 配置区域 =================
# 指向你存放 champions.json 的路径
JSON_PATH = "secure_data/champions.json" 
# ===========================================

def normalize_name(name):
    """
    🔥 复刻前端修复后的逻辑：
    只移除 空格(space)、点(.)、横杠(-)、单引号(')
    保留中文、数字、字母
    """
    if not name:
        return ""
    # Python 的正则替换
    return re.sub(r"[\s\.\-\']+", "", str(name)).lower()

def run_test():
    # 1. 加载数据
    if not os.path.exists(JSON_PATH):
        print(f"❌ 错误：找不到文件 {JSON_PATH}")
        print("请确认你把脚本放在了项目根目录，或者修改脚本中的 JSON_PATH")
        return

    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ 成功加载 {len(data)} 个英雄数据")
    except Exception as e:
        print(f"❌ JSON 解析失败: {e}")
        return

    # 2. 构建模拟索引 (模拟前端的查找表)
    lookup_map = {}
    
    print("\n--- 正在构建索引 ---")
    for hero in data:
        real_name = hero.get("name") # 英文 ID (如 LeeSin)
        aliases = hero.get("alias", []) # 中文别名 (如 ["盲僧", "李青"])
        
        # 索引英文名
        norm_eng = normalize_name(real_name)
        lookup_map[norm_eng] = real_name
        
        # 索引中文名
        for alias in aliases:
            norm_cn = normalize_name(alias)
            lookup_map[norm_cn] = real_name

    # 3. 定义测试用例 (模拟你手动选择的情况)
    test_cases = [
        "Lee Sin",      # 带空格英文
        "LeeSin",       # 无空格英文
        "盲僧",         # 中文
        "李青",         # 中文别名
        "Miss Fortune", # 厄运小姐 (带空格)
        "Kai'Sa",       # 卡莎 (带标点)
        "Cho'Gath",     # 大虫子
        "None",         # 应该失败
        "",             # 应该失败
        "未知英雄"       # 应该失败
    ]

    print("\n--- 🔍 开始模拟匹配测试 ---")
    print(f"{'输入 (Input)':<15} | {'处理后 (Norm)':<15} | {'结果 (Result)':<10} | {'匹配ID'}")
    print("-" * 60)

    for input_name in test_cases:
        norm_input = normalize_name(input_name)
        match_id = lookup_map.get(norm_input)
        
        status = "✅ 成功" if match_id else "❌ 失败"
        print(f"{input_name:<15} | {norm_input:<15} | {status:<10} | {match_id}")

    # 4. 交互式测试 (让你手动输入)
    print("\n--- ⌨️ 交互测试模式 (Ctrl+C 退出) ---")
    print("输入你在网页端分路里看到的名字，按回车查看匹配结果：")
    
    while True:
        try:
            user_input = input("\n请输入英雄名 > ").strip()
            if not user_input: continue
            
            norm = normalize_name(user_input)
            result = lookup_map.get(norm)
            
            if result:
                print(f"✅ 匹配成功! 对应英雄ID: 【{result}】")
                # 尝试打印该英雄的详细信息
                hero_data = next((h for h in data if h['name'] == result), None)
                if hero_data:
                    print(f"   数据快照: {json.dumps(hero_data, ensure_ascii=False)}")
            else:
                print(f"❌ 匹配失败! 处理后的Key为: '{norm}'")
                print("   (这意味着 champions.json 里没有这个名字的索引)")
                
        except KeyboardInterrupt:
            print("\n退出测试")
            break

if __name__ == "__main__":
    run_test()