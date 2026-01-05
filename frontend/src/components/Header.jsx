import React, { useState, useEffect, useRef } from 'react'; 
import axios from 'axios'; 
import { 
  LogOut, Download, Zap, Brain, 
  Infinity as InfinityIcon, ChevronDown, 
  Settings, ShieldAlert, Home, LayoutDashboard, 
  Globe, Diamond, User, HelpCircle,
  DollarSign, MessageSquare 
} from 'lucide-react';
import HexCoreIcon from './HexCoreIcon';
import ConsoleHeaderUser from './ConsoleHeaderUser';
import MessageModal from './modals/MessageModal'; 
import { API_BASE_URL } from '../config/constants'; 
import { toast } from 'react-hot-toast';

const Header = ({ 
    version = "15.24.1", lcuStatus, userRole, setUserRole, currentUser, logout, setShowLoginModal,
    useThinkingModel, setUseThinkingModel,
    setShowPricingModal, accountInfo,
    userRank, setUserRank, modelType, setModelType,
    onGoHome, onShowCommunity, onShowDownload, onShowProfile,
    onShowSettings, onShowAdmin, onShowGuide,
    onShowSales 
}) => {
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isPro = accountInfo?.is_pro === true;
  const r1Remaining = accountInfo?.r1_remaining;

  // 私信状态管理
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const prevUnreadRef = useRef(0);

  // 1. 监听 accountInfo
  useEffect(() => {
      if (accountInfo?.unread_msg_count !== undefined) {
          setUnreadCount(accountInfo.unread_msg_count);
      }
  }, [accountInfo]);

  // 2. 独立轮询未读数
  useEffect(() => {
      const fetchUnread = async () => {
          if (!currentUser) return; 
          try {
              const token = localStorage.getItem('access_token');
              if (!token) return;
              const res = await axios.get(`${API_BASE_URL}/users/me`, {
                  headers: { Authorization: `Bearer ${token}` }
              });
              if (res.data.unread_msg_count !== undefined) {
                  setUnreadCount(res.data.unread_msg_count);
              }
          } catch (e) {
              console.error("Fetch unread failed", e);
          }
      };
      fetchUnread();
      const timer = setInterval(fetchUnread, 10000);
      return () => clearInterval(timer);
  }, [currentUser]); 

  // 3. 消息提示
  useEffect(() => {
      if (unreadCount > prevUnreadRef.current) {
          const diff = unreadCount - prevUnreadRef.current;
          if (prevUnreadRef.current !== 0 || diff > 0) {
              toast(`📩 收到 ${diff} 条新私信`, { 
                  duration: 5000,
                  position: 'top-center',
                  style: { 
                      background: 'rgba(9, 20, 40, 0.95)', 
                      color: '#fff', 
                      border: '1px solid #0AC8B9',
                      fontWeight: 'bold'
                  }
              });
          }
      }
      prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const handleMarkAllRead = () => {
      setUnreadCount(0);
  };

  const rawRank = accountInfo?.game_profile?.rank || userRank || "Unranked";
  const displayRank = (rawRank === "Unranked" || !rawRank) ? "Gold" : rawRank;
  const displayDisplayName = accountInfo?.game_profile?.gameName || currentUser;

  const userData = {
      username: displayDisplayName,
      loginId: currentUser,
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

      {/* 左侧 Logo */}
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
      
      {/* 右侧功能区 */}
      <div className="flex flex-row flex-wrap md:flex-nowrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">

          {/* 身份状态 */}
          {!isPro && currentUser && (
              <button onClick={() => setShowPricingModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-600/20 border border-amber-500/50 hover:border-amber-400 text-amber-400 text-xs font-bold rounded-lg transition-all group">
                  <Diamond size={12} className="group-hover:animate-pulse" />
                  <span>升级 PRO</span>
              </button>
          )}

          {/* 🔥 [修复] 标准切换开关：不伸缩，文字常驻 */}
          <div className="flex items-center bg-[#0A1428] rounded-lg p-1 border border-[#1E2328] ml-4 shadow-inner gap-1">
              
              {/* 1. 快速模式 */}
              <button
                  onClick={() => setModelType('chat')}
                  className={`
                      relative px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-300 flex items-center gap-2 group
                      ${modelType === 'chat'
                          ? 'bg-gradient-to-r from-blue-900/60 to-cyan-900/60 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                      }
                  `}
                  title="快速模式：响应快，BP推荐"
              >
                  <Zap size={14} className={`transition-colors ${modelType === 'chat' ? 'fill-cyan-400 text-cyan-400' : ''}`} />
                  <span>快速</span>
                  {/* 激活光效 */}
                  {modelType === 'chat' && <div className="absolute inset-0 bg-cyan-400/5 pointer-events-none rounded-md"></div>}
              </button>

              {/* 2. 核心模式 */}
            <button
                onClick={() => setModelType('reasoner')}
                className={`
                    relative overflow-hidden px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-300 flex items-center gap-2 group
                    ${modelType === 'reasoner'
                        ? 'bg-gradient-to-r from-amber-900/60 to-orange-900/60 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                    }
                `}
                title="核心模式：深度思考，能力强"
            >
                <Brain size={14} className={`transition-colors ${modelType === 'reasoner' ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>核心</span>
                
                {/* 剩余次数显示 */}
                {currentUser && (
                    <div className="ml-1 flex items-center">
                        {isPro ? (
                            <InfinityIcon size={12} className={`transition-colors ${modelType === 'reasoner' ? 'text-amber-300' : 'text-slate-600'}`} />
                        ) : (
                            <span className={`text-[9px] px-1.5 py-[1px] rounded-full font-mono border transition-all ${
                                modelType === 'reasoner'
                                    ? 'bg-black/60 border-amber-500/40 text-amber-200'
                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}>
                                {r1Remaining ?? '-'}
                            </span>
                        )}
                    </div>
                )}
                
                {/* 激活光效 + 扫光动画 */}
                {modelType === 'reasoner' && (
                    <>
                      <div className="absolute inset-0 bg-amber-400/5 pointer-events-none rounded-md"></div>
                      <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 animate-[shimmer_3s_infinite] pointer-events-none"></div>
                    </>
                )}
            </button>
          </div>

          <button onClick={onShowGuide} className="p-2 text-slate-500 hover:text-[#0AC8B9] transition-colors rounded-full hover:bg-white/5" title="功能指引">
              <HelpCircle size={20} />
          </button>

          {currentUser ? (
              <div className="relative">
                  <ConsoleHeaderUser {...userData} onClick={() => setShowUserMenu(!showUserMenu)} />
                  {showUserMenu && (
                      <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)}></div>
                          <div className="absolute top-full right-0 mt-2 w-56 bg-[#091428] border border-[#C8AA6E]/30 rounded-xl shadow-2xl py-1 z-40 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                              <div className="px-4 py-3 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                                  <p className="text-xs font-bold text-slate-100">已登录</p>
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{userData.loginId}</p>
                              </div>
                              <div className="p-1.5 space-y-0.5">
                                  <button onClick={() => {if(onShowProfile) onShowProfile(); setShowUserMenu(false);}} className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-3 rounded-lg transition-colors group">
                                        <User size={14} className="text-slate-500 group-hover:text-white"/> 个人主页
                                  </button>
                                  <button onClick={() => { setShowMessageModal(true); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-cyan-900/40 hover:to-transparent flex items-center justify-between gap-3 rounded-lg transition-all group border border-transparent hover:border-cyan-500/20">
                                      <div className="flex items-center gap-3">
                                          <MessageSquare size={14} className={`transition-colors ${unreadCount > 0 ? 'text-red-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
                                          <span className={unreadCount > 0 ? 'text-slate-200 font-bold' : ''}>我的私信</span>
                                      </div>
                                      {unreadCount > 0 && (
                                          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse min-w-[18px] text-center">
                                              {unreadCount > 99 ? '99+' : unreadCount}
                                          </span>
                                      )}
                                  </button>
                                  {['admin', 'root', 'sales'].includes(accountInfo?.role) && (
                                      <button onClick={() => { if(onShowSales) onShowSales(); setShowUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-900/20 flex items-center gap-3 rounded-lg transition-colors">
                                          <DollarSign size={14} /> 销售合伙人
                                          <span className="bg-red-500 text-white text-[9px] px-1 rounded scale-90">内测</span>
                                      </button>
                                  )}
                              </div>
                              <div className="h-[1px] bg-white/5 my-1 mx-2"></div>
                              <div className="p-1.5">
                                  <button onClick={logout} className="w-full text-left px-4 py-2.5 text-xs text-slate-400 hover:text-red-300 hover:bg-red-900/20 flex items-center gap-3 rounded-lg transition-colors">
                                      <LogOut size={14} /> 退出登录
                                  </button>
                              </div>
                          </div>
                      </>
                  )}
              </div>
          ) : (
              <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold rounded-full border border-blue-400/20 shadow-lg shadow-blue-900/20 transition-all hover:scale-105">
                  登录
              </button>
          )}
      </div>

      <MessageModal isOpen={showMessageModal} onClose={() => setShowMessageModal(false)} onMarkAllRead={handleMarkAllRead} currentUser={userData} />
    </div>
  );
};

export default Header;