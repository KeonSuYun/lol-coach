import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Shield, Swords, Zap, Crosshair, Brain, Grid } from 'lucide-react';

const ROLES = [
  { id: 'ALL', label: '全部', icon: <Grid size={14} /> },
  { id: 'TOP', label: '上单', icon: <Shield size={14} /> },
  { id: 'JUNGLE', label: '打野', icon: <Swords size={14} /> },
  { id: 'MID', label: '中单', icon: <Zap size={14} /> },
  { id: 'ADC', label: '下路', icon: <Crosshair size={14} /> },
  { id: 'SUPPORT', label: '辅助', icon: <Brain size={14} /> },
];

// 🟢 辅助：标准化键值 (移除空格标点，转小写) 以匹配后端的处理方式
const normalizeKey = (key) => key ? key.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";

// 🟢 严格检查函数：只使用后端传来的 roleMapping
const checkRole = (hero, roleId, roleMapping) => {
    // "全部" 标签显示所有人
    if (roleId === 'ALL') return true;

    if (roleMapping && Object.keys(roleMapping).length > 0) {
        // 使用清洗后的 Key 进行匹配 (解决 Miss Fortune vs MissFortune 的问题)
        const cleanKey = normalizeKey(hero.key); 
        const cleanName = normalizeKey(hero.name); 
        
        // 尝试用英文 ID 或 Name 去匹配配置表
        const heroRoles = roleMapping[cleanKey] || roleMapping[cleanName];
        
        if (heroRoles) {
            // 只有当 JSON 里明确写了该位置，才返回 True
            return heroRoles.includes(roleId);
        }
        // ⛔ 如果 JSON 里完全没这个英雄的数据，或者没配置 role，不显示
        return false;
    }

    // 如果 Mapping 尚未加载，不显示任何英雄，避免误导
    return false;
};

export default function ChampSelectModal({ isOpen, onClose, championList, onSelect, initialRoleIndex, roleMapping }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeRole, setActiveRole] = useState('ALL');

    useEffect(() => {
        if (isOpen && initialRoleIndex !== undefined) {
            const map = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
            if (map[initialRoleIndex]) setActiveRole(map[initialRoleIndex]);
            setSearchTerm("");
        }
    }, [isOpen, initialRoleIndex]);

    const filteredChamps = useMemo(() => {
        return championList.filter(c => {
            // 1. 搜索匹配 (支持中文名、称号、英文ID)
            const matchSearch = 
                c.name.includes(searchTerm) || 
                c.title.includes(searchTerm) || 
                c.key.toLowerCase().includes(searchTerm.toLowerCase());
            
            // 2. 分路匹配 (严格遵循 JSON)
            const matchRole = checkRole(c, activeRole, roleMapping);
            
            return matchSearch && matchRole;
        }).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }, [championList, searchTerm, activeRole, roleMapping]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div 
                className="w-full max-w-4xl h-[80vh] bg-hex-dark border border-hex-gold/50 rounded-xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-hex-gold/20 bg-hex-black flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-hex-gold-light tracking-widest uppercase">Select Champion</h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input 
                                type="text" 
                                placeholder="搜索英雄 (名字/称号)..." 
                                className="w-full bg-slate-900/50 border border-hex-gold/20 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:border-hex-gold/60 focus:outline-none focus:ring-1 focus:ring-hex-gold/60 transition-all placeholder:text-slate-600"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Role Tabs */}
                        <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0">
                            {ROLES.map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setActiveRole(role.id)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border
                                        ${activeRole === role.id 
                                            ? 'bg-hex-blue/20 text-hex-blue border-hex-blue/50 shadow-[0_0_10px_rgba(10,200,185,0.2)]' 
                                            : 'bg-transparent text-slate-500 border-transparent hover:bg-white/5 hover:text-slate-300'}
                                    `}
                                >
                                    {role.icon}
                                    <span>{role.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Grid Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#050C18]">
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {filteredChamps.map(hero => (
                            <button 
                                key={hero.key}
                                onClick={() => onSelect(hero)}
                                className="group flex flex-col items-center gap-2 p-2 rounded hover:bg-white/5 transition-all border border-transparent hover:border-hex-gold/30"
                            >
                                <div className="relative w-12 h-12 md:w-14 md:h-14 rounded border border-hex-gold/20 group-hover:border-hex-gold group-hover:shadow-[0_0_10px_rgba(200,170,110,0.3)] transition-all overflow-hidden">
                                    <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300" loading="lazy"/>
                                </div>
                                <span className="text-[10px] md:text-xs font-bold text-slate-400 group-hover:text-hex-gold-light text-center truncate w-full">
                                    {hero.name}
                                </span>
                            </button>
                        ))}
                        {filteredChamps.length === 0 && (
                            <div className="col-span-full text-center py-10 text-slate-600 flex flex-col items-center gap-2">
                                <span className="text-2xl">🧐</span>
                                <span>未找到该位置的英雄</span>
                                <span className="text-xs opacity-50">请检查 champions.json 中的 role 配置</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}