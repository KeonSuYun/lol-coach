import React from 'react';
import { AlertTriangle } from 'lucide-react';

const FeedbackModal = ({ isOpen, onClose, content, setContent, onSubmit }) => {
  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-500/30 p-6 rounded-xl w-full max-w-md shadow-2xl">
              <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <AlertTriangle className="text-red-500"/> 指出 AI 的错误
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                  如果发现 AI 说了过时的机制或错误的建议，请告诉我们。管理员审核后会将其加入【修正知识库】。
              </p>
              <textarea 
                  className="w-full bg-black border border-slate-700 rounded p-3 text-white text-sm mb-4 h-32 focus:border-red-500 outline-none transition-colors"
                  placeholder="请直接复制有错误的整段文字"
                  value={content}
                  onChange={e => setContent(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                  <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">取消</button>
                  <button onClick={onSubmit} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20">提交反馈</button>
              </div>
          </div>
      </div>
  );
};

export default FeedbackModal;