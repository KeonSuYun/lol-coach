import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
    RefreshCw, Lightbulb, Target, Swords, Brain, ShieldAlert, Eye, EyeOff, 
    FileText, Layout, MessageSquarePlus, Copy, Check, Gift, AlertTriangle, 
    Zap, BookOpen, Trash2, Map, Volume2, Loader2, ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';

// =================================================================
// 🛠️ 智能解析器 (Smart Parser)
// =================================================================
const parseHybridContent = (rawInput) => {
    if (typeof rawInput === 'object' && rawInput !== null) {
        const safeData = {
            concise: rawInput.concise || {},
            simple_tabs: rawInput.simple_tabs || [],
            detailed_tabs: rawInput.detailed_tabs || [],
            dashboard: rawInput.dashboard || null
        };
        const thought = rawInput.thought || ""; 
        return { mode: 'json', data: safeData, thought };
    }

    let rawString = rawInput;
    if (!rawString || typeof rawString !== 'string') return { mode: 'loading', data: null, thought: "" };
    
    let thought = "";
    const thoughtMatch = rawString.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thoughtMatch) thought = thoughtMatch[1].trim();

    let cleanStr = rawString.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, ""); 
    cleanStr = cleanStr.replace(/```\w*\s*/g, "").replace(/```/g, "").trim();

    try {
        const fixedStr = cleanStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        const parsed = JSON.parse(fixedStr);
        if (!parsed.simple_tabs) parsed.simple_tabs = [];
        if (!parsed.detailed_tabs) parsed.detailed_tabs = [];
        return { mode: 'json', data: parsed, thought };
    } catch (e) {}
    
    // 兜底逻辑：尝试正则提取
    const hasJsonStructure = cleanStr.includes('"concise"') || cleanStr.startsWith('{');
    if (hasJsonStructure) {
        // ... (正则提取逻辑省略，通常不需要)
        // 如果需要完整的正则逻辑请告知，这里为了简洁只保留 JSON 解析
        return { mode: 'loading', data: null, thought };
    }
    if (cleanStr.length > 0) return { mode: 'markdown', data: cleanStr, thought };
    return { mode: 'loading', data: null, thought };
};

const enhanceMarkdown = (text) => {
    if (!text) return "";
    let formatted = text.replace(/^【(.*?)】[：:]?/gm, "### ⚡ $1"); 
    formatted = formatted.replace(/【(.*?)】/g, "**$1**");
    return formatted;
};

