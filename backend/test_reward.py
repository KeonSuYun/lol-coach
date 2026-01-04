import requests
import json
import random
import sys
import time

# ================= ⚙️ 配置区域 =================
API_URL = "http://localhost:8000"

# 👤 测试账号
USER_NAME = "hex_tester"
USER_PASS = "TestPassword123!"

# 👑 管理员账号
ADMIN_NAME = "admin"
ADMIN_PASS = "Su123123"
# ===============================================

class Color:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log(msg, color=Color.RESET):
    print(f"{color}{msg}{Color.RESET}")

def login(username, password):
    try:
        resp = requests.post(f"{API_URL}/token", data={"username": username, "password": password})
        if resp.status_code == 200:
            return resp.json().get("access_token")
        log(f"❌ 登录失败 [{username}]: {resp.text}", Color.RED)
        sys.exit(1)
    except Exception as e:
        log(f"❌ 服务未启动? {e}", Color.RED)
        sys.exit(1)

def get_user_stats(token):
    """获取用户详细数据，返回 (limit, bonus)"""
    # 由于 API 只返回 limit (total)，我们需要反推 bonus。
    # 假设基础额度是 10。如果该用户是 VIP/Pro，基础额度不同，这里假设是免费用户。
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{API_URL}/users/me", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        limit = data.get("r1_limit", 0)
        # 注意：users/me 接口可能不直接返回 bonus_r1 字段，我们通过 limit 变化来判断
        return limit
    return 0

def submit_feedback(user_token, content):
    tag = f"TEST_{random.randint(10000, 99999)}"
    payload = {
        "match_context": {"complex_test": True},
        "description": f"{content} [Tag:{tag}]"
    }
    resp = requests.post(f"{API_URL}/feedback", json=payload, headers={"Authorization": f"Bearer {user_token}"})
    if resp.status_code == 200:
        return tag
    return None

def resolve_feedback(admin_token, tag, adopt, reward_amount=1):
    # 1. 查找 ID
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.get(f"{API_URL}/admin/feedbacks?status=pending", headers=headers)
    feedbacks = resp.json()
    
    target_id = None
    for f in feedbacks:
        if tag in f.get("description", ""):
            target_id = f.get("_id")
            break
            
    if not target_id:
        log(f"   ⚠️ 未找到 Tag 为 {tag} 的反馈，可能已被处理或延迟。", Color.RED)
        return False

    # 2. 处理
    payload = {
        "feedback_id": target_id,
        "adopt": adopt,
        "reward": reward_amount
    }
    resp = requests.post(f"{API_URL}/admin/feedbacks/resolve", json=payload, headers=headers)
    return resp.status_code == 200

# ================= 主测试逻辑 =================
def run_complex_test():
    log(f"🚀 开始 [复杂场景] 压力测试...", Color.BOLD)
    
    # 1. 初始化
    user_token = login(USER_NAME, USER_PASS)
    admin_token = login(ADMIN_NAME, ADMIN_PASS)
    
    start_limit = get_user_stats(user_token)
    log(f"\n📊 [基准线] 用户当前 R1 总额度: {start_limit}", Color.CYAN)
    
    current_limit = start_limit

    # ---------------------------------------------------------
    # 🧪 测试场景 A：【拒绝采纳】(预期：额度不变)
    # ---------------------------------------------------------
    log(f"\n🧪 [测试 A] 提交垃圾反馈 -> 管理员拒收 (只归档)", Color.YELLOW)
    tag_a = submit_feedback(user_token, "这是一条无意义的反馈")
    if tag_a:
        log(f"   User: 提交成功 ({tag_a})")
        # 管理员操作：adopt=False
        if resolve_feedback(admin_token, tag_a, adopt=False):
            log(f"   Admin: 已执行归档操作 (无奖励)")
        else:
            log(f"   ❌ Admin 操作失败", Color.RED)
    
    # 验证 A
    new_limit = get_user_stats(user_token)
    if new_limit == current_limit:
        log(f"   ✅ [PASS] 额度未变化 (当前: {new_limit})", Color.GREEN)
    else:
        log(f"   ❌ [FAIL] 额度错误变化! ({current_limit} -> {new_limit})", Color.RED)

    # ---------------------------------------------------------
    # 🧪 测试场景 B：【连续采纳】(预期：额度累加)
    # ---------------------------------------------------------
    log(f"\n🧪 [测试 B] 连续提交2条优质反馈 -> 全部采纳", Color.YELLOW)
    tag_b1 = submit_feedback(user_token, "优质反馈 1")
    tag_b2 = submit_feedback(user_token, "优质反馈 2")
    
    log(f"   User: 提交了两条反馈 ({tag_b1}, {tag_b2})")
    
    # 依次采纳
    resolve_feedback(admin_token, tag_b1, adopt=True, reward_amount=1)
    resolve_feedback(admin_token, tag_b2, adopt=True, reward_amount=1)
    log(f"   Admin: 全部采纳并奖励")

    # 验证 B (应该 +2)
    current_limit += 2
    new_limit = get_user_stats(user_token)
    if new_limit == current_limit:
        log(f"   ✅ [PASS] 额度成功累加 +2 (当前: {new_limit})", Color.GREEN)
    else:
        log(f"   ❌ [FAIL] 累加计算错误! (预期: {current_limit}, 实际: {new_limit})", Color.RED)

    # ---------------------------------------------------------
    # 🧪 测试场景 C：【暴击奖励】(预期：一次加很多)
    # ---------------------------------------------------------
    log(f"\n🧪 [测试 C] 提交核弹级Bug -> 管理员手动奖励 5 次", Color.YELLOW)
    tag_c = submit_feedback(user_token, "我发现了一个重大漏洞！")
    submit_feedback(user_token, "我发现了一个重大漏洞！") # 提交
    
    # 管理员给予重赏 (reward=5)
    # 注意：前端界面目前只传 1，但后端接口支持自定义数字，这里直接调接口测后端逻辑
    if resolve_feedback(admin_token, tag_c, adopt=True, reward_amount=5):
        log(f"   Admin: 给予 5 倍奖励")
    
    # 验证 C (应该 +5)
    current_limit += 5
    new_limit = get_user_stats(user_token)
    
    log(f"\n🏁 [最终结算]", Color.BOLD)
    log(f"   初始: {start_limit}")
    log(f"   预期: {current_limit} (+0 +1 +1 +5)")
    log(f"   实际: {new_limit}")
    
    if new_limit == current_limit:
        log(f"\n🎉🎉🎉 完美通过！系统逻辑无懈可击！ 🎉🎉🎉", Color.GREEN)
    else:
        log(f"\n⚠️ 测试未完全通过，请检查逻辑。", Color.RED)

if __name__ == "__main__":
    run_complex_test()