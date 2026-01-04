import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Monitor, Map, Sword, X, Cloud, Server, ExternalLink, Copy, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../config/constants';
import { toast } from 'react-hot-toast';

const DownloadModal = ({ isOpen, onClose }) => {
    // 状态管理
    const [panConfig, setPanConfig] = useState({ 
        link: "", 
        pwd: "" 
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    // 🔥 监听打开事件，获取最新链接
    useEffect(() => {
        if (isOpen) {
            const fetchConfig = async () => {
                setLoading(true);
                setError(false);
                try {
                    // 调用后端 API 获取配置
                    const res = await axios.get(`${API_BASE_URL}/api/config/client`);
                    if (res.data) {
                        setPanConfig({
                            link: res.data.pan_url || "",
                            pwd: res.data.pan_pwd || ""
                        });
                    }
                } catch (e) {
                    console.error("Failed to fetch download config", e);
                    setError(true);
                    // 失败时可以设置一个默认的备用链接 (可选)
                    // setPanConfig({ link: "https://fallback-url.com", pwd: "" });
                } finally {
                    setLoading(false);
                }
            };
            fetchConfig();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // 备用直链 (指向后端 API 路由，作为最后的保障)
    const DIRECT_LINK = `${API_BASE_URL}/api/download/client`;

    // 处理云盘点击：复制密码并跳转
    const handlePanClick = (e) => {
        if (!panConfig.link || panConfig.link === '#') {
            e.preventDefault();
            toast.error("下载链接暂未配置，请稍后再试");
            return;
        }

        // 如果有提取码，先复制
        if (panConfig.pwd && panConfig.pwd.trim() !== "") {
            navigator.clipboard.writeText(panConfig.pwd).then(() => {
                toast.success(`提取码 ${panConfig.pwd} 已复制，即将跳转...`, { duration: 3000 });
            }).catch(() => {
                toast("正在跳转下载页面...", { icon: '🚀' });
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-[#091428] border-2 border-[#C8AA6E] rounded-xl shadow-[0_0_50px_rgba(200,170,110,0.2)] overflow-hidden transform scale-100 transition-all">
                
                {/* 顶部装饰条 */}
                <div className="h-1.5 w-full bg-gradient-to-r from-[#091428] via-[#C8AA6E] to-[#091428]"></div>

                {/* 关闭按钮 */}
                <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
                    <X size={24} />
                </button>

                <div className="p-8">
                    {/* 标题区 */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#C8AA6E]/20 text-[#C8AA6E] mb-4 shadow-[0_0_15px_rgba(200,170,110,0.4)]">
                            <Download size={28} />
                        </div>
                        <h2 className="text-3xl font-bold text-white tracking-widest uppercase">
                            下载 <span className="text-[#C8AA6E]">连接助手</span>
                        </h2>
                        <p className="text-sm text-slate-400 mt-2">
                            解锁 LCU 自动同步、红蓝方自动修正、游戏内覆盖等 Pro 功能
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* 左侧：核心功能列表 */}
                        <div className="space-y-4">
                            <h3 className="text-[#0AC8B9] font-bold text-sm tracking-widest uppercase border-b border-[#0AC8B9]/30 pb-2 mb-4">
                                客户端专属特权
                            </h3>
                            
                            <div className="flex items-start gap-3">
                                <div className="bg-[#0AC8B9]/10 p-2 rounded text-[#0AC8B9]"><Monitor size={18} /></div>
                                <div>
                                    <h4 className="text-slate-200 font-bold text-sm">自动 BP 同步</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">秒级读取选人状态，告别手动录入</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="bg-[#C8AA6E]/10 p-2 rounded text-[#C8AA6E]"><Map size={18} /></div>
                                <div>
                                    <h4 className="text-slate-200 font-bold text-sm">红蓝方自动修正</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">再也不用担心打野路线反向了</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="bg-purple-900/30 p-2 rounded text-purple-400"><Sword size={18} /></div>
                                <div>
                                    <h4 className="text-slate-200 font-bold text-sm">游戏内覆盖 (Overlay)</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">直接在游戏内看攻略</p>
                                </div>
                            </div>
                        </div>

                        {/* 右侧：下载通道选择 */}
                        <div className="flex flex-col justify-center gap-3">
                            <div className="text-center mb-2">
                                <span className="text-xs font-mono text-slate-500 bg-[#010A13] px-2 py-1 rounded border border-slate-800">
                                    当前版本: V1.0.0 (Win10/11)
                                </span>
                            </div>

                            {/* 1. 动态云盘按钮 */}
                            {loading ? (
                                <div className="w-full py-6 bg-slate-800/50 rounded-lg flex flex-col items-center justify-center gap-2 border border-slate-700 animate-pulse">
                                    <Loader2 size={24} className="animate-spin text-[#C8AA6E]" />
                                    <span className="text-xs text-slate-400">正在获取最新下载地址...</span>
                                </div>
                            ) : error ? (
                                <div className="w-full py-4 bg-red-900/20 border border-red-500/30 rounded-lg flex flex-col items-center justify-center gap-1 text-red-400">
                                    <AlertCircle size={20} />
                                    <span className="text-xs">获取链接失败，请使用下方备用通道</span>
                                </div>
                            ) : (
                                <a 
                                    href={panConfig.link || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={handlePanClick}
                                    className={`group relative w-full py-4 bg-gradient-to-r from-[#C8AA6E] to-[#F0E6D2] hover:from-[#d9b877] hover:to-[#fff] text-[#091428] font-black text-lg rounded-lg shadow-[0_0_20px_rgba(200,170,110,0.3)] hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-1 overflow-hidden ${!panConfig.link ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex items-center gap-2 relative z-10">
                                        <Cloud size={22} className="relative z-10" />
                                        <span className="relative z-10">123 云盘下载 (推荐)</span>
                                    </div>
                                    
                                    {/* 提取码显示 (如果有) */}
                                    {panConfig.pwd && (
                                        <div className="relative z-10 text-xs font-mono font-normal bg-[#091428]/10 px-2 py-0.5 rounded border border-[#091428]/20 mt-1 flex items-center gap-1">
                                            <span>提取码:</span>
                                            <span className="font-bold select-all">{panConfig.pwd}</span>
                                            <Copy size={10} className="opacity-50" />
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                </a>
                            )}

                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-slate-800"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-600 text-xs">备用下载通道</span>
                                <div className="flex-grow border-t border-slate-800"></div>
                            </div>

                            {/* 2. 官方直链 (副选 - 始终可用) */}
                            <a 
                                href={DIRECT_LINK} 
                                target="_blank" 
                                className="flex items-center justify-between px-4 py-3 bg-[#010A13] border border-slate-700 rounded hover:border-[#0AC8B9] hover:text-[#0AC8B9] transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <Server size={18} className="text-blue-500 group-hover:text-[#0AC8B9]" />
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-bold text-slate-300 group-hover:text-white">官方高速直连</span>
                                        <span className="text-[10px] text-slate-500">如云盘无法访问请点此</span>
                                    </div>
                                </div>
                                <ExternalLink size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DownloadModal;