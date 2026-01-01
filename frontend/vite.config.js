import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // <--- 🔴 必须加上这一行！将绝对路径改为相对路径
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})