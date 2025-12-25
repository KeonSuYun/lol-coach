import React from 'react';
import { User, Swords, Shield, Crosshair, Zap, Brain, HelpCircle } from 'lucide-react';

// 映射分路图标
const RoleIcon = ({ role, className }) => {
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
  // 判断是否是“我自己”
  const isMe = !isEnemy && userSlot === idx;

  // 动态样式配置
  const avatarBorderColor = isEnemy 
    ? 'border-red-500/50' 
    : isMe 
        ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
        : 'border-[#383840] group-hover:border-slate-500';

  const nameColor = isEnemy 
    ? 'text-red-200' 
    : isMe 
        ? 'text-blue-100' 
        : 'text-slate-300 group-hover:text-white';

  return (
    <div 
      onClick={() => !isEnemy && onSelectMe && onSelectMe(idx)}
      className={`
        group flex items-center justify-between w-full px-3 py-2 cursor-pointer transition-colors
        ${!isEnemy ? 'hover:bg-[#32323a]' : ''}
      `}
    >
      {champ ? (
        <>
            {/* 左侧：圆形头像 + 名字 */}
            <div className="flex items-center gap-3 overflow-hidden">
                {/* 🟢 核心：圆形头像 (The Round Card) */}
                <div className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full border-2 shrink-0 overflow-hidden transition-all duration-300 ${avatarBorderColor}`}>
                    <img 
                        src={champ.image_url} 
                        alt={champ.name} 
                        className="w-full h-full object-cover scale-110" 
                        loading="lazy"
                    />
                </div>
                
                {/* 文字信息 */}
                <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-bold truncate transition-colors ${nameColor}`}>
                        {champ.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono truncate">
                        {champ.title || champ.key}
                    </span>
                </div>
            </div>

            {/* 右侧：分路图标 & 状态 */}
            <div className="flex flex-col items-end gap-1 pl-2">
                {role && (
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border
                        ${isEnemy 
                            ? 'bg-red-950/30 border-red-900/50 text-red-400' 
                            : 'bg-[#2a2a30] border-[#383840] text-slate-400'
                        }
                    `}>
                        <RoleIcon role={role} />
                        <span>{role.substring(0,3)}</span>
                    </div>
                )}
                
                {/* "YOU" 标记 */}
                {isMe && (
                    <div className="flex items-center gap-0.5 text-[9px] font-bold text-blue-400 animate-pulse">
                        <User size={9} className="fill-current"/>
                        <span>YOU</span>
                    </div>
                )}
            </div>
        </>
      ) : (
        /* === 空状态 (未选择) === */
        <div className="flex items-center gap-3 w-full opacity-50">
             <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full border-2 border-dashed flex items-center justify-center shrink-0
                ${isEnemy ? 'border-red-800 text-red-800' : 'border-slate-700 text-slate-700'}`}>
                <HelpCircle size={16} />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                {isEnemy ? 'WAITING' : 'SELECT'}
            </span>
        </div>
      )}
    </div>
  );
};

export default ChampCard;