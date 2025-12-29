import React, { useState, useEffect } from 'react';
import { X, Keyboard, Save, RotateCcw, AlertCircle } from 'lucide-react';

const DEFAULT_SHORTCUTS = {
  // 🟢 调整：使用 Ctrl+Alt 组合以避免与 LOL 的 Alt+1/2/3 (物品自我施法) 冲突
  tab_bp: 'Ctrl+Alt+1',
  tab_personal: 'Ctrl+Alt+2',
  tab_team: 'Ctrl+Alt+3',
  
  // 导航保持原样或微调
  nav_next: 'Ctrl+Alt+Right',
  nav_prev: 'Ctrl+Alt+Left',
  
  // 🟢 调整：Alt+R 是自我施法大招，改为 Ctrl+Alt+R
  refresh: 'Ctrl+Alt+R',
  
  send_chat: 'Alt+Enter',
  
  // 🟢 新增：显示/隐藏悬浮窗 (用户提到的 Alt+W)
  toggle_mouse: 'Ctrl+Alt+W'
};

const SHORTCUT_LABELS = {
  tab_bp: '切换到 BP 推荐',
  tab_personal: '切换到 王者私教',
  tab_team: '切换到 运营指挥',
  nav_next: '下一个 Tab',
  nav_prev: '上一个 Tab',
  refresh: '重新分析 (刷新)',
  send_chat: '发送战术到聊天框',
  toggle_mouse: '显示/隐藏 鼠标 (穿透模式)' // 🟢 新增标签
};

export default function SettingsModal({ isOpen, onClose, currentShortcuts, onSave }) {
    const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
    const [recordingKey, setRecordingKey] = useState(null);
    // 📱 检测是否为移动端 (简单判断屏幕宽度)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    useEffect(() => {
        if (currentShortcuts) {
            // 合并默认值，防止旧版本缺少新键位 (如 toggle_overlay)
            setShortcuts(prev => ({ ...DEFAULT_SHORTCUTS, ...currentShortcuts }));
        }
    }, [currentShortcuts]);

    // 监听键盘录制
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!recordingKey) return;
            e.preventDefault();
            e.stopPropagation();

            if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

            const modifiers = [];
            if (e.ctrlKey) modifiers.push('Ctrl');
            if (e.altKey) modifiers.push('Alt');
            if (e.shiftKey) modifiers.push('Shift');
            if (e.metaKey) modifiers.push('Meta');

            let key = e.key;
            if (key === 'ArrowRight') key = 'Right';
            if (key === 'ArrowLeft') key = 'Left';
            if (key === 'ArrowUp') key = 'Up';
            if (key === 'ArrowDown') key = 'Down';
            if (key === ' ') key = 'Space';

            // 转换大写
            const keyUpper = key.length === 1 ? key.toUpperCase() : key;
            const shortcutStr = [...modifiers, keyUpper].join('+');
            
            setShortcuts(prev => ({ ...prev, [recordingKey]: shortcutStr }));
            setRecordingKey(null);
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
        <div 
            // 📱 布局调整：手机端底部对齐 (items-end)，PC端居中
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200" 
            onClick={onClose}
        >
            <div 
                // 📱 弹窗样式：手机端圆角在上、全宽、底部滑出
                className="w-full md:max-w-lg bg-hex-dark border-t md:border border-hex-gold/50 rounded-t-2xl md:rounded-xl shadow-2xl flex flex-col overflow-hidden relative animate-in slide-in-from-bottom duration-300 md:zoom-in md:duration-200 max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* 📱 顶部把手 */}
                <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-3 mb-1 md:hidden opacity-50"></div>

                {/* Header */}
                <div className="p-4 border-b border-hex-gold/20 bg-hex-black flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 text-hex-gold-light">
                        <Keyboard size={20} />
                        <h2 className="text-lg font-bold tracking-widest uppercase">快捷键设置</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
                        <X size={24} />
                    </button>
                </div>

                {/* 📱 手机端提示条：告知无法录制 */}
                <div className="md:hidden bg-blue-900/20 px-4 py-2 flex items-center gap-2 text-xs text-blue-300 border-b border-blue-500/20">
                    <AlertCircle size={14}/>
                    <span>移动端仅供查看，请在电脑上修改快捷键。</span>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-[#050C18] space-y-3 md:space-y-4">
                    {/* 提示信息 */}
                    <div className="text-xs text-slate-500 mb-2 px-1">
                        * 提示：LOL中 Alt+Q/W/E/R 为技能自我施法，Alt+1/2/3 为物品自我施法。建议使用 Ctrl+Alt 组合键。
                    </div>

                    {Object.keys(DEFAULT_SHORTCUTS).map(key => (
                        <div key={key} className="flex items-center justify-between group py-1">
                            <span className="text-slate-400 text-sm font-bold">{SHORTCUT_LABELS[key] || key}</span>
                            
                            <button
                                // 📱 手机端禁用点击
                                onClick={() => !isMobile && setRecordingKey(key)}
                                disabled={isMobile}
                                className={`
                                    relative px-3 py-1.5 md:px-4 rounded border text-xs font-mono font-bold transition-all min-w-[110px] md:min-w-[120px] text-center
                                    ${recordingKey === key 
                                        ? 'bg-hex-gold text-black border-hex-gold animate-pulse' 
                                        : isMobile 
                                            ? 'bg-white/5 border-transparent text-slate-500 opacity-50 cursor-not-allowed' // 手机端样式
                                            : 'bg-hex-black border-hex-gold/20 text-hex-blue hover:border-hex-gold/50 cursor-pointer'
                                    }
                                `}
                            >
                                {recordingKey === key ? '按下按键...' : (shortcuts[key] || '未设置')}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-hex-gold/20 bg-hex-black flex justify-between items-center shrink-0 safe-area-pb">
                    <button 
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-2 rounded text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-900/10 transition-colors"
                    >
                        <RotateCcw size={14} /> 恢复默认
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 px-5 py-2 bg-hex-gold text-black rounded font-bold hover:bg-white transition-colors shadow-[0_0_10px_rgba(200,170,110,0.3)] text-xs md:text-sm"
                    >
                        <Save size={16} /> 保存设置
                    </button>
                </div>
            </div>
        </div>
    );
}