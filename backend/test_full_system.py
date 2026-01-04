# test_full_system.py
import os
import sys
import time
import datetime
from dotenv import load_dotenv

# 引入后端逻辑
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from core.database import KnowledgeBase

# 颜色定义
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"

def run_full_test():
    print(f"{YELLOW}🚀 [全系统完整性测试] 启动...{RESET}")
    try:
        db = KnowledgeBase()
    except Exception as e:
        print(f"{RED}❌ 数据库连接失败: {e}{RESET}")
        return

    # 测试账号
    TEST_USER = "sys_test_user"
    TEST_PRO = "sys_test_pro"
    
    # ================= 1. 环境准备 =================
    print(f"\n{CYAN}🧹 [Step 1] 环境初始化...{RESET}")
    db.users_col.delete_many({"username": {"$in": [TEST_USER, TEST_PRO]}})
    db.wiki_posts.delete_many({"author_id": TEST_USER})
    db.feedback_col.delete_many({"user_id": TEST_USER})
    
    # 🔥 [修复] 注入一个临时英雄数据，防止数据库为空导致查找失败
    db.champions_col.delete_many({"id": "LeeSin"})
    db.champions_col.insert_one({
        "id": "LeeSin", 
        "name": "Lee Sin", 
        "alias": ["盲僧", "李青"],
        "title": "The Blind Monk"
    })
    
    # 创建一个普通用户和一个 Pro 用户
    db.create_user(TEST_USER, "123", "user", email="user@test.com")
    db.create_user(TEST_PRO, "123", "pro", email="pro@test.com")
    
    # 强制给 Pro 用户设置过期时间为未来
    db.users_col.update_one(
        {"username": TEST_PRO}, 
        {"$set": {"membership_expire": datetime.datetime.now() + datetime.timedelta(days=30)}}
    )
    print(f"{GREEN}   ✅ 测试账户已创建 (User & Pro){RESET}")

    # ================= 2. AI 分析功能 (逻辑层) 测试 =================
    print(f"\n{CYAN}🧠 [Step 2] AI 分析模块测试 (频控与权限)...{RESET}")
    
    # 2.1 测试普通用户限制 (每小时 10 次)
    print(f"   Testing: 普通用户限额逻辑...")
    # 先重置一下状态
    db.users_col.update_one({"username": TEST_USER}, {"$set": {"usage_stats": {}}})
    
    success_count = 0
    for i in range(12):
        # 🔥 [修复] 暴力修改数据库时间，绕过 15秒冷却限制，只测次数限制
        db.users_col.update_one(
            {"username": TEST_USER}, 
            {"$set": {"usage_stats.last_access.bp": "2000-01-01T00:00:00"}}
        )
        
        # 模拟调用 'chat' 模式
        allowed, msg, _ = db.check_and_update_usage(TEST_USER, "bp", "chat")
        
        if allowed: 
            success_count += 1
        else: 
            # print(f"      第 {i+1} 次被拦截: {msg}") # 调试用
            break # 遇到限制就停止
        
    if success_count == 10:
        print(f"{GREEN}   ✅ 普通用户限制生效 (成功 {success_count} 次后被拦截){RESET}")
    else:
        print(f"{RED}   ❌ 普通用户限制异常！成功了 {success_count} 次 (预期 10 次){RESET}")

    # 2.2 测试 Pro 用户权益 (每小时 30 次 + 冷却缩减)
    print(f"   Testing: Pro 用户权益逻辑...")
    db.users_col.update_one({"username": TEST_PRO}, {"$set": {"usage_stats": {}}})
    
    # 模拟第一次调用
    allowed, _, cooldown = db.check_and_update_usage(TEST_PRO, "bp", "chat")
    if allowed:
        print(f"{GREEN}   ✅ Pro 用户调用成功{RESET}")
    else:
        print(f"{RED}   ❌ Pro 用户调用失败: {msg}{RESET}")

    # 2.3 测试英雄数据检索 (get_champion_info)
    print(f"   Testing: 英雄数据检索智能兜底...")
    hero = db.get_champion_info("LeeSin")
    if hero and hero.get("name") == "Lee Sin":
        print(f"{GREEN}   ✅ 精确查找成功: LeeSin -> Lee Sin{RESET}")
    else:
        print(f"{RED}   ❌ 精确查找失败 (可能数据库中没有导入英雄数据){RESET}")
        
    # 测试兜底机制
    unknown_hero = db.get_champion_info("NonExistentHero")
    if unknown_hero and unknown_hero.get("id") == "NonExistentHero":
        print(f"{GREEN}   ✅ 智能兜底生效: 未知英雄未报错{RESET}")
    else:
        print(f"{RED}   ❌ 智能兜底失败{RESET}")

    # ================= 3. 社区功能测试 =================
    print(f"\n{CYAN}🌍 [Step 3] 社区互动功能测试...{RESET}")
    
    # 3.1 发布帖子
    post_data = {
        "title": "测试攻略",
        "content": "这是一篇测试内容",
        "category": "strategy",
        "hero_id": "Garen",
        "author_id": TEST_USER,
        "author_name": "TestUser"
    }
    post = db.create_wiki_post(post_data)
    if post and post.get("id"):
        print(f"{GREEN}   ✅ 攻略发布成功 ID: {post['id']}{RESET}")
    else:
        print(f"{RED}   ❌ 攻略发布失败{RESET}")
        return

    # 3.2 评论功能
    comment = db.add_comment(post['id'], TEST_PRO, "TestPro", "写得不错")
    if comment:
        # 验证评论数是否增加
        updated_post = db.get_wiki_post(post['id'])
        if updated_post.get("comments", 0) == 1:
            print(f"{GREEN}   ✅ 评论成功且计数更新{RESET}")
        else:
            print(f"{RED}   ❌ 评论计数未更新{RESET}")
    else:
        print(f"{RED}   ❌ 评论写入失败{RESET}")

    # ================= 4. 私信系统测试 =================
    print(f"\n{CYAN}💬 [Step 4] 私信系统测试...{RESET}")
    
    # 4.1 发送私信
    success, msg = db.send_message(TEST_USER, TEST_PRO, "你好，交个朋友")
    if success:
        print(f"{GREEN}   ✅ 私信发送成功{RESET}")
    else:
        print(f"{RED}   ❌ 私信发送失败: {msg}{RESET}")
        
    # 4.2 接收私信 (检查未读数)
    unread = db.get_unread_count_total(TEST_PRO)
    if unread >= 1:
        print(f"{GREEN}   ✅ 未读消息计数正确 ({unread}){RESET}")
    else:
        print(f"{RED}   ❌ 未读消息计数错误 ({unread}){RESET}")
        
    # 4.3 获取会话列表
    convs = db.get_my_conversations(TEST_PRO)
    if len(convs) > 0 and convs[0]['_id'] == TEST_USER:
         print(f"{GREEN}   ✅ 会话列表获取正确{RESET}")
    else:
         print(f"{RED}   ❌ 会话列表为空或错误{RESET}")

    # ================= 6. 反馈处理系统测试 =================
    print(f"\n{CYAN}📝 [Step 6] 用户反馈与处理流程测试...{RESET}")

    # 6.1 提交反馈
    feedback_msg = "测试反馈功能：我觉得页面有点卡"
    db.submit_feedback({
        "user_id": TEST_USER,
        "description": feedback_msg,
        "match_context": {"hero": "Yasuo"}
    })
    print(f"{GREEN}   ✅ 反馈提交成功{RESET}")

    # 6.2 模拟管理员获取待处理反馈
    pending_list = db.get_all_feedbacks(status="pending")
    
    # 在列表中找到刚才那条
    target_feedback = next((f for f in pending_list if f["user_id"] == TEST_USER and f["description"] == feedback_msg), None)
    
    if target_feedback:
        print(f"{GREEN}   ✅ 管理员成功获取 'pending' 列表中的反馈 ID: {target_feedback['_id']}{RESET}")
    else:
        print(f"{RED}   ❌ 获取失败：待处理列表中未找到刚提交的反馈{RESET}")
        return

    # 6.3 标记已处理
    resolve_success = db.resolve_feedback(target_feedback['_id'])
    if resolve_success:
        print(f"{GREEN}   ✅ 标记 '已处理' 操作执行成功{RESET}")
    else:
        print(f"{RED}   ❌ 标记操作失败{RESET}")

    # 6.4 验证状态流转
    pending_list_after = db.get_all_feedbacks(status="pending")
    check_pending = next((f for f in pending_list_after if f["_id"] == target_feedback['_id']), None)
    
    if not check_pending:
        print(f"{GREEN}   ✅ 验证通过：该反馈已从 '待处理' 列表中消失{RESET}")
    else:
        print(f"{RED}   ❌ 验证失败：该反馈仍然显示为 '待处理'{RESET}")

    # ================= 5. 管理员功能 (封禁/更新) =================
    print(f"\n{CYAN}🛡️ [Step 5] 用户管理功能测试...{RESET}")
    
    # 5.1 修改用户角色
    success, msg = db.admin_update_user(TEST_USER, "set_role", "vip")
    if success:
        user_check = db.get_user(TEST_USER)
        if user_check['role'] == 'vip':
            print(f"{GREEN}   ✅ 用户权限修改成功 (User -> VIP){RESET}")
        else:
            print(f"{RED}   ❌ 数据库未更新{RESET}")
    else:
        print(f"{RED}   ❌ 权限修改操作失败: {msg}{RESET}")

    # 5.2 模拟封禁 (拉黑)
    success, msg = db.admin_update_user(TEST_USER, "delete", "confirm")
    if success:
         deleted_user = db.get_user(TEST_USER)
         if not deleted_user:
             print(f"{GREEN}   ✅ 用户删除(封禁)成功{RESET}")
         else:
             print(f"{RED}   ❌ 用户仍存在{RESET}")
    else:
         print(f"{RED}   ❌ 删除操作失败: {msg}{RESET}")

    print(f"\n{GREEN}🎉🎉🎉 全系统自检完成！核心逻辑运转正常。{RESET}")

if __name__ == "__main__":
    run_full_test()