import React, { useEffect } from 'react';
import { 
  User, Shield, Crown, Zap, Flame, Leaf, Wind, Ghost, Hexagon, Sparkles, 
  Trophy, Target, X, Cpu, Microscope, Gem, PenTool 
} from 'lucide-react';

// ==========================================
// 1. 样式定义与注入组件
// ==========================================
export const BADGE_STYLES = `
  @keyframes border-flow {
    0% { transform: translateX(-150%) skewX(-15deg); }
    40%, 100% { transform: translateX(150%) skewX(-15deg); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes breathe {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.02); }
  }
  
  /* 流光动画 */
  .animate-flow-slow {
    animation: border-flow 6s ease-in-out infinite;
  }
  
  /* 微呼吸 */
  .animate-breathe {
    animation: breathe 5s ease-in-out infinite;
  }
  
  .animate-spin-slow {
    animation: spin-slow 4s linear infinite;
  }

  /* 核心：边缘遮罩技术 */
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

// ==========================================
// 2. 头衔配置系统 (全局唯一源)
// ==========================================
export const TITLE_TIERS = [
  // 🔥 [新增/修复] 海克斯共创者 (优先级最高)
  { 
    id: 'pioneer', 
    label: "内测/共建", 
    marker: '\u200E', 
    // 🔥 关键词扩充：包含 "共创", "内测", "海克斯" 等
    keywords: ["内测", "先行者", "共建", "共创", "元老", "Beta", "架构师", "主脑", "海克斯"], 
    // ✨ 特效：青色霓虹流光 + 呼吸灯
    style: "bg-gradient-to-r from-cyan-950/90 via-teal-900/80 to-cyan-950/90 text-cyan-200 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.4)] ring-1 ring-cyan-400/30", 
    icon: <Cpu size={12} className="text-cyan-400 animate-pulse" />, 
    animation: "animate-breathe", 
    hasFlow: true 
  },
  {
    id: 'challenger',
    label: "巅峰/王者",
    marker: '\u200B', 
    keywords: ["王者", "Challenger", "巅峰", "第一", "Top1", "King"],
    style: "bg-gradient-to-r from-slate-900 via-amber-600 to-slate-900 text-amber-100 border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-1 ring-amber-300/40",
    icon: <Hexagon size={12} className="fill-amber-400 text-amber-100 animate-spin-slow" />,
    animation: "animate-breathe", 
    hasFlow: true
  },
  {
    id: 'legendary',
    label: "官方/传说",
    marker: '\u200C',
    keywords: ["Admin", "GM", "Root", "官方", "S级", "Legend", "管理员"],
    style: "bg-gradient-to-r from-red-950/90 via-rose-900/80 to-red-950/90 text-rose-100 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.4)] ring-1 ring-rose-400/30",
    icon: <Shield size={12} className="fill-rose-500/20" />,
    animation: "animate-breathe",
    hasFlow: true
  },
  {
    id: 'void',
    label: "虚空/深渊",
    marker: '\u200D',
    keywords: ["虚空", "Void", "进化", "吞噬", "深渊", "Kaisa"],
    style: "bg-gradient-to-r from-violet-950 via-fuchsia-900 to-purple-950 text-fuchsia-100 border-fuchsia-500/60 shadow-[0_0_15px_rgba(192,38,211,0.4)]",
    icon: <Sparkles size={12} className="text-fuchsia-400" />,
    animation: "", 
    hasFlow: true
  },
  {
    id: 'fire',
    label: "火焰/战斗",
    marker: '\u2060',
    keywords: ["火焰", "地狱", "红莲", "燃烧", "龙魂", "Ignite"],
    style: "bg-gradient-to-r from-orange-950 via-red-900 to-orange-950 text-orange-100 border-orange-500/60 shadow-[0_0_15px_rgba(249,115,22,0.4)]",
    icon: <Flame size={12} className="fill-orange-500/20 text-orange-400" />,
    animation: "",
    hasFlow: true
  },
  {
    id: 'epic',
    label: "职业/核心",
    marker: '\u2062',
    keywords: ["PRO", "核心", "绝活", "MVP", "职业", "冠军", "LPL"],
    style: "bg-gradient-to-r from-amber-900/90 via-yellow-900/80 to-amber-900/90 text-amber-100 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]",
    icon: <Crown size={12} className="fill-amber-500/20" />,
    animation: "",
    hasFlow: true
  },
  {
    id: 'nature',
    label: "自然/治疗",
    marker: '\u2064',
    keywords: ["自然", "艾欧尼亚", "绽灵", "森林", "守护", "Heal"],
    style: "bg-gradient-to-r from-emerald-950 via-teal-900 to-green-950 text-emerald-100 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]",
    icon: <Leaf size={12} className="text-emerald-400" />,
    animation: "",
    hasFlow: false
  },
  {
    id: 'ice',
    label: "极地/冰霜",
    marker: '\u2063',
    keywords: ["冰霜", "弗雷尔卓德", "极地", "凛冬", "Cold"],
    style: "bg-gradient-to-r from-cyan-950 via-sky-900 to-blue-950 text-sky-100 border-sky-400/50 shadow-[0_0_10px_rgba(56,189,248,0.3)]",
    icon: <Wind size={12} className="text-sky-300" />,
    animation: "",
    hasFlow: false
  },
  {
    id: 'rare',
    label: "专家/大师",
    marker: '\u2061',
    keywords: ["作者", "攻略", "大师", "宗师", "钻石", "峡谷", "专家"],
    style: "bg-gradient-to-r from-blue-900/90 to-cyan-900/90 text-cyan-100 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.2)]",
    icon: <Zap size={12} className="fill-cyan-500/20" />,
    animation: "",
    hasFlow: false
  },
  {
    id: 'shadow',
    label: "暗影/潜行",
    marker: '', 
    keywords: ["暗影", "刺客", "潜行", "幽灵", "Ninja"],
    style: "bg-gradient-to-r from-slate-950 via-slate-800 to-slate-950 text-slate-200 border-slate-600 shadow-[0_0_8px_rgba(148,163,184,0.1)]",
    icon: <Ghost size={12} className="text-slate-400" />,
    animation: "",
    hasFlow: false
  },
  {
    id: 'common',
    label: "默认/普通",
    marker: '', 
    keywords: [], 
    style: "bg-slate-800/80 text-slate-300 border-slate-600/60 hover:bg-slate-700 transition-colors",
    icon: <User size={12} />,
    animation: "",
    hasFlow: false
  }
];

// ==========================================
// 3. 辅助函数
// ==========================================
export const getTitleConfig = (title) => {
  if (!title) return TITLE_TIERS[TITLE_TIERS.length - 1];
  
  // 1. 优先匹配隐形标记
  const markerMatch = TITLE_TIERS.find(t => t.marker && title.includes(t.marker));
  if (markerMatch) return markerMatch;

  // 2. 其次匹配关键词 (不区分大小写)
  const keywordMatch = TITLE_TIERS.find(t => t.keywords.some(k => title.toLowerCase().includes(k.toLowerCase())));
  if (keywordMatch) return keywordMatch;

  // 3. 兜底
  return TITLE_TIERS[TITLE_TIERS.length - 1];
};

export const cleanTitle = (title) => {
    if (!title) return "";
    let clean = title;
    TITLE_TIERS.forEach(tier => {
        if (tier.marker) clean = clean.replaceAll(tier.marker, "");
    });
    return clean;
};

export const getRankTheme = (rank) => {
    const r = (rank || "").toLowerCase();
    let theme = { border: "border-slate-700/60", bg: "bg-slate-800/40", text: "text-slate-300", accent: "text-slate-400", shadow: "shadow-lg", glow: "", avatarRing: "border-slate-800", gradientOverlay: "from-slate-900/0 via-slate-900/0 to-slate-900" };

    if (r.includes('challenger') || r.includes('王者')) theme = { border: "border-amber-400/50", bg: "bg-amber-950/20", text: "text-amber-100", accent: "text-amber-400", shadow: "shadow-amber-900/20", glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]", avatarRing: "border-amber-500", gradientOverlay: "from-amber-500/10 via-transparent to-slate-900" };
    else if (r.includes('grandmaster') || r.includes('宗师')) theme = { border: "border-rose-500/50", bg: "bg-rose-950/20", text: "text-rose-100", accent: "text-rose-400", shadow: "shadow-rose-900/20", glow: "shadow-[0_0_20px_rgba(244,63,94,0.3)]", avatarRing: "border-rose-500", gradientOverlay: "from-rose-500/10 via-transparent to-slate-900" };
    else if (r.includes('master') || r.includes('大师')) theme = { border: "border-purple-500/50", bg: "bg-purple-950/20", text: "text-purple-100", accent: "text-purple-400", shadow: "shadow-purple-900/20", glow: "shadow-[0_0_20px_rgba(168,85,247,0.3)]", avatarRing: "border-purple-500", gradientOverlay: "from-purple-500/10 via-transparent to-slate-900" };
    else if (r.includes('diamond') || r.includes('钻')) theme = { border: "border-cyan-400/50", bg: "bg-cyan-950/20", text: "text-cyan-100", accent: "text-cyan-400", shadow: "shadow-cyan-900/20", glow: "shadow-[0_0_20px_rgba(34,211,238,0.3)]", avatarRing: "border-cyan-400", gradientOverlay: "from-cyan-500/10 via-transparent to-slate-900" };
    else if (r.includes('platinum') || r.includes('铂金')) theme = { border: "border-teal-400/50", bg: "bg-teal-950/20", text: "text-teal-100", accent: "text-teal-400", shadow: "shadow-teal-900/20", glow: "shadow-[0_0_15px_rgba(45,212,191,0.2)]", avatarRing: "border-teal-400", gradientOverlay: "from-teal-500/10 via-transparent to-slate-900" };
    else if (r.includes('gold') || r.includes('黄金')) theme = { border: "border-yellow-500/40", bg: "bg-yellow-950/10", text: "text-yellow-100", accent: "text-yellow-400", shadow: "shadow-yellow-900/10", glow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]", avatarRing: "border-yellow-500", gradientOverlay: "from-yellow-500/5 via-transparent to-slate-900" };
    return theme;
};

// ==========================================
// 4. 核心组件
// ==========================================

// 头衔徽章 (Badge)
export const TitleBadge = ({ title, onClick, showRemove, onRemove, className = "", size = "normal", styleOverride = null }) => {
    if (!title && !styleOverride) return null;
    
    // 如果传入了 styleOverride (预览用)，直接使用；否则根据 title 计算
    const config = styleOverride || getTitleConfig(title);
    const displayText = styleOverride ? title : cleanTitle(title);
    
    const sizeClasses = size === "small" ? "px-1.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
    const cursorClass = onClick ? "cursor-pointer hover:scale-105 active:scale-95" : "";

    return (
        <div 
            onClick={onClick}
            className={`
                relative group flex items-center justify-center gap-1.5 rounded-full font-bold border tracking-wide select-none overflow-hidden 
                ${config.style} ${config.animation} ${sizeClasses} ${cursorClass} ${className}
            `}
        >
             {/* 边缘遮罩流光 */}
            {config.hasFlow && (
                <div className="absolute inset-0 rounded-full mask-border-only pointer-events-none z-0">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-white/80 to-transparent -translate-x-full animate-flow-slow" />
                </div>
            )}
            
            <span className="relative z-10 opacity-90 flex items-center">{config.icon}</span>
            <span className="relative z-10 whitespace-nowrap">{displayText}</span>

            {showRemove && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onRemove && onRemove(title); }}
                    className="absolute right-0 top-0 bottom-0 px-1.5 bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition-colors flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 z-20 rounded-r-full"
                    title="移除此头衔"
                >
                    <X size={10}/>
                </button>
            )}
        </div>
    );
};

// 统一风格的通用标签 (用于 Rank, Pro 等)
export const UnifiedTag = ({ label, icon: Icon, themeOverride = null, className = "" }) => {
    const theme = themeOverride || getRankTheme(label);
    
    return (
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm backdrop-blur-sm border transition-all ${theme.bg} ${theme.border} ${theme.text} ${theme.shadow} ${className}`}>
            {Icon && <Icon size={10} className={theme.accent} />}
            <span className="uppercase tracking-wide">{label}</span>
        </div>
    );
};