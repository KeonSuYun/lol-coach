import React, { useState, useMemo } from 'react';
import { Beer, MessageCircle, Heart, Share2, MessageSquare, Layers, UserPlus, Sparkles, Trash2, Edit } from 'lucide-react';
import GlassCard from './GlassCard';
import { toast } from 'react-hot-toast';

const TAVERN_TOPICS = [
    { id: 'all', label: '全部动态', icon: Layers },
    { id: 'teamup', label: '寻找队友', icon: UserPlus },
    { id: 'skin', label: '皮肤鉴赏', icon: Sparkles },
    { id: 'chat', label: '酒馆闲聊', icon: Beer },
    { id: 'rant', label: '吐槽大会', icon: MessageCircle },
];

// 🔥 接收 onDelete, currentUser, isAdmin, onEdit
export default function TavernSection({ heroInfo, tavernPosts, onPostLike, onPostClick, currentUser, isAdmin, onDelete, onEdit }) {
    const [selectedTopic, setSelectedTopic] = useState('all');

    const filteredPosts = useMemo(() => {
        let posts = tavernPosts;
        if (selectedTopic !== 'all') {
            posts = posts.filter(post => post.topic === selectedTopic);
        }
        return posts;
    }, [selectedTopic, tavernPosts]);

    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-in slide-in-from-right-4 duration-500">
            <div className="w-full lg:w-64 flex-shrink-0">
                <GlassCard className="p-4 sticky top-24">
                    <h3 className="text-xs font-bold text-[#C8AA6E] uppercase mb-4 flex items-center gap-2">
                        <Beer size={14} /> 酒馆话题
                    </h3>
                    <div className="space-y-1">
                        {TAVERN_TOPICS.map(topic => (
                            <button
                                key={topic.id}
                                onClick={() => setSelectedTopic(topic.id)}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm transition-all duration-200 border-l-2
                                    ${selectedTopic === topic.id 
                                        ? "bg-[#C8AA6E]/10 border-[#C8AA6E] text-[#C8AA6E] font-medium" 
                                        : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"}
                                `}
                            >
                                <topic.icon size={16} />
                                <span>{topic.label}</span>
                            </button>
                        ))}
                    </div>
                    <button 
                        className="mt-6 w-full py-2 bg-[#0AC8B9]/10 border border-[#0AC8B9]/30 text-[#0AC8B9] rounded text-xs font-bold hover:bg-[#0AC8B9]/20 transition-all flex items-center justify-center gap-2"
                        onClick={() => toast("请使用顶部的【发布/贡献】按钮")}
                    >
                        <MessageCircle size={14} /> 发起讨论
                    </button>
                </GlassCard>
            </div>

            <div className="flex-1 space-y-6">
                <div className="bg-gradient-to-r from-[#C8AA6E]/10 to-transparent p-4 rounded-sm border-l-4 border-[#C8AA6E] flex items-start gap-3">
                    <Beer className="text-[#C8AA6E] flex-shrink-0" size={24} />
                    <div>
                        <h3 className="text-[#F0E6D2] font-bold text-sm">欢迎来到 {heroInfo.name || "英雄"} 专属酒馆</h3>
                        <p className="text-xs text-slate-400 mt-1">这里汇聚了全服 {heroInfo.name} 绝活哥。当前筛选: {TAVERN_TOPICS.find(t=>t.id===selectedTopic)?.label}</p>
                    </div>
                </div>

                {filteredPosts.map(post => (
                    <div 
                        key={post.id} 
                        onClick={() => onPostClick && onPostClick(post)} 
                        className="bg-[#0A1428]/60 backdrop-blur border border-white/5 p-5 rounded-sm hover:border-[#C8AA6E]/30 transition-colors group cursor-pointer relative"
                    >
                        {/* 🔥 核心修复：操作按钮组 (编辑 + 删除) */}
                        {(isAdmin || post.author === currentUser) && (
                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                                {onEdit && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onEdit(post); }}
                                        className="p-1.5 text-slate-600 hover:text-[#C8AA6E] hover:bg-[#C8AA6E]/10 rounded transition-all"
                                        title="编辑"
                                    >
                                        <Edit size={16} />
                                    </button>
                                )}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
                                    className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                    title="删除"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 rounded-full bg-[#091428] border border-[#C8AA6E]/50 flex items-center justify-center overflow-hidden">
                                    <img src={`https://game.gtimg.cn/images/lol/act/img/champion/${post.avatar}.png`} alt={post.author} className="w-full h-full object-cover" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span 
                                            className="text-[#C8AA6E] font-bold text-sm mr-2 cursor-pointer hover:underline" 
                                            onClick={(e) => {
                                                e.stopPropagation(); // 防止冒泡触发打开详情
                                                toast(`查看用户: ${post.author}`);
                                            }}
                                        >
                                            {post.author}
                                        </span>
                                        <span className="text-slate-600 text-xs">{post.time}</span>
                                    </div>
                                    <span className="bg-white/5 text-slate-400 px-2 py-0.5 rounded text-[10px] mr-6">
                                        {TAVERN_TOPICS.find(t => t.id === post.topic)?.label}
                                    </span>
                                </div>
                                <p className="text-slate-300 text-sm mb-3 leading-relaxed">{post.content}</p>
                                {post.image && (
                                    <div className="mb-3 rounded overflow-hidden border border-white/10 max-w-md">
                                        <img src={post.image} alt="Post content" className="w-full h-auto" />
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {post.tags.map(tag => (
                                        <span key={tag} className="text-[10px] text-[#0AC8B9] bg-[#0AC8B9]/5 px-1.5 py-0.5 rounded">#{tag}</span>
                                    ))}
                                </div>
                                <div className="flex gap-6 pt-3 border-t border-white/5 text-xs text-slate-500">
                                    <button 
                                        className="flex items-center gap-1.5 hover:text-[#C8AA6E] transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onPostLike(post.id);
                                        }}
                                    >
                                        <Heart size={14} className={post.liked ? "fill-[#C8AA6E] text-[#C8AA6E]" : ""} /> 
                                        <span>{post.likes}</span>
                                    </button>
                                    <button className="flex items-center gap-1.5 hover:text-[#0AC8B9] transition-colors">
                                        <MessageSquare size={14} /> <span>{post.comments}</span>
                                    </button>
                                    <button className="flex items-center gap-1.5 hover:text-white transition-colors ml-auto">
                                        <Share2 size={14} /> 分享
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
export { TAVERN_TOPICS };