import React from 'react';
import { 
    AlertTriangle, ShieldCheck, Swords, TrendingUp, 
    Clock, Ban, Target, Flag, AlertCircle 
} from 'lucide-react';

const VisualDashboard = ({ data }) => {
    if (!data) return null;

    const { risk, win_condition, lose_condition, primary_focus, next_actions, dont_do } = data;

    // 1. 风险等级渲染配置
    const getRiskConfig = (level) => {
        const l = (level || 'LOW').toUpperCase();
        if (l === 'HIGH') return { color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30', bar: 'bg-rose-500' };
        if (l === 'MEDIUM') return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', bar: 'bg-amber-500' };
        return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', bar: 'bg-emerald-500' };
    };
    const riskCfg = getRiskConfig(risk?.level);

    return (
        <div className="flex flex-col gap-3 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            
            {/* === 第一行：风险态势 & 核心博弈 === */}
            <div className="grid grid-cols-12 gap-3">
                {/* 左侧：风险仪表盘 (3列) */}
                <div className={`col-span-3 rounded-xl border ${riskCfg.border} ${riskCfg.bg} p-3 relative overflow-hidden flex flex-col justify-between group`}>
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Swords size={48} /></div>
                    
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <ActivityIcon level={risk?.level} className={riskCfg.color} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${riskCfg.color} opacity-80`}>Risk Level</span>
                        </div>
                        <div className={`text-2xl font-black ${riskCfg.color} font-mono tracking-tighter`}>
                            {risk?.score || 0}<span className="text-sm opacity-50">/100</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                        {risk?.tags?.map((tag, i) => (
                            <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded border ${riskCfg.border} ${riskCfg.color} bg-black/20`}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* 右侧：胜负手 (9列) */}
                <div className="col-span-9 grid grid-rows-2 gap-2">
                    {/* 胜机 */}
                    <div className="bg-[#0A1428] border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-3 relative overflow-hidden">
                        <div className="w-1 h-full absolute left-0 top-0 bg-emerald-500/50"></div>
                        <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-400 shrink-0"><Flag size={14}/></div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-emerald-500/70 font-bold uppercase">Win Condition</div>
                            <div className="text-xs font-bold text-slate-200 truncate">{win_condition}</div>
                        </div>
                    </div>
                    {/* 败因 */}
                    <div className="bg-[#0A1428] border border-rose-500/20 rounded-lg p-2.5 flex items-center gap-3 relative overflow-hidden">
                        <div className="w-1 h-full absolute left-0 top-0 bg-rose-500/50"></div>
                        <div className="p-1.5 bg-rose-500/10 rounded text-rose-400 shrink-0"><AlertTriangle size={14}/></div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-rose-500/70 font-bold uppercase">Lose Condition</div>
                            <div className="text-xs font-bold text-slate-200 truncate">{lose_condition}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 第二行：时间轴 & 禁忌 === */}
            <div className="grid grid-cols-12 gap-3">
                {/* 左侧：行动时间轴 (8列) */}
                <div className="col-span-8 bg-[#0F1623] border border-[#C8AA6E]/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                        <div className="flex items-center gap-1.5">
                            <Clock size={14} className="text-[#C8AA6E]"/>
                            <span className="text-xs font-bold text-slate-200">关键行动序列</span>
                        </div>
                        <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">Timeline</span>
                    </div>
                    <div className="space-y-2">
                        {next_actions?.map((action, idx) => (
                            <div key={idx} className="flex items-start gap-2 group">
                                <div className="flex flex-col items-center mt-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#C8AA6E] group-hover:shadow-[0_0_8px_#C8AA6E] transition-all"></div>
                                    {idx !== next_actions.length - 1 && <div className="w-[1px] h-full bg-white/10 my-0.5"></div>}
                                </div>
                                <div className="flex-1 pb-1">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[10px] font-mono text-[#0AC8B9]">{action.t}</span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{action.do}</div>
                                    <div className="text-[10px] text-slate-500">{action.why}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 右侧：重点关注 & 禁忌 (4列) */}
                <div className="col-span-4 flex flex-col gap-2">
                    {/* 重点关注 */}
                    <div className="flex-1 bg-blue-900/10 border border-blue-500/20 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10"><Target size={40} className="text-blue-400"/></div>
                        <div className="text-[9px] text-blue-400 font-bold uppercase mb-1">Primary Focus</div>
                        <div className="text-lg font-black text-white">{primary_focus?.lane}</div>
                        <div className="text-[10px] text-blue-200/70 leading-tight">{primary_focus?.reason}</div>
                    </div>

                    {/* 绝对禁止 */}
                    <div className="flex-1 bg-red-900/10 border border-red-500/20 rounded-xl p-3 relative overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-2 text-red-400">
                            <Ban size={14}/>
                            <span className="text-[10px] font-bold uppercase">DON'T DO</span>
                        </div>
                        <ul className="space-y-1">
                            {dont_do?.map((item, i) => (
                                <li key={i} className="text-[10px] text-red-200/80 flex items-start gap-1">
                                    <span className="mt-1 w-1 h-1 rounded-full bg-red-500 shrink-0"></span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 辅助图标组件
const ActivityIcon = ({ level, className }) => {
    if (level === 'HIGH') return <AlertCircle size={18} className={className} />;
    if (level === 'MEDIUM') return <TrendingUp size={18} className={className} />;
    return <ShieldCheck size={18} className={className} />;
};

export default VisualDashboard;