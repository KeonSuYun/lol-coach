# ========== 第一阶段：构建前端 ==========
# 🔥 修复：升级到 node:20 以适配 Vite 7.x
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 1. 单独复制依赖文件
COPY frontend/package.json frontend/package-lock.json ./

# 2. 安装依赖
RUN npm install

# 3. 复制前端源代码
COPY frontend/ ./

# 4. 编译生成 dist 目录
RUN npm run build

# ========== 第二阶段：构建后端运行环境 ==========
FROM python:3.9-slim

WORKDIR /app

# 1. 配置清华源加速
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 2. 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. 复制后端代码
COPY backend/ ./backend/

# 4. 复制编译好的前端文件
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 5. 暴露端口
EXPOSE 8000

# 6. 启动命令
CMD ["python", "backend/server.py"]