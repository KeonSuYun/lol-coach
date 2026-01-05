import React, { useState } from 'react';
import { X, Crown, Zap, CheckCircle2, Gem, MessageCircle, AlertTriangle, Copy, Check, ExternalLink, Star } from 'lucide-react';
import { toast } from 'react-hot-toast';

// 🟢 你的海报图片路径 (如果没有，代码会自动显示深蓝渐变兜底)
const POSTER_IMG = "/assets/hex-poster.jpg"; 

// 🟢 配置：点击客服文字跳转的链接
const QQ_LINK = "https://qm.qq.com/q/tQL0H4Dmak"; 

const PricingModal = ({ isOpen, onClose, username }) => {
  const [selectedPlan, setSelectedPlan] = useState('monthly'); // 默认选中月卡
  
  if (!isOpen) return null;

  // 🔴 你的爱发电主页链接
  const AFDIAN_URL = "https://afdian.com/a/lol-couch";
  const QQ_GROUP_ID = "1076721838"; 

  const handleCopyQQ = () => {
    navigator.clipboard.writeText(QQ_GROUP_ID);
    toast.success("群号已复制");
  };

  const handlePay = () => {
      window.open(AFDIAN_URL, '_blank');
  };

  const handleContactSupport = () => {
      window.open(QQ_LINK, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div 
        // 📱 核心布局调整：移动端 flex-col (垂直)，PC端 md:flex-row (水平)
        className="w-full max-w-5xl bg-[#091428] border border-[#C8AA6E]/40 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:h-[600px]"
        onClick={e => e.stopPropagation()}
      >
        
        {/* =================================================================
           🖼️ 左侧/顶部：视觉海报 (Banner)
           移动端：h-40 (固定高度横幅)
           PC端：h-auto (自适应高度), w-5/12
        ================================================================= */}
        <div className="relative w-full md:w-5/12 h-40 md:h-auto bg-gradient-to-br from-[#010A13] to-[#050C16] overflow-hidden flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#C8AA6E]/10 group shrink-0">
            {/* 背景图 */}
            <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 opacity-40 mix-blend-luminosity"
                style={{ 
                    backgroundImage: `url(${POSTER_IMG})`,
                    backgroundColor: '#010A13' 
                }}
            />
            {/* 装饰背景 */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-[#010A13] via-[#010A13]/80 to-transparent"></div>
            
            <div className="relative z-10 p-6 md:p-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8AA6E]/10 border border-[#C8AA6E]/30 text-[#C8AA6E] text-xs font-bold tracking-wider mb-3 md:mb-6 shadow-[0_0_15px_rgba(200,170,110,0.2)]">
                    <Crown size={12} fill="currentColor"/> HEX COACH PRO
                </div>
                
                <h2 className="text-2xl md:text-3xl font-black text-[#F0E6D2] italic tracking-wide leading-tight mb-2 drop-shadow-md">
                    解锁<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8AA6E] to-[#F0E6D2]">全知全能</span><br/>战术视角
                </h2>
                
                {/* 📱 移动端隐藏详细描述，只留标题，保持 Banner 简洁 */}
                <div className="hidden md:block">
                    <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-xs">
                        基于 HEX AI 深度思考模型，为您提供职业级 BP 建议与对位博弈指引。
                    </p>
                    
                    <ul className="space-y-4">
                        <FeatureItem icon={<Zap/>} text="R1 深度思考模型 (无删减)" />
                        <FeatureItem icon={<Gem/>} text="解锁 100+ 英雄绝活对位库" />
                        <FeatureItem icon={<CheckCircle2/>} text="无限次 AI 分析 (排位/匹配)" />
                        <FeatureItem icon={<Star/>} text="尊贵 PRO 身份标识" />
                    </ul>
                </div>
            </div>
        </div>

        {/* =================================================================
           💰 右侧/底部：支付操作
        ================================================================= */}
        <div className="flex-1 bg-[#0C1118] flex flex-col relative overflow-hidden">
            
            {/* 顶部：用户信息 & 身份标识 & 关闭 */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    {/* 头像 */}
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 shadow-inner relative shrink-0">
                        <span className="font-mono font-bold text-sm">{username?.[0]?.toUpperCase() || "U"}</span>
                        <div className="absolute bottom-0 right-0 w-2 md:w-2.5 h-2 md:h-2.5 bg-green-500 border-2 border-[#0C1118] rounded-full"></div>
                    </div>
                    
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Current Account</div>
                        <div className="flex items-center gap-2">
                            <div className="text-[#F0E6D2] font-bold text-sm font-mono truncate max-w-[100px] md:max-w-[120px]">
                                {username || "未登录用户"}
                            </div>
                            
                            {/* 💎 身份标识 */}
                            <div className="px-1.5 py-0.5 rounded-[4px] bg-[#C8AA6E]/20 border border-[#C8AA6E]/30 text-[#C8AA6E] text-[9px] font-bold tracking-wide uppercase flex items-center gap-1 shrink-0">
                                <Crown size={8} fill="currentColor" />
                                <span>PRO</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-full transition-all">
                    <X size={20}/>
                </button>
            </div>

            {/* 中间：套餐选择 (可滚动) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col">
                
                {/* 1. 套餐卡片 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6 shrink-0">
                    <PlanCard 
                        title="周卡 Pass" 
                        price="6.9" 
                        period="/ 7天"
                        desc="短期冲分体验"
                        active={selectedPlan === 'weekly'}
                        onClick={() => setSelectedPlan('weekly')}
                    />
                    <PlanCard 
                        title="月卡 Elite" 
                        price="19.9" 
                        period="/ 30天"
                        desc="日均 0.6 元 · 推荐" 
                        isRecommended 
                        active={selectedPlan === 'monthly'}
                        onClick={() => setSelectedPlan('monthly')}
                    />
                </div>

                {/* 2. 支付提示 (紧凑版) */}
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 md:p-4 mb-4 md:mb-6 flex gap-3 items-start shrink-0">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5"/>
                    <div className="text-xs space-y-1.5 flex-1">
                        <p className="text-red-200/80 font-medium">自动到账必读：</p>
                        <p className="text-slate-400 leading-relaxed">
                            跳转爱发电支付时，请务必在 <span className="text-white font-bold bg-white/10 px-1 rounded">“留言”</span> 处填写您的用户名：
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                            <code className="bg-black/40 px-2 py-1 rounded text-[#C8AA6E] font-mono font-bold border border-[#C8AA6E]/20 select-all cursor-copy">
                                {username || "您的用户名"}
                            </code>
                            <span className="text-[10px] text-slate-600">(点击复制)</span>
                        </div>
                    </div>
                </div>

                {/* 3. 底部操作栏 */}
                <div className="mt-auto shrink-0 pb-2 md:pb-0">
                    <button 
                        onClick={handlePay}
                        className="group w-full py-3.5 bg-[#C8AA6E] hover:bg-[#b39556] text-[#091428] font-black text-sm rounded shadow-lg shadow-amber-900/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] overflow-hidden relative"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            前往爱发电解锁 {selectedPlan === 'monthly' ? '月卡' : '周卡'}
                            <ExternalLink size={16} className="opacity-60 group-hover:translate-x-0.5 transition-transform"/>
                        </span>
                        {/* 扫光动画 */}
                        <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 group-hover:animate-[shimmer_1s_infinite]"></div>
                    </button>

                    <div className="flex items-center justify-center mt-3 md:mt-4">
                        <button 
                            onClick={handleContactSupport}
                            className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-[#0AC8B9] transition-colors py-1 px-2 rounded hover:bg-white/5"
                            title="点击加入售后群"
                        >
                            <span className="opacity-70">支付未到账？</span>
                            <MessageCircle size={12}/>
                            <span className="underline decoration-slate-700 underline-offset-2">
                                联系人工客服补单 ({QQ_GROUP_ID})
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// === 子组件 ===

const FeatureItem = ({ icon, text }) => (
    <li className="flex items-center gap-3 text-sm text-slate-300/90">
        <div className="text-[#0AC8B9]">{icon}</div>
        <span>{text}</span>
    </li>
);

const PlanCard = ({ title, price, period, desc, isRecommended, active, onClick }) => (
    <div 
        onClick={onClick}
        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between h-24 md:h-28 group
        ${active 
            ? 'bg-[#C8AA6E]/10 border-[#C8AA6E] shadow-lg shadow-[#C8AA6E]/5' 
            : 'bg-slate-800/20 border-slate-800 hover:border-slate-600 hover:bg-slate-800/40'}
        `}
    >
        {isRecommended && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C8AA6E] text-[#091428] text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap z-10">
                超值推荐
            </div>
        )}
        
        <div className="flex justify-between items-start">
            <span className={`font-bold text-sm ${active ? 'text-[#C8AA6E]' : 'text-slate-300'}`}>{title}</span>
            <div className={`transition-all ${active ? 'text-[#C8AA6E]' : 'text-slate-600 group-hover:text-slate-400'}`}>
                {active ? <CheckCircle2 size={18} fill="currentColor" className="text-[#091428]"/> : <div className="w-4 h-4 rounded-full border-2 border-current"></div>}
            </div>
        </div>
        
        <div>
            <div className="flex items-baseline gap-1">
                <span className="text-xs text-slate-500">¥</span>
                <span className={`text-2xl font-black font-mono ${active ? 'text-[#F0E6D2]' : 'text-slate-200'}`}>{price}</span>
                <span className="text-[10px] text-slate-500">{period}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 truncate">{desc}</div>
        </div>
    </div>
);

export default PricingModal;