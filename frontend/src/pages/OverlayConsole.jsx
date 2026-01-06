import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, RotateCcw, Keyboard, Activity, MousePointer2, HelpCircle, Zap, AlertCircle, Bug } from 'lucide-react';
import AnalysisResult from '../components/AnalysisResult';
import SettingsModal from '../components/modals/SettingsModal';
import UserGuide from '../components/UserGuide';
import { Toaster, toast, useToasterStore } from 'react-hot-toast';

const OverlayConsole = ({ state, actions }) => {
    const { 
        lcuStatus, aiResults, analyzeType, isModeAnalyzing,
        currentShortcuts, showSettingsModal, activeTab,
        blueTeam, redTeam, myTeamRoles, enemyLaneAssignments, myLaneAssignments, 
        championList, // 🔥 必须确保解构出 championList
        gamePhase 
    } = state;

    const { 
        handleAnalyze, setShowSettingsModal, setFeedbackContent,
        setShowFeedbackModal, sendChatTrigger, setActiveTab,
        handleClearAnalysis 
    } = actions;

    const [isMouseLocked, setIsMouseLocked] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    
    // 🔍 [调试状态] 记录匹配失败的英雄，显示在屏幕上
    const [debugInfo, setDebugInfo] = useState("");

    const isInGame = gamePhase === 'InProgress';
    const contentRef = useRef(null);
    const { toasts } = useToasterStore();

    // ... (快捷键 fmt 函数保持不变) ...
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
    const refreshKey = fmt(currentShortcuts?.refresh || 'F'); 
    const scrollUpKey = fmt(currentShortcuts?.scrollUp || 'S'); 
    const scrollDownKey = fmt(currentShortcuts?.scrollDown || 'X'); 
    const toggleKey = fmt(currentShortcuts?.toggle || 'Home');
    const modePrevKey = fmt(currentShortcuts?.modePrev || 'Z'); 
    const modeNextKey = fmt(currentShortcuts?.modeNext || 'C'); 
    const prevPageKey = fmt(currentShortcuts?.prevPage || 'A'); 
    const nextPageKey = fmt(currentShortcuts?.nextPage || 'D'); 

    const overlaySteps = useMemo(() => [
        // ... (保持不变) ...
        { target: '#overlay-header', title: "HexLite 迷你模式", description: `按住标题栏可拖动。使用 ${toggleKey} 键隐藏窗口。` }
    ], [toggleKey]);

    const MODULE_NAMES = { bp: 'BP 推荐', personal: '王者私教', team: '团队策略', role_jungle_farming: '王者私教 (野核)' };

    const { effectiveResult, effectiveMode } = useMemo(() => {
        if (analyzeType === 'personal' && aiResults && aiResults['role_jungle_farming']) {
            return { effectiveResult: aiResults['role_jungle_farming'], effectiveMode: 'role_jungle_farming' };
        }
        if (aiResults && aiResults[analyzeType]) {
            return { effectiveResult: aiResults[analyzeType], effectiveMode: analyzeType };
        }
        return { effectiveResult: null, effectiveMode: analyzeType };
    }, [aiResults, analyzeType]);

    const isAnalyzing = isModeAnalyzing(effectiveMode);

    // ... (引导逻辑 useEffect 保持不变) ...
    useEffect(() => {
        const hasSeenV4 = localStorage.getItem('has_seen_overlay_guide_v4');
        if (!hasSeenV4) { /* ... */ }
    }, [isMouseLocked, mouseKey, toasts.length]);

    const handleGuideComplete = () => { setShowGuide(false); localStorage.setItem('has_seen_overlay_guide_v4', 'true'); };
    const handleStartGuide = () => { /* ... */ };

    // 🔥 [新增] 自动回传诊断日志给 Main 进程
    useEffect(() => {
        if (window.require && blueTeam.some(c=>c)) {
            const { ipcRenderer } = window.require('electron');
            
            // 构造精简版日志，方便阅读
            const debugSnapshot = {
                teamNames: blueTeam.map(c => c ? `${c.name}(${c.id})` : "NULL"),
                assignments: myLaneAssignments,
                hasChampionList: championList && championList.length > 0
            };
            
            // 发送给 main.js 打印
            ipcRenderer.send('remote-log', 'LITE_STATE_SNAPSHOT', debugSnapshot);
        }
    }, [blueTeam, myLaneAssignments, championList]);

    // ... (Electron 基础通信保持不变) ...
    useEffect(() => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('mouse-ignore-status', (e, ignored) => setIsMouseLocked(ignored));
            ipcRenderer.invoke('get-mouse-status').then(setIsMouseLocked);
            ipcRenderer.on('scroll-action', (event, direction) => {
                if (contentRef.current) contentRef.current.scrollTop += (direction === 'down' ? 40 : -40);
            });
        }
    }, []);

    useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [activeTab, effectiveMode]); 

    // =====================================================================================
    // 🔥 [核心修复] 终极版 TeamIcons - 包含“桥接查找”和“调试显示”
    // =====================================================================================
    
    const ROLE_CN = { "TOP": "上", "JUNGLE": "野", "MID": "中", "ADC": "下", "SUPPORT": "辅", "NONE": "?" };
    
    const normalizeName = (name) => {
        if (!name) return "";
        // 移除空格、标点，转小写 (保留中文)
        return name.toString().toLowerCase().replace(/[\s\.\-\']+/g, ""); 
    };

    const TeamIcons = ({ team, isEnemy }) => {
        const assignments = isEnemy ? enemyLaneAssignments : myLaneAssignments;
        const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
        
        let displayList = [];
        const hasValidAssignments = assignments && Object.values(assignments).some(v => v);

        if (hasValidAssignments) {
            displayList = ROLE_ORDER.map(role => {
                const assignedName = assignments[role];
                let hero = null;
                let matchMethod = "none";

                if (assignedName && assignedName !== "None") {
                    const target = normalizeName(assignedName);
                    
                    // 1. 第一轮：直接在 team 数组里找 (匹配 Name/ID/Title/Alias)
                    hero = team.find(c => {
                        if (!c) return false;
                        const cName = normalizeName(c.name);
                        const cKey = normalizeName(c.key || c.id);
                        
                        if (cName === target) { matchMethod="DirectName"; return true; }
                        if (cKey === target) { matchMethod="DirectKey"; return true; }
                        if (c.title && normalizeName(c.title) === target) { matchMethod="DirectTitle"; return true; }
                        return false;
                    });

                    // 2. 🔥 第二轮：桥接查找 (如果第一轮没找到，去 championList 全表里查关系)
                    if (!hero && championList && championList.length > 0) {
                        // 在全表里找“祖安怒兽”是谁
                        const dbHero = championList.find(c => 
                            normalizeName(c.name) === target ||
                            normalizeName(c.title) === target ||
                            (c.alias && c.alias.some(a => normalizeName(a) === target))
                        );
                        
                        if (dbHero) {
                            // 找到了！原来祖安怒兽是 Warwick。现在去 team 数组里找 Warwick
                            const dbKey = normalizeName(dbHero.id || dbHero.key);
                            hero = team.find(c => c && normalizeName(c.id || c.key) === dbKey);
                            if (hero) matchMethod = `Bridge via ${dbHero.name}`;
                        }
                    }
                }
                
                return { role, hero, debug: `${assignedName} -> ${matchMethod}` };
            });
        } else {
            // 兜底：按数组顺序
            displayList = team.map((hero, idx) => ({
                role: ROLE_ORDER[idx] || "NONE",
                hero,
                debug: "Index Fallback"
            }));
        }

        return (
            <div className={`flex items-center gap-1.5 ${isEnemy ? 'flex-row-reverse' : ''}`}>
                {displayList.map((item, idx) => {
                    const roleChar = ROLE_CN[item.role] || "?";
                    const hero = item.hero;

                    return (
                        <div key={idx} className="relative group">
                            <div className={`absolute -top-1.5 ${isEnemy ? '-left-1' : '-right-1'} z-10 w-3.5 h-3.5 flex items-center justify-center bg-[#091428] border border-white/20 rounded-full shadow-md`}>
                                <span className={`text-[8px] font-black ${isEnemy ? 'text-red-400' : 'text-blue-400'}`}>{roleChar}</span>
                            </div>
                            <div className={`w-6 h-6 rounded-sm overflow-hidden border ${isEnemy ? 'border-red-500/40' : 'border-blue-500/40'} bg-black/60`}>
                                {hero ? (
                                    <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full opacity-20 bg-slate-700 flex items-center justify-center cursor-help">
                                        <span className="text-[8px] text-white/20">?</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* 🔥 [新增] 鼠标悬停显示调试信息 */}
                            <div className="absolute top-8 left-0 hidden group-hover:block z-50 bg-black/90 text-white text-[10px] p-2 rounded whitespace-nowrap border border-white/20 pointer-events-none">
                                <div className="font-bold text-yellow-400">调试信息:</div>
                                <div>分路: {item.role}</div>
                                <div>目标: {isEnemy ? enemyLaneAssignments[item.role] : myLaneAssignments[item.role]}</div>
                                <div>结果: {hero ? hero.name : "NULL"}</div>
                                <div className="text-gray-400">匹配: {item.debug}</div>
                            </div>
                        </div>
                    )
                })}
            </div>
        );
    };

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
                                {MODULE_NAMES[effectiveMode] || effectiveMode.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    
                    <div id="overlay-controls" className={`flex items-center gap-2 no-drag transition-opacity duration-200 ${isInGame ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                        {/* ... Controls ... */}
                        <div className="hidden sm:flex items-center gap-1 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5 mr-1">
                            <Keyboard size={10}/> <span>{toggleKey}</span>
                        </div>
                        {/* ... Other buttons ... */}
                        <button onClick={() => setShowSettingsModal(true)} className="text-slate-500 hover:text-[#C8AA6E] transition-colors p-1 hover:bg-white/5 rounded"><Settings size={14} /></button>
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
                            
                            {/* 🔥 [调试区域] 当有匹配失败时，这里会显示红字 */}
                            <div className="w-full bg-black border-t border-white/10 py-0.5 px-2">
                                <div className="text-[8px] text-slate-600 flex justify-between font-mono">
                                    <span>DEBUG: {blueTeam[0] ? "Ready" : "NoTeam"} | {Object.keys(myLaneAssignments).length} Lanes</span>
                                    {(!championList || championList.length === 0) && <span className="text-red-500 font-bold">⚠️ NO CHAMPION DB</span>}
                                </div>
                            </div>
                        </div>
                    )}
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
                            onClear={() => handleClearAnalysis && handleClearAnalysis(effectiveMode)} 
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 p-6 min-h-[180px]">
                            {/* ... Placeholder ... */}
                            <div className={`p-3 rounded-full ${isInGame ? 'bg-black/30' : 'bg-white/5 border border-white/5'}`}>
                                <Activity size={24} className="opacity-40"/>
                            </div>
                            {!isInGame && (
                                <div className="text-center space-y-1">
                                    <p className="text-xs font-bold text-slate-400">阵容已就绪</p>
                                    <p className="text-[10px] text-slate-600">请确认上方分路角标是否正确</p>
                                </div>
                            )}
                            <button onClick={() => handleAnalyze(effectiveMode, true)} disabled={isAnalyzing} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black tracking-wide shadow-lg transition-all active:scale-95 group ${isAnalyzing ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-gradient-to-r from-[#0AC8B9] to-[#089186] text-[#091428] hover:brightness-110 hover:shadow-[#0AC8B9]/30'}`}>
                                <Zap size={14} className={isAnalyzing ? "animate-spin" : "fill-current"} />
                                <span>{isAnalyzing ? "AI 思考中..." : "开始战术分析"}</span>
                            </button>
                        </div>
                    )}
                </div>
                
                {/* ... Footer ... */}
                {!isInGame && (
                    <div className="bg-black/80 border-t border-white/5 py-1 px-2.5 text-[9px] text-slate-500 flex justify-between items-center no-drag select-none shrink-0 rounded-b-xl overflow-hidden backdrop-blur-sm">
                        <div className="flex gap-3 items-center">
                            <span className="whitespace-nowrap flex items-center gap-1" title="切换功能模块"><b className="text-slate-400 font-sans">Ctrl+{modePrevKey}/{modeNextKey}</b> 切换</span>
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