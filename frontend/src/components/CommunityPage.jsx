import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, BookOpen, Layers, Beer, TrendingUp, Zap, Clock, ThumbsUp, X, Edit3, ChevronLeft, Edit, User, LogOut, Settings, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { CommunitySDK } from './community/api/CommunitySDK';
import GlassCard from './community/components/GlassCard.jsx';
import PostDetailModal from './community/components/PostDetailModal.jsx';
import PublishModal from './community/components/PublishModal.jsx';
import WikiSection from './community/components/WikiSection.jsx';
import TavernSection from './community/components/TavernSection.jsx';
import MiniMasteryWidget from './community/components/MiniMasteryWidget.jsx';
import ChampSelectModal from './modals/ChampSelectModal.jsx';
import ConsoleHeaderUser from './ConsoleHeaderUser.jsx';

export default function CommunityPage({ 
    onBack, 
    onShowProfile, 
    onLogout, 
    onShowSettings,
    onShowAdmin,
    championList: propChampList, 
    roleMapping, 
    currentUser, 
    token, 
    accountInfo, 
    userRank 
}) {
    const [currentHeroId, setCurrentHeroId] = useState("1"); // 默认为 "1" (安妮)
    const [opponentHeroId, setOpponentHeroId] = useState(null);
    const [viewMode, setViewMode] = useState('wiki'); 
    const [selectedPost, setSelectedPost] = useState(null);
    const [championList, setChampionList] = useState([]);
    
    // UI States
    const [isSelectorOpen, setIsSelectorOpen] = useState(false); 
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    
    // 用户菜单状态
    const [showUserMenu, setShowUserMenu] = useState(false);
    
    // Data States
    const [posts, setPosts] = useState([]);
    const [tavernPosts, setTavernPosts] = useState([]);
    const [wikiSummary, setWikiSummary] = useState(null);

    const isAdmin = accountInfo?.role === 'admin' || accountInfo?.role === 'root';

    // 🛡️ 智能数据适配 (解决头像 undefined 问题)
    const adaptChampionData = (rawList) => {
        if (!Array.isArray(rawList)) return [];
        return rawList.map(h => {
            // 1. 寻找英文 Key (用于图片URL)
            // 兼容: { key: "Aatrox" } 或 { alias: "Aatrox" } 或 { id: "Aatrox" }
            const englishKey = h.key || h.alias || (h.id && /^[a-zA-Z]+$/.test(h.id) ? h.id : "Annie"); 
            
            // 2. 寻找数字 ID (用于 DDragon/gtimg 皮肤接口)
            // 兼容: { heroId: "266" } 或 { id: "266" }
            const numericId = h.heroId || (h.id && /^\d+$/.test(h.id) ? h.id : null); 

            // 3. 图片 URL
            const finalImg = h.image_url || `https://game.gtimg.cn/images/lol/act/img/champion/${englishKey}.png`;

            return {
                ...h,
                key: englishKey, // 确保是英文，用于 roleMapping 匹配
                id: numericId || englishKey, // 优先用数字ID，没有则用英文名
                name: h.name,
                title: h.title || h.name,
                image_url: finalImg, 
                roles: h.roles || [] 
            };
        });
    };

    useEffect(() => {
        const fetchChampions = async () => {
            if (propChampList && propChampList.length > 0) {
                setChampionList(adaptChampionData(propChampList));
                return;
            }

            try {
                const stored = localStorage.getItem('champions_data_v2'); 
                if (stored) {
                    setChampionList(JSON.parse(stored));
                    return;
                }

                const res = await axios.get('https://game.gtimg.cn/images/lol/act/img/js/heroList/hero_list.js');
                if (res.data && res.data.hero) {
                    const adaptedList = adaptChampionData(res.data.hero);
                    setChampionList(adaptedList);
                    localStorage.setItem('champions_data_v2', JSON.stringify(adaptedList));
                }
            } catch (err) { console.error(err); }
        };
        fetchChampions();

        const fetchCommunityData = async () => {
            setWikiSummary(null);
            try {
                const [guidesData, tavernData, wikiData] = await Promise.all([
                    CommunitySDK.getHeroGuides(currentHeroId),
                    // 🔥 [修改] 不传参数，确保获取全服/全局酒馆动态
                    CommunitySDK.getTavernPosts(), 
                    CommunitySDK.getHeroWikiSummary(currentHeroId)
                ]);

                setPosts(guidesData || []);
                setTavernPosts(tavernData || []);
                setWikiSummary(wikiData || {}); 
            } catch (error) {
                console.error("Failed to load community data", error);
            }
        };

        if (currentHeroId) {
            fetchCommunityData();
        }

    }, [currentHeroId, propChampList]);

    const currentHeroInfo = championList.find(c => String(c.id) === String(currentHeroId)) || 
                            championList.find(c => c.key === currentHeroId) || 
                            { name: "加载中...", image_url: null }; // 🟢 Fix: 默认为 null 而非 ""
    
    const opponentHeroInfo = championList.find(c => c.id === opponentHeroId) || null;

    const handleLinkClick = (refId) => {
        if (!refId) return;
        const targetPost = posts.find(p => p.refId === refId);
        if (targetPost) setSelectedPost(targetPost);
        else toast.error(`暂未收录该条目: ${refId}`);
    };

    const handleTavernLike = (postId) => {
        setTavernPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p));
        toast.success("点赞成功");
    };

    const handlePublishSuccess = (newItem, type) => {
        if (editingPost) {
            toast.success("更新成功！");
            if (type === 'wiki') {
                setPosts(prev => prev.map(p => p.id === newItem.id ? newItem : p));
            } else {
                setTavernPosts(prev => prev.map(p => p.id === newItem.id ? newItem : p));
            }
        } else {
            toast.success("发布成功！");
            if (type === 'wiki') setPosts([newItem, ...posts]);
            else setTavernPosts([newItem, ...tavernPosts]);
        }
    };

    const handleDeletePost = async (postId) => {
        if (!window.confirm("确定要删除这条攻略吗？操作不可逆。")) return;
        try {
            await CommunitySDK.deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
            setSelectedPost(null);
            toast.success("删除成功");
        } catch (e) {
            toast.error("删除失败");
        }
    };

    const handleDeleteTavern = async (postId) => {
        if (!window.confirm("确定要删除这条动态吗？")) return;
        try {
            await CommunitySDK.deleteTavernPost(postId);
            setTavernPosts(prev => prev.filter(p => p.id !== postId));
            toast.success("删除成功");
        } catch (e) {
            toast.error("删除失败");
        }
    };

    const handleEditPost = (post) => {
        setEditingPost(post);
        setShowPublishModal(true);
    };

    // 🔥 [修复] 优先显示游戏内昵称 (LCU GameName)，如果没有则显示登录用户名
    const displayGameName = accountInfo?.game_profile?.gameName || currentUser || "Guest";

    const userData = {
        username: displayGameName,
        tag: accountInfo?.game_profile?.tagLine || accountInfo?.tag || "#HEX",
        avatarUrl: accountInfo?.game_profile?.profileIconId 
            ? `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${accountInfo.game_profile.profileIconId}.png`
            : `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png`,
        activeTitle: accountInfo?.active_title || "社区成员",
        rank: accountInfo?.game_profile?.rank || userRank || "Unranked",
        isPro: accountInfo?.is_pro
    };

    return (
        <div className="min-h-screen font-sans text-slate-300 bg-[#010A13] selection:bg-[#C8AA6E]/30 pb-20">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-[#091428] via-[#010A13]/80 to-[#010A13]" />
                {currentHeroInfo.key && (
                    <img 
                        src={`https://game.gtimg.cn/images/lol/act/img/skin/big${
                            /^\d+$/.test(currentHeroInfo.id) ? currentHeroInfo.id : '1'
                        }000.jpg`} 
                        className={`fixed top-0 left-0 w-full h-[600px] object-cover opacity-20 mask-image-gradient z-[-1] ${/^\d+$/.test(currentHeroInfo.id) ? '' : 'hidden'}`}
                        alt=""
                        onError={(e) => e.target.style.display = 'none'}
                    />
                )}
            </div>

            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#010A13]/80 backdrop-blur-md border-b border-[#C8AA6E]/10">
                <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
                    
                    {/* Left: Navigation & Hero Selector */}
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                            <ChevronLeft size={20} />
                        </button>

                        <div className="h-6 w-[1px] bg-white/10 mx-1" />

                        <div onClick={() => setIsSelectorOpen(true)} className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-10 h-10 rounded-full border border-[#C8AA6E]/50 p-0.5 group-hover:border-[#0AC8B9] transition-colors relative overflow-hidden bg-black">
                                {/* 🟢 Fix: 使用 || null 替代 || "" */}
                                <img src={currentHeroInfo.image_url || null} className="w-full h-full rounded-full object-cover transform group-hover:scale-110 transition-transform" alt=""/>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-[#F0E6D2] leading-none group-hover:text-[#0AC8B9] transition-colors">{currentHeroInfo.name || "Loading..."}</h1>
                                <span className="text-[10px] text-[#C8AA6E] tracking-widest uppercase group-hover:text-white transition-colors">点击切换英雄</span>
                            </div>
                        </div>

                        <div className="h-6 w-[1px] bg-white/10 mx-2 hidden md:block" />
                        
                        <nav className="hidden md:flex gap-1">
                            {[
                                { id: 'wiki', label: '英雄总览', icon: BookOpen },
                                { id: 'feed', label: '攻略动态', icon: Layers },
                                { id: 'tavern', label: '酒馆闲聊', icon: Beer }, 
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewMode(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-sm text-sm font-medium transition-all ${viewMode === tab.id ? 'bg-[#C8AA6E] text-[#091428] shadow-[0_0_15px_rgba(200,170,110,0.3)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <tab.icon size={14} /> {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Right: Tools & User Profile */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button className="p-2 text-slate-400 hover:text-[#C8AA6E] hover:bg-white/5 rounded-full transition-colors">
                                <Search size={20} />
                            </button>
                            <button 
                                onClick={() => setShowPublishModal(true)}
                                className="bg-[#0AC8B9]/10 border border-[#0AC8B9]/50 text-[#0AC8B9] px-4 py-1.5 rounded-sm text-xs font-bold uppercase hover:bg-[#0AC8B9]/20 transition-all flex items-center gap-2"
                            >
                                <Edit3 size={14} /> 发布 / 贡献
                            </button>
                        </div>

                        <div className="h-8 w-[1px] bg-white/10 mx-1"></div>

                        {/* 用户卡片 & 下拉菜单 */}
                        <div className="relative">
                            <ConsoleHeaderUser 
                                {...userData}
                                onClick={() => setShowUserMenu(!showUserMenu)}
                            />
                            
                            {/* 下拉菜单 */}
                            {showUserMenu && (
                                <>
                                    {/* 透明遮罩，点击外部关闭 */}
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                                    
                                    <div className="absolute right-0 top-full mt-3 w-48 bg-[#091428] border border-[#C8AA6E]/30 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="h-1 bg-gradient-to-r from-[#091428] via-[#C8AA6E] to-[#091428]"></div>
                                        
                                        <div className="p-1 flex flex-col gap-0.5">
                                            {/* 1. 个人主页 */}
                                            <button 
                                                onClick={() => {
                                                    setShowUserMenu(false);
                                                    onShowProfile && onShowProfile();
                                                }}
                                                className="w-full text-left px-4 py-3 text-slate-300 hover:bg-[#C8AA6E]/10 hover:text-[#C8AA6E] transition-all flex items-center gap-3 rounded-lg group"
                                            >
                                                <User size={16} className="text-slate-500 group-hover:text-[#C8AA6E] transition-colors"/> 
                                                <span className="font-bold text-sm">个人主页</span>
                                            </button>

                                            {/* 2. 全局设置 (新增) */}
                                            <button 
                                                onClick={() => {
                                                    setShowUserMenu(false);
                                                    onShowSettings && onShowSettings();
                                                }}
                                                className="w-full text-left px-4 py-3 text-slate-300 hover:bg-white/5 hover:text-white transition-all flex items-center gap-3 rounded-lg group"
                                            >
                                                <Settings size={16} className="text-slate-500 group-hover:text-white transition-colors"/> 
                                                <span className="font-bold text-sm">全局设置</span>
                                            </button>

                                            {/* 3. 管理后台 (新增 - 仅管理员) */}
                                            {onShowAdmin && isAdmin && (
                                                <button 
                                                    onClick={() => {
                                                        setShowUserMenu(false);
                                                        onShowAdmin();
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-red-400 hover:bg-red-900/20 transition-all flex items-center gap-3 rounded-lg group"
                                                >
                                                    <ShieldAlert size={16} className="text-red-500/70 group-hover:text-red-400 transition-colors"/> 
                                                    <span className="font-bold text-sm">管理后台</span>
                                                </button>
                                            )}
                                            
                                            <div className="h-[1px] bg-white/5 my-1 mx-2"></div>

                                            {/* 4. 退出登录 */}
                                            <button 
                                                onClick={() => {
                                                    setShowUserMenu(false);
                                                    onLogout && onLogout();
                                                }}
                                                className="w-full text-left px-4 py-3 text-slate-400 hover:bg-white/5 hover:text-white transition-all flex items-center gap-3 rounded-lg group"
                                            >
                                                <LogOut size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors"/> 
                                                <span className="font-medium text-sm">退出登录</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Nav */}
            <div className="md:hidden flex justify-between px-6 py-2 border-b border-white/5 bg-[#010A13]/95 backdrop-blur sticky top-16 z-30">
                {[
                    { id: 'wiki', label: '总览', icon: BookOpen },
                    { id: 'feed', label: '攻略', icon: Layers },
                    { id: 'tavern', label: '酒馆', icon: Beer }, 
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setViewMode(tab.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium transition-all ${viewMode === tab.id ? 'text-[#C8AA6E] bg-[#C8AA6E]/10' : 'text-slate-400'}`}
                    >
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <main className="max-w-[1800px] mx-auto px-6 py-8 relative z-10 min-h-[80vh]">
                {viewMode === 'wiki' && <WikiSection heroInfo={currentHeroInfo} summary={wikiSummary} onLinkClick={handleLinkClick} />}
                
                {/* 🔥 [修改] 酒馆模式下传入全服通用的 heroInfo，避免标题显示特定英雄名 */}
                {viewMode === 'tavern' && <TavernSection 
                    heroInfo={{ 
                        name: "全联盟", 
                        title: "Global Tavern", 
                        alias: "Tavern", 
                        image_url: "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png" 
                    }}
                    tavernPosts={tavernPosts} 
                    onPostLike={handleTavernLike} 
                    onPostClick={setSelectedPost}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    onDelete={handleDeleteTavern}
                    onEdit={handleEditPost} 
                />}
                
                {viewMode === 'feed' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="md:col-span-2 space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2"><TrendingUp size={14} /> 最新攻略</h3>
                            {posts.map(post => (
                                <GlassCard key={post.id} className="p-5 flex gap-4 relative group" onClick={() => { setSelectedPost(post); }}>
                                    {(isAdmin || post.author === currentUser) && (
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditPost(post); }}
                                                className="p-1.5 text-slate-500 hover:text-[#C8AA6E] hover:bg-[#C8AA6E]/10 rounded transition-all"
                                                title="编辑"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
                                                className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                                title="删除"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            {post.isAiPick && <span className="bg-[#0AC8B9] text-[#091428] text-[10px] font-bold px-1.5 rounded flex items-center gap-1"><Zap size={10} fill="currentColor"/> AI Pick</span>}
                                            <span className="text-[#C8AA6E] text-[10px] bg-[#C8AA6E]/10 border border-[#C8AA6E]/20 px-1.5 rounded font-mono">{post.refId}</span>
                                        </div>
                                        <h3 className="text-lg text-slate-200 font-bold mb-2 hover:text-[#0AC8B9] cursor-pointer transition-colors">{post.title}</h3>
                                        <p className="text-slate-400 text-sm line-clamp-2">{post.content}</p>
                                    </div>
                                    <div className="flex flex-col items-center justify-center gap-1 text-slate-500 border-l border-white/5 pl-4">
                                        <div className="cursor-pointer hover:text-[#C8AA6E] transition-colors"><ThumbsUp size={16} /></div>
                                        <span className="text-xs font-mono">{post.likes}</span>
                                    </div>
                                </GlassCard>
                            ))}
                            {posts.length === 0 && (
                                <div className="p-8 text-center text-slate-500 bg-white/5 rounded border border-white/5">
                                    暂无相关攻略，快来抢占沙发！
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2"><Clock size={14} /> 最新动态</h3>
                            <div className="p-4 bg-[#091428]/40 border border-white/5 rounded text-center text-slate-500 text-xs">暂无热门动态</div>
                        </div>
                    </div>
                )}
            </main>

            <ChampSelectModal 
                isOpen={isSelectorOpen} 
                onClose={() => setIsSelectorOpen(false)}
                championList={championList} 
                onSelect={(hero) => {
                    setCurrentHeroId(hero.id); 
                    setIsSelectorOpen(false);
                    toast.success(`已切换至：${hero.name}`);
                }}
                roleMapping={roleMapping || {}} 
                initialRoleIndex={0} 
            />

            <PublishModal 
                isOpen={showPublishModal} 
                onClose={() => { setShowPublishModal(false); setEditingPost(null); }} 
                heroInfo={currentHeroInfo}
                championList={championList}
                onSuccess={handlePublishSuccess}
                initialData={editingPost} 
                initialTab={editingPost && !editingPost.title ? 'tavern' : 'wiki'}
                token={token}
            />

            <MiniMasteryWidget currentHero={currentHeroInfo} opponentHero={opponentHeroInfo} posts={posts} onNavigateToPost={setSelectedPost} />

            <PostDetailModal 
                post={selectedPost} 
                onClose={() => setSelectedPost(null)} 
                championList={championList} 
                currentUser={currentUser}
                isAdmin={isAdmin}
                onDelete={handleDeletePost}
                onEdit={handleEditPost}
            />
        </div>
    );
}