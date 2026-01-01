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

// 🟢 辅助：标准化键值 (移除空格标点，转小写)
const normalizeKey = (key) => key ? key.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";

// 🟢 严格检查函数
const checkRole = (hero, roleId, roleMapping) => {
    if (roleId === 'ALL') return true;

    if (roleMapping && Object.keys(roleMapping).length > 0) {
        const cleanKey = normalizeKey(hero.key); 
        const cleanName = normalizeKey(hero.name); 
        const heroRoles = roleMapping[cleanKey] || roleMapping[cleanName];
        
        if (heroRoles) return heroRoles.includes(roleId);
        return false;
    }
    // 如果没有 mapping 数据，默认不仅行筛选（或者你可以改为 return false 强制不显示）
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
            const matchSearch = 
                c.name.includes(searchTerm) || 
                c.title.includes(searchTerm) || 
                c.key.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchRole = checkRole(c, activeRole, roleMapping);
            
            return matchSearch && matchRole;
        }).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }, [championList, searchTerm, activeRole, roleMapping]);

    if (!isOpen) return null;

    return (
        <div 
            // 📱 容器调整：PC居中，移动端底部对齐 (items-end)
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200" 
            onClick={onClose}
        >
            <div 
                // 📱 弹窗主体：
                // Mobile: 底部抽屉样式 (rounded-t-2xl, h-[90vh], slide-in-from-bottom)
                // PC: 悬浮窗样式 (rounded-xl, h-[80vh], zoom-in)
                className="w-full md:max-w-4xl h-[90vh] md:h-[80vh] bg-[#050C18] border-t md:border border-[#C8AA6E]/50 rounded-t-2xl md:rounded-xl shadow-2xl flex flex-col overflow-hidden relative animate-in slide-in-from-bottom duration-300 md:zoom-in md:duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* 📱 顶部把手 (仅手机显示) */}
                <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-3 mb-1 md:hidden opacity-50"></div>

                {/* Header */}
                <div className="p-4 border-b border-[#C8AA6E]/20 bg-[#091428] flex flex-col gap-3 md:gap-4 shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg md:text-xl font-bold text-[#F0E6D2] tracking-widest uppercase flex items-center gap-2">
                            Select Champion
                        </h2>
                        <button onClick={onClose} className="p-1 bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-between">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="搜索英雄 (名字/称号)..." 
                                className="w-full bg-slate-900/50 border border-[#C8AA6E]/20 rounded-lg py-2.5 pl-9 pr-4 text-sm text-slate-200 focus:border-[#C8AA6E]/60 focus:outline-none focus:ring-1 focus:ring-[#C8AA6E]/60 transition-all placeholder:text-slate-600"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus={window.innerWidth > 768} // 📱 手机端不自动聚焦，防键盘遮挡
                            />
                        </div>

                        {/* Role Tabs (横向滚动) */}
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar md:pb-0">
                            {ROLES.map(role => (
                                <button
                                    key={role.id}
                                    onClick={() => setActiveRole(role.id)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border shrink-0
                                        ${activeRole === role.id 
                                            ? 'bg-[#0AC8B9]/20 text-[#0AC8B9] border-[#0AC8B9]/50 shadow-[0_0_10px_rgba(10,200,185,0.2)]' 
                                            : 'bg-white/5 text-slate-500 border-transparent hover:bg-white/10 hover:text-slate-300'}
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
                <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar bg-[#050C18]">
                    {/* 📱 网格调整：手机固定 4 列，保证头像大小 */}
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-3 pb-safe-area">
                        {filteredChamps.map(hero => (
                            <button 
                                key={hero.key}
                                onClick={() => onSelect(hero)}
                                className="group flex flex-col items-center gap-1.5 p-1.5 rounded-lg hover:bg-white/5 transition-all border border-transparent hover:border-[#C8AA6E]/30 active:scale-95"
                            >
                                <div className="relative w-full aspect-square rounded border border-[#C8AA6E]/20 group-hover:border-[#C8AA6E] group-hover:shadow-[0_0_10px_rgba(200,170,110,0.3)] transition-all overflow-hidden bg-slate-900">
                                    <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-300" loading="lazy"/>
                                    {/* 手机端的文字遮罩 */}
                                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent md:hidden"></div>
                                </div>
                                <span className="text-[11px] md:text-xs font-bold text-slate-400 group-hover:text-[#F0E6D2] text-center truncate w-full px-1">
                                    {hero.name}
                                </span>
                            </button>
                        ))}
                        {filteredChamps.length === 0 && (
                            <div className="col-span-full h-40 flex flex-col items-center justify-center text-slate-600 gap-3">
                                <span className="text-4xl grayscale opacity-50">🧐</span>
                                <div className="text-center">
                                    <div className="text-sm">未找到英雄</div>
                                    <div className="text-xs opacity-50 mt-1">请尝试切换位置或搜索英文名</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}