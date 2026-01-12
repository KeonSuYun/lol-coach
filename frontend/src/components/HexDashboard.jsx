import React, { useState, useMemo } from 'react';
import { 
    Shield, Swords, Zap, Eye, Target, Map, Activity, 
    AlertTriangle, Flag, Timer, Footprints, Crosshair, 
    Anchor, Navigation, Skull, Glasses, Clock, Ban, 
    ChevronRight, CornerDownRight, AlertCircle, PlayCircle, Scale,
    Brain
} from 'lucide-react';

// =================================================================
// 1. 🎨 样式系统
// =================================================================
const COLOR_MAP = {
    red: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500', shadow: 'shadow-red-500', bgSoft: 'bg-red-500/10' },
    cyan: { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500', shadow: 'shadow-cyan-500', bgSoft: 'bg-cyan-500/10' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500', shadow: 'shadow-amber-500', bgSoft: 'bg-amber-500/10' },
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', shadow: 'shadow-emerald-500', bgSoft: 'bg-emerald-500/10' },
    purple: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500', shadow: 'shadow-purple-500', bgSoft: 'bg-purple-500/10' },
    blue: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500', shadow: 'shadow-blue-500', bgSoft: 'bg-blue-500/10' },
    slate: { bg: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500', shadow: 'shadow-slate-500', bgSoft: 'bg-slate-500/10' },
};

const getTheme = (colorName) => COLOR_MAP[colorName] || COLOR_MAP['cyan'];

// =================================================================
// 2. 🧩 原子组件
// =================================================================

// 🔥 升级版 StatBar：支持自定义显示文本 (displayValue) 和 悬浮提示 (tooltip)
const HexStatBar = ({ label, value, displayValue, color = "cyan", icon: Icon, tooltip }) => {
    const theme = getTheme(color);
    const safeValue = Math.min(100, Math.max(0, Math.round(value)));

    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                {/* 标签区域：添加 tooltip 触发逻辑 */}
                <div className={`flex items-center gap-1.5 relative ${tooltip ? 'group/label cursor-help' : ''}`}>
                    {Icon && <Icon size={12} className={theme.text} />}
                    <span className={tooltip ? "border-b border-dashed border-slate-600/50" : ""}>{label}</span>

                    {/* 🔥 悬浮 Tooltip */}
                    {tooltip && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 p-2.5 bg-[#091428]/95 border border-white/10 rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-[10px] font-normal text-slate-300 z-[100] opacity-0 group-hover/label:opacity-100 transition-all duration-200 pointer-events-none backdrop-blur-md translate-y-1 group-hover/label:translate-y-0">
                            {tooltip}
                            {/* 小三角 */}
                            <div className="absolute -bottom-1 left-3 w-2 h-2 bg-[#091428] border-r border-b border-white/10 transform rotate-45"></div>
                        </div>
                    )}
                </div>

                <div className={`${theme.text} font-mono text-[10px]`}>
                    {displayValue || `${safeValue}%`}
                </div>
            </div>
            <div className="h-1.5 w-full bg-[#0f172a] rounded-full overflow-hidden border border-white/5">
                <div 
                    className={`h-full ${theme.bg} shadow-[0_0_10px_currentColor] transition-all duration-1000`} 
                    style={{ width: `${safeValue}%` }}
                ></div>
            </div>
        </div>
    );
};

