// src/config/constants.js

// 🟢 1. 填入你的域名 (注意：使用 https，且末尾不要加斜杠 /)
const CLOUD_API_URL = "https://www.hexcoach.gg"; 

// 判断开发环境
const isDev = import.meta.env.MODE === 'development';

// 🟢 2. 智能地址逻辑
export const API_BASE_URL = (() => {
    // 优先级 1: 强制开发环境
    if (isDev) return "http://localhost:8000";
    
    // 优先级 2: VITE 环境变量
    if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
    
    // 优先级 3: Electron 环境 (必须连云端)
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        return CLOUD_API_URL;
    }
    
    // 优先级 4: 网页版兜底
    return CLOUD_API_URL || window.location.origin;
})();

export const SEALOS_API_URL = `${API_BASE_URL === '/' ? '' : API_BASE_URL}/analyze`;

// 🟢 WebSocket 必须连接本地 (Bridge 跑在用户电脑上)
export const BRIDGE_WS_URL = "ws://127.0.0.1:29150";

export const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";

// 🟢 角色配置 (保持不变)
export const ROLES = [
  { id: 'TOP', label: '上单', icon: '🛡️', color: 'text-gray-400', bg: 'from-gray-500/20 to-gray-600/5' },
  { id: 'JUNGLE', label: '打野', icon: '🌿', color: 'text-green-400', bg: 'from-green-500/20 to-green-600/5' }, 
  { id: 'MID', label: '中单', icon: '🔮', color: 'text-red-400', bg: 'from-red-500/20 to-red-600/5' },
  { id: 'ADC', label: '射手', icon: '🏹', color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/5' },
  { id: 'SUPPORT', label: '辅助', icon: '❤️', color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-600/5' },
];