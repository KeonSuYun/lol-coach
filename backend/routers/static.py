"""
静态文件路由模块

包含前端SPA路由、favicon等静态资源处理
"""
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

# 创建路由器
router = APIRouter()

# 定义前端构建目录的路径
DIST_DIR = Path("frontend/dist")


# ================= 路由处理函数 =================

@router.get("/")
async def serve_spa():
    """首页 - 返回前端SPA入口"""
    index_path = DIST_DIR / "index.html"
    if not index_path.exists():
        return {"error": "前端文件未找到,请检查构建流程 (npm run build)"}
    return FileResponse(index_path)


@router.get("/favicon.{ext}")
async def favicon(ext: str):
    """处理 favicon 请求"""
    # 只允许特定后缀,防止任意文件读取
    if ext not in ["ico", "svg", "png"]:
        raise HTTPException(status_code=404)

    file_path = DIST_DIR / f"favicon.{ext}"
    if not file_path.exists():
        # 尝试去 public 找
        file_path = DIST_DIR / "public" / f"favicon.{ext}"

    if file_path.exists():
        # 简单判断 mime type
        media_type = "image/svg+xml" if ext == "svg" else f"image/{ext}"
        if ext == "ico":
            media_type = "image/x-icon"

        return FileResponse(file_path, media_type=media_type)

    raise HTTPException(status_code=404)


@router.get("/{full_path:path}")
async def catch_all(full_path: str):
    """捕获所有其他路径 -> 智能判断是文件还是页面"""
    # A. 优先检查静态文件
    file_path = DIST_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)

    # B. API 404 处理 (避免返回 HTML)
    if full_path.startswith("api/") or full_path.startswith("assets/"):
        raise HTTPException(status_code=404)

    # C. SPA 路由兜底:返回 index.html
    index_path = DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"error": "Frontend build not found. Did you run 'npm run build'?"}
