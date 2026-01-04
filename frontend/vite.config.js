import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 🔥 [关键修复] 告诉 Vite 去上一级目录(项目根目录)加载 .env 文件
  envDir: '../', 
  
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    host: true // 允许局域网访问
  }
})