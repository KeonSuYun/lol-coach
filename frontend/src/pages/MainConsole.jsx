import React from 'react';
import { Shield, Users, Zap, Brain, Crosshair, RefreshCcw, ShieldAlert, RotateCcw, Trash2, GripHorizontal, Settings } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

// 组件引入
import AdminDashboard from '../components/AdminDashboard';
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

export default function MainConsole({ state, actions }) {
    const { 
        version, lcuStatus, userRole, currentUser, useThinkingModel, accountInfo, userRank,
        blueTeam, redTeam, myTeamRoles, userSlot, enemyLaneAssignments, myLaneAssignments,
        aiResults, analyzeType, isModeAnalyzing, viewMode, activeTab,
        showChampSelector, selectingSlot, selectingIsEnemy, roleMapping, championList,
        token, authMode, authForm, showLoginModal, showTipModal, inputContent, tipTarget, tips, tipTargetEnemy,
        showAdminPanel, showSettingsModal, currentShortcuts, sendChatTrigger,
        showFeedbackModal, showPricingModal
    } = state;

    const {
        setHasStarted, setUserRole, logout, setShowLoginModal, setUseThinkingModel, setShowPricingModal, setUserRank,
        handleClearSession, handleCardClick, setMyLaneAssignments, setEnemyLaneAssignments,
        handleAnalyze, setAiResults, setAnalyzingStatus, setAnalyzeType, setViewMode, setActiveTab,
        setShowChampSelector, setSelectingSlot, setUserSlot, handleSelectChampion,
        handleLogin, handleRegister, setAuthMode, setAuthForm,
        setShowSettingsModal, setShowAdminPanel, setInputContent, setShowTipModal, setShowFeedbackModal,
        handlePostTip, handleReportError, handleLike, handleDeleteTip, handleSaveShortcuts, setTipTarget, handleTabClick
    } = actions;

    return (
        <div className="min-h-screen">
            <Toaster position="top-right" />
            <div className="fixed top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C8AA6E]/50 to-transparent z-50"></div>
            <div className="relative z-10 flex flex-col items-center p-4 md:p-8 max-w-[1800px] mx-auto">
                
                <Header
                    version={version} lcuStatus={lcuStatus}
                    userRole={userRole} setUserRole={setUserRole}
                    currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
                    useThinkingModel={useThinkingModel} setUseThinkingModel={setUseThinkingModel}
                    setShowPricingModal={setShowPricingModal} accountInfo={accountInfo}
                    userRank={userRank} setUserRank={setUserRank}
                    onGoHome={() => setHasStarted(false)}
                />

                <div className="w-full mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* 左侧：我方 (Ally) */}
                    <div className="lg:col-span-3 flex flex-col gap-5 lg:sticky lg:top-8">
                        {/* 1. 阵容面板 */}
                        <div className="bg-[#091428] border border-[#C8AA6E]/30 rounded shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#0AC8B9] to-transparent opacity-50"></div>
                            <div className="flex items-center justify-between px-3 py-2 bg-[#010A13]/80 border-b border-[#C8AA6E]/10">
                                <div className="flex items-center gap-2 text-[#0AC8B9]">
                                    <Shield size={14} />
                                    <span className="text-xs font-bold tracking-[0.15em] text-[#F0E6D2] uppercase">我方阵容</span>
                                </div>
                                <button onClick={handleClearSession} className="text-slate-500 hover:text-red-400 transition-colors opacity-50 hover:opacity-100">
                                    <Trash2 size={12}/>
                                </button>
                            </div>
                            <div className="p-1 space-y-1 bg-black/30">
                                {blueTeam.map((c, i) => (
                                    <div 
                                        key={i} 
                                        onClick={() => handleCardClick(i, false)}
                                        className={`cursor-pointer transition-all duration-300 ${userSlot === i ? 'bg-gradient-to-r from-[#0AC8B9]/20 to-transparent border-l-2 border-[#0AC8B9]' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
                                    >
                                        <ChampCard champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} role={myTeamRoles[i]} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. 分路面板 */}
                        <div className="p-3 bg-[#091428] border border-[#C8AA6E]/20 rounded shadow-lg relative">
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
                                onUpdateSuccess={() => { actions.fetchUserInfo(); }}
                            />
                        )}
                    </div>
                    
                    {/* 中间：核心分析台 */}
                    <div className="lg:col-span-6 flex flex-col gap-0 min-h-[600px]">
                        <div className="mb-4 px-1">
                            <AnalysisButton 
                                selectedHero={blueTeam[userSlot]} 
                                onOpenChampSelect={() => { setSelectingSlot(-1); setShowChampSelector(true); }} 
                                onResult={(res) => setAiResults(prev => ({ ...prev, [analyzeType]: res }))} 
                                setLoading={(val) => setAnalyzingStatus(prev => ({ ...prev, [analyzeType]: val }))} 
                                isAnalyzing={isModeAnalyzing(analyzeType)} 
                                currentUser={currentUser}
                                userRole={accountInfo?.role}
                            />
                        </div>
                        {/* Tab */}
                        <div className="grid grid-cols-3 gap-0 bg-[#010A13] border border-[#C8AA6E]/30 rounded-t-lg overflow-hidden relative lg:sticky lg:top-[80px] z-30 shadow-2xl">
                            {[
                                { id: 'bp', label: 'BP 推荐', icon: <Users size={18}/>, desc: '阵容优劣' },
                                { id: 'personal', label: '王者私教', icon: <Zap size={18}/>, desc: '对线细节' },
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
                            {/* 刷新 */}
                            {aiResults[analyzeType] && !isModeAnalyzing(analyzeType) && (
                                <div className="absolute top-4 right-6 z-20">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleAnalyze(analyzeType, true); }}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-black/80 hover:bg-[#0AC8B9]/20 rounded border border-[#C8AA6E]/20 text-[#C8AA6E] hover:text-white transition-all backdrop-blur group"
                                    >
                                        <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                                        <span className="text-xs font-bold">REGENERATE</span>
                                    </button>
                                </div>
                            )}
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
                        {/* 敌方阵容 */}
                        <div className="bg-[#1a0505] border border-red-900/30 rounded shadow-lg relative overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 bg-[#2a0a0a]/50 border-b border-red-900/20">
                                <div className="flex items-center gap-2 text-red-500">
                                    <Crosshair size={14} />
                                    <span className="text-xs font-bold tracking-[0.15em] text-red-200 uppercase">敌方阵容</span>
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

                        {/* 敌方分路 */}
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
                        
                        {/* 社区 Tips */}
                        <div className="flex-1 min-h-[300px] bg-[#091428] border border-[#C8AA6E]/20 rounded shadow-xl overflow-hidden flex flex-col">
                            <CommunityTips
                                tips={tips}
                                currentUser={currentUser}
                                currentHero={blueTeam[userSlot]?.name}
                                currentTarget={tipTarget || enemyLaneAssignments[userRole]}
                                allies={blueTeam}
                                enemies={redTeam}
                                onTargetChange={(newTarget) => setTipTarget(newTarget)}
                                userRole={userRole}
                                onOpenPostModal={(isGeneralIntent) => {
                                    if(!currentUser) setShowLoginModal(true);
                                    else {
                                        const currentT = tipTarget || enemyLaneAssignments[userRole];
                                        setTipTargetEnemy(isGeneralIntent ? null : currentT);
                                        setShowTipModal(true);
                                    }
                                }}
                                onLike={handleLike}
                                onDelete={handleDeleteTip}
                            />
                        </div>
                    </div>
                </div>

                {/* 模态框组件 */}
                <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
                <TipModal 
                    isOpen={showTipModal} 
                    onClose={() => setShowTipModal(false)} 
                    content={inputContent} 
                    setContent={setInputContent} 
                    onSubmit={() => handlePostTip(false)}
                    heroName={blueTeam[userSlot]?.name || "英雄"}
                    targetName={tipTargetEnemy} 
                />
                <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
                <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} username={currentUser} />
                <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentShortcuts={currentShortcuts} onSave={handleSaveShortcuts} />
                
                {/* 渲染选人弹窗 */}
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

                {showAdminPanel && token && <AdminDashboard token={token} onClose={() => setShowAdminPanel(false)} />}
                {currentUser && ["admin", "root"].includes(currentUser) && (
                    <button onClick={() => setShowAdminPanel(true)} className="fixed bottom-6 left-6 z-50 bg-red-600/90 hover:bg-red-500 text-white p-3 rounded-full shadow-lg backdrop-blur hover:scale-110 transition-all">
                        <ShieldAlert size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}