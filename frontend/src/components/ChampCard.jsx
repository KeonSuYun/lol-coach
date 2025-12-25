import React from 'react';
import { User, Swords, Shield, Crosshair, Zap, Brain, HelpCircle } from 'lucide-react';

// 映射分路图标 (可选)
const RoleIcon = ({ role, className }) => {
    switch (role) {
        case 'TOP': return <Shield size={14} className={className} />;
        case 'JUNGLE': return <Swords size={14} className={className} />; // 或 Trees/Axe
        case 'MID': return <Zap size={14} className={className} />;
        case 'ADC': return <Crosshair size={14} className={className} />;
        case 'SUPPORT': return <Brain size={14} className={className} />; // 或 Heart/HelpingHand
        default: return <HelpCircle size={14} className={className} />;
    }
};

const ChampCard = ({ champ, idx, isEnemy, userSlot, onSelectMe, role }) => {
  // 判断这张卡片是不是“我自己”
  const isMe = !isEnemy && userSlot === idx;

  return (
    <div 
      onClick={() => !isEnemy && onSelectMe && onSelectMe(idx)}
      className={`
        relative h-20 md:h-24 w-full rounded-xl overflow-hidden border transition-all duration-300 group
        ${isEnemy 
            ? 'border-red-900/30 bg-red-950/10' 
            : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
        }
        ${!isEnemy && isMe 
            ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] ring-1 ring-blue-400' 
            : !isEnemy 
                ? 'border-slate-800 hover:border-slate-600' 
                : ''
        }
      `}
    >
      {/* === 背景图区域 === */}
      {champ ? (
        <>
            {/* 背景图片 */}
            <div className="absolute inset-0">
                <img 
                    src={champ.image_url} 
                    alt={champ.name}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                />
                {/* 渐变遮罩 (为了让文字看清楚) */}
                <div className={`absolute inset-0 bg-gradient-to-r ${isEnemy ? 'from-red-950/80 to-transparent' : 'from-slate-950/90 via-slate-900/40 to-transparent'}`}></div>
            </div>

            {/* === 内容区域 === */}
            <div className="relative z-10 h-full flex items-center justify-between px-3 md:px-4">
                
                {/* 左侧：头像与名字 */}
                <div className="flex items-center gap-3">
                    {/* 圆形小头像 (仅修饰) */}
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 overflow-hidden shadow-md shrink-0 ${isEnemy ? 'border-red-500/50' : (isMe ? 'border-blue-400' : 'border-slate-600')}`}>
                        <img src={champ.image_url} alt="" className="w-full h-full object-cover scale-110" />
                    </div>
                    
                    {/* 文字信息 */}
                    <div className="flex flex-col">
                        <span className={`text-sm md:text-base font-black tracking-wide leading-none ${isEnemy ? 'text-red-200' : (isMe ? 'text-blue-100' : 'text-slate-200')}`}>
                            {champ.name} {/* 显示中文名 */}
                        </span>
                        <span className="text-[10px] md:text-xs text-slate-400 font-mono mt-1 opacity-70 truncate max-w-[80px] md:max-w-[120px]">
                            {champ.title || champ.key}
                        </span>
                    </div>
                </div>

                {/* 右侧：分路与标签 */}
                <div className="flex flex-col items-end gap-1">
                    {/* 分路显示 */}
                    {role && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border
                            ${isEnemy 
                                ? 'bg-red-950/50 border-red-800 text-red-400' 
                                : 'bg-slate-800/80 border-slate-700 text-slate-400'
                            }
                        `}>
                            <RoleIcon role={role} />
                            <span>{role}</span>
                        </div>
                    )}
                    
                    {/* "ME" 标记 */}
                    {isMe && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 animate-pulse">
                            <User size={10} className="fill-current"/>
                            <span>YOU</span>
                        </div>
                    )}
                </div>
            </div>
        </>
      ) : (
        /* === 空状态 (未选择英雄) === */
        <div className={`w-full h-full flex items-center justify-center gap-2 ${isEnemy ? 'bg-red-950/20' : 'bg-slate-900/50'}`}>
            <div className={`w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center ${isEnemy ? 'border-red-900/30 text-red-900' : 'border-slate-800 text-slate-700'}`}>
                <HelpCircle size={18} />
            </div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                {isEnemy ? 'Waiting...' : 'Select Hero'}
            </span>
        </div>
      )}
    </div>
  );
};

export default ChampCard;