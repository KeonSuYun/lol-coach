import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { mapEventToElectronAccelerator } from '../utils/keyboardUtils';

const ShortcutRecorder = ({ value, onChange, placeholder = "点击录制" }) => {
    const [isRecording, setIsRecording] = useState(false);
    const buttonRef = useRef(null);

    // 格式化显示 (把 CommandOrControl 这种技术词汇转成易读的 Ctrl)
    const formatDisplay = (val) => {
        if (!val) return placeholder;
        return val.replace('CommandOrControl', 'Ctrl')
                  .replace('Command', 'Cmd')
                  .replace('Control', 'Ctrl');
    };

    useEffect(() => {
        if (!isRecording) return;

        const handleKeyDown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Esc 取消
            if (e.key === 'Escape') {
                setIsRecording(false);
                return;
            }

            // Backspace/Delete 清除
            if (e.key === 'Backspace' || e.key === 'Delete') {
                onChange(null); 
                setIsRecording(false);
                return;
            }

            // 获取按键组合
            const accelerator = mapEventToElectronAccelerator(e);

            // 防止只按了修饰键就保存
            const isModifierOnly = ['Ctrl', 'Alt', 'Shift', 'Command', 'Ctrl+Shift', 'Ctrl+Alt', 'Alt+Shift'].includes(accelerator);
            
            if (!isModifierOnly) {
                onChange(accelerator);
                setIsRecording(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        const handleClickOutside = (e) => {
            if (buttonRef.current && !buttonRef.current.contains(e.target)) {
                setIsRecording(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isRecording, onChange]);

    return (
        <div className="relative group">
            <button
                ref={buttonRef}
                onClick={() => setIsRecording(true)}
                className={`
                    w-28 px-2 py-1.5 text-[10px] font-mono rounded border transition-all flex items-center justify-center gap-1.5 relative
                    ${isRecording 
                        ? 'bg-red-900/30 border-red-500 text-red-400 animate-pulse' 
                        : 'bg-[#091428] border-white/10 text-slate-300 hover:border-amber-500/50 hover:text-amber-400'
                    }
                `}
            >
                {isRecording ? (
                    <span className="animate-pulse">请按键...</span>
                ) : (
                    <>
                        {value ? (
                            <span className="truncate font-bold">{formatDisplay(value)}</span>
                        ) : (
                            <span className="text-slate-600 italic">{placeholder}</span>
                        )}
                    </>
                )}
            </button>

            {/* 清除按钮 */}
            {!isRecording && value && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onChange(null); }}
                    className="absolute -right-1.5 -top-1.5 bg-[#0f172a] border border-white/20 rounded-full p-0.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm"
                    title="清除快捷键"
                >
                    <X size={10} />
                </button>
            )}
        </div>
    );
};

export default ShortcutRecorder;