const LaneIdentity = ({ type }) => {
    const config = {
        'weak_lane': { label: '抗压发育', color: 'red', icon: Shield },
        'tempo_lane': { label: '节奏压制', color: 'cyan', icon: Zap },
        'carry_lane': { label: '核心C位', color: 'amber', icon: Swords },
    };
    const { label, color, icon: Icon } = config[type] || { label: '常规对线', color: 'slate', icon: Activity };
    const theme = getTheme(color);

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded border border-opacity-30 ${theme.bgSoft} ${theme.border} ${theme.text} shrink-0`}>
            <Icon size={14} />
            <span className="text-xs font-black tracking-wider">{label}</span>
        </div>
    );
};

const InfoBox = ({ title, content, icon: Icon, color = "blue" }) => {
    const theme = getTheme(color);
    return (
        <div className={`p-3 rounded-lg border border-opacity-20 ${theme.bgSoft} ${theme.border} h-full flex flex-col justify-center`}>
            <div className={`text-[10px] font-bold mb-1.5 flex items-center gap-1.5 ${theme.text}`}>
                {Icon && <Icon size={12}/>} {title}
            </div>
            <div className={`text-sm font-bold text-slate-200 leading-tight`}>
                {content || "等待分析..."}
            </div>
        </div>
    );
};

const StructuredActionCard = ({ card }) => {
    const typeColors = {
        'CLEAR_ROUTE': 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        'FIRST_TEMPO': 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        'TRACK_ENEMY_JG': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
        'DIVE_SETUP': 'text-red-400 border-red-500/30 bg-red-500/10',
        'DEFAULT': 'text-slate-300 border-slate-600/30 bg-slate-700/20'
    };
    const typeKey = Object.keys(typeColors).find(k => card.type && card.type.includes(k)) || 'DEFAULT';
    const typeStyle = typeColors[typeKey];

    return (
        <div className="bg-[#0f172a] border border-slate-700/50 rounded-lg p-3 relative overflow-hidden group hover:border-slate-500 transition-all">
            <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-bold text-slate-100">{card.title}</h4>
                {card.type && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border uppercase tracking-wider ${typeStyle}`}>
                        {card.type.replace(/_/g, ' ')}
                    </span>
                )}
            </div>

            <div className="space-y-2 text-xs">
                {card.trigger && (
                    <div className="flex items-start gap-2 text-slate-400">
                        <Scale size={12} className="mt-0.5 text-blue-400 shrink-0"/>
                        <span className="leading-tight"><span className="text-blue-400 font-bold">IF:</span> {card.trigger}</span>
                    </div>
                )}
                {card.do && (
                    <div className="flex items-start gap-2 text-slate-200">
                        <PlayCircle size={12} className="mt-0.5 text-emerald-400 shrink-0"/>
                        {Array.isArray(card.do) ? (
                            <ul className="list-disc pl-4 space-y-1">
                                {card.do.map((step, i) => <li key={i}>{step}</li>)}
                            </ul>
                        ) : (
                            <span className="leading-tight font-bold"><span className="text-emerald-400">DO:</span> {card.do}</span>
                        )}
                    </div>
                )}
                {card.watch && (
                    <div className="flex items-start gap-2 text-slate-400">
                        <Eye size={12} className="mt-0.5 text-amber-400 shrink-0"/>
                        <span className="leading-tight"><span className="text-amber-400 font-bold">WATCH:</span> {card.watch}</span>
                    </div>
                )}
                {card.fallback && (
                    <div className="flex items-start gap-2 text-slate-500 italic">
                        <CornerDownRight size={12} className="mt-0.5 shrink-0"/>
                        <span className="leading-tight">Else: {card.fallback}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const JungleTracker = ({ data }) => {
    if (!data) return null;
    return (
        <div className="bg-red-950/10 border border-red-500/20 rounded-lg p-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10"><Crosshair size={32} className="text-red-500"/></div>
            <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Target size={12}/> 敌方打野追踪 (Tracking)
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/30 p-2 rounded border border-red-500/10">
                    <div className="text-[9px] text-slate-500 mb-0.5">开野猜测</div>
                    <div className="text-xs font-bold text-red-200">{data.start_guess || "未知"}</div>
                </div>
                <div className="bg-black/30 p-2 rounded border border-red-500/10">
                    <div className="text-[9px] text-slate-500 mb-0.5">首波 Gank</div>
                    <div className="text-xs font-bold text-red-200">{data.first_gank || "未知"}</div>
                </div>
            </div>
            {data.risk_note && (
                <div className="mt-2 text-[10px] text-red-300/80 flex items-start gap-1 bg-red-500/5 p-1.5 rounded">
                    <AlertTriangle size={10} className="mt-0.5 shrink-0"/> 
                    <span>{data.risk_note}</span>
                </div>
            )}
        </div>
    );
};

const Timeline = ({ events }) => {
    if (!events || events.length === 0) return null;
    return (
        <div className="bg-[#0f172a]/50 border border-slate-700/50 rounded-lg p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock size={12}/> 关键时间节点 (Timeline)
            </div>
            <div className="space-y-3 relative">
                <div className="absolute left-[4.5px] top-1 bottom-1 w-[1px] bg-slate-700"></div>
                {events.map((e, idx) => (
                    <div key={idx} className="relative flex items-start gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#0AC8B9] border-2 border-[#0f172a] shadow-[0_0_5px_#0AC8B9] shrink-0 z-10 mt-0.5"></div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-bold text-[#0AC8B9] font-mono">{e.t}</span>
                                <span className="text-[9px] text-slate-500 uppercase border border-slate-700 px-1 rounded bg-black/20">{e.event || "Event"}</span>
                            </div>
                            <div className="text-[11px] text-slate-300 leading-tight">{e.action}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// =================================================================
// 3. 🛡️ 增强版仪表盘 (主控)
// =================================================================
const UniversalDashboard = ({ data, isFarming }) => {
    const [activePhase, setActivePhase] = useState('early');

    const currentCards = useMemo(() => {
        if (data?.strategies && data.strategies[activePhase]) {
            return data.strategies[activePhase];
        }
        return data?.action_cards || [];
    }, [data, activePhase]);

    const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
    const dontDo = Array.isArray(data?.dont_do) ? data.dont_do : [];
    
    const phases = [
        { id: 'early', label: '前期 (0-8m)' },
        { id: 'mid', label: '中期 (8-20m)' },
        { id: 'late', label: '后期 (20m+)' }
    ];

    // 🔥🔥🔥 [数值重构：容错与把握] 🔥🔥🔥
    
    const normalizeScore = (val) => {
        if (val === undefined || val === null) return 50; 
        if (val <= 1) return val * 100; 
        if (val <= 10) return val * 10; 
        return val;
    };

    // 1. 容错度 (Tolerance)
    const rawDanger = normalizeScore(data?.danger_level);
    const toleranceScore = 100 - rawDanger;
    
    let toleranceText = "中 (需谨慎)";
    let toleranceColor = "amber";
    if (toleranceScore >= 75) {
        toleranceText = "高 (容错足)";
        toleranceColor = "emerald";
    } else if (toleranceScore <= 40) {
        toleranceText = "低 (一波炸)";
        toleranceColor = "red";
    }

    // 2. 推演把握 (Confidence & Evidence)
    const confVal = normalizeScore(data?.confidence ?? data?.meta?.confidence);
    const evidence = data?.meta?.evidence_strength || "Medium";
    
    const evColorMap = {
        "Draft-Strong": "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        "Strong": "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        "Medium": "text-amber-400 bg-amber-500/10 border-amber-500/30",
        "Weak": "text-red-400 bg-red-500/10 border-red-500/30"
    };
    const evStyle = evColorMap[evidence] || "text-slate-400 bg-slate-500/10 border-slate-500/30";

    return (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
            
            {/* A. 顶部 Headline */}
            {data?.headline && (
                <div className="bg-gradient-to-r from-[#0AC8B9]/10 to-transparent border-l-4 border-[#0AC8B9] p-3 rounded-r-lg">
                    <h3 className="text-sm font-black text-white leading-tight flex items-center gap-2">
                        <Navigation size={16} className="text-[#0AC8B9]"/>
                        {data.headline}
                    </h3>
                </div>
            )}

            {/* B. 核心状态栏 (已替换为容错度/推演把握) */}
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 shadow-inner">
                <LaneIdentity type={data?.lane_type} />
                <div className="w-[1px] h-8 bg-white/10"></div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                    
                    {/* 1. 容错空间 (Tolerance) */}
                    <HexStatBar 
                        label="容错空间" 
                        value={toleranceScore} 
                        displayValue={toleranceText}
                        color={toleranceColor} 
                        icon={Shield}
                        // 🔥 传入 Tooltip
                        tooltip="阵容允许犯错的余地。"
                    />

                    {/* 2. 推演把握 (Confidence + Evidence Tag) */}
                    <HexStatBar 
                        label="推演把握" 
                        value={confVal} 
                        displayValue={
                            <span className="flex items-center gap-1.5">
                                <span className="font-mono">{confVal}</span>
                                <span className={`text-[9px] px-1 py-0 rounded border leading-none uppercase ${evStyle}`}>
                                    {evidence.replace('Draft-', '')}
                                </span>
                            </span>
                        }
                        color={confVal > 70 ? "emerald" : (confVal < 40 ? "red" : "blue")} 
                        icon={Brain}
                        // 🔥 传入 Tooltip
                        tooltip="这套默认计划成立的确定性（非胜率）。"
                    />
                </div>
            </div>

            {/* C. 追踪与时间轴 */}
            {(data?.enemy_jungle || timeline.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                    {data.enemy_jungle ? <JungleTracker data={data.enemy_jungle} /> : 
                        <InfoBox title={isFarming ? "黄金刷野循环" : "兵线计划"} content={data?.golden_cycle || data?.wave_plan} icon={Map} color="blue" />
                    }
                    {timeline.length > 0 ? <Timeline events={timeline} /> : 
                        <InfoBox title="关键窗口" content={data?.recall_anchor || data?.tp_window} icon={Zap} color="purple" />
                    }
                </div>
            )}

            {/* D. 阶段切换器 */}
            <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5 select-none">
                {phases.map((p) => (
                    <button 
                        key={p.id}
                        onClick={() => setActivePhase(p.id)}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${activePhase === p.id ? 'bg-[#0AC8B9] text-[#091428] shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* E. 行动卡片 */}
            <div className="space-y-3 min-h-[100px]">
                {currentCards.length > 0 ? (
                    currentCards.map((card, idx) => (
                        <StructuredActionCard key={idx} card={card} />
                    ))
                ) : (
                    <div className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded">
                        暂无该阶段战术数据...
                    </div>
                )}
            </div>

            {/* F. 禁忌列表 */}
            {dontDo.length > 0 && (
                <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-red-400 uppercase mb-2 flex items-center gap-1.5">
                        <Ban size={12}/> 绝对禁忌 (Don't Do)
                    </div>
                    <ul className="space-y-1">
                        {dontDo.map((item, i) => (
                            <li key={i} className="text-[11px] text-red-200/80 flex items-start gap-2">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-red-500 shrink-0"></span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default function HexDashboard({ role, isFarming, data = {} }) {
    const safeRole = (role || 'MID').toUpperCase();
    const roleConfig = {
        'TOP': { theme: 'orange' },
        'JUNGLE': { theme: 'emerald' },
        'MID': { theme: 'purple' },
        'ADC': { theme: 'blue' },
        'BOT': { theme: 'blue' },
        'SUPPORT': { theme: 'cyan' },
        'SUP': { theme: 'cyan' },
    };

    return (
        <UniversalDashboard 
            data={data} 
            isFarming={isFarming} 
            roleTheme={roleConfig[safeRole]?.theme || 'cyan'} 
        />
    );
}