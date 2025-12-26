import React from 'react';
import { MessageSquare, X, Swords, BookOpen, PenTool } from 'lucide-react';

const TipModal = ({ isOpen, onClose, content, setContent, onSubmit, heroName, targetName }) => {
  if (!isOpen) return null;

  const isMatchup = !!targetName; // 如果有目标名字，就是对位技巧

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        {/* 主容器：海克斯风格 */}
        <div className="w-full max-w-md bg-[#091428] border-2 border-[#C8AA6E] rounded-lg shadow-[0_0_30px_rgba(200,170,110,0.2)] relative overflow-hidden">
            
            {/* 顶部光效 */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#F0E6D2] to-transparent"></div>

            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-[#C8AA6E]/30 bg-[#010A13]/50">
                <div className="flex items-center gap-2 text-[#F0E6D2]">
                    <PenTool size={18} className="text-[#C8AA6E]"/>
                    <span className="font-bold tracking-wider font-serif">TACTICAL NOTE</span>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* 上下文提示条 (Context Banner) */}
            <div className={`px-4 py-2 flex items-center gap-2 text-xs font-bold border-b border-white/5
                ${isMatchup 
                    ? 'bg-red-900/20 text-red-300' 
                    : 'bg-emerald-900/20 text-emerald-300'
                }`}>
                {isMatchup ? <Swords size={14}/> : <BookOpen size={14}/>}
                <span>
                    {isMatchup 
                        ? `正在撰写：${heroName} VS ${targetName} 的对位细节` 
                        : `正在撰写：${heroName} 的通用独家绝活`
                    }
                </span>
            </div>

            {/* 内容区 */}
            <div className="p-5">
                <textarea 
                  className="w-full h-40 bg-[#010A13] border border-[#C8AA6E]/30 rounded p-3 text-slate-300 text-sm focus:border-[#0AC8B9] focus:ring-1 focus:ring-[#0AC8B9] outline-none transition-all placeholder-slate-600 custom-scrollbar resize-none font-sans leading-relaxed"
                  placeholder={isMatchup 
                    ? "例如：一级学W，等他放完Q再上去换血..." 
                    : "例如：R闪的成功率取决于鼠标位置..."}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  autoFocus
                />
                
                {/* 底部按钮 */}
                <div className="flex justify-end gap-3 mt-4">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-[#F0E6D2] transition-colors uppercase tracking-wider"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onSubmit} 
                        className={`px-6 py-2 text-xs font-bold text-[#010A13] rounded transition-all shadow-lg flex items-center gap-2
                            ${isMatchup 
                                ? 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 shadow-red-900/20' 
                                : 'bg-gradient-to-r from-[#C8AA6E] to-[#F0E6D2] hover:brightness-110 shadow-amber-900/20'
                            }
                        `}
                    >
                        <MessageSquare size={14}/>
                        PUBLISH
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default TipModal;