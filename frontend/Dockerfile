# frontend/Dockerfile

# 第一阶段：构建
FROM node:18-alpine as builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# 第二阶段：运行 (用 Nginx 极速服务)
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 🔥 [核心修改] 启动命令改为 Shell 脚本
# 作用：启动前读取系统环境变量，生成 env-config.js 文件，让前端 JS 能读到
CMD ["/bin/sh", "-c", "echo \"window._env_ = { \
  VITE_PAN_LINK: '${VITE_PAN_LINK}', \
  VITE_PAN_PWD: '${VITE_PAN_PWD}', \
  VITE_DIRECT_LINK: '${VITE_DIRECT_LINK}' \
};\" > /usr/share/nginx/html/env-config.js && nginx -g 'daemon off;'"]