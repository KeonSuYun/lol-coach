import React from 'react';
import { RefreshCw } from 'lucide-react';

const AnalysisButton = ({ 
    mode, 
    icon, 
    label, 
    desc, 
    activeColor, 
    isAnalyzing, 
    analyzeType, 
    onClick 
}) => {
    // 判断当前按钮是否被选中
    const isActive = analyzeType === mode;

    // 🎨 样式映射表
    // 解决 Tailwind 无法动态解析 `ring-${color}` 的问题，必须写出完整类名
    const themeMap = {
        purple: {
            border: 'border-purple-500',
            bg: 'bg-purple-900/20',
            text: 'text-purple-400',
            ring: 'ring-purple-500/50',
            glow: 'bg-purple-500',
            indicator: 'bg-purple-500'
        },
        amber: {
            border: 'border-amber-500',
            bg: 'bg-amber-900/20',
            text: 'text-amber-400',
            ring: 'ring-amber-500/50',
            glow: 'bg-amber-500',
            indicator: 'bg-amber-500'
        },
        cyan: {
            border: 'border-cyan-500',
            bg: 'bg-cyan-900/20',
            text: 'text-cyan-400',
            ring: 'ring-cyan-500/50',
            glow: 'bg-cyan-500',
            indicator: 'bg-cyan-500'
        }
    };

    // 获取当前主题色（兜底 purple）
    const theme = themeMap[activeColor] || themeMap.purple;

    return (
        <button 
            onClick={onClick} 
            disabled={isAnalyzing} 
            className={`
                flex-1 relative group overflow-hidden rounded-xl border p-3 md:p-4 text-left transition-all duration-300 transform active:scale-95
                ${isAnalyzing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}
                ${isActive 
                    ? `${theme.bg} ${theme.border} ring-1 ${theme.ring}` 
                    : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700'}
            `}
        >
            {/* 背景动态光晕 */}
            {isActive && (
                <div className={`absolute inset-0 opacity-10 blur-xl ${theme.glow}`}></div>
            )}
            
            <div className="flex items-start justify-between mb-2 relative z-10">
                <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800 transition-colors duration-300 
                    ${isActive ? theme.text : 'text-slate-500 group-hover:text-slate-300'}`}
                >
                    {/* 如果选中且正在分析，显示旋转 Loading，否则显示图标 */}
                    {isAnalyzing && isActive ? (
                        <RefreshCw className="animate-spin" size={20}/>
                    ) : (
                        icon
                    )}
                </div>
                
                {/* 呼吸灯指示点 */}
                {isActive && (
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] animate-pulse ${theme.indicator}`} />
                )}
            </div>
            
            <div className="relative z-10">
                <div className={`font-black text-sm md:text-base mb-0.5 uppercase tracking-wide transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {label}
                </div>
                <div className="text-[10px] md:text-xs text-slate-500 leading-tight">
                    {desc}
                </div>
            </div>
        </button>
    );
};

export default AnalysisButton;