// =================================================================
// 🔥 动态样式生成器 (Markdown Components)
// =================================================================
const getMarkdownComponents = (isCompact) => ({
    h3: ({node, ...props}) => (
        <h3 className={`
            font-bold flex items-center gap-2 select-none
            ${isCompact 
                ? 'text-[#C8AA6E] text-sm mt-3 mb-1 pl-0 [text-shadow:none]' 
                : 'text-[#F0E6D2] text-lg mt-8 mb-4 pb-2 border-b border-[#C8AA6E]/30'
            }
        `} {...props}>
            {!isCompact && <span className="text-[#C8AA6E] mr-1">❖</span>}
            {props.children}
        </h3>
    ),
    h4: ({node, ...props}) => (
        <h4 className={`
            font-bold text-slate-200 flex items-center
            ${isCompact 
                ? 'text-xs mt-2 mb-1 pl-0 before:content-["◈"] before:text-[#C8AA6E] before:mr-2 before:text-[10px] [text-shadow:none]' 
                : 'text-base mt-6 mb-3 pl-2 border-l-2 border-[#0AC8B9]'
            }
        `} {...props} />
    ),
    ul: ({node, ...props}) => (
        <ul className={`
            list-disc list-outside marker:text-[#C8AA6E]
            ${isCompact ? 'pl-3.5 ml-0 mb-1 space-y-0.5' : 'ml-6 mb-4 space-y-2'}
        `} {...props} />
    ),
    ol: ({node, ...props}) => (
        <ol className={`
            list-decimal list-outside marker:text-[#C8AA6E] marker:font-mono
            ${isCompact ? 'pl-3.5 ml-0 mb-1 space-y-0.5' : 'ml-6 mb-4 space-y-2'}
        `} {...props} />
    ),
    li: ({node, ...props}) => (
        <li className={`
            text-slate-300 pl-0
            ${isCompact ? 'text-xs leading-5 [text-shadow:none]' : 'text-[15px] leading-7 tracking-wide pl-1'}
        `} {...props} />
    ),
    strong: ({node, ...props}) => (
        <strong className={`
            font-bold mx-0.5 rounded px-0.5
            ${isCompact 
                ? 'text-[#FFE0A3] border-b border-[#C8AA6E]/40 pb-0.5 [text-shadow:none]' 
                : 'text-[#091428] bg-[#C8AA6E] shadow-[0_0_10px_rgba(200,170,110,0.3)] [text-shadow:none]'
            }
        `} {...props} />
    ),
    p: ({node, ...props}) => (
        <p className={`
            text-slate-300 font-sans
            ${isCompact 
                ? 'mb-2 text-xs leading-5 text-justify [text-shadow:none]' 
                : 'mb-5 text-[15px] leading-8 tracking-wide text-slate-300/90'
            }
        `} {...props} />
    ),
    table: ({node, ...props}) => (
        <div className={`
            overflow-x-auto rounded-lg border border-[#C8AA6E]/20 shadow-lg bg-[#000000]/20
            ${isCompact ? 'my-2 pb-0' : 'my-6 pb-2'}
        `}>
            <table className="w-full text-left border-collapse min-w-[400px]" {...props} />
        </div>
    ),
    thead: ({node, ...props}) => <thead className="bg-[#C8AA6E]/10 border-b border-[#C8AA6E]/20" {...props} />,
    tbody: ({node, ...props}) => <tbody className="divide-y divide-white/5" {...props} />,
    tr: ({node, ...props}) => <tr className="hover:bg-white/5 transition-colors group" {...props} />,
    th: ({node, ...props}) => <th className={`font-bold text-[#C8AA6E] uppercase tracking-wider whitespace-nowrap bg-black/20 ${isCompact ? 'px-2 py-1 text-[10px] [text-shadow:none]' : 'px-4 py-3 text-xs'}`} {...props} />,
    td: ({node, ...props}) => <td className={`text-slate-300 align-top group-hover:text-slate-100 transition-colors ${isCompact ? 'px-2 py-1 text-[10px] [text-shadow:none]' : 'px-4 py-3 text-sm leading-6'}`} {...props} />,
    blockquote: ({node, ...props}) => (
        <blockquote className={`
            relative rounded-r border-l-4 
            ${isCompact 
                ? 'border-amber-500/60 bg-amber-500/10 py-1 px-2 my-2 text-xs italic text-slate-400 [text-shadow:none]' 
                : 'border-[#0AC8B9] bg-[#0AC8B9]/5 py-3 px-5 my-6 text-sm text-slate-300 shadow-inner'
            }
        `} {...props} />
    ),
    code: ({node, inline, className, children, ...props}) => inline 
        ? <code className="bg-white/10 text-amber-200 px-1.5 py-0.5 rounded text-[12px] font-mono border border-white/5 mx-1 [text-shadow:none]" {...props}>{children}</code> 
        : <pre className={`bg-[#050505] rounded-lg overflow-x-auto border border-white/10 shadow-inner [text-shadow:none] ${isCompact ? 'p-2 my-2' : 'p-4 my-5'}`}><code className="text-xs font-mono text-emerald-400" {...props}>{children}</code></pre>,
    hr: ({node, ...props}) => <hr className="border-t border-white/10 my-8" {...props} />,
});

