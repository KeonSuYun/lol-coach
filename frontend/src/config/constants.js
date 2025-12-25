// src/config/constants.js

// 🟢 环境配置
export const SEALOS_API_URL = "https://<你的APPID>.laf.run/analyze"; 
export const BRIDGE_WS_URL = "ws://127.0.0.1:29150";
export const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://kozzbluxklwn.sealosbja.site";
// 🟢 角色配置列表
export const ROLES = [
  { id: 'TOP', label: '上单', icon: '🛡️', color: 'text-gray-400', bg: 'from-gray-500/20 to-gray-600/5' },
  { id: 'JUNGLE', label: '打野', icon: '🌿', color: 'text-green-400', bg: 'from-green-500/20 to-green-600/5' },
  { id: 'MIDDLE', label: '中单', icon: '🔮', color: 'text-red-400', bg: 'from-red-500/20 to-red-600/5' },
  { id: 'BOTTOM', label: '射手', icon: '🏹', color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/5' },
  { id: 'UTILITY', label: '辅助', icon: '❤️', color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-600/5' },
];