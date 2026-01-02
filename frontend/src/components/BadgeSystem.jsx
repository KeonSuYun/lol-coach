// src/components/BadgeSystem.jsx
import React, { useEffect } from 'react';
import { 
  User, Shield, Crown, Zap, Flame, Leaf, Wind, Ghost, Hexagon, Sparkles, 
  Trophy, Target, X 
} from 'lucide-react';

// --- 1. 样式定义与注入组件 ---
export const BADGE_STYLES = `
  @keyframes border-flow {
    0% { transform: translateX(-150%) skewX(-15deg); }
    40%, 100% { transform: translateX(150%) skewX(-15deg); }
  }
  @keyframes breathe {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.02); }
  }
  .animate-flow-slow { animation: border-flow 6s ease-in-out infinite; }
  .animate-breathe { animation: breathe 5s ease-in-out infinite; }
  .mask-border-only {
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    padding: 1.5px;
  }
`;

export const BadgeStyleInit = () => {
  useEffect(() => {
    if (!document.getElementById('badge-system-styles')) {
        const style = document.createElement("style");
        style.id = 'badge-system-styles';
        style.innerText = BADGE_STYLES;
        document.head.appendChild(style);
    }
  }, []);
  return null;
};

// --- 2. 配置数据 ---
export const TITLE_TIERS = [
  { id: 'challenger', label: "巅峰/王者", marker: '\u200B', keywords: ["王者", "Challenger", "Top1"], style: "bg-gradient-to-r from-slate-900 via-amber-600 to-slate-900 text-amber-100 border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-1 ring-amber-300/40", icon: <Hexagon size={12} className="fill-amber-400 text-amber-100" />, animation: "animate-breathe", hasFlow: true },
  { id: 'legendary', label: "官方/传说", marker: '\u200C', keywords: ["Admin", "GM", "官方", "管理员"], style: "bg-gradient-to-r from-red-950/90 via-rose-900/80 to-red-950/90 text-rose-100 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.4)] ring-1 ring-rose-400/30", icon: <Shield size={12} className="fill-rose-500/20" />, animation: "animate-breathe", hasFlow: true },
  { id: 'epic', label: "职业/核心", marker: '\u2062', keywords: ["PRO", "核心", "MVP", "职业"], style: "bg-gradient-to-r from-amber-900/90 via-yellow-900/80 to-amber-900/90 text-amber-100 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]", icon: <Crown size={12} className="fill-amber-500/20" />, animation: "", hasFlow: true },
  { id: 'rare', label: "专家/大师", marker: '\u2061', keywords: ["大师", "钻石", "专家"], style: "bg-gradient-to-r from-blue-900/90 to-cyan-900/90 text-cyan-100 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.2)]", icon: <Zap size={12} className="fill-cyan-500/20" />, animation: "", hasFlow: false },
  { id: 'common', label: "默认", marker: '', keywords: [], style: "bg-slate-800/80 text-slate-300 border-slate-600/60", icon: <User size={12} />, animation: "", hasFlow: false }
];

// --- 3. 辅助函数 ---
export const getTitleConfig = (title) => {
  if (!title) return TITLE_TIERS[TITLE_TIERS.length - 1];
  return TITLE_TIERS.find(t => (t.marker && title.includes(t.marker)) || t.keywords.some(k => title.toLowerCase().includes(k.toLowerCase()))) || TITLE_TIERS[TITLE_TIERS.length - 1];
};

export const cleanTitle = (title) => {
    if (!title) return "";
    let clean = title;
    TITLE_TIERS.forEach(tier => { if (tier.marker) clean = clean.replaceAll(tier.marker, ""); });
    return clean;
};

export const getRankTheme = (rank) => {
    const r = (rank || "").toLowerCase();
    if (r.includes('challenger') || r.includes('王者')) return { border: "border-amber-400/80", bg: "bg-amber-950/20", text: "text-amber-100", accent: "text-amber-400", shadow: "shadow-amber-900/20", avatarRing: "border-amber-500 ring-2 ring-amber-500/20" };
    if (r.includes('grandmaster') || r.includes('宗师')) return { border: "border-rose-500/80", bg: "bg-rose-950/20", text: "text-rose-100", accent: "text-rose-400", shadow: "shadow-rose-900/20", avatarRing: "border-rose-500 ring-2 ring-rose-500/20" };
    if (r.includes('master') || r.includes('大师')) return { border: "border-purple-500/80", bg: "bg-purple-950/20", text: "text-purple-100", accent: "text-purple-400", shadow: "shadow-purple-900/20", avatarRing: "border-purple-500 ring-2 ring-purple-500/20" };
    if (r.includes('diamond') || r.includes('钻')) return { border: "border-cyan-400/80", bg: "bg-cyan-950/20", text: "text-cyan-100", accent: "text-cyan-400", shadow: "shadow-cyan-900/20", avatarRing: "border-cyan-400 ring-2 ring-cyan-400/20" };
    if (r.includes('platinum') || r.includes('铂金')) return { border: "border-teal-400/80", bg: "bg-teal-950/20", text: "text-teal-100", accent: "text-teal-400", shadow: "shadow-teal-900/20", avatarRing: "border-teal-400 ring-2 ring-teal-400/20" };
    if (r.includes('gold') || r.includes('黄金')) return { border: "border-yellow-500/60", bg: "bg-yellow-950/10", text: "text-yellow-100", accent: "text-yellow-400", shadow: "shadow-yellow-900/10", avatarRing: "border-yellow-500 ring-2 ring-yellow-500/20" };
    return { border: "border-slate-600", bg: "bg-slate-800/50", text: "text-slate-300", accent: "text-slate-400", shadow: "shadow-none", avatarRing: "border-slate-700" };
};

// --- 4. 核心组件 ---

// 头衔徽章 (Badge)
export const TitleBadge = ({ title, className = "", size = "normal" }) => {
    if (!title) return null;
    const config = getTitleConfig(title);
    const displayText = cleanTitle(title);
    const sizeClasses = size === "small" ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs";

    return (
        <div className={`relative flex items-center justify-center gap-1 rounded-full font-bold border tracking-wide select-none overflow-hidden ${config.style} ${config.animation} ${sizeClasses} ${className}`}>
            {config.hasFlow && (
                <div className="absolute inset-0 rounded-full mask-border-only pointer-events-none z-0">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-white/80 to-transparent -translate-x-full animate-flow-slow" />
                </div>
            )}
            <span className="relative z-10 opacity-90">{config.icon}</span>
            <span className="relative z-10 whitespace-nowrap">{displayText}</span>
        </div>
    );
};

// 统一风格的通用标签 (用于 Rank, Pro 等)
export const UnifiedTag = ({ label, icon: Icon, themeOverride = null, className = "" }) => {
    // 默认样式为 Rank 样式
    const theme = themeOverride || getRankTheme(label);
    
    return (
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm backdrop-blur-sm border transition-all ${theme.bg} ${theme.border} ${theme.text} ${theme.shadow} ${className}`}>
            {Icon && <Icon size={10} className={theme.accent} />}
            <span className="uppercase tracking-wide">{label}</span>
        </div>
    );
};