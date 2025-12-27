import React, { useState, useEffect } from 'react';
import { X, Keyboard, Save, RotateCcw } from 'lucide-react';

const DEFAULT_SHORTCUTS = {
  tab_bp: 'Alt+1',
  tab_personal: 'Alt+2',
  tab_team: 'Alt+3',
  nav_next: 'Alt+Right',
  nav_prev: 'Alt+Left',
  refresh: 'Alt+R'
};

const LABEL_MAP = {
  tab_bp: '切换至 BP分析',
  tab_personal: '切换至 王者私教',
  tab_team: '切换至 运营指挥',
  nav_next: '下一个 Tab (页内)',
  nav_prev: '上一个 Tab (页内)',
  refresh: '刷新当前分析'
};

export default function SettingsModal({ isOpen, onClose, currentShortcuts, onSave }) {
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [recordingKey, setRecordingKey] = useState(null);

  // 同步外部传入的快捷键配置
  useEffect(() => {
    if (currentShortcuts) {
      setShortcuts(prev => ({ ...prev, ...currentShortcuts }));
    }
  }, [currentShortcuts]);

  // 处理键盘录入
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!recordingKey) return;
      e.preventDefault();
      e.stopPropagation();

      // 忽略单独按下的修饰键
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.metaKey) modifiers.push('Command'); // Mac
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');

      let key = e.key.toUpperCase();
      if (key === ' ') key = 'Space';
      if (key === 'ARROWUP') key = 'Up';
      if (key === 'ARROWDOWN') key = 'Down';
      if (key === 'ARROWLEFT') key = 'Left';
      if (key === 'ARROWRIGHT') key = 'Right';

      const shortcutString = [...modifiers, key].join('+');
      
      setShortcuts(prev => ({ ...prev, [recordingKey]: shortcutString }));
      setRecordingKey(null); // 结束录制
    };

    if (recordingKey) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(shortcuts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-hex-dark border border-hex-gold/30 w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hex-gold/10 bg-hex-black/50">
          <div className="flex items-center gap-2 text-hex-gold">
            <SettingsIcon />
            <span className="font-bold tracking-wider">全局快捷键设置</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
          <div className="text-xs text-slate-400 mb-2 bg-blue-900/20 p-2 rounded border border-blue-500/20">
            🔔 点击按钮后按下键盘组合键即可修改。支持 Ctrl, Alt, Shift 组合。
          </div>

          {Object.entries(shortcuts).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between group">
              <span className="text-sm text-slate-300 font-medium">{LABEL_MAP[key] || key}</span>
              
              <button
                onClick={() => setRecordingKey(key)}
                className={`relative min-w-[120px] px-3 py-1.5 rounded border text-xs font-mono font-bold transition-all text-center
                  ${recordingKey === key 
                    ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' 
                    : 'bg-hex-black border-hex-gold/20 text-hex-gold hover:border-hex-gold/50'
                  }`}
              >
                {recordingKey === key ? '按键录入中...' : value}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-hex-gold/10 bg-hex-black/30 flex justify-end gap-3">
          <button 
            onClick={() => setShortcuts(DEFAULT_SHORTCUTS)}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw size={14} /> 重置默认
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-1.5 px-6 py-2 bg-hex-gold/10 hover:bg-hex-gold/20 text-hex-gold border border-hex-gold/50 rounded text-xs font-bold transition-all shadow-[0_0_10px_rgba(200,170,110,0.1)] hover:shadow-[0_0_20px_rgba(200,170,110,0.3)]"
          >
            <Save size={14} /> 保存设置
          </button>
        </div>
      </div>
    </div>
  );
}

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);