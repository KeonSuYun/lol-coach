import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
    Settings, RotateCcw, Activity, 
    Zap, Map, Target, Flag, 
    CornerDownRight, PlayCircle, Eye, Scale, 
    Unlock, Move, ChevronRight, ChevronLeft, Volume2, Loader2, Pause, 
    PlayCircle as Play, 
    MousePointer2, Layers, BookOpen, Music,
    Maximize2, Minimize2 
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import SettingsModal from '../components/modals/SettingsModal';
import { API_BASE_URL } from '../config/constants';

// 阶段定义
const PHASES = [
    { id: 'early', label: '前期', color: 'text-emerald-400', bg: 'bg-emerald-500' },
    { id: 'mid', label: '中期', color: 'text-amber-400', bg: 'bg-amber-500' },
    { id: 'late', label: '后期', color: 'text-red-400', bg: 'bg-red-500' }
];

// 卡片类型样式
const CARD_TYPE_STYLES = {
    'CLEAR_ROUTE': { color: 'text-emerald-400', icon: Map },
    'GANK_ROUTE': { color: 'text-red-400', icon: Target },
    'OBJECTIVE': { color: 'text-amber-400', icon: Flag },
    'TEAMFIGHT': { color: 'text-purple-400', icon: Activity },
    'DEFAULT': { color: 'text-blue-400', icon: Zap }
};

// 中文位置映射
const ROLE_CN_MAP = {
    'TOP': '上', 'JUNGLE': '野', 'MID': '中', 'ADC': '下', 'SUPPORT': '辅'
};
const ROLE_ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

// 快捷键解析辅助函数
const parseShortcut = (keyStr) => {
    if (!keyStr) return ['?'];
    let parts = keyStr.split('+').map(p => p.trim());
    return parts.map(p => {
        const up = p.toUpperCase();
        if (up.includes('CONTROL') || up === 'CTRL') return 'Ctrl';
        if (up.includes('COMMAND') || up === 'CMD') return 'Cmd';
        if (up.includes('SHIFT')) return 'Shift';
        if (up.includes('ALT')) return 'Alt';
        if (up.includes('TILDE') || up.includes('BACKQUOTE')) return '~'; 
        if (up.includes('SPACE')) return 'Space';
        return up; 
    });
};

const formatKey = (keyStr) => {
    if (!keyStr) return '??';
    if (keyStr.toUpperCase().includes('TILDE')) return '~';
    if (keyStr.toUpperCase().includes('SPACE')) return 'Space';
    return keyStr.replace('Control', 'Ctrl').replace('Command', 'Cmd').toUpperCase();
};

// 按键组件
const Kbd = ({ children, className = "" }) => (
    <span className={`
        inline-flex items-center justify-center 
        min-w-[20px] h-[18px] px-1.5 
        rounded-[4px] 
        bg-[#1e293b] 
        border-b-[2px] border-r-[1px] border-slate-700 border-t-[1px] border-l-[1px] border-slate-600
        text-[10px] font-bold font-mono text-slate-200
        shadow-sm
        select-none
        mx-[1px]
        ${className}
    `}>
        {children}
    </span>
);

// 组合键展示组件
const ShortcutDisplay = ({ shortcut, className }) => {
    const keys = parseShortcut(shortcut);
    return (
        <div className={`flex items-center ${className}`}>
            {keys.map((k, i) => (
                <React.Fragment key={i}>
                    <Kbd>{k}</Kbd>
                    {i < keys.length - 1 && <span className="text-[9px] text-slate-500 mx-[1px]">+</span>}
                </React.Fragment>
            ))}
        </div>
    );
};

