import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, RotateCcw, Keyboard, Activity, MousePointer2, HelpCircle, Zap, AlertCircle, X } from 'lucide-react';
import AnalysisResult from '../components/AnalysisResult';
import SettingsModal from '../components/modals/SettingsModal';
import UserGuide from '../components/UserGuide';
import { Toaster, toast, useToasterStore } from 'react-hot-toast';

const OverlayConsole = ({ state, actions }) => {
    const { 
        lcuStatus, aiResults, analyzeType, isModeAnalyzing,
        currentShortcuts, showSettingsModal, activeTab,
        blueTeam, redTeam, myTeamRoles, enemyLaneAssignments, myLaneAssignments, 
        championList, 
        gamePhase,
        viewMode 
    } = state;

    const { 
        handleAnalyze, setShowSettingsModal, setFeedbackContent,
        setShowFeedbackModal, sendChatTrigger, setActiveTab, setViewMode, 
        handleClearAnalysis
    } = actions;

    const [isMouseLocked, setIsMouseLocked] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    
    // 🔥 语音触发计数器
    const [audioTrigger, setAudioTrigger] = useState(0);

    // 鼠标提示显隐状态
    const [hideMouseHint, setHideMouseHint] = useState(() => localStorage.getItem('hex_hide_mouse_hint') === 'true');
    
    // 环境检测
    const isElectron = useMemo(() => typeof window !== 'undefined' && !!window.require, []);
    const isInGame = gamePhase === 'InProgress';
    const contentRef = useRef(null);
    const { toasts } = useToasterStore();

    // 智能按键格式化
    const fmt = (keyString) => {
        if (!keyString) return '?';
        const map = {
            'LBtn': '左键', 'RBtn': '右键', 'MBtn': '中键',
            'Tilde': '~', 'Backquote': '~', 'Quote': "'",
            'Space': '空格', 'Enter': '回车', 'Tab': 'Tab',
            'Escape': 'Esc', 'PageUp': 'PgUp', 'PageDown': 'PgDn',
            'Up': '↑', 'Down': '↓', 'Left': '←', 'Right': '→',
            'Control': 'Ctrl', 'Command': 'Cmd', 'Option': 'Alt', 'Meta': 'Win'
        };
        return keyString.split('+').map(part => {
            const k = part.trim();
            return map[k] || k.toUpperCase();
        }).join('+');
    };

    // 🔥 智能缩写成对快捷键 (如 Ctrl+Z/Ctrl+C -> Ctrl+Z/C)
    const fmtPair = (key1, key2) => {
        const s1 = fmt(key1);
        const s2 = fmt(key2);
        // 检测前缀是否相同 (例如都是 "Ctrl+")
        const prefixRegex = /^(.+\+)(.+)$/;
        const m1 = s1.match(prefixRegex);
        const m2 = s2.match(prefixRegex);
        
        if (m1 && m2 && m1[1] === m2[1]) {
            // 如果前缀相同，合并显示
            return `${s1}/${m2[2]}`;
        }
        // 否则直接拼接
        return `${s1}/${s2}`;
    };

    const mouseKey = fmt(currentShortcuts?.mouseMode || 'Tilde');
    const refreshKey = fmt(currentShortcuts?.refresh || 'Ctrl+F'); 
    const toggleViewKey = fmt(currentShortcuts?.toggleView || 'Ctrl+E'); 
    const toggleKey = fmt(currentShortcuts?.toggle || 'Home');
    const playKey = fmt(currentShortcuts?.playAudio || 'Ctrl+Space');

    // 组合键显示字符串
    const modeSwitchStr = fmtPair(currentShortcuts?.modePrev || 'Ctrl+Z', currentShortcuts?.modeNext || 'Ctrl+C');
    const pageSwitchStr = fmtPair(currentShortcuts?.prevPage || 'Ctrl+A', currentShortcuts?.nextPage || 'Ctrl+D');
    const scrollStr = fmtPair(currentShortcuts?.scrollUp || 'Ctrl+S', currentShortcuts?.scrollDown || 'Ctrl+X');

    const overlaySteps = useMemo(() => [
        { target: '#overlay-header', title: "HexLite 迷你模式", description: `按住标题栏可拖动。使用 ${toggleKey} 键隐藏窗口。` },
        { target: '#mouse-mode-hint', title: "自由调整大小", description: `按 ${mouseKey} 解锁鼠标后，拖拽边缘即可调整窗口大小。` },
        { target: '#team-status-wrapper', title: "阵容确认", description: "仅在游戏外显示。若分路错误，请在网页端调整。" },
        { target: '#overlay-content-area', title: "游戏内模式", description: `进入游戏后窗口将变透明。\n快捷键：${refreshKey} 开始分析`, placement: 'center' }
    ], [toggleKey, mouseKey, refreshKey]);

    const MODULE_NAMES = {
        bp: 'BP 推荐',
        personal: '王者私教',
        team: '团队策略',
        role_jungle_farming: '王者私教 (野核)' 
    };

    const { effectiveResult, effectiveMode } = useMemo(() => {
        return { 
            effectiveResult: aiResults ? aiResults[analyzeType] : null, 
            effectiveMode: analyzeType 
        };
    }, [aiResults, analyzeType]);

    const isAnalyzing = isModeAnalyzing(effectiveMode);

    // 新手指引
    useEffect(() => {
        if (!isElectron) return; 
        const hasSeenV4 = localStorage.getItem('has_seen_overlay_guide_v4');
        if (!hasSeenV4) {
            const timer = setTimeout(() => {
                if (!isMouseLocked) { toast.dismiss(); setShowGuide(true); } 
                else if (toasts.length === 0) {
                    toast(`按 ${mouseKey} 键解锁鼠标后，点击 '?' 查看新手指引`, { 
                        icon: '💡', duration: 5000, id: 'guide-hint', 
                        style: { background: '#0f172a', color: '#cbd5e1', border: '1px solid #C8AA6E' }
                    });
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isMouseLocked, mouseKey, toasts.length, isElectron]);

    const handleGuideComplete = () => { setShowGuide(false); localStorage.setItem('has_seen_overlay_guide_v4', 'true'); };
    const handleStartGuide = () => {
        if (isMouseLocked) toast.error(`请先按 ${mouseKey} 键解锁鼠标穿透！`, { id: 'mouse-lock-error' });
        else { toast.dismiss(); setShowGuide(true); }
    };

    // Electron 通信 & 快捷键监听
    useEffect(() => {
        if (isElectron && window.require) {
            const { ipcRenderer } = window.require('electron');
            
            const handleMouseStatus = (e, ignored) => {
                setIsMouseLocked(ignored);
                if (ignored) {
                    toast((t) => (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-800 border border-slate-600 rounded flex items-center justify-center text-white font-mono font-bold shadow-lg">{mouseKey}</div>
                            <div><p className="font-bold text-white">已进入穿透模式</p><p className="text-xs text-slate-400">再次按下可呼出鼠标</p></div>
                        </div>
                    ), { 
                        id: 'mouse-lock-tip',
                        duration: 4000, 
                        position: 'top-center', 
                        style: { background: 'rgba(0, 0, 0, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff' } 
                    });
                }
            };

            const handleScroll = (event, direction) => {
                window.dispatchEvent(new CustomEvent('overlay-scroll', { detail: direction }));
            };

            const handleCommand = (event, command) => {
                if (command === 'refresh') {
                    if (!isAnalyzing) {
                        toast.loading("正在重新分析...", { duration: 1000, id: 'refresh-toast' });
                        handleAnalyze(effectiveMode, true);
                    }
                }
                if (command === 'nav_prev' || command === 'nav_next') {
                    window.dispatchEvent(new CustomEvent('overlay-nav', { detail: command }));
                }
                if (command === 'toggle_view') {
                    const nextMode = viewMode === 'simple' ? 'detailed' : 'simple';
                    setViewMode(nextMode);
                    toast(nextMode === 'simple' ? "简略模式" : "详细模式", { icon: nextMode === 'simple' ? '⚡' : '📝', duration: 800, id: 'view-toast' });
                }
                
                // 处理语音播报指令
                if (command === 'playAudio') {
                    const now = Date.now();
                    if (window.lastTrigger && now - window.lastTrigger < 300) return;
                    window.lastTrigger = now;
                    setAudioTrigger(prev => prev + 1);
                }
            };

            ipcRenderer.on('mouse-ignore-status', handleMouseStatus);
            ipcRenderer.on('scroll-action', handleScroll);
            ipcRenderer.on('shortcut-triggered', handleCommand);
            
            ipcRenderer.invoke('get-mouse-status').then(setIsMouseLocked);

            return () => {
                ipcRenderer.removeListener('mouse-ignore-status', handleMouseStatus);
                ipcRenderer.removeListener('scroll-action', handleScroll);
                ipcRenderer.removeListener('shortcut-triggered', handleCommand);
            };
        } else {
            setIsMouseLocked(false);
        }
    }, [mouseKey, isAnalyzing, effectiveMode, isElectron, viewMode, setViewMode]); 

    // 🔥 [新增] 网页端快捷键监听 (Web Compatibility)
    useEffect(() => {
        if (!isElectron) {
            const handleWebKeyDown = (e) => {
                // 检测 Ctrl + Space
                if (e.ctrlKey && e.code === 'Space') {
                    e.preventDefault(); // 尝试阻止默认行为 (如切换输入法)
                    
                    // 防抖 (防止按住不放疯狂触发)
                    const now = Date.now();
                    if (window.lastWebTrigger && now - window.lastWebTrigger < 300) return;
                    window.lastWebTrigger = now;

                    setAudioTrigger(prev => prev + 1);
                }
            };
            
            window.addEventListener('keydown', handleWebKeyDown);
            return () => window.removeEventListener('keydown', handleWebKeyDown);
        }
    }, [isElectron]);

    // TeamIcons 智能匹配
    const ROLE_CN = { "TOP": "上", "JUNGLE": "野", "MID": "中", "ADC": "下", "SUPPORT": "辅", "NONE": "?" };
    const normalizeName = (name) => name ? name.toString().toLowerCase().replace(/[\s\.\-\']+/g, "") : ""; 

    const TeamIcons = ({ team, isEnemy }) => {
        const assignments = isEnemy ? enemyLaneAssignments : myLaneAssignments;
        const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
        const hasValidAssignments = assignments && Object.values(assignments).some(v => v);
        
        let displayList = [];
        if (hasValidAssignments) {
            displayList = ROLE_ORDER.map(role => {
                const assignedVal = assignments[role]; 
                let hero = null;
                if (assignedVal && assignedVal !== "None") {
                    const target = normalizeName(assignedVal);
                    hero = team.find(c => {
                        if (!c) return false;
                        if (normalizeName(c.key) === target || normalizeName(c.id) === target) return true;
                        if (normalizeName(c.name) === target) return true;
                        return false;
                    });
                    if (!hero && championList && championList.length > 0) {
                        const dbHero = championList.find(c => 
                            normalizeName(c.name) === target || normalizeName(c.title) === target || (c.alias && c.alias.some(a => normalizeName(a) === target))
                        );
                        if (dbHero) {
                            const dbKey = normalizeName(dbHero.key || dbHero.id);
                            hero = team.find(c => c && normalizeName(c.key || c.id) === dbKey);
                        }
                    }
                }
                return { role, hero };
            });
        } else {
            displayList = team.map((hero, idx) => ({ role: ROLE_ORDER[idx] || "NONE", hero }));
        }

        return (
            <div className={`flex items-center gap-1.5 ${isEnemy ? 'flex-row-reverse' : ''}`}>
                {displayList.map((item, idx) => (
                    <div key={idx} className="relative group">
                        <div className={`absolute -top-1.5 ${isEnemy ? '-left-1' : '-right-1'} z-10 w-3.5 h-3.5 flex items-center justify-center bg-[#091428] border border-white/20 rounded-full shadow-md`}>
                            <span className={`text-[8px] font-black ${isEnemy ? 'text-red-400' : 'text-blue-400'}`}>{ROLE_CN[item.role] || "?"}</span>
                        </div>
                        <div className={`w-6 h-6 rounded-sm overflow-hidden border ${isEnemy ? 'border-red-500/40' : 'border-blue-500/40'} bg-black/60`}>
                            {item.hero ? (
                                <img src={item.hero.image_url} alt={item.hero.name} className="w-full h-full object-cover" title={`${item.hero.name} (${item.role})`}/>
                            ) : (
                                <div className="w-full h-full opacity-20 bg-slate-700 flex items-center justify-center"><span className="text-[8px] text-white/20">-</span></div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const containerClass = isInGame ? `bg-transparent border-transparent` : `bg-[#091428]/95 backdrop-blur-md border-[#C8AA6E]/40 border-2`;
    const textShadowStyle = isInGame ? { textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' } : {};

    return (
        <div className={`h-screen w-screen bg-transparent overflow-hidden relative transition-all duration-300 ${!isMouseLocked ? 'bg-black/20' : ''}`}>
            <Toaster position="top-center" />
            {isElectron && <UserGuide isOpen={showGuide} steps={overlaySteps} onClose={handleGuideComplete} onComplete={handleGuideComplete} />}

            <div className={`absolute flex flex-col pointer-events-auto rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 ${containerClass} ${!isMouseLocked && !isInGame ? 'border-dashed border-amber-500/50 resize overflow-auto' : ''} ${!isMouseLocked && isInGame ? 'border border-amber-500/30 resize overflow-auto' : ''}`} style={{ top: '0px', height: '100%', width: '100%', maxWidth: isMouseLocked ? '100%' : '100%', position: 'relative' }}>
                
                {isElectron && !isMouseLocked && !showGuide && !hideMouseHint && (
                    <div id="mouse-mode-hint" className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-amber-900/90 to-black/90 backdrop-blur-md border border-amber-500/50 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.3)] pointer-events-auto">
                            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-b from-slate-700 to-slate-800 border-b-4 border-slate-900 rounded-[6px] shadow-inner"><span className="text-amber-400 font-mono font-black text-lg leading-none mt-0.5">{mouseKey}</span></div>
                            <div className="flex flex-col"><span className="text-amber-100 font-bold text-sm tracking-wide flex items-center gap-2"><MousePointer2 size={14} className="text-amber-400 fill-current animate-pulse"/>鼠标已解锁</span><span className="text-[10px] text-amber-500/80 font-mono uppercase tracking-wider">按 <span className="text-amber-300 font-bold">{mouseKey}</span> 键锁定并穿透</span></div>
                            
                            <div className="w-[1px] h-6 bg-amber-500/20 mx-1"></div>
                            <button 
                                onClick={() => {
                                    setHideMouseHint(true);
                                    localStorage.setItem('hex_hide_mouse_hint', 'true');
                                    toast("提示已隐藏", { icon: '🙈', duration: 2000, style: { background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155' } });
                                }}
                                className="p-1 rounded-full text-amber-500/50 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                                title="不再提醒"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}

                <div id="overlay-header" className={`h-10 flex items-center justify-between px-3 select-none rounded-t-xl cursor-move drag-region shrink-0 transition-all duration-300 group/header ${isInGame ? 'bg-black/40 border-transparent' : 'bg-[#010A13]/90 border-b border-[#C8AA6E]/30'}`}>
                    <div className="flex items-center gap-3">
                        {!isInGame && (<div className="flex items-center gap-2"><span className="text-[#C8AA6E] font-bold text-xs tracking-widest">HEX LITE</span><div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] transition-colors duration-500 ${lcuStatus === 'connected' ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'}`}></div></div>)}
                        <div id="overlay-module-title" className="flex items-center gap-2 no-drag ml-1"><span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${isInGame ? 'text-white/90 font-black' : 'text-slate-300 bg-white/5 border border-white/5'}`}>{MODULE_NAMES[effectiveMode] || effectiveMode.toUpperCase()}</span></div>
                    </div>
                    <div id="overlay-controls" className={`flex items-center gap-2 no-drag transition-opacity duration-200 ${isInGame ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                        {isElectron && (<div className="hidden sm:flex items-center gap-1 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5 mr-1"><Keyboard size={10}/> <span>{toggleKey}</span></div>)}
                        {isElectron && (<button onClick={handleStartGuide} className="text-slate-500 hover:text-[#0AC8B9] transition-colors p-1 hover:bg-white/5 rounded"><HelpCircle size={14} /></button>)}
                        <button onClick={() => handleAnalyze(effectiveMode, true)} disabled={isAnalyzing} className={`text-slate-500 hover:text-[#0AC8B9] transition-colors ${isAnalyzing ? 'animate-spin opacity-50' : ''}`} title={isElectron ? `重新分析 (${refreshKey})` : "重新分析"}><RotateCcw size={14} /></button>
                        {isElectron && (<button onClick={() => setShowSettingsModal(true)} className="text-slate-500 hover:text-[#C8AA6E] transition-colors p-1 hover:bg-white/5 rounded"><Settings size={14} /></button>)}
                    </div>
                </div>

                <div id="team-status-wrapper">
                    {!isInGame && (<div id="team-status-bar" className="flex flex-col bg-black/40 border-b border-white/5 shrink-0 select-none animate-in slide-in-from-top-2 duration-300"><div className="flex items-center justify-between px-3 py-1.5"><div className="flex items-center gap-2"><span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider scale-90">我方</span><TeamIcons team={blueTeam || Array(5).fill(null)} isEnemy={false} /></div><div className="text-[8px] text-slate-700 font-mono opacity-50">VS</div><div className="flex items-center gap-2"><TeamIcons team={redTeam || Array(5).fill(null)} isEnemy={true} /><span className="text-[9px] text-red-400 font-bold uppercase tracking-wider scale-90">敌方</span></div></div></div>)}
                </div>

                <div id="overlay-content-area" ref={contentRef} style={textShadowStyle} className="flex-1 min-h-0 overflow-y-auto p-2 no-drag relative flex flex-col custom-scrollbar scroll-smooth">
                    {effectiveResult ? (
                        <AnalysisResult 
                            aiResult={effectiveResult} 
                            isAnalyzing={isAnalyzing} 
                            setShowFeedbackModal={setShowFeedbackModal} 
                            setFeedbackContent={setFeedbackContent} 
                            sendChatTrigger={sendChatTrigger} 
                            forceTab={activeTab} 
                            setActiveTab={setActiveTab} 
                            onClear={() => handleClearAnalysis && handleClearAnalysis(effectiveMode)} 
                            viewMode={viewMode} 
                            setViewMode={setViewMode}
                            audioTrigger={audioTrigger}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 p-6 min-h-[180px]">
                            <div className={`p-3 rounded-full ${isInGame ? 'bg-black/30' : 'bg-white/5 border border-white/5'}`}><Activity size={24} className="opacity-40"/></div>
                            {!isInGame && (<div className="text-center space-y-1"><p className="text-xs font-bold text-slate-400">阵容已就绪</p><p className="text-[10px] text-slate-600">请确认上方分路角标是否正确</p></div>)}
                            <button onClick={() => handleAnalyze(effectiveMode, true)} disabled={isAnalyzing} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black tracking-wide shadow-lg transition-all active:scale-95 group ${isAnalyzing ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-gradient-to-r from-[#0AC8B9] to-[#089186] text-[#091428] hover:brightness-110 hover:shadow-[#0AC8B9]/30'}`}><Zap size={14} className={isAnalyzing ? "animate-spin" : "fill-current"} /><span>{isAnalyzing ? "AI 思考中..." : "开始战术分析"}</span></button>
                        </div>
                    )}
                </div>
                
                {!isInGame && isElectron && (
                    <div className="bg-black/80 border-t border-white/5 py-1 px-2.5 text-[9px] text-slate-500 flex justify-between items-center no-drag select-none shrink-0 rounded-b-xl overflow-hidden backdrop-blur-sm">
                        <div className="flex gap-2 items-center w-full overflow-hidden">
                            {/* 🔥 [优化] 紧凑布局 + 智能缩写 + 恢复滚动提示 */}
                            <span className="whitespace-nowrap flex items-center gap-1" title="切换功能模块"><b className="text-slate-400 font-sans">{modeSwitchStr}</b> 切换</span>
                            <span className="w-px h-2 bg-white/10 shrink-0"></span>
                            <span className="whitespace-nowrap flex items-center gap-1" title="切换当前页内容"><b className="text-slate-400 font-sans">{pageSwitchStr}</b> 翻页</span>
                            <span className="w-px h-2 bg-white/10 shrink-0"></span>
                            <span className="whitespace-nowrap flex items-center gap-1" title="上下滚动文字"><b className="text-slate-400 font-sans">{scrollStr}</b> 滚动</span>
                            <span className="w-px h-2 bg-white/10 shrink-0"></span>
                            <span className="whitespace-nowrap flex items-center gap-1" title="切换 简略/详细"><b className="text-slate-400 font-sans">{toggleViewKey}</b> 详情</span>
                            <span className="w-px h-2 bg-white/10 shrink-0"></span>
                            <span className="whitespace-nowrap flex items-center gap-1" title="语音播报当前页"><b className="text-slate-400 font-sans">{playKey}</b> 播报</span>
                        </div>
                        <div className="flex items-center gap-1 ml-auto font-mono opacity-80 shrink-0"><span className="text-amber-500 font-bold">{mouseKey}</span><span>鼠标</span></div>
                    </div>
                )}
            </div>
            <div className="pointer-events-auto"><SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} /></div>
        </div>
    );
};

export default OverlayConsole;