import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, BookOpen, Beer, Flame, ThumbsUp, Share2, PenTool, Clock, Grid3X3, FileText, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../config/constants';
import TipModal from './modals/TipModal'; 

const THEME = {
    textMain: "text-[#C8AA6E]", 
    accent: "text-[#0AC8B9]",
    borderAccent: "border-[#C8AA6E]",
    bgGradient: "bg-gradient-to-b from-[#091428] via-[#0A1428] to-[#050810]",
    btnActive: "bg-[#C8AA6E]/10 text-[#C8AA6E] border-[#C8AA6E] shadow-[0_0_10px_rgba(200,170,110,0.2)]",
    btnInactive: "bg-[#091428]/60 text-slate-500 border-white/5 hover:text-slate-300 hover:bg-[#091428]"
};

// 预定义分类
const WIKI_CATEGORIES = ["全部", "上单对位", "打野联动", "团战处理", "出装流派"];
const TAVERN_CATEGORIES = ["全部", "高光", "讨论", "求助", "吐槽"];

// 模拟长文数据 (Mock)
const MOCK_ARTICLES = [
    { id: 101, title: "S15 赛季上单生态报告", summary: "深度解析新版本地图改动对上路生态的影响...", author: "Bin导", rank: "王者", views: "10w+", likes: 5600, date: "2024-03-15", cover: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Camille_1.jpg" },
    { id: 102, title: "对抗诺手的100个细节", summary: "如何规避外圈刮？什么血量可以斩杀？", author: "上单老祖", rank: "宗师", views: "4.5w", likes: 2300, date: "2024-02-20", cover: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Darius_2.jpg" }
];

export default function CommunityPage({ onBack, championList = [], currentUser, token }) {
    const [currentHeroId, setCurrentHeroId] = useState("Camille");
    const [activeTab, setActiveTab] = useState("wiki");
    const [activeCategory, setActiveCategory] = useState("全部");
    const [sortBy, setSortBy] = useState("new");
    
    const [tips, setTips] = useState([]);
    const [loading, setLoading] = useState(false);

    const [showChampSelector, setShowChampSelector] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
    const [showPostModal, setShowPostModal] = useState(false);
    const [postContent, setPostContent] = useState("");
    const [postTarget, setPostTarget] = useState(""); 

    const currentHeroInfo = championList.find(c => c.id === currentHeroId) || { name: currentHeroId, title: "英雄" };

    const fetchTips = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/tips`, { 
                params: { hero: currentHeroInfo.name, enemy: "ALL_MATCHUPS" } 
            });
            setTips(res.data);
        } catch (e) {
            setTips([]); 
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTips();
        setActiveCategory("全部");
    }, [currentHeroId]);

    const handlePostSubmit = async (finalTarget, selectedCategory) => {
        if (!currentUser) return toast.error("请先登录");
        if (!postContent.trim()) return toast.error("内容不能为空");

        try {
            await axios.post(`${API_BASE_URL}/tips`, {
                hero: currentHeroInfo.name,
                enemy: finalTarget,
                content: postContent,
                is_general: activeTab === 'tavern'
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success("发布成功！");
            setShowPostModal(false);
            setPostContent("");
            await fetchTips();
            setSortBy("new");
            setActiveCategory("全部");
        } catch (e) { 
            toast.error("发布失败"); 
        }
    };

    const handleLike = async (tipId) => {
        if (!currentUser) return toast.error("请先登录");
        try {
            await axios.post(`${API_BASE_URL}/like`, { tip_id: tipId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTips(prev => prev.map(t => t.id === tipId ? { ...t, like_count: (t.like_count || 0) + 1, has_liked: true } : t));
            toast.success("点赞成功");
        } catch (e) { 
            toast.error("操作失败"); 
        }
    };

    const displayItems = useMemo(() => {
        let items = [...tips];

        if (activeTab === 'wiki') {
            items = items.filter(t => !t.is_general);
            if (activeCategory !== "全部") {
                if (activeCategory === "上单对位") {
                    const keywords = ["打野联动", "团战处理", "出装流派", "通用"];
                    items = items.filter(t => t.enemy && !keywords.includes(t.enemy));
                } else {
                    items = items.filter(t => t.enemy === activeCategory);
                }
            }
        } else if (activeTab === 'tavern') {
            items = items.filter(t => t.is_general);
            if (activeCategory !== "全部") {
                items = items.filter(t => t.enemy === activeCategory);
            }
        } else {
            return [];
        }

        return items.sort((a, b) => {
            if (sortBy === 'hot') return (b.like_count || 0) - (a.like_count || 0);
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
    }, [tips, activeTab, activeCategory, sortBy]);

    const filteredChampions = useMemo(() => {
        if (!searchTerm) return championList;
        const lower = searchTerm.toLowerCase();
        return championList.filter(c => c.name.includes(lower) || c.id.toLowerCase().includes(lower) || c.title.includes(lower));
    }, [championList, searchTerm]);

    return (
        <div className={`fixed inset-0 z-50 flex flex-col ${THEME.bgGradient} text-slate-200 overflow-hidden transition-colors duration-700`}>
            
            {/* Header */}
            <div className="relative z-20 px-4 py-4 flex items-center justify-between bg-[#091428]/90 backdrop-blur-md border-b border-white/5">
                <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-2 text-slate-400 hover:text-white">
                    <ChevronLeft size={24} />
                    <span className="text-sm font-bold hidden md:inline">返回大厅</span>
                </button>
                <button onClick={() => setShowChampSelector(true)} className="flex items-center gap-3 group px-4 py-2 rounded-lg hover:bg-white/5 transition-all">
                    <div className="text-right">
                        <div className={`text-sm font-black tracking-widest ${THEME.textMain} group-hover:brightness-125 transition-all`}>{currentHeroInfo.name}</div>
                        <div className="text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-80">点击切换英雄</div>
                    </div>
                    <Grid3X3 size={20} className={`${THEME.textMain} opacity-70 group-hover:scale-110 transition-transform`}/>
                </button>
                <div className="w-10"></div>
            </div>

            {/* Banner */}
            <div className="relative h-48 md:h-64 shrink-0 flex items-center justify-center overflow-hidden group border-b border-[#C8AA6E]/20">
                <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay">
                    <img src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${currentHeroId}_0.jpg`} className="w-full h-full object-cover object-top transform group-hover:scale-105 transition-transform duration-[10s]" onError={(e) => e.target.src = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg"} />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#091428] via-[#091428]/50 to-transparent z-10"></div>
                <div className="relative z-20 text-center transform translate-y-2">
                    <h1 className={`text-4xl md:text-6xl font-black tracking-tighter italic ${THEME.textMain} drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]`}>{currentHeroInfo.name.split(' ')[0]}</h1>
                    <p className="text-xs font-bold tracking-[0.5em] text-slate-400 uppercase mt-2">{currentHeroInfo.title}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-center gap-4 px-4 -mt-6 relative z-30">
                {[{ id: 'wiki', label: '绝活兵法', icon: <BookOpen size={16}/> }, { id: 'discuss', label: '深度长文', icon: <FileText size={16}/> }, { id: 'tavern', label: '酒馆吹水', icon: <Beer size={16}/> }].map(tab => (
                    <button key={tab.id} onClick={() => { setActiveTab(tab.id); setActiveCategory("全部"); }} className={`relative px-6 py-3 rounded-lg border flex items-center justify-center gap-2 transition-all duration-300 shadow-lg backdrop-blur-md ${activeTab === tab.id ? `${THEME.btnActive} transform -translate-y-1` : THEME.btnInactive}`}>
                        <div className={activeTab === tab.id ? THEME.textMain : ''}>{tab.icon}</div>
                        <span className="text-sm font-bold tracking-wider">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
                
                {/* 1. Wiki & Tavern (共享列表逻辑) */}
                {(activeTab === 'wiki' || activeTab === 'tavern') && (
                    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
                        {/* Filters */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sticky top-0 z-20 bg-[#091428]/95 backdrop-blur-md p-3 rounded-xl border border-white/5 shadow-xl">
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                                {(activeTab === 'wiki' ? WIKI_CATEGORIES : TAVERN_CATEGORIES).map(category => (
                                    <button key={category} onClick={() => setActiveCategory(category)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${activeCategory === category ? THEME.btnActive : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}>{category}</button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                                    <button onClick={() => setSortBy('hot')} className={`px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${sortBy === 'hot' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Flame size={12}/> 热度</button>
                                    <button onClick={() => setSortBy('new')} className={`px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all ${sortBy === 'new' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Clock size={12}/> 最新</button>
                                </div>
                                <button onClick={() => { setPostTarget(""); setShowPostModal(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-[#0AC8B9] hover:bg-[#08998C] text-[#091428] text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(10,200,185,0.4)] transition-all">
                                    <PenTool size={14}/> 发布
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="space-y-4">
                            {loading ? <div className="text-center py-10 text-slate-500">加载中...</div> : 
                             displayItems.length > 0 ? displayItems.map((m) => (
                                <div key={m.id} className="bg-[#121b29]/60 border border-white/5 rounded-xl overflow-hidden hover:border-[#C8AA6E]/30 transition-all flex flex-col md:flex-row group">
                                    <div className="p-4 md:w-40 bg-black/20 border-b md:border-b-0 md:border-r border-white/5 flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 text-center shrink-0">
                                        <div className="flex items-center gap-2">
                                            {activeTab === 'wiki' && m.enemy && !WIKI_CATEGORIES.includes(m.enemy) && m.enemy !== "通用" ? (
                                                <div className="relative group/avatar cursor-help">
                                                    <div className="w-12 h-12 rounded-lg bg-red-900/20 border border-red-900/50 flex items-center justify-center text-xs font-bold text-red-400 overflow-hidden">{m.enemy[0]}</div>
                                                    <div className="absolute -bottom-2 -right-2 bg-red-600 text-[8px] px-1 rounded border border-black font-bold text-white shadow-sm">VS</div>
                                                </div>
                                            ) : (
                                                <div className={`w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center border border-white/10 ${activeTab === 'tavern' ? 'text-blue-400' : 'text-slate-500'}`}>
                                                    {activeTab === 'tavern' ? <User size={20}/> : <BookOpen size={20}/>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 px-2 py-1 rounded bg-white/5 border border-white/5">{m.enemy || "未分类"}</div>
                                    </div>
                                    <div className="flex-1 p-4 flex flex-col justify-between">
                                        <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap">{m.content}</p>
                                        <div className="flex items-center justify-between text-xs pt-3 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">{(m.author || "U")[0]}</div>
                                                <span className={`font-bold ${THEME.textMain}`}>{m.author || "匿名用户"}</span>
                                                <span className="text-slate-600 scale-90 ml-1">{new Date(m.created_at || Date.now()).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex gap-4">
                                                <button onClick={() => handleLike(m.id)} className={`flex items-center gap-1 transition-colors ${m.has_liked ? THEME.textMain : 'text-slate-500 hover:text-slate-300'}`}><ThumbsUp size={14} className={m.has_liked ? "fill-current" : ""}/> {m.like_count || 0}</button>
                                                <button className="flex items-center gap-1 text-slate-500 hover:text-white transition-colors"><Share2 size={14}/> 分享</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-20 text-slate-500 bg-[#121b29]/40 rounded-xl border border-white/5 border-dashed">
                                    <p>该分类下暂无内容</p>
                                    <button onClick={() => setShowPostModal(true)} className="mt-2 text-[#C8AA6E] text-xs hover:underline">发布第一条</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. Discuss (Mock) */}
                {activeTab === 'discuss' && (
                    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><FileText size={20} className={THEME.textMain}/> 宗师级 · 深度长文</h3>
                            <button className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-lg border border-white/10 transition-all"><PenTool size={14}/> 投稿文章</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {MOCK_ARTICLES.map((article) => (
                                <div key={article.id} className="group relative bg-[#121b29]/60 border border-white/5 rounded-2xl overflow-hidden hover:border-[#C8AA6E]/30 hover:-translate-y-1 transition-all cursor-pointer">
                                    <div className="h-40 overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#121b29] to-transparent z-10"></div>
                                        <img src={article.cover} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                        <div className="absolute bottom-3 left-3 z-20 flex gap-2">
                                            <span className="px-2 py-0.5 rounded bg-black/50 backdrop-blur text-[10px] text-white border border-white/10">S15</span>
                                            <span className="px-2 py-0.5 rounded bg-[#0AC8B9]/20 text-[#0AC8B9] border border-[#0AC8B9]/30 font-bold">万字长文</span>
                                        </div>
                                    </div>
                                    <div className="p-5">
                                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-[#C8AA6E] transition-colors">{article.title}</h3>
                                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-4">{article.summary}</p>
                                        <div className="flex items-center justify-between text-xs pt-4 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold">{article.author[0]}</div>
                                                <div><div className="text-slate-200 font-bold">{article.author}</div><div className="text-[9px] text-[#C8AA6E]">{article.rank}</div></div>
                                            </div>
                                            <div className="flex items-center gap-4 text-slate-500"><span className="flex items-center gap-1"><BookOpen size={12}/> {article.views}</span><span className="flex items-center gap-1"><ThumbsUp size={12}/> {article.likes}</span></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Champ Selector Modal */}
            {showChampSelector && (
                <div className="fixed inset-0 z-[60] bg-[#091428]/95 backdrop-blur-xl flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="px-8 py-6 flex items-center gap-6 border-b border-[#C8AA6E]/20 bg-gradient-to-r from-[#091428] to-[#010A13]">
                        <Search size={24} className="text-[#C8AA6E]"/>
                        <input type="text" placeholder="搜索英雄..." className="flex-1 bg-transparent border-none outline-none text-[#F0E6D2] text-2xl placeholder-slate-600 font-bold uppercase tracking-wider" autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        <button onClick={() => setShowChampSelector(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"><X size={32}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-4 max-w-[1920px] mx-auto">
                            {filteredChampions.length > 0 ? filteredChampions.map(c => (
                                <button key={c.id} onClick={() => { setCurrentHeroId(c.id); setShowChampSelector(false); setSearchTerm(""); toast.success(`已进入 ${c.name} 社区`); }} className="flex flex-col items-center gap-2 group relative">
                                    <div className={`relative w-16 h-16 md:w-20 md:h-20 transition-all duration-300 ${currentHeroId === c.id ? 'scale-110 border-2 border-[#C8AA6E]' : 'group-hover:scale-110'}`}>
                                        <div className={`absolute inset-0 border-2 border-[#C8AA6E] rotate-45 transition-all opacity-0 group-hover:opacity-100 ${currentHeroId === c.id ? 'opacity-100' : ''}`}></div>
                                        <div className="w-full h-full overflow-hidden border border-slate-700 group-hover:border-[#C8AA6E] transition-colors bg-slate-900">
                                            <img src={c.image_url} className={`w-full h-full object-cover transition-all duration-500 ${currentHeroId === c.id ? '' : 'grayscale group-hover:grayscale-0'}`} />
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold truncate w-full text-center tracking-wide transition-colors ${currentHeroId === c.id ? 'text-[#C8AA6E]' : 'text-slate-500 group-hover:text-[#F0E6D2]'}`}>{c.name}</span>
                                </button>
                            )) : <div className="col-span-full text-center py-20 text-slate-500"><p>未找到匹配的英雄</p></div>}
                        </div>
                    </div>
                </div>
            )}

            {/* Post Modal */}
            <TipModal 
                isOpen={showPostModal} 
                onClose={() => setShowPostModal(false)} 
                content={postContent} 
                setContent={setPostContent} 
                onSubmit={handlePostSubmit} 
                heroName={currentHeroInfo.name} 
                activeTab={activeTab} 
                championList={championList} 
            />
        </div>
    );
}