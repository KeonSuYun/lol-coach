import React from 'react';
import { User, Swords, Shield, Crosshair, Zap, Brain, HelpCircle } from 'lucide-react';

const RoleIcon = ({ role, className }) => {
    switch (role) {
        case 'TOP': return <Shield size={10} className={className} />;
        case 'JUNGLE': return <Swords size={10} className={className} />;
        case 'MID': return <Zap size={10} className={className} />;
        case 'ADC': return <Crosshair size={10} className={className} />;
        case 'SUPPORT': return <Brain size={10} className={className} />;
        default: return <HelpCircle size={10} className={className} />;
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
    // 🟢 修改点：移除了最外层的 onClick，点击事件交由父组件（App.jsx）处理以打开选人模态框
    // 这样点击卡片的空白处或文字区域，事件会冒泡到 App.jsx 中的 div，从而触发 handleSlotClick
    className={`
        group relative flex items-center justify-between w-full px-4 py-4 transition-all duration-300
        ${!isEnemy && !isMe ? 'hover:bg-hex-blue/5' : ''}
        ${isMe ? 'bg-gradient-to-r from-hex-gold/10 to-transparent' : ''}
    `}
    >
      {champ ? (
        <>
            <div className="flex items-center gap-3 overflow-hidden z-10">
                {/* 🟢 核心修改：头像容器
                   添加 onClick 并使用 stopPropagation。
                   作用：点击头像只执行 onSelectMe (切换当前玩家视角)，阻止事件冒泡到外层，防止弹出选人框。
                */}
                <div 
                    onClick={(e) => {
                        if (!isEnemy && onSelectMe) {
                            e.stopPropagation(); // 阻止冒泡
                            onSelectMe(idx);
                        }
                    }}
                    className={`relative w-9 h-9 md:w-10 md:h-10 shrink-0 transition-all duration-300 rounded-sm border-2 ${borderClass} ${!isEnemy ? 'cursor-pointer hover:scale-105 hover:shadow-[0_0_10px_rgba(200,170,110,0.4)]' : ''}`}
                    title={!isEnemy ? "Click to set as ME" : ""}
                >
                    <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" loading="lazy" />
                    {!isMe && <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all"></div>}
                </div>
                
                {/* 文字区域 - pointer-events-none 让鼠标事件穿透，或者不加也行，反正冒泡会触发外层点击 */}
                <div className="flex flex-col min-w-0 pointer-events-none">
                    <span className={`text-xs md:text-sm font-bold truncate transition-colors ${textClass}`}>
                        {champ.name}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono truncate group-hover:text-slate-500 hidden md:block">
                        {champ.title || "The " + champ.key}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-end gap-1 pl-2 z-10 pointer-events-none">
                {role && (
                    <div className={`flex items-center gap-1 px-1.5 py-[2px] rounded-[2px] text-[9px] font-bold uppercase tracking-wider border
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
        // 空状态 - 点击这里会冒泡到 App.jsx，打开选人框
        <div className="flex items-center gap-3 w-full opacity-30 group-hover:opacity-60 transition-opacity">
             <div className={`w-9 h-9 rounded-sm border border-dashed flex items-center justify-center shrink-0 ${isEnemy ? 'border-red-800' : 'border-slate-600'}`}>
                <HelpCircle size={14} />
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Select Champion</span>
        </div>
      )}
    </div>
  );
};

export default ChampCard;