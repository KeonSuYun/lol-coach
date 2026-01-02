// src/components/ConsoleHeaderUser.jsx
import React from 'react';
import { ChevronDown, Trophy, Crown } from 'lucide-react';
import { 
  BadgeStyleInit, 
  TitleBadge, 
  UnifiedTag, 
  getRankTheme,
  cleanTitle 
} from './BadgeSystem'; // 引入刚才创建的组件库

const ConsoleHeaderUser = ({ 
    username = "User", 
    tag = "#HEX", 
    avatarUrl, 
    activeTitle = "社区成员", 
    rank = "Unranked", 
    isPro = false,
    onClick 
}) => {
    // 获取当前段位的主题色，用于头像边框
    const rankTheme = getRankTheme(rank);
    
    // Pro标签的主题（强制金色/Amber色系）
    const proTheme = {
        bg: "bg-amber-950/40",
        border: "border-amber-500/50",
        text: "text-amber-200",
        accent: "text-amber-400",
        shadow: "shadow-amber-900/20"
    };

    return (
        <div 
            onClick={onClick}
            className="flex items-center gap-3 p-2 pl-3 rounded-xl hover:bg-slate-800/50 cursor-pointer transition-all border border-transparent hover:border-slate-700/50 group"
        >
            {/* 0. 注入样式 (只需在 App 中注入一次，这里防漏) */}
            <BadgeStyleInit />

            {/* 1. 左侧：头像区域 (带段位边框) */}
            <div className="relative">
                <div className={`w-10 h-10 rounded-full border-2 p-0.5 ${rankTheme.avatarRing} bg-slate-800 shadow-lg overflow-hidden transition-colors duration-500`}>
                    <img 
                        src={avatarUrl || "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png"} 
                        alt={username} 
                        className="w-full h-full rounded-full object-cover"
                    />
                </div>
                {/* 可选：如果需要在头像右下角显示 PRO 图标 */}
                {isPro && (
                    <div className="absolute -bottom-1 -right-1 bg-amber-900 text-amber-100 p-0.5 rounded-full border border-amber-500 shadow-sm z-10">
                        <Crown size={8} />
                    </div>
                )}
            </div>

            {/* 2. 右侧：信息区域 */}
            <div className="flex flex-col items-start gap-0.5">
                
                {/* 第一行：名字 + Pro标签 */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                        {username}
                        <span className="text-slate-500 text-xs font-normal ml-0.5">{tag}</span>
                    </span>
                    
                    {/* 统一风格的 PRO 标签 */}
                    {isPro && (
                        <UnifiedTag 
                            label="PRO" 
                            icon={Crown} 
                            themeOverride={proTheme} 
                        />
                    )}
                </div>

                {/* 第二行：头衔 + 段位 */}
                <div className="flex items-center gap-1.5">
                    {/* 头衔徽章 (复用主页的 TitleBadge) */}
                    <TitleBadge 
                        title={activeTitle} 
                        size="small" // 使用小尺寸变体
                        className="shadow-sm"
                    />
                    
                    {/* 统一风格的段位标签 */}
                    <UnifiedTag 
                        label={rank} 
                        icon={Trophy} 
                        className="opacity-80"
                    />
                </div>
            </div>

            {/* 下拉箭头 (可选) */}
            <ChevronDown size={14} className="text-slate-500 group-hover:text-slate-300 ml-1 transition-colors" />
        </div>
    );
};

export default ConsoleHeaderUser;