// src/pages/OverlayConsole.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Settings, RotateCcw, Keyboard, Activity, MousePointer2, HelpCircle, 
    Zap, AlertCircle, X, Download, RefreshCw, Info 
} from 'lucide-react';
import { Toaster, toast, useToasterStore } from 'react-hot-toast';

// 组件引入
import AnalysisResult from '../components/AnalysisResult';
import SettingsModal from '../components/modals/SettingsModal';
import UserGuide from '../components/UserGuide';
import GameHudFrame from '../components/GameHudFrame'; 

const OverlayConsole = ({ state, actions }) => {
    // 解构 State
    const { 
        lcuStatus, aiResults, analyzeType, isModeAnalyzing,
        currentShortcuts, showSettingsModal, activeTab,
        blueTeam, redTeam, myTeamRoles, enemyLaneAssignments, myLaneAssignments, 
        championList, 
        gamePhase, // LCU 游戏阶段
        viewMode 
    } = state;

    // 解构 Actions
    const { 
        handleAnalyze, setShowSettingsModal, setFeedbackContent,
        setShowFeedbackModal, sendChatTrigger, setActiveTab, setViewMode, 
        handleClearAnalysis, setAiResults, setAnalyzeType
    } = actions;

    // 本地 State
    const [isMouseLocked, setIsMouseLocked] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    const [audioTrigger, setAudioTrigger] = useState(0);
    const [hideMouseHint, setHideMouseHint] = useState(() => localStorage.getItem('hex_hide_mouse_hint') === 'true');
    
    // 🔥 [修复] 版本号状态，默认空
    const [appVersion, setAppVersion] = useState(""); 
    const guideTriggered = useRef(false);
    // 视觉配置
    const [visualConfig, setVisualConfig] = useState({
        transparency: 5,
        fontSize: 1.0,
        volume: 1.0
    });
    
    // 环境判断
    const isElectron = useMemo(() => typeof window !== 'undefined' && !!window.require, []);
    
    // 🔥 游戏状态判断
    const isInGame = gamePhase === 'InProgress'; 
    
    const contentRef = useRef(null);
    const { toasts } = useToasterStore();

    // 🔥 [修复] 引导防重锁：确保一次运行周期内只尝试触发一次
    const guideAttemptedRef = useRef(false);

    // --- 快捷键格式化辅助函数 ---
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

    const fmtPair = (key1, key2) => {
        const s1 = fmt(key1);
        const s2 = fmt(key2);
        const prefixRegex = /^(.+\+)(.+)$/;
        const m1 = s1.match(prefixRegex);
        const m2 = s2.match(prefixRegex);
        if (m1 && m2 && m1[1] === m2[1]) return `${s1}/${m2[2]}`;
        return `${s1}/${s2}`;
    };

    // 快捷键定义
    const mouseKey = fmt(currentShortcuts?.mouseMode || 'Tilde');
    const refreshKey = fmt(currentShortcuts?.refresh || 'Ctrl+F'); 
    const toggleViewKey = fmt(currentShortcuts?.toggleView || 'Ctrl+E'); 
    const toggleKey = fmt(currentShortcuts?.toggle || 'Home');
    const playKey = fmt(currentShortcuts?.playAudio || 'Ctrl+Space');
    const modeSwitchStr = fmtPair(currentShortcuts?.modePrev || 'Ctrl+Z', currentShortcuts?.modeNext || 'Ctrl+C');
    const pageSwitchStr = fmtPair(currentShortcuts?.prevPage || 'Ctrl+A', currentShortcuts?.nextPage || 'Ctrl+D');
    const scrollStr = fmtPair(currentShortcuts?.scrollUp || 'Ctrl+S', currentShortcuts?.scrollDown || 'Ctrl+X');

    // 指引步骤
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

    // 获取当前分析结果
    const { effectiveResult, effectiveMode } = useMemo(() => {
        return { 
            effectiveResult: aiResults ? aiResults[analyzeType] : null, 
            effectiveMode: analyzeType 
        };
    }, [aiResults, analyzeType]);

    const isAnalyzing = isModeAnalyzing(effectiveMode);

    // --- 🔥 Effect 1: 自动更新与版本号 (修复版) ---
    useEffect(() => {
        if (!isElectron) return;
        const { ipcRenderer } = window.require('electron');

        // 1. 初始化时主动获取版本
        ipcRenderer.invoke('get-app-version').then(ver => {
            console.log("📦 [Frontend] Version init:", ver);
            if(ver) setAppVersion(ver);
        });

        // 2. 监听主进程推送
        const handleVersionPush = (event, ver) => {
            if(ver) setAppVersion(ver);
        };

        const handleUpdateMsg = (event, data) => {
            console.log("📦 [Update]", data);
            
            // 🔥 显示所有状态，不再只显示“发现新版本”
            if (data.type === 'checking') {
                // 可选：静默检查不弹窗，或者只弹一个轻提示
                // toast("正在检查更新...", { id: 'update-status', icon: '🔍' });
            }
            else if (data.type === 'not-available') {
                // 如果是用户手动点检查，需要反馈；如果是自动检查，可以静默
                // 这里为了调试，先显示出来
                // toast("当前已是最新版本", { id: 'update-status', icon: '✅', duration: 2000 });
            }
            else if (data.type === 'error') {
                toast.error(`更新检查失败: ${data.message}`, { id: 'update-status' });
            }
            else if (data.type === 'available') {
                const version = data.info?.version || 'New';
                toast((t) => (
                    <div className="flex flex-col gap-2 min-w-[220px]">
                        <div className="flex items-center gap-2 font-bold text-[#C8AA6E]">
                            <Download size={16} /><span>发现新版 v{version}</span>
                        </div>
                        <p className="text-xs text-slate-400">检测到新功能，是否立即下载？</p>
                        <div className="flex gap-2 mt-2">
                            <button 
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    toast.loading("正在后台下载...", { id: 'downloading-toast' });
                                    ipcRenderer.send('start-download'); 
                                }}
                                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1"
                            >
                                <Download size={12} /> 下载
                            </button>
                            <button onClick={() => toast.dismiss(t.id)} className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-1.5 rounded">忽略</button>
                        </div>
                    </div>
                ), { duration: 15000, position: 'bottom-right', id: 'update-ask', style: { background: '#091428', border: '1px solid #C8AA6E', color: '#fff' } });
            }
            else if (data.type === 'downloaded') {
                toast.dismiss('downloading-toast');
                toast((t) => (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                        <div className="flex items-center gap-2 font-bold text-green-400">
                            <RefreshCw size={16} /><span>下载完成</span>
                        </div>
                        <p className="text-xs text-slate-400">更新已就绪，重启即可生效。</p>
                        <div className="flex gap-2 mt-1">
                            <button 
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    ipcRenderer.send('restart-app'); 
                                }}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1"
                            >
                                立即重启
                            </button>
                            <button onClick={() => toast.dismiss(t.id)} className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-1.5 rounded">稍后</button>
                        </div>
                    </div>
                ), { duration: Infinity, position: 'bottom-right', id: 'update-ready', style: { background: '#091428', border: '1px solid #10b981', color: '#fff' } });
            }
        };

        ipcRenderer.on('update-message', handleUpdateMsg);
        ipcRenderer.on('version-info', handleVersionPush);

        return () => {
            ipcRenderer.removeListener('update-message', handleUpdateMsg);
            ipcRenderer.removeListener('version-info', handleVersionPush);
        };
    }, [isElectron]);


    // --- 🔥 Effect 2: 新手引导逻辑 (防重弹修复) ---
    useEffect(() => {
        if (!isElectron) return; 
        
        // 1. 如果本轮已经尝试过触发，直接退出 (防止 StrictMode 或 鼠标状态抖动导致重复)
        if (guideAttemptedRef.current) return;

        const hasSeenV4 = localStorage.getItem('has_seen_overlay_guide_v4');
        if (hasSeenV4) return; // 看过就不再处理

        // 2. 只有当鼠标处于“交互模式”(未锁定) 时才触发引导
        // 如果是锁定状态，显示 Toast 提示用户解锁
        if (isMouseLocked) {
            toast(`按 ${mouseKey} 键解锁鼠标后，即可自动开始新手指引`, { 
                icon: '💡', 
                duration: 5000, 
                id: 'guide-hint', // 固定 ID 防止重复堆叠
                style: { background: '#0f172a', color: '#cbd5e1', border: '1px solid #C8AA6E' }
            });
        } else {
            // 已解锁 -> 触发引导
            toast.dismiss('guide-hint'); 
            setShowGuide(true);
            
            // 🔒 核心：标记为已触发，防止后续 Effect 再次运行
            guideAttemptedRef.current = true;
        }
        
    }, [isMouseLocked, isElectron]); // 依赖项保留 isMouseLocked，以便用户解锁瞬间触发

    const handleGuideComplete = () => { 
        setShowGuide(false); 
        localStorage.setItem('has_seen_overlay_guide_v4', 'true'); 
        toast.dismiss('guide-hint'); 
    };
    
    const handleStartGuide = () => {
        if (isMouseLocked) toast.error(`请先按 ${mouseKey} 键解锁鼠标穿透！`, { id: 'mouse-lock-error' });
        else { toast.dismiss(); setShowGuide(true); }
    };

    // --- Effect 3: IPC 通信 (核心功能) ---
    useEffect(() => {
        if (isElectron && window.require) {
            const { ipcRenderer } = window.require('electron');
            
            // 鼠标状态同步
            const handleMouseStatus = (e, ignored) => {
                setIsMouseLocked(ignored);
                if (ignored) {
                    toast((t) => (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-800 border border-slate-600 rounded flex items-center justify-center text-white font-mono font-bold shadow-lg">{mouseKey}</div>
                            <div><p className="font-bold text-white">已进入穿透模式</p><p className="text-xs text-slate-400">再次按下可呼出鼠标</p></div>
                        </div>
                    ), { id: 'mouse-lock-tip', duration: 4000, position: 'top-center', style: { background: 'rgba(0, 0, 0, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff' } });
                }
            };

            // 滚动
            const handleScroll = (event, direction) => window.dispatchEvent(new CustomEvent('overlay-scroll', { detail: direction }));
            
            // 命令控制
            const handleCommand = (event, command) => {
                if (command === 'refresh') { if (!isAnalyzing) { toast.loading("正在重新分析...", { duration: 1000, id: 'refresh-toast' }); handleAnalyze(effectiveMode, true); } }
                if (command === 'nav_prev' || command === 'nav_next') window.dispatchEvent(new CustomEvent('overlay-nav', { detail: command }));
                if (command === 'toggle_view') { const nextMode = viewMode === 'simple' ? 'detailed' : 'simple'; setViewMode(nextMode); toast(nextMode === 'simple' ? "简略模式" : "详细模式", { icon: nextMode === 'simple' ? '⚡' : '📝', duration: 800, id: 'view-toast' }); }
                if (command === 'playAudio') { const now = Date.now(); if (window.lastTrigger && now - window.lastTrigger < 300) return; window.lastTrigger = now; setAudioTrigger(prev => prev + 1); }
            };

            // 视觉更新
            const handleVisualUpdate = (event, newVisuals) => {
                if (newVisuals.scale !== undefined && newVisuals.fontSize === undefined) newVisuals.fontSize = newVisuals.scale; 
                setVisualConfig(newVisuals);
                localStorage.setItem('hex_visual_config', JSON.stringify(newVisuals));
            };

            // AI 结果同步
            const handleAiResultSync = (event, data) => {
                if (data) {
                    if (data.results) setAiResults(data.results);
                    if (data.currentMode) setAnalyzeType(data.currentMode);
                }
            };

            // 加载初始视觉配置
            const savedVisuals = localStorage.getItem('hex_visual_config');
            if (savedVisuals) { const parsed = JSON.parse(savedVisuals); if (parsed.transparency !== undefined) setVisualConfig(parsed); }

            // 注册监听器
            ipcRenderer.on('mouse-ignore-status', handleMouseStatus);
            ipcRenderer.on('scroll-action', handleScroll);
            ipcRenderer.on('shortcut-triggered', handleCommand);
            ipcRenderer.on('update-visuals', handleVisualUpdate);
            ipcRenderer.on('ai-result', handleAiResultSync);

            // 获取初始状态
            ipcRenderer.invoke('get-mouse-status').then(setIsMouseLocked);

            return () => {
                ipcRenderer.removeListener('mouse-ignore-status', handleMouseStatus);
                ipcRenderer.removeListener('scroll-action', handleScroll);
                ipcRenderer.removeListener('shortcut-triggered', handleCommand);
                ipcRenderer.removeListener('update-visuals', handleVisualUpdate);
                ipcRenderer.removeListener('ai-result', handleAiResultSync);
            };
        } else { setIsMouseLocked(false); }
    }, [mouseKey, isAnalyzing, effectiveMode, isElectron, viewMode, setViewMode]); 

    // Web 兼容
    useEffect(() => {
        if (!isElectron) {
            const handleWebKeyDown = (e) => {
                if (e.ctrlKey && e.code === 'Space') {
                    e.preventDefault(); 
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

    // 辅助组件：队伍图标
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

    // 样式计算
    const alpha = 1 - (visualConfig.transparency / 100);
    const dynamicBgColor = `rgba(9, 20, 40, ${Math.max(0.1, alpha)})`;
    const dynamicBorder = isInGame ? 'border-transparent' : 'border-[#C8AA6E]/40 border-2';
    const headerClass = isInGame 
        ? 'absolute top-0 left-0 w-full h-8 z-50 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-black/80 backdrop-blur-sm rounded-t-xl border-b border-white/10' 
        : 'h-10 bg-[#010A13]/90 border-b border-[#C8AA6E]/30 relative';
    const wrapperClass = isInGame 
        ? 'absolute inset-0 flex flex-col rounded-none' 
        : 'absolute inset-0 flex flex-col rounded-xl shadow-2xl';
    const textShadowStyle = isInGame ? { textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' } : {};

    // --- 渲染逻辑 1: 游戏内模式 (HUD) ---
    if (isInGame) {
        if (!GameHudFrame) return <div className="text-white bg-red-500 p-4">Error: GameHudFrame Missing</div>;

        return (
            <div className="w-screen h-screen overflow-hidden relative">
                <Toaster position="top-center" toastOptions={{
                    style: { background: '#091428', color: '#fff', border: '1px solid #C8AA6E' }
                }}/>
                <GameHudFrame 
                    aiResults={effectiveResult}
                    effectiveMode={effectiveMode}
                    isAnalyzing={isAnalyzing}
                    viewMode={viewMode}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    isMouseLocked={isMouseLocked}
                    mouseKey={mouseKey}
                    visualConfig={visualConfig}
                />
                <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
            </div>
        );
    }

    // --- 渲染逻辑 2: 客户端模式 (Client Mode) ---
    return (
        <div className={`h-screen w-screen overflow-hidden relative transition-all duration-300 ${!isMouseLocked ? 'bg-black/20' : ''}`}>
            <Toaster position="top-center" toastOptions={{
                style: { background: '#091428', color: '#fff', border: '1px solid #C8AA6E' }
            }}/>
            {isElectron && <UserGuide isOpen={showGuide} steps={overlaySteps} onClose={handleGuideComplete} onComplete={handleGuideComplete} />}

            <div 
                className={`${wrapperClass} pointer-events-auto animate-in slide-in-from-right duration-300 ${dynamicBorder} ${!isMouseLocked && !isInGame ? 'border-dashed border-amber-500/50 resize overflow-auto' : ''}`} 
                style={{ 
                    top: '0px', height: '100%', width: '100%', maxWidth: isMouseLocked ? '100%' : '100%', position: 'relative', backgroundColor: dynamicBgColor, backdropFilter: 'blur(8px)',
                    pointerEvents: isMouseLocked ? 'none' : 'auto' // 🔥 [补丁] 确保前端容器不拦截点击
                }}
            >
                {/* 鼠标锁提示 */}
                {isElectron && !isMouseLocked && !showGuide && !hideMouseHint && (
                    <div id="mouse-mode-hint" className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-amber-900/90 to-black/90 backdrop-blur-md border border-amber-500/50 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.3)] pointer-events-auto">
                            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-b from-slate-700 to-slate-800 border-b-4 border-slate-900 rounded-[6px] shadow-inner"><span className="text-amber-400 font-mono font-black text-lg leading-none mt-0.5">{mouseKey}</span></div>
                            <div className="flex flex-col"><span className="text-amber-100 font-bold text-sm tracking-wide flex items-center gap-2"><MousePointer2 size={14} className="text-amber-400 fill-current animate-pulse"/>鼠标已解锁</span><span className="text-[10px] text-amber-500/80 font-mono uppercase tracking-wider">按 <span className="text-amber-300 font-bold">{mouseKey}</span> 键锁定并穿透</span></div>
                            <div className="w-[1px] h-6 bg-amber-500/20 mx-1"></div>
                            <button onClick={() => { setHideMouseHint(true); localStorage.setItem('hex_hide_mouse_hint', 'true'); toast("提示已隐藏", { icon: '🙈', duration: 2000, style: { background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155' } }); }} className="p-1 rounded-full text-amber-500/50 hover:text-amber-300 hover:bg-amber-500/10 transition-colors" title="不再提醒"><X size={14} /></button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div id="overlay-header" className={`flex items-center justify-between px-3 select-none cursor-move drag-region shrink-0 transition-all duration-300 group/header ${headerClass}`}>
                    <div className="flex items-center gap-3">
                        {!isInGame && (
                            <div className="flex items-center gap-2">
                                <span className="text-[#C8AA6E] font-bold text-xs tracking-widest flex items-center gap-1">
                                    HEX LITE 
                                </span>
                                <div className={`w-1.5 h-1.5 rounded-full ${lcuStatus === 'connected' ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500'} transition-colors duration-500`}></div>
                            </div>
                        )}
                        <div id="overlay-module-title" className="flex items-center gap-2 no-drag ml-1"><span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${isInGame ? 'text-white/90 font-black' : 'text-slate-300 bg-white/5 border border-white/5'}`}>{MODULE_NAMES[effectiveMode] || effectiveMode.toUpperCase()}</span></div>
                    </div>
                    <div id="overlay-controls" className={`flex items-center gap-2 no-drag transition-opacity duration-200 ${isInGame ? 'opacity-100' : 'opacity-100'}`}>
                        {isElectron && (<div className="hidden sm:flex items-center gap-1 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5 mr-1"><Keyboard size={10}/> <span>{toggleKey}</span></div>)}
                        {isElectron && (<button onClick={handleStartGuide} className="text-slate-500 hover:text-[#0AC8B9] transition-colors p-1 hover:bg-white/5 rounded"><HelpCircle size={14} /></button>)}
                        <button onClick={() => handleAnalyze(effectiveMode, true)} disabled={isAnalyzing} className={`text-slate-500 hover:text-[#0AC8B9] transition-colors ${isAnalyzing ? 'animate-spin opacity-50' : ''}`} title={isElectron ? `重新分析 (${refreshKey})` : "重新分析"}><RotateCcw size={14} /></button>
                        {isElectron && (<button onClick={() => setShowSettingsModal(true)} className="text-slate-500 hover:text-[#C8AA6E] transition-colors p-1 hover:bg-white/5 rounded"><Settings size={14} /></button>)}
                    </div>
                </div>

                {/* 队伍状态 (游戏外) */}
                <div id="team-status-wrapper">
                    {!isInGame && (<div id="team-status-bar" className="flex flex-col bg-black/40 border-b border-white/5 shrink-0 select-none animate-in slide-in-from-top-2 duration-300"><div className="flex items-center justify-between px-3 py-1.5"><div className="flex items-center gap-2"><span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider scale-90">我方</span><TeamIcons team={blueTeam || Array(5).fill(null)} isEnemy={false} /></div><div className="text-[8px] text-slate-700 font-mono opacity-50">VS</div><div className="flex items-center gap-2"><TeamIcons team={redTeam || Array(5).fill(null)} isEnemy={true} /><span className="text-[9px] text-red-400 font-bold uppercase tracking-wider scale-90">敌方</span></div></div></div>)}
                </div>

                {/* 内容区域 */}
                <div 
                    id="overlay-content-area" 
                    ref={contentRef} 
                    style={textShadowStyle} 
                    className="flex-1 min-h-0 overflow-hidden p-2 no-drag relative flex flex-col"
                >
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
                            globalVolume={visualConfig.volume}
                            globalScale={visualConfig.fontSize}
                            isInGame={isInGame}
                            isOverlay={true} 
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 p-6 min-h-[180px]">
                            <div className={`p-3 rounded-full ${isInGame ? 'bg-black/30' : 'bg-white/5 border border-white/5'}`}><Activity size={24} className="opacity-40"/></div>
                            {!isInGame && (<div className="text-center space-y-1"><p className="text-xs font-bold text-slate-400">阵容已就绪</p><p className="text-[10px] text-slate-600">请确认上方分路角标是否正确</p></div>)}
                            <button onClick={() => handleAnalyze(effectiveMode, true)} disabled={isAnalyzing} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black tracking-wide shadow-lg transition-all active:scale-95 group ${isAnalyzing ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-gradient-to-r from-[#0AC8B9] to-[#089186] text-[#091428] hover:brightness-110 hover:shadow-[#0AC8B9]/30'}`}><Zap size={14} className={isAnalyzing ? "animate-spin" : "fill-current"} /><span>{isAnalyzing ? "AI 思考中..." : "请在网页端开始分析"}</span></button>
                        </div>
                    )}
                </div>
                
                {/* 底部信息栏 (游戏外) */}
                {!isInGame && isElectron && (
                    <div className="bg-black/80 border-t border-white/5 py-1 px-2.5 text-[9px] text-slate-500 flex justify-between items-center no-drag select-none shrink-0 rounded-b-xl overflow-hidden backdrop-blur-sm">
                        <div className="flex gap-2 items-center w-full overflow-hidden">
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