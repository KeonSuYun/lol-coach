import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Plus, ThumbsUp, Trash2, Swords, Handshake, ChevronDown, User, Shield, Zap, Crosshair, Crown } from 'lucide-react';

const CommunityTips = ({ tips, currentUser, currentHero, currentTarget, allies, enemies, onTargetChange, onOpenPostModal, onLike, onDelete }) => {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const selectorRef = useRef(null);

  // 点击外部关闭选择器
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsSelectorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canDelete = (tipAuthorId) => {
    return currentUser === tipAuthorId || ["admin", "root", "keonsuyun"].includes(currentUser);
  };

  const isSynergy = currentTarget?.startsWith("Ally:");
  const displayTargetName = isSynergy ? currentTarget.replace("Ally:", "") : (currentTarget || "通用");
  
  // 获取目标头像
  const targetObj = (isSynergy ? allies : enemies)?.find(c => c?.name === displayTargetName);

  // 渲染头像组件 (📱 优化：加大点击区域和头像尺寸)
  const HeroAvatar = ({ hero, isAlly, onClick }) => (
    <div 
      onClick={onClick}
      className={`relative w-9 h-9 md:w-10 md:h-10 rounded-lg border-2 cursor-pointer transition-all hover:scale-110 shrink-0
        ${isAlly ? 'border-emerald-500/50 hover:border-emerald-400' : 'border-red-500/50 hover:border-red-400'}
        ${displayTargetName === hero.name ? 'ring-2 ring-hex-gold shadow-lg scale-105' : 'opacity-70 hover:opacity-100'}
      `}
      title={isAlly ? `配合 ${hero.name}` : `对抗 ${hero.name}`}
    >
        <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover rounded-[6px]" />
        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center border border-white/10">
            {isAlly ? <Handshake size={8} className="text-emerald-400"/> : <Swords size={8} className="text-red-400"/>}
        </div>
    </div>
  );

  return (
    <div className="flex-1 bg-[#091428] border border-hex-gold/20 rounded-lg md:rounded-sm overflow-hidden flex flex-col h-full min-h-[350px] shadow-lg relative group/container">
        {/* 背景纹理 */}
        <div className="absolute inset-0 bg-hex-pattern opacity-5 pointer-events-none"></div>

        {/* --- 顶部动态标题栏 (📱 优化：增加高度和内边距) --- */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#010A13]/90 border-b border-hex-gold/20 backdrop-blur z-20">
            
            {/* 左侧：当前状态指示器 */}
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full border ${isSynergy ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-red-900/30 border-red-500/50 text-red-400'}`}>
                    {isSynergy ? <Handshake size={16}/> : <Swords size={16}/>}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider">
                        {isSynergy ? "TEAM SYNERGY" : "对位技巧"}
                    </span>
                    {/* 下拉触发器 */}
                    <button 
                        className="flex items-center gap-1.5 hover:text-hex-gold transition-colors text-left" 
                        onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                    >
                        <span className={`text-sm md:text-base font-black truncate max-w-[150px] md:max-w-[200px] ${isSynergy ? 'text-emerald-100' : 'text-red-100'}`}>
                            {isSynergy ? "配合" : "VS"} {displayTargetName}
                        </span>
                        <ChevronDown size={12} className={`transform transition-transform text-slate-400 ${isSelectorOpen ? 'rotate-180' : ''}`}/>
                    </button>
                </div>
            </div>

            {/* 右侧：添加按钮 */}
            <button 
                onClick={() => onOpenPostModal(isSynergy)}
                className="p-2 rounded-lg bg-hex-blue/10 text-hex-blue border border-hex-blue/30 hover:bg-hex-blue hover:text-white transition-all active:scale-95"
                title="分享绝活"
            >
                <Plus size={18}/>
            </button>
        </div>

        {/* --- 悬浮选人面板 (📱 优化：最大高度限制+滚动，防止溢出) --- */}
        {isSelectorOpen && (
            <div ref={selectorRef} className="absolute top-[60px] left-2 right-2 bg-[#1E2328] border border-hex-gold/30 rounded-lg shadow-2xl z-30 p-4 animate-in fade-in zoom-in-95 duration-200 max-h-[300px] overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-4">
                    {/* 敌方列表 */}
                    <div>
                        <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold mb-2.5 uppercase">
                            <Swords size={12}/> 针对谁？ (Enemies)
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {enemies.filter(h => h).map((hero, idx) => (
                                <HeroAvatar key={`enemy-${idx}`} hero={hero} isAlly={false} onClick={() => { onTargetChange(hero.name); setIsSelectorOpen(false); }} />
                            ))}
                        </div>
                    </div>
                    
                    <div className="h-px bg-white/5 w-full"></div>

                    {/* 队友列表 */}
                    <div>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-2.5 uppercase">
                            <Handshake size={12}/> 配合谁？ (Teammates)
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {allies.filter(h => h && h.name !== currentHero).map((hero, idx) => (
                                <HeroAvatar key={`ally-${idx}`} hero={hero} isAlly={true} onClick={() => { onTargetChange(`Ally:${hero.name}`); setIsSelectorOpen(false); }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- 内容列表 (📱 优化：字号调整) --- */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar relative z-10">
            {tips?.matchup?.length > 0 ? tips.matchup.map(tip => (
                <div key={tip.id} className="bg-[#15191e]/90 p-3.5 rounded border border-white/5 hover:border-hex-gold/30 transition-all relative overflow-hidden">
                    {/* 侧边条 */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isSynergy ? 'bg-emerald-500' : 'bg-red-500'} opacity-60`}></div>
                    
                    {/* 头部 */}
                    <div className="flex justify-between items-start mb-2 pl-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5 font-bold">
                                <User size={12}/> {tip.author_id}
                            </span>
                            {(tip.liked_by?.length || 0) > 5 && (
                                <span className="px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[10px] text-yellow-500 flex items-center gap-1 font-bold">
                                    <Crown size={10} className="fill-current"/> 绝活
                                </span>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => onLike(tip.id)} 
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-hex-gold transition-colors"
                            >
                                <ThumbsUp size={14}/> {tip.liked_by?.length || 0}
                            </button>
                            {canDelete(tip.author_id) && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete(tip.id, tip.author_id); }} 
                                    className="text-slate-600 hover:text-red-500 transition-colors p-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* 正文 (📱 提升到 text-sm) */}
                    <p className="text-sm text-slate-300 leading-relaxed font-sans pl-3 whitespace-pre-wrap">
                        {tip.content}
                    </p>
                </div>
            )) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4 opacity-60 py-10">
                    {isSynergy ? <Handshake size={40} strokeWidth={1.5} /> : <Crosshair size={40} strokeWidth={1.5} />}
                    <div className="text-center">
                        <p className="text-sm font-bold mb-1">暂无{isSynergy ? '配合' : '对位'}心得</p>
                        <p className="text-xs">点击右上角 + 号，分享你的理解！</p>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default CommunityTips;