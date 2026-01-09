"""
WebSocket 路由模块

处理实时 WebSocket 连接和消息广播
"""
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.logger import logger

# 创建路由器
router = APIRouter()


# ================= WebSocket 连接管理器 =================

class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """接受新连接"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f" [WebSocket] 新连接建立，当前连接数: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """断开连接"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f" [WebSocket] 连接断开，当前连接数: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """发送个人消息"""
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        """广播消息给所有连接"""
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.info(f" [WebSocket] 广播消息失败: {e}")


# 全局连接管理器实例
manager = ConnectionManager()


# ================= WebSocket 路由 =================

@router.websocket("/ws/bridge")
async def websocket_bridge(websocket: WebSocket):
    """
    WebSocket 桥接端点

    用于实时双向通信，支持:
    - LCU 客户端连接
    - 实时战术推送
    - 心跳保活
    """
    await manager.connect(websocket)
    try:
        while True:
            # 保持连接，接收心跳或指令 (目前只需保持连接即可)
            data = await websocket.receive_text()
            # 可在此处处理接收到的消息
            logger.info(f" [WebSocket] 收到消息: {data[:50]}...")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(" [WebSocket] 客户端主动断开连接")
    except Exception as e:
        logger.info(f" [WebSocket] 连接异常: {e}")
        manager.disconnect(websocket)
