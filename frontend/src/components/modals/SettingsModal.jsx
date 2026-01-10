import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Keyboard, Command, MousePointer2, Volume2, Eye } from 'lucide-react';
import ShortcutRecorder from '../ShortcutRecorder'; 

// 默认快捷键配置
const DEFAULT_SHORTCUTS = {
    toggle: 'Home', mouseMode: 'Tilde', refresh: 'Ctrl+F',
    toggleView: 'Ctrl+E', modePrev: 'Ctrl+Z', modeNext: 'Ctrl+C',
    prevPage: 'Ctrl+A', nextPage: 'Ctrl+D', scrollUp: 'Ctrl+S',
    scrollDown: 'Ctrl+X', playAudio: 'Ctrl+Space'
};

// 🔥 [修改] 默认视觉配置 (改为透明度与字体大小)
const DEFAULT_VISUALS = {
    transparency: 5, // 默认 5% 透明 (即 95% 不透明)
    fontSize: 1.0,   // 默认 1.0 倍字体大小
    volume: 1.0      // TTS 音量
};

const SettingsModal = ({ isOpen, onClose }) => {
    const [config, setConfig] = useState(DEFAULT_SHORTCUTS);
    const [visuals, setVisuals] = useState(DEFAULT_VISUALS);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (isOpen && window.require) {
            const { ipcRenderer } = window.require('electron');
            // 1. 获取快捷键
            ipcRenderer.invoke('get-shortcuts').then(saved => {
                if (saved) setConfig(prev => ({ ...prev, ...saved }));
            });
            // 2. 获取视觉配置 (兼容旧版数据清洗)
            const savedVisuals = localStorage.getItem('hex_visual_config');
            if (savedVisuals) {
                const parsed = JSON.parse(savedVisuals);
                // 如果旧版数据存在(opacity)，则重置为默认，防止逻辑冲突
                if (parsed.opacity !== undefined) {
                    setVisuals(DEFAULT_VISUALS);
                } else {
                    setVisuals(parsed);
                }
            }
        }
    }, [isOpen]);

    const handleUpdateShortcut = (key, newValue) => {
        setConfig(prev => ({ ...prev, [key]: newValue }));
        setIsDirty(true);
    };

    // 视觉调节逻辑
    const handleVisualChange = (key, value) => {
        const newVal = parseFloat(value);
        const newVisuals = { ...visuals, [key]: newVal };
        
        setVisuals(newVisuals);
        setIsDirty(true);
        
        // 1. 保存到本地
        localStorage.setItem('hex_visual_config', JSON.stringify(newVisuals));
        
        // 2. 立即发送 IPC 消息给悬浮窗预览
        if (window.require) {
            window.require('electron').ipcRenderer.send('update-visuals', newVisuals);
        }
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
        if(confirm('恢复默认设置？')) {
            setConfig(DEFAULT_SHORTCUTS);
            setVisuals(DEFAULT_VISUALS);
            if (window.require) {
                window.require('electron').ipcRenderer.send('update-visuals', DEFAULT_VISUALS);
            }
            setIsDirty(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center animate-in fade-in zoom-in duration-200 pointer-events-auto">
            <div className="bg-[#0f172a] border border-[#C8AA6E]/40 w-[500px] rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 bg-[#091428] border-b border-white/5">
                    <h2 className="text-[#F0E6D2] font-bold text-sm tracking-widest flex items-center gap-2">
                        <Keyboard size={16} className="text-[#C8AA6E]" /> 个性化配置
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-full"><X size={18} /></button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 bg-[#0b121e]">
                    
                    {/* === 视觉与体验调节 === */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest pb-2 border-b border-emerald-500/20">
                            <Eye size={12}/> 视觉与体验 (Overlay)
                        </div>
                        
                        <div className="grid gap-6 pl-1">
                            {/* 🔥 [修改] 背景透明度滑块 */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-1 w-24">
                                    <span className="text-slate-200 text-xs font-bold">背景透明度</span>
                                    <span className="text-[10px] text-slate-500">Transparency</span>
                                </div>
                                <input 
                                    type="range" min="0" max="80" step="5" 
                                    value={visuals.transparency}
                                    onChange={(e) => handleVisualChange('transparency', e.target.value)}
                                    className="flex-1 accent-emerald-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs font-mono w-8 text-right text-emerald-400">{visuals.transparency}%</span>
                            </div>

                            {/* 🔥 [修改] 字体大小滑块 */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-1 w-24">
                                    <span className="text-slate-200 text-xs font-bold">字体大小</span>
                                    <span className="text-[10px] text-slate-500">Font Size</span>
                                </div>
                                <input 
                                    type="range" min="0.8" max="1.5" step="0.05" 
                                    value={visuals.fontSize}
                                    onChange={(e) => handleVisualChange('fontSize', e.target.value)}
                                    className="flex-1 accent-blue-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs font-mono w-8 text-right text-blue-400">{Math.round(visuals.fontSize * 100)}%</span>
                            </div>

                            {/* 音量滑块 (保持不变) */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col gap-1 w-24">
                                    <span className="text-slate-200 text-xs font-bold">播报音量</span>
                                    <span className="text-[10px] text-slate-500">TTS Volume</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={visuals.volume}
                                    onChange={(e) => handleVisualChange('volume', e.target.value)}
                                    className="flex-1 accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-xs font-mono w-8 text-right text-pink-400">{Math.round(visuals.volume * 100)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* === 快捷键区域 === */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[#C8AA6E] text-[10px] font-bold uppercase tracking-widest pb-2 border-b border-[#C8AA6E]/20">
                            <Command size={12}/> 核心键位 (Keybindings)
                        </div>
                        <div className="grid gap-4 pl-1">
                            <ShortcutItem label="显示/隐藏窗口" desc="老板键" value={config.toggle} onChange={(val) => handleUpdateShortcut('toggle', val)} />
                            <ShortcutItem label="鼠标穿透开关" desc="操作/游戏模式切换" value={config.mouseMode} icon={<MousePointer2 size={12} className="text-amber-500"/>} onChange={(val) => handleUpdateShortcut('mouseMode', val)} />
                            <ShortcutItem label="语音播报 (TTS)" desc="朗读当前分析" value={config.playAudio} icon={<Volume2 size={12} className="text-pink-400"/>} onChange={(val) => handleUpdateShortcut('playAudio', val)} />
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-[#050b14] border-t border-white/5 flex justify-between items-center shrink-0">
                    <button onClick={handleReset} className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded hover:bg-white/5"><RotateCcw size={12}/> 恢复默认</button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-xs text-slate-400 hover:text-white transition-colors">取消</button>
                        <button onClick={handleSave} disabled={!isDirty} className={`px-6 py-2 text-xs font-bold rounded flex items-center gap-2 transition-all shadow-lg ${isDirty ? 'bg-gradient-to-r from-[#C8AA6E] to-[#b08d55] text-[#091428] hover:brightness-110' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                            <Save size={14}/> 保存配置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShortcutItem = ({ label, desc, value, onChange, icon }) => {
    return (
        <div className="flex items-center justify-between group/item p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
            <div className="flex flex-col gap-0.5">
                <span className="text-slate-200 text-xs font-medium flex items-center gap-2">{icon} {label}</span>
                <span className="text-[10px] text-slate-500 group-hover/item:text-slate-400 transition-colors">{desc}</span>
            </div>
            <ShortcutRecorder value={value} onChange={onChange} />
        </div>
    );
};

export default SettingsModal;