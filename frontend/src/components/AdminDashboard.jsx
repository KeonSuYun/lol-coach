import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    ShieldAlert, X, Terminal, User, Clock, Activity, 
    DollarSign, TrendingUp, Users, Zap, AlertTriangle, 
    Database, Server, RefreshCw, Search, Plus, Edit 
} from 'lucide-react';
import { API_BASE_URL } from '../config/constants';

const COST_PER_CALL = 0.0043; // 单次调用成本 (RMB)

const AdminDashboard = ({ token, onClose }) => {
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'feedbacks' | 'users'
    
    // 原有的数据状态
    const [feedbacks, setFeedbacks] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [usingMockData, setUsingMockData] = useState(false);

    // 🟢 新增：用户管理相关状态
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [actionUser, setActionUser] = useState(null); // 当前正在操作的用户
    const [actionType, setActionType] = useState(null); // 'add_days' | 'set_role'
    const [actionValue, setActionValue] = useState("");

    // 获取基础数据 (概览 & 反馈)
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. 获取反馈列表
            const resFeedbacks = await axios.get(`${API_BASE_URL}/admin/feedbacks`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFeedbacks(resFeedbacks.data);

            // 2. 获取统计数据 (尝试调用 /admin/stats，如果后端没写这个接口，catch里用假数据兜底)
            try {
                const resStats = await axios.get(`${API_BASE_URL}/admin/stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(resStats.data);
                setUsingMockData(false);
            } catch (statsErr) {
                // 如果没有 stats 接口，使用演示数据
                setUsingMockData(true);
                setStats({
                    total_users: 128,
                    pro_users: 15,
                    total_revenue: 356.00,
                    total_api_calls: 2450,
                    recent_users: [
                        { username: "Faker_LPL", role: "pro", r1_used: 142, last_active: "10 mins ago" },
                        { username: "Uzi_Returns", role: "user", r1_used: 8, last_active: "1 hour ago" }
                    ]
                });
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

    // 🟢 新增：获取用户列表
    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/users`, {
                params: { search: searchQuery },
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch (err) {
            console.error("Fetch users failed", err);
        }
    };

    // 🟢 新增：提交用户修改 (补单/改权限)
    const handleUpdateUser = async () => {
        if (!actionUser || !actionValue) return;
        try {
            await axios.post(`${API_BASE_URL}/admin/user/update`, {
                username: actionUser.username,
                action: actionType,
                value: actionValue
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("操作成功！");
            setActionUser(null);
            fetchUsers(); // 刷新列表
        } catch (err) {
            alert("操作失败: " + (err.response?.data?.detail || err.message));
        }
    };

    // 初始加载
    useEffect(() => {
        fetchData();
    }, [token]);

    // 切换到用户标签或搜索时，加载用户列表
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab, searchQuery]);

    // 计算利润逻辑
    const calculateProfit = () => {
        if (!stats) return { cost: 0, profit: 0, margin: 0 };
        const cost = stats.total_api_calls * COST_PER_CALL;
        const profit = stats.total_revenue - cost;
        const margin = stats.total_revenue > 0 ? (profit / stats.total_revenue) * 100 : 0;
        return { cost, profit, margin };
    };

    const { cost, profit, margin } = calculateProfit();

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            {/* 主容器：海克斯风格 */}
            <div className="bg-[#091428] w-full max-w-6xl h-[85vh] rounded-xl border border-[#C8AA6E]/50 flex flex-col shadow-[0_0_50px_rgba(10,200,185,0.1)] overflow-hidden relative">
                
                {/* 顶部光效 */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#0AC8B9] to-transparent"></div>

                {/* 标题栏 */}
                <div className="p-5 border-b border-[#C8AA6E]/20 flex justify-between items-center bg-[#010A13]/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#C8AA6E]/10 rounded border border-[#C8AA6E]/30">
                            <ShieldAlert size={20} className="text-[#C8AA6E]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#F0E6D2] tracking-wider font-serif">HEXTECH ADMIN</h2>
                            <p className="text-[10px] text-[#0AC8B9] font-mono tracking-widest uppercase flex items-center gap-1">
                                <Server size={10}/> SYSTEM ONLINE
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded text-slate-400 hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>

                {/* 导航 Tab */}
                <div className="flex border-b border-[#C8AA6E]/20 bg-[#091428]">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-3 text-sm font-bold tracking-wide transition-all flex items-center gap-2
                            ${activeTab === 'overview' 
                                ? 'text-[#0AC8B9] border-b-2 border-[#0AC8B9] bg-[#0AC8B9]/5' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                    >
                        <Activity size={16}/> 监控中心
                    </button>
                    <button 
                        onClick={() => setActiveTab('feedbacks')}
                        className={`px-6 py-3 text-sm font-bold tracking-wide transition-all flex items-center gap-2
                            ${activeTab === 'feedbacks' 
                                ? 'text-[#0AC8B9] border-b-2 border-[#0AC8B9] bg-[#0AC8B9]/5' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                    >
                        <Database size={16}/> 用户反馈 
                        <span className="px-1.5 py-0.5 bg-red-900/50 text-red-200 text-[10px] rounded border border-red-500/30">{feedbacks.length}</span>
                    </button>
                    {/* 🟢 新增 Tab */}
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-3 text-sm font-bold tracking-wide transition-all flex items-center gap-2
                            ${activeTab === 'users' 
                                ? 'text-[#0AC8B9] border-b-2 border-[#0AC8B9] bg-[#0AC8B9]/5' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                    >
                        <Users size={16}/> 用户管理
                    </button>
                </div>

                {/* 内容区 */}
                <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-[url('https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/magic-pattern-sprite.png')] bg-opacity-5">
                    
                    {loading && (
                        <div className="h-full flex flex-col items-center justify-center text-[#0AC8B9] animate-pulse gap-3">
                            <Activity size={48} />
                            <span className="font-mono text-sm">CONNECTING TO NEURAL LINK...</span>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-red-950/30 border border-red-500/50 p-6 rounded text-red-400 text-center font-bold flex flex-col items-center gap-2">
                            <ShieldAlert size={32}/>
                            {error}
                        </div>
                    )}

                    {/* === Tab 1: 监控中心 === */}
                    {!loading && !error && activeTab === 'overview' && (
                        <div className="space-y-6 animate-fade-in-up">
                            
                            {usingMockData && (
                                <div className="bg-yellow-900/20 border border-yellow-600/30 p-2 rounded text-yellow-500 text-xs font-mono text-center flex items-center justify-center gap-2">
                                    <AlertTriangle size={12}/>
                                    DEMO MODE: Backend API (/admin/stats) not detected. Showing simulation data.
                                </div>
                            )}

                            {/* KPI 卡片 */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* 营收卡片 */}
                                <div className="bg-[#010A13]/60 border border-[#C8AA6E]/20 p-4 rounded-lg relative overflow-hidden group hover:border-[#C8AA6E]/50 transition-all">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <DollarSign size={40} className="text-[#C8AA6E]"/>
                                    </div>
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Revenue</div>
                                    <div className="text-2xl font-black text-[#F0E6D2] font-serif">¥{stats?.total_revenue?.toFixed(2)}</div>
                                    <div className="text-[10px] text-[#0AC8B9] mt-2 flex items-center gap-1">
                                        <TrendingUp size={10}/> +12% from last week
                                    </div>
                                </div>

                                {/* 成本卡片 */}
                                <div className="bg-[#010A13]/60 border border-red-900/30 p-4 rounded-lg relative overflow-hidden group hover:border-red-500/50 transition-all">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Server size={40} className="text-red-500"/>
                                    </div>
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">API Cost (Est.)</div>
                                    <div className="text-2xl font-black text-slate-200 font-serif">¥{cost.toFixed(2)}</div>
                                    <div className="text-[10px] text-slate-500 mt-2 font-mono">
                                        {stats?.total_api_calls} calls × ¥{COST_PER_CALL}
                                    </div>
                                </div>

                                {/* 净利润卡片 */}
                                <div className="bg-gradient-to-br from-[#0AC8B9]/10 to-[#091428] border border-[#0AC8B9]/40 p-4 rounded-lg relative overflow-hidden group shadow-[0_0_20px_rgba(10,200,185,0.1)]">
                                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                        <Zap size={40} className="text-[#0AC8B9]"/>
                                    </div>
                                    <div className="text-xs text-[#0AC8B9] font-bold uppercase tracking-wider mb-1">Net Profit</div>
                                    <div className="text-3xl font-black text-[#ffffff] font-serif drop-shadow-md">¥{profit.toFixed(2)}</div>
                                    <div className="text-[10px] text-[#0AC8B9]/80 mt-2 font-bold">
                                        Margin: {margin.toFixed(1)}%
                                    </div>
                                </div>

                                {/* 用户数 */}
                                <div className="bg-[#010A13]/60 border border-[#C8AA6E]/20 p-4 rounded-lg group hover:border-[#C8AA6E]/50 transition-all">
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Active Users</div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-[#F0E6D2] font-serif">{stats?.total_users}</span>
                                        <span className="text-xs text-[#C8AA6E] font-bold px-1.5 py-0.5 bg-[#C8AA6E]/10 rounded border border-[#C8AA6E]/20">
                                            {stats?.pro_users} PRO
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-1.5 mt-4 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-[#C8AA6E]" 
                                            style={{ width: `${(stats?.pro_users / stats?.total_users) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* 最近活跃用户 (仅展示) */}
                            <div className="bg-[#010A13]/40 border border-[#C8AA6E]/20 rounded-lg overflow-hidden">
                                <div className="px-4 py-3 bg-[#010A13]/80 border-b border-[#C8AA6E]/10 flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-[#C8AA6E] uppercase tracking-wider">Recent Activity</h3>
                                    <button onClick={fetchData} className="text-slate-500 hover:text-[#0AC8B9] transition">
                                        <RefreshCw size={14}/>
                                    </button>
                                </div>
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-[#091428] text-xs font-bold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-3">User</th>
                                            <th className="px-4 py-3">Tier</th>
                                            <th className="px-4 py-3">R1 Usage</th>
                                            <th className="px-4 py-3">Last Active</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#C8AA6E]/5">
                                        {stats?.recent_users?.map((user, idx) => (
                                            <tr key={idx} className="hover:bg-[#C8AA6E]/5 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-300">{user.username}</td>
                                                <td className="px-4 py-3">
                                                    {user.role === 'pro' ? (
                                                        <span className="text-[#C8AA6E] bg-[#C8AA6E]/10 px-2 py-0.5 rounded text-[10px] border border-[#C8AA6E]/30 font-bold">PRO</span>
                                                    ) : (
                                                        <span className="text-slate-500 text-[10px]">FREE</span>
                                                    )}
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

                    {/* === Tab 2: 用户反馈 === */}
                    {!loading && !error && activeTab === 'feedbacks' && (
                        <div className="grid gap-4 animate-fade-in-up">
                            {feedbacks.length === 0 ? (
                                <div className="text-center text-slate-500 py-20 flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                                        <ShieldAlert size={32} className="opacity-20"/>
                                    </div>
                                    <span>暂无反馈记录，系统运行平稳。</span>
                                </div>
                            ) : (
                                feedbacks.map((item) => (
                                    <div key={item._id} className="bg-[#010A13]/60 border border-slate-800 rounded-lg p-4 hover:border-[#0AC8B9]/30 transition-all group relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-red-500/50 group-hover:bg-[#0AC8B9] transition-colors"></div>
                                        <div className="flex justify-between items-start mb-3 pl-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center border border-slate-700">
                                                    <User size={14} className="text-[#0AC8B9]"/>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-200">{item.user_id}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                                        <Clock size={10}/> ID: {item._id}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] bg-red-900/20 text-red-400 px-2 py-1 rounded border border-red-900/30 uppercase font-bold tracking-wider">
                                                Bug Report
                                            </span>
                                        </div>
                                        <div className="pl-2 mb-4">
                                            <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{item.description}</p>
                                        </div>
                                        <div className="pl-2">
                                            <div className="bg-black/40 rounded p-3 font-mono text-[10px] border border-slate-800/50 text-[#0AC8B9]/70 overflow-x-auto custom-scrollbar">
                                                <div className="flex items-center gap-2 mb-1 text-slate-500 font-bold uppercase tracking-wider">
                                                    <Terminal size={10}/> Context Snapshot
                                                </div>
                                                <pre>{JSON.stringify(item.match_context, null, 2)}</pre>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* === Tab 3: 🟢 用户管理 (新增) === */}
                    {!loading && !error && activeTab === 'users' && (
                        <div className="animate-fade-in-up space-y-4">
                            {/* 搜索栏 */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="搜索用户名..." 
                                        className="w-full bg-[#010A13]/60 border border-slate-700 rounded pl-10 pr-4 py-2 text-slate-200 focus:border-[#0AC8B9] outline-none"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <button onClick={fetchUsers} className="bg-[#0AC8B9]/20 text-[#0AC8B9] px-4 rounded hover:bg-[#0AC8B9]/30 border border-[#0AC8B9]/30 transition">刷新</button>
                            </div>

                            {/* 用户列表表格 */}
                            <div className="bg-[#010A13]/40 border border-[#C8AA6E]/20 rounded-lg overflow-hidden min-h-[400px]">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-[#091428] text-xs font-bold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-3">用户名</th>
                                            <th className="px-4 py-3">角色</th>
                                            <th className="px-4 py-3">会员过期时间</th>
                                            <th className="px-4 py-3 text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#C8AA6E]/5">
                                        {users.map((user) => (
                                            <tr key={user._id} className="hover:bg-[#C8AA6E]/5 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-200">{user.username}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] border font-bold uppercase
                                                        ${user.role === 'admin' ? 'bg-red-900/30 text-red-400 border-red-500/30' : 
                                                          user.role === 'pro' ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] border-[#C8AA6E]/30' : 
                                                          'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs">
                                                    {user.membership_expire ? new Date(user.membership_expire).toLocaleDateString() + ' ' + new Date(user.membership_expire).toLocaleTimeString() : '-'}
                                                </td>
                                                <td className="px-4 py-3 flex justify-end gap-2">
                                                    {/* 补单按钮 */}
                                                    <button 
                                                        onClick={() => { setActionUser(user); setActionType('add_days'); setActionValue("30"); }}
                                                        className="flex items-center gap-1 bg-green-900/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs hover:bg-green-900/40 transition"
                                                        title="增加时长"
                                                    >
                                                        <Plus size={12}/> 补单
                                                    </button>
                                                    {/* 改权限按钮 */}
                                                    <button 
                                                        onClick={() => { setActionUser(user); setActionType('set_role'); setActionValue(user.role); }}
                                                        className="flex items-center gap-1 bg-blue-900/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-xs hover:bg-blue-900/40 transition"
                                                        title="修改权限"
                                                    >
                                                        <Edit size={12}/> 权限
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {users.length === 0 && (
                                    <div className="text-center py-10 text-slate-500 text-xs">没有找到相关用户</div>
                                )}
                            </div>

                            {/* 🟢 操作弹窗 (覆盖层) */}
                            {actionUser && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                                    <div className="bg-[#091428] border border-[#C8AA6E] p-6 rounded-lg w-full max-w-sm shadow-2xl animate-scale-in relative">
                                        <button onClick={() => setActionUser(null)} className="absolute top-3 right-3 text-slate-500 hover:text-white">
                                            <X size={18} />
                                        </button>

                                        <h3 className="text-[#C8AA6E] font-bold text-lg mb-4 flex items-center gap-2">
                                            {actionType === 'add_days' ? <DollarSign size={20}/> : <ShieldAlert size={20}/>}
                                            {actionType === 'add_days' ? '人工补单 (加时长)' : '修改用户角色'}
                                        </h3>
                                        
                                        <div className="bg-[#010A13] p-3 rounded border border-slate-700 mb-4">
                                            <p className="text-slate-400 text-xs">目标用户</p>
                                            <p className="text-white font-bold text-lg">{actionUser.username}</p>
                                        </div>

                                        {actionType === 'add_days' ? (
                                            <div className="mb-6">
                                                <label className="block text-xs text-slate-500 mb-2">增加天数 (Days)</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full bg-[#010A13] border border-slate-600 rounded p-3 text-white outline-none focus:border-[#C8AA6E] font-mono"
                                                    value={actionValue}
                                                    onChange={e => setActionValue(e.target.value)}
                                                />
                                                <div className="flex gap-2 mt-3">
                                                    {[7, 30, 90, 365].map(d => (
                                                        <button 
                                                            key={d} 
                                                            onClick={() => setActionValue(d.toString())} 
                                                            className="flex-1 bg-slate-800 text-xs py-2 rounded hover:bg-slate-700 text-slate-300 border border-slate-700"
                                                        >
                                                            +{d}天
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mb-6">
                                                <label className="block text-xs text-slate-500 mb-2">选择角色 (Role)</label>
                                                <select 
                                                    className="w-full bg-[#010A13] border border-slate-600 rounded p-3 text-white outline-none focus:border-[#C8AA6E]"
                                                    value={actionValue}
                                                    onChange={e => setActionValue(e.target.value)}
                                                >
                                                    <option value="user">User (普通用户)</option>
                                                    <option value="pro">Pro (会员)</option>
                                                    <option value="admin">Admin (管理员)</option>
                                                    <option value="vip">VIP (特殊)</option>
                                                    <option value="banned">Banned (封禁)</option>
                                                </select>
                                                <p className="text-[10px] text-slate-500 mt-2">
                                                    注意：设为 Admin 将赋予该用户管理后台访问权限。
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex gap-3 justify-end">
                                            <button onClick={() => setActionUser(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">取消</button>
                                            <button 
                                                onClick={handleUpdateUser} 
                                                className="px-6 py-2 bg-[#C8AA6E] text-black font-bold rounded hover:bg-[#b09358] transition text-sm shadow-[0_0_15px_rgba(200,170,110,0.3)]"
                                            >
                                                确认提交
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;