// 合并前缀显示组件
const MergedShortcuts = ({ s1, s2 }) => {
    const p1 = parseShortcut(s1); 
    const p2 = parseShortcut(s2); 
    
    if (p1.length > 1 && p2.length > 1 && p1[0] === p2[0]) {
        return (
            <div className="flex items-center bg-[#0f172a] rounded px-1 py-0.5 border border-white/10">
                <span className="text-[9px] font-bold text-slate-400 mr-1">{p1[0]}</span>
                <div className="flex gap-1">
                    <Kbd className="h-4 min-w-[16px] px-1 text-[9px] border-slate-600 bg-slate-800">{p1[1]}</Kbd>
                    <span className="text-slate-600 text-[9px] self-center">/</span>
                    <Kbd className="h-4 min-w-[16px] px-1 text-[9px] border-slate-600 bg-slate-800">{p2[1]}</Kbd>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex items-center gap-1">
            <div className="flex gap-0.5"><Kbd className="h-4 text-[9px]">{p1[0]}</Kbd><span className="text-[8px] text-slate-500">+</span><Kbd className="h-4 text-[9px]">{p1[1]}</Kbd></div>
            <span className="text-slate-600 text-[9px]">/</span>
            <div className="flex gap-0.5"><Kbd className="h-4 text-[9px]">{p2[0]}</Kbd><span className="text-[8px] text-slate-500">+</span><Kbd className="h-4 text-[9px]">{p2[1]}</Kbd></div>
        </div>
    );
};

const OverlayConsole = ({ state, actions }) => {
    // 解构 State
    const { 
        lcuStatus, aiResults, analyzeType, isModeAnalyzing,
        showSettingsModal, currentShortcuts, 
        blueTeam, redTeam, myLaneAssignments, enemyLaneAssignments,
        gamePhase 
    } = state;

    // 解构 Actions
    const { 
        handleAnalyze, setShowSettingsModal, setAiResults
    } = actions;

    // 本地 State
    const [isMouseLocked, setIsMouseLocked] = useState(true);
    const [phaseIndex, setPhaseIndex] = useState(0); 
    const [cardIndex, setCardIndex] = useState(0);
    
    // 🎙️ 语音状态
    const audioRef = useRef(new Audio());
    const [isFetchingAudio, setIsFetchingAudio] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const shouldAutoPlayRef = useRef(false);
    
    const [hasFinishedPlaying, setHasFinishedPlaying] = useState(false);

    // 视觉配置
    const [visualConfig, setVisualConfig] = useState({ 
        transparency: 5, // 0-100，越高越透明
        fontSize: 1.0,
        volume: 1.0 
    });
    
    const isElectron = typeof window !== 'undefined' && !!window.require;
    const isInGame = gamePhase === 'InProgress';
    const listRef = useRef(null);

    // --- 1. 数据解析 ---
    const allStrategies = useMemo(() => {
        const rawResult = aiResults ? aiResults[analyzeType] : null;
        if (!rawResult) return null;

        let dashboard = null;
        try {
            if (typeof rawResult === 'object') dashboard = rawResult.dashboard;
            else if (typeof rawResult === 'string') {
                const clean = rawResult.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
                const jsonStart = clean.indexOf('{');
                const jsonEnd = clean.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    dashboard = JSON.parse(clean.substring(jsonStart, jsonEnd + 1)).dashboard;
                }
            }
        } catch (e) {}

        if (!dashboard) return null;

        return {
            early: dashboard.strategies?.early || dashboard.action_cards || [],
            mid: dashboard.strategies?.mid || [],
            late: dashboard.strategies?.late || []
        };
    }, [aiResults, analyzeType]);

    const activeCards = useMemo(() => {
        if (!allStrategies) return [];
        const phaseKey = PHASES[phaseIndex].id;
        return allStrategies[phaseKey] || [];
    }, [allStrategies, phaseIndex]);

    const currentCard = activeCards[cardIndex];

    // --- 2. 语音控制逻辑 ---
    useEffect(() => {
        const audio = audioRef.current;
        const handleEnded = () => {
            if (isInGame && cardIndex < activeCards.length - 1) {
                shouldAutoPlayRef.current = true;
                setCardIndex(prev => prev + 1);
            } else {
                setIsPlaying(false);
                setIsPaused(false);
                shouldAutoPlayRef.current = false;
                setHasFinishedPlaying(true);

                if (isInGame && cardIndex === activeCards.length - 1) {
                    setCardIndex(0); 
                    toast("本阶段播报完毕", { icon: '✅', style: { background: '#091428', color: '#fff', border: '1px solid #10b981' } });
                }
            }
        };
        const handleError = () => {
            setIsPlaying(false);
            setIsPaused(false);
            setIsFetchingAudio(false);
            shouldAutoPlayRef.current = false;
            toast.error("播报出错");
        };

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.pause();
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
        };
    }, [cardIndex, activeCards, isInGame]);

    useEffect(() => {
        if (shouldAutoPlayRef.current && isInGame) {
            playCurrentCard(); 
        } else {
            if (isPlaying && !isFetchingAudio) {
                stopAudio();
            }
        }
        
        if (!isInGame && listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [cardIndex, phaseIndex]);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setIsPaused(false);
        setIsFetchingAudio(false);
        shouldAutoPlayRef.current = false;
    };

    const playCurrentCard = async () => {
        if (!currentCard) return;
        if (isFetchingAudio) return;

        setHasFinishedPlaying(false);
        setIsFetchingAudio(true);
        const textToRead = `${currentCard.title}。${Array.isArray(currentCard.do) ? currentCard.do.join('，') : currentCard.do}`;
        const voiceId = localStorage.getItem('hex_tts_voice') || 'guide';

        try {
            const res = await axios.post(`${API_BASE_URL}/api/tts`, {
                text: textToRead,
                voice_id: voiceId
            }, { responseType: 'blob' });

            const audioUrl = URL.createObjectURL(res.data);
            audioRef.current.src = audioUrl;
            audioRef.current.volume = visualConfig.volume || 1.0;
            
            await audioRef.current.play();
            setIsPlaying(true);
            setIsPaused(false);
            
            if (!shouldAutoPlayRef.current) {
                toast(`正在播报`, { icon: '🔊', duration: 1500 });
            }
        } catch (e) {
            console.error(e);
            toast.error("语音服务繁忙");
            shouldAutoPlayRef.current = false;
        } finally {
            setIsFetchingAudio(false);
        }
    };

    const toggleAudioPlayback = () => {
        if (!currentCard) return;

        if (isPlaying && !isPaused) {
            audioRef.current.pause();
            setIsPaused(true);
            shouldAutoPlayRef.current = false;
            toast("已暂停", { icon: '⏸️', duration: 1000 });
            return;
        }

        if (isPaused && audioRef.current.src) {
            audioRef.current.play();
            setIsPaused(false);
            setIsPlaying(true);
            shouldAutoPlayRef.current = isInGame;
            toast("继续播报", { icon: '▶️', duration: 1000 });
            return;
        }

        if (hasFinishedPlaying) {
            if (cardIndex < activeCards.length - 1) {
                setCardIndex(prev => prev + 1);
                shouldAutoPlayRef.current = true;
                return;
            } else {
                toast("重播本条", { icon: 'Hz', duration: 1000 });
                playCurrentCard();
                return;
            }
        }

        shouldAutoPlayRef.current = isInGame;
        playCurrentCard();
    };

    const manualNavigate = (action) => {
        shouldAutoPlayRef.current = false;
        action();
    };

    const handleCommand = (event, command) => {
        if (command === 'mode_prev') {
            manualNavigate(() => {
                setPhaseIndex(p => {
                    const next = Math.max(0, p - 1);
                    if (next !== p) {
                        toast(PHASES[next].label, { icon: '⏱️', id: 'phase-toast' });
                        setCardIndex(0); 
                        if (listRef.current) listRef.current.scrollTop = 0;
                    }
                    return next;
                });
            });
        }
        if (command === 'mode_next') {
            manualNavigate(() => {
                setPhaseIndex(p => {
                    const next = Math.min(PHASES.length - 1, p + 1);
                    if (next !== p) {
                        toast(PHASES[next].label, { icon: '⏱️', id: 'phase-toast' });
                        setCardIndex(0);
                        if (listRef.current) listRef.current.scrollTop = 0;
                    }
                    return next;
                });
            });
        }

        if (command === 'nav_prev') {
            manualNavigate(() => setCardIndex(p => Math.max(0, p - 1)));
        }
        if (command === 'nav_next') {
            manualNavigate(() => setCardIndex(p => Math.min(activeCards.length - 1, p + 1)));
        }

        if (command === 'playAudio') {
            toggleAudioPlayback();
        }

        if (command === 'refresh' && !isModeAnalyzing(analyzeType)) {
            toast.loading("正在重新分析...", { duration: 1000 });
            handleAnalyze(analyzeType, true);
        }
    };

    useEffect(() => {
        if (isElectron) {
            const { ipcRenderer } = window.require('electron');
            
            const handleMouseStatus = (e, ignored) => {
                setIsMouseLocked(ignored);
                toast.dismiss('mouse-lock-toast'); 
                if (!ignored) {
                    const isSuppressed = localStorage.getItem('hex_suppress_unlock_toast');
                    if (!isSuppressed) {
                        toast((t) => (
                            <div 
                                onClick={() => {
                                    localStorage.setItem('hex_suppress_unlock_toast', 'true');
                                    toast.dismiss(t.id);
                                }} 
                                className="flex items-center gap-3 cursor-pointer select-none group"
                                title="点击关闭，且以后不再显示此提示"
                            >
                                <div className="p-1.5 bg-amber-500/20 rounded-full text-amber-400 group-hover:bg-amber-500 group-hover:text-[#091428] transition-colors">
                                    <Unlock size={14} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-xs text-slate-200">操作模式已激活</span>
                                    <span className="text-[9px] text-slate-500 group-hover:text-amber-400 transition-colors">点击关闭 (不再提示)</span>
                                </div>
                            </div>
                        ), { 
                            id: 'mouse-lock-toast',
                            duration: 5000,
                            position: 'top-center',
                            style: { background: '#091428', border: '1px solid rgba(200, 170, 110, 0.3)', padding: '6px 10px', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }
                        });
                    }
                }
            };
            
            const handleVisualUpdate = (e, cfg) => {
                if (cfg.scale !== undefined && cfg.fontSize === undefined) cfg.fontSize = cfg.scale;
                setVisualConfig(cfg);
            };

            const handleAiSync = (e, data) => { if (data?.results) setAiResults(data.results); };

            ipcRenderer.on('mouse-ignore-status', handleMouseStatus);
            ipcRenderer.on('shortcut-triggered', handleCommand);
            ipcRenderer.on('update-visuals', handleVisualUpdate);
            ipcRenderer.on('ai-result', handleAiSync);
            
            ipcRenderer.invoke('get-mouse-status').then(setIsMouseLocked);
            
            const savedVisuals = localStorage.getItem('hex_visual_config');
            if (savedVisuals) {
                try { setVisualConfig(JSON.parse(savedVisuals)); } catch(e){}
            }

            return () => {
                ipcRenderer.removeAllListeners('shortcut-triggered');
                ipcRenderer.removeListener('mouse-ignore-status', handleMouseStatus);
                ipcRenderer.removeListener('update-visuals', handleVisualUpdate);
                ipcRenderer.removeListener('ai-result', handleAiSync);
            };
        }
    }, [activeCards, phaseIndex, isInGame, currentCard, isPlaying, isPaused, isFetchingAudio, hasFinishedPlaying]);

    // 🔥🔥🔥 [样式计算] 透明度修复 🔥🔥🔥
    // transparency 0-100 -> alpha 1.0-0.0
    const alpha = 1 - (visualConfig.transparency / 100);
    
    // 游戏外：深色底色，带点蓝，透明度由设置决定
    const clientBg = `rgba(5, 8, 16, ${Math.max(0.1, alpha)})`;
    
    // 游戏内：主窗口完全透明（只留标题栏），内容卡片使用带透明度的黑色背景
    const gameWindowBg = `rgba(0,0,0,0)`; 
    const gameCardBg = `rgba(15, 23, 42, ${Math.max(0.2, alpha)})`; // Slate-900 with alpha

    const currentPhaseTheme = PHASES[phaseIndex];
    const keyMouse = formatKey(currentShortcuts?.mouseMode || '~');

    return (
        <div className="h-screen w-screen overflow-hidden relative transition-all duration-300">
            <Toaster position="top-center" toastOptions={{
                style: { background: '#091428', color: '#fff', border: '1px solid #C8AA6E' }
            }}/>

            <div 
                className={`
                    absolute inset-0 flex flex-col rounded-xl shadow-2xl transition-all duration-300
                    ${!isMouseLocked 
                        ? 'border-2 border-amber-500 bg-black/90'  // 交互模式：显示高亮边框和深色背景
                        : (isInGame ? 'border-none' : 'border border-white/10') // 游戏内沉浸模式无边框
                    }
                `}
                style={{ 
                    // 🔥 游戏内窗口背景透明，只靠卡片显示背景
                    backgroundColor: !isMouseLocked ? 'rgba(0,0,0,0.9)' : (isInGame ? gameWindowBg : clientBg), 
                    backdropFilter: (!isInGame || !isMouseLocked) ? 'blur(12px)' : 'none', 
                    pointerEvents: isMouseLocked ? 'none' : 'auto' 
                }}
            >
                {/* =================================================================
                   1. Header (标题栏) - 游戏内/外 共用结构
                   ================================================================= */}
                <div 
                    className={`
                        h-8 flex items-center justify-between px-3 shrink-0 select-none transition-opacity duration-300
                        ${isMouseLocked 
                            ? (isInGame ? 'bg-transparent border-b-0' : 'bg-[#020408]/90 border-b border-white/5 drag-region') 
                            : 'bg-amber-900/30 border-b border-white/5 drag-region'
                        }
                        ${isInGame && isMouseLocked ? 'opacity-90 hover:opacity-100' : 'opacity-100'} 
                    `}
                >
                    {/* 左侧：阶段显示 */}
                    <div className="flex items-center gap-2">
                        {/* 游戏外显示 Logo 状态灯，游戏内隐藏 */}
                        {!isInGame && (
                            <div className={`w-1.5 h-1.5 rounded-full ${lcuStatus === 'connected' ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-red-500'}`}></div>
                        )}
                        {!isInGame && <span className="text-[10px] font-black text-[#C8AA6E] tracking-widest uppercase font-mono">HEX</span>}
                        
                        {/* 🌟 核心：前中后期切换器 (游戏内始终显示) */}
                        <div className={`flex gap-1 items-center ${isInGame ? '' : 'ml-3'} no-drag`}>
                            {PHASES.map((p, idx) => (
                                <button 
                                    key={p.id}
                                    // 游戏内：按钮更紧凑，背景更实
                                    className={`
                                        w-2 h-2 rounded-full transition-all duration-300 hover:scale-125
                                        ${idx === phaseIndex ? p.bg : (isInGame ? 'bg-black/60 border border-white/20' : 'bg-white/20')}
                                        ${isInGame ? 'shadow-sm' : ''}
                                    `}
                                    onClick={() => manualNavigate(() => { setPhaseIndex(idx); setCardIndex(0); if(listRef.current) listRef.current.scrollTop=0; })}
                                    title={`切换到 ${p.label}`}
                                />
                            ))}
                            {/* 游戏内：阶段文字加阴影防看不清 */}
                            <span className={`text-[10px] font-bold ml-1 ${currentPhaseTheme.color} ${isInGame ? 'drop-shadow-md' : ''}`}>
                                {currentPhaseTheme.label}
                            </span>
                        </div>
                    </div>

                    {/* 右侧：工具栏 */}
                    <div className={`flex items-center gap-2 no-drag text-slate-500 ${isInGame && isMouseLocked ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
                        
                        {/* 仅交互模式显示 */}
                        {!isMouseLocked && (
                            <div className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/50 animate-pulse">
                                <Unlock size={10}/> 编辑中
                            </div>
                        )}
                        
                        {/* 分析 Loading 状态 */}
                        {isModeAnalyzing(analyzeType) && <RotateCcw size={12} className="animate-spin text-amber-500"/>}
                        
                        {/* 🌟 核心：设置按钮 (游戏内鼠标解锁时显示，或者一直显示？用户说要有设置按钮) */}
                        {/* 逻辑：游戏内只有 !isMouseLocked (交互态) 或者鼠标悬停在标题栏区域时，才比较容易点到 */}
                        {isElectron && (
                            <button 
                                onClick={() => setShowSettingsModal(true)} 
                                className={`
                                    hover:text-white p-1 rounded transition-colors
                                    ${isInGame ? 'bg-black/40 hover:bg-black/60 text-slate-400' : 'hover:bg-white/10'}
                                `}
                                title="设置 (透明度/字体/快捷键)"
                            >
                                <Settings size={12}/>
                            </button>
                        )}
                    </div>
                </div>

                {/* =================================================================
                   2. TeamStrip (分路信息) - 🎮 游戏内隐藏
                   ================================================================= */}
                {!isInGame && (
                    <div className="bg-[#050810]/80 border-b border-white/5 py-1.5 px-2 flex items-center justify-between shrink-0 no-drag select-none">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-blue-400">我方</span>
                            <TeamStrip team={blueTeam} assignments={myLaneAssignments} isRed={false} />
                        </div>
                        <span className="text-[8px] text-slate-600 font-mono">VS</span>
                        <div className="flex items-center gap-2">
                            <TeamStrip team={redTeam} assignments={enemyLaneAssignments} isRed={true} />
                            <span className="text-[9px] font-bold text-red-400">敌方</span>
                        </div>
                    </div>
                )}

                {/* =================================================================
                   3. Content (核心内容区)
                   ================================================================= */}
                <div 
                    className="flex-1 overflow-hidden relative flex flex-col items-center justify-center p-0"
                    style={{ zoom: visualConfig.fontSize }}
                >
                    {isModeAnalyzing(analyzeType) ? (
                        <div className="flex flex-col items-center gap-2 opacity-80">
                            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs font-bold text-amber-500">AI 思考中...</span>
                        </div>
                    ) : (
                        <>
                            {/* 🎮 游戏内视图：单张巨大化卡片 */}
                            {isInGame && (
                                <div className="w-full h-full flex items-center justify-center p-1">
                                    {currentCard ? (
                                        <div className="w-full h-full max-h-full overflow-y-auto custom-scrollbar">
                                            {/* 🔥 传入动态背景色 */}
                                            <TacticalCard card={currentCard} isGameMode={true} customBg={gameCardBg} />
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-500 bg-black/40 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
                                            等待战术指令...
                                        </div>
                                    )}
                                    
                                    {/* 游戏内页码指示器 (浮动在右下角) */}
                                    {activeCards.length > 1 && (
                                        <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-500 bg-black/60 px-1.5 rounded pointer-events-none">
                                            {cardIndex + 1} / {activeCards.length}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 🖥️ 游戏外视图：列表模式 (保持原样) */}
                            {!isInGame && activeCards.length > 0 && (
                                <div className="w-full h-full relative flex flex-col">
                                    <button 
                                        onClick={() => manualNavigate(() => { setPhaseIndex(p => Math.max(0, p - 1)); setCardIndex(0); if(listRef.current) listRef.current.scrollTop=0; })}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1.5 text-slate-500 hover:text-white bg-black/10 hover:bg-black/50 rounded-r-lg transition-all h-20 flex items-center justify-center disabled:opacity-0"
                                        disabled={phaseIndex === 0}
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button 
                                        onClick={() => manualNavigate(() => { setPhaseIndex(p => Math.min(PHASES.length - 1, p + 1)); setCardIndex(0); if(listRef.current) listRef.current.scrollTop=0; })}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-1.5 text-slate-500 hover:text-white bg-black/10 hover:bg-black/50 rounded-l-lg transition-all h-20 flex items-center justify-center disabled:opacity-0"
                                        disabled={phaseIndex === PHASES.length - 1}
                                    >
                                        <ChevronRight size={24} />
                                    </button>

                                    <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 no-scrollbar" style={{ scrollBehavior: 'smooth' }}>
                                        {activeCards.map((card, idx) => (
                                            <div key={idx} className="flex flex-col items-center w-full animate-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                                <div className={`w-full max-w-[380px] transition-all duration-300 ${cardIndex === idx && isPlaying && !isInGame ? 'scale-[1.02] ring-1 ring-emerald-500/50 rounded-lg shadow-lg shadow-emerald-900/20' : ''}`}>
                                                    <div className="flex items-center gap-2 mb-1 pl-1">
                                                        <span className={`text-[9px] font-black px-1.5 rounded ${currentPhaseTheme.bg} bg-opacity-20 ${currentPhaseTheme.color} border border-current border-opacity-30`}>{idx + 1}</span>
                                                        <span className="h-[1px] flex-1 bg-white/5"></span>
                                                        {cardIndex === idx && isPlaying && !isInGame && (
                                                            <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                                                                <Volume2 size={10}/> 正在播报
                                                            </span>
                                                        )}
                                                    </div>
                                                    <TacticalCard card={card} />
                                                </div>
                                            </div>
                                        ))}
                                        <div className="h-4"></div>
                                    </div>
                                </div>
                            )}
                            
                            {!isInGame && activeCards.length === 0 && (
                                <div className="text-xs text-slate-500 p-4 text-center">
                                    {allStrategies ? "该阶段暂无数据" : "等待战术生成..."}
                                </div>
                            )}
                        </>
                    )}

                    {/* 鼠标穿透时的背景提示图 (仅在游戏外显示) */}
                    {!isMouseLocked && !isInGame && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                            <div className="text-amber-500/10 transform -rotate-12">
                                <Move size={100} />
                            </div>
                        </div>
                    )}
                </div>

                {/* =================================================================
                    4. Footer (底部快捷键) - 🎮 游戏内隐藏
                    ================================================================= */}
                    {!isInGame && (
                        <div className="h-8 bg-[#020408]/95 border-t border-white/10 flex items-center justify-between px-3 text-[10px] text-slate-500 font-sans select-none shrink-0">
                            <div className="flex gap-3 items-center">
                                <div className="flex items-center gap-1.5" title="切换前中后期">
                                    <MergedShortcuts s1={currentShortcuts?.modePrev || 'Ctrl+Z'} s2={currentShortcuts?.modeNext || 'Ctrl+C'} />
                                    <span className="opacity-70 text-[9px]">阶段</span>
                                </div>
                                
                                {/* 🔥 修改点 1：将“选中”改为“翻页” */}
                                {activeCards.length > 0 && (
                                    <div className="flex items-center gap-1.5" title="切换/选中卡片">
                                        <MergedShortcuts s1={currentShortcuts?.prevPage || 'Ctrl+A'} s2={currentShortcuts?.nextPage || 'Ctrl+D'} />
                                        <span className="opacity-70 text-[9px]">翻页</span>
                                    </div>
                                )}
                                
                                {/* 🔥 修改点 2：在语音按钮中添加 <ShortcutDisplay /> */}
                                <div className="flex items-center gap-1 ml-1 cursor-pointer hover:text-white transition-colors border-l border-white/10 pl-3 h-4" onClick={toggleAudioPlayback} title="语音播报">
                                    <ShortcutDisplay shortcut={currentShortcuts?.playAudio || 'Ctrl+Space'} className="mr-1"/>
                                    
                                    {isFetchingAudio ? <Loader2 size={12} className="animate-spin text-amber-500"/> : 
                                    isPlaying && !isPaused ? <Volume2 size={12} className="text-emerald-400 animate-pulse"/> : 
                                    <Play size={12} className="text-[#C8AA6E]"/>}
                                    <span className={`font-bold ${isPlaying ? 'text-emerald-400' : 'text-[#C8AA6E]'}`}>{isPlaying ? '播报中' : '语音'}</span>
                                </div>
                            </div>
                            
                            <div className="flex gap-3 items-center">
                                <div className={`flex items-center transition-colors cursor-pointer ${isMouseLocked ? "text-slate-500" : "text-amber-500 font-bold"}`} title={`切换鼠标穿透 (${keyMouse})`}>
                                    <ShortcutDisplay shortcut={currentShortcuts?.mouseMode || '~'} className={`mr-1 ${!isMouseLocked ? 'brightness-125' : ''}`} />
                                    <span>{isMouseLocked ? "鼠标锁" : "解锁中"}</span>
                                </div>
                            </div>
                        </div>
                    )}
            </div>

            <div className="pointer-events-auto"><SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} /></div>
        </div>
    );
};

// 🔥🔥🔥 TacticalCard 修改：支持自定义背景色 🔥🔥🔥
const TacticalCard = ({ card, isGameMode = false, customBg }) => {
    const typeKey = Object.keys(CARD_TYPE_STYLES).find(k => card.type && card.type.toUpperCase().includes(k)) || 'DEFAULT';
    const { color, icon: Icon } = CARD_TYPE_STYLES[typeKey];

    // 如果传入了 customBg，则使用 style 覆盖；否则使用默认 Tailwind 类
    const bgStyle = customBg ? { backgroundColor: customBg } : {};
    // 游戏外默认背景，游戏内使用 customBg
    const bgClass = isGameMode ? '' : 'bg-[#0f172a]';

    return (
        <div 
            className={`
                w-full border border-slate-700/80 rounded shadow-2xl overflow-hidden relative group
                ${bgClass} ${isGameMode ? 'border-slate-600' : ''} 
            `}
            style={bgStyle}
        >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${color.replace('text-', 'bg-')}`}></div>
            <div className={`relative z-10 ${isGameMode ? 'p-2 pl-3' : 'p-3 pl-5'}`}>
                <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} className={color} />
                    <h3 className="text-xs font-black text-slate-100 uppercase tracking-wide leading-tight">{card.title}</h3>
                </div>
                <div className={`space-y-2 ${isGameMode ? 'text-xs' : ''}`}>
                    {card.trigger && (
                        <div className="flex gap-2 text-[10px]">
                            <div className="flex items-center gap-1 min-w-[30px] text-blue-400 font-bold shrink-0"><Scale size={10}/><span>IF:</span></div>
                            <div className="text-slate-300 font-medium">{card.trigger}</div>
                        </div>
                    )}
                    {card.do && (
                        <div className="flex gap-2 text-xs">
                            <div className="flex items-center gap-1 min-w-[30px] text-emerald-400 font-black shrink-0"><PlayCircle size={12}/><span>DO:</span></div>
                            <div className="text-white font-bold leading-snug shadow-black drop-shadow-md">
                                {Array.isArray(card.do) ? <ul className="list-disc pl-3 space-y-0.5">{card.do.map((s,i)=><li key={i}>{s}</li>)}</ul> : card.do}
                            </div>
                        </div>
                    )}
                    {card.watch && (
                        <div className="flex gap-2 text-[10px] border-t border-white/5 pt-1.5 mt-0.5">
                            <div className="flex items-center gap-1 min-w-[30px] text-amber-400 font-bold shrink-0"><Eye size={10}/><span>WATCH:</span></div>
                            <div className="text-slate-400">{card.watch}</div>
                        </div>
                    )}
                    {/* 游戏内隐藏 Else 分支，保持简洁，或者可以保留视情况而定 */}
                    {card.fallback && (
                        <div className="flex gap-2 text-[9px] text-slate-500 italic pl-1"><CornerDownRight size={8} className="shrink-0 mt-0.5"/><span>Else: {card.fallback}</span></div>
                    )}
                </div>
            </div>
            {/* 游戏内图标淡化更多，防遮挡 */}
            <div className={`absolute top-0 right-0 p-6 pointer-events-none ${isGameMode ? 'opacity-[0.03]' : 'opacity-5'}`}><Icon size={80} /></div>
        </div>
    );
};

const TeamStrip = ({ team, assignments, isRed }) => {
    const safeTeam = Array.isArray(team) ? team : Array(5).fill(null);
    const safeAssignments = assignments || {};

    const orderedHeroes = ROLE_ORDER.map(role => {
        const heroName = safeAssignments[role];
        let hero = safeTeam.find(c => c && c.name === heroName);
        return { role, hero };
    });

    return (
        <div className="flex items-center gap-1.5">
            {orderedHeroes.map(({ role, hero }, idx) => (
                <div key={role} className="relative w-9 h-9 rounded overflow-hidden border border-white/10 bg-black">
                    {hero ? (
                        <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover opacity-80" />
                    ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[8px] text-slate-500">?</div>
                    )}
                    <div className={`absolute top-0 right-0 w-3.5 h-3.5 flex items-center justify-center rounded-bl bg-[#020408]/80 backdrop-blur-sm border-l border-b border-white/10`}>
                        <span className={`text-[8px] font-bold ${isRed ? 'text-red-400' : 'text-blue-400'} scale-90`}>
                            {ROLE_CN_MAP[role]}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default OverlayConsole;