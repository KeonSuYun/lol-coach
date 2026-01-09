import requests
from core.logger import logger
import time
import json
import sys

# =================  配置区域 (请修改这里) =================
BASE_URL = "http://localhost:8000"

#  请填入一个数据库中已存在的【普通用户】账号密码
TEST_USERNAME = "test_user_001"  # 修改为您的测试账号
TEST_PASSWORD = "password123"    # 修改为您的测试密码

# 模拟请求负载 (确保 model_type="reasoner" 以触发 R1 限制)
PAYLOAD = {
    "mode": "bp",
    "myHero": "LeeSin",
    "enemyHero": "KhaZix",
    "myTeam": ["LeeSin", "Ahri", "Ezreal", "Thresh", "Malphite"],
    "enemyTeam": ["KhaZix", "Zed", "Jinx", "Lulu", "Darius"],
    "userRole": "JUNGLE",
    "rank": "Gold",
    "model_type": "reasoner"  #  关键：测试深度思考模式限制
}
# ===========================================================

def print_color(text, color="white"):
    colors = {
        "green": "\033[92m",
        "red": "\033[91m",
        "yellow": "\033[93m",
        "cyan": "\033[96m",
        "reset": "\033[0m"
    }
    logger.info(f"{colors.get(color, colors['reset'])}{text}{colors['reset']}")

def run_test():
    print_color(f" 开始测试用户 [{TEST_USERNAME}] 的分析限制...", "cyan")

    # 1. 登录获取 Token
    logger.info("🔑 正在尝试登录...")
    try:
        # FastAPI OAuth2PasswordRequestForm 需要 form-data 格式
        login_res = requests.post(
            f"{BASE_URL}/token", 
            data={"username": TEST_USERNAME, "password": TEST_PASSWORD}
        )
        
        if login_res.status_code != 200:
            print_color(f" 登录失败 ({login_res.status_code}): {login_res.text}", "red")
            print_color("   请检查脚本顶部的 TEST_USERNAME 和 TEST_PASSWORD 是否正确！", "yellow")
            return

        token_data = login_res.json()
        token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print_color(" 登录成功！", "green")

    except Exception as e:
        print_color(f" 连接服务器失败: {e}", "red")
        return

    # 2. 检查初始状态
    logger.info("\n 获取当前用户额度状态...")
    try:
        me_res = requests.get(f"{BASE_URL}/users/me", headers=headers)
        user_info = me_res.json()
        
        r1_limit = user_info.get('r1_limit', 3)
        r1_used = user_info.get('r1_used', 0)
        is_pro = user_info.get('is_pro', False)
        
        logger.info(f"   用户身份: {' PRO' if is_pro else ' 普通用户'}")
        logger.info(f"   R1 深度思考: 上限 {r1_limit} | 已用 {r1_used}")
        
        if is_pro:
            print_color(" 警告：该用户是 PRO 会员，可能没有次数限制，无法测试拦截！", "yellow")
            if input("   是否继续测试？(y/n): ").lower() != 'y':
                sys.exit(0)
                
    except Exception as e:
        logger.info(f"获取用户信息失败: {e}")

    # 3. 循环调用直到被限制
    print_color("\n 开始循环请求 /analyze 接口...", "cyan")
    
    count = 1
    max_loops = 10 # 安全熔断，防止无限循环
    
    while count <= max_loops:
        logger.info(f"\n[第 {count} 次尝试] 发起分析请求...", end=" ", flush=True)
        
        try:
            # 这里的 stream=True 是为了模拟前端流式接收，并不影响状态码判断
            resp = requests.post(f"{BASE_URL}/analyze", json=PAYLOAD, headers=headers, stream=True)
            status = resp.status_code
            
            # 读取响应内容（针对错误信息）
            if status != 200:
                try:
                    resp_json = resp.json()
                except:
                    resp_json = resp.text
            
            # === 状态码判断逻辑 ===
            if status == 200:
                print_color(" 成功 (200 OK)", "green")
                # 消耗掉流，防止连接挂起
                for _ in resp.iter_content(1024): pass
                
                #  关键：这里需要 Sleep 3.5秒，因为你的 server.py 有 3秒 的防刷冷却 (ANALYZE_LIMIT_STORE)
                # 如果不 Sleep，会被 429 拦截，无法测试到次数耗尽的 403
                logger.info("   ⏳ 冷却中 (等待 3.5s)...")
                time.sleep(3.5)
                
            elif status == 429:
                print_color(" 速度太快 (429 Too Many Requests)", "yellow")
                logger.info("   说明：触发了防刷冷却，正在重试...")
                time.sleep(4) # 等久一点
                continue # 这次不算有效调用，重试
                
            elif status == 403:
                print_color(" 请求被拒绝 (403 Forbidden)", "red")
                
                # 尝试解析后端返回的具体错误信息
                err_msg = "Unknown"
                if isinstance(resp_json, dict):
                    # 你的 server.py 返回结构是 {"concise": {"content": "..."}}
                    err_msg = resp_json.get('concise', {}).get('content', str(resp_json))
                else:
                    err_msg = str(resp_json)
                    
                print_color(f"    拦截原因: {err_msg}", "red")
                
                if "不足" in err_msg or "限额" in err_msg or "余额" in err_msg:
                    print_color("\n 测试通过！成功触发次数限制拦截。", "green")
                else:
                    print_color("\n 触发了 403，但提示信息似乎不是关于次数限制的，请检查。", "yellow")
                
                break # 测试结束
                
            else:
                print_color(f" 未知错误 ({status})", "red")
                logger.info(resp.text)
                break
                
        except Exception as e:
            logger.info(f"\n请求异常: {e}")
            break
            
        count += 1

    # 4. 最终验证
    logger.info("\n 最终数据核对...")
    try:
        final_me = requests.get(f"{BASE_URL}/users/me", headers=headers).json()
        final_used = final_me.get('r1_used', 0)
        logger.info(f"   数据库记录最终已用次数: {final_used}")
    except:
        pass

if __name__ == "__main__":
    run_test()