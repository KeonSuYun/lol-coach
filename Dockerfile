# ========== 第一阶段：构建前端 ==========
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# 1. 复制前端依赖配置
COPY frontend/package*.json ./
# 2. 安装依赖 (使用 npm ci 更快更稳)
RUN npm ci

# 3. 复制前端源代码
COPY frontend/ ./

# 4. 编译生成 dist 目录
RUN npm run build

# ========== 第二阶段：构建后端运行环境 ==========
FROM python:3.9-slim

WORKDIR /app

# 1. 安装系统基础依赖 (如果需要)
# RUN apt-get update && apt-get install -y --no-install-recommends ...

# 2. 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. 复制后端代码
COPY backend/ ./backend/

# 4. 🔥 关键：从第一阶段复制编译好的前端静态文件
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 5. 暴露端口
EXPOSE 8000

# 6. 启动命令
CMD ["python", "backend/server.py"]