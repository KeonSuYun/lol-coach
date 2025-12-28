import React, { useState, useEffect } from 'react';
import { X, Keyboard, Save, RotateCcw } from 'lucide-react';

const DEFAULT_SHORTCUTS = {
  tab_bp: 'Alt+1',
  tab_personal: 'Alt+2',
  tab_team: 'Alt+3',
  nav_next: 'Alt+Right',
  nav_prev: 'Alt+Left',
  refresh: 'Alt+R',
  send_chat: 'Alt+Enter' // 新增发送快捷键
};

const SHORTCUT_LABELS = {
  tab_bp: '切换到 BP 推荐',
  tab_personal: '切换到 王者私教',
  tab_team: '切换到 运营指挥',
  nav_next: '下一个 Tab (详情/对线/团战)',
  nav_prev: '上一个 Tab',
  refresh: '重新分析 (刷新)',
  send_chat: '发送战术到聊天框'
};

export default function SettingsModal({ isOpen, onClose, currentShortcuts, onSave }) {
    const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
    const [recordingKey, setRecordingKey] = useState(null);

    useEffect(() => {
        if (currentShortcuts) {
            setShortcuts(currentShortcuts);
        }
    }, [currentShortcuts]);

    // 监听键盘录制
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!recordingKey) return;
            e.preventDefault();
            e.stopPropagation();

            // 忽略单独的控制键
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

            const modifiers = [];
            if (e.ctrlKey) modifiers.push('Ctrl');
            if (e.altKey) modifiers.push('Alt');
            if (e.shiftKey) modifiers.push('Shift');
            if (e.metaKey) modifiers.push('Meta'); // Command on Mac

            // 转换 Key 名称 (ArrowRight -> Right)
            let key = e.key;
            if (key === 'ArrowRight') key = 'Right';
            if (key === 'ArrowLeft') key = 'Left';
            if (key === 'ArrowUp') key = 'Up';
            if (key === 'ArrowDown') key = 'Down';
            if (key === ' ') key = 'Space';

            const shortcutStr = [...modifiers, key.toUpperCase()].join('+');
            
            setShortcuts(prev => ({ ...prev, [recordingKey]: shortcutStr }));
            setRecordingKey(null); // 结束录制
        };

        if (recordingKey) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recordingKey]);

    const handleSave = () => {
        onSave(shortcuts);
        onClose();
    };

    const handleReset = () => {
        if(confirm('确定恢复默认快捷键吗？')) {
            setShortcuts(DEFAULT_SHORTCUTS);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div 
                className="w-full max-w-lg bg-hex-dark border border-hex-gold/50 rounded-xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-hex-gold/20 bg-hex-black flex items-center justify-between">
                    <div className="flex items-center gap-2 text-hex-gold-light">
                        <Keyboard size={20} />
                        <h2 className="text-lg font-bold tracking-widest uppercase">快捷键设置</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#050C18] space-y-4">
                    {Object.keys(DEFAULT_SHORTCUTS).map(key => (
                        <div key={key} className="flex items-center justify-between group">
                            <span className="text-slate-400 text-sm font-bold">{SHORTCUT_LABELS[key] || key}</span>
                            
                            <button
                                onClick={() => setRecordingKey(key)}
                                className={`
                                    relative px-4 py-1.5 rounded border text-xs font-mono font-bold transition-all min-w-[100px] text-center
                                    ${recordingKey === key 
                                        ? 'bg-hex-gold text-black border-hex-gold animate-pulse' 
                                        : 'bg-hex-black border-hex-gold/20 text-hex-blue hover:border-hex-gold/50'}
                                `}
                            >
                                {recordingKey === key ? '按下按键...' : (shortcuts[key] || '未设置')}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-hex-gold/20 bg-hex-black flex justify-between items-center">
                    <button 
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-900/10 transition-colors"
                    >
                        <RotateCcw size={14} /> 恢复默认
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-hex-gold text-black rounded font-bold hover:bg-white transition-colors shadow-[0_0_10px_rgba(200,170,110,0.3)]"
                    >
                        <Save size={16} /> 保存设置
                    </button>
                </div>
            </div>
        </div>
    );
}