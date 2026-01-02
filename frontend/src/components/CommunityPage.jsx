import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronLeft, BookOpen, Beer, Flame, ThumbsUp, Share2, PenTool, Clock, Grid3X3, FileText, User, Swords, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../config/constants';
import TipModal from './modals/TipModal'; 
import ChampSelectModal from './modals/ChampSelectModal'; 

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
    // 新增 roleMapping 状态，用于支持高级选择器的分类功能
    const [roleMapping, setRoleMapping] = useState({});
    
    const [showPostModal, setShowPostModal] = useState(false);
    const [postContent, setPostContent] = useState("");
    const [postTarget, setPostTarget] = useState(""); 

    // 注意：useGameCore 中 key 是英文名(如Camille)，id 是数字字符串
    // 这里做个兼容查找，优先匹配 key (英文ID)
    const currentHeroInfo = championList.find(c => c.key === currentHeroId || c.id === currentHeroId) || { name: currentHeroId, title: "英雄" };

    const fetchTips = async () => {
        setLoading(true);
        try {
            // 请求 ALL_MATCHUPS 以获取所有类型数据
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

    // 初始化时获取英雄定位数据
    useEffect(() => {
        axios.get(`${API_BASE_URL}/champions/roles`)
            .then(res => setRoleMapping(res.data))
            .catch(e => console.error("Failed to load roles", e));
    }, []);

    useEffect(() => {
        fetchTips();
        setActiveCategory("全部");
    }, [currentHeroId]);

    const handlePostSubmit = async (finalTarget, selectedCategory) => {
        if (!currentUser) return toast.error("请先登录");
        if (!postContent.trim()) return toast.error("内容不能为空");

        try {
            // 优化发布逻辑：如果目标是"通用"或者在酒馆板块，则标记为 is_general
            const isGeneralPost = activeTab === 'tavern' || !finalTarget || finalTarget === "通用";

            await axios.post(`${API_BASE_URL}/tips`, {
                hero: currentHeroInfo.name,
                enemy: finalTarget,
                content: postContent,
                is_general: isGeneralPost
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
            // 绝活兵法板块
            if (activeCategory === "全部") {
                // 🔥 修改点：在“全部”分类下，保留通用和对位所有内容
            } else if (activeCategory === "上单对位") {
                const keywords = ["打野联动", "团战处理", "出装流派", "通用"];
                items = items.filter(t => t.enemy && !keywords.includes(t.enemy) && !t.is_general);
            } else {
                items = items.filter(t => t.enemy === activeCategory);
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
                             displayItems.length > 0 ? displayItems.map((m) => {
                                // 判断是否是对线技巧
                                const isMatchup = m.enemy && !["通用", "全部"].includes(m.enemy) && !m.is_general;
                                
                                return (
                                <div key={m.id} className="bg-[#121b29]/60 border border-white/5 rounded-xl overflow-hidden hover:border-[#C8AA6E]/30 transition-all flex flex-col md:flex-row group">
                                    <div className="p-4 md:w-40 bg-black/20 border-b md:border-b-0 md:border-r border-white/5 flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 text-center shrink-0">
                                        <div className="flex items-center gap-2">
                                            {isMatchup ? (
                                                <div className="relative group/avatar cursor-help">
                                                    <div className="w-12 h-12 rounded-lg bg-red-900/20 border border-red-900/50 flex items-center justify-center text-xs font-bold text-red-400 overflow-hidden">{m.enemy[0]}</div>
                                                    <div className="absolute -bottom-2 -right-2 bg-red-600 text-[8px] px-1 rounded border border-black font-bold text-white shadow-sm">VS</div>
                                                </div>
                                            ) : (
                                                <div className={`w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center border border-white/10 ${activeTab === 'tavern' ? 'text-blue-400' : 'text-[#0AC8B9]'}`}>
                                                    {activeTab === 'tavern' ? <User size={20}/> : <Info size={20}/>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <div className="text-[10px] text-slate-500 px-2 py-1 rounded bg-white/5 border border-white/5">
                                                {isMatchup ? m.enemy : (m.is_general ? "通用心得" : (m.enemy || "未分类"))}
                                            </div>
                                            {/* 🔥 增加的标签：用于区分混合内容 */}
                                            {activeTab === 'wiki' && activeCategory === '全部' && (
                                                <span className={`text-[9px] mt-1 font-bold ${isMatchup ? 'text-red-500' : 'text-[#0AC8B9]'}`}>
                                                    {isMatchup ? '【对位】' : '【通用】'}
                                                </span>
                                            )}
                                        </div>
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
                            )}) : (
                                <div className="text-center py-20 text-slate-500 bg-[#121b29]/40 rounded-xl border border-white/5 border-dashed">
                                    <p>该分类下暂无内容</p>
                                    <button onClick={() => setShowPostModal(true)} className="mt-2 text-[#C8AA6E] text-xs hover:underline">发布第一条</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. Discuss (Mock) - 已恢复完整代码 */}
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

            <ChampSelectModal
                isOpen={showChampSelector}
                onClose={() => setShowChampSelector(false)}
                championList={championList}
                onSelect={(hero) => {
                    setCurrentHeroId(hero.key); 
                    setShowChampSelector(false);
                    toast.success(`已进入 ${hero.name} 社区`);
                }}
                roleMapping={roleMapping} 
            />

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