import React, { useState, useEffect } from 'react';
import { 
    Download, Zap, Brain, Target, ShieldCheck, 
    TrendingUp, Crosshair, Eye, Map, Cpu, 
    ScanEye, Activity, GitBranch, BarChart3,
    MousePointer2, Clock, CheckCircle2, Globe,
    LayoutDashboard, Home, Shield, Swords, History,
    Hammer, PieChart, AlertCircle, Award, Microscope,
    Users, MessageSquare, Layers, Lightbulb, Compass
} from 'lucide-react';

import HexCoreIcon from './HexCoreIcon';
import DownloadModal from './modals/DownloadModal'; 
import { Toaster, toast } from 'react-hot-toast';

const LandingPage = ({ onEnter, onOpenCommunity }) => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  useEffect(() => {
    document.title = "Hex Coach - 你的战术副官";
    return () => { document.title = "Hex Coach"; };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    // 🔥 [优化] 背景色调整为 Slate-900 风格
    <div className="w-full min-h-screen bg-[#0F172A] text-slate-200 overflow-x-hidden selection:bg-[#C8AA6E]/30 font-sans">
      <Toaster position="top-center" />
      
      <DownloadModal 
          isOpen={showDownloadModal} 
          onClose={() => setShowDownloadModal(false)} 
      />
      
      {/* === 1. 顶部导航栏 === */}
      {/* 🔥 [优化] 导航栏背景色同步 */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#0F172A]/90 backdrop-blur-md border-b border-white/5 transition-all duration-300 h-20">
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
                    Tactical Insight Partner
                </span>
            </div>
          </div>

          {/* B. 中间导航区 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex items-center gap-8">
            <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-2 text-[#C8AA6E] font-bold text-sm transition-colors relative"
            >
              <Home size={16}/> 理念
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
              <Globe size={16}/> 战术社区
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
                onClick={() => setShowDownloadModal(true)} 
                className="flex items-center gap-2 px-5 py-2 bg-[#C8AA6E] hover:bg-[#b39556] text-[#091428] font-black rounded-full transition-all shadow-lg hover:shadow-[#C8AA6E]/20 active:scale-95 text-xs md:text-sm group"
            >
                <Download size={16} strokeWidth={3} className="group-hover:translate-y-0.5 transition-transform" />
                <span>获取助手</span>
            </button>
          </div>
        </div>
      </nav>

      {/* === 2. Hero Section (主视觉) === */}
      <div className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        {/* 🔥 [优化] 顶部光晕颜色微调 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-[#1e293b] via-[#0F172A] to-transparent rounded-full blur-[100px] -z-10 opacity-80"></div>
        
        <div className="max-w-[1200px] mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase mb-6 animate-in fade-in slide-in-from-bottom-4">
              <Compass size={12} /> Your Tactical Second Sight
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.2] mb-6 drop-shadow-2xl">
              竞技充满不确定性，<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AC8B9] to-[#C8AA6E]">但你的思路可以保持清晰。</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              HexCoach 并非要替代你的操作，而是作为你的<span className="text-white font-bold">第二战术视角</span>。
              <br className="hidden md:block"/>
              我们将复杂的对线博弈与运营逻辑拆解清晰，
              <br className="hidden md:block"/>
              陪你在高压之下，依然保持<span className="text-[#C8AA6E] font-bold">理解、判断与尊严</span>。
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
                <button 
                  onClick={onEnter}
                  className="px-10 py-4 bg-gradient-to-r from-[#0AC8B9] to-[#08998c] text-[#091428] font-black rounded-xl shadow-[0_0_30px_rgba(10,200,185,0.3)] hover:shadow-[0_0_50px_rgba(10,200,185,0.5)] transition-all transform hover:-translate-y-1 flex items-center gap-3"
                >
                  <Cpu size={20} fill="currentColor"/> 开启战术分析
                </button>
                <button 
                  onClick={() => setShowDownloadModal(true)} 
                  className="px-10 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all flex items-center gap-3 backdrop-blur-sm hover:border-[#C8AA6E]/50 hover:text-[#C8AA6E]"
                >
                  <Download size={20}/> 下载连接助手
                </button>
            </div>
        </div>
      </div>

      {/* === 3. 核心价值 (2x2 Grid) === */}
      {/* 🔥 [优化] 背景色调整为 Slate-950 (更深一点) */}
      <div id="core-features" className="w-full bg-[#020617] py-24 border-t border-white/5 relative">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">不是代打，<span className="text-[#0AC8B9]">是赋能</span></h2>
            <p className="text-slate-400">填补意识差距，让你像职业选手一样思考。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 卡片 1: BP */}
            <div className="group bg-[#0F172A] p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all hover:-translate-y-2 relative overflow-hidden">
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
                <h3 className="text-xl font-bold text-white mb-2">BP 阵容解构</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    不仅推荐“强力英雄”，更分析<span className="text-blue-300">阵容结构</span>。AI 帮你理解克制关系与团队短板，选出最适合当前局势的拼图。
                </p>
                <div className="h-1 w-8 bg-blue-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 2: 对线 */}
            <div className="group bg-[#0F172A] p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all hover:-translate-y-2 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-4 group-hover:bg-purple-500/20 transition-colors">
                        <Lightbulb size={24} className="fill-current"/>
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-[#0AC8B9] border border-[#0AC8B9]/30 px-2 py-1 rounded bg-[#0AC8B9]/5">
                        LIVE
                    </span>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Target size={80} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">对线逻辑拆解</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    为什么这波能打？什么时候该怂？<br/>
                    AI 拆解关键技能交互与换血窗口，不仅告诉你“怎么做”，更让你理解“为什么”。
                </p>
                <div className="h-1 w-8 bg-purple-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 3: 局内 (Decision) */}
            <div className="group bg-[#0F172A] p-6 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-2 relative overflow-hidden opacity-90 hover:opacity-100">
                <div className="absolute top-4 right-[-35px] rotate-45 bg-slate-800 text-slate-400 text-[10px] font-bold px-10 py-1 shadow-lg border-y border-slate-700 z-10">
                    DEV
                </div>
                
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400 mb-4 group-hover:bg-orange-500/20 transition-colors">
                        <Compass size={24} />
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
                
                <h3 className="text-xl font-bold text-slate-300 mb-2 group-hover:text-orange-400 transition-colors">局势概率推演</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4 group-hover:text-slate-400 transition-colors">
                    基于兵线与经济差，计算不同决策的期望值。
                    <br/>拒绝盲目“逛街”，在迷茫时刻为你提供理性的战术参考。
                </p>
                <div className="h-1 w-8 bg-orange-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 4: 复盘 */}
            <div className="group bg-[#0F172A] p-6 rounded-2xl border border-white/5 hover:border-green-500/30 transition-all hover:-translate-y-2 relative overflow-hidden opacity-90 hover:opacity-100">
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
                
                <h3 className="text-xl font-bold text-slate-300 mb-2 group-hover:text-green-400 transition-colors">AI 深度复盘</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4 group-hover:text-slate-400 transition-colors">
                    在失败中寻找价值。
                    <br/>帮你区分“不可控因素”与“个人决策失误”，保留信心，从容改进。
                </p>
                <div className="h-1 w-8 bg-green-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

          </div>
        </div>
      </div>

      {/* === 4. 第一顺位：战术教练模块 (Coaching Module) === */}
      {/* 🔥 [优化] 背景色调整 */}
      <div id="coaching-module" className="w-full bg-[#0F172A] py-32 border-t border-white/5 relative overflow-hidden">
        {/* 背景装饰 (深蓝系) */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[100px] -z-10"></div>
        
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col lg:flex-row items-center gap-20">
            
            {/* 左侧：文案 (图右文左布局) */}
            <div className="flex-1 space-y-8">
                <div>
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0AC8B9]/10 border border-[#0AC8B9]/20 text-[#0AC8B9] text-xs font-bold uppercase">
                            <Zap size={12} /> 核心能力
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase">
                            <CheckCircle2 size={12} /> 已上线
                        </div>
                    </div>

                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                        线上细节拆解 <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#0AC8B9]">野区博弈规划</span>
                    </h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        不仅教你对线怎么赢，更教你野区怎么玩。
                        <br/>
                        HEX AI 像是一个时刻冷静的职业教练，为你拆解<span className="text-white font-bold">对线交互细节</span>，并为打野玩家提供<span className="text-[#0AC8B9] font-bold">路线规划 (Pathing)</span> 与 <span className="text-[#0AC8B9] font-bold">敌方动向追踪 (Tracking)</span>。
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* 模块 1：对线 */}
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-blue-400 shrink-0">
                            <Swords size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">对线博弈 (Lane)</h4>
                            <p className="text-xs text-slate-500">拆解英雄技能交互。教你何时换血是赚的，何时是在送机会，填补对线细节落差。</p>
                        </div>
                    </div>
                    
                    {/* 模块 2：打野 (新增/修改) */}
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-[#C8AA6E] shrink-0">
                            <Map size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">野区节奏 (Jungle)</h4>
                            <p className="text-xs text-slate-500">告别盲目刷野。基于双方打野定位，规划<span className="text-slate-300">最优开野路线</span>，预测敌方位置并提示反蹲。</p>
                        </div>
                    </div>

                    {/* 模块 3：团战 */}
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-red-400 shrink-0">
                            <Target size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">团战职责 (Role)</h4>
                            <p className="text-xs text-slate-500">明确你的首要目标：是该刺杀后排，还是保护己方C位？厘清混乱团战中的唯一任务。</p>
                        </div>
                    </div>

                    {/* 模块 4：阵容 */}
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-emerald-400 shrink-0">
                            <Layers size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">体系理解 (Comp)</h4>
                            <p className="text-xs text-slate-500">分析阵容获胜条件。是该执行“四一分推”拉扯，还是寻找机会“正面强开”？</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧：模拟演示界面 (内容更新为包含打野) */}
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

                    {/* 模拟 Tab (更新了 Tab 名称) */}
                    <div className="flex border-b border-white/5 bg-[#0e1117]">
                        <div className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors">⚔️ 线上私教</div>
                        <div className="px-4 py-2 text-xs font-bold text-[#0AC8B9] border-b-2 border-[#0AC8B9] bg-[#0AC8B9]/10">🌲 野区规划</div>
                        <div className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors">💥 团战思路</div>
                    </div>

                    {/* 模拟内容区 (更新为打野相关内容) */}
                    <div className="flex-1 p-5 space-y-4 bg-[#0a0c10] relative overflow-hidden">
                        
                        {/* 装饰网格 */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

                        {/* 卡片 1：开野规划 */}
                        <div className="bg-[#13161c] border border-white/5 p-3 rounded relative z-10">
                            <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase">Optimal Pathing</div>
                            <div className="flex justify-between items-center text-sm font-bold text-slate-200">
                                <span>🔄 推荐路线：速3抓下</span>
                                <span className="text-[#0AC8B9] text-xs">Win Rate +4%</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-400 leading-relaxed border-l-2 border-[#0AC8B9] pl-2">
                                <span className="text-white">红BUFF</span> → 石甲虫 → F6 → <span className="text-white">速3级</span>。
                                <br/>
                                <span className="text-slate-500 mt-1 block">逻辑：下路我方泰坦+莎弥拉，配合你（皇子）的EQ二连为必杀组合。放弃上路发育，主打下半区节奏。</span>
                            </div>
                        </div>

                        {/* 卡片 2：敌方追踪 */}
                        <div className="bg-[#13161c] border border-white/5 p-3 rounded relative z-10">
                             <div className="text-[10px] text-slate-500 mb-1 font-bold uppercase">Jungle Tracking</div>
                             <div className="text-sm font-bold text-slate-200 mb-1">👁️ 敌方盲僧动向预测</div>
                             <div className="flex items-center gap-3 mt-2">
                                 <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                     <div className="bg-red-500 w-[70%] h-full"></div>
                                 </div>
                                 <span className="text-[10px] text-red-400 font-bold whitespace-nowrap">入侵红区 (High)</span>
                             </div>
                             <p className="text-xs text-slate-400 mt-2">
                                 盲僧前期强势，大概率二级入侵你的红区。建议让辅助做防守眼，并保留惩戒用于拼抢。
                             </p>
                        </div>
                        
                        {/* 悬浮气泡 */}
                        <div className="absolute top-1/2 right-4 bg-yellow-600/20 border border-yellow-500/50 p-2 rounded shadow-lg backdrop-blur animate-pulse z-20">
                            <div className="text-[10px] font-bold text-yellow-300">Tempo Check</div>
                            <div className="text-xs text-white">控河蟹 {'>'}  Gank</div>
                        </div>

                    </div>
                </div>

                {/* 装饰光效 */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#0AC8B9] rounded-full blur-[100px] opacity-20"></div>
            </div>

        </div>
      </div>

      {/* === 5. 第二顺位：赛后复盘模块 (Post-Match Module) === */}
      {/* 🔥 [优化] 背景色调整 */}
      <div id="postmatch-module" className="w-full bg-[#020617] py-32 border-t border-white/5 relative overflow-hidden">
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
                                     <div className="text-5xl font-black text-white italic">A+</div>
                                     <div className="text-[10px] text-purple-400 font-bold tracking-widest mt-1">SOLID</div>
                                 </div>
                                 {/* 装饰环 */}
                                 <div className="absolute inset-0 border-t-4 border-purple-500 rounded-full animate-spin-slow"></div>
                             </div>
                         </div>

                         {/* 悬浮卡 1：决策分析 */}
                         <div className="absolute top-12 left-8 z-30 animate-in slide-in-from-left duration-1000 delay-200">
                             <div className="bg-[#0f0f16]/90 border-l-4 border-yellow-500 p-3 rounded-r-lg shadow-xl backdrop-blur w-64">
                                 <div className="flex items-center gap-2 mb-1">
                                     <Lightbulb size={14} className="text-yellow-500"/>
                                     <span className="text-xs font-bold text-yellow-100">复盘建议 (15:20)</span>
                                 </div>
                                 <p className="text-[10px] text-slate-400">此处大龙团站位稍显激进。如果保持在己方辅助身后，有更大机会在泰坦先手后存活并反打。</p>
                             </div>
                         </div>

                         {/* 悬浮卡 2：职业对比 */}
                         <div className="absolute bottom-12 right-8 z-30 animate-in slide-in-from-right duration-1000 delay-500">
                             <div className="bg-[#0f0f16]/90 border-l-4 border-[#0AC8B9] p-3 rounded-r-lg shadow-xl backdrop-blur w-56">
                                 <div className="flex items-center gap-2 mb-1">
                                     <Microscope size={14} className="text-[#0AC8B9]"/>
                                     <span className="text-xs font-bold text-[#0AC8B9]">数据对比 (同段位)</span>
                                 </div>
                                 <div className="space-y-1">
                                     <div className="flex justify-between text-[10px] text-slate-400">
                                         <span>分均补刀</span>
                                         <span className="text-white font-bold">8.2 <span className="text-[#0AC8B9]">(优秀)</span></span>
                                     </div>
                                     <div className="flex justify-between text-[10px] text-slate-400">
                                         <span>视野得分</span>
                                         <span className="text-white font-bold">12 <span className="text-yellow-400">(偏低)</span></span>
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
                        在复盘中 <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300">找回清晰与从容</span>
                    </h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        竞技游戏充满了不确定性。HexCoach 自动生成客观的复盘报告，
                        <br/>
                        帮你区分“运气不好”与“决策失误”，让你在每一次失败中都能获得实质性的成长，而不是挫败感。
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-purple-400 shrink-0">
                            <Award size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">多维表现评估</h4>
                            <p className="text-xs text-slate-500">综合操作、意识、发育、视野四大维度，给出客观的分析，告别单纯的KDA论英雄。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-red-400 shrink-0">
                            <AlertCircle size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">关键决策点</h4>
                            <p className="text-xs text-slate-500">回溯整场比赛的关键转折点。AI 会指出：如果在那个时刻做出了另一种选择，局势可能会如何变化。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-[#0AC8B9] shrink-0">
                            <Microscope size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">职业数据对比</h4>
                            <p className="text-xs text-slate-500">将你的核心数据与同段位高手及职业选手对比，精准定位需要提升的短板。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-pink-400 shrink-0">
                            <Target size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">成长路径建议</h4>
                            <p className="text-xs text-slate-500">基于近期表现，提供个性化的改进建议。“下周重点：提升防Gank意识与视野布控”。</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
      </div>

      {/* === 6. 第三顺位：局内决策引擎 (In-Game Module) === */}
      {/* 🔥 [优化] 背景色调整 */}
      <div id="ingame-module" className="w-full bg-[#0F172A] py-32 border-t border-white/5 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C8AA6E]/5 rounded-full blur-[120px] -z-10 opacity-50"></div>
        <div className="absolute inset-0 bg-[url('https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/magic-pattern-sprite.png')] opacity-[0.02] -z-10"></div>

        <div className="max-w-[1400px] mx-auto px-6 flex flex-col lg:flex-row items-center gap-20">
            
            {/* 左侧：文案与功能点 */}
            <div className="flex-1 space-y-8">
                <div>
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8AA6E]/10 border border-[#C8AA6E]/20 text-[#C8AA6E] text-xs font-bold uppercase">
                            <Clock size={12} /> 间歇期规划
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold uppercase">
                            <Hammer size={12} /> 开发中
                        </div>
                    </div>

                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                        拒绝泉水发呆 <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8AA6E] to-yellow-200">下一波战术规划</span>
                    </h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                        死亡或回城不是“垃圾时间”，而是思考的黄金窗口。
                        <br/>
                        当你打开商店或等待复活时，HexCoach 基于 LCU 数据快速分析当前局势，
                        <br/>
                        为你生成<span className="text-[#C8AA6E] font-bold">出门后的行动指南</span>。
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-green-400 shrink-0">
                            <Compass size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">出门去哪儿 (Next Move)</h4>
                            <p className="text-xs text-slate-500">“小龙还有50秒刷新，去中路推线占视野。” AI 帮你明确出门后的第一优先级。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-[#C8AA6E] shrink-0">
                            <Activity size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">关键装备博弈</h4>
                            <p className="text-xs text-slate-500">检测到敌方剑魔做出了“渴血”。AI 提示你：当前重伤装备优先级提升，切勿裸大件。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-red-400 shrink-0">
                            <Target size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">敌方技能计时</h4>
                            <p className="text-xs text-slate-500">趁着灰屏，确认敌方关键R技能和双招CD。这波团能不能接？数据说了算。</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#0F172A] rounded-lg border border-white/10 text-blue-400 shrink-0">
                            <Brain size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-1">翻盘点识别</h4>
                            <p className="text-xs text-slate-500">劣势局不盲目打团。AI 分析双方经济差，建议“避战发育”还是“抓单找机会”。</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧：模拟演示图 (Recall/Shop Interface) */}
            <div className="flex-1 relative w-full perspective-1000">
                <div className="relative z-10 bg-[#0f172a] rounded-xl border border-[#C8AA6E]/30 shadow-[0_0_80px_rgba(200,170,110,0.15)] overflow-hidden transform rotate-y-[-5deg] hover:rotate-0 transition-all duration-1000 ease-out p-1">
                    
                    {/* 模拟游戏背景（模糊的泉水/商店图） */}
                    <div className="w-full h-[400px] bg-[#0b0f19] relative overflow-hidden flex flex-col">
                        
                        {/* 顶部状态栏模拟 */}
                        <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-[#050505]/50">
                            <div className="text-[#C8AA6E] text-xs font-bold flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#C8AA6E] animate-pulse"></div>
                                RECALLING...
                            </div>
                            <div className="text-slate-500 text-xs font-mono">GAME TIME 18:42</div>
                        </div>

                        {/* 中间内容：战术板 */}
                        <div className="flex-1 p-6 flex flex-col gap-4 relative">
                            {/* 核心建议卡 */}
                            <div className="bg-[#1e293b]/80 border-l-4 border-[#C8AA6E] p-4 rounded-r-lg backdrop-blur-md animate-in slide-in-from-left duration-700">
                                <div className="flex items-center gap-2 mb-2">
                                    <Map size={16} className="text-[#C8AA6E]"/>
                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Next Objective</span>
                                </div>
                                <h3 className="text-xl font-black text-white mb-1">前往小龙坑 (Dragon Pit)</h3>
                                <p className="text-xs text-slate-400">
                                    听牌龙还有 <span className="text-[#C8AA6E] font-bold">45s</span> 刷新。敌方打野无闪现。
                                    <br/>建议：先做河道视野，逼迫对方接团。
                                </p>
                            </div>

                            {/* 装备建议卡 */}
                            <div className="flex gap-4">
                                <div className="flex-1 bg-[#1e293b]/80 border-t-2 border-red-500 p-3 rounded-b-lg backdrop-blur-md animate-in slide-in-from-bottom duration-700 delay-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Swords size={14} className="text-red-400"/>
                                        <span className="text-[10px] font-bold text-slate-300 uppercase">Threat Check</span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        敌方<span className="text-white font-bold">阿卡丽</span>发育超前
                                        <br/>建议补充：<span className="text-green-400 underline decoration-dotted">饮魔刀 / 秒表</span>
                                    </div>
                                </div>
                                <div className="flex-1 bg-[#1e293b]/80 border-t-2 border-blue-500 p-3 rounded-b-lg backdrop-blur-md animate-in slide-in-from-bottom duration-700 delay-300">
                                     <div className="flex items-center gap-2 mb-2">
                                        <GitBranch size={14} className="text-blue-400"/>
                                        <span className="text-[10px] font-bold text-slate-300 uppercase">Macro</span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        我方上路兵线优势
                                        <br/>决策：<span className="text-white font-bold">正面拉扯，等待分推</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 底部进度条 */}
                        <div className="h-1 w-full bg-slate-800 absolute bottom-0">
                            <div className="h-full bg-[#C8AA6E] w-[85%] animate-pulse"></div>
                        </div>
                    </div>
                </div>
                
                {/* 装饰元素 */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C8AA6E] rounded-full blur-[100px] opacity-10"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border border-[#C8AA6E]/5 rounded-xl -z-10 scale-105"></div>
            </div>
        </div>
      </div>

      {/* === 7. 技术与合规 (Tech Stack) - 删除了 CV 文案 === */}
      <div className="w-full bg-gradient-to-b from-[#091428] to-[#050810] py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto bg-[#020304] rounded-3xl border border-[#C8AA6E]/10 p-8 md:p-12 relative overflow-hidden">
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 mb-4 text-[#0AC8B9] font-mono text-xs font-bold tracking-wider">
                        <ShieldCheck size={14}/> SAFE & COMPLIANT
                    </div>
                    {/* 🔥 [优化] 文案修改：强调纯净数据流 */}
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                        LCU 官方接口 + <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AC8B9] to-blue-400">纯净数据流</span>
                    </h2>
                    <p className="text-slate-400 leading-relaxed mb-6">
                        我们严格遵守游戏公平性原则。HexCoach 采用非入侵式技术架构：
                        <br/>
                        1. 通过官方 **LCU 接口** 获取基础对局信息。
                        <br/>
                        2. 基于 **实时数据** 进行深度战术推演。
                        <br/>
                        <span className="text-white font-bold">绝不读取内存，绝不注入代码。</span> 我们不修改游戏数据，只是帮你更好地处理已有的信息。
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                        <span className="px-3 py-1 bg-white/5 rounded border border-white/10 text-xs text-slate-300 flex items-center gap-1"><ShieldCheck size={12}/> 0 封号风险</span>
                        <span className="px-3 py-1 bg-white/5 rounded border border-white/10 text-xs text-slate-300 flex items-center gap-1"><Activity size={12}/> 无感运行 Overlay</span>
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

      {/* 🔥 [位置调整] 共建理念板块移动到这里 */}
      <div className="w-full bg-[#040508] py-20 border-t border-white/5 relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-6 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-slate-400 text-xs font-bold uppercase mb-6">
                  <MessageSquare size={12} /> Community Driven
              </div>
              
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-6">
                  Hex Coach 不是一个 <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8AA6E] to-yellow-200">“永远正确”</span> 的系统
              </h2>
              
              <div className="text-slate-400 leading-relaxed text-sm md:text-base space-y-4 max-w-2xl mx-auto">
                  <p>
                      它在不断学习，也需要真实玩家的反馈。如果你发现 AI 的判断与实际对局存在明显偏差，
                      或你能给出更好的对局理解，我们欢迎你把这些反馈在社区分享出来。
                  </p>
                  <p className="text-slate-500 text-xs mt-4 pt-4 border-t border-white/5">
                      * 经过管理员审核的有效反馈，会获得额外的 <span className="text-[#0AC8B9]">模型使用次数</span> 或 <span className="text-[#C8AA6E]">会员时长</span> 奖励。
                  </p>
              </div>
          </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#020304] py-8 border-t border-white/5 text-center px-6">
        <p className="text-slate-600 text-xs">
            &copy; 2025 Hex Coach. <br/>
            辅助玩家成长，而非破坏游戏平衡。
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;