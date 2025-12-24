import React from 'react';
import { Search } from 'lucide-react';

const ChampCard = ({ champ, idx, isEnemy, userSlot, onSelectMe }) => {
  const isEmpty = !champ;
  const isMe = !isEnemy && idx === userSlot;

  return (
    <div className={`relative flex items-center gap-3 p-2.5 mb-2 rounded-lg border transition-all cursor-pointer group select-none backdrop-blur-sm
      ${isEnemy 
          ? 'bg-red-950/20 border-red-500/10 hover:border-red-500/40' 
          : isMe 
              ? 'bg-gradient-to-r from-amber-900/40 to-yellow-900/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
              : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}`}>
      
      {isMe && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-500 rounded-r shadow-[0_0_10px_#f59e0b]"></div>}

      <div className={`w-12 h-12 rounded-lg bg-black overflow-hidden border relative shrink-0 transition-colors
          ${isEmpty ? 'border-slate-800' : isEnemy ? 'border-red-900/50' : isMe ? 'border-amber-500' : 'border-slate-700'}`}>
        {!isEmpty ? (
          <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-700"><Search size={18} /></div>
        )}
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className={`text-sm font-bold truncate ${isEmpty ? 'text-slate-600 italic' : 'text-slate-200'}`}>
              {isEmpty ? '等待选择...' : champ.name}
          </div>
          {!isEmpty && <div className="text-[10px] text-slate-500 truncate">{champ.title}</div>}
      </div>

      {!isEnemy && (
           <div onClick={(e) => { e.stopPropagation(); onSelectMe(idx); }}
                className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide transition-all border cursor-pointer
                ${isMe ? 'bg-amber-600 border-amber-500 text-white shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-800'}`}>
               {isMe ? 'ME' : 'SET'}
           </div>
      )}
    </div>
  );
};

export default ChampCard;