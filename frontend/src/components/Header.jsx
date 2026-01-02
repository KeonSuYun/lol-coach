import React, { useState } from 'react';
import { 
  LogOut, Download, Zap, Brain, 
  Infinity as InfinityIcon, ChevronDown, 
  Settings, ShieldAlert, Home, LayoutDashboard, 
  Globe, Diamond, User 
} from 'lucide-react';
import HexCoreIcon from './HexCoreIcon';
import ConsoleHeaderUser from './ConsoleHeaderUser'; // 确保路径正确

const Header = ({ 
    version = "15.24.1", lcuStatus, userRole, setUserRole, currentUser, logout, setShowLoginModal,
    useThinkingModel, setUseThinkingModel,
    setShowPricingModal, accountInfo,
    userRank, setUserRank,
    onGoHome, onShowCommunity, onShowDownload, onShowProfile,
    onShowSettings, onShowAdmin
}) => {
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isPro = accountInfo?.is_pro === true;
  const r1Remaining = accountInfo?.r1_remaining;

  // 智能段位计算
  const rawRank = accountInfo?.game_profile?.rank || userRank || "Unranked";
  const displayRank = (rawRank === "Unranked" || !rawRank) ? "Gold" : rawRank;

  // 🔥 [修改] 优先显示游戏内昵称 (LCU GameName)，如果没有则显示登录用户名
  // 这里的 username 字段仅用于 UI 展示，不影响逻辑上的 currentUser
  const displayDisplayName = accountInfo?.game_profile?.gameName || currentUser;

  // 构造传递给 ConsoleHeaderUser 的数据对象
  const userData = {
      username: displayDisplayName, // 展示用的名字 (昵称优先)
      tag: accountInfo?.game_profile?.tagLine || accountInfo?.tag || "#HEX", 
      avatarUrl: accountInfo?.game_profile?.profileIconId 
          ? `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${accountInfo.game_profile.profileIconId}.png`
          : `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png`,
      activeTitle: accountInfo?.active_title || "社区成员",
      rank: displayRank,
      isPro: isPro
  };

  return (
    <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 border-b border-slate-800/60 pb-4 md:pb-6 relative">
      
      {/* 中间导航栏 */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 hidden xl:flex items-center gap-8 bg-[#010A13]/80 border border-white/5 px-6 py-2 rounded-full backdrop-blur-md shadow-lg z-20">
          <button onClick={onGoHome} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold text-xs transition-colors">
              <Home size={14}/> 首页
          </button>
          
          <button className="flex items-center gap-2 text-[#C8AA6E] font-bold text-xs transition-colors relative cursor-default">
              <LayoutDashboard size={14}/> 主控台
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-[#C8AA6E] rounded-full"></div>
          </button>
          
          <button onClick={onShowCommunity} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold text-xs transition-colors">
              <Globe size={14}/> 绝活社区
          </button>
      </div>

      {/* 左侧 Logo & 标题区域 */}
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
                <div onClick={onGoHome} className="flex items-center gap-4 cursor-pointer select-none group" title="点击返回主页">
                    <div className="relative">
                        <HexCoreIcon className="w-12 h-12 md:w-14 md:h-14 text-[#0AC8B9] group-hover:rotate-180 transition-transform duration-700 filter drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
                        <div className="absolute inset-0 bg-[#0AC8B9] blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    </div>
                    
                    <div className="hidden md:flex flex-col justify-center">
                        <div className="flex items-baseline gap-2">
                            <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-blue-500 filter drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">海克斯</h1>
                            <h1 className="text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 filter drop-shadow-[0_0_5px_rgba(234,179,8,0.3)]">教练</h1>
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-[10px] font-mono font-bold text-blue-300 transform -translate-y-2">PRO</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-slate-500 uppercase group-hover:text-cyan-400 transition-colors pl-0.5">HEX TACTICAL ENGINE</span>
                        </div>
                    </div>
                </div>

                <div className="hidden md:flex flex-col gap-1.5 border-l border-white/10 pl-4 ml-2">
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider transition-all w-fit ${lcuStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${lcuStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_5px_lime]' : 'bg-slate-500'}`}></div>
                        <span>{lcuStatus === 'connected' ? 'SYSTEM LINKED' : 'LCU OFFLINE'}</span>
                    </div>
                    {lcuStatus !== 'connected' && (
                        <button onClick={onShowDownload} className="flex items-center gap-1 text-[9px] text-[#C8AA6E] hover:text-white hover:underline transition-colors cursor-pointer">
                            <Download size={10} /> 下载连接助手
                        </button>
                    )}
                </div>
            </div>
        </div>
      
      {/* ================= 右侧功能区 ================= */}
      <div className="flex flex-row flex-wrap md:flex-nowrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">

          {/* 身份状态 (仅显示升级按钮) */}
          {!isPro && currentUser && (
                  <button 
                      onClick={() => setShowPricingModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-600/20 border border-amber-500/50 hover:border-amber-400 text-amber-400 text-xs font-bold rounded-lg transition-all group"
                  >
                      <Diamond size={12} className="group-hover:animate-pulse" />
                      <span>升级 PRO</span>
                  </button>
          )}

          {/* 模型切换 */}
          <div className="flex p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button 
                  onClick={() => setUseThinkingModel(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all
                  ${!useThinkingModel ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <Zap size={12} className={!useThinkingModel ? "fill-current" : ""}/>
                  <span>极速</span>
              </button>
              
              <button 
                  onClick={() => setUseThinkingModel(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all relative group
                  ${useThinkingModel ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                  title={!isPro ? `剩余 R1 次数: ${r1Remaining}` : 'PRO 无限使用'}
              >
                  <Brain size={12} className={useThinkingModel ? "fill-current" : ""}/>
                  <span>深度</span>
                  {!isPro && currentUser && r1Remaining !== undefined && (
                      <span className={`absolute -top-1 -right-1 px-1 h-3 flex items-center justify-center rounded-full text-[8px] border ${r1Remaining > 0 ? 'bg-purple-900 border-purple-500 text-purple-200' : 'bg-red-900 border-red-500 text-red-200'}`}>
                          {r1Remaining}
                      </span>
                  )}
                  {isPro && (
                      <span className="ml-1 text-purple-200"><InfinityIcon size={10} /></span>
                  )}
              </button>
          </div>

          {/* 用户信息 & 登录登出 */}
          {currentUser ? (
              <div className="relative">
                  {/* 使用 ConsoleHeaderUser 展示信息 */}
                  <ConsoleHeaderUser 
                      {...userData}
                      onClick={() => setShowUserMenu(!showUserMenu)}
                  />

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                      <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)}></div>
                          <div className="absolute top-full right-0 mt-2 w-48 bg-[#091428] border border-[#C8AA6E]/30 rounded-xl shadow-2xl py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                              <button onClick={() => {if(onShowProfile) onShowProfile(); setShowUserMenu(false);}} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-white/5 flex items-center gap-2">
                                    <User size={14} /> 个人主页
                              </button>

                              <button onClick={() => {if(onShowSettings) onShowSettings(); setShowUserMenu(false);}} className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-white/5 flex items-center gap-2">
                                  <Settings size={14} /> 设置
                              </button>
                              {onShowAdmin && (
                                  <button onClick={() => {onShowAdmin(); setShowUserMenu(false);}} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-900/20 flex items-center gap-2">
                                      <ShieldAlert size={14} /> 管理后台
                                  </button>
                              )}
                              <div className="h-[1px] bg-white/5 my-1"></div>
                              <button onClick={logout} className="w-full text-left px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                  <LogOut size={14} /> 退出登录
                              </button>
                          </div>
                      </>
                  )}
              </div>
          ) : (
              <button 
                  onClick={() => setShowLoginModal(true)} 
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold rounded-full border border-blue-400/20 shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
              >
                  登录
              </button>
          )}
      </div>
    </div>
  );
};

export default Header;