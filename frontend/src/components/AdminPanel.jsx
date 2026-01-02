import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Search, User, Crown, XCircle, ChevronLeft, Tag, Plus, X, Trash2, Save, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config/constants';
import { toast } from 'react-hot-toast';

const AdminPanel = ({ onBack, token }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // --- 头衔编辑模态框状态 ---
    const [editingUser, setEditingUser] = useState(null);
    const [tempTitles, setTempTitles] = useState([]);
    const [newTitleInput, setNewTitleInput] = useState("");

    // 初始化加载
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { search: searchTerm }
            });
            setUsers(res.data);
        } catch (e) {
            toast.error("获取用户列表失败: " + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    };

    // 通用角色操作 (设为管理员/PRO/普通用户)
    const handleAction = async (username, action, value, label) => {
        if (!confirm(`确定将用户 [${username}] ${label} 吗？`)) return;
        
        try {
            await axios.post(`${API_BASE_URL}/admin/user/update`, 
                { username, action, value },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("操作成功");
            fetchUsers(); // 刷新列表
        } catch (e) {
            toast.error("操作失败: " + (e.response?.data?.detail || e.message));
        }
    };

    // --- 头衔管理逻辑 ---

    // 打开头衔编辑器
    const openTitleEditor = (user) => {
        setEditingUser(user);
        // 如果后端还没存 available_titles，默认给个基础列表
        setTempTitles(user.available_titles && user.available_titles.length > 0 ? user.available_titles : ["社区成员"]);
    };

    // 保存头衔更改到服务器
    const saveTitles = async () => {
        try {
            await axios.post(`${API_BASE_URL}/admin/user/titles`, 
                { username: editingUser.username, titles: tempTitles },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("头衔列表已更新");
            setEditingUser(null);
            fetchUsers(); // 刷新列表
        } catch (e) {
            toast.error("保存头衔失败: " + (e.response?.data?.detail || e.message));
        }
    };

    // 添加新头衔到暂存区
    const addTitle = () => {
        const val = newTitleInput.trim();
        if (val && !tempTitles.includes(val)) {
            setTempTitles([...tempTitles, val]);
            setNewTitleInput("");
        }
    };

    // 预设头衔 (点击直接加)
    const PRESETS = ["PRO 会员", "内测核心成员", "绝活哥", "金牌攻略作者", "职业选手", "峡谷之巅", "官方运营"];

    // 🔥🔥🔥 增强版：全方位获取显示名称 (兼容各种后端返回格式) 🔥🔥🔥
    const getDisplayName = (user) => {
        // 1. 尝试直接从根节点读取 (扁平化结构)
        if (user.gameName) return `${user.gameName} #${user.tagLine || 'HEX'}`;
        if (user.game_name) return `${user.game_name} #${user.tag_line || 'HEX'}`;
        if (user.summonerName) return `${user.summonerName} #${user.tagLine || 'HEX'}`;

        // 2. 尝试从 game_profile 对象读取 (嵌套结构)
        if (user.game_profile) {
            let profile = user.game_profile;
            
            // 防御：如果是 JSON 字符串，先解析
            if (typeof profile === 'string') {
                try { profile = JSON.parse(profile); } catch(e) {}
            }

            if (typeof profile === 'object') {
                const name = profile.gameName || profile.game_name || profile.summonerName || profile.name;
                const tag = profile.tagLine || profile.tag_line || profile.tag || "HEX";
                if (name) return `${name} #${tag}`;
            }
        }

        return null;
    };

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900 text-slate-100 overflow-y-auto font-sans animate-in slide-in-from-right duration-300">
            {/* 顶部导航栏 */}
            <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-md border-b border-slate-700/60 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-2 text-rose-500">
                        <Shield size={24} />
                        <h1 className="text-xl font-black tracking-wider uppercase">Admin Console</h1>
                    </div>
                </div>
                
                {/* 搜索框 */}
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="搜索用户名/邮箱..." 
                        className="bg-slate-800 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 w-64 transition-all text-slate-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                    />
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                </div>
            </div>

            {/* 用户列表主体 */}
            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                                <th className="p-4 font-semibold">用户 / 游戏ID</th>
                                <th className="p-4 font-semibold">当前身份</th>
                                <th className="p-4 font-semibold text-right">管理操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr><td colSpan="3" className="p-8 text-center text-slate-500">加载数据中...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan="3" className="p-8 text-center text-slate-500">未找到匹配的用户</td></tr>
                            ) : (
                                users.map(user => {
                                    const gameInfo = getDisplayName(user);
                                    return (
                                        <tr key={user.username} className="hover:bg-slate-700/30 transition-colors group">
                                            {/* 🔥 [修复] 同时显示用户名和游戏昵称 */}
                                            <td className="p-4 align-top">
                                                <div className="font-bold text-white flex items-center gap-2 text-base">
                                                    {user.username}
                                                    {user.role === 'admin' && <Shield size={14} className="text-rose-500"/>}
                                                </div>
                                                
                                                <div className="mt-1 flex flex-col gap-0.5">
                                                    {gameInfo ? (
                                                        <span className="text-sm text-indigo-300 font-medium flex items-center gap-1">
                                                            {gameInfo}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-500 italic flex items-center gap-1">
                                                            <AlertCircle size={10}/> 未同步游戏信息
                                                        </span>
                                                    )}
                                                    
                                                    {user.email && <div className="text-[10px] text-slate-600">{user.email}</div>}
                                                </div>
                                            </td>
                                            
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col gap-2 items-start">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] border font-bold uppercase
                                                        ${user.role === 'admin' ? 'bg-red-900/30 text-red-400 border-red-500/30' : 
                                                          user.role === 'pro' ? 'bg-[#C8AA6E]/20 text-[#C8AA6E] border-[#C8AA6E]/30' : 
                                                          'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                        {user.role}
                                                    </span>
                                                    
                                                    {/* 显示头衔 */}
                                                    {user.active_title && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] border border-slate-600 bg-slate-700/50 text-slate-300">
                                                            {user.active_title}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            
                                            <td className="p-4 text-right align-middle">
                                                <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    
                                                    {/* 按钮1：管理头衔 (打开弹窗) */}
                                                    <button 
                                                        onClick={() => openTitleEditor(user)} 
                                                        className="p-1.5 bg-slate-800 hover:bg-indigo-900/50 text-slate-400 hover:text-indigo-400 border border-slate-600 hover:border-indigo-500/50 rounded-lg transition-all" 
                                                        title="管理头衔列表"
                                                    >
                                                        <Tag size={16} />
                                                    </button>

                                                    {/* 按钮2：设为管理员 */}
                                                    {user.role !== 'admin' && user.role !== 'root' && (
                                                        <button 
                                                            onClick={() => handleAction(user.username, 'set_role', 'admin', '设为管理员')}
                                                            className="p-1.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 border border-slate-600 hover:border-rose-500/50 rounded-lg transition-all"
                                                            title="设为管理员权限"
                                                        >
                                                            <Shield size={16} />
                                                        </button>
                                                    )}
                                                    
                                                    {/* 按钮3：设为 PRO */}
                                                    <button 
                                                        onClick={() => handleAction(user.username, 'set_role', 'pro', '设为 PRO 会员')}
                                                        className="p-1.5 bg-slate-800 hover:bg-amber-900/50 text-slate-400 hover:text-amber-400 border border-slate-600 hover:border-amber-500/50 rounded-lg transition-all"
                                                        title="设为 PRO 身份"
                                                    >
                                                        <Crown size={16} />
                                                    </button>

                                                    {/* 按钮4：降级/重置 */}
                                                    <button 
                                                        onClick={() => handleAction(user.username, 'set_role', 'user', '降级为普通用户')}
                                                        className="p-1.5 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 border border-slate-600 hover:border-red-500/50 rounded-lg transition-all"
                                                        title="重置为普通用户"
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 头衔编辑器模态窗 */}
            {editingUser && (
                <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-600 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        {/* 关闭按钮 */}
                        <button 
                            onClick={() => setEditingUser(null)} 
                            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={20}/>
                        </button>
                        
                        <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                            <Tag className="text-indigo-500" size={20}/> 管理用户头衔
                        </h3>
                        <p className="text-sm text-slate-400 mb-6">
                            正在编辑用户: <span className="text-indigo-400 font-mono font-bold">{editingUser.username}</span>
                        </p>

                        {/* 已拥有列表 */}
                        <div className="mb-6">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">已拥有的头衔 (点击删除)</div>
                            <div className="flex flex-wrap gap-2 min-h-[50px] bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                {tempTitles.map(t => (
                                    <button 
                                        key={t} 
                                        onClick={() => setTempTitles(tempTitles.filter(item => item !== t))} 
                                        className="group flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-red-900/30 text-sm text-slate-200 hover:text-red-400 rounded-full border border-slate-600 hover:border-red-500/50 transition-all"
                                        title="移除此头衔"
                                    >
                                        {t}
                                        <Trash2 size={12} className="opacity-50 group-hover:opacity-100"/>
                                    </button>
                                ))}
                                {tempTitles.length === 0 && <span className="text-slate-600 text-sm italic self-center">暂无头衔数据</span>}
                            </div>
                        </div>

                        {/* 添加新头衔 */}
                        <div className="mb-6">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">添加新头衔</div>
                            
                            {/* 输入框 */}
                            <div className="flex gap-2 mb-4">
                                <input 
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all"
                                    placeholder="输入自定义头衔 (如: 国服第一)"
                                    value={newTitleInput}
                                    onChange={e => setNewTitleInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addTitle()}
                                />
                                <button 
                                    onClick={addTitle} 
                                    className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center justify-center"
                                >
                                    <Plus size={20}/>
                                </button>
                            </div>
                            
                            {/* 预设按钮 */}
                            <div className="flex flex-wrap gap-2">
                                {PRESETS.map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => !tempTitles.includes(p) && setTempTitles([...tempTitles, p])} 
                                        className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md border border-slate-700 border-dashed transition-colors hover:border-slate-500"
                                    >
                                        + {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 底部操作栏 */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                            <button 
                                onClick={() => setEditingUser(null)} 
                                className="px-5 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                            >
                                取消
                            </button>
                            <button 
                                onClick={saveTitles} 
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95 flex items-center gap-2"
                            >
                                <Save size={16} /> 保存更改
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;