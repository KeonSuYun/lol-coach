import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    ShieldAlert, X, Terminal, User, Clock, Activity, 
    DollarSign, TrendingUp, Users, Zap, AlertTriangle, 
    Database, Server, RefreshCw, Search, Plus, Edit, Trash2, PenTool, Ban,
    Wallet, ArrowUpRight, EyeOff, HandCoins, CheckCircle2, MessageSquare, Send, Check,
    // 🔥 [新增] 引入配置页所需的图标
    Cloud, Link, Save, Key, Settings, Briefcase, Gift // 🔥 [修复] 添加 Gift
} from 'lucide-react';
import { API_BASE_URL } from '../config/constants';
import { toast } from 'react-hot-toast';

const COST_PER_CALL = 0.0043; 

const AdminDashboard = ({ token, onClose, username }) => {
    const [activeTab, setActiveTab] = useState('overview'); 
    
    // 数据状态
    const [feedbacks, setFeedbacks] = useState([]);
    const [showResolved, setShowResolved] = useState(false); // 🔥 是否显示已处理
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [usingMockData, setUsingMockData] = useState(false);

    // 用户管理状态
    const [users, setUsers] = useState([]); 
    const [searchQuery, setSearchQuery] = useState("");
    const [actionUser, setActionUser] = useState(null); 
    const [actionType, setActionType] = useState(null); 
    const [actionValue, setActionValue] = useState("");

    // 销售结算状态
    const [salesPartners, setSalesPartners] = useState([]);

    // 🔥 私信回复状态
    const [replyTarget, setReplyTarget] = useState(null); // 当前要回复的反馈对象 {id, user_id}
    const [replyContent, setReplyContent] = useState("");

    // 🔥 [新增] 下载配置状态
    const [downloadConfig, setDownloadConfig] = useState({ pan_url: "", pan_pwd: "" });
    const [configLoading, setConfigLoading] = useState(false);

    const isSuperAdmin = username === "admin" || username === "root";

    const TABS = [
        { id: 'overview', label: '监控中心', icon: Activity },
        { id: 'users', label: '用户管理', icon: Users },
        ...(isSuperAdmin ? [{ id: 'sales', label: '销售结算', icon: Wallet }] : []),
        { id: 'feedbacks', label: '用户反馈', icon: Database },
        // 🔥 [新增] 系统配置 Tab (仅管理员可见)
        ...(isSuperAdmin ? [{ id: 'config', label: '系统配置', icon: Settings }] : []),
    ];

    // ================= 1. 数据获取逻辑 =================

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 🔥 获取反馈 (根据 showResolved 状态传参)
            const statusParam = showResolved ? 'all' : 'pending';
            const resFeedbacks = await axios.get(`${API_BASE_URL}/admin/feedbacks`, {
                params: { status: statusParam },
                headers: { Authorization: `Bearer ${token}` }
            });
            setFeedbacks(Array.isArray(resFeedbacks.data) ? resFeedbacks.data : []);

            // 获取统计数据 (仅在概览页或首次加载时)
            if (activeTab === 'overview' || !stats) {
                try {
                    const resStats = await axios.get(`${API_BASE_URL}/admin/stats`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setStats(resStats.data);
                    setUsingMockData(false);
                } catch (statsErr) {
                    setUsingMockData(true);
                    setStats({
                        total_users: 0, pro_users: 0, total_revenue: 0, 
                        total_commissions: 0, total_api_calls: 0, recent_users: []
                    });
                }
            }

        } catch (err) {
            if (err.response && err.response.status === 403) {
                setError("⛔ 权限拒绝：非管理员账号");
            } else {
                setError("数据连接失败: " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/users`, {
                params: { search: searchQuery },
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (err) { setUsers([]); }
    };

    const fetchSalesPartners = async () => {
        if (!isSuperAdmin) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/sales/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSalesPartners(Array.isArray(res.data) ? res.data : []);
        } catch (err) { setSalesPartners([]); }
    };

    // 🔥 [新增] 获取配置函数
    const fetchConfig = async () => {
        setConfigLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/config/client`);
            // 确保数据存在，防止 null 报错
            setDownloadConfig({
                pan_url: res.data.pan_url || "",
                pan_pwd: res.data.pan_pwd || ""
            });
        } catch (e) {
            console.error("Config load failed", e);
            toast.error("加载配置失败");
        } finally {
            setConfigLoading(false);
        }
    };

    // ================= 2. 操作逻辑 =================

    const handleUpdateUser = async () => {
        if (!actionUser) return;
        try {
            await axios.post(`${API_BASE_URL}/admin/user/update`, {
                username: actionUser.username,
                action: actionType,
                value: actionValue
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success("用户操作成功！");
            setActionUser(null);
            fetchUsers(); 
        } catch (err) {
            toast.error("操作失败: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleSettle = async (partner) => {
        if (partner.pending_commission <= 0) {
            toast("该用户当前没有待结算的佣金。", { icon: 'ℹ️' });
            return;
        }
        const confirmMsg = `即将结算用户 [${partner.username}] 的佣金。\n\n💰 本次结算金额：¥${partner.pending_commission}\n\n⚠️ 注意：此操作仅在数据库中标记状态为“已结算”，请确保您已通过微信/支付宝线下转账给对方。`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await axios.post(`${API_BASE_URL}/admin/sales/settle`, { username: partner.username }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("✅ 状态更新成功！佣金已归档。");
            fetchSalesPartners(); 
        } catch (err) {
            toast.error("❌ 结算失败: " + (err.response?.data?.detail || err.message));
        }
    };

    // 🔥 [修改] 标记反馈处理函数：支持采纳奖励
    const handleResolveFeedback = async (id, adopt = false) => {
        try {
            await axios.post(`${API_BASE_URL}/admin/feedbacks/resolve`, 
                { feedback_id: id, adopt: adopt, reward: 1 }, // 🔥 固定奖励 1 次
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            const actionText = adopt ? "已采纳并奖励用户！" : "已归档 (无奖励)";
            toast.success(actionText);
            
            // 乐观更新 UI：从列表中移除
            setFeedbacks(prev => prev.filter(f => f._id !== id));
        } catch (err) {
            toast.error("操作失败: " + (err.response?.data?.detail || err.message));
        }
    };

    // 🔥 [新增] 发送私信回复
    const handleSendReply = async () => {
        if (!replyContent.trim()) return;
        try {
            await axios.post(`${API_BASE_URL}/messages`, {
                receiver: replyTarget.user_id,
                content: replyContent
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success(`已私信回复 ${replyTarget.user_id}`);
            setReplyTarget(null);
            setReplyContent("");
        } catch (err) {
            toast.error("发送失败: " + (err.response?.data?.detail || err.message));
        }
    };

    // 🔥 [新增] 保存配置函数
    const handleSaveConfig = async () => {
        try {
            setConfigLoading(true); // 复用 loading 状态
            await axios.post(`${API_BASE_URL}/admin/config/client`, downloadConfig, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("✅ 下载链接已更新，用户端立即生效！");
        } catch (e) {
            toast.error("保存失败: " + (e.response?.data?.detail || e.message));
        } finally {
            setConfigLoading(false);
        }
    };

    // ================= 3. Effect Hooks =================

    useEffect(() => { fetchData(); }, [token]); // 初始加载

    useEffect(() => {
        // 切换 Tab 或 切换反馈筛选时 重新获取
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'sales') fetchSalesPartners();
        if (activeTab === 'feedbacks') fetchData(); 
        // 🔥 [新增] 切换到配置页时加载
        if (activeTab === 'config') fetchConfig();
    }, [activeTab, searchQuery, showResolved]);

    const calculateFinancials = () => {
        if (!stats) return { revenue: 0, commissions: 0, apiCost: 0, profit: 0, margin: 0 };
        const revenue = stats.total_revenue || 0;
        const commissions = stats.total_commissions || 0; 
        const apiCost = (stats.total_api_calls || 0) * COST_PER_CALL; 
        const profit = revenue - commissions - apiCost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return { revenue, commissions, apiCost, profit, margin };
    };
    const { revenue, commissions, apiCost, profit, margin } = calculateFinancials();

    const getDisplayName = (user) => {
        if (user.gameName) return `${user.gameName} #${user.tagLine || 'HEX'}`;
        try {
            if (user.game_profile) {
                const p = typeof user.game_profile === 'string' ? JSON.parse(user.game_profile) : user.game_profile;
                if (p.gameName) return `${p.gameName} #${p.tagLine || 'HEX'}`;
            }
        } catch(e){}
        return null;
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-[#091428] w-full max-w-6xl h-[85vh] rounded-xl border border-[#C8AA6E]/50 flex flex-col shadow-[0_0_50px_rgba(10,200,185,0.1)] overflow-hidden relative">
                
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#0AC8B9] to-transparent"></div>

                {/* Header */}
                <div className="p-5 border-b border-[#C8AA6E]/20 flex justify-between items-center bg-[#010A13]/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#C8AA6E]/10 rounded border border-[#C8AA6E]/30">
                            <ShieldAlert size={20} className="text-[#C8AA6E]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#F0E6D2] tracking-wider font-serif">HEXTECH 管理后台</h2>
                            <p className="text-[10px] text-[#0AC8B9] font-mono tracking-widest uppercase flex items-center gap-1">
                                <Server size={10}/> 系统在线 {isSuperAdmin && <span className="text-red-500 ml-2 font-bold">[超级管理员]</span>}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded text-slate-400 hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#C8AA6E]/20 bg-[#091428]">
                    {TABS.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 text-sm font-bold tracking-wide transition-all flex items-center gap-2
                                ${activeTab === tab.id 
                                    ? 'text-[#0AC8B9] border-b-2 border-[#0AC8B9] bg-[#0AC8B9]/5' 
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                        >
                            <tab.icon size={16}/> {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-hex-pattern bg-opacity-5">
                    
                    {loading && activeTab === 'overview' && (
                        <div className="h-full flex flex-col items-center justify-center text-[#0AC8B9] animate-pulse gap-3">
                            <Activity size={48} />
                            <span className="font-mono text-sm">正在连接神经网络...</span>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-red-950/30 border border-red-500/50 p-6 rounded text-red-400 text-center font-bold flex flex-col items-center gap-2">
                            <ShieldAlert size={32}/> {error}
                        </div>
                    )}

                    {/* === Tab 1: 监控中心 === */}
                    {!loading && !error && activeTab === 'overview' && (
                        <div className="space-y-6 animate-fade-in-up">
                            {usingMockData && (
                                <div className="bg-yellow-900/20 border border-yellow-600/30 p-2 rounded text-yellow-500 text-xs font-mono text-center flex items-center justify-center gap-2">
                                    <AlertTriangle size={12}/>
                                    演示模式：后端接口连接异常，当前显示为模拟数据。
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {isSuperAdmin ? (
                                    <>
                                        <div className="bg-[#010A13]/60 border border-[#C8AA6E]/20 p-4 rounded-lg relative overflow-hidden group hover:border-[#C8AA6E]/50 transition-all">
                                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={40} className="text-[#C8AA6E]"/></div>
                                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">总营收 (流水)</div>
                                            <div className="text-2xl font-black text-[#F0E6D2] font-mono">¥{revenue.toFixed(2)}</div>
                                            <div className="text-[10px] text-[#0AC8B9] mt-2 flex items-center gap-1">付费用户: {stats?.pro_users} 人</div>
                                        </div>
                                        <div className="bg-[#010A13]/60 border border-purple-500/20 p-4 rounded-lg relative overflow-hidden group hover:border-purple-500/50 transition-all">
                                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><HandCoins size={40} className="text-purple-400"/></div>
                                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">分销支出 (佣金)</div>
                                            <div className="text-2xl font-black text-purple-200 font-mono">- ¥{commissions.toFixed(2)}</div>
                                            <div className="text-[10px] text-purple-400 mt-2">已分发给合伙人</div>
                                        </div>
                                        <div className="bg-[#010A13]/60 border border-red-900/30 p-4 rounded-lg relative overflow-hidden group hover:border-red-500/50 transition-all">
                                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Server size={40} className="text-red-500"/></div>
                                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">API 成本 (预估)</div>
                                            <div className="text-2xl font-black text-red-200 font-mono">- ¥{apiCost.toFixed(2)}</div>
                                            <div className="text-[10px] text-red-400/80 mt-2 font-mono">调用量: {stats?.total_api_calls} 次</div>
                                        </div>
                                        <div className="bg-gradient-to-br from-[#0AC8B9]/10 to-[#091428] border border-[#0AC8B9]/40 p-4 rounded-lg relative overflow-hidden group shadow-[0_0_20px_rgba(10,200,185,0.1)]">
                                            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity"><Zap size={40} className="text-[#0AC8B9]"/></div>
                                            <div className="text-xs text-[#0AC8B9] font-bold uppercase tracking-wider mb-1">净利润</div>
                                            <div className="text-3xl font-black text-white font-mono drop-shadow-md">¥{profit.toFixed(2)}</div>
                                            <div className="text-[10px] text-[#0AC8B9]/80 mt-2 font-bold">利润率: {margin.toFixed(1)}%</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="col-span-4 bg-[#010A13]/40 border border-slate-800 p-8 rounded-lg flex flex-col items-center justify-center text-slate-600 gap-2">
                                        <EyeOff size={32} />
                                        <span className="text-sm font-bold uppercase">财务数据仅超级管理员可见</span>
                                    </div>
                                )}
                            </div>
                            <div className="bg-[#010A13]/40 border border-[#C8AA6E]/20 rounded-lg overflow-hidden">
                                <div className="px-4 py-3 bg-[#010A13]/80 border-b border-[#C8AA6E]/10 flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-[#C8AA6E] uppercase tracking-wider">最近活跃用户</h3>
                                    <button onClick={fetchData} className="text-slate-500 hover:text-[#0AC8B9] transition"><RefreshCw size={14}/></button>
                                </div>
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-[#091428] text-xs font-bold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-3">用户</th>
                                            <th className="px-4 py-3">身份</th>
                                            <th className="px-4 py-3">调用次数</th>
                                            <th className="px-4 py-3">最后活跃</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#C8AA6E]/5">
                                        {stats?.recent_users?.map((user, idx) => (
                                            <tr key={idx} className="hover:bg-[#C8AA6E]/5 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-300">{user.username}</td>
                                                <td className="px-4 py-3">
                                                    {user.role === 'pro' || user.role === 'vip' ? <span className="text-[#C8AA6E] bg-[#C8AA6E]/10 px-2 py-0.5 rounded text-[10px] border border-[#C8AA6E]/30 font-bold">PRO</span> : <span className="text-slate-500 text-[10px]">FREE</span>}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-[#0AC8B9]">{user.r1_used}</td>
                                                <td className="px-4 py-3 text-xs">{user.last_active}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* === Tab 2: 用户管理 === */}
                    {!loading && !error && activeTab === 'users' && (
                        <div className="animate-fade-in-up space-y-4">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                    <input type="text" placeholder="搜索用户名..." className="w-full bg-[#010A13]/60 border border-slate-700 rounded pl-10 pr-4 py-2 text-slate-200 focus:border-[#0AC8B9] outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                </div>
                                <button onClick={fetchUsers} className="bg-[#0AC8B9]/20 text-[#0AC8B9] px-4 rounded hover:bg-[#0AC8B9]/30 border border-[#0AC8B9]/30 transition">刷新</button>
                            </div>
                            <div className="bg-[#010A13]/40 border border-[#C8AA6E]/20 rounded-lg overflow-hidden min-h-[400px]">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-[#091428] text-xs font-bold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-3">用户名 / 游戏ID</th>
                                            <th className="px-4 py-3">角色</th>
                                            <th className="px-4 py-3">会员过期时间</th>
                                            <th className="px-4 py-3 text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#C8AA6E]/5">
                                        {users.map((user) => (
                                            <tr key={user._id} className="hover:bg-[#C8AA6E]/5 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-200">{user.username}</div>
                                                    <div className="text-xs text-[#0AC8B9]">{getDisplayName(user) || "未同步"}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] border font-bold uppercase ${user.role === 'admin' ? 'bg-red-900/30 text-red-400 border-red-500/30' : user.role === 'pro' ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] border-[#C8AA6E]/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{user.role}</span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs">
                                                    {user.membership_expire ? new Date(user.membership_expire).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-4 py-3 flex justify-end gap-2">
                                                    <button onClick={() => { setActionUser(user); setActionType('add_days'); setActionValue("30"); }} className="bg-green-900/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs hover:bg-green-900/40 transition">补单</button>
                                                    <button onClick={() => { setActionUser(user); setActionType('set_role'); setActionValue(user.role); }} className="bg-blue-900/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-xs hover:bg-blue-900/40 transition">权限</button>
                                                    
                                                    {/* 🔥 [新增] 设为销售按钮 */}
                                                    <button 
                                                        onClick={() => { setActionUser(user); setActionType('set_role'); setActionValue('sales'); }} 
                                                        className="bg-emerald-900/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-xs hover:bg-emerald-900/40 transition flex items-center gap-1"
                                                        title="设为销售合伙人"
                                                    >
                                                        <Briefcase size={12}/> 销售
                                                    </button>

                                                    {/* 🔥 [新增] 禁用/封号按钮 */}
                                                    <button 
                                                        onClick={() => { 
                                                            setActionUser(user); 
                                                            setActionType('set_role'); 
                                                            setActionValue('banned'); // 直接预设为封禁
                                                        }} 
                                                        className="bg-red-950/30 text-red-500 border border-red-500/30 px-2 py-1 rounded text-xs hover:bg-red-900/50 transition flex items-center gap-1"
                                                        title="禁用账号 (封禁邮箱)"
                                                    >
                                                        <Ban size={12}/> 禁用
                                                    </button>

                                                    <button onClick={() => { setActionUser(user); setActionType('delete'); setActionValue("confirm"); }} className="text-red-400 hover:text-white p-1"><Trash2 size={12}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* 用户操作弹窗 */}
                            {actionUser && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                                    <div className="bg-[#091428] border border-[#C8AA6E] p-6 rounded-lg w-full max-w-sm shadow-2xl relative">
                                        <button onClick={() => setActionUser(null)} className="absolute top-3 right-3 text-slate-500 hover:text-white"><X size={18} /></button>
                                        <h3 className="text-[#C8AA6E] font-bold text-lg mb-4">管理操作: {actionUser.username}</h3>
                                        
                                        {actionType === 'add_days' && (
                                            <div className="mb-4">
                                                <label className="block text-xs text-slate-500 mb-2">增加天数</label>
                                                <input type="number" className="w-full bg-[#010A13] border border-slate-600 rounded p-3 text-white outline-none" value={actionValue} onChange={e => setActionValue(e.target.value)} />
                                            </div>
                                        )}
                                        {actionType === 'set_role' && (
                                            <div className="mb-4">
                                                <label className="block text-xs text-slate-500 mb-2">选择角色身份</label>
                                                <select 
                                                    className="w-full bg-[#010A13] border border-slate-600 rounded p-3 text-white outline-none focus:border-[#C8AA6E]" 
                                                    value={actionValue} 
                                                    onChange={e => setActionValue(e.target.value)}
                                                >
                                                    <option value="user">User (普通用户)</option>
                                                    <option value="pro">Pro (会员)</option>
                                                    <option value="sales">Sales (销售合伙人)</option> {/* ✅ 新增 */}
                                                    <option value="admin">Admin (管理员)</option>
                                                    <option value="banned">🚫 Banned (封禁/禁用)</option> {/* ✅ 新增 */}
                                                </select>
                                                <p className="text-[10px] text-slate-500 mt-2">
                                                    * 设为 <b>Banned</b> 后，该用户将无法登录 (邮箱即失效)。
                                                </p>
                                            </div>
                                        )}
                                        {actionType === 'delete' && <p className="text-red-400 text-sm mb-4">确定要删除该用户吗？操作不可逆。</p>}

                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => setActionUser(null)} className="px-4 py-2 text-slate-400 text-sm">取消</button>
                                            <button onClick={handleUpdateUser} className="px-6 py-2 bg-[#C8AA6E] text-black font-bold rounded text-sm hover:bg-[#b09358]">确定</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === Tab 3: 销售结算 === */}
                    {!loading && !error && activeTab === 'sales' && isSuperAdmin && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-[#010A13]/40 border border-[#C8AA6E]/20 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-[#091428] text-xs font-bold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-6 py-4">销售员</th>
                                            <th className="px-6 py-4">联系方式</th>
                                            <th className="px-6 py-4 text-right">推广单数</th>
                                            <th className="px-6 py-4 text-right">总销售额</th>
                                            <th className="px-6 py-4 text-right">历史已结</th>
                                            <th className="px-6 py-4 text-right text-[#C8AA6E]">本期应付 (需结算)</th>
                                            <th className="px-6 py-4 text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#C8AA6E]/5">
                                        {salesPartners.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-[#C8AA6E]/5 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-200">
                                                    {p.username}
                                                    <div className="text-[10px] text-slate-500 font-normal">{p.game_name}</div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">{p.contact}</td>
                                                <td className="px-6 py-4 text-right font-mono">{p.order_count}</td>
                                                <td className="px-6 py-4 text-right font-mono">¥{p.total_sales}</td>
                                                <td className="px-6 py-4 text-right font-mono text-slate-500">¥{p.paid_commission}</td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-[#C8AA6E] text-lg">
                                                    ¥{p.pending_commission}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {p.pending_commission > 0 ? (
                                                        <button 
                                                            onClick={() => handleSettle(p)}
                                                            className="px-3 py-1.5 bg-[#C8AA6E] text-[#091428] rounded text-xs font-bold hover:bg-[#b09358] transition-all flex items-center gap-1 ml-auto shadow-lg shadow-amber-900/20"
                                                        >
                                                            <ArrowUpRight size={12}/> 结算打款
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-green-500 flex items-center justify-end gap-1">
                                                            <CheckCircle2 size={12}/> 无需结算
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* === Tab 4: 用户反馈 === */}
                    {!loading && !error && activeTab === 'feedbacks' && (
                        <div className="space-y-4 animate-fade-in-up">
                            {/* 工具栏 */}
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400 text-sm">筛选状态:</span>
                                    <button 
                                        onClick={() => setShowResolved(!showResolved)}
                                        className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                                            showResolved 
                                            ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] border-[#C8AA6E]/40' 
                                            : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}
                                    >
                                        {showResolved ? "显示全部 (All)" : "只看未处理 (Pending)"}
                                    </button>
                                </div>
                                <div className="text-slate-500 text-xs font-mono">
                                    共 {feedbacks.length} 条记录
                                </div>
                            </div>

                            {/* 列表 */}
                            <div className="grid gap-4">
                                {feedbacks.length === 0 ? (
                                    <div className="text-center py-10 text-slate-500">
                                        <CheckCircle2 size={48} className="mx-auto mb-2 opacity-20"/>
                                        <p>暂无待处理反馈</p>
                                    </div>
                                ) : (
                                    feedbacks.map((item) => (
                                        <div key={item._id} className="bg-[#010A13]/60 border border-slate-800 rounded-lg p-4 hover:border-[#0AC8B9]/30 transition-all flex flex-col gap-3 group">
                                            
                                            {/* 头部信息 */}
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-[#0AC8B9]"/>
                                                    <span className="text-sm font-bold text-slate-200">{item.user_id}</span>
                                                    {item.status === 'resolved' && (
                                                        <span className="text-[10px] bg-green-900/30 text-green-500 px-2 py-0.5 rounded border border-green-500/30">已处理</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}
                                                </span>
                                            </div>
                                            
                                            {/* 内容 */}
                                            <div className="bg-black/20 p-3 rounded border border-white/5">
                                                <p className="text-slate-300 text-sm whitespace-pre-wrap">{item.description}</p>
                                            </div>
                                            
                                            {/* Context 代码块 */}
                                            {item.match_context && Object.keys(item.match_context).length > 0 && (
                                                <div className="text-[10px] text-slate-600 font-mono truncate hover:text-slate-400 transition cursor-help" title="Context Data">
                                                    Context: {JSON.stringify(item.match_context)}
                                                </div>
                                            )}

                                            {/* 操作栏 */}
                                            <div className="flex justify-end gap-2 pt-2 border-t border-white/5 mt-1">
                                                
                                                {/* 回复按钮 */}
                                                <button 
                                                    onClick={() => setReplyTarget(item)}
                                                    className="px-3 py-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded text-xs hover:bg-blue-600/20 flex items-center gap-1 transition"
                                                >
                                                    <MessageSquare size={12}/> 私信回复
                                                </button>

                                                {/* 🔥 [修改] 按钮组：区分采纳与归档 */}
                                                {item.status !== 'resolved' && (
                                                    <>
                                                        {/* 采纳并奖励 */}
                                                        <button 
                                                            onClick={() => handleResolveFeedback(item._id, true)}
                                                            className="px-3 py-1.5 bg-amber-600/10 text-amber-400 border border-amber-500/30 rounded text-xs hover:bg-amber-600/20 flex items-center gap-1 transition"
                                                            title="采纳反馈，并自动奖励用户 1 次 【海克斯核心】充能"
                                                        >
                                                            <Gift size={12}/> 采纳(+1核心)
                                                        </button>

                                                        {/* 仅归档 */}
                                                        <button 
                                                            onClick={() => handleResolveFeedback(item._id, false)}
                                                            className="px-3 py-1.5 bg-slate-700/50 text-slate-400 border border-slate-600/50 rounded text-xs hover:bg-slate-700 flex items-center gap-1 transition"
                                                            title="忽略/仅归档，不发奖励"
                                                        >
                                                            <Check size={12}/> 归档
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {/* 私信回复弹窗 */}
                            {replyTarget && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                                    <div className="bg-[#091428] border border-[#0AC8B9] p-6 rounded-lg w-full max-w-md shadow-2xl relative">
                                        <button onClick={() => setReplyTarget(null)} className="absolute top-3 right-3 text-slate-500 hover:text-white"><X size={18} /></button>
                                        
                                        <h3 className="text-[#0AC8B9] font-bold text-lg mb-4 flex items-center gap-2">
                                            <MessageSquare size={18}/> 回复用户: {replyTarget.user_id}
                                        </h3>
                                        
                                        <div className="bg-black/30 p-3 rounded mb-4 border border-white/10 text-xs text-slate-400 italic">
                                            " {replyTarget.description.length > 50 ? replyTarget.description.substring(0,50) + '...' : replyTarget.description} "
                                        </div>

                                        <div className="mb-4">
                                            <textarea 
                                                className="w-full h-32 bg-[#010A13] border border-slate-600 rounded p-3 text-white outline-none focus:border-[#0AC8B9] resize-none"
                                                placeholder="输入回复内容..."
                                                value={replyContent}
                                                onChange={e => setReplyContent(e.target.value)}
                                            ></textarea>
                                        </div>

                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => setReplyTarget(null)} className="px-4 py-2 text-slate-400 text-sm">取消</button>
                                            <button onClick={handleSendReply} className="px-6 py-2 bg-[#0AC8B9] text-black font-bold rounded text-sm hover:bg-[#0AC8B9]/80 flex items-center gap-2">
                                                <Send size={14}/> 发送
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === 🔥 [新增] Tab 5: 系统配置 === */}
                    {!loading && !error && activeTab === 'config' && isSuperAdmin && (
                        <div className="animate-fade-in-up space-y-6 max-w-4xl mx-auto mt-8">
                            
                            <div className="bg-[#010A13]/60 border border-[#C8AA6E]/20 rounded-xl p-8 shadow-lg relative overflow-hidden">
                                {/* 装饰背景 */}
                                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                    <Cloud size={200} />
                                </div>

                                <div className="flex items-center gap-3 mb-6 border-b border-[#C8AA6E]/10 pb-4">
                                    <div className="p-2 bg-[#C8AA6E]/10 rounded-lg text-[#C8AA6E]">
                                        <Settings size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[#F0E6D2]">系统全局配置</h3>
                                        <p className="text-xs text-slate-500">
                                            修改此处的配置将实时同步到所有客户端，无需重新发版。
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-8 relative z-10">
                                    
                                    {/* 1. 下载链接配置模块 */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2 border-l-4 border-[#0AC8B9] pl-3">
                                            <Cloud size={16} className="text-[#0AC8B9]"/> 客户端下载源 (123云盘/直链)
                                        </h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* URL 输入 */}
                                            <div className="md:col-span-2">
                                                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block flex items-center gap-1">
                                                    <Link size={12}/> 下载链接 (URL)
                                                </label>
                                                <div className="relative group">
                                                    <input 
                                                        className="w-full bg-[#091428] border border-slate-700 rounded-lg py-3 px-4 text-slate-200 focus:border-[#C8AA6E] focus:ring-1 focus:ring-[#C8AA6E]/50 outline-none transition-all font-mono text-sm placeholder:text-slate-600"
                                                        placeholder="https://www.123pan.com/s/..."
                                                        value={downloadConfig.pan_url}
                                                        onChange={e => setDownloadConfig({...downloadConfig, pan_url: e.target.value})}
                                                    />
                                                    <div className="absolute inset-0 border border-transparent group-hover:border-[#C8AA6E]/20 rounded-lg pointer-events-none transition-colors"></div>
                                                </div>
                                            </div>

                                            {/* 密码输入 */}
                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block flex items-center gap-1">
                                                    <Key size={12}/> 提取码 (Password)
                                                </label>
                                                <input 
                                                    className="w-full bg-[#091428] border border-slate-700 rounded-lg py-3 px-4 text-slate-200 focus:border-[#C8AA6E] focus:ring-1 focus:ring-[#C8AA6E]/50 outline-none transition-all font-mono text-sm placeholder:text-slate-600"
                                                    placeholder="留空则不显示"
                                                    value={downloadConfig.pan_pwd}
                                                    onChange={e => setDownloadConfig({...downloadConfig, pan_pwd: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 分割线 */}
                                    <div className="h-px bg-white/5 w-full"></div>

                                    {/* 底部操作区 */}
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Activity size={14} className="text-[#0AC8B9]"/>
                                            <span>上次更新: 实时生效</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-4">
                                            {configLoading && <span className="text-xs text-[#0AC8B9] animate-pulse font-mono">正在同步数据...</span>}
                                            <button 
                                                onClick={handleSaveConfig}
                                                disabled={configLoading}
                                                className="px-8 py-2.5 bg-gradient-to-r from-[#C8AA6E] to-[#b09358] text-[#091428] font-black uppercase tracking-wider rounded shadow-lg hover:shadow-[#C8AA6E]/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Save size={16} strokeWidth={2.5} /> 保存配置
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* 提示信息卡片 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 flex gap-3">
                                    <div className="text-blue-400 mt-0.5"><Activity size={16}/></div>
                                    <div className="text-xs text-slate-400 leading-relaxed">
                                        <h4 className="text-blue-300 font-bold mb-1">即时生效机制</h4> 
                                        无需重新打包前端或重启服务器。保存后，所有用户再次打开“下载弹窗”时，会自动获取最新的云盘链接。
                                    </div>
                                </div>
                                <div className="bg-[#C8AA6E]/5 border border-[#C8AA6E]/20 rounded-lg p-4 flex gap-3">
                                    <div className="text-[#C8AA6E] mt-0.5"><Link size={16}/></div>
                                    <div className="text-xs text-slate-400 leading-relaxed">
                                        <h4 className="text-[#C8AA6E] font-bold mb-1">链接填写规范</h4> 
                                        建议优先使用 <strong>123云盘</strong> 或 <strong>蓝奏云</strong> 等不限速网盘。如果使用直链（如对象存储），请确保流量充足。
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;