// =================================================================
// 🚀 主组件 DeepPacketView
// =================================================================
const DeepPacketView = ({ 
    aiResult, isAnalyzing, setShowFeedbackModal, setFeedbackContent, onClear, 
    globalScale = 1.0, isInGame = false, forceTab 
}) => {
    const [webActiveTab, setWebActiveTab] = useState(0);
    const [showDebug, setShowDebug] = useState(false);
    const [showThought, setShowThought] = useState(false); 
    const [pageCopied, setPageCopied] = useState(false);
    const [selectionMenu, setSelectionMenu] = useState(null); 
    const scrollRef = useRef(null);

    const useCompact = isInGame;
    const MarkdownComponents = useMemo(() => getMarkdownComponents(useCompact), [useCompact]);
    const WebMarkdownComponents = useMemo(() => getMarkdownComponents(false), []);

    const { mode, data, thought } = useMemo(() => parseHybridContent(aiResult), [aiResult]);
    
    // 🔥 [修改] 不再将 Concise (战术速览) 放入 Tabs，只显示详细内容
    const activeTabsData = useMemo(() => {
        const tabs = [];
        // 如果有详细 Tab，直接使用
        if (data?.detailed_tabs?.length > 0) {
            tabs.push(...data.detailed_tabs);
        } else if (data?.simple_tabs?.length > 0) {
            tabs.push(...data.simple_tabs);
        }
        return tabs;
    }, [data]);

    const cleanAndCopy = (content, callback) => {
        if (!content) return;
        const cleanText = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/【(.*?)】/g, '$1').trim();
        const finalMsg = `${cleanText} (来自:海克斯教练)`;
        
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('copy-and-lock', finalMsg);
            callback(true);
            toast.success("已复制并锁定 (游戏内直接粘贴)");
            setTimeout(() => callback(false), 2000);
        } else {
            navigator.clipboard.writeText(finalMsg).then(() => {
                callback(true); toast.success("已复制"); setTimeout(() => callback(false), 2000);
            }).catch(() => toast.error("复制失败"));
        }
    };

    const handleCopyCurrentPage = () => {
        const currentTab = activeTabsData[webActiveTab];
        if (!currentTab || !currentTab.content) return toast.error("无内容");
        cleanAndCopy(currentTab.content, setPageCopied);
    };

    // 选择文字相关逻辑
    useEffect(() => {
        const handleSelection = () => {
            if (window.innerWidth < 768) return; 
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) return;
            const text = selection.toString().trim();
            if (!text) return;
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) setSelectionMenu({ x: rect.left + rect.width / 2, y: rect.top - 10, text: text });
        };
        const handleClickOutside = (e) => {
            if (e.target.closest('#selection-toolbar')) return;
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) setSelectionMenu(null);
        };
        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('mousedown', handleClickOutside);
        return () => { document.removeEventListener('mouseup', handleSelection); document.removeEventListener('mousedown', handleClickOutside); };
    }, []);

    const SelectionFloatingButton = () => {
        if (!selectionMenu) return null;
        return createPortal(
            <div id="selection-toolbar" className="fixed z-[9999] transform -translate-x-1/2 -translate-y-full pb-2" style={{ top: selectionMenu.y, left: selectionMenu.x }}>
                <div className="flex items-center gap-1 bg-[#1a1a20] p-1 rounded-lg border border-slate-600/50 shadow-2xl backdrop-blur-md">
                    <button onMouseDown={(e) => { e.preventDefault(); cleanAndCopy(selectionMenu.text, () => {}); setSelectionMenu(null); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-bold"><Copy size={13}/> 复制</button>
                    <div className="w-[1px] h-4 bg-slate-700"></div>
                    <button onMouseDown={(e) => { e.preventDefault(); setFeedbackContent(`> ${selectionMenu.text}\n\n`); setShowFeedbackModal(true); setSelectionMenu(null); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-amber-500 hover:text-amber-400 text-xs font-bold"><MessageSquarePlus size={13}/> 反馈</button>
                </div>
            </div>, document.body
        );
    };

    if (mode === 'loading' && !isAnalyzing) return <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50 py-20"><Brain size={48} className="mb-4 text-slate-700"/><div className="text-sm">点击上方按钮开始分析</div></div>;

    // 🔥 Overlay Mode (悬浮窗模式 - 只在游戏内浮窗时触发)
    if (forceTab !== undefined) {
        const overlayPaddingClass = useCompact ? 'p-0' : 'p-3';
        const cardStyleClass = useCompact 
            ? 'bg-transparent border-none shadow-none' 
            : 'bg-[#232329]/95 backdrop-blur border border-amber-500/30 shadow-lg';

        // 这里的 forceTab 逻辑需要调整，因为去掉了 0 号 Concise Tab
        // 假设 forceTab=1 对应第一个 Tab
        const tabIndex = forceTab - 1; 
        const currentTab = activeTabsData[tabIndex];

        if (currentTab) {
            return (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider bg-white/5 px-2 py-1 rounded w-fit flex items-center gap-2 border border-white/5 shrink-0 relative ml-1">
                        <span className="text-amber-500 font-mono mr-2">#{forceTab}</span> {currentTab.title}
                    </div>
                    <div 
                        ref={scrollRef} 
                        className={`flex-1 overflow-y-auto custom-scrollbar ${overlayPaddingClass} ${cardStyleClass}`}
                        style={{ zoom: globalScale }}
                    >
                        <div className="prose prose-invert prose-xs max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{enhanceMarkdown(currentTab.content)}</ReactMarkdown></div>
                    </div>
                </div>
            );
        }
        return <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2"><FileText size={24} className="opacity-20"/><span>暂无此页数据</span></div>;
    }

    return (
        <div className="flex flex-col h-full bg-[#232329]/90 backdrop-blur-md rounded-xl border border-[#C8AA6E]/20 shadow-2xl overflow-hidden relative group/container transition-all">
            {/* Header: Removed Audio Controls */}
            <div className="shrink-0 flex items-center justify-between border-b border-white/10 bg-[#1a1a20] relative z-30 h-12">
                <div className="flex overflow-x-auto scrollbar-hide flex-1 items-center h-full">
                    {/* 思维链开关 */}
                    <div onClick={() => thought && setShowThought(!showThought)} className={`flex items-center justify-center w-12 h-full border-r border-white/5 cursor-pointer hover:bg-white/5 ${thought ? '' : 'opacity-50 cursor-default'}`}>
                        <Brain size={18} className={showThought ? 'text-amber-400' : 'text-[#0AC8B9]'} />
                    </div>
                    {/* Tabs */}
                    {activeTabsData.length > 0 ? activeTabsData.map((tab, idx) => (
                        <button key={idx} onClick={() => setWebActiveTab(idx)} className={`relative h-full px-5 flex items-center gap-2 text-xs font-bold transition-all border-r border-white/5 whitespace-nowrap ${webActiveTab === idx ? 'text-slate-100 bg-[#2c2c33]' : 'text-slate-500 hover:text-slate-300'}`}>
                            <span className={`font-mono opacity-50 ${webActiveTab === idx ? 'text-amber-500 opacity-100' : ''}`}>0{idx + 1}</span>
                            <span>{tab.title}</span>
                            {webActiveTab === idx && <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>}
                        </button>
                    )) : (
                        <div className="px-5 text-xs text-slate-500 italic flex items-center gap-2">{isAnalyzing ? <RefreshCw size={12} className="animate-spin"/> : <BookOpen size={12}/>}{isAnalyzing ? "正在推演战术..." : "等待数据..."}</div>
                    )}
                </div>
                {/* Right Toolbar: Cleaned up */}
                <div className="flex items-center gap-1 pr-2 pl-2 h-full bg-[#1a1a20] shadow-[-10px_0_20px_#1a1a20] shrink-0">
                    <button onClick={onClear} className="p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                    <button onClick={() => setShowDebug(!showDebug)} className={`p-2 rounded-lg transition-all ${showDebug ? 'text-amber-400' : 'text-slate-600'}`}><Eye size={16}/></button>
                </div>
            </div>

            {/* Thought Drawer */}
            {showThought && thought && (
                <div className="bg-[#15151a] border-b border-amber-500/20 shadow-inner relative z-20 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-4">
                        <div className="text-[11px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap border-l-2 border-amber-500/20 pl-3">{thought}</div>
                    </div>
                    <div onClick={() => setShowThought(false)} className="absolute bottom-2 right-4 text-[10px] text-slate-600 hover:text-amber-500 cursor-pointer flex items-center gap-1">收起 <ChevronDown size={10} className="rotate-180"/></div>
                </div>
            )}

            {/* Content Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-transparent relative selection:bg-amber-500/30 selection:text-white scroll-smooth">
                {activeTabsData[webActiveTab] ? (
                    <div className="prose prose-invert prose-sm max-w-[800px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="mb-6 pb-4 border-b border-white/5"><h1 className="text-2xl font-bold text-slate-100">{activeTabsData[webActiveTab].title}</h1></div>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={WebMarkdownComponents}>{enhanceMarkdown(activeTabsData[webActiveTab].content)}</ReactMarkdown>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-3 opacity-50 min-h-[200px]">{!isAnalyzing && <FileText size={32} className="opacity-20"/>}<span>{!isAnalyzing && "暂无此模式数据"}</span></div>
                )}
                <SelectionFloatingButton />
            </div>
            
            {/* Footer */}
            <div className="p-2 border-t border-white/5 flex justify-between items-center bg-[#1a1a20] shrink-0 text-[10px]">
                <div className="flex items-center gap-2 text-slate-600 pl-2"><ShieldAlert size={12} /><span>Hex Engine V4.0 Hybrid</span></div>
                <div className="flex items-center gap-3 pr-2">
                    <button onClick={handleCopyCurrentPage} className="text-slate-500 hover:text-white transition-colors flex items-center gap-1">{pageCopied ? <Check size={10}/> : <Copy size={10}/>} {pageCopied ? '已复制' : '复制全文'}</button>
                    <div className="w-[1px] h-3 bg-white/10"></div>
                    <button onClick={() => setShowFeedbackModal(true)} className="flex items-center gap-1.5 text-amber-500/80 hover:text-amber-400"><Gift size={10} /> 纠错领赏</button>
                </div>
            </div>

            {showDebug && <div className="absolute inset-0 bg-black/95 z-50 p-4 overflow-auto animate-in fade-in"><button onClick={() => setShowDebug(false)} className="absolute top-4 right-4 text-white hover:text-red-400"><EyeOff/></button><pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap border border-green-900/30 p-2 rounded bg-black/50">{typeof aiResult === 'object' ? JSON.stringify(aiResult, null, 2) : aiResult}</pre></div>}
        </div>
    );
};

export default DeepPacketView;