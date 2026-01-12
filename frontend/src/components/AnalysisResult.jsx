// src/components/AnalysisResult.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    Bot, LayoutDashboard, FileText, Trash2, ArrowLeft, ChevronRight, Loader2, Brain, 
    Copy, Check, MessageSquare, Send, Zap, Headphones, Play, Pause 
} from 'lucide-react';
import HexDashboard from './HexDashboard';     
import DeepPacketView from './DeepPacketView'; 
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

// 🔥 宽容型 JSON 解析器 (无需变动)
const tryFixAndParse = (jsonStr) => {
    if (!jsonStr) return null;
    let clean = jsonStr.trim();
    clean = clean.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "");
    clean = clean.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "");
    try { return JSON.parse(clean); } catch (e) {}
    clean = clean.replace(/,(\s*)$/, '$1');
    if ((clean.match(/"/g) || []).length % 2 !== 0) clean += '"';
    const stack = [];
    let inString = false;
    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (char === '"' && clean[i-1] !== '\\') inString = !inString;
        if (!inString) {
            if (char === '{') stack.push('}');
            else if (char === '[') stack.push(']');
            else if (char === '}') { if (stack.length && stack[stack.length-1] === '}') stack.pop(); }
            else if (char === ']') { if (stack.length && stack[stack.length-1] === ']') stack.pop(); }
        }
    }
    if (inString) clean += '"';
    const closing = stack.reverse().join('');
    try { return JSON.parse(clean + closing); } catch (e) { return null; }
};

export default function AnalysisResult(props) {
    const { aiResult, isAnalyzing, onClear } = props;
    const [internalViewMode, setInternalViewMode] = useState('dashboard');
    const [isCopied, setIsCopied] = useState(false);
    const lastValidDataRef = useRef(null);

    // === 🎙️ 仅保留语音切换逻辑 ===
    const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem('hex_tts_voice') || 'guide');

    const toggleVoice = () => {
        let nextVoice = 'guide';
        if (selectedVoice === 'guide') nextVoice = 'commander';
        else if (selectedVoice === 'commander') nextVoice = 'partner';
        setSelectedVoice(nextVoice);
        localStorage.setItem('hex_tts_voice', nextVoice);
        const labels = { guide: "晓晓", commander: "云健", partner: "云希" };
        toast.success(`切换语音: ${labels[nextVoice]}`, { icon: '🎧' });
    };

    // ==================================================================================
    // 🛠️ 解析引擎
    // ==================================================================================
    const { parsedData, currentRole, isFarming, hasValidDashboard, rawThought } = useMemo(() => {
        let finalData = null;
        let role = "JUNGLE";
        let farming = false;
        let thoughtContent = "";

        if (typeof aiResult === 'string') {
            const match = aiResult.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
            if (match) thoughtContent = match[1];
        }
        
        if (typeof aiResult === 'object' && aiResult !== null) finalData = aiResult;
        else if (typeof aiResult === 'string') finalData = tryFixAndParse(aiResult);

        if (finalData) lastValidDataRef.current = finalData;
        else if (lastValidDataRef.current && isAnalyzing) finalData = lastValidDataRef.current;

        if (finalData) {
            if (finalData.dashboard?.meta?.role) role = finalData.dashboard.meta.role;
            else if (finalData.role) role = finalData.role;
            if (finalData.dashboard?.meta?.style === 'farming' || finalData.dashboard?.meta?.style === 'tempo') farming = (finalData.dashboard.meta.style === 'farming');
            if (finalData.style_mode === 'farming' || finalData.is_farming === true) farming = true;
        } 

        return { 
            parsedData: finalData || {}, 
            currentRole: role || props.aiResult?.role || "JUNGLE", 
            isFarming: farming,
            hasValidDashboard: !!(finalData?.dashboard),
            rawThought: thoughtContent
        };
    }, [aiResult, props.aiResult, isAnalyzing]);

    const handleCopyConcise = () => {
        const content = parsedData?.concise?.content;
        const fallbackContent = parsedData?.dashboard?.headline ? `【赢法】${parsedData.dashboard.headline}` : "";
        const baseContent = content || fallbackContent;

        if (!baseContent) { toast.error("战术制定中...", { icon: '⏳' }); return; }

        const cleanText = baseContent.replace(/\*\*(.*?)\*\*/g, '$1').replace(/【/g, "[").replace(/】/g, "] ").trim();
        const finalMsg = `${cleanText} (来自:海克斯教练)`;

        if (window.require) {
            try { window.require('electron').ipcRenderer.send('copy-and-lock', finalMsg); toast.success("已锁定！按 Ctrl+V 发送", { duration: 3000, icon: '📋' }); } 
            catch(e) { navigator.clipboard.writeText(finalMsg); toast.success("已复制！", { duration: 3000, icon: '📋' }); }
        } else {
            navigator.clipboard.writeText(finalMsg); toast.success("已复制！", { duration: 3000, icon: '📋' });
        }
        
        setIsCopied(true); setTimeout(() => setIsCopied(false), 2000);
    };

    // [状态 A] 正在思考 (Loading)
    if (isAnalyzing && !hasValidDashboard && !parsedData.concise) {
        return (
            <div className="flex flex-col h-full bg-[#0f172a]/60 backdrop-blur-md rounded-xl overflow-hidden border border-[#C8AA6E]/10 shadow-2xl">
                <div className="flex items-center justify-between p-3 border-b border-[#C8AA6E]/10 bg-[#0f172a]/80">
                    <div className="flex items-center gap-2 pl-2 text-amber-500 animate-pulse">
                        <Brain size={18} /><span className="font-bold text-xs tracking-wide">AI 深度思考中...</span>
                    </div>
                </div>
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                    {rawThought ? (
                        <div className="text-slate-400 text-xs font-mono leading-relaxed whitespace-pre-wrap border-l-2 border-amber-500/20 pl-4">{rawThought}<span className="animate-pulse">_</span></div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50"><Loader2 size={32} className="text-[#0AC8B9] animate-spin" /><p className="text-xs text-slate-400">正在接入战术数据流...</p></div>
                    )}
                </div>
            </div>
        );
    }

    if (!aiResult && !isAnalyzing) return <div className="flex items-center justify-center h-full text-slate-500">等待指令...</div>;

    return (
        <div className="flex flex-col h-full bg-[#0f172a]/60 backdrop-blur-md rounded-xl overflow-hidden relative border border-[#C8AA6E]/10 shadow-2xl animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#C8AA6E]/10 bg-[#0f172a]/80 sticky top-0 z-30 shrink-0">
                <div className="flex items-center gap-3 pl-2">
                    <Bot size={18} className="text-[#0AC8B9]" />
                    <span className="font-bold text-slate-200 text-xs tracking-wide">海克斯战术引擎</span>
                    {isAnalyzing && <Loader2 size={12} className="text-amber-500 animate-spin" />}
                </div>
                
                {/* 🔴 工具栏 */}
                <div className="flex bg-black/40 rounded-lg p-1 border border-white/5 items-center">
                    <button onClick={() => setInternalViewMode('dashboard')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${internalViewMode === 'dashboard' ? 'bg-[#0AC8B9] text-[#091428]' : 'text-slate-500 hover:text-slate-300'}`}>仪表盘</button>
                    <button onClick={() => setInternalViewMode('text')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${internalViewMode === 'text' ? 'bg-[#C8AA6E] text-[#091428]' : 'text-slate-500 hover:text-slate-300'}`}>深度推演</button>
                    
                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>

                    {/* 🎙️ 语音设置 (仅保留切换) */}
                    <button onClick={toggleVoice} className="p-1.5 rounded-md text-slate-500 hover:text-pink-300 hover:bg-white/5 transition-all" title={`切换语音 (${selectedVoice}) - 播放请在游戏内使用 Ctrl+Space`}>
                        <Headphones size={14}/>
                    </button>

                    <div className="w-[1px] h-4 bg-white/10 mx-1"></div>

                    {/* 发给队友 */}
                    <button onClick={handleCopyConcise} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border ${isCopied ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-white/5 text-slate-300 border-transparent hover:bg-[#0AC8B9]/10 hover:text-[#0AC8B9] hover:border-[#0AC8B9]/30'} ${(!parsedData?.concise?.content && !parsedData?.dashboard?.headline) ? 'opacity-50 cursor-not-allowed' : ''}`} title="一键复制战术速览" disabled={!parsedData?.concise?.content && !parsedData?.dashboard?.headline}>
                        {isCopied ? <Check size={12} /> : <MessageSquare size={12}/>}
                        <span>{isCopied ? "已复制" : "一键复制战术速览"}</span>
                    </button>

                    <button onClick={onClear} className="ml-1 p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-md transition-all" title="清空"><Trash2 size={14}/></button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
                {internalViewMode === 'dashboard' && (
                    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
                        {hasValidDashboard ? (
                            <>
                                <HexDashboard role={currentRole} isFarming={isFarming} data={parsedData.dashboard} />
                                <div onClick={() => setInternalViewMode('text')} className="mt-4 p-3 border border-dashed border-slate-700/50 rounded-xl bg-white/5 hover:bg-[#C8AA6E]/5 cursor-pointer flex justify-between items-center group transition-colors">
                                    <span className="text-xs font-bold text-slate-200 group-hover:text-[#C8AA6E] transition-colors">查看完整报告</span>
                                    <ChevronRight size={14} className="text-slate-500 group-hover:text-[#C8AA6E] transition-colors" />
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-20 text-slate-500 text-xs flex flex-col items-center gap-2">
                                <Loader2 size={24} className="animate-spin opacity-50"/>
                                <span>战术构建中...</span>
                                {parsedData.concise?.title && (
                                    <div className="mt-4 p-4 bg-white/5 rounded border border-white/10 max-w-md animate-in fade-in slide-in-from-bottom-2 text-left">
                                        <h4 className="text-[#C8AA6E] font-bold mb-2 flex items-center gap-2 text-xs"><Zap size={12}/> {parsedData.concise.title}</h4>
                                        <p className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed">{parsedData.concise.content}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {internalViewMode === 'text' && (
                    <div className="h-full w-full bg-[#0f172a]/40">
                        <DeepPacketView {...props} aiResult={parsedData.dashboard ? parsedData : aiResult} />
                    </div>
                )}
            </div>
        </div>
    );
}