# ========== 第一阶段：构建前端 ==========
FROM node:18-alpine as frontend-builder

WORKDIR /app/frontend

# 复制前端依赖配置
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --registry=https://registry.npmmirror.com

# 复制前端源代码
COPY frontend/ .

# ⚠️ 关键设置：将 API 地址设为相对路径，这样前端就会自动请求当前域名的接口
ENV VITE_API_BASE_URL=/

# 开始构建 (生成 dist 目录)
RUN npm run build

# ========== 第二阶段：构建后端并整合 ==========
FROM python:3.9-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y build-essential libffi-dev && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 1. 复制后端代码
COPY backend/ .

# 2. 从第一阶段复制构建好的前端文件到后端目录
#    注意：这里把 frontend-builder 里的 dist 复制到了 /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# 3. 复制数据脚本（确保它在容器里）
COPY backend/seed_data.py .
COPY backend/secure_data ./secure_data

# 暴露端口
EXPOSE 8000

# 启动命令：先跑数据脚本，再启动服务
CMD ["sh", "-c", "python seed_data.py && python server.py"]