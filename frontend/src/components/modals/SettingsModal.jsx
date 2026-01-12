import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Keyboard, Command, MousePointer2, Volume2, Eye, ArrowLeftRight, Layers, Layout } from 'lucide-react';
import ShortcutRecorder from '../ShortcutRecorder'; 

const DEFAULT_SHORTCUTS = {
    toggle: 'Home', mouseMode: 'Tilde', refresh: 'Ctrl+F',
    toggleView: 'Ctrl+E', modePrev: 'Ctrl+Z', modeNext: 'Ctrl+C',
    prevPage: 'Ctrl+A', nextPage: 'Ctrl+D', scrollUp: 'Ctrl+S',
    scrollDown: 'Ctrl+X', playAudio: 'Ctrl+Space',
    hudTab1: 'Ctrl+F1', hudTab2: 'Ctrl+F2', hudTab3: 'Ctrl+F3'
};

// 🔥 [修改] 默认透明度 80 (即 20% 不透明度)，默认字体 1.5x
const DEFAULT_VISUALS = { transparency: 80, fontSize: 1.5, volume: 1.0 };

const SettingsModal = ({ isOpen, onClose }) => {
    const [config, setConfig] = useState(DEFAULT_SHORTCUTS);
    const [visuals, setVisuals] = useState(DEFAULT_VISUALS);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (isOpen && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('get-shortcuts').then(saved => {
                if (saved) setConfig(prev => ({ ...prev, ...saved }));
            });
            const savedVisuals = localStorage.getItem('hex_visual_config');
            if (savedVisuals) {
                try { setVisuals({ ...DEFAULT_VISUALS, ...JSON.parse(savedVisuals) }); } catch(e){}
            }
        }
    }, [isOpen]);

    const handleUpdateShortcut = (key, newValue) => {
        setConfig(prev => ({ ...prev, [key]: newValue }));
        setIsDirty(true);
    };

    const handleVisualChange = (key, value) => {
        const newVal = parseFloat(value);
        const newVisuals = { ...visuals, [key]: newVal };
        setVisuals(newVisuals);
        setIsDirty(true);
        localStorage.setItem('hex_visual_config', JSON.stringify(newVisuals));
        if (window.require) {
            window.require('electron').ipcRenderer.send('update-visuals', newVisuals);
        }
    };

    const handleSave = () => {
        if (window.require) {
            window.require('electron').ipcRenderer.send('update-shortcuts', config);
            setIsDirty(false);
            onClose();
        }
    };

    const handleReset = () => {
        if(confirm('恢复默认设置？')) {
            setConfig(DEFAULT_SHORTCUTS);
            setVisuals(DEFAULT_VISUALS);
            if (window.require) window.require('electron').ipcRenderer.send('update-visuals', DEFAULT_VISUALS);
            setIsDirty(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center animate-in fade-in zoom-in duration-200 pointer-events-auto">
            <div className="bg-[#0f172a] border border-[#C8AA6E]/40 w-[500px] rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 bg-[#091428] border-b border-white/5">
                    <h2 className="text-[#F0E6D2] font-bold text-sm tracking-widest flex items-center gap-2">
                        <Keyboard size={16} className="text-[#C8AA6E]" /> 全局配置
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-full"><X size={18} /></button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 bg-[#0b121e]">
                    
                    {/* 1. 视觉设置 */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest pb-2 border-b border-emerald-500/20">
                            <Eye size={12}/> 视觉与体验
                        </div>
                        <div className="grid gap-5 pl-1">
                            <VisualSlider label="背景透明度" valKey="transparency" value={visuals.transparency} min={0} max={95} step={5} unit="%" color="emerald" onChange={handleVisualChange}/>
                            <VisualSlider label="字体大小" valKey="fontSize" value={visuals.fontSize} min={0.8} max={2.0} step={0.1} unit="x" color="blue" onChange={handleVisualChange}/>
                            <VisualSlider label="播报音量" valKey="volume" value={visuals.volume} min={0} max={1} step={0.1} unit="" color="pink" onChange={handleVisualChange}/>
                        </div>
                    </div>

                    {/* 2. 快捷键设置 */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[#C8AA6E] text-[10px] font-bold uppercase tracking-widest pb-2 border-b border-[#C8AA6E]/20">
                            <Command size={12}/> 快捷键绑定
                        </div>
                        <div className="grid gap-3 pl-1">
                            <ShortcutItem label="显示/隐藏" desc="老板键" value={config.toggle} onChange={(v) => handleUpdateShortcut('toggle', v)} />
                            <ShortcutItem label="鼠标穿透模式" desc="锁定/解锁窗口" value={config.mouseMode} icon={<MousePointer2 size={12} className="text-amber-500"/>} onChange={(v) => handleUpdateShortcut('mouseMode', v)} />
                            <ShortcutItem label="语音播报" desc="播放/暂停/继续" value={config.playAudio} icon={<Volume2 size={12} className="text-pink-400"/>} onChange={(v) => handleUpdateShortcut('playAudio', v)} />
                            
                            <div className="h-[1px] bg-white/5 my-1"></div>
                            <ShortcutItem label="切换：胜利方式" desc="MiniHUD 卡片 1" value={config.tabWin} icon={<Layers size={12} className="text-emerald-400"/>} onChange={(v) => handleUpdateShortcut('tabWin', v)} />
                            <ShortcutItem label="切换：本局规划" desc="MiniHUD 卡片 2" value={config.tabPlan} icon={<Layers size={12} className="text-blue-400"/>} onChange={(v) => handleUpdateShortcut('tabPlan', v)} />
                            <ShortcutItem label="切换：风险预警" desc="MiniHUD 卡片 3" value={config.tabRisk} icon={<Layers size={12} className="text-rose-400"/>} onChange={(v) => handleUpdateShortcut('tabRisk', v)} />

                            <div className="h-[1px] bg-white/5 my-1"></div>
                            
                            <ShortcutItem label="上一阶段" desc="切换到前期/中期..." value={config.modePrev} icon={<Layers size={12} className="text-blue-400"/>} onChange={(v) => handleUpdateShortcut('modePrev', v)} />
                            <ShortcutItem label="下一阶段" desc="切换到中期/后期..." value={config.modeNext} icon={<Layers size={12} className="text-blue-400"/>} onChange={(v) => handleUpdateShortcut('modeNext', v)} />
                            
                            <ShortcutItem label="上一张卡片" desc="战术翻页 (上)" value={config.prevPage} icon={<ArrowLeftRight size={12} className="text-slate-400"/>} onChange={(v) => handleUpdateShortcut('prevPage', v)} />
                            <ShortcutItem label="下一张卡片" desc="战术翻页 (下)" value={config.nextPage} icon={<ArrowLeftRight size={12} className="text-slate-400"/>} onChange={(v) => handleUpdateShortcut('nextPage', v)} />
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

const VisualSlider = ({ label, valKey, value, min, max, step, unit, color, onChange }) => {
    const colorClasses = {
        emerald: 'accent-emerald-500 text-emerald-400',
        blue: 'accent-blue-500 text-blue-400',
        pink: 'accent-pink-500 text-pink-400'
    };
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1 w-24">
                <span className="text-slate-200 text-xs font-bold">{label}</span>
            </div>
            <input 
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(valKey, e.target.value)}
                className={`flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer ${colorClasses[color].split(' ')[0]}`}
            />
            <span className={`text-xs font-mono w-10 text-right ${colorClasses[color].split(' ')[1]}`}>
                {valKey === 'volume' ? Math.round(value * 100) : value}{unit}
            </span>
        </div>
    );
};

const ShortcutItem = ({ label, desc, value, onChange, icon }) => (
    <div className="flex items-center justify-between group/item p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
        <div className="flex flex-col gap-0.5">
            <span className="text-slate-200 text-xs font-medium flex items-center gap-2">{icon} {label}</span>
            <span className="text-[10px] text-slate-500 group-hover/item:text-slate-400 transition-colors">{desc}</span>
        </div>
        <ShortcutRecorder value={value} onChange={onChange} />
    </div>
);

export default SettingsModal;