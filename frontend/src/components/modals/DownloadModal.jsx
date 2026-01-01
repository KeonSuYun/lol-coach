import React from 'react';
import { Download, Zap, Map, Sword, Monitor, X, Cloud, Server, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../../config/constants';

const DownloadModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    // 🔥 全员开放的直链地址 (后端会负责重定向到对象存储)
    const DIRECT_LINK = `${API_BASE_URL}/download/client`;

    // 🔗 您提供的真实网盘链接
    const LANZOU_LINK = "https://wwauw.lanzouu.com/icEiM3ezythi";
    const PAN123_LINK = "https://www.123865.com/s/aIapjv-PvFih?pwd=AKgq#";

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-[#091428] border-2 border-[#C8AA6E] rounded-xl shadow-[0_0_50px_rgba(200,170,110,0.2)] overflow-hidden transform scale-100 transition-all">
                
                {/* 顶部装饰条 */}
                <div className="h-1.5 w-full bg-gradient-to-r from-[#091428] via-[#C8AA6E] to-[#091428]"></div>

                {/* 关闭按钮 */}
                <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors">
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

                            {/* 1. 官方高速直连 */}
                            <a 
                                href={DIRECT_LINK}
                                target="_blank"
                                className="group relative w-full py-4 bg-gradient-to-r from-[#C8AA6E] to-[#F0E6D2] hover:from-[#d9b877] hover:to-[#fff] text-[#091428] font-black text-lg rounded-lg shadow-[0_0_20px_rgba(200,170,110,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 overflow-hidden"
                            >
                                <Server size={20} className="relative z-10" />
                                <span className="relative z-10">官方高速直连 (推荐)</span>
                                <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            </a>

                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-slate-800"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-600 text-xs">备用下载通道</span>
                                <div className="flex-grow border-t border-slate-800"></div>
                            </div>

                            {/* 2. 蓝奏云 */}
                            <a 
                                href={LANZOU_LINK} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-between px-4 py-3 bg-[#010A13] border border-slate-700 rounded hover:border-[#0AC8B9] hover:text-[#0AC8B9] transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <Cloud size={18} className="text-blue-400 group-hover:text-[#0AC8B9]" />
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-bold text-slate-300 group-hover:text-white">蓝奏云下载</span>
                                        <span className="text-[10px] text-slate-500">密码: <span className="text-[#C8AA6E] font-mono">e7p9</span></span>
                                    </div>
                                </div>
                                <ExternalLink size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>

                            {/* 3. 123云盘 */}
                            <a 
                                href={PAN123_LINK} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-between px-4 py-3 bg-[#010A13] border border-slate-700 rounded hover:border-green-500 hover:text-green-400 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <Cloud size={18} className="text-green-600 group-hover:text-green-400" />
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-bold text-slate-300 group-hover:text-white">123 云盘下载</span>
                                        <span className="text-[10px] text-slate-500">提取码: <span className="text-[#C8AA6E] font-mono">AKgq</span></span>
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