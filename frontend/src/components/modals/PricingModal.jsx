import React, { useState } from 'react';
import { X, Crown, Zap, CheckCircle2, Gem, MessageCircle, AlertTriangle, Copy, Check } from 'lucide-react';

const PricingModal = ({ isOpen, onClose, username }) => {
  const [copied, setCopied] = useState(false);
  
  if (!isOpen) return null;

  // 🔴 替换成你的爱发电个人主页链接
  const AFDIAN_URL = "https://afdian.com/a/lol-couch";
  // 🔴 替换成你的 QQ 群号
  const QQ_GROUP_ID = "857733055"; 

  const handleCopyQQ = () => {
    navigator.clipboard.writeText(QQ_GROUP_ID);
    setCopied(true);
    // 如果没有安装 toast 组件，可以用简单的 alert 或者仅依赖图标变化的视觉反馈
    // alert("群号已复制，请前往QQ添加"); 
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-3xl bg-[#091428] border border-[#C8AA6E] rounded-xl shadow-[0_0_60px_rgba(200,170,110,0.15)] relative overflow-hidden flex flex-col md:flex-row max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* === 左侧：权益展示 === */}
        <div className="p-8 md:w-5/12 bg-gradient-to-br from-[#010A13] to-[#091428] relative flex flex-col">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#C8AA6E] to-transparent opacity-50"></div>
            
            <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#F0E6D2] font-serif mb-6 flex items-center gap-2">
                    <Crown className="text-[#C8AA6E]" fill="currentColor"/> HEX PRO
                </h2>
                
                <ul className="space-y-5">
                    {[
                        "DeepSeek R1 深度思考模型",
                        "无限次 AI 战术分析",
                        "解锁全部对位数据库",
                        "尊贵 PRO 身份标识"
                    ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                            <CheckCircle2 size={18} className="text-[#0AC8B9] shrink-0 mt-0.5"/> 
                            <span className="leading-snug">{item}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-[#C8AA6E]/20">
                <div className="text-xs text-slate-500 mb-1">当前账号</div>
                <div className="font-mono text-[#0AC8B9] font-bold text-lg truncate">
                    {username || "未登录"}
                </div>
            </div>
        </div>

        {/* === 右侧：价格与支付 === */}
        <div className="p-6 md:p-8 md:w-7/12 bg-[#0C1118] flex flex-col relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-600 hover:text-white transition-colors"><X size={20}/></button>
            
            {/* 1. 套餐选择 */}
            <div className="mb-6">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Select Plan</div>
                <div className="space-y-3">
                    <div 
                        onClick={() => window.open(AFDIAN_URL, '_blank')}
                        className="group border border-slate-700 bg-slate-800/50 p-3 rounded-lg cursor-pointer hover:border-[#0AC8B9] hover:bg-[#0AC8B9]/5 transition-all relative overflow-hidden flex justify-between items-center"
                    >
                        <div>
                            <div className="text-slate-300 font-bold text-sm">周卡 Pass</div>
                            <div className="text-[10px] text-slate-500">短期冲分首选</div>
                        </div>
                        <div className="text-lg font-bold text-[#F0E6D2] font-mono">¥6.9</div>
                    </div>

                    <div 
                        onClick={() => window.open(AFDIAN_URL, '_blank')}
                        className="group border-2 border-[#C8AA6E] bg-gradient-to-r from-[#C8AA6E]/10 to-transparent p-3 rounded-lg cursor-pointer hover:shadow-[0_0_20px_rgba(200,170,110,0.2)] transition-all relative flex justify-between items-center"
                    >
                        <div className="absolute -top-2 left-2 bg-[#C8AA6E] text-[#010A13] text-[9px] font-bold px-1.5 py-0.5 rounded-b">
                            RECOMMENDED
                        </div>
                        <div className="mt-1">
                            <div className="text-[#C8AA6E] font-bold flex items-center gap-2 text-sm">
                                <Gem size={14}/> 月卡 Elite
                            </div>
                            <div className="text-[10px] text-[#C8AA6E]/70">日均仅需 0.6 元</div>
                        </div>
                        <div className="text-2xl font-black text-[#F0E6D2] font-mono">¥19.9</div>
                    </div>
                </div>
            </div>

            {/* 2. 支付必读 (红框) */}
            <div className="bg-red-950/30 border border-red-500/30 p-3 rounded mb-4">
                <h3 className="text-red-400 font-bold mb-2 flex items-center text-xs gap-1">
                    <AlertTriangle size={12}/> 支付必读 (自动到账)
                </h3>
                <div className="text-[10px] text-slate-400 space-y-1">
                    <p>请在支付页面的 <span className="font-bold text-white">“留言”</span> 处填写用户名：</p>
                    <div className="bg-black/40 p-1.5 rounded text-center border border-red-500/20 mt-1">
                        <span className="font-mono text-[#F0E6D2] font-bold select-all cursor-text">{username || "..."}</span>
                    </div>
                </div>
            </div>

            {/* 3. 支付按钮 */}
            <button 
                onClick={() => window.open(AFDIAN_URL, '_blank')}
                className="w-full py-3 bg-[#C8AA6E] hover:bg-[#b39556] text-[#010A13] font-bold text-sm rounded shadow-lg shadow-amber-900/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] mb-6"
            >
                <Zap size={16} fill="currentColor"/> 立即解锁
            </button>

            {/* 4. 人工兜底通道 (Scheme A) */}
            <div className="mt-auto pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                    <div className="text-slate-500 flex flex-col">
                        <span className="font-bold text-slate-400 flex items-center gap-1">
                            <MessageCircle size={12}/> 忘记填用户名？
                        </span>
                        <span className="text-[10px] scale-90 origin-left mt-0.5">联系人工客服补单</span>
                    </div>
                    
                    <button 
                        onClick={handleCopyQQ}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all active:scale-95
                            ${copied 
                                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                : 'bg-slate-800 border-slate-700 text-blue-400 hover:border-blue-500/50 hover:bg-slate-700'}
                        `}
                        title="点击复制群号"
                    >
                        <span className="font-mono font-bold">{QQ_GROUP_ID}</span>
                        {copied ? <Check size={12}/> : <Copy size={12}/>}
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default PricingModal;