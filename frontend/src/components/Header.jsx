import React from 'react';
import { Link, Unplug, User, LogOut, Download, Zap, Brain, Diamond, Crown, Infinity as InfinityIcon, Trophy } from 'lucide-react';
// ROLES 引用如果不再使用也可以删除，或者保留不动
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
    version, lcuStatus, userRole, setUserRole, currentUser, logout, setShowLoginModal,
    useThinkingModel, setUseThinkingModel,
    setShowPricingModal,
    accountInfo,
    userRank, setUserRank
}) => {
  
  const isPro = accountInfo?.is_pro === true;
  const r1Remaining = accountInfo?.r1_remaining;
  const r1Limit = accountInfo?.r1_limit || 10;

  return (
    // 🟢 修改点：删除了 max-w-7xl，改为 w-full 让它自适应父容器宽度
    <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-800/60 pb-6">
      {/* 左侧 Logo 区域 */}
      <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tighter flex items-center gap-2">
              HEX<span className="text-amber-500">COACH</span>
          </h1>
          <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
               <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${lcuStatus==='connected' ? 'border-green-500/30 bg-green-900/20 text-green-400' : 'border-red-500/30 bg-red-900/20 text-red-400'}`}>
                  {lcuStatus==='connected' ? <Link size={10}/> : <Unplug size={10}/>}
                  <span>{lcuStatus==='connected' ? "CLIENT CONNECTED" : "WAITING..."}</span>
               </div>
               
               {lcuStatus !== 'connected' && (
                   <a 
                       href="/download/DeepCoach-Helper.exe" 
                       download="DeepCoach-Helper.exe"
                       className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-slate-900 bg-amber-500 rounded hover:bg-amber-400 transition-colors cursor-pointer"
                   >
                       <Download size={10}/>
                       <span>下载助手</span>
                   </a>
               )}
               <span>|</span>
               <span>{version}</span>
          </div>
      </div>
      
      {/* 右侧功能区 */}
      <div className="flex flex-col md:flex-row items-end md:items-center gap-4">

          {/* 段位选择器 */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg">
                <Trophy size={12} className="text-yellow-500" />
                <select 
                    value={userRank} 
                    onChange={(e) => setUserRank(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 outline-none border-none font-bold cursor-pointer"
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
          
          {/* 身份状态 */}
          {isPro ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-amber-600/20 border border-yellow-500/50 text-yellow-400 text-xs font-bold rounded-lg shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                  <Crown size={12} className="fill-current" />
                  <span>PRO MEMBER</span>
              </div>
          ) : (
              currentUser && (
                  <button 
                      onClick={() => setShowPricingModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-600/20 border border-amber-500/50 hover:border-amber-400 text-amber-400 text-xs font-bold rounded-lg transition-all hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] group"
                  >
                      <Diamond size={12} className="group-hover:animate-pulse" />
                      <span>升级 Pro</span>
                  </button>
              )
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

          {/* 用户信息 */}
          {currentUser ? (
              <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                  <span className={`flex items-center gap-1 ${isPro ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>
                      <User size={12}/> {currentUser}
                  </span>
                  <div className="w-px h-3 bg-slate-700 mx-1"></div>
                  <button onClick={logout} className="text-red-400 hover:text-red-300 flex items-center gap-1" title="登出">
                      <LogOut size={14}/>
                  </button>
              </div>
          ) : (
              <button 
                  onClick={() => setShowLoginModal(true)} 
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold rounded-lg border border-blue-400/20 shadow-lg shadow-blue-900/20 transition-all"
              >
                  登录 / 注册
              </button>
          )}
      </div>
    </div>
  );
};

export default Header;