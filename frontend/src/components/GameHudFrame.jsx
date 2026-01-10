import React, { useMemo } from 'react';
import { Zap, Lock, Unlock, Activity, AlertCircle } from 'lucide-react';
import AnalysisResult from './AnalysisResult';

const GameHudFrame = ({ 
    aiResults, 
    effectiveMode, 
    isAnalyzing, 
    viewMode, 
    activeTab, 
    setActiveTab, 
    isMouseLocked, // 来自 OverlayConsole 的状态 (true=穿透/锁定, false=可交互)
    mouseKey,      // 快捷键提示
    visualConfig   // 透明度/缩放配置
}) => {
    
    // 动态样式计算
    const containerStyle = useMemo(() => {
        const baseAlpha = isMouseLocked ? 0.2 : 0.8; // 锁定态背景几乎透明，交互态变深
        const scale = visualConfig?.fontSize || 1.0;
        
        return {
            backgroundColor: `rgba(0, 0, 0, ${baseAlpha})`,
            backdropFilter: isMouseLocked ? 'none' : 'blur(4px)',
            zoom: scale,
            // 游戏内核心：文字描边，防止背景太亮看不清
            textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)'
        };
    }, [isMouseLocked, visualConfig]);

    // 状态条颜色
    const statusColor = isAnalyzing ? 'bg-blue-500' : (aiResults ? 'bg-[#C8AA6E]' : 'bg-slate-600');
    const statusGlow = isAnalyzing ? 'shadow-[0_0_10px_#3b82f6]' : (aiResults ? 'shadow-[0_0_10px_#C8AA6E]' : '');

    return (
        <div 
            className={`
                w-full h-full flex flex-col relative transition-all duration-300 overflow-hidden
                ${!isMouseLocked ? 'border-2 border-[#C8AA6E] rounded-lg shadow-2xl' : 'border border-transparent'}
            `}
            style={containerStyle}
        >
            {/* --- 顶部：极简状态条 (HUD Header) --- */}
            {/* 只有在非穿透模式，或者正在分析时，才显示明显的头部，否则尽量隐形 */}
            <div className={`
                shrink-0 h-1 md:h-1.5 w-full flex items-center transition-all duration-500
                ${statusColor} ${statusGlow}
                ${!isMouseLocked ? 'opacity-100' : 'opacity-40'}
            `}>
                {/* 拖拽手柄 (仅非锁定时显示) */}
                {!isMouseLocked && (
                    <div className="absolute top-0 right-0 left-0 h-6 bg-transparent cursor-move drag-region group z-50">
                        <div className="mx-auto w-12 h-1 bg-white/20 mt-2 rounded-full group-hover:bg-white/50 transition-colors"/>
                    </div>
                )}
            </div>

            {/* --- 中间：内容区域 --- */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
                {aiResults ? (
                    <div className="h-full overflow-y-auto no-scrollbar scroll-smooth pl-2 pr-1 pt-1">
                        <AnalysisResult 
                            aiResult={aiResults}
                            isAnalyzing={isAnalyzing}
                            viewMode={viewMode}
                            forceTab={activeTab} 
                            setActiveTab={setActiveTab}
                            isInGame={true}  // 🔥 触发紧凑模式样式
                            isOverlay={true}
                            globalScale={1.0} // 缩放由外层容器控制
                        />
                    </div>
                ) : (
                    // 空状态占位
                    <div className="h-full flex flex-col items-center justify-center text-white/50 space-y-2">
                        {isAnalyzing ? (
                            <Zap size={24} className="animate-spin text-blue-400"/>
                        ) : (
                            <Activity size={24} className="opacity-50"/>
                        )}
                        <span className="text-xs font-bold tracking-widest uppercase">
                            {isAnalyzing ? "TACTICAL ANALYSIS..." : "AWAITING DATA"}
                        </span>
                    </div>
                )}
            </div>

            {/* --- 底部：极简信息栏 (HUD Footer) --- */}
            <div className={`
                shrink-0 flex justify-between items-center px-2 py-1 
                text-[9px] font-mono tracking-wider
                ${!isMouseLocked ? 'bg-black/60 border-t border-white/10' : 'bg-transparent text-white/40'}
            `}>
                {/* 左侧：分页指示器 (类似 iPhone 底部圆点) */}
                <div className="flex gap-1">
                    {/* 假设最多5页，这里应该根据 activeTabsData 生成，简化处理先写死或传参 */}
                    {[0, 1, 2].map(idx => (
                        <div key={idx} className={`
                            w-1.5 h-1.5 rounded-full transition-colors 
                            ${activeTab === idx ? 'bg-[#C8AA6E] shadow-[0_0_5px_currentColor]' : 'bg-white/20'}
                        `}/>
                    ))}
                </div>

                {/* 右侧：状态图标 */}
                <div className="flex items-center gap-2">
                    {/* 锁定状态提示 */}
                    <div className="flex items-center gap-1 opacity-70">
                        {isMouseLocked ? <Lock size={8} /> : <Unlock size={8} className="text-[#C8AA6E]" />}
                        <span className="uppercase">{mouseKey}</span>
                    </div>
                </div>
            </div>

            {/* --- 交互模式下的额外遮罩 (Edit Mode Overlay) --- */}
            {!isMouseLocked && (
                <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 rounded-lg z-[60]">
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-[10px] text-[#C8AA6E] border border-[#C8AA6E]/30 shadow-lg">
                        编辑模式
                    </div>
                    {/* 四角装饰 */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#C8AA6E]"/>
                    <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#C8AA6E]"/>
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#C8AA6E]"/>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#C8AA6E]"/>
                </div>
            )}
        </div>
    );
};

export default GameHudFrame;