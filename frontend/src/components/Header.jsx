import React from 'react';
import { Link, Unplug, User, LogOut, Download, Zap, Brain } from 'lucide-react';
import { ROLES } from '../config/constants';

const Header = ({ 
    version, lcuStatus, userRole, setUserRole, currentUser, logout, setShowLoginModal,
    // ✨ 新增 props
    useThinkingModel, setUseThinkingModel 
}) => {
  return (
    <div className="w-full max-w-7xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-800/60 pb-6">
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
          
          {/* ✨ 模型切换开关 ✨ */}
          <div className="flex p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button 
                  onClick={() => setUseThinkingModel(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all
                  ${!useThinkingModel ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                  title="DeepSeek-V3: 极速响应，适合BP环节"
              >
                  <Zap size={12} className={!useThinkingModel ? "fill-current" : ""}/>
                  <span>极速模式</span>
              </button>
              <button 
                  onClick={() => setUseThinkingModel(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all
                  ${useThinkingModel ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                  title="DeepSeek-R1: 深度思考，适合复盘和对线细节"
              >
                  <Brain size={12} className={useThinkingModel ? "fill-current" : ""}/>
                  <span>深度思考</span>
              </button>
          </div>

          <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-800">
              {ROLES.map(r => (
                  <button key={r.id} onClick={() => setUserRole(r.id)} 
                      className={`relative px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2
                      ${userRole===r.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                      <span>{r.icon}</span>
                      <span className="hidden sm:inline">{r.label}</span>
                  </button>
              ))}
          </div>

          {/* Auth Button */}
          {currentUser ? (
              <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
                  <span className="text-slate-400 flex items-center gap-1"><User size={12}/> {currentUser}</span>
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