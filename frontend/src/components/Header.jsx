import React from 'react';
import { Link, Unplug, User, LogOut, Download, Zap, Brain, Diamond, Crown, Infinity as InfinityIcon, Trophy } from 'lucide-react';
// 引入新设计的海克斯核心图标
import HexCoreIcon from './HexCoreIcon';
// 你的常量配置
import { ROLES } from '../config/constants';

// 定义段位列表 (保留原逻辑)
const RANKS = [
    { id: "Iron", label: "黑铁 Iron", color: "text-gray-500" },
    { id: "Bronze", label: "青铜 Bronze", color: "text-orange-700" },
    { id: "Silver", label: "白银 Silver", color: "text-slate-400" },
    { id: "Gold", label: "黄金 Gold", color: "text-yellow-400" },
    { id: "Platinum", label: "白金 Platinum", color: "text-cyan-400" },
    { id: "Emerald", label: "翡翠 Emerald", color: "text-emerald-400" },
    { id: "Diamond", label: "钻石 Diamond", color: "text-blue-300" },
    { id: "Master", label: "大师 Master", color: "text-purple-400" },
    { id: "Grandmaster", label: "宗师 Grandmaster", color: "text-red-400" },
    { id: "Challenger", label: "王者 Challenger", color: "text-yellow-200" }
];

const Header = ({ 
    version = "15.24.1", lcuStatus, userRole, setUserRole, currentUser, logout, setShowLoginModal,
    useThinkingModel, setUseThinkingModel,
    setShowPricingModal,
    accountInfo,
    userRank, setUserRank
}) => {
  
  const isPro = accountInfo?.is_pro === true;
  const r1Remaining = accountInfo?.r1_remaining;
  const r1Limit = accountInfo?.r1_limit || 10;

  return (
    // 📱 容器调整：减小移动端底部 padding (pb-4)
    <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 border-b border-slate-800/60 pb-4 md:pb-6">
      
      {/* ================= 左侧 Logo & 状态区域 ================= */}
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-4">
                {/* 🌀 Logo 图标 (📱 移动端缩小为 w-12 h-12) */}
                <HexCoreIcon className="w-12 h-12 md:w-16 md:h-16 shrink-0 filter drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
                
                {/* 🏆 标题区域 (📱 移动端隐藏文字，只留 Logo) */}
                <div className="hidden md:flex flex-col justify-center select-none group">
                    <h1 className="text-3xl md:text-4xl font-black italic tracking-wide leading-none flex items-center gap-1.5 filter drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-200 pr-1">
                            海克斯
                        </span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500">
                            教练
                        </span>
                    </h1>
                    
                    {/* 英文底座 */}
                    <div className="w-full flex justify-center mt-1">
                        <span className="text-xs font-sans font-black italic tracking-[0.35em] text-blue-400/60 uppercase group-hover:text-blue-300/90 transition-colors duration-500 pl-1">
                            HEX COACH
                        </span>
                    </div>
                </div>
            </div>

            {/* 🔌 状态指示器 (📱 移动端隐藏 LCU 状态，因为无法连接) */}
            <div className="hidden md:flex items-center gap-3 pl-1 mt-2">
                {/* 连接状态 - 胶囊风格 */}
                <div className={`
                    relative flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-500 overflow-hidden
                    ${lcuStatus === 'connected' 
                        ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                        : 'border-red-500/30 bg-red-500/10 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                    }
                `}>
                    <div className={`w-1.5 h-1.5 rounded-full ${lcuStatus === 'connected' ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]'}`}></div>
                    <span className="relative z-10 text-[10px] font-bold tracking-widest font-mono">
                        {lcuStatus === 'connected' ? "SYSTEM_ONLINE" : "等待连接..."}
                    </span>
                </div>

                {/* 下载助手 */}
                {lcuStatus !== 'connected' && (
                    <a 
                        href="/download/DeepCoach-Helper.exe" 
                        download="DeepCoach-Helper.exe"
                        className="group relative flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-950/30 text-amber-500 hover:text-amber-300 hover:border-amber-400/60 transition-all cursor-pointer overflow-hidden decoration-0"
                    >
                        <Download size={11} className="relative z-10 group-hover:translate-y-0.5 transition-transform duration-300"/>
                        <span className="relative z-10 text-[10px] font-bold tracking-wide">下载助手</span>
                    </a>
                )}

                <span className="text-[10px] font-mono text-slate-700 select-none opacity-50 ml-1">
                    v{version}
                </span>
            </div>
        </div>
      
      {/* ================= 右侧功能区 (📱 移动端布局优化) ================= */}
      {/* 1. flex-row flex-wrap: 移动端横向排列并自动换行
          2. justify-between: 移动端尽量撑满宽度
      */}
      <div className="flex flex-row flex-wrap md:flex-nowrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">

          {/* 1. 段位选择器 */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-full hover:border-slate-500 transition-colors">
                <Trophy size={14} className="text-yellow-500" />
                <select 
                    value={userRank} 
                    onChange={(e) => setUserRank(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 outline-none border-none font-bold cursor-pointer min-w-[80px] md:min-w-[100px]"
                    title="选择你的段位，AI将根据段位调整推荐算法"
                >
                    {RANKS.map(r => (
                        <option key={r.id} value={r.id} className="bg-slate-900 text-slate-300">
                            {r.label}
                        </option>
                    ))}
                </select>
            </div>
          </div>
          
          {/* 2. 身份状态 */}
          {isPro ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500/10 to-amber-600/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold rounded-lg shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                  <Crown size={12} className="fill-current" />
                  <span>PRO</span>
              </div>
          ) : (
              currentUser && (
                  <button 
                      onClick={() => setShowPricingModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-600/20 border border-amber-500/50 hover:border-amber-400 text-amber-400 text-xs font-bold rounded-lg transition-all group"
                  >
                      <Diamond size={12} className="group-hover:animate-pulse" />
                      <span>升级</span>
                  </button>
              )
          )}

          {/* 3. 模型切换 */}
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all relative
                  ${useThinkingModel ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                  <Brain size={12} className={useThinkingModel ? "fill-current" : ""}/>
                  <span>深度</span>
                  {!isPro && currentUser && r1Remaining !== undefined && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${r1Remaining > 0 ? 'bg-purple-800 text-purple-200' : 'bg-red-900 text-red-200'}`}>
                          {r1Remaining}/{r1Limit}
                      </span>
                  )}
                  {isPro && (
                      <span className="ml-1 text-purple-200"><InfinityIcon size={10} /></span>
                  )}
              </button>
          </div>

          {/* 4. 用户信息 & 登录登出 */}
          {currentUser ? (
              <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 rounded-full px-3 py-2 ml-auto md:ml-0">
                  <span className={`flex items-center gap-1.5 ${isPro ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>
                      <User size={14} className={isPro ? "fill-current" : ""}/> 
                      {/* 📱 移动端如果名字太长可以考虑截断，这里保持原样 */}
                      <span className="max-w-[80px] md:max-w-none truncate">{currentUser}</span>
                  </span>
                  <div className="w-px h-3 bg-slate-700 mx-1"></div>
                  <button onClick={logout} className="text-red-400 hover:text-red-300 flex items-center gap-1" title="登出">
                      <LogOut size={14}/>
                  </button>
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