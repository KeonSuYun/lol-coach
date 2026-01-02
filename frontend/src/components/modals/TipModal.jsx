import React, { useState, useEffect, useMemo } from 'react';
import { X, PenTool, Swords, Search, Check, AlertCircle } from 'lucide-react';

export default function TipModal({ isOpen, onClose, content, setContent, onSubmit, heroName, activeTab, championList = [] }) {
    if (!isOpen) return null;

    // 分类定义
    const CATEGORIES = activeTab === 'wiki' 
        ? ["上单对位", "打野联动", "团战处理", "出装流派"]
        : ["高光", "讨论", "求助", "吐槽"];

    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    
    // === 英雄选择器状态 ===
    const [targetSearch, setTargetSearch] = useState(""); 
    const [selectedTargetHero, setSelectedTargetHero] = useState(null); 
    const [showDropdown, setShowDropdown] = useState(false);

    // 重置状态
    useEffect(() => {
        if (isOpen) {
            setSelectedCategory(CATEGORIES[0]);
            setTargetSearch("");
            setSelectedTargetHero(null);
            setShowDropdown(false);
        }
    }, [activeTab, isOpen, CATEGORIES[0]]);

    // 🔍 修复：搜索逻辑增强，支持中文名(name)、称号(title)、英文ID(key)
    const filteredChampions = useMemo(() => {
        if (!targetSearch) return championList;
        const lower = targetSearch.toLowerCase();
        return championList.filter(c => 
            c.name.includes(lower) || 
            c.title.includes(lower) || 
            (c.key && c.key.toLowerCase().includes(lower)) || // 支持英文ID搜索 (如 Darius)
            (c.id && c.id.toString().includes(lower))         // 支持数字ID搜索
        );
    }, [championList, targetSearch]);

    const handleSubmit = () => {
        let finalTarget = selectedCategory;
        
        // 如果是“上单对位”，必须选择英雄
        if (selectedCategory === "上单对位") {
            if (!selectedTargetHero) {
                alert("请先选择一个对位英雄！"); // 简单的阻断提示
                return;
            }
            // 存英雄中文名 (后端如需要英文名，可改为 selectedTargetHero.key)
            finalTarget = selectedTargetHero.name; 
        }
        
        onSubmit(finalTarget, selectedCategory);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-lg bg-[#091428] border border-[#C8AA6E]/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* 标题 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#010A13] shrink-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <PenTool size={18} className="text-[#C8AA6E]" />
                        <span>发布{activeTab === 'wiki' ? '攻略' : '动态'}</span>
                        <span className="text-xs text-slate-500">({heroName})</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                    
                    {/* 1. 标签选择 */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">选择分类</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => { setSelectedCategory(cat); setShowDropdown(false); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                        selectedCategory === cat
                                            ? 'bg-[#C8AA6E] text-[#091428] border-[#C8AA6E]'
                                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. 对位英雄选择器 (仅在"上单对位"显示) */}
                    {selectedCategory === "上单对位" && (
                        <div className="animate-in slide-in-from-top-2 duration-200 relative">
                            <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider flex items-center gap-1">
                                <Swords size={12}/> 选择对线英雄 <span className="text-red-500">*</span>
                            </label>
                            
                            {/* 选中的展示框 */}
                            <div 
                                onClick={() => setShowDropdown(!showDropdown)}
                                className={`w-full bg-black/30 border ${showDropdown ? 'border-[#C8AA6E]' : 'border-white/10'} rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer hover:border-white/30 transition-colors`}
                            >
                                {selectedTargetHero ? (
                                    <div className="flex items-center gap-3">
                                        <img src={selectedTargetHero.image_url} className="w-8 h-8 rounded-full border border-[#C8AA6E]" alt={selectedTargetHero.name} />
                                        <div>
                                            <span className="text-[#C8AA6E] font-bold text-sm block">{selectedTargetHero.name}</span>
                                            <span className="text-[10px] text-slate-500 block leading-none">{selectedTargetHero.title}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-slate-500 text-sm flex items-center gap-2">
                                        <Search size={14}/> 点击搜索敌方英雄...
                                    </span>
                                )}
                                <div className={`text-slate-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`}>▼</div>
                            </div>

                            {/* 下拉选择列表 */}
                            {showDropdown && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-[#010A13] border border-[#C8AA6E]/30 rounded-lg shadow-xl z-50 max-h-60 flex flex-col">
                                    <div className="p-2 border-b border-white/5 sticky top-0 bg-[#010A13] z-10">
                                        <input 
                                            autoFocus
                                            type="text" 
                                            placeholder="输入名字/拼音/英文 (如: 诺手 / Darius)" 
                                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#C8AA6E]"
                                            value={targetSearch}
                                            onChange={(e) => setTargetSearch(e.target.value)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="overflow-y-auto custom-scrollbar p-1">
                                        {filteredChampions.length > 0 ? filteredChampions.map(hero => (
                                            <div 
                                                key={hero.id}
                                                onClick={() => {
                                                    setSelectedTargetHero(hero);
                                                    setShowDropdown(false);
                                                    setTargetSearch("");
                                                }}
                                                className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer group transition-colors"
                                            >
                                                <img src={hero.image_url} className="w-8 h-8 rounded border border-transparent group-hover:border-[#C8AA6E]" alt={hero.name} />
                                                <div>
                                                    <div className="text-xs font-bold text-slate-200 group-hover:text-white">{hero.name}</div>
                                                    <div className="text-[10px] text-slate-500 group-hover:text-slate-400">{hero.title}</div>
                                                </div>
                                                {selectedTargetHero?.id === hero.id && <Check size={14} className="ml-auto text-[#0AC8B9]"/>}
                                            </div>
                                        )) : (
                                            <div className="p-4 text-center text-xs text-slate-500">未找到相关英雄</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. 内容输入 */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">内容</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={activeTab === 'wiki' ? "输入对线细节，如：一级学W，三级前猥琐，利用草丛规避仇恨..." : "分享你的游戏心情..."}
                            className="w-full h-32 bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-slate-200 focus:border-[#C8AA6E] focus:outline-none resize-none custom-scrollbar placeholder:text-slate-600"
                        />
                    </div>

                    {/* 错误提示区 (如果有) */}
                    {selectedCategory === "上单对位" && !selectedTargetHero && (
                        <div className="flex items-center gap-2 text-[10px] text-yellow-500 bg-yellow-500/10 px-3 py-2 rounded border border-yellow-500/20">
                            <AlertCircle size={12} />
                            <span>发布对位攻略前，请务必选择一个敌方英雄。</span>
                        </div>
                    )}

                    <button 
                        onClick={handleSubmit} 
                        disabled={selectedCategory === "上单对位" && !selectedTargetHero}
                        className={`w-full py-3 font-black rounded-lg shadow-lg transition-all flex items-center justify-center gap-2
                            ${selectedCategory === "上单对位" && !selectedTargetHero 
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-[#C8AA6E] to-[#b89a5e] hover:brightness-110 text-[#091428] cursor-pointer active:scale-[0.98]'
                            }
                        `}
                    >
                        立即发布
                    </button>
                </div>
            </div>
        </div>
    );
}