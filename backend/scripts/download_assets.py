import os
from core.logger import logger
import requests
import cv2
import numpy as np

# ================= 配置 =================
# 保存目录
ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')
# 想要生成的尺寸 (小地图图标通常很小，多生成几个尺寸可以增加匹配成功率)
TARGET_SIZES = [24, 32, 48] 

def get_latest_version():
    """获取 LoL 最新版本号"""
    url = "https://ddragon.leagueoflegends.com/api/versions.json"
    resp = requests.get(url)
    return resp.json()[0]

def process_image(img_bytes, champ_name):
    """将方形图片处理为圆形小地图图标"""
    # 1. 字节转 OpenCV 图像
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    # 如果没有 Alpha 通道，加上它
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    h, w = img.shape[:2]
    
    # 2. 创建圆形掩膜 (Mask)
    mask = np.zeros((h, w), dtype=np.uint8)
    center = (w // 2, h // 2)
    radius = min(w, h) // 2
    cv2.circle(mask, center, radius, 255, -1)

    # 3. 应用掩膜 (切成圆形)
    img[:, :, 3] = mask # 将 Alpha 通道设置为 mask

    # 4. 生成多尺寸模板
    for size in TARGET_SIZES:
        resized = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
        
        # 保存文件名示例: LeeSin_24.png
        save_name = f"{champ_name}_{size}.png"
        save_path = os.path.join(ASSETS_DIR, save_name)
        cv2.imwrite(save_path, resized)

def main():
    if not os.path.exists(ASSETS_DIR):
        os.makedirs(ASSETS_DIR)
        logger.info(f" 创建目录: {ASSETS_DIR}")

    logger.info(" 正在获取最新版本号...")
    version = get_latest_version()
    logger.info(f" 当前版本: {version}")

    # 获取英雄列表
    logger.info(" 正在获取英雄列表...")
    list_url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json"
    data = requests.get(list_url).json()
    champions = data['data']

    logger.info(f" 开始下载 {len(champions)} 个英雄头像...")
    
    count = 0
    for champ_id, champ_data in champions.items():
        # 排除无用数据
        img_file = champ_data['image']['full']
        img_url = f"https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{img_file}"
        
        try:
            # 下载图片
            resp = requests.get(img_url)
            if resp.status_code == 200:
                process_image(resp.content, champ_id)
                count += 1
                logger.info(f"[{count}/{len(champions)}] 已处理: {champ_id}", end='\r')
        except Exception as e:
            logger.info(f"\n 处理 {champ_id} 失败: {e}")

    logger.info(f"\n 全部完成！已生成 {count * len(TARGET_SIZES)} 个模板文件。")
    logger.info(f" 请查看: {ASSETS_DIR}")

if __name__ == "__main__":
    main()