import React from 'react';

const TipModal = ({ isOpen, onClose, content, setContent, onSubmit }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-white font-bold mb-4">分享绝活心得</h3>
            <textarea 
              className="w-full bg-black border border-slate-700 rounded p-3 text-white text-sm mb-4 h-32 focus:border-blue-500 outline-none transition-colors"
              placeholder="分享你的对线技巧..."
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">取消</button>
                <button onClick={onSubmit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">发布</button>
            </div>
        </div>
    </div>
  );
};

export default TipModal;