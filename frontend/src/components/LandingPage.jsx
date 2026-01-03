import React, { useState, useEffect } from 'react';
import { 
    Download, Zap, Brain, Target, ShieldCheck, 
    TrendingUp, Crosshair, Eye, Map, Cpu, 
    ScanEye, Activity, GitBranch, BarChart3,
    MousePointer2, Clock, CheckCircle2, Globe,
    LayoutDashboard, Home, Shield, Swords, History,
    Hammer, PieChart, AlertCircle, Award, Microscope,
    Users, MessageSquare, Layers 
} from 'lucide-react';

import HexCoreIcon from './HexCoreIcon';
import DownloadModal from './modals/DownloadModal'; // 🔥 引入统一的下载弹窗
import { Toaster, toast } from 'react-hot-toast';

const LandingPage = ({ onEnter, onOpenCommunity }) => {
  const [activeFeature, setActiveFeature] = useState(0);
  
  // 🔥 管理本地下载弹窗状态
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // 1. 设置浏览器标签页标题
  useEffect(() => {
    document.title = "Hex Coach - AI 全能战术教练";
    return () => { document.title = "Hex Coach"; };
  }, []);

  // 模拟轮播
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#06070a] text-slate-200 overflow-x-hidden selection:bg-[#C8AA6E]/30 font-sans">
      <Toaster position="top-center" />
      
      {/* 🔥 挂载下载弹窗 */}
      <DownloadModal 
          isOpen={showDownloadModal} 
          onClose={() => setShowDownloadModal(false)} 
      />
      
      {/* === 1. 顶部导航栏 === */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#06070a]/90 backdrop-blur-md border-b border-white/5 transition-all duration-300 h-20">
        <div className="max-w-[1800px] mx-auto px-6 h-full flex items-center justify-between">
          
          {/* A. 左侧 Logo 区 */}
          <div 
            className="flex items-center gap-4 cursor-pointer group select-none" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative">
                <HexCoreIcon className="w-10 h-10 text-[#0AC8B9] group-hover:rotate-180 transition-transform duration-700 filter drop-shadow-[0_0_10px_rgba(10,200,185,0.5)]" />
                <div className="absolute inset-0 bg-[#0AC8B9] blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            </div>
            
            <div className="hidden md:flex flex-col justify-center">
                <div className="flex items-baseline gap-1">
                    <h1 className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-blue-500">
                        海克斯
                    </h1>
                    <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">
                        教练
                    </h1>
                </div>
                <span className="text-[9px] font-mono font-bold tracking-[0.3em] text-slate-500 uppercase group-hover:text-cyan-400 transition-colors">
                    AI STRATEGY PARTNER
                </span>
            </div>
          </div>

          {/* B. 中间导航区 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex items-center gap-8">
            <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-2 text-[#C8AA6E] font-bold text-sm transition-colors relative"
            >
              <Home size={16}/> 首页
              <div className="absolute bottom-[-29px] left-0 w-full h-[2px] bg-[#C8AA6E] shadow-[0_0_10px_#C8AA6E]"></div>
            </button>
            
            <button 
                onClick={onEnter} 
                className="flex items-center gap-2 text-slate-400 hover:text-white font-medium text-sm transition-colors group hover:text-[#0AC8B9]"
            >
              <LayoutDashboard size={16}/> 主控台
            </button>
            
            <button 
                onClick={onOpenCommunity} 
                className="flex items-center gap-2 text-slate-400 hover:text-white font-medium text-sm transition-colors group"
            >
              <Globe size={16}/> 绝活社区
            </button>
          </div>

          {/* C. 右侧功能区 */}
          <div className="flex items-center gap-4">
            <button 
                onClick={onEnter}
                className="hidden md:flex px-5 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-all text-xs font-bold text-slate-300 hover:text-white hover:border-[#0AC8B9]/50"
            >
                进入控制台
            </button>
            <button 
                onClick={() => setShowDownloadModal(true)} // 🔥 绑定弹窗
                className="flex items-center gap-2 px-5 py-2 bg-[#C8AA6E] hover:bg-[#b39556] text-[#091428] font-black rounded-full transition-all shadow-lg hover:shadow-[#C8AA6E]/20 active:scale-95 text-xs md:text-sm group"
            >
                <Download size={16} strokeWidth={3} className="group-hover:translate-y-0.5 transition-transform" />
                <span>下载连接助手</span>
            </button>
          </div>
        </div>
      </nav>

      {/* === 2. Hero Section (主视觉) === */}
      <div className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-[#0b1629] via-[#091428] to-transparent rounded-full blur-[100px] -z-10 opacity-80"></div>
        
        <div className="max-w-[1200px] mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase mb-6 animate-in fade-in slide-in-from-bottom-4">
              <Brain size={12} /> Your Personal AI Coach
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.1] mb-6 drop-shadow-2xl">
              你的全能 <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AC8B9] to-[#C8AA6E]">AI 战术教练</span><br/>
              从 BP 到基地爆炸
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              HexCoach 为你提供职业级的 <span className="text-white font-bold">BP博弈</span>、
              <span className="text-white font-bold">对线私教</span> 与 
              <span className="text-white font-bold">团队指挥</span>。
              <br className="hidden md:block"/>
              更有独家 <span className="text-[#C8AA6E] font-bold">局内实时决策引擎</span>，
              像开了全图一样洞悉局势，精准计算每一步胜率。
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
                <button 
                  onClick={onEnter}
                  className="px-10 py-4 bg-gradient-to-r from-[#0AC8B9] to-[#08998c] text-[#091428] font-black rounded-xl shadow-[0_0_30px_rgba(10,200,185,0.3)] hover:shadow-[0_0_50px_rgba(10,200,185,0.5)] transition-all transform hover:-translate-y-1 flex items-center gap-3"
                >
                  <Cpu size={20} fill="currentColor"/> 启动 AI 教练
                </button>
                <button 
                  onClick={() => setShowDownloadModal(true)} // 🔥 绑定弹窗
                  className="px-10 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all flex items-center gap-3 backdrop-blur-sm hover:border-[#C8AA6E]/50 hover:text-[#C8AA6E]"
                >
                  <Download size={20}/> 下载连接助手
                </button>
            </div>
        </div>
      </div>

      {/* === 3. 核心教练功能 (2x2 Grid) === */}
      <div id="core-features" className="w-full bg-[#030406] py-24 border-t border-white/5 relative">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">全方位 <span className="text-[#0AC8B9]">执教体系</span></h2>
            <p className="text-slate-400">我们不只是数据工具，而是能陪你成长的导师。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 卡片 1: BP (LIVE) */}
            <div className="group bg-[#091428] p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all hover:-translate-y-2 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-4 group-hover:bg-blue-500/20 transition-colors">
                        <MousePointer2 size={24} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-[#0AC8B9] border border-[#0AC8B9]/30 px-2 py-1 rounded bg-[#0AC8B9]/5">
                        LIVE
                    </span>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Swords size={80} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">赛前 BP 智谋</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    AI 深度分析敌我英雄池，推荐最佳 <span className="text-blue-300">Counter</span> 选角与符文配置。在泉水门口就赢下一半，不仅是选人，更是心理博弈。
                </p>
                <div className="h-1 w-8 bg-blue-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 2: 1v1 私教 (LIVE) */}
            <div className="group bg-[#091428] p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all hover:-translate-y-2 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-4 group-hover:bg-purple-500/20 transition-colors">
                        <Zap size={24} className="fill-current"/>
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-[#0AC8B9] border border-[#0AC8B9]/30 px-2 py-1 rounded bg-[#0AC8B9]/5">
                        LIVE
                    </span>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Target size={80} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">1V1 王者私教</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    专精对线细节。一级学什么？三级能否单杀？回家出什么装备最克制对手？<br/>
                    AI 结合千万高分录像，指导你处理每一个换血细节。
                </p>
                <div className="h-1 w-8 bg-purple-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 3: 局内决策 (Coming Soon) */}
            <div className="group bg-[#091428] p-6 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-2 relative overflow-hidden opacity-90 hover:opacity-100">
                <div className="absolute top-4 right-[-35px] rotate-45 bg-slate-800 text-slate-400 text-[10px] font-bold px-10 py-1 shadow-lg border-y border-slate-700 z-10">
                    DEV
                </div>
                
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400 mb-4 group-hover:bg-orange-500/20 transition-colors">
                        <Brain size={24} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-slate-500 border border-slate-700 px-2 py-1 rounded flex items-center gap-1.5 bg-slate-900/50">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-500"></span>
                        </span>
                        开发中
                    </span>
                </div>
                
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp size={80} />
                </div>
                
                <h3 className="text-xl font-bold text-slate-300 mb-2 group-hover:text-orange-400 transition-colors">局内实时决策</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4 group-hover:text-slate-400 transition-colors">
                    基于实时经济差与兵线位置，AI 动态指挥运营决策。
                    <br/>“现在该换线推塔，还是集结拿龙？” —— AI 教练将在游戏中直接给出最优解。
                </p>
                <div className="h-1 w-8 bg-orange-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 4: 赛后复盘 (Coming Soon) */}
            <div className="group bg-[#091428] p-6 rounded-2xl border border-white/5 hover:border-green-500/30 transition-all hover:-translate-y-2 relative overflow-hidden opacity-90 hover:opacity-100">
                <div className="absolute top-4 right-[-35px] rotate-45 bg-slate-800 text-slate-400 text-[10px] font-bold px-10 py-1 shadow-lg border-y border-slate-700 z-10">
                    DEV
                </div>

                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400 mb-4 group-hover:bg-green-500/20 transition-colors">
                        <History size={24} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-slate-500 border border-slate-700 px-2 py-1 rounded flex items-center gap-1.5 bg-slate-900/50">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-500"></span>
                        </span>
                        开发中
                    </span>
                </div>

                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BarChart3 size={80} />
                </div>
                
                <h3 className="text-xl font-bold text-slate-300 mb-2 group-hover:text-green-400 transition-colors">AI 局后复盘</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4 group-hover:text-slate-400 transition-colors">
                    比赛结束后自动生成多维度评分报告。
                    <br/>指出关键失误点（如：未惩戒跑车、团战走位失误）并提供<span className="text-slate-400 underline decoration-slate-600 underline-offset-2">王者级修正方案</span>。
                </p>
                <div className="h-1 w-8 bg-green-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

          </div>
        </div>
      </div>

      {/* === 4. 第一顺位：战术教练模块 (Coaching Module) === */}
      <div id="coaching-module" className="w-full bg-[#030508] py-32 border-t border-white/5 relative overflow-hidden">
        {/* 背景装饰 (深蓝系) */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[100px] -z-10"></div>
        
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col lg:flex-row items-center gap-20">
            
            {/* 左侧：文案 (图右文左布局) */}
            <div className="flex-1 space-y-8">
                <div>
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0AC8B9]/10 border border-[#0AC8B9]/20 text-[#0AC8B9] text-xs font-bold uppercase">
                            <Zap size={12} /> 核心功能
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase">
                            <CheckCircle2 size={12} /> 已上线
                        </div>
                    </div>

                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                        1V1 私教 & <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#0AC8B9]">团队指挥大脑</span>
                    </h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        基于 HEX AI 深度思考模型，提供从对线细节到大局运营的全维度指导。
                        <br/>
                        无论你是想打爆一路，还是想作为指挥带领队伍翻盘，这里都有你需要的战术锦囊。
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-blue-400 shrink-0">
                            <Swords size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">对线博弈 (Personal Lane)</h4>
                            <p className="text-xs text-slate-500">分析技能交互与兵线理解。教你何时换血、何时控线、如何规避关键控制。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-[#C8AA6E] shrink-0">
                            <Map size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">宏观运营 (Macro)</h4>
                            <p className="text-xs text-slate-500">中期去哪发育？何时抱团？AI 实时计算最优转线策略，拒绝无效逛街。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-red-400 shrink-0">
                            <Target size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">团战解构 (Teamfight)</h4>
                            <p className="text-xs text-slate-500">明确首要集火目标与潜在威胁。模拟团战画面，拆解敌方关键 Combo。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-emerald-400 shrink-0">
                            <Layers size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">体系克制 (Team Comp)</h4>
                            <p className="text-xs text-slate-500">分析双方阵容优劣势与获胜条件。制定“四一分推”或“正面强开”等战略方针。</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧：模拟演示界面 */}
            <div className="flex-1 relative w-full perspective-1000 group">
                <div className="relative z-10 bg-[#0a0c10] rounded-xl border border-[#0AC8B9]/30 shadow-[0_0_80px_rgba(10,200,185,0.1)] overflow-hidden transform rotate-y-[-5deg] group-hover:rotate-0 transition-all duration-1000 ease-out flex flex-col h-[450px]">
                    
                    {/* 模拟 Header */}
                    <div className="h-10 border-b border-white/5 bg-[#0e1117] flex items-center px-4 gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                        </div>
                        <div className="ml-4 text-[10px] text-slate-500 font-mono bg-black/30 px-2 py-0.5 rounded">HexCoach Analysis Core</div>
                    </div>

                    {/* 模拟 Tab */}
                    <div className="flex border-b border-white/5 bg-[#0e1117]">
                        <div className="px-4 py-2 text-xs font-bold text-[#0AC8B9] border-b-2 border-[#0AC8B9] bg-[#0AC8B9]/10">⚔️ 对线期博弈</div>
                        <div className="px-4 py-2 text-xs font-bold text-slate-500">🗺️ 宏观运营</div>
                        <div className="px-4 py-2 text-xs font-bold text-slate-500">💥 团战解构</div>
                    </div>

                    {/* 模拟内容区 */}
                    <div className="flex-1 p-5 space-y-4 bg-[#0a0c10] relative overflow-hidden">
                        
                        {/* 装饰网格 */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

                        {/* 卡片 1 */}
                        <div className="bg-[#13161c] border border-white/5 p-3 rounded relative z-10">
                            <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase">Critical Matchup</div>
                            <div className="flex justify-between items-center text-sm font-bold text-slate-200">
                                <span>⚡ 关键技能交互</span>
                                <span className="text-[#0AC8B9] text-xs">Priority High</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 space-y-1">
                                <div className="flex justify-between border-b border-white/5 pb-1">
                                    <span>诺手 Q (外圈刮)</span>
                                    <span className="text-white">向内侧身位移动规避</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span>剑姬 W (劳伦特心眼刀)</span>
                                    <span className="text-white">用于抵挡诺手 E 拉回</span>
                                </div>
                            </div>
                        </div>

                        {/* 卡片 2 */}
                        <div className="bg-[#13161c] border border-white/5 p-3 rounded relative z-10">
                             <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase">Wave Strategy</div>
                             <div className="text-sm font-bold text-slate-200 mb-1">🌊 兵线策略：控线发育</div>
                             <p className="text-xs text-slate-400 leading-relaxed">
                                 当前打野在下半区，上路保持兵线在塔前 1/3 处。切勿盲目推线，防止被抓。
                             </p>
                        </div>
                        
                        {/* 悬浮气泡 1 */}
                        <div className="absolute top-1/2 right-4 bg-blue-600/20 border border-blue-500/50 p-2 rounded shadow-lg backdrop-blur animate-pulse z-20">
                            <div className="text-[10px] font-bold text-blue-300">Win Condition</div>
                            <div className="text-xs text-white">单带牵制</div>
                        </div>

                    </div>
                </div>

                {/* 装饰光效 */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#0AC8B9] rounded-full blur-[100px] opacity-20"></div>
            </div>

        </div>
      </div>

      {/* === 5. 第二顺位：赛后复盘模块 (Post-Match Module) === */}
      <div id="postmatch-module" className="w-full bg-[#04060C] py-32 border-t border-white/5 relative overflow-hidden">
        {/* 背景装饰 (紫色系) */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-[120px] -z-10"></div>
        
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col-reverse lg:flex-row items-center gap-20">
            
            {/* 左侧：视觉演示 (反转布局，图在左) */}
            <div className="flex-1 relative w-full perspective-1000 group">
                 <div className="relative z-10 bg-[#0e0e14] rounded-xl border border-purple-500/30 shadow-[0_0_80px_rgba(168,85,247,0.1)] overflow-hidden transform rotate-y-[5deg] group-hover:rotate-0 transition-all duration-1000 ease-out p-1">
                    
                    {/* 模拟分析界面 */}
                    <div className="w-full h-[400px] bg-[#131b2e] relative overflow-hidden flex items-center justify-center">
                         <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                         
                         {/* 核心评分卡 */}
                         <div className="relative z-20 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-700">
                             <div className="w-40 h-40 rounded-full border-4 border-purple-500/30 flex items-center justify-center relative shadow-[0_0_50px_rgba(168,85,247,0.4)] bg-[#0f0f16]/80 backdrop-blur">
                                 <div className="text-center">
                                     <div className="text-5xl font-black text-white italic">S+</div>
                                     <div className="text-[10px] text-purple-400 font-bold tracking-widest mt-1">CARRY</div>
                                 </div>
                                 {/* 装饰环 */}
                                 <div className="absolute inset-0 border-t-4 border-purple-500 rounded-full animate-spin-slow"></div>
                             </div>
                         </div>

                         {/* 悬浮卡 1：失误分析 */}
                         <div className="absolute top-12 left-8 z-30 animate-in slide-in-from-left duration-1000 delay-200">
                             <div className="bg-[#0f0f16]/90 border-l-4 border-red-500 p-3 rounded-r-lg shadow-xl backdrop-blur w-56">
                                 <div className="flex items-center gap-2 mb-1">
                                     <AlertCircle size={14} className="text-red-500"/>
                                     <span className="text-xs font-bold text-red-100">关键失误 (15:20)</span>
                                 </div>
                                 <p className="text-[10px] text-slate-400">大龙团前站位过于激进，导致被敌方泰坦先手。</p>
                                 <div className="mt-2 text-[9px] text-red-400 font-mono border border-red-500/20 px-1 py-0.5 rounded w-fit">胜率影响 -15%</div>
                             </div>
                         </div>

                         {/* 悬浮卡 2：职业对比 */}
                         <div className="absolute bottom-12 right-8 z-30 animate-in slide-in-from-right duration-1000 delay-500">
                             <div className="bg-[#0f0f16]/90 border-l-4 border-[#0AC8B9] p-3 rounded-r-lg shadow-xl backdrop-blur w-56">
                                 <div className="flex items-center gap-2 mb-1">
                                     <Microscope size={14} className="text-[#0AC8B9]"/>
                                     <span className="text-xs font-bold text-[#0AC8B9]">职业对比 (Faker)</span>
                                 </div>
                                 <div className="space-y-1">
                                     <div className="flex justify-between text-[10px] text-slate-400">
                                         <span>分均补刀</span>
                                         <span className="text-white font-bold">9.2 <span className="text-[#0AC8B9]">(+0.5)</span></span>
                                     </div>
                                     <div className="flex justify-between text-[10px] text-slate-400">
                                         <span>参团率</span>
                                         <span className="text-white font-bold">68% <span className="text-red-400">(-5%)</span></span>
                                     </div>
                                 </div>
                             </div>
                         </div>

                    </div>
                 </div>
                 
                 {/* 装饰光效 */}
                 <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-600 rounded-full blur-[100px] opacity-20"></div>
            </div>

            {/* 右侧：文案 */}
            <div className="flex-1 space-y-8">
                <div>
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase">
                            <PieChart size={12} /> 数据洞察
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold uppercase">
                            <Hammer size={12} /> 开发中
                        </div>
                    </div>

                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                        AI 深度 <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300">赛后复盘分析</span>
                    </h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        这就是你的私人分析师。比赛结束后，HexCoach 自动生成多维度评分报告，逐帧分析你的操作与决策。
                        <br/>
                        <span className="text-purple-300">“这波该不该打？为什么输了？”</span> —— 我们给你最客观的答案和改进建议。
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-purple-400 shrink-0">
                            <Award size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">多维评分系统</h4>
                            <p className="text-xs text-slate-500">综合操作、意识、发育、视野四大维度，给出客观的 S/A/B 评级，告别“SVP”假象。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-red-400 shrink-0">
                            <AlertCircle size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">关键失误回溯</h4>
                            <p className="text-xs text-slate-500">精准定位导致崩盘的“犯罪时刻”。AI 告诉你如果当时怎么做，结局会完全不同。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-[#0AC8B9] shrink-0">
                            <Microscope size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">职业数据对比</h4>
                            <p className="text-xs text-slate-500">将你的数据与同段位职业选手对比。找出你与 Faker 在补刀节奏上的真实差距。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-pink-400 shrink-0">
                            <Target size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">定制提分计划</h4>
                            <p className="text-xs text-slate-500">基于近期表现，为你生成专属训练计划。“下周重点练习：防Gank意识”。</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
      </div>

      {/* === 6. 第三顺位：局内决策引擎 (In-Game Module) === */}
      <div id="ingame-module" className="w-full bg-[#020304] py-32 border-t border-white/5 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C8AA6E]/5 rounded-full blur-[120px] -z-10 opacity-50"></div>
        <div className="absolute inset-0 bg-[url('https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/magic-pattern-sprite.png')] opacity-[0.02] -z-10"></div>

        <div className="max-w-[1400px] mx-auto px-6 flex flex-col lg:flex-row items-center gap-20">
            
            {/* 左侧：文案与功能点 */}
            <div className="flex-1 space-y-8">
                <div>
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8AA6E]/10 border border-[#C8AA6E]/20 text-[#C8AA6E] text-xs font-bold uppercase">
                            <ScanEye size={12} /> 独家功能
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold uppercase">
                            <Hammer size={12} /> 开发中
                        </div>
                    </div>

                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                        局内实时 <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8AA6E] to-yellow-200">决策推演引擎</span>
                    </h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        这不仅仅是“野区追踪”。HexCoach 利用 CV 视觉技术，结合 LCU 数据，实时构建<span className="text-white font-bold">局势概率模型</span>。
                        <br/>
                        AI 会综合判断兵线、状态、敌方动向，告诉你<span className="text-[#C8AA6E]">“现在做什么胜率最高”</span>。
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-red-400 shrink-0">
                            <Map size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">动态野区追踪</h4>
                            <p className="text-xs text-slate-500">不只看刷野数。结合露头时间与移动速度，精准预测敌方打野坐标与Gank意图。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-green-400 shrink-0">
                            <TrendingUp size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">兵线态势分析</h4>
                            <p className="text-xs text-slate-500">识别回推线、慢推线。AI 告诉你哪一路兵线最适合越塔，哪一路容易被抓。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-blue-400 shrink-0">
                            <Activity size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">敌我状态评估</h4>
                            <p className="text-xs text-slate-500">计算技能CD、双招情况与装备差距。量化当前的击杀成功率，拒绝“送人头”。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#091428] rounded-lg border border-white/10 text-[#C8AA6E] shrink-0">
                            <GitBranch size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">决策胜率计算</h4>
                            <p className="text-xs text-slate-500">"抓上胜率 85%，反野胜率 40%"。用数据说话，做最理性的决策机器。</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧：模拟演示图 (Decision Matrix) */}
            <div className="flex-1 relative w-full perspective-1000">
                <div className="relative z-10 bg-[#0f172a] rounded-xl border border-[#C8AA6E]/30 shadow-[0_0_80px_rgba(200,170,110,0.15)] overflow-hidden transform rotate-y-[-5deg] hover:rotate-0 transition-all duration-1000 ease-out p-1">
                    
                    {/* 模拟地图层 */}
                    <div className="w-full h-[400px] bg-[#131b2e] relative overflow-hidden">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                        
                        {/* 悬浮窗示例 1: 决策卡 */}
                        <div className="absolute top-10 right-10 z-20 flex flex-col gap-3 animate-in slide-in-from-right duration-1000">
                            <div className="bg-[#050505]/90 backdrop-blur border-l-4 border-[#C8AA6E] p-4 rounded-r-lg shadow-2xl w-80">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[#C8AA6E] text-xs font-black flex items-center gap-1.5 uppercase tracking-wider">
                                        <Brain size={14}/> 最佳决策推荐
                                    </span>
                                    <span className="bg-[#C8AA6E]/20 text-[#C8AA6E] text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                                        WIN RATE +12%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                    <h3 className="text-white font-bold text-lg">立即 Gank 上路</h3>
                                    <span className="text-green-400 font-black text-2xl">94<span className="text-xs">%</span></span>
                                </div>
                                {/* 决策因子 */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 text-slate-400"><TrendingUp size={12}/> 兵线状态</span>
                                        <span className="text-green-400 font-bold flex items-center gap-1"><CheckCircle2 size={10}/> 回推线 (完美)</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 text-slate-400"><Activity size={12}/> 敌方状态</span>
                                        <span className="text-yellow-400 font-bold">半血 · 无闪现</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 text-slate-400"><Map size={12}/> 敌方打野</span>
                                        <span className="text-slate-500 font-bold">露头下路 (安全)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 悬浮窗示例 2: 追踪卡 */}
                        <div className="absolute bottom-10 left-10 z-20 animate-in slide-in-from-left duration-1000 delay-300">
                             <div className="bg-[#050505]/80 backdrop-blur border border-red-500/30 p-3 rounded-lg shadow-xl w-64">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-red-400 text-xs font-bold uppercase">敌方打野动向</span>
                                </div>
                                <p className="text-white text-sm font-bold">正在入侵我方蓝区</p>
                                <div className="w-full bg-slate-800 h-1 mt-2 rounded-full overflow-hidden">
                                    <div className="bg-red-500 h-full w-3/4"></div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1 text-right">置信度 85%</p>
                             </div>
                        </div>

                    </div>
                </div>
                
                {/* 装饰元素 */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C8AA6E] rounded-full blur-[100px] opacity-20"></div>
                <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-[#0AC8B9] rounded-full blur-[120px] opacity-20"></div>
            </div>
        </div>
      </div>

      {/* === 7. 技术与合规 (Tech Stack) === */}
      <div className="w-full bg-gradient-to-b from-[#091428] to-[#050810] py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto bg-[#020304] rounded-3xl border border-[#C8AA6E]/10 p-8 md:p-12 relative overflow-hidden">
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 mb-4 text-[#0AC8B9] font-mono text-xs font-bold tracking-wider">
                        <ShieldCheck size={14}/> 100% SAFE & COMPLIANT
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                        LCU 桥接 + <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AC8B9] to-blue-400">CV 视觉感知</span>
                    </h2>
                    <p className="text-slate-400 leading-relaxed mb-6">
                        我们深知账号安全的重要性。HexCoach 采用先进的混合架构：
                        <br/>
                        1. 通过官方 **LCU 接口** 获取基础数据。
                        <br/>
                        2. 结合 **CV 计算机视觉** 识别屏幕公开信息（如计分板、小地图）。
                        <br/>
                        <span className="text-white font-bold">绝不读取内存，绝不注入代码。</span> 这不是外挂，这是你的第二大脑。
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                        <span className="px-3 py-1 bg-white/5 rounded border border-white/10 text-xs text-slate-300 flex items-center gap-1"><ShieldCheck size={12}/> 0 封号风险</span>
                        <span className="px-3 py-1 bg-white/5 rounded border border-white/10 text-xs text-slate-300 flex items-center gap-1"><Activity size={12}/> 无掉帧 Overlay</span>
                    </div>
                </div>
                
                {/* 示意图 */}
                <div className="w-full md:w-1/3 flex justify-center">
                    <div className="relative animate-pulse-slow">
                        <HexCoreIcon className="w-32 h-32 text-[#0AC8B9] opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Cpu size={40} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#020304] py-8 border-t border-white/5 text-center px-6">
        <p className="text-slate-600 text-xs">
            &copy; 2025 Hex Coach. <br/>
            仅供学习与辅助，请勿用于破坏游戏平衡。
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;