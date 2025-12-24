import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, X, Terminal, User, Clock } from 'lucide-react';
import { API_BASE_URL } from '../config/constants';

const AdminDashboard = ({ token, onClose }) => {
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/admin/feedbacks`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFeedbacks(res.data);
            } catch (err) {
                if (err.response && err.response.status === 403) {
                    setError("⛔ 拒绝访问：你不是管理员账号");
                } else {
                    setError("获取数据失败: " + err.message);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#0f1115] w-full max-w-5xl h-[80vh] rounded-xl border border-slate-700 flex flex-col shadow-2xl overflow-hidden">
                
                {/* 标题栏 */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                    <div className="flex items-center gap-2 text-red-500 font-bold">
                        <ShieldAlert size={20} />
                        <span>后台审核中心 (ADMIN)</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>

                {/* 内容区 */}
                <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                    {loading && <div className="text-center text-slate-500 py-10">正在加载机密数据...</div>}
                    
                    {error && (
                        <div className="bg-red-950/30 border border-red-500/50 p-4 rounded text-red-400 text-center font-bold">
                            {error}
                        </div>
                    )}

                    {!loading && !error && feedbacks.length === 0 && (
                        <div className="text-center text-slate-500 py-10">暂无反馈记录，天下太平。</div>
                    )}

                    {/* 反馈列表 */}
                    <div className="grid gap-4">
                        {feedbacks.map((item) => (
                            <div key={item._id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-slate-600 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <User size={14} className="text-blue-400"/>
                                        <span className="text-slate-200 font-bold">{item.user_id}</span>
                                        <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">用户报告</span>
                                    </div>
                                    <div className="text-xs text-slate-600 font-mono flex items-center gap-1">
                                        <Clock size={12}/> ID: {item._id}
                                    </div>
                                </div>
                                
                                <div className="mb-3 pl-2 border-l-2 border-red-500/30">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">用户描述</h4>
                                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{item.description}</p>
                                </div>

                                <div className="bg-black/40 rounded p-2 font-mono text-xs border border-slate-800/50">
                                    <h4 className="text-[10px] text-green-600 font-bold mb-1 flex items-center gap-1">
                                        <Terminal size={10}/> 对局快照 (Context)
                                    </h4>
                                    <div className="text-green-400/80 break-all">
                                        {JSON.stringify(item.match_context, null, 2)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;