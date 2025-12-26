# ========== 第一阶段：构建前端 ==========
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 1. 单独复制依赖文件
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --registry=https://registry.npmmirror.com
# 2. 安装依赖
RUN npm install

# 3. 复制前端源代码
COPY frontend/ ./
# ⚠️ 关键设置：将 API 地址设为相对路径，这样前端就会自动请求当前域名的接口
RUN VITE_API_BASE_URL=/ npm run build
# ========== 第二阶段：构建后端运行环境 ==========
FROM python:3.9-slim

WORKDIR /app

# 🔥🔥🔥【必须添加这一段】安装编译工具 🔥🔥🔥
# 这是修复 "Connection Closed" 和登录崩溃的关键！
# 没有这些，密码加密库一运行就会让后端崩溃。
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libffi-dev gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
# 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥

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