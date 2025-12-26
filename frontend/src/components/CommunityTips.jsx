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

  // 权限判断
  const canDelete = (tipAuthorId) => {
    return currentUser === tipAuthorId || ["admin", "root", "keonsuyun"].includes(currentUser);
  };

  // 解析当前目标 (如果是 "Ally:Yasuo" 这种格式)
  const isSynergy = currentTarget?.startsWith("Ally:");
  const displayTargetName = isSynergy ? currentTarget.replace("Ally:", "") : (currentTarget || "通用");
  
  // 获取目标头像 (从 allies/enemies 数组中找)
  const targetObj = (isSynergy ? allies : enemies)?.find(c => c?.name === displayTargetName);
  const targetImg = targetObj?.image_url;

  // 渲染头像组件
  const HeroAvatar = ({ hero, isAlly, onClick }) => (
    <div 
      onClick={onClick}
      className={`relative w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 cursor-pointer transition-all hover:scale-110 group
        ${isAlly ? 'border-emerald-500/50 hover:border-emerald-400' : 'border-red-500/50 hover:border-red-400'}
        ${displayTargetName === hero.name ? 'ring-2 ring-hex-gold shadow-lg scale-105' : 'opacity-70 hover:opacity-100'}
      `}
      title={isAlly ? `配合 ${hero.name}` : `对抗 ${hero.name}`}
    >
        <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover rounded-[6px]" />
        {/* 覆盖层图标 */}
        <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center border border-white/10">
            {isAlly ? <Handshake size={8} className="text-emerald-400"/> : <Swords size={8} className="text-red-400"/>}
        </div>
    </div>
  );

  return (
    <div className="flex-1 bg-[#091428] border border-hex-gold/20 rounded-sm overflow-hidden flex flex-col h-full min-h-[300px] shadow-lg relative group/container">
        {/* 背景纹理 */}
        <div className="absolute inset-0 bg-[url('https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/magic-pattern-sprite.png')] opacity-5 pointer-events-none"></div>

        {/* --- 顶部动态标题栏 --- */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#010A13]/90 border-b border-hex-gold/20 backdrop-blur z-20">
            
            {/* 左侧：当前状态指示器 */}
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full border ${isSynergy ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-red-900/30 border-red-500/50 text-red-400'}`}>
                    {isSynergy ? <Handshake size={14}/> : <Swords size={14}/>}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {isSynergy ? "TEAM SYNERGY" : "对位技巧"}
                    </span>
                    <div className="flex items-center gap-1 cursor-pointer hover:text-hex-gold transition-colors" onClick={() => setIsSelectorOpen(!isSelectorOpen)}>
                        <span className={`text-xs font-black ${isSynergy ? 'text-emerald-100' : 'text-red-100'}`}>
                            {isSynergy ? "配合" : "VS"} {displayTargetName}
                        </span>
                        <ChevronDown size={10} className={`transform transition-transform ${isSelectorOpen ? 'rotate-180' : ''}`}/>
                    </div>
                </div>
            </div>

            {/* 右侧：功能按钮 */}
            <div className="flex gap-1">
                <button 
                    onClick={() => onOpenPostModal(isSynergy)} // 传参：是否是 Synergy
                    className="p-1.5 rounded hover:bg-hex-blue/20 text-hex-blue hover:text-white transition-colors"
                    title={`分享 ${displayTargetName} 的绝活`}
                >
                    <Plus size={16}/>
                </button>
            </div>
        </div>

        {/* --- 悬浮选人面板 (Focus Switcher) --- */}
        {isSelectorOpen && (
            <div ref={selectorRef} className="absolute top-[50px] left-2 right-2 bg-[#1E2328] border border-hex-gold/30 rounded-lg shadow-2xl z-30 p-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col gap-3">
                    {/* 敌方列表 */}
                    <div>
                        <div className="flex items-center gap-1 text-[10px] text-red-400 font-bold mb-2 uppercase">
                            <Swords size={10}/> 针对谁？ (Enemies)
                        </div>
                        <div className="flex gap-2 justify-between">
                            {enemies.filter(h => h).map((hero, idx) => (
                                <HeroAvatar key={`enemy-${idx}`} hero={hero} isAlly={false} onClick={() => { onTargetChange(hero.name); setIsSelectorOpen(false); }} />
                            ))}
                        </div>
                    </div>
                    
                    {/* 分割线 */}
                    <div className="h-px bg-white/5 w-full"></div>

                    {/* 队友列表 */}
                    <div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mb-2 uppercase">
                            <Handshake size={10}/> 配合谁？ (Teammates)
                        </div>
                        <div className="flex gap-2 justify-between">
                            {allies.filter(h => h && h.name !== currentHero).map((hero, idx) => (
                                <HeroAvatar key={`ally-${idx}`} hero={hero} isAlly={true} onClick={() => { onTargetChange(`Ally:${hero.name}`); setIsSelectorOpen(false); }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- 内容列表 --- */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar relative z-10">
            {/* 这里的 tips.matchup 实际上已经包含了后端返回的 "针对当前Target" 的数据 */}
            {tips?.matchup?.length > 0 ? tips.matchup.map(tip => (
                <div key={tip.id} className="bg-[#15191e]/90 p-3 rounded border border-white/5 hover:border-hex-gold/30 transition-all group relative overflow-hidden">
                    {/* 侧边装饰条 */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${isSynergy ? 'bg-emerald-500' : 'bg-red-500'} opacity-50`}></div>
                    
                    {/* 头部信息 */}
                    <div className="flex justify-between items-start mb-2 pl-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <User size={10}/> {tip.author_id}
                            </span>
                            {/* 如果是绝活哥 (高赞)，显示皇冠 */}
                            {(tip.liked_by?.length || 0) > 5 && (
                                <span className="text-[9px] text-yellow-500 flex items-center gap-0.5" title="高赞绝活">
                                    <Crown size={8} className="fill-current"/> 绝活
                                </span>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => onLike(tip.id)} 
                                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-hex-gold transition-colors"
                            >
                                <ThumbsUp size={12}/> {tip.liked_by?.length || 0}
                            </button>
                            {canDelete(tip.author_id) && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete(tip.id, tip.author_id); }} 
                                    className="text-slate-600 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* 内容正文 */}
                    <p className="text-xs text-slate-300 leading-relaxed font-sans pl-2">
                        {tip.content}
                    </p>
                </div>
            )) : (
                /* 空状态 */
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 opacity-60">
                    {isSynergy ? <Handshake size={32} /> : <Crosshair size={32} />}
                    <div className="text-xs text-center">
                        <p className="font-bold mb-1">暂无{isSynergy ? '配合' : '对位'}心得</p>
                        <p className="text-[10px]">点击右上角 + 号，分享你的理解！</p>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default CommunityTips;