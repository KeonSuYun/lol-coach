import React, { useState, useEffect } from 'react';
import { Settings, Lock, Wifi, WifiOff, Activity, Keyboard, RotateCcw } from 'lucide-react';
import SettingsModal from '../components/modals/SettingsModal'; 
import AnalysisResult from '../components/AnalysisResult';
import { Toaster, toast } from 'react-hot-toast';

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
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        setAiResult(""); 
        
        // 模拟请求...实际场景中你可能需要调用 useGameCore 的逻辑或者发送 IPC 消息给主窗口请求分析
        // 这里保持原本的模拟逻辑，或者你可以对接真实的重新分析接口
        setTimeout(() => {
            setAiResult(`{"concise":{"title":"战术更新完成","content":"检测到局势变化，建议立即..."},"detailed_tabs":[{"title":"最新策略","content":"对方打野露头..."}]}`);
            setIsAnalyzing(false);
            toast.success("分析已刷新");
        }, 1000);
    };

    // 占位函数：防止点击 AnalysisResult 中的反馈按钮导致崩溃
    // 悬浮窗通常只用于查看，反馈建议去主窗口
    const handleFeedbackStub = () => toast("请在主窗口进行反馈操作", { icon: 'ℹ️' });
    const handleSetContentStub = () => {}; 

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
                            <span className="flex items-center gap-1"><Keyboard size={10}/> <span>{shortcutText}</span></span>
                        </div>

                        {/* ✅ 新增：由于 AnalysisResult 移除了内部按钮，我们在 Header 这里补一个刷新按钮 */}
                        <button 
                            onClick={handleRegenerate} 
                            disabled={isAnalyzing}
                            className={`text-slate-500 hover:text-[#0AC8B9] transition-colors ${isAnalyzing ? 'animate-spin opacity-50' : ''}`}
                            title="重新分析"
                        >
                            <RotateCcw size={14} />
                        </button>

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
                        setShowFeedbackModal={handleFeedbackStub}
                        setFeedbackContent={handleSetContentStub}
                        // 悬浮窗暂时不处理发送到聊天框的快捷键触发，传 0 即可
                        sendChatTrigger={0}
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