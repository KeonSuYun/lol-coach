import React from 'react';
import { Link, Unplug, User, LogOut, Download, Zap, Brain, Diamond, Crown, Infinity as InfinityIcon, Trophy, Wifi, WifiOff, ChevronDown, Gem, Activity } from 'lucide-react';
import HexCoreIcon from './HexCoreIcon';
// 你的常量配置
import { ROLES } from '../config/constants';

// 定义段位列表
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
    userRank, setUserRank,
    onGoHome // 🟢 接收返回主页的回调
}) => {
  
  const isPro = accountInfo?.is_pro === true;
  const r1Remaining = accountInfo?.r1_remaining;
  const r1Limit = accountInfo?.r1_limit || 10;

  // 辅助函数：根据段位ID获取颜色对象
  const getCurrentRankObj = () => RANKS.find(r => r.id === userRank) || RANKS[3];

  return (
    // 📱 容器调整：减小移动端底部 padding (pb-4)
    <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 border-b border-slate-800/60 pb-4 md:pb-6 relative">
      
      {/* ================= 左侧 Logo & 标题区域 ================= */}
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
                {/* 🟢 修改：点击 Logo 返回主页 */}
                <div 
                    onClick={onGoHome}
                    className="flex items-center gap-4 cursor-pointer select-none group"
                    title="点击返回主页"
                >
                    {/* 🌀 Logo 图标 */}
                    <div className="relative">
                        <HexCoreIcon className="w-12 h-12 md:w-14 md:h-14 text-[#0AC8B9] group-hover:rotate-180 transition-transform duration-700 filter drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]" />
                        <div className="absolute inset-0 bg-[#0AC8B9] blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    </div>
                    
                    {/* 🏆 标题区域 (优化字体科技感) */}
                    <div className="hidden md:flex flex-col justify-center">
                        <div className="flex items-baseline gap-2">
                            {/* 主标题：海克斯 (科技蓝 + 硬朗无衬线) */}
                            <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-blue-500 filter drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
                                海克斯
                            </h1>
                            {/* 副标题：教练 (金色 + 宽字距) */}
                            <h1 className="text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 filter drop-shadow-[0_0_5px_rgba(234,179,8,0.3)]">
                                教练
                            </h1>
                            {/* 版本角标 */}
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-[10px] font-mono font-bold text-blue-300 transform -translate-y-2">
                                PRO
                            </span>
                        </div>
                        
                        {/* 英文底座 */}
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono font-bold tracking-[0.3em] text-slate-500 uppercase group-hover:text-cyan-400 transition-colors pl-0.5">
                                HEX TACTICAL ENGINE
                            </span>
                        </div>
                    </div>
                </div>

                {/* 状态指示器与下载按钮 (修复缺失的10行代码) */}
                <div className="hidden md:flex flex-col gap-1.5 border-l border-white/10 pl-4 ml-2">
                    {/* LCU 状态 */}
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider transition-all w-fit
                        ${lcuStatus === 'connected' 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                            : 'bg-slate-800 border-slate-700 text-slate-500'
                        }`}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full ${lcuStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_5px_lime]' : 'bg-slate-500'}`}></div>
                        <span>{lcuStatus === 'connected' ? 'SYSTEM LINKED' : 'LCU OFFLINE'}</span>
                    </div>

                    {/* 下载助手 (仅未连接时显示) */}
                    {lcuStatus !== 'connected' && (
                        <a 
                            href="/download/DeepCoach-Helper.exe" 
                            download="DeepCoach-Helper.exe"
                            className="flex items-center gap-1 text-[9px] text-[#C8AA6E] hover:text-white hover:underline transition-colors cursor-pointer"
                        >
                            <Download size={10} /> 下载连接助手
                        </a>
                    )}
                </div>
            </div>
        </div>
      
      {/* ================= 右侧功能区 (保持不变) ================= */}
      <div className="flex flex-row flex-wrap md:flex-nowrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">

          {/* 1. 段位选择器 */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-full hover:border-slate-500 transition-colors group/rank">
                <Trophy size={14} className={`${getCurrentRankObj().color} transition-colors`} />
                <select 
                    value={userRank} 
                    onChange={(e) => setUserRank(e.target.value)}
                    className={`bg-transparent text-xs outline-none border-none font-bold cursor-pointer min-w-[80px] md:min-w-[100px] ${getCurrentRankObj().color}`}
                    title="选择你的段位，AI将根据段位调整推荐算法"
                >
                    {RANKS.map(r => (
                        <option key={r.id} value={r.id} className="bg-slate-900 text-slate-300">
                            {r.label}
                        </option>
                    ))}
                </select>
                <ChevronDown size={10} className="text-slate-500 group-hover/rank:text-slate-300"/>
            </div>
          </div>
          
          {/* 2. 身份状态 */}
          {isPro ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500/10 to-amber-600/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold rounded-lg shadow-[0_0_10px_rgba(234,179,8,0.1)] cursor-default select-none">
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
                      <span>升级 PRO</span>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all relative group
                  ${useThinkingModel ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                  title={!isPro ? `剩余 R1 次数: ${r1Remaining}` : 'PRO 无限使用'}
              >
                  <Brain size={12} className={useThinkingModel ? "fill-current" : ""}/>
                  <span>深度</span>
                  {/* 次数提示角标 */}
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

          {/* 4. 用户信息 & 登录登出 */}
          {currentUser ? (
              <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 rounded-full pl-3 pr-2 py-1.5 ml-auto md:ml-0">
                  <span className={`flex items-center gap-1.5 ${isPro ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}>
                      <User size={14} className={isPro ? "fill-current" : ""}/> 
                      <span className="max-w-[80px] md:max-w-none truncate">{currentUser}</span>
                  </span>
                  <div className="w-px h-3 bg-slate-700 mx-1"></div>
                  <button onClick={logout} className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors" title="登出">
                      <LogOut size={12}/>
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