import mss
from core.logger import logger
import cv2
import numpy as np
import time
import threading
import json

#  小地图区域配置 (以 1920x1080 为基准，不同分辨率需缩放)
# 你需要根据实际截图调整这些坐标，这里是大概位置
MINIMAP_CONFIG = {
    "1920x1080": {"top": 810, "left": 1650, "width": 270, "height": 270}
}

class JungleTracker:
    def __init__(self, callback_func):
        self.callback = callback_func
        self.running = False
        self.sct = mss.mss()
        self.last_alert_time = 0

    def start(self):
        self.running = True
        # 开启独立线程，绝不阻塞主服务器
        threading.Thread(target=self._loop, daemon=True).start()

    def stop(self):
        self.running = False

    def _loop(self):
        logger.info(" [CV] 打野追踪引擎已启动 (每秒检测1次)...")
        region = MINIMAP_CONFIG["1920x1080"] # 默认 1080p

        while self.running:
            try:
                start_time = time.time()
                
                # 1. 极速截图 (只截小地图)
                img = np.array(self.sct.grab(region))
                
                # 2. 图像预处理 (转 HSV)
                hsv = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
                hsv = cv2.cvtColor(hsv, cv2.COLOR_BGR2HSV)

                # 3. 红色圆圈识别 (敌方英雄头像是红圈)
                # 红色在 HSV 中有两个区间: [0-10] 和 [170-180]
                lower_red1 = np.array([0, 100, 100])
                upper_red1 = np.array([10, 255, 255])
                lower_red2 = np.array([170, 100, 100])
                upper_red2 = np.array([180, 255, 255])

                mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
                mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
                mask = mask1 + mask2

                # 4. 统计红色像素点
                red_pixels = cv2.countNonZero(mask)

                # 5. 触发警报 (简单阈值，可调)
                # 如果检测到红色像素 > 20 (大概是一个头像的大小)，且距离上次警报超过 10秒
                if red_pixels > 20 and (time.time() - self.last_alert_time > 10):
                    self.last_alert_time = time.time()
                    logger.info(f" [CV警报] 发现敌方英雄! (像素量: {red_pixels})")
                    
                    # 通过 WebSocket 发送给前端
                    self.callback({
                        "type": "ALERT",
                        "data": {
                            "level": "danger",
                            "title": "敌方露头",
                            "content": "小地图检测到敌方英雄，请注意防Gank！"
                        }
                    })

                # 6. 智能休眠 (保持 1 FPS，极低占用)
                # 扣除计算时间，确保不卡顿
                elapsed = time.time() - start_time
                sleep_time = max(0.1, 1.0 - elapsed)
                time.sleep(sleep_time)

            except Exception as e:
                logger.info(f" CV Error: {e}")
                time.sleep(2)