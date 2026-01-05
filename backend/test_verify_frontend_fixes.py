import pymongo
import datetime
import json
import time

# ================= ⚙️ 配置区域 =================
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "lol_community"  # 确保与 server.py 一致

class C:
    OK = '\033[92m'       # 绿
    WARN = '\033[93m'     # 黄
    FAIL = '\033[91m'     # 红
    CYAN = '\033[96m'     # 青
    END = '\033[0m'

def get_db():
    try:
        client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        client.admin.command('ping')
        return client[DB_NAME]
    except Exception as e:
        print(f"{C.FAIL}❌ 无法连接数据库: {e}{C.END}")
        return None

# -----------------------------------------------------------
# 🧪 测试 1: 验证管理后台是否兼容 snake_case (game_name)
# -----------------------------------------------------------
def verify_admin_display_fix(db):
    print(f"\n{C.CYAN}🧪 [测试 1] 验证后台显示修复 (Snake Case Support)...{C.END}")
    
    # 1. 构造一个只有 game_name (没有 gameName) 的“刁钻”数据
    test_user = "Test_Display_Fix_User"
    db.users.delete_one({"username": test_user}) # 清理旧数据
    
    mock_profile = {
        # 🔥 关键点：这是后端 sync 接口写入的格式，以前前端读不到这个
        "game_name": "FixSuccess",  
        "tag_line": "888",
        "rank": "Challenger"
    }
    
    db.users.insert_one({
        "username": test_user,
        "role": "user",
        "email": "fix_test@hex.gg",
        "created_at": datetime.datetime.now(),
        "game_profile": json.dumps(mock_profile) # 模拟存入 JSON 字符串的情况
    })
    
    print(f"   ✅ 已向数据库注入测试用户: [{test_user}]")
    print(f"      数据特征: 仅包含 game_name='FixSuccess', 无 camelCase 字段。")
    print(f"\n   👉 {C.WARN}请现在打开您的【管理后台 -> 用户管理】，搜索 '{test_user}'{C.END}")
    print(f"      - 如果看到游戏ID显示为: {C.OK}FixSuccess #888{C.END} -> 修复成功！🎉")
    print(f"      - 如果显示 '未同步' -> 修复失败。")

# -----------------------------------------------------------
# 🧪 测试 2: 验证用户反馈是否包含阵容快照
# -----------------------------------------------------------
def verify_feedback_context_fix(db):
    print(f"\n{C.CYAN}🧪 [测试 2] 验证反馈快照增强 (Match Context)...{C.END}")
    print(f"   👉 请保持本脚本运行，现在去您的网页/客户端中：")
    print(f"      1. 随便选几个英雄")
    print(f"      2. 点击【反馈】(感叹号图标)")
    print(f"      3. 输入内容 'test snapshot' 并提交")
    
    print(f"\n   {C.WARN}⏳ 正在监听数据库最新反馈... (按 Ctrl+C 取消){C.END}")
    
    # 获取当前最新的反馈时间，只监听这之后的
    last_record = db.feedback.find_one(sort=[("created_at", -1)])
    start_time = last_record['created_at'] if last_record else datetime.datetime.min
    
    try:
        while True:
            # 轮询查找更新的反馈
            latest = db.feedback.find_one(sort=[("created_at", -1)])
            
            if latest and latest['created_at'] > start_time:
                print(f"\n   🎉 捕获到新反馈！ID: {latest['_id']}")
                print(f"      用户描述: {latest.get('description')}")
                
                context = latest.get('match_context', {})
                
                # 检查关键字段是否存在
                print(f"\n   🔍 正在核查快照数据...")
                
                checks = [
                    ("mapSide", "红蓝方信息"),
                    ("myTeam", "我方阵容"),
                    ("enemyTeam", "敌方阵容"),
                    ("laneAssignments", "分路信息")
                ]
                
                all_passed = True
                for field, label in checks:
                    if field in context and context[field]:
                        val = context[field]
                        # 简单的非空检查
                        is_valid = len(val) > 0 if isinstance(val, (list, dict, str)) else True
                        if is_valid:
                            print(f"      ✅ {label}: 获取成功 ({str(val)[:30]}...)")
                        else:
                            print(f"      ⚠️ {label}: 存在但为空")
                    else:
                        print(f"      ❌ {label}: 缺失！")
                        all_passed = False
                
                if all_passed:
                    print(f"\n   {C.OK}✨ 验证通过！前端已成功上传完整对局快照。{C.END}")
                else:
                    print(f"\n   {C.FAIL}💥 验证失败：部分数据缺失，请检查 hook 代码。{C.END}")
                
                break # 结束监听
            
            time.sleep(1) # 1秒查一次
            print(".", end="", flush=True)
            
    except KeyboardInterrupt:
        print("\n   已停止监听。")

if __name__ == "__main__":
    db = get_db()
    if db is not None:
        verify_admin_display_fix(db)
        verify_feedback_context_fix(db)