import React from 'react'; 
import { Search, ChevronRight, Swords, Brain, Shield, Crosshair, Zap, HelpCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

// 定义分路图标和颜色
const ROLE_CONFIG = {
    "TOP": { icon: Shield, color: "text-gray-400", label: "上单" },
    "JUNGLE": { icon: Swords, color: "text-green-400", label: "打野" },
    "MID": { icon: Zap, color: "text-red-400", label: "中单" },
    "ADC": { icon: Crosshair, color: "text-blue-400", label: "下路" },
    "SUPPORT": { icon: Brain, color: "text-yellow-400", label: "辅助" },
};

export default function AnalysisButton({ 
    selectedHero, 
    onOpenChampSelect, 
    onAnalyze,
    isAnalyzing,
    allowEmpty = false,
    
    // 🔥 [核心] 接收分路相关 props，支持外部控制
    currentRole = "MID", 
    onRoleChange 
}) {
    
    // 处理点击：如果有英雄则打开选择器；如果是空位BP模式，则切换分路
    const handleLeftClick = (e) => {
        if (selectedHero) {
            onOpenChampSelect();
        } else if (allowEmpty && onRoleChange) {
            // 空位 BP 模式：切换分路
            e.stopPropagation();
            const roles = Object.keys(ROLE_CONFIG);
            const currentIndex = roles.indexOf(currentRole);
            
            // 循环切换到下一个位置
            const nextIndex = (currentIndex + 1) % roles.length;
            const nextRole = roles[nextIndex];
            
            onRoleChange(nextRole);
            toast.success(`已切换至：${ROLE_CONFIG[nextRole].label}`);
        } else {
            // 普通模式：打开选择器
            onOpenChampSelect();
        }
    };

    const handleClickAnalyze = () => {
        if (!selectedHero && !allowEmpty) {
            toast.error("请先选择一个英雄！");
            onOpenChampSelect();
            return;
        }
        if (isAnalyzing) return;
        if (onAnalyze) onAnalyze();
    };

    const RoleIcon = ROLE_CONFIG[currentRole]?.icon || HelpCircle;
    const roleLabel = ROLE_CONFIG[currentRole]?.label || "未知";
    const roleColor = ROLE_CONFIG[currentRole]?.color || "text-slate-400";

    return (
        <div className="w-full max-w-xl mx-auto relative group z-20 mb-6">
            {/* 核心修改：加强背景流光，从原来的 blur 变为更动态的 pulse + blur */}
            <div className={`absolute -inset-[2px] bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-gradient-xy ${isAnalyzing ? 'animate-pulse opacity-80' : ''}`}></div>
            
            <div className="relative flex h-14 md:h-16 bg-[#091428] border border-[#C8AA6E]/30 rounded-xl overflow-hidden shadow-2xl">
                
                {/* === 左侧：动态选择区 === */}
                <button 
                    onClick={handleLeftClick}
                    className="w-[35%] h-full flex items-center justify-center gap-2 md:gap-3 bg-[#010A13]/80 border-r border-[#C8AA6E]/20 hover:bg-[#1a2332] transition-all relative overflow-hidden group/select"
                    title={!selectedHero && allowEmpty ? "点击切换推荐分路" : "点击更换英雄"}
                >
                    {selectedHero ? (
                        /* 场景 A: 已选英雄 */
                        <>
                            <div className="relative w-8 h-8 md:w-10 md:h-10 rounded border border-[#C8AA6E]/50 shadow-lg overflow-hidden shrink-0 group-hover/select:scale-110 transition-transform">
                                <img src={selectedHero.image_url} alt={selectedHero.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                                <span className="text-xs text-slate-400 scale-90 origin-left">当前</span>
                                <span className="text-xs md:text-sm font-bold text-[#C8AA6E] truncate max-w-[60px] md:max-w-[80px] leading-tight">
                                    {selectedHero.name}
                                </span>
                            </div>
                        </>
                    ) : allowEmpty ? (
                        /* 场景 B: 空位 BP 模式 -> 显示分路选择器 */
                        <>
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center ${roleColor} bg-white/5`}>
                                <RoleIcon size={20} />
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                                <span className="text-[10px] text-slate-500 scale-90 origin-left uppercase tracking-wider">Target Role</span>
                                <span className={`text-sm font-bold ${roleColor} flex items-center gap-1`}>
                                    {roleLabel} <span className="text-[10px] opacity-50">▼</span>
                                </span>
                            </div>
                        </>
                    ) : (
                        /* 场景 C: 普通空位 -> 显示搜索图标 */
                        <>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded border border-dashed border-slate-600 flex items-center justify-center text-slate-500">
                                <Search size={16} />
                            </div>
                            <span className="text-xs font-bold text-slate-400">选择英雄</span>
                        </>
                    )}
                </button>

                {/* === 右侧：分析按钮 (增强版) === */}
                <button 
                    onClick={handleClickAnalyze}
                    disabled={isAnalyzing || (!selectedHero && !allowEmpty)}
                    className={`flex-1 h-full flex items-center justify-center gap-2 md:gap-3 transition-all relative overflow-hidden
                        ${(!selectedHero && !allowEmpty)
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                            : isAnalyzing
                                ? 'bg-blue-900/50 text-blue-300 cursor-wait'
                                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                        }
                    `}
                >
                    {isAnalyzing ? (
                        <>
                            <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm md:text-base font-bold tracking-widest animate-pulse">HEX 推演中...</span>
                        </>
                    ) : (
                        <>
                            <div className={`p-1.5 rounded-full ${selectedHero || allowEmpty ? 'bg-white/20' : 'bg-black/20'}`}>
                                <Brain size={18} className={selectedHero || allowEmpty ? 'text-white' : 'text-slate-500'} />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className={`text-sm md:text-base font-black tracking-wider leading-none ${!selectedHero && !allowEmpty ? 'opacity-50' : ''}`}>
                                    {selectedHero ? "开始分析" : (allowEmpty ? `获取 ${roleLabel} 推荐` : "准备就绪")}
                                </span>
                                {(selectedHero || allowEmpty) && (
                                    <span className="text-[10px] font-mono opacity-80 scale-90 origin-left">
                                        {selectedHero ? "START ENGINE" : "AUTO SUGGEST"}
                                    </span>
                                )}
                            </div>
                            {(selectedHero || allowEmpty) && (
                                <ChevronRight size={18} className="absolute right-4 opacity-50 animate-in slide-in-from-left-2 repeat-infinite duration-1000" />
                            )}
                        </>
                    )}
                    {(selectedHero || allowEmpty) && !isAnalyzing && (
                        <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-[shimmer_2s_infinite]"></div>
                    )}
                </button>
            </div>
            
            {/* 底部提示 */}
            {!selectedHero && !allowEmpty && (
                <div className="absolute -bottom-8 left-0 w-full text-center z-10">
                    <span className="text-[10px] text-red-500 font-bold tracking-wider flex items-center justify-center gap-1 animate-bounce drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                        <Swords size={12}/> 请先选择双方阵容的英雄
                    </span>
                </div>
            )}
        </div>
    );
}