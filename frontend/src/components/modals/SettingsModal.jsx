import React, { useState, useEffect } from 'react';
import { X, Keyboard, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

// 这里列出允许用户选择的键，必须和后端的 VK_MAP 对应
const AVAILABLE_KEYS = [
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    'Home', 'End', 'Insert', 'Delete', 'PageUp', 'PageDown', 'Right'
];

const SettingsModal = ({ isOpen, onClose }) => {
    const [currentKey, setCurrentKey] = useState('F2');

    // 初始化时获取当前设置
    useEffect(() => {
        if (isOpen && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('get-shortcuts').then(data => {
                if (data && data.toggle) setCurrentKey(data.toggle);
            });
        }
    }, [isOpen]);

    const handleSave = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            // 发送给后端
            ipcRenderer.send('update-shortcuts', { toggle: currentKey });
            toast.success(`快捷键已更新为 [ ${currentKey} ]`);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[320px] bg-[#1E2328] border-2 border-[#C8AA6E] shadow-2xl relative">
                {/* 标题栏 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#C8AA6E]/30 bg-[#010A13]">
                    <h2 className="text-[#F0E6D2] font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                        <Keyboard size={14} className="text-[#C8AA6E]" /> 设置
                    </h2>
                    <button onClick={onClose} className="text-[#5B5A56] hover:text-[#F0E6D2] transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* 内容区 */}
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs text-[#A09B8C] font-bold uppercase">悬浮窗开关快捷键</label>
                        <select 
                            value={currentKey}
                            onChange={(e) => setCurrentKey(e.target.value)}
                            className="w-full bg-[#0A1428] text-[#F0E6D2] border border-[#3C3C41] focus:border-[#C8AA6E] outline-none px-3 py-2 text-sm font-mono appearance-none cursor-pointer hover:bg-[#091120]"
                        >
                            {AVAILABLE_KEYS.map(key => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500">
                            * 建议使用 F2, Home, Insert 等不常用键位。
                        </p>
                    </div>

                    <button 
                        onClick={handleSave}
                        className="w-full flex items-center justify-center gap-2 bg-[#1E282D] border border-[#C8AA6E] text-[#C8AA6E] py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#C8AA6E] hover:text-[#010A13] transition-all"
                    >
                        <Save size={14} /> 保存并应用
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;