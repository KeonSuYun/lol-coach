import React, { useState, useEffect, useMemo } from 'react';
import MiniHUD from './MiniHUD';
import HexDashboard from './HexDashboard'; 
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';

export default function GameHudFrame({ 
    aiResults, 
    isMouseLocked, 
    mouseKey,
    visualConfig
}) {
    
    // =================================================================
    // 1. 数据流解析
    // =================================================================
    const dashboardData = useMemo(() => {
        if (!aiResults) return null;
        let dashboard = null;

        // A. 对象格式
        if (typeof aiResults === 'object') {
            dashboard = aiResults.dashboard;
        } 
        // B. 字符串格式 (流式贪吃蛇解析)
        else if (typeof aiResults === 'string') {
            try {
                const full = JSON.parse(aiResults);
                dashboard = full.dashboard;
            } catch (e) {
                const dashStart = aiResults.indexOf('"dashboard"');
                if (dashStart !== -1) {
                    const braceStart = aiResults.indexOf('{', dashStart);
                    if (braceStart !== -1) {
                        let balance = 0;
                        let braceEnd = -1;
                        for (let i = braceStart; i < aiResults.length; i++) {
                            if (aiResults[i] === '{') balance++;
                            else if (aiResults[i] === '}') {
                                balance--;
                                if (balance === 0) {
                                    braceEnd = i;
                                    break;
                                }
                            }
                        }
                        if (braceEnd !== -1) {
                            try {
                                const jsonStr = aiResults.substring(braceStart, braceEnd + 1);
                                dashboard = JSON.parse(jsonStr);
                            } catch (err) {}
                        }
                    }
                }
            }
        }
        return dashboard;
    }, [aiResults]);

    // 智能路由数据源
    const hudData = useMemo(() => {
        if (!dashboardData) return null;
        if (dashboardData.team_top_left_cards) return dashboardData.team_top_left_cards;
        if (dashboardData.hud) return dashboardData.hud;
        return null;
    }, [dashboardData]);

    // =================================================================
    // 2. 交互状态管理
    // =================================================================
    const [showMainHud, setShowMainHud] = useState(true); 
    const [tempUnlock, setTempUnlock] = useState(false); 

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Alt' || e.code === 'AltLeft') setTempUnlock(true);
            if (e.key === 'Tab') {
                e.preventDefault(); 
                setShowMainHud(prev => !prev);
            }
        };
        const handleKeyUp = (e) => {
            if (e.key === 'Alt' || e.code === 'AltLeft') setTempUnlock(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // 穿透逻辑：只有在锁定且未按Alt时，才穿透
    const pointerEventsClass = (isMouseLocked && !tempUnlock) ? 'pointer-events-none' : 'pointer-events-auto';
    const scale = visualConfig?.fontSize || 1.0; 
    
    // 缩放基准点不同：左上角以左上缩放，中间以顶部居中缩放
    const leftScaleStyle = { transform: `scale(${scale})`, transformOrigin: 'top left' };
    const centerScaleStyle = { transform: `scale(${scale})`, transformOrigin: 'top center' };

    // =================================================================
    // 3. 渲染视图 (Fixed 布局分离)
    // =================================================================
    return (
        <div className="relative w-screen h-screen overflow-hidden font-sans">
            
            {/* 🟢 1. Mini HUD (固定在屏幕左上角) 
               位置：Top 50px, Left 20px
            */}
            {hudData && (
                <div 
                    className={`fixed top-12 left-5 z-50 transition-opacity duration-300 ${pointerEventsClass}`}
                    style={leftScaleStyle}
                >
                    <MiniHUD data={hudData} />
                </div>
            )}

            {/* 🔵 2. Main Dashboard (详情页 - 顶部居中 / 地图上方) 
               位置：Top 0, Left 50% (居中)
            */}
            <div 
                className={`
                    fixed top-0 left-1/2 -translate-x-1/2 w-[720px] z-40 
                    transition-all duration-300 ease-out
                    ${showMainHud ? 'translate-y-0 opacity-100' : '-translate-y-[120%] opacity-0'} 
                    ${pointerEventsClass}
                `}
                style={centerScaleStyle}
            >
                <div className="bg-[#0f172a]/95 border-b border-x border-amber-500/30 rounded-b-xl shadow-2xl backdrop-blur-md overflow-hidden">
                    {/* 顶部提示栏 */}
                    <div className="flex justify-between items-center text-[10px] text-slate-500 bg-black/40 px-3 py-1 border-b border-white/5 select-none">
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1"><b className="text-amber-400 font-mono">TAB</b> 切换详情</span>
                            <span className="flex items-center gap-1"><b className="text-amber-400 font-mono">ALT</b> 解锁鼠标</span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-80">
                            {isMouseLocked && !tempUnlock ? <Lock size={10} /> : <Unlock size={10} className="text-amber-400"/>}
                            <span className="font-mono uppercase">{isMouseLocked && !tempUnlock ? "穿透中" : "可操作"}</span>
                        </div>
                    </div>
                    
                    {/* 仪表盘本体 */}
                    <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {dashboardData ? (
                            <HexDashboard 
                                data={dashboardData} 
                                isFarming={dashboardData?.meta?.style === 'farming' || dashboardData?.meta?.style === 'tempo'}
                                role={dashboardData?.meta?.role}
                            />
                        ) : (
                            <div className="text-center text-slate-500 py-6 text-xs flex flex-col items-center gap-2">
                                <span>等待战术数据...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 🔴 3. 辅助提示 (底部) */}
            {tempUnlock && isMouseLocked && (
                <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-amber-600/90 text-white text-xs px-4 py-2 rounded-full animate-bounce shadow-lg z-[60] pointer-events-none backdrop-blur">
                    👆 鼠标已临时激活
                </div>
            )}
            
            {/* 隐藏提示 (当大面板隐藏时显示一个小眼睛) */}
            {!showMainHud && dashboardData && (
                <div className="fixed top-2 left-1/2 -translate-x-1/2 opacity-50 hover:opacity-100 transition-opacity z-40">
                    <div className="bg-black/50 p-1.5 rounded-full border border-white/10 text-slate-400">
                        <EyeOff size={14} />
                    </div>
                </div>
            )}
        </div>
    );
};