import React, { useState, useEffect } from 'react';
import { X, Keyboard, Save, RefreshCw, Command, MousePointer2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

const SettingsModal = ({ isOpen, onClose }) => {
    // 存储完整的配置对象
    const [config, setConfig] = useState({}); 
    const [loading, setLoading] = useState(false);

    // 格式化辅助
    const fmt = (k) => {
        if (!k) return '?';
        const map = {
            'LBtn': '左键', 'RBtn': '右键', 'MBtn': '中键',
            'Tilde': '~', 'Minus': '-', 'Plus': '=', 
            'PageUp': 'PgUp', 'PageDown': 'PgDn', 'Escape': 'Esc'
        };
        return map[k] || k;
    };

    useEffect(() => {
        if (isOpen && window.require) {
            const { ipcRenderer } = window.require('electron');
            setLoading(true);
            ipcRenderer.invoke('get-shortcuts')
                .then(data => {
                    if (data) setConfig(data);
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const handleSave = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            // 发送完整的配置更新
            ipcRenderer.send('update-shortcuts', config);
            toast.success("快捷键设置已保存");
            setTimeout(onClose, 500);
        }
    };

    // 通用变更处理
    const handleChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    // 键位选项生成器
    const KeyOptions = () => (
        <>
            <optgroup label="✨ 推荐">
                <option value="Tilde">~ (波浪号)</option>
                <option value="Tab">Tab</option>
                <option value="Space">空格</option>
            </optgroup>
            <optgroup label="🔤 字母">
                {Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)).map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
            <optgroup label="🖱️ 鼠标">
                <option value="LBtn">左键</option>
                <option value="RBtn">右键</option>
                <option value="MBtn">中键</option>
            </optgroup>
            <optgroup label="⌨️ 功能">
                <option value="Home">Home</option>
                <option value="End">End</option>
                <option value="PageUp">PgUp</option>
                <option value="PageDown">PgDn</option>
                <option value="Insert">Insert</option>
                <option value="Delete">Delete</option>
                <option value="Up">↑ 上</option>
                <option value="Down">↓ 下</option>
                <option value="Left">← 左</option>
                <option value="Right">→ 右</option>
            </optgroup>
            <optgroup label="🔧 F区">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={`F${n}`} value={`F${n}`}>F{n}</option>)}
            </optgroup>
        </>
    );

    // 单行设置组件
    const ConfigRow = ({ label, icon: Icon, configKey, isCombo = false }) => (
        <div className="flex items-center justify-between group">
            <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
                <Icon size={12} className={isCombo ? "text-[#C8AA6E]" : "text-[#0AC8B9]"} />
                <span>{label}</span>
            </div>
            <div className="relative w-24">
                {isCombo && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold z-10 pointer-events-none">Alt +</span>}
                <select 
                    value={config[configKey] || ''}
                    onChange={(e) => handleChange(configKey, e.target.value)}
                    className={`w-full bg-[#0A1428] text-white border border-white/10 focus:border-[#C8AA6E] outline-none py-1 text-xs font-mono rounded-sm cursor-pointer hover:bg-[#0F192F] appearance-none text-right pr-6 ${isCombo ? 'pl-8' : 'pl-2'}`}
                >
                    <KeyOptions />
                </select>
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600"><RefreshCw size={8} /></div>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[380px] bg-[#1E2328] border-2 border-[#C8AA6E] shadow-2xl relative rounded-sm">
                
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#C8AA6E]/30 bg-[#010A13]">
                    <h2 className="text-[#F0E6D2] font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                        <Keyboard size={14} className="text-[#C8AA6E]" /> 全局键位配置
                    </h2>
                    <button onClick={onClose} className="text-[#5B5A56] hover:text-[#F0E6D2] transition-colors"><X size={16} /></button>
                </div>

                <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    {/* 单键区 */}
                    <div className="space-y-3">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">单键触发 (Single Press)</div>
                        <ConfigRow label="显示 / 隐藏窗口" icon={Command} configKey="toggle" />
                        <ConfigRow label="呼出鼠标 / 调整大小" icon={MousePointer2} configKey="mouseMode" />
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* 组合键区 */}
                    <div className="space-y-3">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">组合操作 (需按住 Alt)</div>
                        <ConfigRow label="向上滚动 (Scroll Up)" icon={ArrowUp} configKey="scrollUp" isCombo />
                        <ConfigRow label="向下滚动 (Scroll Down)" icon={ArrowDown} configKey="scrollDown" isCombo />
                        <div className="h-px bg-white/5 my-2 opacity-50"></div>
                        <ConfigRow label="上一个模式 (Prev Mode)" icon={Command} configKey="modePrev" isCombo />
                        <ConfigRow label="下一个模式 (Next Mode)" icon={Command} configKey="modeNext" isCombo />
                        <div className="h-px bg-white/5 my-2 opacity-50"></div>
                        <ConfigRow label="上一页 (Prev Page)" icon={Command} configKey="prevPage" isCombo />
                        <ConfigRow label="下一页 (Next Page)" icon={Command} configKey="nextPage" isCombo />
                        <div className="h-px bg-white/5 my-2 opacity-50"></div>
                        <ConfigRow label="刷新分析 (Refresh)" icon={RefreshCw} configKey="refresh" isCombo />
                    </div>

                    {/* 按钮 */}
                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose} className="flex-1 py-2 text-xs font-bold text-slate-400 hover:text-white border border-transparent hover:border-white/10 rounded-sm">取消</button>
                        <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#C8AA6E] to-[#b09358] text-[#091428] py-2 text-xs font-black uppercase tracking-wider hover:brightness-110 shadow-lg rounded-sm"><Save size={14} /> 保存全部</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;