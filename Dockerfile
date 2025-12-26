# ========== 第一阶段：构建前端 ==========
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 🟢 修改点1：只复制 package.json，不复制 package-lock.json
# 这样可以强制 npm install 根据 package.json 重新生成依赖树，解决锁文件冲突
COPY frontend/package.json ./

# 🟢 修改点2：清理冗余的 install 命令，只保留一个，并使用国内源
RUN npm install --registry=https://registry.npmmirror.com

# 3. 复制前端源代码
COPY frontend/ ./

# 4. 构建
RUN VITE_API_BASE_URL="" npm run build

# ========== 第二阶段：构建后端运行环境 ==========
FROM python:3.9-slim

WORKDIR /app

# 安装编译工具 (保持原样，修复后端依赖安装问题)
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libffi-dev gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 配置 pip 清华源加速
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 复制编译好的前端文件
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "backend/server.py"]