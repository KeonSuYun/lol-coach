import React from 'react';
import { MessageSquare, Plus, ThumbsUp, Trash2 } from 'lucide-react';

const CommunityTips = ({ tips, currentUser, onOpenPostModal, onLike, onDelete }) => {
  // 权限判断逻辑内聚
  const canDelete = (tipAuthorId) => {
    return currentUser === tipAuthorId || 
           currentUser === "admin" || 
           currentUser === "root" || 
           currentUser === "keonsuyun";
  };

  return (
    <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[300px]">
        <div className="bg-slate-950 p-3 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-slate-300 text-xs">
                <MessageSquare size={14} className="text-green-400"/> 社区绝活
            </div>
            <button onClick={onOpenPostModal} className="text-blue-400 hover:text-white transition-colors">
                <Plus size={16}/>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {tips.length > 0 ? tips.map(tip => (
                <div key={tip.id} className="bg-slate-800 p-2 rounded text-xs text-slate-300 border border-transparent hover:border-slate-600 transition-colors">
                    <div className="flex justify-between mb-1 opacity-50 text-[10px] items-center">
                        <span className="flex items-center gap-2">
                            <span>VS {tip.enemy}</span>
                            {canDelete(tip.author_id) && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete(tip.id, tip.author_id); }} 
                                    className="text-slate-600 hover:text-red-500 transition-colors"
                                    title="删除"
                                >
                                    <Trash2 size={10} />
                                </button>
                            )}
                        </span>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-[9px]">by {tip.author_id?.substr(0,5)}</span>
                            <button onClick={() => onLike(tip.id)} className="flex items-center gap-1 hover:text-red-400 transition-colors">
                                <ThumbsUp size={10}/> {tip.liked_by?.length || 0}
                            </button>
                        </div>
                    </div>
                    {tip.content}
                </div>
            )) : (
                <div className="text-center text-slate-600 text-xs py-4">暂无数据</div>
            )}
        </div>
    </div>
  );
};

export default CommunityTips;