import React from 'react';
import { AlertTriangle, Sparkles, MessageSquarePlus } from 'lucide-react';

const FeedbackModal = ({ isOpen, onClose, content, setContent, onSubmit }) => {
  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#091428] border border-[#C8AA6E]/30 p-6 rounded-xl w-full max-w-md shadow-2xl relative overflow-hidden">
              {/* 装饰背景 */}
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Sparkles size={100} />
              </div>

              <h3 className="text-[#F0E6D2] font-bold mb-4 flex items-center gap-2 relative z-10 text-lg">
                  <MessageSquarePlus className="text-[#C8AA6E]" size={20}/> 
                  <span>共建战术知识库</span>
              </h3>
              
              <div className="text-slate-400 text-xs mb-5 space-y-4 relative z-10 leading-relaxed">
                  {/* 🔥 价值观文案植入 */}
                  <div className="bg-[#C8AA6E]/5 p-4 rounded border border-[#C8AA6E]/20 relative">
                      <div className="absolute top-0 left-0 w-[2px] h-full bg-[#C8AA6E]"></div>
                      <p className="text-[#F0E6D2] font-bold mb-2">我们更愿意把体验留给真实玩家。</p>
                      <p className="opacity-90">
                          AI 并非全知全能。如果您在社区中分享有价值的对局理解、复盘思路，或指正了 AI 的逻辑谬误，
                          {/* 🔥 名词替换：Hex Core 算力 */}
                          一经采纳，我们将为您补充额外的 <span className="text-[#0AC8B9] font-bold">海克斯核心 (Hex Core)</span> 算力。
                      </p>
                  </div>
                  
                  <p className="text-slate-500 pl-1">
                      * 您的见解将帮助成千上万的后来者少走弯路。
                  </p>
              </div>

              <textarea 
                  className="w-full bg-black/40 border border-slate-700 rounded-lg p-3 text-white text-sm mb-4 h-32 focus:border-[#C8AA6E] outline-none transition-colors resize-none placeholder:text-slate-600 custom-scrollbar"
                  placeholder="请粘贴分析段落，并写下您的独到理解..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
              />
              
              <div className="flex justify-end gap-3 relative z-10">
                  <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-xs font-medium">取消</button>
                  <button onClick={onSubmit} className="px-6 py-2 bg-gradient-to-r from-[#C8AA6E] to-[#b09358] text-[#091428] font-bold rounded text-xs hover:brightness-110 transition-all shadow-lg active:scale-95">
                      提交见解
                  </button>
              </div>
          </div>
      </div>
  );
};

export default FeedbackModal;