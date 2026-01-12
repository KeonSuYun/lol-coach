import React, { useState, useEffect } from 'react';
import { 
    Flag, Target, AlertTriangle, 
    CheckCircle2, XCircle, Eye, Move, Brain
} from 'lucide-react';

export default function MiniHUD({ data, visualConfig, isLocked }) {
    // 1. 默认字体 1.5x
    const scale = visualConfig?.fontSize || 1.5;
    
    // 2. 透明度处理：只影响背景色
    const rawAlpha = 1 - (visualConfig?.transparency || 80) / 100; // 默认80%透明
    const bgAlpha = Math.max(0.1, rawAlpha); 
    
    const headerBg = `rgba(15, 23, 42, ${Math.min(0.95, bgAlpha + 0.1)})`; 
    const bodyBg = `rgba(15, 23, 42, ${bgAlpha})`; 

    const containerStyle = { zoom: scale };

    // JS 窗口缩放逻辑
    const handleResizeStart = (e, direction) => {
        if (isLocked) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.screenX;
        const startY = e.screenY;
        const startW = window.outerWidth;
        const startH = window.outerHeight;
        const startWinX = window.screenX;
        const startWinY = window.screenY;

        const handleMove = (moveEvent) => {
            const dx = moveEvent.screenX - startX;
            const dy = moveEvent.screenY - startY;
            
            let newW = startW;
            let newH = startH;
            let newX = startWinX;
            let newY = startWinY;

            if (direction.includes('e')) newW = startW + dx;
            if (direction.includes('w')) { newW = startW - dx; newX = startWinX + dx; }
            if (direction.includes('s')) newH = startH + dy;
            if (direction.includes('n')) { newH = startH - dy; newY = startWinY + dy; }

            if (newW < 200) newW = 200;
            if (newH < 100) newH = 100;

            if (direction.includes('n') || direction.includes('w')) {
                window.moveTo(newX, newY);
            }
            window.resizeTo(newW, newH);
        };

        const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    };

    return (
        <>
            <style>{`
                .app-drag { -webkit-app-region: drag; }
                .app-no-drag { -webkit-app-region: no-drag; }
            `}</style>

            <div style={containerStyle} className="w-full h-full overflow-hidden">
                <div className={`
                    relative w-full h-full flex flex-col rounded-lg transition-all duration-300 overflow-hidden box-border
                    ${!isLocked 
                        ? "border-2 border-amber-400 shadow-2xl pointer-events-auto" 
                        : "border-2 border-transparent pointer-events-none" 
                    }
                `}>
                    
                    {!isLocked && <ResizeHandles onResizeStart={handleResizeStart} />}

                    {!data && (
                        <div 
                            className="flex-1 flex items-center justify-center rounded-lg border border-slate-700/50 backdrop-blur-md"
                            style={{ backgroundColor: bodyBg }}
                        >
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 rounded-full shadow-lg animate-pulse">
                                <Brain size={14} className="text-amber-500 animate-pulse"/>
                                <span className="text-xs font-bold text-slate-400 tracking-wider">THINKING...</span>
                            </div>
                            
                            {!isLocked && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                     <div className="w-32 h-16 app-drag pointer-events-auto cursor-move" title="按住此处移动"></div>
                                </div>
                            )}
                        </div>
                    )}

                    {data && (
                        <div className={`flex-1 flex flex-col overflow-hidden relative ${isLocked ? "" : "pointer-events-none"}`}>
                            {!!(data.win_condition || data.game_plan) 
                                ? <TeamMiniHUD data={data} isLocked={isLocked} bgStyle={{ header: headerBg, body: bodyBg }} /> 
                                : <JungleMiniHUD data={data} isLocked={isLocked} bgStyle={{ header: headerBg, body: bodyBg }} />
                            }
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

const ResizeHandles = ({ onResizeStart }) => {
    const baseClass = "absolute z-50 app-no-drag bg-transparent pointer-events-auto";
    const cornerClass = "absolute z-[60] w-4 h-4 app-no-drag bg-transparent pointer-events-auto";
    return (
        <>
            <div className={`${baseClass} top-0 left-4 right-4 h-[8px] cursor-n-resize`} onMouseDown={(e) => onResizeStart(e, 'n')} />
            <div className={`${baseClass} bottom-0 left-4 right-4 h-[8px] cursor-s-resize`} onMouseDown={(e) => onResizeStart(e, 's')} />
            <div className={`${baseClass} left-0 top-4 bottom-4 w-[8px] cursor-w-resize`} onMouseDown={(e) => onResizeStart(e, 'w')} />
            <div className={`${baseClass} right-0 top-4 bottom-4 w-[8px] cursor-e-resize`} onMouseDown={(e) => onResizeStart(e, 'e')} />
            <div className={`${cornerClass} top-0 left-0 cursor-nw-resize`} onMouseDown={(e) => onResizeStart(e, 'nw')} />
            <div className={`${cornerClass} top-0 right-0 cursor-ne-resize`} onMouseDown={(e) => onResizeStart(e, 'ne')} />
            <div className={`${cornerClass} bottom-0 left-0 cursor-sw-resize`} onMouseDown={(e) => onResizeStart(e, 'sw')} />
            <div className={`${cornerClass} bottom-0 right-0 cursor-se-resize bg-amber-400/20 rounded-tl`} onMouseDown={(e) => onResizeStart(e, 'se')} />
        </>
    );
};

function JungleMiniHUD({ data, isLocked, bgStyle }) {
    const { headline_short, phase, next_actions = [] } = data;

    return (
        <div 
            className="w-full h-full backdrop-blur-md border border-slate-700/60 flex flex-col rounded-lg overflow-hidden"
            style={{ backgroundColor: bgStyle.body }}
        >
            <div 
                className={`flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0 ${!isLocked ? 'app-drag cursor-move pointer-events-auto' : ''}`}
                style={{ backgroundColor: bgStyle.header }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wide">
                        {phase || "JUNGLE"}
                    </span>
                    {!isLocked && <Move size={10} className="text-amber-400/80"/>}
                </div>
                {/* 🔥 已移除置信度显示 */}
            </div>

            <div className="px-3 pt-3 pb-2 flex-1 overflow-hidden flex flex-col gap-2 app-no-drag">
                <h3 className="text-[15px] font-extrabold text-white leading-tight line-clamp-2 drop-shadow-md">
                    {headline_short || "正在分析..."}
                </h3>
                <div className="space-y-1.5">
                    {next_actions.slice(0, 3).map((act, i) => (
                        <div key={i} className="flex items-start gap-2 text-[12px] text-slate-200 font-medium leading-snug drop-shadow-sm">
                            <span className="text-emerald-500 font-bold mt-[1px]">·</span>
                            <span className="line-clamp-1">{act}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TeamMiniHUD({ data, isLocked, bgStyle }) {
    const [activeTab, setActiveTab] = useState('win_condition'); 

    // 自动轮播
    useEffect(() => {
        const tabs = ['win_condition', 'game_plan', 'risk_plan'];
        const interval = setInterval(() => {
            setActiveTab(current => {
                const nextIdx = (tabs.indexOf(current) + 1) % tabs.length;
                return tabs[nextIdx];
            });
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const handler = (event, command) => {
                if (command === 'tab_win') setActiveTab('win_condition');
                if (command === 'tab_plan') setActiveTab('game_plan');
                if (command === 'tab_risk') setActiveTab('risk_plan');
            };
            ipcRenderer.on('shortcut-triggered', handler);
            return () => ipcRenderer.removeListener('shortcut-triggered', handler);
        }
    }, []);

    const safeData = {
        win_condition: data.win_condition || { title: "分析中...", summary: "等待战术生成..." },
        game_plan: data.game_plan || { title: "规划中...", priorities: [] },
        risk_plan: data.risk_plan || { title: "评估中...", avoid: [] },
        meta: data.meta || {}
    };

    const CONFIG = {
        win_condition: { 
            label: '胜利方式', accent: 'text-emerald-400', bg: 'bg-emerald-500', icon: Flag,
            getData: (d) => ({
                title: d.win_condition.title || "寻找制胜点",
                chips: (d.win_condition.keys || []).slice(0, 3),
                body: [ 
                    { prefix: '做', text: d.win_condition.summary, type: 'do' }, 
                    d.win_condition.validation_cue ? { prefix: '看', text: d.win_condition.validation_cue, type: 'watch' } : null 
                ].filter(Boolean),
                footer: "PlanB: 若受阻 → 转运营"
            })
        },
        game_plan: { 
            label: '本局规划', accent: 'text-blue-400', bg: 'bg-blue-500', icon: Target,
            getData: (d) => {
                const priorities = d.game_plan.priorities || [];
                return {
                    title: d.game_plan.title || "运营节奏规划",
                    chips: priorities.slice(0, 3).map(p => p.slice(0, 4)),
                    body: [ 
                        { prefix: '做', text: priorities[0], type: 'do' }, 
                        { prefix: '做', text: priorities[1], type: 'do' } 
                    ].filter(item => item && item.text),
                    footer: `信号: 注意 ${d.meta?.key_role || '关键人'} 动向`
                };
            }
        },
        risk_plan: { 
            label: '风险预警', accent: 'text-rose-400', bg: 'bg-rose-500', icon: AlertTriangle,
            getData: (d) => {
                const avoid = d.risk_plan.avoid || [];
                return {
                    title: d.risk_plan.title || "规避崩盘点",
                    chips: (d.risk_plan.key_threats || []).slice(0, 2),
                    body: [ 
                        { prefix: '别', text: avoid[0], type: 'dont' }, 
                        { prefix: '别', text: avoid[1], type: 'dont' } 
                    ].filter(item => item && item.text),
                    footer: "止损: 看到信号即撤退"
                };
            }
        }
    };

    const currentConfig = CONFIG[activeTab];
    const cardData = currentConfig.getData(safeData);
    const Icon = currentConfig.icon;
    const body2 = (cardData.body || []).slice(0, 2);

    const PREFIX_STYLES = {
        'do': { text: '做', color: 'text-emerald-400', icon: CheckCircle2 },
        'watch': { text: '看', color: 'text-amber-400', icon: Eye },
        'dont': { text: '别', color: 'text-rose-400', icon: XCircle }
    };

    return (
        <div className="w-full h-full flex flex-col font-sans select-none animate-in fade-in slide-in-from-left-4 duration-300">
            <div 
                className="backdrop-blur-xl border border-slate-700/60 flex flex-col relative h-full rounded-lg overflow-hidden"
                style={{ backgroundColor: bgStyle.body }}
            >
                <div className={`absolute top-0 left-0 w-full h-[2px] ${currentConfig.bg} opacity-80`}></div>

                <div 
                    className={`flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0 ${!isLocked ? 'app-drag cursor-move pointer-events-auto' : ''}`}
                    style={{ backgroundColor: bgStyle.header }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className={`flex items-center gap-1.5 ${currentConfig.accent}`}>
                            <Icon size={14} />
                            <span className="text-[12px] font-bold tracking-wide">{currentConfig.label}</span>
                        </div>
                        {!isLocked && <Move size={12} className="text-amber-400/80 animate-pulse"/>}
                    </div>
                    {/* 🔥 移除AI把握显示，仅保留快捷键提示 */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium font-mono">
                        <span className="text-slate-400">Ctrl+F1-3</span>
                    </div>
                </div>

                <div className="px-3 pt-3 pb-2 flex flex-col gap-2 flex-1 overflow-hidden app-no-drag">
                    <h2 className="text-[16px] font-extrabold text-white leading-tight tracking-wide drop-shadow-md truncate">
                        {cardData.title}
                    </h2>
                    {cardData.chips && cardData.chips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {cardData.chips.map((chip, i) => (
                                <span key={i} className="text-[10px] text-slate-200 bg-white/10 border border-white/20 px-2 py-0.5 rounded-full truncate max-w-[80px]">
                                    {chip}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="space-y-2 pt-1">
                        {body2.map((item, i) => {
                            const style = PREFIX_STYLES[item.type] || PREFIX_STYLES.do;
                            return (
                                <div key={i} className="flex items-start gap-2 text-[12px] leading-snug text-slate-200 font-medium drop-shadow-sm">
                                    <span className={`shrink-0 font-bold ${style.color}`}>{style.text}：</span>
                                    <span className="opacity-100 line-clamp-1" title={item.text}>{item.text}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div 
                    className="border-t border-white/5 px-3 py-2 flex items-center justify-between shrink-0 h-[32px] app-no-drag"
                    style={{ backgroundColor: `rgba(0, 0, 0, ${Math.min(0.6, parseFloat(bgStyle.header.split(',').pop().replace(')', '')))})` }}
                >
                    <span className="text-[10px] text-slate-400 font-medium line-clamp-1 max-w-[180px]">
                        {cardData.footer}
                    </span>
                    <div className="flex gap-1.5 shrink-0">
                        {['win_condition', 'game_plan', 'risk_plan'].map((key) => (
                            <div key={key} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeTab === key ? `${currentConfig.bg} scale-110` : 'bg-slate-700'}`} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}