import React, { useState, useEffect } from 'react';
import { Shield, Users, Zap, Brain, Crosshair, RefreshCcw, ShieldAlert, RotateCcw, Trash2, GripHorizontal, Settings, HelpCircle } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

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

// 🟢 [新增] 新手引导步骤配置
const GUIDE_STEPS = [
    {
        target: '#console-header',
        title: "欢迎来到 Hex Coach",
        description: "这是你的 AI 战术指挥中心。在这里，你可以连接 LCU 客户端，切换分析模式，并管理你的个人设置。",
    },
    {
        target: '#left-panel-team',
        title: "配置我方阵容",
        description: "如果连接了客户端，这里会自动同步。你也可以手动点击卡片选择英雄，并调整对应的分路。",
    },
    {
        target: '#lane-assignment-panel',
        title: "校准分路信息 (关键)",
        description: "智能分配可能无法识别摇摆位。若分路显示不正确，请务必手动调整【我方】与【敌方】的分路，确保 AI 提供最精准的对策。",
    },
    {
        target: '#center-analysis-btn',
        title: "启动 AI 推演",
        description: "设置好双方阵容后，点击此按钮。AI 将基于深度思考模型，为你提供 BP 建议、对线细节或运营策略。",
    },
    {
        target: '#analysis-tabs',
        title: "切换分析维度",
        description: "想看对线技巧或打野路线？选【王者私教】。想看大局运营？选【运营指挥】。系统会根据你的位置自动调整策略。",
    },
    {
        target: '#right-panel-enemy',
        title: "敌方情报与社区",
        description: "这里显示敌方阵容。下方是【绝活社区】，你可以查看针对当前对手的玩家心得，或者分享你的见解。",
    }
];

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
        setMapSide, setShowDownloadModal,
        setAdminView 
    } = actions;

    // 🟢 [新增] 引导状态管理
    const [showGuide, setShowGuide] = useState(false);

    // 🔥🔥🔥 [修复核心] 适配 Header 的 modelType (转换 boolean -> string)
    // 这里的 modelType 是派生状态，依赖于 state.useThinkingModel
    const modelType = useThinkingModel ? 'reasoner' : 'chat';
    
    // 这里的 setModelType 是适配函数，将 string 转换回 boolean 传给 action
    const setModelType = (type) => setUseThinkingModel(type === 'reasoner');

    // 🟢 [新增] 首次加载检查
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
                <DownloadModal 
                    isOpen={showDownloadModal} 
                    onClose={() => setShowDownloadModal(false)} 
                />
                <LandingPage 
                    onEnter={() => setHasStarted(true)} 
                    version={version}
                    onOpenCommunity={() => actions.setShowCommunity(true)}
                    onDownloadClick={() => setShowDownloadModal(true)}
                />
            </>
        );
    }

    return (
        <div className="min-h-screen">
            <Toaster position="top-right" />
            
            <UserGuide 
                isOpen={showGuide} 
                steps={GUIDE_STEPS} 
                onClose={handleGuideComplete}
                onComplete={handleGuideComplete}
            />

            <DownloadModal 
                isOpen={showDownloadModal} 
                onClose={() => setShowDownloadModal(false)} 
            />

            <div className="fixed top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C8AA6E]/50 to-transparent z-50"></div>
            
            <div className="relative z-10 flex flex-col items-center p-4 md:p-8 pt-24 max-w-[1800px] mx-auto">
                
                <div id="console-header" className="w-full relative group/header-guide">
                    <Header
                        version={version} lcuStatus={lcuStatus}
                        userRole={userRole} setUserRole={setUserRole}
                        currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
                        useThinkingModel={useThinkingModel} setUseThinkingModel={setUseThinkingModel}
                        setShowPricingModal={setShowPricingModal} accountInfo={accountInfo}
                        userRank={userRank} setUserRank={setUserRank}
                        
                        // 🔥 [修复] 现在传入了定义好的 modelType 和 setModelType
                        modelType={modelType}       
                        setModelType={setModelType}

                        onGoHome={() => setHasStarted(false)}
                        onShowCommunity={handleShowCommunity}
                        onShowDownload={() => setShowDownloadModal(true)}
                        
                        onShowSettings={setShowSettingsModal}
                        onShowAdmin={() => {
                            setAdminView('dashboard');
                            setShowAdminPanel(true);
                        }}
                        onShowProfile={() => actions.setShowProfile(true)}
                        onShowGuide={() => setShowGuide(true)} 
                        onShowSales={() => actions.setShowSalesDashboard(true)}
                    />
                </div>

                <div className="w-full mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* 左侧：我方 (Ally) */}
                    <div className="lg:col-span-3 flex flex-col gap-5 lg:sticky lg:top-8">
                        
                        {/* 1. 阵容面板 */}
                        <div id="left-panel-team" className="bg-[#091428] border border-[#C8AA6E]/30 rounded shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#0AC8B9] to-transparent opacity-50"></div>
                            
                            <div className="flex items-center justify-between px-3 py-2 bg-[#010A13]/80 border-b border-[#C8AA6E]/10">
                                <div className="flex items-center gap-2 text-[#0AC8B9]">
                                    <Shield size={14} />
                                    <span className="text-xs font-bold tracking-[0.15em] text-[#F0E6D2] uppercase">我方阵容</span>
                                </div>
                                <button onClick={handleClearSession} className="text-slate-500 hover:text-red-400 transition-colors opacity-50 hover:opacity-100" title="清空对局">
                                    <Trash2 size={12}/>
                                </button>
                            </div>

                            <div className="flex items-center justify-center py-1.5 bg-black/40 border-b border-[#C8AA6E]/10 gap-2">
                                <button 
                                    onClick={() => setMapSide('blue')}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all duration-200 border ${
                                        mapSide === 'blue' 
                                        ? 'bg-blue-900/60 border-blue-500 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.3)]' 
                                        : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400 hover:bg-white/5'
                                    }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${mapSide === 'blue' ? 'bg-blue-400' : 'bg-slate-700'}`}></div>
                                    我是蓝方 (左下)
                                </button>
                                <div className="w-[1px] h-3 bg-slate-800"></div>
                                <button 
                                    onClick={() => setMapSide('red')}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all duration-200 border ${
                                        mapSide === 'red' 
                                        ? 'bg-red-900/60 border-red-500 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.3)]' 
                                        : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400 hover:bg-white/5'
                                    }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${mapSide === 'red' ? 'bg-red-400' : 'bg-slate-700'}`}></div>
                                    我是红方 (右上)
                                </button>
                            </div>

                            <div className="p-1 space-y-1 bg-black/30">
                                {blueTeam.map((c, i) => (
                                    <div 
                                        key={i} 
                                        onClick={() => handleCardClick(i, false)}
                                        className={`cursor-pointer transition-all duration-300 rounded-sm overflow-hidden ${ // 🟢 加了 rounded-sm overflow-hidden 防止圆角溢出
                                            userSlot === i 
                                            ? 'bg-[#0AC8B9]/10 border-l-2 border-[#0AC8B9]'  // 🟢 选中：均匀的淡青色背景 + 左侧亮条
                                            : 'hover:bg-white/5 border-l-2 border-transparent' // 未选中：悬停变亮
                                        }`}
                                    >
                                        <ChampCard champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} role={Object.keys(myLaneAssignments).find(k => myLaneAssignments[k] === c?.name) || myTeamRoles[i]} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. 分路面板 */}
                        <div id="lane-assignment-panel" className="p-3 bg-[#091428] border border-[#C8AA6E]/20 rounded shadow-lg relative">
                            <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-[#C8AA6E]/50"></div>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-3 bg-[#0AC8B9] rounded-full"></div>
                                    <span className="text-[10px] font-bold text-[#F0E6D2] tracking-widest uppercase">本局分路</span>
                                </div>
                                <button onClick={() => setMyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-600 hover:text-[#C8AA6E] transition-colors">
                                    <RefreshCcw size={10} />
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => {
                                     const lcuDefaultHero = blueTeam.find((_, i) => myTeamRoles[i] === role)?.name || "";
                                     const isAssigned = !!myLaneAssignments[role];
                                     return (
                                        <div key={role} className="flex items-center justify-between gap-2 group">
                                            <label className="text-[9px] uppercase text-slate-500 font-bold w-8 text-right group-hover:text-[#0AC8B9] transition-colors">{role.substring(0,3)}</label>
                                            <div className={`flex-1 relative h-6 rounded bg-black border transition-all ${isAssigned ? 'border-[#0AC8B9] shadow-[0_0_5px_rgba(10,200,185,0.2)]' : 'border-[#C8AA6E]/10 hover:border-[#C8AA6E]/30'}`}>
                                                <select
                                                    className="w-full h-full bg-transparent text-[10px] text-center font-bold text-slate-300 outline-none appearance-none cursor-pointer absolute inset-0 z-10"
                                                    value={myLaneAssignments[role] || lcuDefaultHero}
                                                    onChange={(e) => setMyLaneAssignments({...myLaneAssignments, [role]: e.target.value})}
                                                >
                                                    <option value="">-</option>
                                                    {blueTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                                                </select>
                                            </div>
                                        </div>
                                     )
                                })}
                            </div>
                        </div>

                        {/* 3. 邀请有礼卡片 */}
                        {token && currentUser && (
                            <InviteCard 
                                token={token}
                                username={currentUser}
                                accountInfo={accountInfo} // 🔥 [新增] 传入用户信息，用于判断绑定状态
                                onUpdateSuccess={() => { actions.fetchUserInfo(); }}
                            />
                        )}
                    </div>
                    
                    {/* 中间：核心分析台 */}
                    <div className="lg:col-span-6 flex flex-col gap-0 min-h-[600px]">
                        <div id="center-analysis-btn" className="mb-4 px-1">
                            <AnalysisButton 
                                selectedHero={blueTeam[userSlot]} 
                                onOpenChampSelect={() => { setSelectingSlot(-1); setShowChampSelector(true); }} 
                                onAnalyze={() => handleAnalyze(analyzeType, true)}
                                isAnalyzing={isModeAnalyzing(analyzeType)} 
                            />
                        </div>
                        
                        <div id="analysis-tabs" className="grid grid-cols-3 gap-0 bg-[#010A13] border border-[#C8AA6E]/30 rounded-t-lg overflow-hidden relative z-30 shadow-2xl">
                            {[
                                { id: 'bp', label: 'BP 推荐', icon: <Users size={18}/>, desc: '阵容优劣' },
                                { id: 'personal', label: '王者私教', icon: <Zap size={18}/>, desc: '对线/打野' }, 
                                { id: 'team', label: '运营指挥', icon: <Brain size={18}/>, desc: '大局决策' },
                            ].map(tab => {
                                const isActive = analyzeType === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleTabClick(tab.id)}
                                        className={`relative group flex flex-col items-center justify-center py-4 transition-all duration-300 border-r border-[#C8AA6E]/10 last:border-r-0
                                            ${isActive ? 'bg-gradient-to-b from-[#091428] to-[#050C18]' : 'bg-[#010A13] hover:bg-[#091428]/40'}
                                        `}
                                    >
                                        <div className={`flex items-center gap-2 mb-0.5 ${isActive ? 'text-[#F0E6D2] drop-shadow-[0_0_5px_rgba(200,170,110,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                            {tab.icon}
                                            <span className="font-bold tracking-widest text-sm md:text-base">{tab.label}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-600 font-mono tracking-wider">{tab.desc}</span>
                                        {isActive && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#C8AA6E] shadow-[0_0_15px_#C8AA6E]"></div>}
                                    </button>
                                )
                            })}
                        </div>

                        {/* 内容 */}
                        <div className="relative flex-1 flex flex-col bg-[#091428] border-x border-b border-[#C8AA6E]/30 rounded-b-lg shadow-lg p-1">
                            <div className="absolute inset-0 opacity-5 pointer-events-none z-0 bg-[url('/hex-pattern.png')]"></div>
                            <div className="relative z-10 min-h-[500px] h-auto">
                                <AnalysisResult
                                    aiResult={aiResults[analyzeType]}
                                    isAnalyzing={isModeAnalyzing(analyzeType)}
                                    viewMode={viewMode} setViewMode={setViewMode}
                                    activeTab={activeTab} setActiveTab={setActiveTab}
                                    setShowFeedbackModal={setShowFeedbackModal}
                                    setFeedbackContent={setInputContent}
                                    sendChatTrigger={sendChatTrigger}
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* 右侧：敌方 (Enemy) */}
                    <div className="lg:col-span-3 flex flex-col gap-5 sticky top-8">
                        <div id="right-panel-enemy" className="flex flex-col gap-5">
                            <div className="bg-[#1a0505] border border-red-900/30 rounded shadow-lg relative overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-[#2a0a0a]/50 border-b border-red-900/20">
                                    <div className="flex items-center gap-2 text-red-500">
                                        <Crosshair size={14} />
                                        <span className="text-xs font-bold tracking-[0.15em] text-red-200 uppercase">
                                            敌方阵容
                                            <span className="ml-2 text-[10px] opacity-70">{getEnemySideLabel()}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="p-1 space-y-1 bg-black/20">
                                    {redTeam.map((c, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => handleCardClick(i, true)}
                                            className="cursor-pointer hover:bg-red-900/10 rounded transition-colors border-l-2 border-transparent hover:border-red-800"
                                        >
                                            <ChampCard champ={c} idx={i} isEnemy={true} userSlot={userSlot} role={Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === c?.name)?.substring(0,3) || ""} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3 bg-[#1a0505] border border-red-900/20 rounded shadow-lg relative">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-3 bg-red-600 rounded-full"></div>
                                        <span className="text-[10px] font-bold text-red-200 tracking-widest uppercase">敌方分路</span>
                                    </div>
                                    <button onClick={() => setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-600 hover:text-red-400 transition-colors">
                                        <RefreshCcw size={10} />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => (
                                        <div key={role} className="flex items-center justify-between gap-2 group">
                                            <label className="text-[9px] uppercase text-slate-600 font-bold w-8 text-right group-hover:text-red-400 transition-colors">{role.substring(0,3)}</label>
                                            <div className={`flex-1 relative h-6 rounded bg-[#0a0202] border transition-all ${enemyLaneAssignments[role] ? 'border-red-600/50 shadow-[0_0_5px_rgba(220,38,38,0.2)]' : 'border-red-900/20 hover:border-red-900/40'}`}>
                                                <select
                                                    className="w-full h-full bg-transparent text-[10px] text-center font-bold text-slate-300 outline-none appearance-none cursor-pointer absolute inset-0 z-10"
                                                    value={enemyLaneAssignments[role]}
                                                    onChange={(e) => setEnemyLaneAssignments({...enemyLaneAssignments, [role]: e.target.value})}
                                                >
                                                    <option value="">-</option>
                                                    {redTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div id="community-section" className="flex-1 min-h-[300px] bg-[#091428] border border-[#C8AA6E]/20 rounded shadow-xl overflow-hidden flex flex-col scroll-mt-28">
                                <CommunityTips
                                    tips={tips}
                                    currentUser={currentUser}
                                    currentHero={blueTeam[userSlot]?.name}
                                    currentTarget={tipTarget || enemyLaneAssignments[userRole]}
                                    allies={blueTeam}
                                    enemies={redTeam}
                                    onTargetChange={(newTarget) => setTipTarget(newTarget)}
                                    userRole={userRole}
                                    onOpenPostModal={(target) => {
                                        if(!currentUser) setShowLoginModal(true);
                                        else {
                                            setTipTargetEnemy(target);
                                            setShowTipModal(true);
                                        }
                                    }}
                                    onLike={handleLike}
                                    onDelete={handleDeleteTip}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
                
                <TipModal 
                    isOpen={showTipModal} 
                    onClose={() => setShowTipModal(false)} 
                    content={inputContent} 
                    setContent={setInputContent} 
                    onSubmit={(target, category) => handlePostTip(target, category)}
                    heroName={blueTeam[userSlot]?.name || "英雄"}
                    activeTab="wiki" 
                    championList={championList}
                />
                
                <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
                <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} username={currentUser} />
                <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentShortcuts={currentShortcuts} onSave={handleSaveShortcuts} />
                
                <ChampSelectModal
                    isOpen={showChampSelector}
                    onClose={() => setShowChampSelector(false)}
                    championList={selectingSlot === -1 ? blueTeam.filter(c => c !== null) : championList}
                    onSelect={(hero) => {
                        if (selectingSlot === -1) {
                            const idx = blueTeam.findIndex(c => c && c.key === hero.key);
                            if (idx !== -1) {
                                setUserSlot(idx);
                                if (myTeamRoles[idx]) setUserRole(myTeamRoles[idx]);
                            }
                            setShowChampSelector(false);
                        } else {
                            handleSelectChampion(hero);
                        }
                    }}
                    roleMapping={roleMapping} 
                    initialRoleIndex={
                        selectingSlot === -1 
                        ? undefined 
                        : (selectingIsEnemy 
                            ? ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].indexOf(Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === redTeam[selectingSlot]?.name))
                            : ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].indexOf(myTeamRoles[selectingSlot]))
                    }
                />

                {showAdminPanel && token && (
                    adminView === 'panel' ? (
                        <AdminPanel 
                            token={token} 
                            onBack={() => setShowAdminPanel(false)} 
                        />
                    ) : (
                        <AdminDashboard 
                            token={token} 
                            username={currentUser}
                            onClose={() => setShowAdminPanel(false)} 
                        />
                    )
                )}

                {currentUser && ["admin", "root"].includes(currentUser) && (
                    <button onClick={() => setShowAdminPanel(true)} className="fixed bottom-6 left-6 z-50 bg-red-600/90 hover:bg-red-500 text-white p-3 rounded-full shadow-lg backdrop-blur hover:scale-110 transition-all">
                        <ShieldAlert size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}