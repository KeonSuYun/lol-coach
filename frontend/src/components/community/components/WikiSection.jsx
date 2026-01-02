import React from 'react';
import { BookOpen, Zap, Swords, ExternalLink, Link as LinkIcon } from 'lucide-react';
import GlassCard from './GlassCard';

export default function WikiSection({ heroInfo, summary, onLinkClick }) {
    // 🛡️ 终极防御：如果 summary 是 null/undefined，或者相应字段不存在，强制使用空数组 []
    // 这样下面的 .map 就永远不会因为数据为空而报错了
    const keyMechanics = summary?.keyMechanics || [];
    const commonMatchups = summary?.commonMatchups || [];
    const overview = summary?.overview || "暂无概览数据";

    // 如果 summary 本身还没加载出来，且没有数据，暂时不渲染（防止空框）
    if (!summary && keyMechanics.length === 0 && commonMatchups.length === 0) return null;

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <GlassCard className="p-6" highlight>
                <div className="flex items-center gap-2 mb-4">
                    <BookOpen size={18} className="text-[#C8AA6E]" />
                    <h3 className="text-lg font-bold text-[#F0E6D2]">英雄总览</h3>
                </div>
                <p className="text-slate-300 leading-relaxed text-sm mb-6 border-l-2 border-[#C8AA6E] pl-4">
                    {overview}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 核心机制引用 */}
                    <div>
                        <h4 className="text-xs font-bold text-[#0AC8B9] uppercase mb-3 flex items-center gap-2">
                            <Zap size={14} /> 核心机制库
                        </h4>
                        <div className="space-y-2">
                            {keyMechanics.length > 0 ? (
                                keyMechanics.map((mech, i) => (
                                    <div key={i} className="flex items-center justify-between bg-[#010A13]/50 p-2 rounded border border-white/5">
                                        <span className="text-sm text-slate-200">{mech.label}</span>
                                        {mech.refId ? (
                                            <button 
                                                onClick={() => onLinkClick(mech.refId)}
                                                className="text-xs text-[#C8AA6E] hover:underline flex items-center gap-1 bg-[#C8AA6E]/10 px-2 py-0.5 rounded cursor-pointer"
                                            >
                                                <LinkIcon size={10} /> 引用 {mech.refId}
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-slate-600 italic">待补充</span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-slate-500 italic">暂无核心机制数据</div>
                            )}
                        </div>
                    </div>

                    {/* 常见对位引用 */}
                    <div>
                        <h4 className="text-xs font-bold text-red-400 uppercase mb-3 flex items-center gap-2">
                            <Swords size={14} /> 焦点对局
                        </h4>
                        <div className="space-y-2">
                            {commonMatchups.length > 0 ? (
                                commonMatchups.map((m, i) => (
                                    <div key={i} className="flex items-center justify-between bg-[#010A13]/50 p-2 rounded border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <img 
                                                src={`https://game.gtimg.cn/images/lol/act/img/champion/${m.championAlias || 'Fiora'}.png`} 
                                                className="w-5 h-5 rounded-full" 
                                                alt=""
                                                onError={(e) => {e.target.style.display='none'}} // 图片加载失败隐藏
                                            />
                                            <span className="text-sm text-slate-200">{m.championName || `ID:${m.championId}`}</span>
                                            <span className={`text-[9px] px-1 rounded ${
                                                m.difficulty === 'Easy' ? 'text-green-400 bg-green-400/10' :
                                                m.difficulty === 'Medium' ? 'text-yellow-400 bg-yellow-400/10' : 'text-red-400 bg-red-400/10'
                                            }`}>{m.difficulty}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500 hidden sm:inline">{m.note}</span>
                                            {m.refId && (
                                                <button 
                                                    onClick={() => onLinkClick(m.refId)}
                                                    className="text-[#0AC8B9] hover:text-white p-1 hover:bg-[#0AC8B9]/20 rounded"
                                                >
                                                    <ExternalLink size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-slate-500 italic">暂无对位数据</div>
                            )}
                        </div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}