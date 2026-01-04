import React, { useState } from 'react';
import { X, CloudDownload, Copy, CheckCircle2, Download, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast'; // 如果您项目里没装 react-hot-toast，可以删掉这行，改用 alert 或忽略

// 🔥 核心逻辑：获取环境变量
// 优先读取 Vite 变量，回退读取 CRA/Webpack 变量，最后回退到空字符串
const PAN_LINK = import.meta.env?.VITE_PAN_LINK || process.env?.REACT_APP_PAN_LINK || "";
const PAN_PWD = import.meta.env?.VITE_PAN_PWD || process.env?.REACT_APP_PAN_PWD || "----";
// 如果您还有备用直连链接，也可以配在环境变量里
const DIRECT_LINK = import.meta.env?.VITE_DIRECT_LINK || process.env?.REACT_APP_DIRECT_LINK || "#";

const DownloadModal = ({ onClose }) => {
    const [copied, setCopied] = useState(false);

    // 复制提取码功能
    const handleCopyPwd = () => {
        if (!PAN_PWD || PAN_PWD === '----') return;
        navigator.clipboard.writeText(PAN_PWD);
        setCopied(true);
        // 如果有 toast 库
        if (typeof toast !== 'undefined') toast.success("提取码已复制！");
        
        setTimeout(() => setCopied(false), 2000);
    };

    // 123云盘跳转逻辑
    const handlePanClick = (e) => {
        if (!PAN_LINK || PAN_LINK === '#') {
            e.preventDefault();
            alert("下载链接未配置，请联系管理员或稍后再试。");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#091428] w-full max-w-lg rounded-xl border border-[#C8AA6E] shadow-[0_0_50px_rgba(200,170,110,0.2)] relative overflow-hidden">
                
                {/* 顶部装饰条 */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#C8AA6E] to-transparent"></div>

                {/* 关闭按钮 */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="p-8 text-center">
                    {/* 图标与标题 */}
                    <div className="w-16 h-16 bg-[#C8AA6E]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#C8AA6E]/30 shadow-[0_0_20px_rgba(200,170,110,0.2)]">
                        <Download size={32} className="text-[#C8AA6E]" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-[#F0E6D2] mb-2 font-serif tracking-wide">
                        下载 连接助手
                    </h2>
                    <p className="text-slate-400 text-sm mb-8">
                        解锁 LCU 自动同步、红蓝方自动修正、游戏内覆盖等 Pro 功能
                    </p>

                    {/* === 核心下载区域 (123云盘) === */}
                    <div className="bg-gradient-to-b from-[#C8AA6E]/10 to-[#091428] border border-[#C8AA6E]/40 rounded-lg p-6 mb-4 relative overflow-hidden group">
                        {/* 背景动效 */}
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <CloudDownload size={80} />
                        </div>

                        <div className="flex items-center justify-center gap-2 mb-4">
                            <h3 className="text-[#C8AA6E] font-bold text-lg">☁️ 123 云盘下载 (推荐)</h3>
                            <span className="bg-[#C8AA6E] text-[#091428] text-[10px] px-2 py-0.5 rounded font-bold">FAST</span>
                        </div>

                        {/* 提取码显示与复制 */}
                        <div 
                            onClick={handleCopyPwd}
                            className="bg-black/30 border border-[#C8AA6E]/20 rounded px-4 py-2 mb-5 inline-flex items-center gap-3 cursor-pointer hover:bg-black/50 hover:border-[#C8AA6E]/50 transition-all group/pwd"
                            title="点击复制提取码"
                        >
                            <span className="text-slate-400 text-xs">提取码:</span>
                            <span className="text-[#0AC8B9] font-mono font-bold text-xl tracking-widest">{PAN_PWD}</span>
                            <div className="text-slate-500 group-hover/pwd:text-white transition-colors">
                                {copied ? <CheckCircle2 size={14} className="text-green-500"/> : <Copy size={14}/>}
                            </div>
                        </div>

                        {/* 下载按钮 */}
                        <a 
                            href={PAN_LINK}
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={handlePanClick}
                            className="block w-full bg-[#C8AA6E] hover:bg-[#b09358] text-[#091428] font-bold py-3 rounded transition-all shadow-lg hover:shadow-[0_0_20px_rgba(200,170,110,0.4)] flex items-center justify-center gap-2"
                        >
                            <ExternalLink size={18} /> 立即前往下载
                        </a>
                        <p className="text-[10px] text-slate-500 mt-2">
                            * 推荐使用云盘下载，速度快且永久保存
                        </p>
                    </div>

                    {/* === 备用通道 (直连) === */}
                    <div className="border-t border-slate-800 pt-4 mt-4">
                        <p className="text-xs text-slate-500 mb-3">备用下载通道</p>
                        <a 
                            href={DIRECT_LINK}
                            // 如果 DIRECT_LINK 是 '#'，可以去掉 target blank 防止空跳转
                            target={DIRECT_LINK !== '#' ? "_blank" : "_self"}
                            rel="noopener noreferrer"
                            className={`block w-full border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 py-2.5 rounded text-sm transition-all flex items-center justify-center gap-2 ${DIRECT_LINK === '#' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Download size={14} /> 官方高速直连 (如云盘无法访问请点此)
                        </a>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DownloadModal;