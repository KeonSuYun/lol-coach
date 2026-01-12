import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Shield, Users, Zap, Brain, Crosshair, RefreshCcw, ShieldAlert, RotateCcw, 
    Trash2, GripHorizontal, Settings, HelpCircle, RefreshCw, AlertCircle, 
    CheckCircle2, XCircle, Compass, Sparkles, Swords, RotateCw, MousePointer2, X,
    ChevronDown, ChevronUp, Link, MessageSquare 
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

// 引入配置
import { HERO_FARMING_CONFIG } from '../config/heroConfig';
import { GUIDE_STEPS } from '../config/guideSteps';

// 组件引入
import AdminDashboard from '../components/AdminDashboard';
import AdminPanel from '../components/AdminPanel'; 
import Header from '../components/Header';
import ChampCard from '../components/ChampCard';
import AnalysisResult from '../components/AnalysisResult';
import CommunityTips from '../components/CommunityTips';
import AnalysisButton from '../components/AnalysisButton';
import InviteCard from '../components/InviteCard';
import ChampSelectModal from '../components/modals/ChampSelectModal'; 
import LoginModal from '../components/modals/LoginModal';
import TipModal from '../components/modals/TipModal';
import FeedbackModal from '../components/modals/FeedbackModal';
import PricingModal from '../components/modals/PricingModal';
import SettingsModal from '../components/modals/SettingsModal'; 
import DownloadModal from '../components/modals/DownloadModal';
import LandingPage from '../components/LandingPage'; 
import UserGuide from '../components/UserGuide';

// 模块级变量防止重复同步
let hasGlobalSynced = false;

