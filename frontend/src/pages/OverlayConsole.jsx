import React, { useState, useEffect } from 'react';
import { Settings, Lock, Wifi, WifiOff, Activity, Keyboard } from 'lucide-react';
// 🔴 修正点：路径改为 ../components/modals/SettingsModal
import SettingsModal from '../components/modals/SettingsModal'; 
import AnalysisResult from '../components/AnalysisResult';
import { Toaster } from 'react-hot-toast';

const OverlayConsole = () => {
    const [lcuStatus, setLcuStatus] = useState('disconnected');
    const [shortcutText, setShortcutText] = useState('F2');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiResult, setAiResult] = useState(""); 

    // 监听 IPC
    useEffect(() => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('get-shortcuts').then(data => {
                if(data?.toggle) setShortcutText(data.toggle);
            });
            ipcRenderer.on('shortcuts-updated', (e, data) => setShortcutText(data.toggle));
            ipcRenderer.on('lcu-status', (e, status) => setLcuStatus(status));
            
            // 监听后端发来的翻页指令
            ipcRenderer.on('keyboard-action', (e, action) => {
                console.log("前端收到指令:", action);
            });
        }
    }, []);

    const handleRegenerate = () => {
        setIsAnalyzing(true);
        setAiResult(""); 
        // 模拟请求...实际接你的API
        setTimeout(() => {
            setAiResult(`{"concise":{"title":"重新分析完成","content":"当前局势建议：控线发育..."},"detailed_tabs":[{"title":"对线细节","content":"注意走位..."},{"title":"团战","content":"切后排..."}]}`);
            setIsAnalyzing(false);
        }, 1500);
    };

    return (
        // 1. 外层容器全屏透明，不可点击 (pointer-events-none)
        <div className="h-screen w-screen bg-transparent pointer-events-none overflow-hidden relative">
            <Toaster position="top-center" />

            {/* 2. 内容卡片：固定位置，背景半透明，启用点击 (pointer-events-auto) */}
            <div className="absolute top-20 right-10 w-[350px] max-h-[600px] flex flex-col pointer-events-auto bg-[#091428]/90 backdrop-blur-md border border-[#C8AA6E]/40 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300">
                
                {/* Header */}
                <div className="h-10 bg-[#010A13]/80 border-b border-[#C8AA6E]/30 flex items-center justify-between px-3 select-none rounded-t-xl cursor-move drag-region">
                    <div className="flex items-center gap-2">
                        <span className="text-[#C8AA6E] font-bold text-xs tracking-widest">HEXLITE</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${lcuStatus === 'connected' ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-red-500'}`}></div>
                    </div>

                    <div className="flex items-center gap-2 no-drag">
                        {/* 快捷键提示条 */}
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5">
                            <span className="flex items-center gap-1"><Keyboard size={10}/> <span>{shortcutText} 开关</span></span>
                            <span>|</span>
                            <span>F3 上页</span>
                            <span>|</span>
                            <span>F4 下页</span>
                        </div>

                        <button onClick={() => setIsSettingsOpen(true)} className="text-slate-500 hover:text-[#C8AA6E] transition-colors">
                            <Settings size={14} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-[200px] overflow-hidden p-2 no-drag">
                    <AnalysisResult 
                        aiResult={aiResult}
                        isAnalyzing={isAnalyzing}
                        handleRegenerate={handleRegenerate}
                    />
                </div>
            </div>

            {/* 弹窗层 */}
            <div className="pointer-events-auto">
                <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            </div>
        </div>
    );
};

export default OverlayConsole;