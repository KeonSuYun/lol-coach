// frontend/src/components/OverlayStatus.jsx
import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

const OverlayStatus = () => {
    const [isIgnored, setIsIgnored] = useState(true); // 默认认为是锁定的(穿透)

    useEffect(() => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            // 1. 初始化时获取当前状态
            ipcRenderer.invoke('get-mouse-status').then(status => {
                setIsIgnored(status);
            });

            // 2. 监听状态切换事件 (来自 Alt+W)
            const handler = (event, ignored) => {
                setIsIgnored(ignored);
                if (ignored) {
                    toast.success("游戏模式：鼠标已穿透 (Alt+W 解锁)", { 
                        icon: '🛡️', 
                        style: { background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155' }
                    });
                } else {
                    toast("操作模式：鼠标已激活", { 
                        icon: '👆',
                        style: { background: '#3b0764', color: '#e9d5ff', border: '1px solid #7e22ce' }
                    });
                }
            };
            
            ipcRenderer.on('mouse-ignore-status', handler);
            return () => ipcRenderer.removeListener('mouse-ignore-status', handler);
        }
    }, []);

    // 仅在悬浮窗模式下显示
    const isOverlay = window.location.href.includes('overlay=true');
    if (!isOverlay) return null;

    return (
        <div className={`
            fixed top-2 right-16 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-2xl transition-all duration-300 select-none
            ${isIgnored 
                ? 'bg-black/20 border-white/10 text-slate-500 opacity-40 hover:opacity-100' 
                : 'bg-amber-500/20 border-amber-500 text-amber-400 opacity-100 scale-105'
            }
        `}>
            {isIgnored ? <Lock size={12} /> : <Unlock size={12} />}
            <span className="text-[10px] font-bold font-mono">
                {isIgnored ? "Alt+W 解锁" : "Alt+W 锁定"}
            </span>
        </div>
    );
};

export default OverlayStatus;