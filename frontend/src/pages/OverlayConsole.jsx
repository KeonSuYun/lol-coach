import React, { useState, useEffect, useRef } from 'react';
import { Settings, RotateCcw, Keyboard, Activity, MousePointer2, Minus, Square } from 'lucide-react';
import AnalysisResult from '../components/AnalysisResult';
import SettingsModal from '../components/modals/SettingsModal';
import { Toaster, toast } from 'react-hot-toast';

const OverlayConsole = ({ state, actions }) => {
    const { 
        lcuStatus, aiResults, analyzeType, isModeAnalyzing,
        currentShortcuts, showSettingsModal, activeTab        
    } = state;

    const { 
        handleAnalyze, setShowSettingsModal, setFeedbackContent,
        setShowFeedbackModal, sendChatTrigger, setActiveTab
    } = actions;

    const [isMouseLocked, setIsMouseLocked] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const contentRef = useRef(null);

    useEffect(() => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('mouse-ignore-status', (e, ignored) => setIsMouseLocked(ignored));
            ipcRenderer.invoke('get-mouse-status').then(setIsMouseLocked);

            // 滚动逻辑 (Alt+S/X)
            const handleScroll = (event, direction) => {
                if (contentRef.current) {
                    const scrollAmount = 40; 
                    const currentTop = contentRef.current.scrollTop;
                    contentRef.current.scrollTop = direction === 'down' 
                        ? currentTop + scrollAmount 
                        : currentTop - scrollAmount;
                }
            };
            ipcRenderer.on('scroll-action', handleScroll);
            return () => ipcRenderer.removeListener('scroll-action', handleScroll);
        }
    }, []);

    // 切换 Tab 或 模式 时自动回到顶部
    useEffect(() => {
        if (contentRef.current) contentRef.current.scrollTop = 0;
    }, [activeTab, analyzeType]);

    const currentResult = aiResults && aiResults[analyzeType] ? aiResults[analyzeType] : null;
    const isAnalyzing = isModeAnalyzing(analyzeType);
    
    // 模块名称映射
    const MODULE_NAMES = {
        bp: 'BP 推荐',
        personal: '王者私教',
        team: '团队策略'
    };

    // 格式化按键
    const fmt = (key) => {
        if (!key) return '?';
        const map = {
            'LBtn': '左键', 'RBtn': '右键', 'MBtn': '中键',
            'Tilde': '~', 'Backquote': '~', 'Quote': "'",
            'Space': '空格', 'Enter': '回车', 'Tab': 'Tab',
            'Escape': 'Esc', 'PageUp': 'PgUp', 'PageDown': 'PgDn',
            'Up': '↑', 'Down': '↓', 'Left': '←', 'Right': '→'
        };
        return map[key] || key.toUpperCase();
    };

    const toggleKey = fmt(currentShortcuts?.toggle || 'Home');
    const mouseKey = fmt(currentShortcuts?.mouseMode || 'Tilde');
    const refreshKey = fmt(currentShortcuts?.refresh || 'S');
    
    const modePrevKey = fmt(currentShortcuts?.modePrev || 'Z');
    const modeNextKey = fmt(currentShortcuts?.modeNext || 'C');
    
    const prevPageKey = fmt(currentShortcuts?.prevPage || '左键');
    const nextPageKey = fmt(currentShortcuts?.nextPage || '右键');
    
    const scrollUpKey = fmt(currentShortcuts?.scrollUp || 'S');
    const scrollDownKey = fmt(currentShortcuts?.scrollDown || 'X');

    return (
        <div className={`h-screen w-screen bg-transparent overflow-hidden relative transition-all duration-300 ${!isMouseLocked ? 'bg-black/20' : ''}`}>
            <Toaster position="top-center" />

            {/* 悬浮窗 */}
            <div className={`
                absolute flex flex-col pointer-events-auto bg-[#091428]/95 backdrop-blur-md rounded-xl shadow-2xl animate-in slide-in-from-right duration-300
                ${!isMouseLocked ? 'border-2 border-dashed border-amber-500/50 resize overflow-auto' : 'border border-[#C8AA6E]/40'}
            `}
            style={{ 
                top: '0px', height: isCollapsed ? 'auto' : '100%', width: '100%', 
                maxWidth: isMouseLocked ? '100%' : '100%', position: 'relative'
            }}>
                
                {!isMouseLocked && (
                    <div className="absolute top-2 left-2 text-amber-500 text-xs font-bold bg-black/80 px-2 py-1 rounded flex items-center gap-1 shadow-lg border border-amber-500/30 z-50 pointer-events-none">
                        <MousePointer2 size={12}/> <span>鼠标模式：可拖拽边缘调整大小</span>
                    </div>
                )}

                {/* Header - 极致简约版 */}
                <div onDoubleClick={() => setIsCollapsed(!isCollapsed)} className="h-10 bg-[#010A13]/90 border-b border-[#C8AA6E]/30 flex items-center justify-between px-3 select-none rounded-t-xl cursor-move drag-region shrink-0">
                    <div className="flex items-center gap-3">
                        {/* 收起/展开 */}
                        <button onClick={() => setIsCollapsed(!isCollapsed)} className="no-drag text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded -ml-1">
                            {isCollapsed ? <Square size={12} fill="currentColor" className="opacity-80"/> : <Minus size={14} />}
                        </button>
                        
                        {/* LOGO & 状态灯 */}
                        <div className="flex items-center gap-2">
                            <span className="text-[#C8AA6E] font-bold text-xs tracking-widest">HEX LITE</span>
                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] transition-colors duration-500 ${lcuStatus === 'connected' ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'}`}></div>
                        </div>

                        {/* 模块名称 (移除分隔线，让视觉更流畅) */}
                        {!isCollapsed && (
                            <div className="flex items-center gap-2 no-drag ml-1">
                                <span className="text-[10px] font-bold bg-white/5 text-slate-300 px-2 py-0.5 rounded border border-white/5 uppercase tracking-wide">
                                    {MODULE_NAMES[analyzeType] || analyzeType.toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* 右侧操作区 */}
                    <div className="flex items-center gap-2 no-drag">
                        {!isCollapsed && (
                            <div className="hidden sm:flex items-center gap-1 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5 mr-1">
                                <Keyboard size={10}/> <span>{toggleKey}</span>
                            </div>
                        )}
                        <button onClick={() => handleAnalyze(analyzeType, true)} disabled={isAnalyzing} className={`text-slate-500 hover:text-[#0AC8B9] transition-colors ${isAnalyzing ? 'animate-spin opacity-50' : ''}`} title={`刷新 (Alt+${refreshKey})`}><RotateCcw size={14} /></button>
                        <button onClick={() => setShowSettingsModal(true)} className="text-slate-500 hover:text-[#C8AA6E] transition-colors p-1 hover:bg-white/5 rounded"><Settings size={14} /></button>
                    </div>
                </div>

                {/* Body */}
                {!isCollapsed && (
                    <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto p-2 no-drag relative flex flex-col custom-scrollbar scroll-smooth">
                        {currentResult ? (
                            <AnalysisResult aiResult={currentResult} isAnalyzing={isAnalyzing} setShowFeedbackModal={setShowFeedbackModal} setFeedbackContent={setFeedbackContent} sendChatTrigger={sendChatTrigger} forceTab={activeTab} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 opacity-60 min-h-[150px]">
                                <Activity size={32} className="opacity-20"/>
                                <div className="text-center"><p className="text-xs font-bold text-slate-400">等待数据同步...</p><p className="text-[10px] text-slate-600 mt-1">网页端生成分析后自动显示</p></div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Footer (快捷键说明 - 紧凑排版) */}
                {!isCollapsed && (
                    <div className="bg-black/80 border-t border-white/5 py-1 px-2.5 text-[9px] text-slate-500 flex justify-between items-center no-drag select-none shrink-0 rounded-b-xl overflow-hidden backdrop-blur-sm">
                        
                        <div className="flex gap-3 items-center">
                            {/* 切换 */}
                            <span className="whitespace-nowrap flex items-center gap-1" title="切换功能模块">
                                <b className="text-slate-400 font-sans">Alt+{modePrevKey}/{modeNextKey}</b> 切换
                            </span>
                            
                            <span className="w-px h-2 bg-white/10"></span>
                            
                            {/* 翻页 */}
                            <span className="whitespace-nowrap flex items-center gap-1" title="切换当前页内容">
                                <b className="text-slate-400 font-sans">Alt+{prevPageKey}/{nextPageKey}</b> 翻页
                            </span>
                            
                            <span className="w-px h-2 bg-white/10"></span>
                            
                            {/* 滚动 */}
                            <span className="whitespace-nowrap flex items-center gap-1" title="上下滚动文字">
                                <b className="text-slate-400 font-sans">Alt+{scrollUpKey}/{scrollDownKey}</b> 滚动
                            </span>
                        </div>

                        {/* 鼠标 */}
                        <div className="flex items-center gap-1 ml-2 font-mono opacity-80">
                            <span className="text-amber-500 font-bold">{mouseKey}</span>
                            <span>鼠标</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="pointer-events-auto">
                <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
            </div>
        </div>
    );
};

export default OverlayConsole;