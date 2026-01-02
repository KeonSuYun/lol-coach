import React, { useState, useMemo } from 'react';
import { Layers, ThumbsUp, User } from 'lucide-react';

export default function MiniMasteryWidget({ currentHero, opponentHero, posts, onNavigateToPost }) {
    const [isExpanded, setIsExpanded] = useState(true);

    const onionFeed = useMemo(() => {
        if (!currentHero) return [];
        
        // ✅ [新增] 安全检查：如果 posts 不是数组，直接返回空，防止崩坏
        if (!Array.isArray(posts)) {
            return [];
        }

        let feed = [];
        const heroPosts = posts.filter(p => p.heroId === currentHero.key);
        if (opponentHero) {
            const matchupPosts = heroPosts.filter(p => p.opponentId === opponentHero.key);
            matchupPosts.forEach(p => feed.push({ ...p, type: 'matchup', reason: `对阵 ${opponentHero.name}` }));
        }

        const highLikesPosts = heroPosts
            .filter(p => !feed.find(f => f.id === p.id))
            .sort((a, b) => b.likes - a.likes)
            .slice(0, 5);

        highLikesPosts.forEach(p => feed.push({ ...p, type: 'hot', reason: '热门战术' }));

        return feed.slice(0, 5);
    }, [currentHero, opponentHero, posts]);

    if (!currentHero) return null;

    return (
        <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 transition-all duration-300 ${isExpanded ? 'w-[320px]' : 'w-auto'}`}>
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`
                    h-12 px-4 rounded-full flex items-center gap-3 shadow-2xl border backdrop-blur-xl transition-all
                    ${isExpanded 
                        ? 'bg-[#0AC8B9]/10 border-[#0AC8B9] text-[#0AC8B9]' 
                        : 'bg-[#091428]/90 border-[#C8AA6E] text-[#C8AA6E] hover:scale-105'
                    }
                `}
            >
                <Layers size={18} className={isExpanded ? "animate-pulse" : ""} />
                <span className="font-bold text-xs uppercase tracking-widest">
                    {isExpanded ? "战术情报" : "绝活社区"}
                </span>
                {!isExpanded && (
                    <span className="text-[10px] bg-[#0AC8B9]/20 px-1.5 rounded text-white">{onionFeed.length}</span>
                )}
            </button>

            {isExpanded && (
                <div className="w-full bg-[#010A13]/95 border border-[#C8AA6E]/30 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    <div className="p-2 bg-[#0A1428] border-b border-white/5 flex justify-between items-center px-4">
                        <span className="text-[10px] text-slate-500 font-mono">战术情报 (按热度)</span>
                        {opponentHero && <span className="text-[10px] text-red-400 font-bold">对阵: {opponentHero.name}</span>}
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        {onionFeed.length > 0 ? onionFeed.map((item, idx) => (
                            <div 
                                key={item.id}
                                onClick={() => onNavigateToPost(item)}
                                className={`
                                    p-3 border-b border-white/5 hover:bg-[#C8AA6E]/5 cursor-pointer group transition-colors relative
                                    ${idx === 0 ? 'bg-gradient-to-r from-[#0AC8B9]/5 to-transparent' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold border ${
                                        item.type === 'matchup' ? 'border-red-500/30 text-red-400' : 'border-[#C8AA6E]/30 text-[#C8AA6E]'
                                    }`}>
                                        {item.reason}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-mono">{item.refId}</span>
                                </div>
                                <h4 className="text-sm text-slate-200 font-medium line-clamp-1 group-hover:text-[#0AC8B9] transition-colors">{item.title}</h4>
                                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1 text-[#C8AA6E] font-bold"><ThumbsUp size={10}/> {item.likes}</span>
                                    <span className="flex items-center gap-1"><User size={10}/> {item.author}</span>
                                </div>
                                {idx === 0 && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0AC8B9]" />}
                            </div>
                        )) : (
                            <div className="p-6 text-center text-slate-500 text-xs">
                                暂无高优先级情报，<br/>查看完整Wiki获取更多。
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}