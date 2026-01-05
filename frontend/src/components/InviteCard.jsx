import React, { useState } from 'react';
import axios from 'axios';
import { Copy, CheckCircle2, HeartHandshake, ArrowRight, RefreshCw, Lock, ShieldCheck, Link2, Zap, Gem, Settings2, Cpu } from 'lucide-react';
import { API_BASE_URL } from '../config/constants';
import { toast } from 'react-hot-toast';

const InviteCard = ({ token, username, onUpdateSuccess, accountInfo }) => {
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // 🔥 核心状态获取
    const currentInviter = accountInfo?.invited_by; 
    const changeCount = accountInfo?.invite_change_count || 0;
    const MAX_CHANGES = 4;
    const remainingChanges = Math.max(0, MAX_CHANGES - changeCount);
    const isLocked = remainingChanges <= 0;
    
    // 🔥 定义“已绑定且未处于编辑模式”的状态，这是显示帅气卡片的条件
    const isBoundState = currentInviter && !isEditing;

    const handleCopy = () => {
        navigator.clipboard.writeText(username);
        setCopied(true);
        toast.success("契约代码已复制！");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async () => {
        if (!inviteCode.trim()) return toast.error("请输入战友的契约代码");
        if (inviteCode === username) return toast.error("无法与自己缔结契约");
        if (inviteCode === currentInviter) return toast.error("您已经绑定了这位战友");

        if (currentInviter) {
            if (isLocked) return toast.error("更换次数已耗尽，契约已锁定");
            if (!window.confirm(`⚠️ 更换战友警告\n代价：双方都将扣除 1 次更换机会！\n确定要更换吗？`)) return;
        }

        setLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/user/redeem_invite`, 
                { invite_code: inviteCode },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(currentInviter ? "海克斯核心已重组！" : "🎉 双城契约缔结成功！");
            setInviteCode(''); 
            setIsEditing(false);
            if (onUpdateSuccess) onUpdateSuccess(); 
        } catch (err) {
            const errorMsg = err.response?.data?.detail || "契约无效";
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // ==================================================================================
    // 🌟 视图 A: 帅气的海克斯契约卡片 (绑定成功状态)
    // ==================================================================================
    if (isBoundState) {
        return (
            <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#0AC8B9]/20 via-[#091428] to-[#091428] border border-[#0AC8B9]/40 p-5 group animate-in zoom-in duration-500 shadow-[0_0_30px_rgba(10,200,185,0.2)] hover:shadow-[0_0_50px_rgba(10,200,185,0.4)] transition-all">
                
                {/* 动态光效背景 */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#0AC8B9]/10 rounded-full blur-[60px] animate-pulse pointer-events-none mix-blend-screen"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#0AC8B9]/5 rounded-full blur-[50px] pointer-events-none"></div>
                <div className="absolute inset-0 bg-[url('https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/hextech-pattern.png')] opacity-10 bg-repeat pointer-events-none"></div>

                {/* 1. 顶部 Header: 标题 + 复制我的代码 */}
                <div className="flex justify-between items-center mb-5 relative z-10">
                    <div className="flex items-center gap-2">
                        <Cpu className="text-[#0AC8B9] animate-spin-slow" size={22} />
                        <h3 className="text-lg font-black tracking-wider text-white drop-shadow-[0_0_5px_rgba(10,200,185,0.8)]">
                            海克斯契约
                        </h3>
                    </div>
                    {/* 融合的复制按钮 */}
                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#091428]/60 backdrop-blur border border-[#0AC8B9]/30 hover:border-[#0AC8B9] rounded-lg transition-all active:scale-95 group/btn"
                        title="复制我的代码"
                    >
                        <span className="text-xs font-mono font-bold text-[#0AC8B9]/80 group-hover/btn:text-[#0AC8B9] transition-colors">
                            {username}
                        </span>
                        {copied ? <CheckCircle2 size={12} className="text-green-500"/> : <Copy size={12} className="text-[#0AC8B9]/70 group-hover/btn:text-[#0AC8B9]"/>}
                    </button>
                </div>

                {/* 2. 核心展示区：战友信息 */}
                <div className="flex flex-col items-center justify-center py-5 relative z-10 bg-[#091428]/40 rounded-xl border border-[#0AC8B9]/20 backdrop-blur-md">
                    
                    {/* 顶部状态标签 */}
                    <div className="absolute -top-2.5 bg-[#0AC8B9] text-[#091428] text-[9px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest shadow-[0_0_10px_#0AC8B9]">
                        Link Active
                    </div>

                    <div className="text-[10px] text-[#0AC8B9]/60 mb-1 font-mono uppercase tracking-widest mt-2">
                        Linked Partner
                    </div>
                    {/* 战友ID (大字体、发光) */}
                    <div className="text-3xl font-black text-white tracking-wider drop-shadow-[0_0_15px_rgba(10,200,185,1)] font-mono py-1">
                        {currentInviter}
                    </div>
                    
                    {/* 分割线 */}
                    <div className="h-[1px] w-2/3 bg-gradient-to-r from-transparent via-[#0AC8B9]/60 to-transparent my-4"></div>
                    
                    {/* 🔥🔥🔥 新文案：双城主题 🔥🔥🔥 */}
                    <div className="flex flex-col items-center gap-1">
                        <div className="text-sm text-white font-bold flex items-center gap-2 drop-shadow">
                            <Gem size={14} className="text-[#0AC8B9]"/>
                            <span>双城之约 · 进化核心已激活</span>
                        </div>
                        <div className="text-[10px] text-[#0AC8B9]/70 opacity-80">
                            Pro 权限共享中，与战友共同登顶。
                        </div>
                    </div>
                </div>

                {/* 3. 底部操作栏 */}
                <div className="mt-5 flex justify-between items-end relative z-10">
                    <div className="flex flex-col gap-1">
                         <div className="px-2 py-0.5 rounded bg-[#0AC8B9]/10 text-[#0AC8B9] text-[10px] font-bold border border-[#0AC8B9]/20 flex items-center gap-1 w-fit">
                             <Zap size={10} fill="currentColor"/> PRO UNLOCKED
                        </div>
                        <span className="text-[9px] text-slate-500 pl-0.5">
                            剩余更换机会: <span className={`${remainingChanges <= 1 ? 'text-red-400' : 'text-[#0AC8B9]'}`}>{remainingChanges}</span>
                        </span>
                    </div>
                   
                   {/* 管理/更换按钮 */}
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-slate-700 transition-all text-xs group/edit"
                    >
                        <Settings2 size={14} className="group-hover/edit:rotate-90 transition-transform duration-300" /> 
                        <span>管理契约</span>
                    </button>
                </div>
            </div>
        );
    }

    // ==================================================================================
    // 🧊 视图 B: 初始输入/编辑状态 (旧版容器风格，用于输入)
    // ==================================================================================
    return (
        <div className="relative group w-full overflow-hidden rounded-xl border border-[#C8AA6E]/30 bg-[#091428] shadow-2xl transition-all hover:shadow-[0_0_40px_rgba(200,170,110,0.15)] animate-in fade-in duration-500">
            {/* 背景特效 (旧版金色主题) */}
            <div className="absolute inset-0 bg-[url('https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/magic-pattern-sprite.png')] opacity-5 pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#C8AA6E]/50 to-transparent"></div>

            <div className="p-5 flex flex-col gap-4 relative z-10">
                {/* 标题与代码 */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#F0E6D2]">
                            <HeartHandshake className="text-[#C8AA6E]" size={20} /> 
                            <h3 className="text-base font-black tracking-wide">战友契约</h3>
                        </div>
                        <button 
                            onClick={handleCopy}
                            className="group/btn flex items-center gap-2 px-2 py-1 bg-black/40 border border-slate-700 hover:border-[#C8AA6E] rounded-md transition-all active:scale-95"
                        >
                            <span className="text-xs font-mono font-bold text-[#C8AA6E] group-hover/btn:text-white transition-colors max-w-[80px] truncate">{username}</span>
                            {copied ? <CheckCircle2 size={12} className="text-green-500"/> : <Copy size={12} className="text-slate-500"/>}
                        </button>
                    </div>
                    
                    {/* 文案 */}
                    <div className="text-xs text-slate-400 leading-relaxed border-l-2 border-[#C8AA6E]/20 pl-3 space-y-2.5">
                        <p>寻找一位战友建立<span className="text-[#0AC8B9] font-bold">双向链接</span>，双方均可解锁 <span className="text-[#F0E6D2] font-bold">3天</span> Pro 权限。</p>
                        <p className="text-[#F0E6D2]/90 italic">“我们希望你们能利用这段时间，一起复盘、讨论战术，在竞争中共同进化，直至登顶。”</p>
                    </div>
                </div>

                {/* 输入框区域 */}
                <div className="bg-[#010A13]/60 backdrop-blur-sm border border-slate-700/60 rounded-lg p-1 flex items-center gap-2 animate-in slide-in-from-bottom-2">
                    <div className="flex-1 relative h-9">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"><Link2 size={14} /></div>
                        <input 
                            type="text" 
                            placeholder={currentInviter ? "输入新战友ID (慎重)..." : "输入战友ID绑定..."}
                            className="w-full h-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none pl-8 font-mono"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            disabled={isLocked}
                        />
                    </div>
                    
                    {isLocked ? (
                        <div className="px-3 h-9 flex items-center gap-1 bg-red-900/20 text-red-400 text-[10px] font-bold rounded border border-red-500/20 cursor-not-allowed whitespace-nowrap"><Lock size={12} /> 已锁定</div>
                    ) : (
                        <div className="flex gap-1">
                            {isEditing && (
                                <button onClick={() => setIsEditing(false)} className="h-9 w-9 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all" title="取消">
                                    <Settings2 size={14} className="rotate-45"/>
                                </button>
                            )}
                            <button 
                                onClick={handleSubmit}
                                disabled={loading || !inviteCode}
                                className={`h-9 px-3 rounded font-bold text-xs flex items-center gap-1 transition-all shadow-lg whitespace-nowrap
                                    ${loading || !inviteCode ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-[#0AC8B9] to-[#089186] text-[#091428] hover:brightness-110 active:scale-95'}`}
                            >
                                {loading ? <span className="animate-spin">⏳</span> : (currentInviter ? <RefreshCw size={12}/> : <ArrowRight size={14} strokeWidth={2.5}/>)}
                                <span>{currentInviter ? "更换" : "绑定"}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InviteCard;