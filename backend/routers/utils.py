"""
工具路由模块

包含健康检查、反馈、销售仪表盘、TTS 语音播报等工具性路由
"""
import os
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse, RedirectResponse, Response
from pydantic import BaseModel
import edge_tts

from core.logger import logger
from .dependencies import get_current_user, db

# 创建路由器
router = APIRouter()

# 获取当前目录
current_dir = Path(__file__).resolve().parent.parent

# TTS 音色映射配置
VOICE_CONFIG = {
    "guide": "zh-CN-XiaoxiaoNeural",      # 晓晓 (小美/默认)
    "commander": "zh-CN-YunjianNeural",   # 云健 (大帅/指挥)
    "partner": "zh-CN-YunxiNeural"        # 云希 (小帅/搭档)
}


# ================= 数据模型 =================

class FeedbackInput(BaseModel):
    match_context: dict
    description: str


class ClientConfigUpdate(BaseModel):
    pan_url: str
    pan_pwd: str


class TTSRequest(BaseModel):
    text: str
    voice_id: str = "guide"  # 默认为"guide"(领航员)


# ================= 路由处理函数 =================

@router.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok"}


@router.get("/download/client")
async def download_client():
    """客户端下载重定向"""
    url = os.getenv("CLIENT_DOWNLOAD_URL")
    if not url:
        return {"error": "Download URL not configured"}
    return RedirectResponse(url=url)


@router.get("/api/download/client")
async def download_client_public():
    """全员开放的直链下载通道"""
    # 1. 优先读取环境变量中的对象存储链接
    oss_url = os.getenv("CLIENT_DOWNLOAD_URL")

    if oss_url:
        return RedirectResponse(url=oss_url)

    # 2. 如果没配置,尝试本地文件 (兜底)
    file_path = current_dir / "secure_data" / "HexCoach-Lite-1.0.0.exe"

    # 兼容旧文件名
    if not file_path.exists():
        file_path = current_dir / "secure_data" / "HexClient.exe"

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="下载服务配置错误:未找到文件或OSS链接")

    # 如果是本地文件,依然使用流式传输 (消耗服务器流量)
    return FileResponse(
        path=file_path,
        filename="HexCoach-Lite-1.0.0.exe",
        media_type="application/vnd.microsoft.portable-executable"
    )


@router.get("/api/config/client")
def get_client_config_endpoint():
    """获取客户端配置"""
    config = db.get_client_config()
    return {
        "pan_url": config.get("pan_url", ""),
        "pan_pwd": config.get("pan_pwd", "")
    }


@router.get("/sales/dashboard")
def get_sales_dashboard(current_user: dict = Depends(get_current_user)):
    """获取销售仪表盘数据"""
    # 增加权限验证:只有 管理员 或 销售 才能看
    allowed_roles = ['admin', 'root', 'sales']
    if current_user.get('role') not in allowed_roles:
        raise HTTPException(status_code=403, detail="您不是销售合伙人,无法查看此数据")

    data = db.get_sales_dashboard_data(current_user['username'])
    return data


@router.post("/feedback")
def submit_feedback(data: FeedbackInput, current_user: dict = Depends(get_current_user)):
    """提交反馈"""
    db.submit_feedback({
        "user_id": current_user['username'],
        "match_context": data.match_context,
        "description": data.description
    })
    return {"status": "success"}


@router.post("/api/tts")
async def tts_proxy(req: TTSRequest):
    """
    TTS 语音播报接口

    支持三种音色:
    - guide: 晓晓 (小美/默认)
    - commander: 云健 (大帅/指挥)
    - partner: 云希 (小帅/搭档)
    """
    if not req.text:
        raise HTTPException(status_code=400, detail="文本不能为空")

    # 根据前端传来的 voice_id 选择音色，默认用 guide
    target_voice = VOICE_CONFIG.get(req.voice_id, VOICE_CONFIG["guide"])

    # 简单清洗文本
    clean_text = re.sub(r'\([^)]*\)|（[^）]*）|\[[^\]]*\]|【[^】]*】', '', req.text)

    # 2. 替换冒号为句号 (增加停顿)
    clean_text = clean_text.replace(':', '。').replace('：', '。')

    # 3. 清理剩余的非法字符，保留中英文、数字和基本标点
    #    增加对书名号《》的支持，防止报错
    clean_text = re.sub(r'[^\w\u4e00-\u9fa5,.!?，。：！？\s\-]', '', clean_text)
    # 最后清理非法字符 (Emoji、特殊符号等)，保留中英文、数字和基本标点
    clean_text = re.sub(r'[^\w\u4e00-\u9fa5,.!?，。！？\s\-]', '', clean_text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="无可读文本")

    try:
        # 使用 Edge-TTS 生成音频流
        communicate = edge_tts.Communicate(clean_text, target_voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]

        if not audio_data:
             raise HTTPException(status_code=500, detail="语音生成为空")

        # 返回音频流
        return Response(content=audio_data, media_type="audio/mp3")

    except Exception as e:
        logger.info(f" [TTS] Error: {e}")
        raise HTTPException(status_code=500, detail="语音服务生成失败")

