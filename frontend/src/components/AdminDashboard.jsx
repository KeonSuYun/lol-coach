import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    ShieldAlert, X, Terminal, User, Clock, Activity, 
    DollarSign, TrendingUp, Users, Zap, AlertTriangle, 
    Database, Server, RefreshCw, Search, Plus, Edit, Trash2, PenTool, Ban,
    Wallet, ArrowUpRight, EyeOff, HandCoins, CheckCircle2, MessageSquare, Send, Check,
    Cloud, Link, Save, Key, Settings, Briefcase, Gift, Lock,
    ChevronLeft, ChevronRight, Megaphone // 🔥 新增广播图标
} from 'lucide-react';
import { API_BASE_URL } from '../config/constants';
import { toast } from 'react-hot-toast';

const COST_PER_CALL = 0.01; 

// 🔥 [新增] 通用分页组件 (内部组件)
const Pagination = ({ currentPage, totalCount, pageSize, onPageChange }) => {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-end gap-3 p-3 bg-[#010A13]/40 border-t border-[#C8AA6E]/10 shrink-0">
            <span className="text-[10px] text-slate-500">
                共 {totalCount} 条，第 {currentPage} / {totalPages} 页
            </span>
            <div className="flex gap-1">
                <button 
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-30 hover:text-white hover:border-[#C8AA6E] transition-all"
                >
                    <ChevronLeft size={14} />
                </button>
                <button 
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-30 hover:text-white hover:border-[#C8AA6E] transition-all"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};

const AdminDashboard = ({ token, onClose, username }) => {
    const [activeTab, setActiveTab] = useState('overview'); 
    const [currentUserRole, setCurrentUserRole] = useState("user"); // 存储当前管理员的真实权限

    // --- 分页与数据状态 ---
    
    // 1. 监控中心 (前端分页)
    const [stats, setStats] = useState(null);
    const [monitorPage, setMonitorPage] = useState(1); // 页码状态

    // 2. 用户管理 (后端分页)
    const [users, setUsers] = useState([]); 
    const [usersTotal, setUsersTotal] = useState(0); // 总条数
    const [usersPage, setUsersPage] = useState(1);   // 页码
    const [searchQuery, setSearchQuery] = useState("");
    const [actionUser, setActionUser] = useState(null); 
    const [actionType, setActionType] = useState(null); 
    const [actionValue, setActionValue] = useState("");

    // 3. 销售结算 (前端分页)
    const [salesPartners, setSalesPartners] = useState([]);
    const [salesPage, setSalesPage] = useState(1); // 页码

    // 4. 用户反馈 (前端分页)
    const [feedbacks, setFeedbacks] = useState([]);
    const [feedbackPage, setFeedbackPage] = useState(1); // 页码
    const [showResolved, setShowResolved] = useState(false); // 是否显示已处理
    
    // 5. 广播相关状态 (🔥 新增)
    const [broadcastContent, setBroadcastContent] = useState("");
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    
    // 私信回复状态
    const [replyTarget, setReplyTarget] = useState(null); // 当前要回复的反馈对象 {id, user_id}
    const [replyContent, setReplyContent] = useState("");

    // 系统配置状态
    const [downloadConfig, setDownloadConfig] = useState({ pan_url: "", pan_pwd: "" });
    const [configLoading, setConfigLoading] = useState(false);

    // 通用加载/错误状态
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [usingMockData, setUsingMockData] = useState(false);

    // 🛡️ 权限判断逻辑
    useEffect(() => {
        // 每次打开面板，先核实一次身份
        axios.get(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setCurrentUserRole(res.data.role))
            .catch(() => {});
    }, [token]);

    // 🔥🔥🔥 核心定义：isRoot 
    const isRoot = currentUserRole === 'root'; // 超级管理员 (老板)

    // 🔥 Tab 过滤：使用 isRoot 而不是 isSuperAdmin
    const TABS = [
        { id: 'overview', label: '监控中心', icon: Activity },
        { id: 'users', label: '用户管理', icon: Users },
        // 🔥 仅 Root 可见 Sales, Broadcast 和 Config
        ...(isRoot ? [{ id: 'sales', label: '销售结算', icon: Wallet }] : []),
        { id: 'feedbacks', label: '用户反馈', icon: Database },
        ...(isRoot ? [{ id: 'broadcast', label: '全员广播', icon: Megaphone }] : []), // 🔥 新增广播入口
        ...(isRoot ? [{ id: 'config', label: '系统配置', icon: Settings }] : []),
    ];

    // ================= 1. 数据获取逻辑 =================

    const fetchData = async (isAutoRefresh = false) => {
        if (!isAutoRefresh) setLoading(true);
        setError(null);
        try {
            // 获取反馈
            const statusParam = showResolved ? 'all' : 'pending';
            const resFeedbacks = await axios.get(`${API_BASE_URL}/admin/feedbacks`, {
                params: { status: statusParam },
                headers: { Authorization: `Bearer ${token}` }
            });
            setFeedbacks(Array.isArray(resFeedbacks.data) ? resFeedbacks.data : []);

            // 获取统计数据 (核心监控数据)
            // 加上时间戳防止缓存
            if (activeTab === 'overview' || !stats) {
                try {
                    const resStats = await axios.get(`${API_BASE_URL}/admin/stats?_t=${Date.now()}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setStats(resStats.data);
                    setUsingMockData(false);
                } catch (statsErr) {
                    if (!isAutoRefresh && !stats) {
                        setUsingMockData(true);
                        setStats({
                            total_users: 0, pro_users: 0, total_revenue: 0, 
                            total_commissions: 0, total_api_calls: 0, recent_users: []
                        });
                    }
                }
            }

        } catch (err) {
            if (err.response && err.response.status === 403) {
                setError("⛔ 权限拒绝：您的账号没有管理员权限");
            } else {
                console.error("Dashboard Sync Error:", err);
            }
        } finally {
            if (!isAutoRefresh) setLoading(false);
        }
    };

    // 🔥 [核心] 用户列表：支持后端分页
    const fetchUsers = async (page = 1) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/users`, {
                params: { search: searchQuery, page: page, limit: 10 }, // 10条/页
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // 兼容 { items, total } 新格式 和 [list] 旧格式
            if (res.data.items) {
                setUsers(res.data.items);
                setUsersTotal(res.data.total);
            } else {
                setUsers(res.data);
                setUsersTotal(res.data.length);
            }
            setUsersPage(page);
        } catch (err) { 
            setUsers([]); 
            setUsersTotal(0);
        }
    };

    const fetchSalesPartners = async () => {
        if (!isRoot) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/sales/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSalesPartners(Array.isArray(res.data) ? res.data : []);
        } catch (err) { setSalesPartners([]); }
    };

    const fetchConfig = async () => {
        setConfigLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/config/client`);
            setDownloadConfig({
                pan_url: res.data.pan_url || "",
                pan_pwd: res.data.pan_pwd || ""
            });
        } catch (e) {
            console.error("Config load failed", e);
        } finally {
            setConfigLoading(false);
        }
    };

    // ================= 2. Effect Hooks (包含自动刷新) =================

    useEffect(() => { 
        fetchData(); 
        
        // 🔥🔥🔥 10秒自动刷新，保证监控列表是实时的
        const timer = setInterval(() => {
            if (activeTab === 'overview') {
                fetchData(true); // true = 静默刷新
            }
        }, 10000);

        return () => clearInterval(timer);
    }, [token, activeTab]); 

    useEffect(() => {
        // 切换 Tab 时重置页码并刷新数据
        if (activeTab === 'users') fetchUsers(1); 
        if (activeTab === 'sales') { fetchSalesPartners(); setSalesPage(1); }
        if (activeTab === 'feedbacks') { fetchData(); setFeedbackPage(1); }
        if (activeTab === 'config') fetchConfig();
    }, [activeTab, searchQuery, showResolved]);

    // ================= 3. 操作逻辑 =================
    
    const handleUpdateUser = async () => { 
        if (!actionUser) return; 
        try { 
            await axios.post(`${API_BASE_URL}/admin/user/update`, { 
                username: actionUser.username, 
                action: actionType, 
                value: actionValue 
            }, { headers: { Authorization: `Bearer ${token}` } }); 
            toast.success("操作成功"); 
            setActionUser(null); 
            fetchUsers(usersPage); // 刷新当前页
        } catch (err) { 
            toast.error(err.response?.data?.detail || "操作失败"); 
        } 
    };

    const handleSettle = async (partner) => { 
        if(!confirm("确定结算?")) return; 
        try { 
            await axios.post(`${API_BASE_URL}/admin/sales/settle`, { username: partner.username }, { headers: { Authorization: `Bearer ${token}` } }); 
            toast.success("已结算"); 
            fetchSalesPartners(); 
        } catch(e){ 
            toast.error("结算失败"); 
        } 
    };

    const handleResolveFeedback = async (id, adopt, type) => { 
        try { 
            // 默认奖励 1 次，如果选归档则 adopt=false
            await axios.post(`${API_BASE_URL}/admin/feedbacks/resolve`, { 
                feedback_id: id, 
                adopt: adopt, 
                reward: 1, 
                reward_type: type 
            }, { headers: { Authorization: `Bearer ${token}` } }); 
            
            toast.success("已处理"); 
            setFeedbacks(p => p.filter(f => f._id !== id)); 
        } catch(e){ 
            toast.error("操作失败"); 
        } 
    };

    const handleSendReply = async () => { 
        if(!replyContent) return; 
        try { 
            await axios.post(`${API_BASE_URL}/messages`, { receiver: replyTarget.user_id, content: replyContent }, { headers: { Authorization: `Bearer ${token}` } }); 
            toast.success("已发送"); 
            setReplyTarget(null); 
            setReplyContent(""); 
        } catch(e){ 
            toast.error("发送失败"); 
        } 
    };

    // 🔥 [新增] 广播发送处理
    const handleBroadcast = async () => {
        if (!broadcastContent.trim()) return toast.error("请输入广播内容");
        
        // 二次确认，防止误触
        if (!window.confirm("⚠️ 高危操作警告 ⚠️\n\n确定要向【全服所有用户】发送这条消息吗？\n此操作不可撤销！")) {
            return;
        }

        setIsBroadcasting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/admin/broadcast`, 
                { content: broadcastContent },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(res.data.msg);
            setBroadcastContent(""); // 清空输入框
        } catch (e) {
            toast.error(e.response?.data?.detail || "广播发送失败");
        } finally {
            setIsBroadcasting(false);
        }
    };

    const handleSaveConfig = async () => { 
        try { 
            setConfigLoading(true); 
            await axios.post(`${API_BASE_URL}/admin/config/client`, downloadConfig, { headers: { Authorization: `Bearer ${token}` } }); 
            toast.success("已保存"); 
        } catch(e){ 
            toast.error("保存失败"); 
        } finally { 
            setConfigLoading(false); 
        } 
    };

    // 辅助显示
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
        if (!user) return null;

        // 1. 🔍 优先：尝试读取 Python 后端存入根目录的标准字段 (snake_case)
        if (user.game_name && user.game_name !== "Unknown") {
            // 处理 tag_line 可能为空的情况
            const tag = user.tag_line || user.tagLine || "HEX";
            return `${user.game_name} #${tag}`;
        }

        // 2. 🔍 次选：尝试读取前端可能使用的驼峰字段 (camelCase)
        if (user.gameName && user.gameName !== "Unknown") {
            const tag = user.tagLine || user.tag_line || "HEX";
            return `${user.gameName} #${tag}`;
        }

        // 3. 🔍 兜底：尝试从 game_profile 嵌套对象中挖掘 (旧数据兼容)
        if (user.game_profile) {
            let p = user.game_profile;
            
            // 防御：如果是 JSON 字符串，尝试解析
            if (typeof p === 'string') {
                try { p = JSON.parse(p); } catch (e) {}
            }

            if (typeof p === 'object' && p) {
                // 暴力查找所有可能的 key
                const name = p.gameName || p.game_name || p.summonerName || p.name;
                const tag = p.tagLine || p.tag_line || p.tag || 'HEX';
                if (name && name !== "Unknown") {
                    return `${name} #${tag}`;
                }
            }
        }

        // 4. 🔥 终极兜底：如果完全没有 LCU 数据，显示 "未同步"
        return null; 
    };

    // 获取用户使用次数
    const getUserUsage = (user) => {
        if (user.usage_stats) {
            const r1 = Object.values(user.usage_stats.counts_reasoner || {}).reduce((a, b) => a + b, 0);
            const chat = Object.values(user.usage_stats.counts_chat || {}).reduce((a, b) => a + b, 0);
            return r1 + chat;
        }
        if (user.r1_used !== undefined) return user.r1_used;
        return "-";
    };

    // 🔥 前端分页数据切片 helper
    const getPaginatedData = (data, page, size = 10) => {
        if (!data || !Array.isArray(data)) return [];
        const start = (page - 1) * size;
        return data.slice(start, start + size);
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
                                <Server size={10}/> 
                                {isRoot ? <span className="text-red-500 font-bold">[ROOT ACCESS]</span> : <span className="text-blue-400 font-bold">[ADMIN MODE]</span>}
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
                            <RefreshCw size={48} className="animate-spin"/>
                            <span className="font-mono text-sm">正在同步节点数据...</span>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-red-950/30 border border-red-500/50 p-6 rounded text-red-400 text-center font-bold flex flex-col items-center gap-2">
                            <ShieldAlert size={32}/> {error}
                        </div>
                    )}

                    {/* === Tab 1: 监控中心 (前端分页) === */}
                    {!loading && !error && activeTab === 'overview' && (
                        <div className="space-y-6 animate-fade-in-up">
                            {usingMockData && (
                                <div className="bg-yellow-900/20 border border-yellow-600/30 p-2 rounded text-yellow-500 text-xs font-mono text-center flex items-center justify-center gap-2">
                                    <AlertTriangle size={12}/>
                                    演示模式：后端接口连接异常，当前显示为模拟数据。
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {isRoot ? (
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
                            <div className="bg-[#010A13]/40 border border-[#C8AA6E]/20 rounded-lg overflow-hidden flex flex-col h-[520px]">
                                <div className="px-4 py-3 bg-[#010A13]/80 border-b border-[#C8AA6E]/10 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-[#C8AA6E] uppercase tracking-wider">最近活跃用户 (Live)</h3>
                                        <div className="flex items-center gap-1 bg-green-900/30 px-2 py-0.5 rounded border border-green-500/30">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                            <span className="text-[10px] text-green-400 font-bold">50</span>
                                        </div>
                                    </div>
                                    <button onClick={() => fetchData(false)} className="text-slate-500 hover:text-[#0AC8B9] transition flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-white/5">
                                        <RefreshCw size={12}/> 立即刷新
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar bg-[#010A13]/20">
                                    <table className="w-full text-left text-sm text-slate-400 relative">
                                        <thead className="bg-[#091428] text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 bg-[#091428]">用户身份</th>
                                                <th className="px-4 py-3 bg-[#091428]">权限组</th>
                                                <th className="px-4 py-3 bg-[#091428]">核心调用</th>
                                                <th className="px-4 py-3 bg-[#091428]">最后活跃</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#C8AA6E]/5">
                                            {/* 🔥 使用前端分页 getPaginatedData */}
                                            {getPaginatedData(stats?.recent_users, monitorPage).map((user, idx) => {
                                                const gameId = getDisplayName(user);
                                                const isActiveNow = user.last_active && (new Date() - new Date(user.last_active) < 10 * 60 * 1000);
                                                return (
                                                    <tr key={idx} className={`transition-colors ${isActiveNow ? 'bg-[#0AC8B9]/5 hover:bg-[#0AC8B9]/10' : 'hover:bg-[#C8AA6E]/5'}`}>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <span className={`font-bold ${isActiveNow ? 'text-white' : 'text-slate-200'}`}>{user.username}</span>
                                                                {gameId ? (
                                                                    <span className="text-xs text-[#0AC8B9] font-mono mt-0.5">{gameId}</span>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-600 italic mt-0.5">未同步</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {user.role === 'pro' || user.role === 'vip' 
                                                                ? <span className="text-[#C8AA6E] bg-[#C8AA6E]/10 px-2 py-0.5 rounded text-[10px] border border-[#C8AA6E]/30 font-bold flex items-center w-fit gap-1"><CheckCircle2 size={10}/> PRO</span> 
                                                                : <span className="text-slate-500 text-[10px] border border-slate-700 px-2 py-0.5 rounded">FREE</span>}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono text-[#0AC8B9] font-bold">{user.r1_used}</td>
                                                        <td className="px-4 py-3 text-xs font-mono text-slate-500">
                                                            {user.last_active ? (
                                                                <span className={isActiveNow ? 'text-green-400 font-bold' : ''}>
                                                                    {new Date(user.last_active).toLocaleString()}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {/* 🔥 分页控件 */}
                                <Pagination 
                                    currentPage={monitorPage} 
                                    totalCount={stats?.recent_users?.length || 0} 
                                    pageSize={10} 
                                    onPageChange={setMonitorPage} 
                                />
                            </div>
                        </div>
                    )}

                    {/* === Tab 2: 用户管理 (后端分页) === */}
                    {!loading && !error && activeTab === 'users' && (
                        <div className="animate-fade-in-up space-y-4">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                    <input type="text" placeholder="搜索用户名..." className="w-full bg-[#010A13]/60 border border-slate-700 rounded pl-10 pr-4 py-2 text-slate-200 focus:border-[#0AC8B9] outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)} />
                                </div>
                                <button onClick={() => fetchUsers(1)} className="bg-[#0AC8B9]/20 text-[#0AC8B9] px-4 rounded hover:bg-[#0AC8B9]/30 border border-[#0AC8B9]/30 transition">刷新</button>
                            </div>
                            <div className="bg-[#010A13]/40 border border-[#C8AA6E]/20 rounded-lg overflow-hidden h-[550px] flex flex-col">
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full text-left text-sm text-slate-400 relative">
                                        <thead className="bg-[#091428] text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 bg-[#091428]">用户 / 游戏ID</th>
                                                <th className="px-4 py-3 bg-[#091428]">角色</th>
                                                <th className="px-4 py-3 bg-[#091428]">总调用</th>
                                                <th className="px-4 py-3 bg-[#091428]">会员过期时间</th>
                                                {isRoot && <th className="px-4 py-3 bg-[#091428] text-right">操作</th>}
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
                                                    <td className="px-4 py-3 font-mono text-white">
                                                        {getUserUsage(user)}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs">
                                                        {user.membership_expire ? new Date(user.membership_expire).toLocaleDateString() : '-'}
                                                    </td>
                                                    {isRoot && (
                                                        <td className="px-4 py-3 flex justify-end gap-2">
                                                            <button onClick={() => { setActionUser(user); setActionType('add_days'); setActionValue("30"); }} className="bg-green-900/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs hover:bg-green-900/40 transition">补单</button>
                                                            <button onClick={() => { setActionUser(user); setActionType('set_role'); setActionValue(user.role); }} className="bg-blue-900/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-xs hover:bg-blue-900/40 transition">权限</button>
                                                            <button onClick={() => { setActionUser(user); setActionType('set_role'); setActionValue('sales'); }} className="bg-emerald-900/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-xs hover:bg-emerald-900/40 transition flex items-center gap-1" title="设为销售合伙人"><Briefcase size={12}/> 销售</button>
                                                            <button onClick={() => { setActionUser(user); setActionType('set_role'); setActionValue('banned'); }} className="bg-red-950/30 text-red-500 border border-red-500/30 px-2 py-1 rounded text-xs hover:bg-red-900/50 transition flex items-center gap-1" title="禁用账号"><Ban size={12}/> 禁用</button>
                                                            <button onClick={() => { setActionUser(user); setActionType('delete'); setActionValue("confirm"); }} className="text-red-400 hover:text-white p-1"><Trash2 size={12}/></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* 🔥 分页控件 (后端分页) */}
                                <Pagination 
                                    currentPage={usersPage} 
                                    totalCount={usersTotal} 
                                    pageSize={10} 
                                    onPageChange={fetchUsers} 
                                />
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
                                                    <option value="sales">Sales (销售合伙人)</option> 
                                                    <option value="admin">Admin (管理员)</option>
                                                    <option value="banned">🚫 Banned (封禁/禁用)</option> 
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

                    {/* === Tab 3: 销售结算 (前端分页) === */}
                    {!loading && !error && activeTab === 'sales' && isRoot && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-[#010A13]/40 border border-[#C8AA6E]/20 rounded-lg overflow-hidden h-[500px] flex flex-col">
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full text-left text-sm text-slate-400 relative">
                                        <thead className="bg-[#091428] text-xs font-bold text-slate-500 uppercase sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-6 py-4 bg-[#091428]">销售员</th>
                                                <th className="px-6 py-4 bg-[#091428]">联系方式</th>
                                                <th className="px-6 py-4 text-right bg-[#091428]">推广单数</th>
                                                <th className="px-6 py-4 text-right bg-[#091428]">总销售额</th>
                                                <th className="px-6 py-4 text-right bg-[#091428]">历史已结</th>
                                                <th className="px-6 py-4 text-right bg-[#091428] text-[#C8AA6E]">本期应付 (需结算)</th>
                                                <th className="px-6 py-4 text-right bg-[#091428]">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#C8AA6E]/5">
                                            {getPaginatedData(salesPartners, salesPage).map((p, idx) => (
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
                                <Pagination 
                                    currentPage={salesPage} 
                                    totalCount={salesPartners.length} 
                                    pageSize={10} 
                                    onPageChange={setSalesPage} 
                                />
                            </div>
                        </div>
                    )}

                    {/* === Tab 4: 用户反馈 (前端分页) === */}
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

                            {/* 列表容器 */}
                            <div className="flex flex-col gap-4">
                                {feedbacks.length === 0 ? (
                                    <div className="text-center py-10 text-slate-500">
                                        <CheckCircle2 size={48} className="mx-auto mb-2 opacity-20"/>
                                        <p>暂无待处理反馈</p>
                                    </div>
                                ) : (
                                    getPaginatedData(feedbacks, feedbackPage).map((item) => (
                                        <div key={item._id} className="bg-[#010A13]/60 border border-slate-800 rounded-lg p-4 hover:border-[#0AC8B9]/30 transition-all flex flex-col gap-3 group">
                                            
                                            {/* 头部 */}
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
                                                <div className="mt-2 p-2 bg-black/30 rounded border border-white/5 text-[10px] text-slate-500 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                                                    <span className="text-[#C8AA6E] font-bold block mb-1">Context Snapshot:</span>
                                                    {JSON.stringify(item.match_context, null, 2)}
                                                </div>
                                            )}

                                            {/* 操作栏 */}
                                            <div className="flex justify-end gap-2 pt-2 border-t border-white/5 mt-1">
                                                <button 
                                                    onClick={() => setReplyTarget(item)}
                                                    className="px-3 py-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded text-xs hover:bg-blue-600/20 flex items-center gap-1 transition"
                                                >
                                                    <MessageSquare size={12}/> 私信回复
                                                </button>

                                               {item.status !== 'resolved' && (
                                                    <>
                                                        {/* 🔥 按钮 1: 奖励核心 */}
                                                        <button 
                                                            onClick={() => handleResolveFeedback(item._id, true, 'r1')}
                                                            className="px-3 py-1.5 bg-amber-600/10 text-amber-400 border border-amber-500/30 rounded text-xs hover:bg-amber-600/20 flex items-center gap-1 transition"
                                                            title="采纳并奖励 +1 核心模型次数"
                                                        >
                                                            <Gift size={12}/> 核心(+1)
                                                        </button>

                                                        {/* 🔥 按钮 2: 奖励快速 */}
                                                        <button 
                                                            onClick={() => handleResolveFeedback(item._id, true, 'chat')}
                                                            className="px-3 py-1.5 bg-cyan-600/10 text-cyan-400 border border-cyan-500/30 rounded text-xs hover:bg-cyan-600/20 flex items-center gap-1 transition"
                                                            title="采纳并奖励 +1 快速模型上限"
                                                        >
                                                            <Zap size={12}/> 快速(+1)
                                                        </button>

                                                        {/* 🔥 按钮 3: 仅归档 */}
                                                        <button 
                                                            onClick={() => handleResolveFeedback(item._id, false, 'none')}
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
                            
                            {/* 分页 */}
                            <Pagination 
                                currentPage={feedbackPage} 
                                totalCount={feedbacks.length} 
                                pageSize={10} 
                                onPageChange={setFeedbackPage} 
                            />
                            
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

                    {/* === Tab 6: 全员广播 (仅 Root) === */}
                    {!loading && !error && activeTab === 'broadcast' && isRoot && (
                        <div className="animate-fade-in-up max-w-2xl mx-auto mt-10">
                            <div className="bg-[#010A13]/60 border border-red-500/30 rounded-xl p-8 shadow-2xl relative overflow-hidden">
                                {/* 背景装饰 */}
                                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                                    <Megaphone size={150} />
                                </div>

                                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                                    <div className="p-3 bg-red-500/10 rounded-lg text-red-500 border border-red-500/20">
                                        <Megaphone size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[#F0E6D2]">全员系统广播</h3>
                                        <p className="text-xs text-red-400 font-mono mt-1">
                                            ⚠️ 警告：此消息将发送给服务器内所有注册用户
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <label className="text-xs text-slate-400 font-bold uppercase mb-2 block ml-1">
                                            消息内容
                                        </label>
                                        <textarea 
                                            className="w-full h-40 bg-[#091428] border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all resize-none placeholder:text-slate-600 custom-scrollbar text-sm leading-relaxed"
                                            placeholder="请输入要广播的公告内容..."
                                            value={broadcastContent}
                                            onChange={e => setBroadcastContent(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <div className="text-[10px] text-slate-500">
                                            * 发送后所有用户将在私信列表中收到来自 Root 的系统消息
                                        </div>
                                        
                                        <button 
                                            onClick={handleBroadcast}
                                            disabled={isBroadcasting || !broadcastContent.trim()}
                                            className={`
                                                px-8 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-black uppercase tracking-wider rounded-lg shadow-lg hover:shadow-red-900/50 transition-all flex items-center gap-2 active:scale-95
                                                ${(isBroadcasting || !broadcastContent.trim()) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:brightness-110'}
                                            `}
                                        >
                                            {isBroadcasting ? (
                                                <> <RefreshCw size={16} className="animate-spin"/> 发送中... </>
                                            ) : (
                                                <> <Send size={16} /> 立即群发 </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === Tab 5: 系统配置 (仅 Root 可见) === */}
                    {!loading && !error && activeTab === 'config' && isRoot && (
                        <div className="animate-fade-in-up space-y-6 max-w-4xl mx-auto mt-8">
                            
                            <div className="bg-[#010A13]/60 border border-[#C8AA6E]/20 rounded-xl p-8 shadow-lg relative overflow-hidden">
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
                                    
                                    {/* 下载配置 */}
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2 border-l-4 border-[#0AC8B9] pl-3">
                                            <Cloud size={16} className="text-[#0AC8B9]"/> 客户端下载源
                                        </h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="md:col-span-2">
                                                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block flex items-center gap-1">
                                                    <Link size={12}/> 下载链接 (URL)
                                                </label>
                                                <div className="relative group">
                                                    <input 
                                                        className="w-full bg-[#091428] border border-slate-700 rounded-lg py-3 px-4 text-slate-200 focus:border-[#C8AA6E] focus:ring-1 focus:ring-[#C8AA6E]/50 outline-none transition-all font-mono text-sm placeholder:text-slate-600"
                                                        placeholder="https://..."
                                                        value={downloadConfig.pan_url}
                                                        onChange={e => setDownloadConfig({...downloadConfig, pan_url: e.target.value})}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase mb-2 block flex items-center gap-1">
                                                    <Key size={12}/> 提取码
                                                </label>
                                                <input 
                                                    className="w-full bg-[#091428] border border-slate-700 rounded-lg py-3 px-4 text-slate-200 focus:border-[#C8AA6E] focus:ring-1 focus:ring-[#C8AA6E]/50 outline-none transition-all font-mono text-sm placeholder:text-slate-600"
                                                    placeholder="可选"
                                                    value={downloadConfig.pan_pwd}
                                                    onChange={e => setDownloadConfig({...downloadConfig, pan_pwd: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-white/5 w-full"></div>

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
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;