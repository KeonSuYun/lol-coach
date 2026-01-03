import React, { useState } from 'react';
import axios from 'axios';
import { Gift, Copy, CheckCircle } from 'lucide-react'; // 假设您用了lucide-react图标库
import { API_BASE_URL } from '../config/constants';

const InviteCard = ({ token, username, onUpdateSuccess }) => {
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // 复制自己的邀请码
    const handleCopy = () => {
        navigator.clipboard.writeText(username); // 您的用户名就是邀请码
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // 提交别人的邀请码
    const handleSubmit = async () => {
        if (!inviteCode.trim()) return alert("请输入邀请码");
        if (inviteCode === username) return alert("不能输入自己的用户名");

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/user/redeem_invite`, 
                { invite_code: inviteCode },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("🎉 " + res.data.msg);
            setInviteCode(''); // 清空输入框
            if (onUpdateSuccess) onUpdateSuccess(); // 刷新父组件数据(比如刷新会员时间)
        } catch (err) {
            alert("❌ " + (err.response?.data?.msg || "兑换失败"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-[#091428] to-[#010A13] border border-[#C8AA6E]/30 rounded-xl p-6 shadow-lg relative overflow-hidden">
            {/* 背景装饰 */}
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Gift size={100} className="text-[#C8AA6E]" />
            </div>

            <h3 className="text-[#F0E6D2] font-bold text-lg mb-2 flex items-center gap-2">
                <Gift size={20} className="text-[#C8AA6E]" /> 
                内测期间，邀请好友，各得 3 天会员
            </h3>
            <p className="text-slate-400 text-xs mb-6">
                每邀请一位好友填写您的邀请码，双方均可获得 <span className="text-[#0AC8B9] font-bold">3天 Pro 权限</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 左侧：我的邀请码 */}
                <div className="bg-[#010A13]/50 border border-dashed border-[#C8AA6E]/30 rounded-lg p-4">
                    <p className="text-xs text-[#C8AA6E] font-bold uppercase mb-2">您的邀请码 (即用户名)</p>
                    <div className="flex items-center justify-between bg-black/30 rounded px-3 py-2 border border-slate-700">
                        <span className="text-xl font-mono font-bold text-white tracking-wide">{username}</span>
                        <button 
                            onClick={handleCopy}
                            className="text-slate-400 hover:text-white transition"
                            title="复制"
                        >
                            {copied ? <CheckCircle size={18} className="text-green-500"/> : <Copy size={18}/>}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">快去发给好基友吧！</p>
                </div>

                {/* 右侧：填写邀请码 */}
                <div>
                    <p className="text-xs text-slate-400 font-bold uppercase mb-2">填写好友的邀请码</p>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="输入好友用户名..." 
                            className="flex-1 bg-[#010A13] border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-[#0AC8B9] transition text-sm"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                        />
                        <button 
                            onClick={handleSubmit}
                            disabled={loading}
                            className={`px-4 py-2 rounded text-sm font-bold text-black transition shadow-lg
                                ${loading 
                                    ? 'bg-slate-600 cursor-not-allowed' 
                                    : 'bg-[#C8AA6E] hover:bg-[#b09358] shadow-[#C8AA6E]/20'}`}
                        >
                            {loading ? '...' : '兑换'}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                        * 每个新用户仅限填写一次
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InviteCard;