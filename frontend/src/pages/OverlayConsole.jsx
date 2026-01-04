import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, RotateCcw, Keyboard, Activity, MousePointer2, HelpCircle, Zap, AlertCircle } from 'lucide-react';
import AnalysisResult from '../components/AnalysisResult';
import SettingsModal from '../components/modals/SettingsModal';
import UserGuide from '../components/UserGuide';
import { Toaster, toast, useToasterStore } from 'react-hot-toast';

const OverlayConsole = ({ state, actions }) => {
    const { 
        lcuStatus, aiResults, analyzeType, isModeAnalyzing,
        currentShortcuts, showSettingsModal, activeTab,
        blueTeam, redTeam, myTeamRoles, enemyLaneAssignments,
        gamePhase 
    } = state;

    const { 
        handleAnalyze, setShowSettingsModal, setFeedbackContent,
        setShowFeedbackModal, sendChatTrigger, setActiveTab
    } = actions;

    const [isMouseLocked, setIsMouseLocked] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    
    // 判断是否在游戏中
    const isInGame = gamePhase === 'InProgress';
    
    const contentRef = useRef(null);
    const { toasts } = useToasterStore();

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

    const mouseKey = fmt(currentShortcuts?.mouseMode || 'Tilde');
    const refreshKey = fmt(currentShortcuts?.refresh || 'S'); // 显示字母 'F'
    const scrollUpKey = fmt(currentShortcuts?.scrollUp || 'S'); // 显示字母 'S'
    const scrollDownKey = fmt(currentShortcuts?.scrollDown || 'X'); // 显示字母 'X'
    const toggleKey = fmt(currentShortcuts?.toggle || 'Home');
    const modePrevKey = fmt(currentShortcuts?.modePrev || 'Z'); // 'Z'
    const modeNextKey = fmt(currentShortcuts?.modeNext || 'C'); // 'C'
    const prevPageKey = fmt(currentShortcuts?.prevPage || 'Left'); // 'A'
    const nextPageKey = fmt(currentShortcuts?.nextPage || 'Right'); // 'D'

    // 🔥 [更新] 引导文案，反映新的 Ctrl 左手键位
    const overlaySteps = useMemo(() => [
        {
            target: '#overlay-header',
            title: "HexLite 迷你模式",
            description: `按住标题栏可拖动。使用 ${toggleKey} 键隐藏窗口。`,
        },
        {
            target: '#mouse-mode-hint', 
            title: "自由调整大小 (智能记忆)",
            description: `按 ${mouseKey} 解锁鼠标后，拖拽边缘即可调整窗口大小。\n\n💡 重点：软件会【分别记住】你在“选人阶段”和“游戏中”设置的大小。`,
        },
        {
            target: '#team-status-wrapper', 
            title: "阵容确认 (仅游戏外显示)",
            description: "左侧我方，右侧敌方。**若分路显示错误，请去网页端调整**。\n此栏在游戏开始后会自动隐藏，以防遮挡视野。",
        },
        {
            target: '#overlay-content-area',
            title: "游戏内极简模式",
            description: `进入游戏后，窗口将变身【透明阅读板】。\n快捷键已优化 (Ctrl组合)：\nCtrl+Z/C 切换模块\nCtrl+A/D 翻页\nCtrl+S/X 滚动\nCtrl+F 开始分析`,
            placement: 'center'
        }
    ], [mouseKey, refreshKey, toggleKey]);

    const currentResult = aiResults && aiResults[analyzeType] ? aiResults[analyzeType] : null;
    const isAnalyzing = isModeAnalyzing(analyzeType);
    
    const MODULE_NAMES = {
        bp: 'BP 推荐',
        personal: '王者私教',
        team: '团队策略'
    };

    useEffect(() => {
        const hasSeenV3 = localStorage.getItem('has_seen_overlay_guide_v3');
        const hasSeenV4 = localStorage.getItem('has_seen_overlay_guide_v4');
        const hasSeen = hasSeenV3 || hasSeenV4;

        if (!hasSeen) {
            const timer = setTimeout(() => {
                if (!isMouseLocked) {
                    toast.dismiss();
                    setShowGuide(true);
                } else {
                    if (toasts.length === 0) {
                        toast(`按 ${mouseKey} 键解锁鼠标后，点击 '?' 查看新手指引`, { 
                            icon: '💡', 
                            duration: 5000,
                            id: 'guide-hint', 
                            style: { background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155' }
                        });
                    }
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isMouseLocked, mouseKey, toasts.length]);

    const handleGuideComplete = () => {
        setShowGuide(false);
        localStorage.setItem('has_seen_overlay_guide_v3', 'true');
        localStorage.setItem('has_seen_overlay_guide_v4', 'true');
    };

    const handleStartGuide = () => {
        if (isMouseLocked) {
            toast.error(`请先按 ${mouseKey} 键解锁鼠标穿透！`, { id: 'mouse-lock-error' });
        } else {
            toast.dismiss();
            setShowGuide(true);
        }
    };

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

    useEffect(() => {
        if (contentRef.current) contentRef.current.scrollTop = 0;
    }, [activeTab, analyzeType]);

    const ROLE_CN = { "TOP": "上", "JUNGLE": "野", "MID": "中", "ADC": "下", "SUPPORT": "辅", "NONE": "?" };
    
    const TeamIcons = ({ team, isEnemy }) => (
        <div className={`flex items-center gap-1.5 ${isEnemy ? 'flex-row-reverse' : ''}`}>
            {team.map((hero, idx) => {
                let roleKey = "NONE";
                if (!isEnemy) {
                    if (myTeamRoles && myTeamRoles[idx]) roleKey = myTeamRoles[idx];
                } else {
                    if (hero && enemyLaneAssignments) {
                        const found = Object.keys(enemyLaneAssignments).find(r => enemyLaneAssignments[r] === hero.name);
                        if (found) roleKey = found;
                    }
                }
                const roleChar = ROLE_CN[roleKey] || "?";

                return (
                    <div key={idx} className="relative group">
                        <div className={`absolute -top-1.5 ${isEnemy ? '-left-1' : '-right-1'} z-10 w-3.5 h-3.5 flex items-center justify-center bg-[#091428] border border-white/20 rounded-full shadow-md`}>
                            <span className={`text-[8px] font-black ${isEnemy ? 'text-red-400' : 'text-blue-400'}`}>{roleChar}</span>
                        </div>
                        <div className={`w-6 h-6 rounded-sm overflow-hidden border ${isEnemy ? 'border-red-500/40' : 'border-blue-500/40'} bg-black/60`}>
                            {hero ? (
                                <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover" title={`${hero.name} (${roleKey})`}/>
                            ) : (
                                <div className="w-full h-full opacity-20 bg-slate-700"></div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    );

    // 🔥 In-Game 样式：背景透明，但保留标题栏可见性
    const containerClass = isInGame
        ? `bg-transparent border-transparent` 
        : `bg-[#091428]/95 backdrop-blur-md border-[#C8AA6E]/40 border-2`;

    const textShadowStyle = isInGame 
        ? { textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' }
        : {};

    return (
        <div className={`h-screen w-screen bg-transparent overflow-hidden relative transition-all duration-300 ${!isMouseLocked ? 'bg-black/20' : ''}`}>
            <Toaster position="top-center" />

            <UserGuide 
                isOpen={showGuide} 
                steps={overlaySteps} 
                onClose={handleGuideComplete} 
                onComplete={handleGuideComplete}
            />

            <div className={`
                absolute flex flex-col pointer-events-auto rounded-xl shadow-2xl animate-in slide-in-from-right duration-300
                ${containerClass}
                ${!isMouseLocked && !isInGame ? 'border-dashed border-amber-500/50 resize overflow-auto' : ''}
                ${!isMouseLocked && isInGame ? 'border border-amber-500/30 resize overflow-auto' : ''}
            `}
            style={{ 
                top: '0px', height: '100%', width: '100%',
                maxWidth: isMouseLocked ? '100%' : '100%', position: 'relative'
            }}>
                
                {!isMouseLocked && !showGuide && (
                    <div id="mouse-mode-hint" className="absolute top-2 left-2 text-amber-500 text-xs font-bold bg-black/80 px-2 py-1 rounded flex items-center gap-1 shadow-lg border border-amber-500/30 z-50 pointer-events-none animate-in fade-in duration-300">
                        <MousePointer2 size={12}/> <span>鼠标模式：可拖拽边缘调整大小</span>
                    </div>
                )}

                {/* 🔥 [修复] 游戏内标题栏：始终显示模块名，加半透明黑色背景，不需hover */}
                <div id="overlay-header" className={`
                    h-10 flex items-center justify-between px-3 select-none rounded-t-xl cursor-move drag-region shrink-0 transition-all duration-300 group/header
                    ${isInGame ? 'bg-black/40 border-transparent' : 'bg-[#010A13]/90 border-b border-[#C8AA6E]/30'}
                `}>
                    <div className="flex items-center gap-3">
                        {!isInGame && (
                            <div className="flex items-center gap-2">
                                <span className="text-[#C8AA6E] font-bold text-xs tracking-widest">HEX LITE</span>
                                <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] transition-colors duration-500 ${lcuStatus === 'connected' ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'}`}></div>
                            </div>
                        )}
                        <div id="overlay-module-title" className="flex items-center gap-2 no-drag ml-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${isInGame ? 'text-white/90 font-black' : 'text-slate-300 bg-white/5 border border-white/5'}`}>
                                {MODULE_NAMES[analyzeType] || analyzeType.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    {/* Controls: 游戏内仅在 hover 时完全不透明显示，或者保持半透明 */}
                    <div id="overlay-controls" className={`flex items-center gap-2 no-drag transition-opacity duration-200 ${isInGame ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                        <div className="hidden sm:flex items-center gap-1 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5 mr-1" title="显示/隐藏窗口快捷键">
                            <Keyboard size={10}/> <span>{toggleKey}</span>
                        </div>
                        <button onClick={handleStartGuide} className="text-slate-500 hover:text-[#0AC8B9] transition-colors p-1 hover:bg-white/5 rounded" title="新手引导">
                            <HelpCircle size={14} />
                        </button>
                        <button onClick={() => handleAnalyze(analyzeType, true)} disabled={isAnalyzing} className={`text-slate-500 hover:text-[#0AC8B9] transition-colors ${isAnalyzing ? 'animate-spin opacity-50' : ''}`} title={`点此重新分析 (Ctrl+${refreshKey})`}>
                            <RotateCcw size={14} />
                        </button>
                        <button onClick={() => setShowSettingsModal(true)} className="text-slate-500 hover:text-[#C8AA6E] transition-colors p-1 hover:bg-white/5 rounded" title="打开设置"><Settings size={14} /></button>
                    </div>
                </div>

                <div id="team-status-wrapper">
                    {!isInGame && (
                        <div id="team-status-bar" className="flex flex-col bg-black/40 border-b border-white/5 shrink-0 select-none animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider scale-90">我方</span>
                                    <TeamIcons team={blueTeam || Array(5).fill(null)} isEnemy={false} />
                                </div>
                                <div className="text-[8px] text-slate-700 font-mono opacity-50">VS</div>
                                <div className="flex items-center gap-2">
                                    <TeamIcons team={redTeam || Array(5).fill(null)} isEnemy={true} />
                                    <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider scale-90">敌方</span>
                                </div>
                            </div>
                            <div className="w-full bg-yellow-500/5 border-t border-yellow-500/10 py-0.5 text-center">
                                <p className="text-[9px] text-slate-500 flex items-center justify-center gap-1">
                                    <AlertCircle size={8} className="text-yellow-600"/>
                                    分路不对？请去 <span className="text-slate-400 underline decoration-slate-600 cursor-help" title="点击托盘图标打开主控台">网页端手动调整</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div id="overlay-content-area" ref={contentRef} style={textShadowStyle} className="flex-1 min-h-0 overflow-y-auto p-2 no-drag relative flex flex-col custom-scrollbar scroll-smooth">
                    {currentResult ? (
                        <AnalysisResult aiResult={currentResult} isAnalyzing={isAnalyzing} setShowFeedbackModal={setShowFeedbackModal} setFeedbackContent={setFeedbackContent} sendChatTrigger={sendChatTrigger} forceTab={activeTab} />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 p-6 min-h-[180px]">
                            <div className={`p-3 rounded-full ${isInGame ? 'bg-black/30' : 'bg-white/5 border border-white/5'}`}>
                                <Activity size={24} className="opacity-40"/>
                            </div>
                            {!isInGame && (
                                <div className="text-center space-y-1">
                                    <p className="text-xs font-bold text-slate-400">阵容已就绪</p>
                                    <p className="text-[10px] text-slate-600">请确认上方分路角标是否正确</p>
                                </div>
                            )}
                            <button onClick={() => handleAnalyze(analyzeType, true)} disabled={isAnalyzing} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black tracking-wide shadow-lg transition-all active:scale-95 group ${isAnalyzing ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-gradient-to-r from-[#0AC8B9] to-[#089186] text-[#091428] hover:brightness-110 hover:shadow-[#0AC8B9]/30'}`}>
                                <Zap size={14} className={isAnalyzing ? "animate-spin" : "fill-current"} />
                                <span>{isAnalyzing ? "AI 思考中..." : "开始战术分析"}</span>
                            </button>
                            <div className={`text-[9px] font-mono text-slate-600 px-2 py-1 rounded flex items-center gap-1 ${isInGame ? 'bg-black/30' : 'bg-black/20 border border-white/5'}`}>
                                <Keyboard size={10}/> <span>快捷键: Ctrl + {refreshKey}</span>
                            </div>
                        </div>
                    )}
                </div>
                
                {!isInGame && (
                    <div className="bg-black/80 border-t border-white/5 py-1 px-2.5 text-[9px] text-slate-500 flex justify-between items-center no-drag select-none shrink-0 rounded-b-xl overflow-hidden backdrop-blur-sm">
                        <div className="flex gap-3 items-center">
                            <span className="whitespace-nowrap flex items-center gap-1" title="切换功能模块"><b className="text-slate-400 font-sans">Ctrl+{modePrevKey}/{modeNextKey}</b> 切换</span>
                            <span className="w-px h-2 bg-white/10"></span>
                            <span className="whitespace-nowrap flex items-center gap-1" title="切换当前页内容"><b className="text-slate-400 font-sans">Ctrl+{prevPageKey}/{nextPageKey}</b> 翻页</span>
                            <span className="w-px h-2 bg-white/10"></span>
                            <span className="whitespace-nowrap flex items-center gap-1" title="上下滚动文字"><b className="text-slate-400 font-sans">Ctrl+{scrollUpKey}/{scrollDownKey}</b> 滚动</span>
                        </div>
                        <div className="flex items-center gap-1 ml-2 font-mono opacity-80">
                            <span className="text-amber-500 font-bold">{mouseKey}</span><span>鼠标</span>
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