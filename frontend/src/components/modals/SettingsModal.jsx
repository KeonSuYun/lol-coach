import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Keyboard, Command, Sparkles, MousePointer2, Volume2 } from 'lucide-react';
import ShortcutRecorder from '../ShortcutRecorder'; 

// 🔥 默认配置同步为 Ctrl+ 系列
const DEFAULT_SHORTCUTS = {
    toggle: 'Home',
    mouseMode: 'Tilde',
    refresh: 'Ctrl+F',
    modePrev: 'Ctrl+Z',
    modeNext: 'Ctrl+C',
    prevPage: 'Ctrl+A',
    nextPage: 'Ctrl+D',
    scrollUp: 'Ctrl+S',
    scrollDown: 'Ctrl+X',
    
    // 🔥 [新增] 语音播报默认快捷键：Ctrl + 空格
    playAudio: 'Ctrl+Space' 
};

const SettingsModal = ({ isOpen, onClose }) => {
    const [config, setConfig] = useState(DEFAULT_SHORTCUTS);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (isOpen && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('get-shortcuts')
                .then(savedConfig => {
                    if (savedConfig) {
                         // 🔥 核心修复：合并默认值！
                        // 防止旧配置文件里没有 playAudio 字段，导致被覆盖成空
                        setConfig(prev => ({
                            ...prev,       // 1. 先用默认值垫底
                            ...savedConfig // 2. 再用保存的覆盖
                        }));
                    }
                })
                .catch(err => console.error("无法加载快捷键配置:", err));
        }
    }, [isOpen]);

    const handleUpdate = (key, newValue) => {
        setConfig(prev => ({ ...prev, [key]: newValue }));
        setIsDirty(true);
    };

    const handleSave = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-shortcuts', config);
            setIsDirty(false);
            onClose();
        }
    };

    const handleReset = () => {
        if(confirm('确定要将所有快捷键恢复为默认设置 (Ctrl组合键) 吗？')) {
            setConfig(DEFAULT_SHORTCUTS);
            setIsDirty(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center animate-in fade-in zoom-in duration-200 pointer-events-auto">
            <div className="bg-[#0f172a] border border-[#C8AA6E]/40 w-[460px] rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh] relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#C8AA6E] to-transparent opacity-50"></div>
                <div className="flex items-center justify-between px-6 py-4 bg-[#091428] border-b border-white/5">
                    <h2 className="text-[#F0E6D2] font-bold text-sm tracking-widest flex items-center gap-2">
                        <Keyboard size={16} className="text-[#C8AA6E]" />
                        全局键位配置
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-full">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 bg-[#0b121e]">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[#C8AA6E] text-[10px] font-bold uppercase tracking-widest pb-2 border-b border-[#C8AA6E]/20">
                            <Command size={12}/> 核心交互 (Core)
                        </div>
                        <div className="grid gap-4 pl-1">
                            <ShortcutItem label="显示 / 隐藏窗口" desc="一键隐身，不遮挡游戏视线" value={config.toggle} onChange={(val) => handleUpdate('toggle', val)} />
                            <ShortcutItem label="呼出鼠标 / 调整大小" desc="解锁鼠标穿透，允许点击按钮" value={config.mouseMode} icon={<MousePointer2 size={12} className="text-amber-500"/>} onChange={(val) => handleUpdate('mouseMode', val)} />
                            <ShortcutItem label="强制刷新分析 (Refresh)" desc="局势变化时，强制 AI 重新思考" value={config.refresh} onChange={(val) => handleUpdate('refresh', val)} />
                            
                            {/* 🔥 [新增] 语音播报快捷键 */}
                            <ShortcutItem 
                                label="播放 / 停止语音 (TTS)" 
                                desc="一键让 AI 朗读当前战术分析" 
                                value={config.playAudio} 
                                icon={<Volume2 size={12} className="text-pink-400"/>}
                                onChange={(val) => handleUpdate('playAudio', val)} 
                            />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-widest pb-2 border-b border-blue-500/20">
                            <Sparkles size={12}/> 快捷操作 (Actions)
                        </div>
                        <div className="grid gap-4 pl-1">
                            <ShortcutItem label="切换功能模块" desc="例如：从 BP推荐 切换到 王者私教" value={[config.modePrev, config.modeNext]} isDual={true} onChange={(idx, val) => handleUpdate(idx === 0 ? 'modePrev' : 'modeNext', val)} />
                            <ShortcutItem label="翻页阅读" desc="内容太长时快速翻页" value={[config.prevPage, config.nextPage]} isDual={true} onChange={(idx, val) => handleUpdate(idx === 0 ? 'prevPage' : 'nextPage', val)} />
                            <ShortcutItem label="文本滚动" desc="类似鼠标滚轮的上下滚动" value={[config.scrollUp, config.scrollDown]} isDual={true} onChange={(idx, val) => handleUpdate(idx === 0 ? 'scrollUp' : 'scrollDown', val)} />
                        </div>
                    </div>
                </div>
                <div className="p-5 bg-[#050b14] border-t border-white/5 flex justify-between items-center shrink-0">
                    <button onClick={handleReset} className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded hover:bg-white/5 group">
                        <RotateCcw size={12} className="group-hover:-rotate-180 transition-transform duration-500"/> 恢复默认
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-xs text-slate-400 hover:text-white transition-colors font-medium rounded hover:bg-white/5">取消</button>
                        <button onClick={handleSave} disabled={!isDirty} className={`px-6 py-2 text-xs font-bold rounded flex items-center gap-2 transition-all shadow-lg ${isDirty ? 'bg-gradient-to-r from-[#C8AA6E] to-[#b08d55] text-[#091428] hover:brightness-110 hover:shadow-[#C8AA6E]/20 hover:-translate-y-0.5' : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'}`}>
                            <Save size={14}/> 保存配置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShortcutItem = ({ label, desc, value, onChange, isDual = false, icon }) => {
    return (
        <div className="flex items-center justify-between group/item p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
            <div className="flex flex-col gap-0.5">
                <span className="text-slate-200 text-xs font-medium flex items-center gap-2">{icon} {label}</span>
                <span className="text-[10px] text-slate-500 group-hover/item:text-slate-400 transition-colors">{desc}</span>
            </div>
            {isDual ? (
                <div className="flex flex-col gap-2 items-end">
                    <div className="flex items-center gap-2"><span className="text-[9px] text-slate-600 font-mono tracking-wider">PREV</span><ShortcutRecorder value={value[0]} onChange={(v) => onChange(0, v)} /></div>
                    <div className="flex items-center gap-2"><span className="text-[9px] text-slate-600 font-mono tracking-wider">NEXT</span><ShortcutRecorder value={value[1]} onChange={(v) => onChange(1, v)} /></div>
                </div>
            ) : (
                <ShortcutRecorder value={value} onChange={onChange} />
            )}
        </div>
    );
};

export default SettingsModal;