export default function MainConsole({ state, actions }) {
    const { 
        version, lcuStatus, userRole, currentUser, useThinkingModel, accountInfo, userRank,
        blueTeam, redTeam, myTeamRoles, userSlot, enemyLaneAssignments, myLaneAssignments,
        aiResults, analyzeType, isModeAnalyzing, viewMode, activeTab,
        showChampSelector, selectingSlot, selectingIsEnemy, roleMapping, championList,
        token, authMode, authForm, showLoginModal, showTipModal, inputContent, tipTarget, tips, tipTargetEnemy,
        showAdminPanel, showSettingsModal, currentShortcuts, sendChatTrigger,
        showFeedbackModal, showPricingModal,
        mapSide, showDownloadModal, hasStarted,
        adminView 
    } = state;

    const {
        setHasStarted, setUserRole, logout, setShowLoginModal, setUseThinkingModel, setShowPricingModal, setUserRank,
        handleClearSession, handleCardClick, setMyLaneAssignments, setEnemyLaneAssignments,
        handleAnalyze, setAiResults, setAnalyzingStatus, setAnalyzeType, setViewMode, setActiveTab,
        setShowChampSelector, setSelectingSlot, setUserSlot, handleSelectChampion,
        handleLogin, handleRegister, setAuthMode, setAuthForm,
        setShowSettingsModal, setShowAdminPanel, setInputContent, setShowTipModal, setShowFeedbackModal,
        handlePostTip, handleReportError, handleLike, handleDeleteTip, handleSaveShortcuts, setTipTarget, handleTabClick,
        setMapSide, setShowDownloadModal,handleClearAnalysis,
        setAdminView, handleSyncProfile
    } = actions;

    // 本地状态
    const [showGuide, setShowGuide] = useState(false);
    const [isFarmingMode, setIsFarmingMode] = useState(false);
    
    // 折叠状态控制
    const [isInviteExpanded, setIsInviteExpanded] = useState(true);
    const [isCommunityExpanded, setIsCommunityExpanded] = useState(false); // 社区默认折叠

    const isManualOverride = useRef(false);

    // 1. 自动折叠战友契约：如果已绑定，默认收起
    useEffect(() => {
        if (accountInfo?.invited_by) {
            setIsInviteExpanded(false);
        }
    }, [accountInfo?.invited_by]);

    // 2. 智能重置锁：当阵容变化时，允许自动同步
    useEffect(() => {
        isManualOverride.current = false;
    }, [JSON.stringify(myTeamRoles), userSlot]);

    // 3. 计算有效模式
    const effectiveMode = useMemo(() => {
        if (analyzeType === 'personal' && userRole === 'JUNGLE' && isFarmingMode) {
            return 'role_jungle_farming';
        }
        return analyzeType;
    }, [analyzeType, userRole, isFarmingMode]);
    
    // 4. 自动同步分路角色 (UserRole)
    useEffect(() => {
        if (isManualOverride.current) return;
        const currentHero = blueTeam[userSlot];
        
        // 优先根据分路表反查
        if (currentHero && currentHero.name) {
            const assignedRole = Object.keys(myLaneAssignments).find(
                role => myLaneAssignments[role] === currentHero.name
            );
            if (assignedRole) {
                if (userRole !== assignedRole) setUserRole(assignedRole);
                return;
            }
        }
        // 兜底根据楼层
        if (myTeamRoles && myTeamRoles[userSlot]) {
            const slotRole = myTeamRoles[userSlot];
            if (slotRole && slotRole !== userRole) setUserRole(slotRole);
        }
    }, [userSlot, blueTeam, myLaneAssignments, myTeamRoles, userRole]);

    // 5. 智能野核模式开关
    useEffect(() => {
        const hero = blueTeam[userSlot];
        if (hero && userRole === 'JUNGLE') {
            const config = HERO_FARMING_CONFIG[hero.key];
            if (config && config.tier >= 3) {
                if (!isFarmingMode) setIsFarmingMode(true);
            } else {
                if (isFarmingMode) setIsFarmingMode(false);
            }
        }
    }, [blueTeam, userSlot, userRole]);

    // 6. 模型与配置计算
    const modelType = useThinkingModel ? 'reasoner' : 'chat';
    const setModelType = (type) => setUseThinkingModel(type === 'reasoner');

    const currentHeroConfig = useMemo(() => {
        const hero = blueTeam[userSlot];
        if (!hero) return null;
        const config = HERO_FARMING_CONFIG[hero.key];
        if (!config) return { tier: 0, stars: 3, reason: "暂无特定数据，建议按需选择" };
        return {
            ...config,
            stars: isFarmingMode ? config.farming_stars : config.standard_stars,
            reason: isFarmingMode ? config.reason_farming : config.reason_standard
        };
    }, [blueTeam, userSlot, isFarmingMode]);

    // 7. 新手引导逻辑
    useEffect(() => {
        if (hasStarted) {
            const hasSeenGuide = localStorage.getItem('has_seen_guide_v2');
            if (!hasSeenGuide) {
                const timer = setTimeout(() => setShowGuide(true), 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [hasStarted]);
    
    const handleGuideComplete = () => {
        setShowGuide(false);
        localStorage.setItem('has_seen_guide_v2', 'true');
        toast.success("新手引导已完成！祝你排位连胜！", { icon: '🏆' });
    };
    
    const getEnemySideLabel = () => {
        if (mapSide === 'blue') return '(红色方)';
        if (mapSide === 'red') return '(蓝色方)';
        return '';
    };

    const handleShowCommunity = () => {
        actions.setShowCommunity(true);
    };

    // 8. 个人档案自动同步逻辑
    useEffect(() => {
        if (lcuStatus !== 'connected') hasGlobalSynced = false;
    }, [lcuStatus]);

    useEffect(() => {
        if (hasStarted && lcuStatus === 'connected' && !hasGlobalSynced) {
            const timer = setTimeout(() => {
                if (handleSyncProfile) {
                    handleSyncProfile();
                    hasGlobalSynced = true;
                    toast.success("已自动同步游戏档案", { 
                        icon: '🔄', 
                        id: 'auto-sync-profile',
                        duration: 3000,
                        style: { background: '#091428', color: '#C8AA6E', border: '1px solid rgba(200, 170, 110, 0.3)' }
                    });
                }
            }, 1500); 
            return () => clearTimeout(timer);
        }
    }, [hasStarted, lcuStatus, handleSyncProfile]);

    // 9. LCU 未连接时的演示提示
    useEffect(() => {
        if (hasStarted && lcuStatus !== 'connected' && !blueTeam[userSlot]) {
            const timer = setTimeout(() => {
                toast((t) => (
                    <div className="flex flex-col gap-3 min-w-[260px] animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                            <span className="text-2xl animate-bounce">👋</span>
                            <div>
                                <span className="font-bold text-slate-200 text-sm block">不知道如何开始？</span>
                                <span className="text-[10px] text-slate-500 block">HexCoach 战术助手</span>
                            </div>
                        </div>
                        <div className="text-xs text-slate-400 leading-relaxed">
                            <p className="mb-1">检测到您尚未连接游戏客户端。</p>
                            <p>您可以直接点击左侧 <span className="text-[#C8AA6E] font-bold border border-[#C8AA6E]/30 px-1 rounded bg-[#C8AA6E]/10">圆圈卡片</span> 手动选择英雄，即可立即体验 AI 分析功能！</p>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button 
                                className="flex-1 bg-gradient-to-r from-[#0AC8B9] to-[#089186] text-[#091428] text-xs font-bold py-2 px-3 rounded shadow-lg hover:brightness-110 active:scale-95 transition-all"
                                onClick={() => { 
                                    toast.dismiss(t.id); 
                                    setShowGuide(true); 
                                }}
                            >
                                演示给我看
                            </button>
                            <button 
                                className="px-3 py-2 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors"
                                onClick={() => toast.dismiss(t.id)}
                            >
                                我知道了
                            </button>
                        </div>
                    </div>
                ), { 
                    duration: 15000, 
                    position: 'bottom-right',
                    style: {
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(200, 170, 110, 0.4)',
                        padding: '16px',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(10px)',
                        maxWidth: '350px'
                    }
                });
            }, 10000); 
            return () => clearTimeout(timer);
        }
    }, [hasStarted, lcuStatus, blueTeam, userSlot]);

    if (!hasStarted) {
        return (
            <>
                <Toaster position="top-right" />
                <DownloadModal isOpen={showDownloadModal} onClose={() => setShowDownloadModal(false)} />
                <LandingPage onEnter={() => setHasStarted(true)} version={version} onOpenCommunity={() => actions.setShowCommunity(true)} onDownloadClick={() => setShowDownloadModal(true)} />
            </>
        );
    }

    return (
        <div className="min-h-screen relative overflow-x-hidden text-slate-300 font-sans selection:bg-[#C8AA6E]/30">
            <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', border: '1px solid #334155', color: '#fff' } }}/>
            
           {/* =====================================================================================
                💡 全局背景：海克斯充能工坊 (Hextech Charged Workshop) - 提亮版
                特点：基调从“死黑”提升为“深邃蓝”，环境光更充足，科技感与通透感更强，不再压抑。
            ===================================================================================== */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#0f172a] overflow-hidden font-sans">
                
                {/* 1. 基底：提亮的主色调 (Lighter Foundation) */}
                {/* 从接近黑色的 #0a0c10 改为更通透的深蓝灰和午夜蓝，视觉上更轻盈 */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#020617]"></div>

                {/* 2. 环境漫反射：工坊的铜色余晖 (Ambient Glow) */}
                {/* 在中下部增加大面积的暖色微光，模拟室内照明，消除压抑感 */}
                <div className="absolute inset-0 opacity-30"
                    style={{
                        background: 'radial-gradient(circle at 70% 80%, rgba(56, 189, 248, 0.08) 0%, rgba(200, 160, 100, 0.05) 30%, transparent 70%)'
                    }}
                ></div>

                {/* 3. 材质：魔法尘埃与噪点 (Texture) */}
                {/* 噪点混合模式改为 overlay，在亮背景下更细腻 */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay"></div>
                
                {/* 4. 暗纹：精密的蓝图线条 (Blueprint Lines) */}
                {/* 稍微提高一点不透明度 (5%)，让背景更有层次，不显得空旷 */}
                <div className="absolute inset-0 opacity-[0.05]"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(56, 189, 248, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(56, 189, 248, 0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: '80px 80px',
                        maskImage: 'radial-gradient(circle at 20% 20%, black 40%, transparent 100%)' // 依然只在光源附近显示清晰线条
                    }}
                ></div>

                {/* 5. 主光源：激活的海克斯核心 (Active Hexcore) */}
                {/* 左上角光源亮度大幅提升，颜色更纯净，像水晶在发光 */}
                <div className="absolute top-[-150px] left-[-150px] w-[120vw] h-[120vh] rounded-full pointer-events-none"
                    style={{
                        background: `radial-gradient(circle at 15% 15%, 
                            rgba(45, 212, 191, 0.35) 0%,   /* 核心青色高亮 (提亮) */
                            rgba(14, 165, 233, 0.20) 25%,  /* 中圈天蓝色 */
                            rgba(99, 102, 241, 0.10) 50%,  /* 外圈靛蓝色 */
                            transparent 80%)`,
                        filter: 'blur(80px)',
                        mixBlendMode: 'screen' // 滤色模式让背景变得通透
                    }}
                ></div>

                {/* 6. 视觉平衡：仅在边缘做轻微压暗，不再全屏压暗 */}
                {/* 移除之前的全屏遮罩，改为只压暗角落，保留中间的亮度 */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_transparent_60%,_#020617_120%)] opacity-60"></div>
            </div>

            <UserGuide isOpen={showGuide} steps={GUIDE_STEPS} onClose={handleGuideComplete} onComplete={handleGuideComplete} />
            <DownloadModal isOpen={showDownloadModal} onClose={() => setShowDownloadModal(false)} />

            {/* 顶部装饰线 */}
            <div className="fixed top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C8AA6E]/30 to-transparent z-50"></div>
            
            {/* 主容器：放宽到 1920px */}
            <div className="relative z-10 flex flex-col items-center p-4 md:p-6 pt-20 w-full max-w-[1920px] mx-auto">
                <div id="console-header" className="w-full relative mb-6">
                    <Header
                        version={version} lcuStatus={lcuStatus} userRole={userRole} setUserRole={setUserRole}
                        currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
                        useThinkingModel={useThinkingModel} setUseThinkingModel={setUseThinkingModel}
                        setShowPricingModal={setShowPricingModal} accountInfo={accountInfo}
                        userRank={userRank} setUserRank={setUserRank}
                        modelType={modelType} setModelType={setModelType}
                        onGoHome={() => setHasStarted(false)} onShowCommunity={handleShowCommunity}
                        onShowDownload={() => setShowDownloadModal(true)}
                        onShowSettings={setShowSettingsModal}
                        onShowAdmin={() => { setAdminView('dashboard'); setShowAdminPanel(true); }}
                        onShowProfile={() => actions.setShowProfile(true)}
                        onShowGuide={() => setShowGuide(true)} 
                        onShowSales={() => actions.setShowSalesDashboard(true)}
                        onViewProfile={actions.onViewProfile}
                    />
                </div>

                <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    
                    {/* ==============================================================================
                        🟢 左侧区域：我方 (Blue/Teal Theme)
                       ============================================================================== */}
                    <div className="xl:col-span-3 flex flex-col gap-4 xl:sticky xl:top-6 z-20">
                        
                        {/* 1. 我方阵容 (纯色圆角卡片) */}
                        <div id="left-panel-team" className="relative bg-[#0f172a]/95 backdrop-blur-md border border-[#0AC8B9]/20 rounded-lg shadow-lg overflow-hidden group/panel transition-colors hover:border-[#0AC8B9]/40">
                            {/* 顶部细条 */}
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#0AC8B9]/80 shadow-[0_0_8px_#0AC8B9]"></div>
                            
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                <div className="flex items-center gap-2.5">
                                    <Shield size={14} className="text-[#0AC8B9]" />
                                    <span className="text-[12px] font-bold text-slate-200 tracking-wider">我方阵容</span>
                                </div>
                                <button onClick={handleClearSession} className="text-slate-500 hover:text-red-400 transition-colors opacity-60 hover:opacity-100 p-1 rounded hover:bg-white/5" title="清空对局">
                                    <Trash2 size={12}/>
                                </button>
                            </div>

                            {/* 阵营切换 */}
                            <div className="flex items-center justify-center py-2 gap-2 bg-[#0b1121] text-[10px] font-bold border-b border-white/5">
                                <button onClick={() => setMapSide('blue')} className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all ${mapSide === 'blue' ? 'bg-blue-500/10 text-blue-300 border border-blue-500/40' : 'text-slate-600 hover:text-slate-400'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${mapSide === 'blue' ? 'bg-blue-400' : 'bg-slate-700'}`}></div>
                                    蓝方
                                </button>
                                <div className="w-[1px] h-3 bg-white/10"></div>
                                <button onClick={() => setMapSide('red')} className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all ${mapSide === 'red' ? 'bg-red-500/10 text-red-300 border border-red-500/40' : 'text-slate-600 hover:text-slate-400'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${mapSide === 'red' ? 'bg-red-400' : 'bg-slate-700'}`}></div>
                                    红方
                                </button>
                            </div>

                            <div className="p-2 space-y-1">
                                {blueTeam.map((c, i) => (
                                    <div key={i} onClick={() => handleCardClick(i, false)} className={`cursor-pointer transition-all duration-300 rounded border ${userSlot === i ? 'bg-[#0AC8B9]/10 border-[#0AC8B9]/40 shadow-inner' : 'border-transparent hover:bg-white/5 hover:border-white/10'}`}>
                                        <ChampCard champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} role={Object.keys(myLaneAssignments).find(k => myLaneAssignments[k] === c?.name) || myTeamRoles[i]} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. 我方分路 (圆角 + 纯色背景) */}
                        <div id="lane-assignment-panel" className="relative p-3 bg-[#0f172a]/95 backdrop-blur-md border border-[#0AC8B9]/20 rounded-lg shadow-lg overflow-hidden group/panel transition-colors hover:border-[#0AC8B9]/40">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#0AC8B9]/80 shadow-[0_0_8px_#0AC8B9]"></div>
                            
                            <div className="flex items-center justify-between mb-3 px-1 mt-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#0AC8B9]"></div>
                                    <span className="text-[12px] font-bold text-slate-200 tracking-wider">我方分路</span>
                                </div>
                                <button onClick={() => actions.autoAssignLanes(false)} className="text-[#0AC8B9] hover:text-white transition-colors bg-[#0AC8B9]/10 hover:bg-[#0AC8B9] px-2 py-0.5 rounded text-[10px] font-bold border border-[#0AC8B9]/20 flex items-center gap-1">
                                    <RefreshCcw size={10} /> 智能纠错
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => {
                                    const assignedName = myLaneAssignments[role];
                                    const heroObj = blueTeam.find(c => c?.name === assignedName);
                                    const IconMap = { "TOP": Shield, "JUNGLE": Swords, "MID": Zap, "ADC": Crosshair, "SUPPORT": Brain };
                                    const RoleIcon = IconMap[role] || HelpCircle;

                                    return (
                                        <div key={role} className="flex items-center gap-2.5 group relative select-none">
                                            {/* 图标 */}
                                            <div className="w-7 h-7 flex items-center justify-center rounded bg-[#0b1121] border border-[#0AC8B9]/20 text-slate-500 group-hover:text-[#0AC8B9] transition-all" title={role}>
                                                <RoleIcon size={14} strokeWidth={2}/>
                                            </div>
                                            {/* 按钮 */}
                                            <button 
                                                className={`flex-1 flex items-center gap-2 h-9 rounded border px-2 transition-all relative overflow-hidden ${assignedName ? 'bg-[#0b1121] border-[#0AC8B9]/30 hover:border-[#0AC8B9]/60' : 'bg-[#0AC8B9]/5 border-[#0AC8B9]/10 border-dashed hover:border-[#0AC8B9]/30'}`}
                                                onClick={() => {
                                                    const allAllies = blueTeam.filter(c => c && c.name);
                                                    if (allAllies.length === 0) return;
                                                    const otherTaken = Object.entries(myLaneAssignments).filter(([r, name]) => r !== role && name).map(([_, name]) => name);
                                                    let candidates = allAllies.filter(c => !otherTaken.includes(c.name));
                                                    if (candidates.length === 0) candidates = allAllies;
                                                    const currentIdx = candidates.findIndex(c => c.name === assignedName);
                                                    const nextIdx = (currentIdx + 1) % candidates.length;
                                                    setMyLaneAssignments(prev => ({ ...prev, [role]: candidates[nextIdx].name }));
                                                }}
                                                onContextMenu={(e) => { e.preventDefault(); setMyLaneAssignments(prev => ({ ...prev, [role]: "" })); }}
                                            >
                                                {heroObj ? (
                                                    <>
                                                        <img src={heroObj.image_url} className="w-5 h-5 rounded border border-[#0AC8B9]/30" />
                                                        <span className="text-[11px] font-bold text-slate-200 truncate">{heroObj.name}</span>
                                                    </>
                                                ) : <span className="text-[10px] text-[#0AC8B9]/50 font-bold w-full text-center">点击指定</span>}
                                                <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#0b1121] to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <RotateCw size={12} className="text-[#0AC8B9]"/>
                                                </div>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                            
                            {/* 操作提示 */}
                            <div className="mt-3 pt-2 border-t border-[#0AC8B9]/10 flex justify-end items-center px-1 opacity-50 hover:opacity-100 transition-opacity">
                                <div className="flex gap-3">
                                    <span className="text-[9px] text-[#0AC8B9]/80 flex items-center gap-1 cursor-help"><MousePointer2 size={9}/> 左键切换</span>
                                    <span className="text-[9px] text-[#0AC8B9]/80 flex items-center gap-1 cursor-help"><X size={9}/> 右键删除</span>
                                </div>
                            </div>
                        </div>

                        {/* 3. 战友契约 (折叠版) */}
                        {token && currentUser && (
                            <div className="rounded-lg overflow-hidden border border-[#0AC8B9]/30 bg-[#0f172a]/95 backdrop-blur-md transition-all hover:border-[#0AC8B9]/50">
                                <div 
                                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#0AC8B9]/5 transition-colors"
                                    onClick={() => setIsInviteExpanded(!isInviteExpanded)}
                                >
                                    <div className="flex items-center gap-2 text-[#0AC8B9]">
                                        <Link size={14} />
                                        <span className="text-xs font-bold">战友契约</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {accountInfo?.invited_by && !isInviteExpanded && (
                                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                <CheckCircle2 size={10}/> 已绑定: {accountInfo.invited_by}
                                            </span>
                                        )}
                                        {isInviteExpanded ? <ChevronUp size={14} className="text-slate-500"/> : <ChevronDown size={14} className="text-slate-500"/>}
                                    </div>
                                </div>
                                {isInviteExpanded && (
                                    <div className="p-3 border-t border-[#0AC8B9]/10 animate-in slide-in-from-top-2 duration-300">
                                        <InviteCard token={token} username={currentUser} accountInfo={accountInfo} onUpdateSuccess={() => { actions.fetchUserInfo(); }} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* ==============================================================================
                        🟡 中间区域：核心控制台 (Neutral Theme)
                       ============================================================================== */}
                    <div className="xl:col-span-6 flex flex-col gap-4 min-h-[600px] relative z-10">
                        {/* 顶部 Dock */}
                        <div className="flex justify-center sticky top-0 z-30 pt-2 pb-2">
                            <div className="flex items-center gap-1 p-1 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl ring-1 ring-black/50">
                                {[
                                    { id: 'bp', label: 'BP 推荐', icon: <Users size={14}/> },
                                    { id: 'personal', label: '王者私教', icon: <Zap size={14}/> },
                                    { id: 'team', label: '团队策略', icon: <Brain size={14}/> },
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => { setAnalyzeType(tab.id); setActiveTab(0); }} className={`relative px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 ${analyzeType === tab.id ? 'bg-gradient-to-r from-[#C8AA6E] to-[#b09358] text-[#091428] shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>{tab.icon} {tab.label}</button>
                                ))}
                            </div>
                        </div>
                        
                        <div id="center-analysis-btn" className="px-1"><AnalysisButton selectedHero={blueTeam[userSlot]} onOpenChampSelect={() => { setSelectingSlot(-1); setShowChampSelector(true); }} allowEmpty={effectiveMode === 'bp'} currentRole={userRole} onRoleChange={(newRole) => { isManualOverride.current = true; setUserRole(newRole); }} onAnalyze={() => { handleAnalyze(effectiveMode, true); }} isAnalyzing={isModeAnalyzing(effectiveMode)}/></div>
                        
                        {/* 3. 野核开关 (带说明 + 悬浮详情) */}
                        {userRole === 'JUNGLE' && analyzeType === 'personal' && (
                            <div className="bg-[#0f172a]/90 border border-[#C8AA6E]/20 p-3 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 mx-1 shadow-lg backdrop-blur-sm relative z-20">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                                        <Compass size={14} className={isFarmingMode ? "text-amber-500" : "text-[#0AC8B9]"} />
                                        打野风格
                                    </span>
                                    
                                    {/* 智能评级标签 (带悬浮窗) */}
                                    {currentHeroConfig && (
                                        <div className="relative group/badge cursor-help">
                                            {/* 标签本体 */}
                                            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold flex items-center gap-1 transition-all ${currentHeroConfig.stars >= 4 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-slate-400 border-slate-600 bg-slate-800'}`}>
                                                {currentHeroConfig.stars >= 5 && <Sparkles size={10} className="animate-pulse"/>}
                                                {blueTeam[userSlot]?.name || "英雄"} 适配度: {currentHeroConfig.stars}星
                                            </span>

                                            {/* 🔥 恢复：悬浮详情窗 */}
                                            <div className="absolute bottom-full left-0 mb-3 w-64 bg-[#0f172a] border border-[#C8AA6E]/30 p-3 rounded-xl shadow-2xl opacity-0 group-hover/badge:opacity-100 transition-all duration-200 pointer-events-none translate-y-2 group-hover/badge:translate-y-0 z-50">
                                                <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/10">
                                                    <Zap size={12} className="text-amber-500"/> 
                                                    <span className="text-slate-200 text-xs font-bold">风格适配分析</span>
                                                </div>
                                                <div className="text-[10px] text-slate-300 leading-relaxed bg-white/5 p-2 rounded border border-white/5">
                                                    {currentHeroConfig.reason}
                                                </div>
                                                {/* 小三角 */}
                                                <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-[#0f172a] border-r border-b border-[#C8AA6E]/30 transform rotate-45"></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 开关按钮 */}
                                <div className="flex bg-black/40 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setIsFarmingMode(false)} 
                                        className={`px-3 py-1 text-[10px] rounded-md font-bold transition-all relative group/btn ${!isFarmingMode ? 'bg-[#0AC8B9] text-[#091428] shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Gank 节奏
                                        {/* 悬浮提示 1 */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-[#0f172a] border border-[#0AC8B9]/30 rounded-lg shadow-xl opacity-0 group-hover/btn:opacity-100 transition-all pointer-events-none z-50 text-center">
                                            <div className="text-[10px] text-[#0AC8B9] font-bold mb-1">侧重 Gank 与反蹲</div>
                                            <div className="text-[9px] text-slate-400">牺牲刷野换取线上优势</div>
                                        </div>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setIsFarmingMode(true)} 
                                        className={`px-3 py-1 text-[10px] rounded-md font-bold transition-all relative group/btn ${isFarmingMode ? 'bg-amber-500 text-[#091428] shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Farm 野核
                                        {/* 悬浮提示 2 */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 p-2 bg-[#0f172a] border border-amber-500/30 rounded-lg shadow-xl opacity-0 group-hover/btn:opacity-100 transition-all pointer-events-none z-50 text-center">
                                            <div className="text-[10px] text-amber-500 font-bold mb-1">侧重 极致刷野与反野</div>
                                            <div className="text-[9px] text-slate-400">用经济差接管比赛</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* 结果区域 (圆角) */}
                        <div className="relative flex-1 flex flex-col bg-[#0f172a]/90 backdrop-blur border border-[#C8AA6E]/20 rounded-xl shadow-2xl p-1 overflow-hidden min-h-[500px]">
                             <AnalysisResult aiResult={aiResults[effectiveMode]} isAnalyzing={isModeAnalyzing(effectiveMode)} viewMode={viewMode} setViewMode={setViewMode} activeTab={activeTab} setActiveTab={setActiveTab} setShowFeedbackModal={setShowFeedbackModal} setFeedbackContent={setInputContent} sendChatTrigger={sendChatTrigger} onClear={() => handleClearAnalysis(effectiveMode)}/>
                        </div>
                    </div>
                    
                    {/* ==============================================================================
                        🔴 右侧区域：敌方 (Red Theme)
                       ============================================================================== */}
                    <div className="xl:col-span-3 flex flex-col gap-4 sticky top-6 z-20">
                        
                        {/* 1. 敌方阵容 (圆角) */}
                        <div id="right-panel-enemy" className="relative bg-[#1a0505]/95 backdrop-blur-md border border-red-500/30 rounded-lg shadow-lg overflow-hidden group/panel transition-colors hover:border-red-500/50">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 shadow-[0_0_10px_#ef4444]"></div>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-red-500/10 bg-red-500/5">
                                <div className="flex items-center gap-2">
                                    <Crosshair size={16} className="text-red-400" />
                                    <span className="text-sm font-bold text-red-200 tracking-wider">敌方阵容</span>
                                </div>
                                <span className="text-[10px] text-red-400/60 font-mono">{getEnemySideLabel()}</span>
                            </div>
                            <div className="p-3 space-y-1">
                                {redTeam.map((c, i) => (
                                    <div key={i} onClick={() => handleCardClick(i, true)} className="cursor-pointer hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-red-500/30 group/card">
                                        <ChampCard champ={c} idx={i} isEnemy={true} userSlot={userSlot} role={Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === c?.name)?.substring(0,3) || ""} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. 敌方分路 (圆角 + 纯色) */}
                        <div className="relative p-3 bg-[#1a0505]/95 backdrop-blur-md border border-red-500/30 rounded-lg shadow-lg overflow-hidden group/panel transition-colors hover:border-red-400/50">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500/80 shadow-[0_0_8px_#ef4444]"></div>
                            
                            <div className="flex items-center justify-between mb-3 px-1 mt-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-[12px] font-bold text-red-100 tracking-wider">敌方分路</span>
                                </div>
                                <button onClick={() => actions.autoAssignLanes(true)} className="group/reset flex items-center gap-1 bg-[#1a0505] hover:bg-[#2b0a0a] px-2 py-0.5 rounded border border-red-500/20 hover:border-red-400/40 transition-all active:scale-95 shadow-inner">
                                    <RefreshCcw size={10} className="text-red-300 group-hover/reset:text-white group-hover/reset:rotate-180 transition-transform duration-500" />
                                    <span className="text-[10px] text-red-300 group-hover/reset:text-white font-bold">智能纠错</span>
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => {
                                    const assignedName = enemyLaneAssignments[role];
                                    const heroObj = redTeam.find(c => c?.name === assignedName);
                                    const IconMap = { "TOP": Shield, "JUNGLE": Swords, "MID": Zap, "ADC": Crosshair, "SUPPORT": Brain };
                                    const RoleIcon = IconMap[role] || HelpCircle;
                                    return (
                                        <div key={role} className="flex items-center gap-2.5 group/item relative select-none">
                                            <div className="w-7 h-7 flex items-center justify-center rounded bg-[#250808] border border-red-900/40 text-red-400/60 group-hover/item:text-red-300 group-hover/item:border-red-500/60 transition-all" title={role}><RoleIcon size={14} strokeWidth={2.5} /></div>
                                            <button className={`flex-1 flex items-center gap-2 h-9 rounded border px-2 transition-all relative overflow-hidden ${assignedName ? 'bg-[#250808] border-red-500/30 hover:border-red-400' : 'bg-[#1a0505]/60 border-red-900/20 border-dashed hover:border-red-500/30'}`} onClick={() => { const allEnemies = redTeam.filter(c => c && c.name); if (allEnemies.length === 0) return; const otherTaken = Object.entries(enemyLaneAssignments).filter(([r, name]) => r !== role && name).map(([_, name]) => name); let candidates = allEnemies.filter(c => !otherTaken.includes(c.name)); if (candidates.length === 0) candidates = allEnemies; const currentIdx = candidates.findIndex(c => c.name === assignedName); const nextIdx = (currentIdx + 1) % candidates.length; setEnemyLaneAssignments(prev => ({ ...prev, [role]: candidates[nextIdx].name })); }} onContextMenu={(e) => { e.preventDefault(); setEnemyLaneAssignments(prev => ({ ...prev, [role]: "" })); toast(`已清空敌方 ${role} 位置`, { icon: '🗑️', style: {background: '#3f1212', color: '#fca5a5', border: '1px solid #7f1d1d'} }); }}>
                                                {heroObj ? (<><div className="relative w-5 h-5 rounded overflow-hidden border border-red-400/50 shadow-sm shrink-0"><img src={heroObj.image_url} className="w-full h-full object-cover transform scale-110" /></div><span className="text-[11px] font-bold text-red-100 truncate flex-1 text-left">{heroObj.name}</span></>) : <div className="flex items-center justify-center w-full gap-1 opacity-50"><span className="text-[10px] font-bold tracking-widest text-red-200">点击选择</span></div>}
                                                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#250808] to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/item:opacity-100 transition-all transform translate-x-2 group-hover/item:translate-x-0"><RotateCw size={14} className="text-red-300"/></div>
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="mt-3 pt-2 border-t border-red-500/10 flex justify-end items-center px-1 opacity-50 hover:opacity-100 transition-opacity">
                                <div className="flex gap-3"><span className="text-[9px] text-red-300 flex items-center gap-1 cursor-help"><MousePointer2 size={9}/> 左键切换</span><span className="text-[9px] text-red-300 flex items-center gap-1 cursor-help"><X size={9}/> 右键删除</span></div>
                            </div>
                        </div>
                        
                        {/* 4. 社区/绝活面板 (可折叠) */}
                        <div id="community-section" className="rounded-lg overflow-hidden border border-[#C8AA6E]/30 bg-[#0f172a]/95 backdrop-blur-md transition-all hover:border-[#C8AA6E]/50">
                            <div className="flex items-center justify-between px-4 py-3 cursor-pointer bg-[#C8AA6E]/5 hover:bg-[#C8AA6E]/10 transition-colors border-b border-[#C8AA6E]/10" onClick={() => setIsCommunityExpanded(!isCommunityExpanded)}>
                                <div className="flex items-center gap-2 text-[#C8AA6E]"><MessageSquare size={14} /><span className="text-xs font-bold">绝活社区</span></div>
                                <div className="flex items-center gap-2"><span className="text-[9px] text-slate-500">查看/发布攻略</span>{isCommunityExpanded ? <ChevronUp size={14} className="text-slate-500"/> : <ChevronDown size={14} className="text-slate-500"/>}</div>
                            </div>
                            {isCommunityExpanded && (
                                <div className="min-h-[300px] flex flex-col animate-in slide-in-from-top-2 duration-300 relative">
                                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#C8AA6E] to-transparent opacity-80 shadow-[0_0_10px_#C8AA6E]"></div>
                                    <CommunityTips tips={tips} currentUser={currentUser} currentHero={blueTeam[userSlot]?.name} currentTarget={tipTarget || enemyLaneAssignments[userRole]} allies={blueTeam} enemies={redTeam} onTargetChange={(newTarget) => setTipTarget(newTarget)} userRole={userRole} onOpenPostModal={(target) => { if(!currentUser) setShowLoginModal(true); else { setTipTargetEnemy(target); setShowTipModal(true); } }} onLike={handleLike} onDelete={handleDeleteTip}/>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
                <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} content={inputContent} setContent={setInputContent} onSubmit={(target, category) => handlePostTip(target, category)} heroName={blueTeam[userSlot]?.name || "英雄"} activeTab="wiki" championList={championList} />
                <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
                <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} username={currentUser} />
                <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentShortcuts={currentShortcuts} onSave={handleSaveShortcuts} />
                <ChampSelectModal isOpen={showChampSelector} onClose={() => setShowChampSelector(false)} championList={selectingSlot === -1 ? blueTeam.filter(c => c !== null) : championList} onSelect={(hero) => { if (selectingSlot === -1) { const idx = blueTeam.findIndex(c => c && c.key === hero.key); if (idx !== -1) { setUserSlot(idx); if (myTeamRoles[idx]) setUserRole(myTeamRoles[idx]); } setShowChampSelector(false); } else { handleSelectChampion(hero); } }} roleMapping={roleMapping} initialRoleIndex={selectingSlot === -1 ? undefined : (selectingIsEnemy ? ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].indexOf(Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === redTeam[selectingSlot]?.name)) : ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].indexOf(myTeamRoles[selectingSlot]))} />
                {showAdminPanel && token && ( adminView === 'panel' ? <AdminPanel token={token} onBack={() => setShowAdminPanel(false)} /> : <AdminDashboard token={token} username={currentUser} onClose={() => setShowAdminPanel(false)} /> )}
                {currentUser && ["admin", "root"].includes(currentUser) && ( <button onClick={() => setShowAdminPanel(true)} className="fixed bottom-6 left-6 z-50 bg-red-600/90 hover:bg-red-500 text-white p-3 rounded-full shadow-lg backdrop-blur hover:scale-110 transition-all"><ShieldAlert size={20} /></button> )}
            </div>
        </div>
    );
}