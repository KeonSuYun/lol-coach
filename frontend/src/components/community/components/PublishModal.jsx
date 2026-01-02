import React, { useState, useEffect } from 'react';
import { BookOpen, Beer, ChevronDown, X, Tag, Send, Image as ImageIcon, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CommunitySDK } from '../api/CommunitySDK';
import { CATEGORIES } from './PostDetailModal';
import { TAVERN_TOPICS } from './TavernSection';

// 🔥 [核心修复] 接收 token 参数
export default function PublishModal({ isOpen, onClose, heroInfo, championList, onSuccess, initialData = null, initialTab = 'wiki', token }) {
    const [activeTab, setActiveTab] = useState(initialTab);
    
    // Wiki States
    const [wikiTitle, setWikiTitle] = useState('');
    const [wikiCategory, setWikiCategory] = useState('matchup');
    const [wikiContent, setWikiContent] = useState('');
    const [wikiTags, setWikiTags] = useState('');
    const [wikiOpponent, setWikiOpponent] = useState(null);
    const [opponentSearch, setOpponentSearch] = useState('');
    
    // Tavern States
    const [tavernTopic, setTavernTopic] = useState('chat');
    const [tavernContent, setTavernContent] = useState('');

    useEffect(() => {
        if (isOpen && initialData) {
            if (initialTab === 'wiki') {
                setWikiTitle(initialData.title || '');
                setWikiContent(initialData.content || '');
                setWikiCategory(initialData.category || 'matchup');
                setWikiTags(initialData.tags?.join(' ') || '');
                if (initialData.opponentId) {
                    const opp = championList.find(c => c.key === initialData.opponentId);
                    setWikiOpponent(opp || null);
                }
            } else {
                setTavernContent(initialData.content || '');
                setTavernTopic(initialData.topic || 'chat');
            }
        } else if (isOpen && !initialData) {
            setWikiTitle(''); setWikiContent(''); setWikiCategory('matchup'); setWikiTags(''); setWikiOpponent(null);
            setTavernContent(''); setTavernTopic('chat');
        }
    }, [isOpen, initialData, initialTab, championList]);

    if (!isOpen) return null;

    const filteredOpponents = championList.filter(c => 
        c.name.includes(opponentSearch) || c.alias.toLowerCase().includes(opponentSearch.toLowerCase())
    ).slice(0, 5);

    const handleSubmit = async () => {
        // 🔥 [核心修复] 发布前检查 Token
        if (!token && !localStorage.getItem('token')) {
            toast.error("您处于游客模式 (仅同步游戏信息)，无法发布内容。请点击头像登录社区账号。");
            return;
        }

        const isEdit = !!initialData;
        
        try {
            if (activeTab === 'wiki') {
                if (!wikiTitle || !wikiContent) return toast.error("标题和内容不能为空");
                
                const payload = {
                    title: wikiTitle,
                    content: wikiContent,
                    category: wikiCategory,
                    tags: wikiTags.split(' ').filter(t => t),
                    opponentId: wikiOpponent?.key || null,
                    heroId: heroInfo.key
                };

                if (isEdit) {
                    await CommunitySDK.updatePost(initialData.id, payload);
                    toast.success("攻略更新成功");
                } else {
                    await CommunitySDK.publishGuide(payload);
                    toast.success("攻略发布成功");
                }
            } else {
                if (!tavernContent) return toast.error("内容不能为空");
                
                const payload = {
                    content: tavernContent,
                    topic: tavernTopic,
                    heroId: heroInfo.key
                };

                if (isEdit) {
                    await CommunitySDK.updateTavernPost(initialData.id, payload);
                    toast.success("动态更新成功");
                } else {
                    await CommunitySDK.publishTavernPost({ ...payload, avatar: heroInfo.alias });
                    toast.success("动态发布成功");
                }
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(isEdit ? "更新失败：请检查网络或权限" : "发布失败：请检查网络或权限");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#010A13] border border-[#C8AA6E] shadow-[0_0_50px_rgba(200,170,110,0.1)] flex flex-col max-h-[90vh]">
                <div className="flex border-b border-[#C8AA6E]/20">
                    <div className="flex-1 py-4 text-center text-sm font-bold uppercase tracking-widest text-[#C8AA6E]">
                        {initialData ? "编辑内容" : (activeTab === 'wiki' ? "贡献攻略" : "发布动态")}
                    </div>
                    {!initialData && (
                        <div className="flex bg-[#091428]">
                            <button onClick={() => setActiveTab('wiki')} className={`px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'wiki' ? 'text-[#C8AA6E] bg-white/5' : 'text-slate-500 hover:text-white'}`}>攻略</button>
                            <button onClick={() => setActiveTab('tavern')} className={`px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'tavern' ? 'text-[#0AC8B9] bg-white/5' : 'text-slate-500 hover:text-white'}`}>酒馆</button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#050810]">
                    {activeTab === 'wiki' ? (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs text-[#C8AA6E] font-bold mb-2">标题</label>
                                <input value={wikiTitle} onChange={e => setWikiTitle(e.target.value)} className="w-full bg-[#091428] border border-white/10 p-3 text-sm text-[#F0E6D2] focus:border-[#C8AA6E] outline-none rounded-sm placeholder:text-slate-600" placeholder="一句话概括你的核心思路..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-[#C8AA6E] font-bold mb-2">攻略分类</label>
                                    <div className="relative">
                                        <select value={wikiCategory} onChange={e => setWikiCategory(e.target.value)} className="w-full bg-[#091428] border border-white/10 p-2 text-sm text-slate-300 outline-none appearance-none rounded-sm">
                                            {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                    </div>
                                </div>
                                <div className={`transition-opacity ${wikiCategory === 'matchup' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                    <label className="block text-xs text-[#C8AA6E] font-bold mb-2">对位英雄</label>
                                    <div className="relative group">
                                        <div className="flex items-center bg-[#091428] border border-white/10 p-2 rounded-sm">
                                            {wikiOpponent ? (
                                                <div className="flex items-center gap-2 flex-1">
                                                    <img src={`https://game.gtimg.cn/images/lol/act/img/champion/${wikiOpponent.alias}.png`} className="w-5 h-5 rounded-full" alt=""/>
                                                    <span className="text-sm text-[#F0E6D2]">{wikiOpponent.name}</span>
                                                    <X size={14} className="ml-auto cursor-pointer hover:text-red-400" onClick={() => setWikiOpponent(null)} />
                                                </div>
                                            ) : (
                                                <input value={opponentSearch} onChange={e => setOpponentSearch(e.target.value)} placeholder="搜索对手..." className="bg-transparent border-none outline-none text-sm text-white flex-1 w-full" />
                                            )}
                                        </div>
                                        {opponentSearch && !wikiOpponent && (
                                            <div className="absolute top-full left-0 w-full bg-[#091428] border border-[#C8AA6E] z-20 max-h-32 overflow-y-auto">
                                                {filteredOpponents.map(h => (
                                                    <div key={h.heroId} onClick={() => { setWikiOpponent(h); setOpponentSearch(''); }} className="p-2 hover:bg-[#C8AA6E]/20 cursor-pointer flex items-center gap-2">
                                                        <img src={`https://game.gtimg.cn/images/lol/act/img/champion/${h.alias}.png`} className="w-4 h-4 rounded-full" alt=""/>
                                                        <span className="text-xs text-slate-300">{h.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-[#C8AA6E] font-bold mb-2">正文内容</label>
                                <textarea value={wikiContent} onChange={e => setWikiContent(e.target.value)} className="w-full h-40 bg-[#091428] border border-white/10 p-3 text-sm text-[#F0E6D2] focus:border-[#C8AA6E] outline-none rounded-sm resize-none placeholder:text-slate-600 custom-scrollbar" placeholder="详细描述你的技巧、出装顺序或对线细节..." />
                            </div>
                            <div>
                                <label className="block text-xs text-[#C8AA6E] font-bold mb-2">标签</label>
                                <div className="flex items-center bg-[#091428] border border-white/10 p-2 rounded-sm"><Tag size={14} className="text-slate-500 mr-2" /><input value={wikiTags} onChange={e => setWikiTags(e.target.value)} className="bg-transparent border-none outline-none text-sm text-white flex-1" placeholder="例如：前期 爆发" /></div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs text-[#0AC8B9] font-bold mb-2">话题分类</label>
                                <div className="flex flex-wrap gap-2">
                                    {TAVERN_TOPICS.filter(t => t.id !== 'all').map(t => (
                                        <button key={t.id} onClick={() => setTavernTopic(t.id)} className={`px-3 py-1.5 rounded-sm text-xs border transition-all flex items-center gap-2 ${tavernTopic === t.id ? 'bg-[#0AC8B9]/20 border-[#0AC8B9] text-[#0AC8B9]' : 'bg-[#091428] border-white/10 text-slate-400 hover:bg-white/5'}`}><t.icon size={12} /> {t.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-[#0AC8B9] font-bold mb-2">有什么想说的？</label>
                                <textarea value={tavernContent} onChange={e => setTavernContent(e.target.value)} className="w-full h-40 bg-[#091428] border border-white/10 p-3 text-sm text-[#F0E6D2] focus:border-[#0AC8B9] outline-none rounded-sm resize-none placeholder:text-slate-600 custom-scrollbar" placeholder="找队友、晒皮肤、聊八卦..." />
                            </div>
                            <div className="border border-dashed border-white/10 rounded-sm p-4 text-center text-slate-600 hover:border-[#0AC8B9]/50 hover:text-[#0AC8B9] cursor-pointer transition-colors"><ImageIcon size={24} className="mx-auto mb-2" /><span className="text-xs">添加图片 (可选)</span></div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-[#C8AA6E]/20 bg-[#0A1428] flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">取消</button>
                    <button onClick={handleSubmit} className={`px-8 py-2 rounded-sm text-xs font-bold text-[#091428] flex items-center gap-2 transition-all hover:brightness-110 active:scale-95 ${activeTab === 'wiki' ? 'bg-gradient-to-r from-[#C8AA6E] to-[#785A28]' : 'bg-gradient-to-r from-[#0AC8B9] to-[#087E7D]'}`}>
                        {initialData ? <Save size={14}/> : <Send size={14}/>} {initialData ? "更新" : "发布"}
                    </button>
                </div>
            </div>
        </div>
    );
}