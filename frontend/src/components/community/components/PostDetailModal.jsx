import React, { useState, useEffect } from 'react';
import { X, Swords, User, Clock, Eye, Tag, MessageSquare, ThumbsUp, Send, Loader2, Trash2, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';

// 1. 引入 API SDK
import { CommunitySDK } from '../api/CommunitySDK';

// 🔥 修复：添加 export 关键字，使 PublishModal 可以导入它
export const CATEGORIES = [
    { id: "all", label: "全部" },
    { id: "mechanic", label: "核心机制" },
    { id: "matchup", label: "对线特攻" },
    { id: "jungle", label: "游走思路" },
    { id: "teamfight", label: "团战操作" },
    { id: "build", label: "出装理解" }
];

// 根据用户名生成固定的“随机”LOL头像 (0-28号经典头像)
const getAvatarUrl = (name) => {
    if (!name) return `https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/29.png`;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const iconId = Math.abs(hash) % 29; 
    return `https://ddragon.leagueoflegends.com/cdn/15.1.1/img/profileicon/${iconId}.png`;
};

// 接收 onDelete, onEdit, currentUser, isAdmin
export default function PostDetailModal({ post, onClose, championList, currentUser, isAdmin, onDelete, onEdit }) {
    if (!post) return null;

    // 2. 定义真实状态
    const [comments, setComments] = useState([]); // 存储真实评论
    const [loading, setLoading] = useState(true); // 加载状态
    const [inputValue, setInputValue] = useState(""); // 输入框内容
    const [isSubmitting, setIsSubmitting] = useState(false); // 发送中状态
    
    // 获取对位英雄信息
    const opponent = championList.find(c => c.key === post.opponentId);

    // 3. 每次打开帖子或帖子ID变化时，拉取真实评论
    useEffect(() => {
        let isMounted = true;
        
        const fetchComments = async () => {
            setLoading(true);
            try {
                // 调用后端接口获取评论
                const data = await CommunitySDK.getComments(post.id);
                if (isMounted) {
                    // 如果后端没返回数据，设为空数组
                    setComments(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error("Failed to fetch comments", error);
                if (isMounted) setComments([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (post.id) {
            fetchComments();
        }

        return () => { isMounted = false; };
    }, [post.id]);

    // 4. 处理发送评论
    const handleSendComment = async () => {
        if (!inputValue.trim()) return;
        
        setIsSubmitting(true);
        try {
            // 调用 SDK 发送评论
            const newComment = await CommunitySDK.publishComment(post.id, inputValue);
            
            if (newComment) {
                // 成功后，将新评论插入到列表最前面 (乐观更新)
                setComments(prev => [newComment, ...prev]);
                setInputValue(""); // 清空输入框
                toast.success("评论发表成功！");
            }
        } catch (error) {
            console.error("Publish comment failed", error);
            toast.error("评论失败，请重试");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-4xl bg-[#010A13] border border-[#C8AA6E] shadow-2xl rounded-sm flex flex-col md:flex-row h-[85vh] overflow-hidden relative" onClick={e => e.stopPropagation()}>
                
                {/* === 左侧：帖子正文 === */}
                <div className="flex-1 flex flex-col border-r border-[#C8AA6E]/20 bg-gradient-to-b from-[#0A1428] to-[#050810] overflow-hidden relative">
                    {/* Header */}
                    <div className="p-6 border-b border-[#C8AA6E]/10 shrink-0">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="bg-[#0AC8B9]/10 text-[#0AC8B9] px-2 py-0.5 rounded text-xs font-bold uppercase border border-[#0AC8B9]/20">
                                {CATEGORIES.find(c => c.id === post.category)?.label || post.category || "综合"}
                            </span>
                            
                            {/* 🔥 [核心修复] 仅在 category 为 matchup 且有 opponent 时显示 */}
                            {post.category === 'matchup' && opponent && (
                                <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 border border-red-500/20">
                                    <Swords size={10} /> 对阵 {opponent.name}
                                </span>
                            )}
                            
                            <span className="text-slate-600 text-xs font-mono ml-auto">{post.refId || "#REF"}</span>
                            
                            {/* 操作按钮 (管理员或作者可见) */}
                            {(isAdmin || post.author === currentUser) && (
                                <div className="flex gap-1 ml-2">
                                    {onEdit && (
                                        <button 
                                            onClick={() => onEdit(post)}
                                            className="text-slate-500 hover:bg-white/10 p-1 rounded transition-colors"
                                            title="编辑此贴"
                                        >
                                            <Edit size={16} />
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button 
                                            onClick={() => onDelete(post.id)}
                                            className="text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors"
                                            title="删除此贴"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <h2 className="text-2xl font-bold text-[#F0E6D2] leading-tight mb-4">{post.title}</h2>
                        
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <div className="flex items-center gap-2">
                                <img 
                                    src={getAvatarUrl(post.author)} 
                                    className="w-6 h-6 rounded-full border border-[#C8AA6E]/50"
                                    alt={post.author}
                                />
                                <span className="font-bold text-[#C8AA6E]">{post.author}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1"><Clock size={12}/> {post.date || "刚刚"}</span>
                                <span className="flex items-center gap-1"><Eye size={12}/> {post.views || 0} 阅读</span>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        <div className="prose prose-invert prose-sm max-w-none">
                            <p className="text-slate-300 leading-7 whitespace-pre-wrap font-sans text-sm md:text-base">
                                {post.content}
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-8">
                            {post.tags?.map(tag => (
                                <span key={tag} className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5 flex items-center gap-1">
                                    <Tag size={10} /> {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* === 右侧：独立评论区 === */}
                <div className="w-full md:w-80 flex flex-col bg-[#050810] h-1/3 md:h-auto border-t md:border-t-0 md:border-l border-white/5">
                    {/* 评论头 */}
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#091428]">
                        <h3 className="text-sm font-bold text-[#C8AA6E] flex items-center gap-2">
                             <MessageSquare size={14} /> 评论互动 ({comments.length})
                        </h3>
                        <button onClick={onClose} className="md:hidden text-slate-500"><X size={20}/></button>
                        <button onClick={onClose} className="hidden md:block p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* 评论列表 (真实数据渲染) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                                <Loader2 size={24} className="animate-spin text-[#C8AA6E]"/>
                                <span className="text-xs">加载评论中...</span>
                            </div>
                        ) : comments.length > 0 ? (
                            comments.map(comment => (
                                <div key={comment.id || Math.random()} className="flex gap-3 group animate-in slide-in-from-right-2 duration-300">
                                    {/* 随机头像 */}
                                    <img 
                                        src={getAvatarUrl(comment.user || comment.author)} 
                                        alt={comment.user}
                                        className="w-8 h-8 rounded-full border border-white/10 shrink-0 bg-black"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-slate-300 font-bold group-hover:text-[#0AC8B9] transition-colors">
                                                {comment.user || comment.author || "匿名用户"}
                                            </span>
                                            {/* (可选) 判断是否神评，这里暂时通过点赞数判断演示 */}
                                            {(comment.likes > 10) && <span className="text-[10px] bg-[#C8AA6E] text-[#091428] px-1.5 rounded font-bold">热评</span>}
                                        </div>
                                        <p className="text-xs text-slate-400 mb-2 leading-relaxed break-all">
                                            {comment.content}
                                        </p>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-600">
                                            <button className="flex items-center gap-1 hover:text-[#C8AA6E] transition-colors">
                                                <ThumbsUp size={10}/> {comment.likes || 0}
                                            </button>
                                            <span className="text-slate-700">{new Date(comment.created_at || Date.now()).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50 min-h-[200px]">
                                <MessageSquare size={32} />
                                <span className="text-xs">暂无评论，快来抢沙发</span>
                            </div>
                        )}
                    </div>

                    {/* 底部输入框 (真实发送) */}
                    <div className="p-3 border-t border-white/5 bg-[#091428] shrink-0">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder={isSubmitting ? "发送中..." : "发表你的看法..."}
                                className="w-full bg-[#010A13] border border-white/10 rounded-lg py-2 pl-3 pr-10 text-xs text-slate-200 focus:border-[#C8AA6E] outline-none transition-colors disabled:opacity-50"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                                disabled={isSubmitting}
                            />
                            <button 
                                onClick={handleSendComment}
                                disabled={isSubmitting || !inputValue.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#C8AA6E] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Send size={14} />}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}