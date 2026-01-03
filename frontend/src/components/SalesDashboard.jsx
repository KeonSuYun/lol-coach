import React, { useState, useEffect } from 'react';
import axios from 'axios';
// === 修改点 1: 引入 Mail 图标 ===
import { X, TrendingUp, DollarSign, Users, Copy, CheckCircle2, Crown, ArrowUpRight, Gift, Rocket, Mail } from 'lucide-react';
import { API_BASE_URL } from '../config/constants';
import { toast } from 'react-hot-toast';

// 数字滚动组件
const CountUp = ({ end, duration = 2000 }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const increment = end / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(start);
            }
        }, 16);
        return () => clearInterval(timer);
    }, [end, duration]);
    return <>{count.toFixed(2)}</>;
};

export default function SalesDashboard({ isOpen, onClose, username, token }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const inviteLink = `https://www.hexcoach.gg?ref=${username}`;

    useEffect(() => {
        if (isOpen && token) {
            fetchData();
        }
    }, [isOpen, token]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/sales/dashboard`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (e) {
            // 首次进入可能没有数据，这是正常的
            setData({ total_earnings: 0, today_earnings: 0, total_orders: 0, recent_records: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success("专属链接已复制！");
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
            {/* 背景光效 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#C8AA6E]/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#0AC8B9]/10 rounded-full blur-[100px]"></div>
            </div>

            <div className="w-full max-w-5xl bg-[#091428]/95 border border-[#C8AA6E]/30 rounded-2xl shadow-2xl relative flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
                
                {/* 关闭按钮 */}
                <button onClick={onClose} className="absolute top-4 right-4 z-20 text-slate-500 hover:text-white transition-colors p-1 bg-black/20 rounded-full hover:bg-white/10">
                    <X size={24} />
                </button>

                {/* === 左侧：营销文案与推广 (45%) === */}
                <div className="w-full md:w-[45%] bg-gradient-to-br from-[#010A13] to-[#0D131E] p-8 flex flex-col relative border-b md:border-b-0 md:border-r border-[#C8AA6E]/20">
                    {/* 装饰 */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#C8AA6E] via-[#F0E6D2] to-[#C8AA6E]"></div>
                    
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#C8AA6E] to-[#F0E6D2] text-[#091428] text-xs font-black uppercase tracking-wider mb-6 shadow-lg shadow-[#C8AA6E]/20 animate-in slide-in-from-left duration-500">
                            <Rocket size={12} /> 内测期 · 限量招募
                        </div>
                        
                        <h1 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
                            成为 HexCoach <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C8AA6E] to-[#F0E6D2]">合伙人</span>，共享红利
                        </h1>
                        
                        <div className="space-y-4 mb-8">
                            <p className="text-sm text-slate-400 leading-relaxed">
                                既然您认可 HexCoach 的价值，何不将它推荐给更多需要的玩家？
                                <span className="text-[#C8AA6E] font-bold">内测期间</span>，我们为您准备了顶格的推广回报。
                            </p>
                            
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <div className="p-1.5 bg-[#C8AA6E]/10 rounded text-[#C8AA6E] mt-0.5"><DollarSign size={16}/></div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-200">40% 现金高额提成</div>
                                        <div className="text-xs text-slate-500">每单最高可得 ¥7.96，无上限，实时入账。</div>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="p-1.5 bg-[#0AC8B9]/10 rounded text-[#0AC8B9] mt-0.5"><Gift size={16}/></div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-200">双赢机制</div>
                                        <div className="text-xs text-slate-500">通过您链接注册的好友，亦可获得 3 天 Pro 会员奖励。</div>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* 推广链接区域 */}
                    <div className="bg-[#1a1d26] p-4 rounded-xl border border-white/5">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-wider">您的专属邀请链接</p>
                        <button 
                            onClick={handleCopy}
                            className="group w-full p-3 rounded-lg bg-black/40 border border-[#C8AA6E]/30 hover:border-[#C8AA6E] transition-all flex items-center justify-between relative overflow-hidden"
                        >
                            <span className="text-xs md:text-sm text-slate-300 font-mono truncate mr-2">{inviteLink}</span>
                            <div className="flex items-center gap-1.5 text-[#C8AA6E] font-bold text-xs uppercase bg-[#C8AA6E]/10 px-2 py-1 rounded">
                                {copied ? <CheckCircle2 size={12}/> : <Copy size={12}/>}
                                <span>{copied ? "成功" : "复制"}</span>
                            </div>
                        </button>
                        {/* === 修改点 2: 底部小字更新 === */}
                        <p className="text-[10px] text-slate-500 mt-2 text-center flex items-center justify-center gap-1">
                            <Mail size={10} /> 结算通知将发送至您的账号注册邮箱
                        </p>
                    </div>
                </div>

                {/* === 右侧：数据仪表盘 (55%) === */}
                <div className="w-full md:w-[55%] bg-[#050810]/50 p-8 flex flex-col">
                    
                    {/* === 修改点 3: 新增结算说明提示框 (放在数据卡片上方) === */}
                    <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="p-2 bg-blue-500/20 rounded-full text-blue-400">
                            <Mail size={18} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-blue-100">收益如何提现？</h4>
                            <p className="text-xs text-blue-200/70 mt-1 leading-relaxed">
                                我们会通过您<span className="text-white font-bold mx-1">注册账号时使用的邮箱</span>联系您进行收益结算。
                                请务必关注您的邮箱收件箱（含垃圾邮件箱），以免错过打款通知。
                            </p>
                        </div>
                    </div>

                    {/* 核心数据卡片 */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-[#091428] to-[#0D131E] p-5 rounded-xl border border-[#C8AA6E]/20 shadow-lg relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={40} className="text-[#C8AA6E]"/></div>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">累计总收益</div>
                            <div className="text-3xl font-black text-[#F0E6D2] font-mono">
                                ¥{loading ? "..." : <CountUp end={data?.total_earnings || 0} />}
                            </div>
                        </div>
                        <div className="bg-[#091428] p-5 rounded-xl border border-white/5 shadow-lg">
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">今日新增</div>
                            <div className="text-3xl font-black text-emerald-400 font-mono flex items-center gap-2">
                                +{loading ? "..." : (data?.today_earnings || 0)}
                                <TrendingUp size={16} className="opacity-50"/>
                            </div>
                        </div>
                    </div>

                    {/* 入账列表 */}
                    <div className="flex-1 bg-[#010A13]/50 rounded-xl border border-white/5 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                <Users size={16} className="text-[#0AC8B9]"/> 实时入账记录
                            </h3>
                            <span className="text-[10px] text-slate-500 bg-black/40 px-2 py-0.5 rounded">最近10笔</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {data?.recent_records?.length > 0 ? (
                                data.recent_records.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-3 p-3 rounded-lg hover:bg-white/5 transition-colors items-center group animate-in slide-in-from-bottom-2 duration-500" style={{animationDelay: `${idx * 50}ms`}}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold border border-slate-700">
                                                {item.source[0]}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-slate-200 font-bold">{item.source}</span>
                                                <span className="text-[10px] text-slate-600">首单奖励</span>
                                            </div>
                                        </div>
                                        <div className="text-center text-xs text-slate-500 font-mono">
                                            {item.time}
                                        </div>
                                        <div className="text-right font-bold text-[#C8AA6E] font-mono flex items-center justify-end gap-1">
                                            +{item.amount.toFixed(2)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 opacity-60">
                                    <div className="p-4 bg-white/5 rounded-full"><DollarSign size={24} /></div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold">暂无收益</p>
                                        <p className="text-xs mt-1">复制左侧链接，开启第一笔财富！</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}