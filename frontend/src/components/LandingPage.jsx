import React, { useState, useEffect } from 'react';
import { 
    Download, Layers, Zap, Search, 
    Swords, Brain, Target, ShieldCheck, 
    TrendingUp, Crosshair, Eye, Map, Cpu, 
    ScanEye, Activity, GitBranch, BarChart3,
    MousePointer2, Clock, CheckCircle2, Globe
} from 'lucide-react';
import HexCoreIcon from './HexCoreIcon';
import { Toaster, toast } from 'react-hot-toast';

const LandingPage = ({ onEnter }) => {
  const [activeFeature, setActiveFeature] = useState(0);

  // 模拟轮播
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const scrollToFeatures = () => {
    document.getElementById('core-features')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToInGame = () => {
    document.getElementById('ingame-module')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNotReady = (featureName) => {
    toast(`${featureName} 正在加急建设中\n敬请期待！`, {
      icon: '🚧',
      style: {
        borderRadius: '8px',
        background: '#1e293b',
        color: '#fff',
        border: '1px solid #334155',
      },
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#06070a] text-slate-200 overflow-x-hidden selection:bg-[#C8AA6E]/30 font-sans">
      <Toaster position="top-center" />
      
      {/* === 1. 顶部导航栏 === */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#06070a]/90 backdrop-blur-md border-b border-white/5 transition-all duration-300">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-4 group cursor-pointer" onClick={onEnter}>
            <div className="relative">
              <HexCoreIcon className="w-10 h-10 md:w-12 md:h-12 text-[#0AC8B9] group-hover:scale-110 transition-transform duration-500 filter drop-shadow-[0_0_10px_rgba(10,200,185,0.5)]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl md:text-2xl font-black tracking-tighter text-white italic leading-none flex gap-1">
                HEX<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8AA6E] to-yellow-200">COACH</span>
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase group-hover:text-[#0AC8B9] transition-colors">
                AI Strategy Partner
              </span>
            </div>
          </div>

          {/* 中间导航 */}
          <div className="hidden lg:flex items-center gap-10 text-sm font-bold text-slate-400">
            <button onClick={scrollToFeatures} className="hover:text-white transition-colors flex items-center gap-2">
              <Layers size={16}/> 全能教练
            </button>
            <button onClick={scrollToInGame} className="hover:text-white transition-colors flex items-center gap-2 text-[#C8AA6E]">
              <ScanEye size={16}/> 局内决策黑科技
            </button>
            {/* 🟢 修改点：将“绿色合规”替换为“绝活社区”，并设为未开放状态 */}
            <button onClick={() => handleNotReady("绝活社区")} className="hover:text-white transition-colors flex items-center gap-2">
              <Globe size={16}/> 绝活社区
            </button>
          </div>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-4">
            <button 
                onClick={onEnter}
                className="hidden md:flex px-5 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-all text-xs font-bold text-slate-300 hover:text-white hover:border-[#0AC8B9]/50"
            >
                进入控制台
            </button>
            <button 
                onClick={() => handleNotReady("Windows 客户端")}
                className="flex items-center gap-2 px-5 py-2 bg-[#C8AA6E] hover:bg-[#b39556] text-[#091428] font-black rounded-full transition-all shadow-lg hover:shadow-[#C8AA6E]/20 active:scale-95 text-xs md:text-sm"
            >
                <Download size={16} strokeWidth={3} />
                <span>下载客户端</span>
            </button>
          </div>
        </div>
      </nav>

      {/* === 2. Hero Section (主视觉：全能教练定位) === */}
      <div className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        {/* 背景光效 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-[#0b1629] via-[#091428] to-transparent rounded-full blur-[100px] -z-10 opacity-80"></div>
        
        <div className="max-w-[1200px] mx-auto text-center relative z-10">
            {/* 标签 */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase mb-6 animate-in fade-in slide-in-from-bottom-4">
              <Brain size={12} /> Your Personal AI Coach
            </div>

            {/* 主标题 */}
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.1] mb-6 drop-shadow-2xl">
              你的全能 <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0AC8B9] to-[#C8AA6E]">AI 战术教练</span><br/>
              从 BP 到基地爆炸
            </h1>
            
            {/* 副标题 */}
            <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              HexCoach 为你提供职业级的 <span className="text-white font-bold">BP博弈</span>、
              <span className="text-white font-bold">对线私教</span> 与 
              <span className="text-white font-bold">团队指挥</span>。
              <br className="hidden md:block"/>
              更有独家 <span className="text-[#C8AA6E] font-bold">局内实时决策引擎</span>，
              像开了全图一样洞悉局势，精准计算每一步胜率。
            </p>

            {/* 核心开始按钮 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
                <button 
                  onClick={onEnter}
                  className="px-10 py-4 bg-gradient-to-r from-[#0AC8B9] to-[#08998c] text-[#091428] font-black rounded-xl shadow-[0_0_30px_rgba(10,200,185,0.3)] hover:shadow-[0_0_50px_rgba(10,200,185,0.5)] transition-all transform hover:-translate-y-1 flex items-center gap-3"
                >
                  <Cpu size={20} fill="currentColor"/> 启动 AI 教练
                </button>
                <button 
                  onClick={scrollToInGame}
                  className="px-10 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all flex items-center gap-3 backdrop-blur-sm"
                >
                  <Eye size={20}/> 探索局内黑科技
                </button>
            </div>
        </div>
      </div>

      {/* === 3. 核心教练功能 (赛前/赛后/私教) === */}
      <div id="core-features" className="w-full bg-[#030406] py-24 border-t border-white/5 relative">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">全方位 <span className="text-[#0AC8B9]">执教体系</span></h2>
            <p className="text-slate-400">我们不只是数据工具，而是能陪你成长的导师。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 卡片 1: BP */}
            <div className="group bg-[#091428] p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all hover:-translate-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Swords size={80} />
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-4 group-hover:bg-blue-500/20 transition-colors">
                    <MousePointer2 size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">赛前 BP 智谋</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    AI 深度分析敌我英雄池，推荐最佳 <span className="text-blue-300">Counter</span> 选角与符文配置。在泉水门口就赢下一半，不仅是选人，更是心理博弈。
                </p>
                <div className="h-1 w-8 bg-blue-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 2: 1v1 私教 */}
            <div className="group bg-[#091428] p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all hover:-translate-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Target size={80} />
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-4 group-hover:bg-purple-500/20 transition-colors">
                    <Zap size={24} className="fill-current"/>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">1V1 王者私教</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    专精对线细节。一级学什么？三级能否单杀？回家出什么装备最克制对手？<br/>
                    AI 结合千万高分录像，指导你处理每一个换血细节。
                </p>
                <div className="h-1 w-8 bg-purple-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 3: 团队指挥 */}
            <div className="group bg-[#091428] p-6 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all hover:-translate-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Brain size={80} />
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400 mb-4 group-hover:bg-orange-500/20 transition-colors">
                    <TrendingUp size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">团队策略指挥</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    从个人到团队。AI 分析阵容强势期，提示你何时该游走、何时该换线拿塔。拒绝迷茫，你就是团队的 <span className="text-orange-300">战术大脑</span>。
                </p>
                <div className="h-1 w-8 bg-orange-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

            {/* 卡片 4: 赛后复盘 */}
            <div className="group bg-[#091428] p-6 rounded-2xl border border-white/5 hover:border-green-500/30 transition-all hover:-translate-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Clock size={80} />
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400 mb-4 group-hover:bg-green-500/20 transition-colors">
                    <BarChart3 size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">赛后深度复盘</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    赢要赢得明白，输要输得清楚。不只是 KDA，我们分析关键团战站位与技能释放，指出失误点，助你<span className="text-green-300">打破瓶颈</span>。
                </p>
                <div className="h-1 w-8 bg-green-500 rounded-full group-hover:w-full transition-all duration-500"></div>
            </div>

          </div>
        </div>
      </div>

      {/* === 4. 新模块：局内决策引擎 (In-Game Module) === */}
      <div id="ingame-module" className="w-full bg-[#020304] py-32 border-t border-white/5 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C8AA6E]/5 rounded-full blur-[120px] -z-10 opacity-50"></div>
        <div className="absolute inset-0 bg-[url('https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/magic-pattern-sprite.png')] opacity-[0.02] -z-10"></div>

        <div className="max-w-[1400px] mx-auto px-6 flex flex-col lg:flex-row items-center gap-20">
            
            {/* 左侧：文案与功能点 */}
            <div className="flex-1 space-y-8">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8AA6E]/10 border border-[#C8AA6E]/20 text-[#C8AA6E] text-xs font-bold uppercase mb-4">
                        <ScanEye size={12} /> Exclusive Feature
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

      {/* === 5. 技术与合规 (Tech Stack) === */}
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