import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, RotateCcw, Keyboard, Activity, MousePointer2, HelpCircle } from 'lucide-react';
import AnalysisResult from '../components/AnalysisResult';
import SettingsModal from '../components/modals/SettingsModal';
import UserGuide from '../components/UserGuide';
// 🔥 1. 引入 useToasterStore 和 toast，用于清除弹窗
import { Toaster, toast, useToasterStore } from 'react-hot-toast';

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
    const [showGuide, setShowGuide] = useState(false);
    
    const contentRef = useRef(null);

    // 🔥 2. 获取 Toast 状态，用于判断是否有弹窗需要清除
    const { toasts } = useToasterStore();

    // 格式化按键名称的辅助函数
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

    // 获取当前关键快捷键 (动态)
    const mouseKey = fmt(currentShortcuts?.mouseMode || 'Tilde');
    const refreshKey = fmt(currentShortcuts?.refresh || 'S');
    const scrollUpKey = fmt(currentShortcuts?.scrollUp || 'S');
    const scrollDownKey = fmt(currentShortcuts?.scrollDown || 'X');
    const toggleKey = fmt(currentShortcuts?.toggle || 'Home');
    const modePrevKey = fmt(currentShortcuts?.modePrev || 'Z');
    const modeNextKey = fmt(currentShortcuts?.modeNext || 'C');
    const prevPageKey = fmt(currentShortcuts?.prevPage || 'Left');
    const nextPageKey = fmt(currentShortcuts?.nextPage || 'Right');

    // 动态生成引导步骤
    const overlaySteps = useMemo(() => [
        {
            target: '#overlay-header',
            title: "HexLite 迷你模式",
            description: `这是游戏内覆盖窗口。按住标题栏可以【拖动位置】。如果遮挡视线，请使用快捷键 ${toggleKey} 来【显示/隐藏】整个窗口。`,
        },
        {
            target: '#overlay-module-title',
            title: "当前分析模式",
            description: `显示当前 AI 正在分析的内容。使用快捷键 Alt+${modePrevKey} / Alt+${modeNextKey} 可快速切换不同模式。`,
        },
        {
            target: '#overlay-controls',
            title: "快捷操作区",
            description: `这里可以手动刷新分析、打开设置。常用快捷键：Alt+${refreshKey} 刷新当前分析，按 ${mouseKey} 键锁定/解锁鼠标。`,
        },
        {
            target: '#overlay-content-area',
            title: "战术建议区域",
            description: `AI 分析结果显示于此。内容较长时，请使用 Alt+${scrollUpKey} / Alt+${scrollDownKey} 滚动查看。`,
            placement: 'center' // 🔥🔥🔥 [关键修改] 强制居中显示，防止超出小窗口
        }
    ], [mouseKey, refreshKey, scrollUpKey, scrollDownKey, modePrevKey, modeNextKey, toggleKey]);

    const currentResult = aiResults && aiResults[analyzeType] ? aiResults[analyzeType] : null;
    const isAnalyzing = isModeAnalyzing(analyzeType);
    
    const MODULE_NAMES = {
        bp: 'BP 推荐',
        personal: '王者私教',
        team: '团队策略'
    };

    // 首次加载检查
    useEffect(() => {
        const hasSeen = localStorage.getItem('has_seen_overlay_guide_v3');
        if (!hasSeen) {
            const timer = setTimeout(() => {
                if (!isMouseLocked) {
                    // 🔥 3. 自动开启引导前，清除所有 Toast
                    toast.dismiss();
                    setShowGuide(true);
                } else {
                    // 只有在没有 Toast 显示时才弹出新的提示，避免刷屏
                    if (toasts.length === 0) {
                        toast(`按 ${mouseKey} 键解锁鼠标后，点击 '?' 查看新手指引`, { 
                            icon: '💡', 
                            duration: 5000,
                            id: 'guide-hint', // 给个 ID 防止重复
                            style: { background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155' }
                        });
                    }
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isMouseLocked, mouseKey, toasts.length]); // 添加 toasts.length 依赖

    const handleGuideComplete = () => {
        setShowGuide(false);
        localStorage.setItem('has_seen_overlay_guide_v3', 'true');
    };

    const handleStartGuide = () => {
        if (isMouseLocked) {
            toast.error(`请先按 ${mouseKey} 键解锁鼠标穿透！`, { id: 'mouse-lock-error' });
        } else {
            // 🔥 4. 手动开启引导前，清除所有 Toast
            toast.dismiss();
            setShowGuide(true);
        }
    };

    // IPC 监听逻辑 (保持不变)
    useEffect(() => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('mouse-ignore-status', (e, ignored) => setIsMouseLocked(ignored));
            ipcRenderer.invoke('get-mouse-status').then(setIsMouseLocked);

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

    return (
        <div className={`h-screen w-screen bg-transparent overflow-hidden relative transition-all duration-300 ${!isMouseLocked ? 'bg-black/20' : ''}`}>
            <Toaster position="top-center" />

            <UserGuide 
                isOpen={showGuide} 
                steps={overlaySteps} 
                onClose={() => setShowGuide(false)}
                onComplete={handleGuideComplete}
            />

            {/* 悬浮窗主体 */}
            <div className={`
                absolute flex flex-col pointer-events-auto bg-[#091428]/95 backdrop-blur-md rounded-xl shadow-2xl animate-in slide-in-from-right duration-300
                ${!isMouseLocked ? 'border-2 border-dashed border-amber-500/50 resize overflow-auto' : 'border border-[#C8AA6E]/40'}
            `}
            style={{ 
                top: '0px', height: '100%', width: '100%',
                maxWidth: isMouseLocked ? '100%' : '100%', position: 'relative'
            }}>
                
                {/* 🔥 5. 修改鼠标模式提示的显示条件：增加 !showGuide */}
                {!isMouseLocked && !showGuide && (
                    <div className="absolute top-2 left-2 text-amber-500 text-xs font-bold bg-black/80 px-2 py-1 rounded flex items-center gap-1 shadow-lg border border-amber-500/30 z-50 pointer-events-none animate-in fade-in duration-300">
                        <MousePointer2 size={12}/> <span>鼠标模式：可拖拽边缘调整大小</span>
                    </div>
                )}

                {/* Header */}
                <div id="overlay-header" className="h-10 bg-[#010A13]/90 border-b border-[#C8AA6E]/30 flex items-center justify-between px-3 select-none rounded-t-xl cursor-move drag-region shrink-0">
                    <div className="flex items-center gap-3">
                        {/* LOGO & 状态灯 */}
                        <div className="flex items-center gap-2">
                            <span className="text-[#C8AA6E] font-bold text-xs tracking-widest">HEX LITE</span>
                            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] transition-colors duration-500 ${lcuStatus === 'connected' ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'}`}></div>
                        </div>

                        {/* 模块名称 */}
                        <div id="overlay-module-title" className="flex items-center gap-2 no-drag ml-1">
                            <span className="text-[10px] font-bold bg-white/5 text-slate-300 px-2 py-0.5 rounded border border-white/5 uppercase tracking-wide">
                                {MODULE_NAMES[analyzeType] || analyzeType.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div id="overlay-controls" className="flex items-center gap-2 no-drag">
                        {/* 显示隐藏的快捷键提示 */}
                        <div className="hidden sm:flex items-center gap-1 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5 mr-1" title="显示/隐藏窗口快捷键">
                            <Keyboard size={10}/> <span>{toggleKey}</span>
                        </div>
                        
                        <button onClick={handleStartGuide} className="text-slate-500 hover:text-[#0AC8B9] transition-colors p-1 hover:bg-white/5 rounded" title="新手引导">
                            <HelpCircle size={14} />
                        </button>

                        <button 
                            onClick={() => handleAnalyze(analyzeType, true)}
                            disabled={isAnalyzing} 
                            className={`text-slate-500 hover:text-[#0AC8B9] transition-colors ${isAnalyzing ? 'animate-spin opacity-50' : ''}`} 
                            title={`刷新当前分析 (Alt+${refreshKey})`}
                        >
                            <RotateCcw size={14} />
                        </button>
                        <button onClick={() => setShowSettingsModal(true)} className="text-slate-500 hover:text-[#C8AA6E] transition-colors p-1 hover:bg-white/5 rounded"><Settings size={14} /></button>
                    </div>
                </div>

                {/* Body */}
                <div id="overlay-content-area" ref={contentRef} className="flex-1 min-h-0 overflow-y-auto p-2 no-drag relative flex flex-col custom-scrollbar scroll-smooth">
                    {currentResult ? (
                        <AnalysisResult aiResult={currentResult} isAnalyzing={isAnalyzing} setShowFeedbackModal={setShowFeedbackModal} setFeedbackContent={setFeedbackContent} sendChatTrigger={sendChatTrigger} forceTab={activeTab} />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 opacity-60 min-h-[150px]">
                            <Activity size={32} className="opacity-20"/>
                            <div className="text-center"><p className="text-xs font-bold text-slate-400">等待数据同步...</p><p className="text-[10px] text-slate-600 mt-1">网页端生成分析后自动显示</p></div>
                        </div>
                    )}
                </div>
                
                {/* Footer (快捷键说明) */}
                <div className="bg-black/80 border-t border-white/5 py-1 px-2.5 text-[9px] text-slate-500 flex justify-between items-center no-drag select-none shrink-0 rounded-b-xl overflow-hidden backdrop-blur-sm">
                    <div className="flex gap-3 items-center">
                        <span className="whitespace-nowrap flex items-center gap-1" title="切换功能模块">
                            <b className="text-slate-400 font-sans">Alt+{modePrevKey}/{modeNextKey}</b> 切换
                        </span>
                        <span className="w-px h-2 bg-white/10"></span>
                        <span className="whitespace-nowrap flex items-center gap-1" title="切换当前页内容">
                            <b className="text-slate-400 font-sans">Alt+{prevPageKey}/{nextPageKey}</b> 翻页
                        </span>
                        <span className="w-px h-2 bg-white/10"></span>
                        <span className="whitespace-nowrap flex items-center gap-1" title="上下滚动文字">
                            <b className="text-slate-400 font-sans">Alt+{scrollUpKey}/{scrollDownKey}</b> 滚动
                        </span>
                    </div>

                    <div className="flex items-center gap-1 ml-2 font-mono opacity-80">
                        <span className="text-amber-500 font-bold">{mouseKey}</span>
                        <span>鼠标</span>
                    </div>
                </div>
            </div>

            <div className="pointer-events-auto">
                <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
            </div>
        </div>
    );
};

export default OverlayConsole;