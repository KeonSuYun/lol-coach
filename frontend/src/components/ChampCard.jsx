import React from 'react';
import { User, Swords, Shield, Crosshair, Zap, Brain, HelpCircle } from 'lucide-react';

const RoleIcon = ({ role, className }) => {
    // 📱 优化：图标尺寸 size={12}
    switch (role) {
        case 'TOP': return <Shield size={12} className={className} />;
        case 'JUNGLE': return <Swords size={12} className={className} />;
        case 'MID': return <Zap size={12} className={className} />;
        case 'ADC': return <Crosshair size={12} className={className} />;
        case 'SUPPORT': return <Brain size={12} className={className} />;
        default: return <HelpCircle size={12} className={className} />;
    }
};

const ChampCard = ({ champ, idx, isEnemy, userSlot, onSelectMe, role }) => {
  const isMe = !isEnemy && userSlot === idx;

  const borderClass = isEnemy 
    ? 'border-red-900/50 group-hover:border-red-500/50' 
    : isMe 
        ? 'border-hex-gold shadow-[0_0_8px_rgba(200,170,110,0.5)]' 
        : 'border-hex-gold/10 group-hover:border-hex-blue/50';

  const textClass = isEnemy 
    ? 'text-red-200' 
    : isMe 
        ? 'text-hex-gold-light font-black tracking-wide' 
        : 'text-slate-400 group-hover:text-hex-blue';

  return (
    <div 
    // 📱 优化：py-3 (更紧凑), 避免手机屏幕太长
    className={`
        group relative flex items-center justify-between w-full px-4 py-3 md:py-4 transition-all duration-300
        ${!isEnemy && !isMe ? 'hover:bg-hex-blue/5' : ''}
        ${isMe ? 'bg-gradient-to-r from-hex-gold/10 to-transparent' : ''}
    `}
    >
      {champ ? (
        <>
            <div className="flex items-center gap-3 overflow-hidden z-10">
                {/* 头像容器 */}
                <div 
                    onClick={(e) => {
                        if (!isEnemy && onSelectMe) {
                            e.stopPropagation(); 
                            onSelectMe(idx);
                        }
                    }}
                    className={`relative w-10 h-10 shrink-0 transition-all duration-300 rounded-sm border-2 ${borderClass} ${!isEnemy ? 'cursor-pointer hover:scale-105 hover:shadow-[0_0_10px_rgba(200,170,110,0.4)]' : ''}`}
                    title={!isEnemy ? "点击切换为【我】的视角" : ""}
                >
                    <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" loading="lazy" />
                    {!isMe && <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all"></div>}
                </div>
                
                {/* 文字区域 */}
                <div className="flex flex-col min-w-0 pointer-events-none">
                    <span className={`text-sm font-bold truncate transition-colors ${textClass}`}>
                        {champ.name}
                    </span>
                    {/* 手机端保持显示称号，但字号稍微调大一点点 */}
                    <span className="text-[10px] md:text-xs text-slate-600 font-mono truncate group-hover:text-slate-500 hidden sm:block">
                        {champ.title || "The " + champ.key}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-end gap-1 pl-2 z-10 pointer-events-none">
                {role && (
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold uppercase tracking-wider border
                        ${isEnemy 
                            ? 'bg-red-950/40 border-red-900/40 text-red-400' 
                            : 'bg-hex-black border-hex-gold/10 text-slate-500 group-hover:border-hex-blue/30 group-hover:text-hex-blue'
                        }
                    `}>
                        <RoleIcon role={role} />
                        <span>{role.substring(0,3)}</span>
                    </div>
                )}
                {isMe && <span className="text-[9px] font-black text-hex-gold animate-pulse tracking-widest">YOU</span>}
            </div>
        </>
      ) : (
        // 空状态
        <div className="flex items-center gap-3 w-full opacity-30 group-hover:opacity-60 transition-opacity cursor-pointer">
             <div className={`w-10 h-10 rounded-sm border border-dashed flex items-center justify-center shrink-0 ${isEnemy ? 'border-red-800' : 'border-slate-600'}`}>
                <HelpCircle size={16} />
            </div>
            {/* 📱 优化：字号 text-xs (12px) */}
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Select Champion</span>
        </div>
      )}
    </div>
  );
};

export default ChampCard;