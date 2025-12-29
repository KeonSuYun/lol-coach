# 文件路径: backend/jungle_engine.py
import argparse
import time
import json
import threading
import sys
import base64
import ssl
import os
import mss
import cv2
import numpy as np
import websocket  # pip install websocket-client
from queue import Queue

# ================= 配置区域 =================
EVENT_QUEUE = Queue()
LOCK = threading.Lock()

# 调试模式：开启后会在屏幕上显示 CV 看到的画面，方便你校准
DEBUG_CV_SHOW = False 

# ================= 1. 眼睛：CV 视觉模块 =================

class EyeOfJungle:
    def __init__(self):
        # 🔴 删除这里的 self.sct = mss.mss()
        # self.sct 初始化必须在 run() 线程内部进行
        self.running = False
        
        # 字典结构：Key 是英雄名，Value 是模板列表
        self.templates = {} 
        self.load_templates()

    def load_templates(self):
        """加载所有打野英雄的小地图圆形头像 (支持多尺寸)"""
        base_path = os.path.join(os.path.dirname(__file__), 'assets')
        if not os.path.exists(base_path):
            self.log(f"⚠️ 资源目录不存在: {base_path}")
            return

        count = 0
        for filename in os.listdir(base_path):
            if filename.endswith(".png"):
                name = filename.split('_')[0] 
                path = os.path.join(base_path, filename)
                
                if name not in self.templates:
                    self.templates[name] = []
                
                img = cv2.imread(path, 0)
                if img is not None:
                    self.templates[name].append(img)
                    count += 1
        
        self.log(f"✅ 已加载 {len(self.templates)} 个英雄的 {count} 张模板")

    def run(self):
        # 🟢 关键修改：mss 必须在当前线程初始化！
        with mss.mss() as sct:
            self.sct = sct # (可选) 赋值给 self 以便其他方法调用，或者直接用局部变量 sct
            
            self.running = True
            self.log("👁️ 视觉模块 (CV) 已启动...")
            
            while self.running:
                try:
                    # === A. 智能截屏 ===
                    # 1080P 小地图区域 (需根据实际调整)
                    monitor = {"top": 800, "left": 1650, "width": 270, "height": 280}
                    
                    # 使用当前线程的 sct 实例截图
                    sct_img = sct.grab(monitor)
                    img = np.array(sct_img)
                    img_gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)

                    # === B. 识别敌方打野 ===
                    for champ_name, template_list in self.templates.items():
                        if not template_list: continue
                        
                        found_this_champ = False
                        
                        for template in template_list:
                            if template is None: continue
                            
                            res = cv2.matchTemplate(img_gray, template, cv2.TM_CCOEFF_NORMED)
                            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
                            
                            if max_val > 0.8:
                                x, y = max_loc
                                self.report_enemy_position(champ_name, x, y)
                                found_this_champ = True
                                
                                # 调试画框
                                if DEBUG_CV_SHOW:
                                    h, w = template.shape
                                    cv2.rectangle(img, (x, y), (x + w, y + h), (0, 0, 255), 2)
                                break 
                    
                    if DEBUG_CV_SHOW:
                        cv2.imshow('JungleBrain Debug', img)
                        if cv2.waitKey(1) & 0xFF == ord('q'):
                            break

                    time.sleep(0.2)
                
                except Exception as e:
                    self.log(f"CV Error: {e}")
                    time.sleep(1)
            
            if DEBUG_CV_SHOW:
                cv2.destroyAllWindows()

    def report_enemy_position(self, name, x, y):
        # ... (保持不变) ...
        # 简单划分区域
        zone = "UNKNOWN"
        if y < 100: zone = "TOP_SIDE"
        elif y > 180: zone = "BOT_SIDE"
        else: zone = "MID_RIVER"
        
        EVENT_QUEUE.put({
            "type": "ENEMY_SPOTTED",
            "data": {
                "champion": name,
                "zone": zone,
                "pixel": {"x": x, "y": y},
                "confidence": "HIGH"
            }
        })

    def log(self, msg):
        print(f"JSON_OUT:{json.dumps({'type': 'LOG', 'msg': msg})}")
        sys.stdout.flush()

    def stop(self):
        self.running = False
# ================= 2. 神经：LCU 连接模块 =================
class NerveSystem:
    def __init__(self, port, password):
        self.port = port
        self.ws_url = f"wss://127.0.0.1:{port}"
        self.auth = "Basic " + base64.b64encode(f"riot:{password}".encode()).decode()
        self.running = False
        self.ws = None

    def on_message(self, ws, message):
        if not message: return
        try:
            msg = json.loads(message)
            # 监听游戏事件 (OnJsonApiEvent)
            if isinstance(msg, list) and len(msg) == 3 and msg[1] == "OnJsonApiEvent":
                data = msg[2]
                if data.get("uri") == "/liveclientdata/eventdata":
                    event = data.get("data")
                    self.log(f"⚡ 游戏事件: {event.get('EventName')}")
                    # 如果是击杀事件，推送到大脑处理
                    if event.get('EventName') == "ChampionKill":
                        EVENT_QUEUE.put({"type": "KILL_EVENT", "data": event})
        except:
            pass

    def on_error(self, ws, error):
        pass # 忽略网络抖动报错

    def on_open(self, ws):
        self.log(f"✅ 神经连接建立 (Port {self.port})")
        # 订阅游戏内实时事件
        ws.send(json.dumps([5, "OnJsonApiEvent", {"uri": "/liveclientdata/eventdata"}]))

    def log(self, msg):
        print(f"JSON_OUT:{json.dumps({'type': 'LOG', 'msg': msg})}")
        sys.stdout.flush()

    def run(self):
        self.running = True
        websocket.enableTrace(False)
        self.ws = websocket.WebSocketApp(
            self.ws_url,
            header={"Authorization": self.auth},
            on_message=self.on_message,
            on_error=self.on_error,
            on_open=self.on_open
        )
        self.ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})

# ================= 3. 大脑：主循环 =================
def brain_loop():
    print(f"JSON_OUT:{json.dumps({'type': 'LOG', 'msg': '🧠 JungleBrain 核心引擎启动'})}")
    sys.stdout.flush()
    
    while True:
        try:
            # 阻塞获取事件 (CV 或 LCU 发来的)
            event = EVENT_QUEUE.get()
            
            # === 这里是真正的"融合算法" ===
            
            # 1. 如果 CV 看到敌人
            if event["type"] == "ENEMY_SPOTTED":
                data = event["data"]
                # 发给前端：在小地图上画个圈，或者弹窗提示
                output = {
                    "type": "ALERT",
                    "data": {
                        "title": "敌方打野露头！",
                        "content": f"检测到 {data['champion']} 正在 {data['zone']} 区域活动！",
                        "level": "warning"
                    }
                }
                print(f"JSON_OUT:{json.dumps(output)}")
            
            # 2. 如果 LCU 收到击杀
            elif event["type"] == "KILL_EVENT":
                # 结合刚才的位置信息进行推理...
                pass

            sys.stdout.flush()
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', required=True)
    parser.add_argument('--password', required=True)
    args = parser.parse_args()

    # 启动双线程
    eye = EyeOfJungle()
    t_eye = threading.Thread(target=eye.run, daemon=True)
    t_eye.start()

    nerve = NerveSystem(args.port, args.password)
    t_nerve = threading.Thread(target=nerve.run, daemon=True)
    t_nerve.start()

    try:
        brain_loop()
    except KeyboardInterrupt:
        sys.exit(0)