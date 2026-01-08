import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
    RefreshCw, Lightbulb, Target, Swords, Brain, ShieldAlert, Eye, EyeOff, 
    FileText, Layout, MessageSquarePlus, Copy, Check, Gift, AlertTriangle, 
    Zap, BookOpen, Trash2, Map 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';

// ... (parseHybridContent 和 enhanceMarkdown 等辅助函数保持不变，篇幅原因省略，请确保保留原文件中的这些函数) ...
// ⚠️ 为了确保完整性，我再次提供这些函数，确保直接覆盖不报错。

// =================================================================
// 🛠️ 智能解析器 V3.2
// =================================================================
const parseHybridContent = (rawString) => {
    if (!rawString || typeof rawString !== 'string') return { mode: 'loading', data: null, thought: "" };
    
    let thought = "";
    const thoughtMatch = rawString.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thoughtMatch) {
        thought = thoughtMatch[1].trim();
    }

    let cleanStr = rawString.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, ""); 
    cleanStr = cleanStr.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const parsed = JSON.parse(cleanStr);
        if (!parsed.simple_tabs) parsed.simple_tabs = [];
        if (!parsed.detailed_tabs) parsed.detailed_tabs = [];
        return { mode: 'json', data: parsed, thought };
    } catch (e) { }

    const hasJsonStructure = cleanStr.includes('"concise"') || cleanStr.startsWith('{');

    if (hasJsonStructure) {
        let conciseObj = { title: "正在分析...", content: "" };
        const conciseStart = cleanStr.indexOf('"concise"');
        if (conciseStart !== -1) {
            const braceStart = cleanStr.indexOf('{', conciseStart);
            if (braceStart !== -1) {
                const titleMatch = cleanStr.substring(braceStart).match(/"title"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/);
                if (titleMatch) conciseObj.title = titleMatch[1];
                const contentLabelRegex = /"content"\s*:\s*"/g;
                contentLabelRegex.lastIndex = braceStart;
                const contentMatch = contentLabelRegex.exec(cleanStr);
                if (contentMatch) {
                    const contentStart = contentMatch.index + contentMatch[0].length;
                    let contentEnd = -1;
                    const nextSimple = cleanStr.indexOf('"simple_tabs"', contentStart);
                    const nextDetailed = cleanStr.indexOf('"detailed_tabs"', contentStart);
                    if (nextSimple !== -1 && nextDetailed !== -1) contentEnd = Math.min(nextSimple, nextDetailed);
                    else if (nextSimple !== -1) contentEnd = nextSimple;
                    else if (nextDetailed !== -1) contentEnd = nextDetailed;
                    if (contentEnd !== -1) {
                        while (contentEnd > contentStart && [',', '}', '\n', ' ', '\r', '\t'].includes(cleanStr[contentEnd - 1])) contentEnd--;
                        if (cleanStr[contentEnd - 1] === '"' && cleanStr[contentEnd - 2] !== '\\') contentEnd--;
                        conciseObj.content = cleanStr.substring(contentStart, contentEnd);
                    } else conciseObj.content = cleanStr.substring(contentStart);
                    conciseObj.content = conciseObj.content.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
                }
            }
        }

        const extractTabs = (keyName) => {
            const tabs = [];
            const startIdx = cleanStr.indexOf(`"${keyName}"`);
            if (startIdx === -1) return tabs;
            let endIdx = cleanStr.length;
            const otherKeys = ["simple_tabs", "detailed_tabs"].filter(k => k !== keyName);
            for (const k of otherKeys) {
                const kIdx = cleanStr.indexOf(`"${k}"`, startIdx + keyName.length);
                if (kIdx !== -1 && kIdx < endIdx) endIdx = kIdx;
            }
            const sectionStr = cleanStr.substring(startIdx, endIdx);
            const titleRegex = /"title"\s*:\s*"([^"]+)"/g;
            let titleMatch;
            while ((titleMatch = titleRegex.exec(sectionStr)) !== null) {
                const title = titleMatch[1];
                const titleEndIdx = titleRegex.lastIndex;
                const contentLabelRegex = /"content"\s*:\s*"/g;
                contentLabelRegex.lastIndex = titleEndIdx;
                const contentMatch = contentLabelRegex.exec(sectionStr);
                if (contentMatch) {
                    const contentStartIdx = contentMatch.index + contentMatch[0].length;
                    let endQuoteIdx = -1;
                    let escapeCount = 0;
                    for (let i = contentStartIdx; i < sectionStr.length; i++) {
                        if (sectionStr[i] === '\\') escapeCount++;
                        else {
                            if (sectionStr[i] === '"' && escapeCount % 2 === 0) { endQuoteIdx = i; break; }
                            escapeCount = 0;
                        }
                    }
                    const content = endQuoteIdx !== -1 ? sectionStr.substring(contentStartIdx, endQuoteIdx) : sectionStr.substring(contentStartIdx);
                    tabs.push({ title: title.replace(/\\"/g, '"').replace(/\\n/g, '\n'), content: content.replace(/\\"/g, '"').replace(/\\n/g, '\n') });
                }
            }
            return tabs;
        };

        return { mode: 'json', data: { concise: conciseObj, simple_tabs: extractTabs('simple_tabs'), detailed_tabs: extractTabs('detailed_tabs') }, thought };
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

const parseConciseContent = (markdown) => {
    if (!markdown) return [];
    const rawSections = markdown.split(/###\s+/);
    const sections = [];
    rawSections.forEach(section => {
        if (!section.trim()) return;
        const match = section.match(/^[【\[](.*?)[】\]]([\s\S]*)/);
        if (match) {
            sections.push({ title: match[1].trim(), content: match[2].trim() });
        } else {
            const lines = section.split('\n');
            const title = lines[0].replace(/[*#]/g, '').trim();
            const content = lines.slice(1).join('\n').trim();
            if (title && content) sections.push({ title, content });
        }
    });
    return sections;
};

const getCardStyle = (title) => {
    if (title.includes("敌方") || title.includes("意图") || title.includes("心理") || title.includes("博弈")) {
        return { type: "danger", label: "心理博弈", icon: <Swords size={14} />, borderColor: "border-rose-500", textColor: "text-rose-400", bgGradient: "from-rose-500/10 to-transparent", barColor: "bg-rose-500" };
    }
    return { type: "gold", label: "节奏重心", icon: <Zap size={14} fill="currentColor" />, borderColor: "border-[#C8AA6E]", textColor: "text-[#C8AA6E]", bgGradient: "from-[#C8AA6E]/10 to-transparent", barColor: "bg-[#C8AA6E]" };
};

const ConciseVisualCard = ({ title, content }) => {
    const style = getCardStyle(title);
    return (
        <div className="flex bg-[#13151b] border border-white/5 rounded-lg overflow-hidden relative group hover:border-white/10 transition-all mb-3 shadow-lg">
            <div className="w-10 flex-shrink-0 flex flex-col items-center py-3 relative bg-[#0b0d12]">
                <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${style.barColor}`}></div>
                <div className={`mb-2 ${style.textColor} animate-pulse`}>{style.icon}</div>
                <div className={`text-[10px] font-bold tracking-widest ${style.textColor} opacity-80`} style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}>{style.label}</div>
            </div>
            <div className={`flex-1 p-3.5 relative`}>
                <div className={`absolute inset-0 bg-gradient-to-r ${style.bgGradient} opacity-20 pointer-events-none`}></div>
                <div className="flex items-center gap-2 mb-2"><span className={`text-sm font-bold text-white`}>{title}</span></div>
                <div className="text-xs md:text-sm text-slate-300 leading-relaxed font-sans">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ strong: ({node, ...props}) => <span className={`font-bold ${style.textColor} mx-0.5`} {...props} />, p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} /> }}>{content}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

const HexMarkdownComponents = {
    h3: ({node, ...props}) => <h3 className="text-[#C8AA6E] font-bold text-sm md:text-base mt-5 mb-3 flex items-center gap-2 border-l-4 border-[#C8AA6E] pl-3 bg-gradient-to-r from-[#C8AA6E]/10 to-transparent py-1.5 rounded-r select-none" {...props} />,
    h4: ({node, ...props}) => <h4 className="text-slate-200 font-bold text-xs md:text-sm mt-3 mb-2 flex items-center before:content-['◈'] before:text-[#C8AA6E] before:mr-2 before:text-[10px]" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-2 marker:text-[#C8AA6E]" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-2 marker:text-[#C8AA6E] marker:font-mono" {...props} />,
    li: ({node, ...props}) => <li className="text-slate-300 text-xs md:text-sm leading-relaxed pl-1" {...props} />,
    strong: ({node, ...props}) => <strong className="text-[#FFE0A3] font-bold mx-0.5 border-b border-[#C8AA6E]/40 pb-0.5 tracking-wide" {...props} />,
    p: ({node, ...props}) => <p className="mb-3 leading-7 text-slate-300 text-xs md:text-sm font-sans text-justify" {...props} />,
    table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-lg border border-[#C8AA6E]/20 shadow-[0_4px_12px_rgba(0,0,0,0.3)] bg-[#000000]/20 scrollbar-thin scrollbar-thumb-[#C8AA6E]/30 scrollbar-track-transparent pb-1"><table className="w-full text-left border-collapse min-w-[450px]" {...props} /></div>,
    thead: ({node, ...props}) => <thead className="bg-[#C8AA6E]/10 border-b border-[#C8AA6E]/20" {...props} />,
    tbody: ({node, ...props}) => <tbody className="divide-y divide-white/5" {...props} />,
    tr: ({node, ...props}) => <tr className="hover:bg-white/5 transition-colors group" {...props} />,
    th: ({node, ...props}) => <th className="px-4 py-3 text-xs font-bold text-[#C8AA6E] uppercase tracking-wider whitespace-nowrap bg-black/20" {...props} />,
    td: ({node, ...props}) => <td className="px-4 py-3 text-xs text-slate-300 align-top leading-6 min-w-[120px] group-hover:text-slate-100 transition-colors" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-amber-500/60 bg-gradient-to-r from-amber-500/10 to-transparent py-2 px-4 rounded-r text-slate-400 text-xs my-4 italic relative" {...props} />,
    code: ({node, inline, className, children, ...props}) => inline ? <code className="bg-white/10 text-amber-200 px-1.5 py-0.5 rounded text-[10px] font-mono border border-white/5" {...props}>{children}</code> : <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto border border-white/10 my-3"><code className="text-xs font-mono text-slate-300" {...props}>{children}</code></pre>,
    hr: ({node, ...props}) => <hr className="border-t border-white/10 my-6" {...props} />,
};

// =================================================================
// 🚀 主组件
// =================================================================
// 🔥 修正：接受 viewMode 和 setViewMode 作为 props
const AnalysisResult = ({ aiResult, isAnalyzing, setShowFeedbackModal, setFeedbackContent, sendChatTrigger, forceTab, onClear, setActiveTab, viewMode, setViewMode }) => {
    const [webActiveTab, setWebActiveTab] = useState(0);
    const [showDebug, setShowDebug] = useState(false);
    const [showThought, setShowThought] = useState(false); 
    const [teamCopied, setTeamCopied] = useState(false);
    const [selectionMenu, setSelectionMenu] = useState(null); 
    
    // 🔥 移除本地 state: const [viewMode, setViewMode] = useState('simple'); 
    
    const scrollRef = useRef(null);

    const { mode, data, thought } = useMemo(() => parseHybridContent(aiResult), [aiResult]);
    const concise = data?.concise || {};
    const conciseCards = useMemo(() => parseConciseContent(concise.content), [concise.content]);

    const simpleData = data?.simple_tabs || [];
    const detailedData = data?.detailed_tabs || [];
    
    // 🔥 使用 props 中的 viewMode 决定显示内容
    const activeTabsData = (viewMode === 'simple' && simpleData.length > 0) ? simpleData : (detailedData.length > 0 ? detailedData : []);

    // 首次有数据时提示用户
    useEffect(() => {
        const hasSeenHint = localStorage.getItem('has_seen_mode_switch_hint');
        if (!hasSeenHint && !isAnalyzing && activeTabsData.length > 0) {
            toast("💡 小提示：点击右下角按钮，可在【口令版】与【详细版】之间切换！", {
                duration: 5000,
                position: 'bottom-center',
                style: { background: '#091428', color: '#C8AA6E', border: '1px solid #C8AA6E' }
            });
            localStorage.setItem('has_seen_mode_switch_hint', 'true');
        }
    }, [isAnalyzing, activeTabsData]);

    // 🔥🔥 [关键修复] 监听自定义事件，实现 Overlay 内的翻页和滚动
    useEffect(() => {
        const handleOverlayScroll = (e) => {
            const direction = e.detail; // 'up' or 'down'
            if (scrollRef.current) {
                const amount = 50;
                scrollRef.current.scrollTop += (direction === 'down' ? amount : -amount);
            }
        };

        const handleOverlayNav = (e) => {
            const command = e.detail; // 'nav_prev' or 'nav_next'
            // 如果是在 Overlay 模式 (forceTab 存在)
            if (forceTab !== undefined && setActiveTab) {
                // 计算最大页数 (Concise(0) + Tabs.length)
                const maxTab = activeTabsData.length; // Tabs从1开始，所以总页数是 1(0) + length
                // forceTab: 0=Concise, 1..N=Tabs
                
                let nextTab = forceTab;
                if (command === 'nav_next') {
                    nextTab = forceTab + 1;
                    if (nextTab > maxTab) nextTab = 0; // 循环
                } else if (command === 'nav_prev') {
                    nextTab = forceTab - 1;
                    if (nextTab < 0) nextTab = maxTab; // 循环
                }
                
                setActiveTab(nextTab);
                toast(nextTab === 0 ? "战术总览" : `战术详情 ${nextTab}`, { icon: '📄', duration: 800 });
            }
        };

        window.addEventListener('overlay-scroll', handleOverlayScroll);
        window.addEventListener('overlay-nav', handleOverlayNav);

        return () => {
            window.removeEventListener('overlay-scroll', handleOverlayScroll);
            window.removeEventListener('overlay-nav', handleOverlayNav);
        };
    }, [forceTab, setActiveTab, activeTabsData.length]);

    // 自动滚动到底部 (仅在生成时)
    useEffect(() => {
        if (isAnalyzing && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [aiResult, isAnalyzing, forceTab, webActiveTab, viewMode]);

    useEffect(() => {
        if (sendChatTrigger > 0) {
            const content = concise?.content || "";
            if (!content) return;
            const cleanText = content.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/【(.*?)】/g, '$1').replace(/#{1,6}\s/g, '').replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim();
            const finalMsg = `${cleanText} (来自:海克斯教练)`;
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('copy-and-lock', finalMsg); 
                if(typeof toast !== 'undefined') toast.success("已复制到剪贴板");
            }
        }
    }, [sendChatTrigger, concise]);

    useEffect(() => {
        const handleSelection = () => {
            if (window.innerWidth < 768) return; 
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) return;
            const text = selection.toString().trim();
            if (!text) return;
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setSelectionMenu({ x: rect.left + rect.width / 2, y: rect.top - 10, text: text });
            }
        };
        const handleClickOutside = (e) => {
            if (e.target.closest('#selection-toolbar')) return;
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) setSelectionMenu(null);
        };
        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mouseup', handleSelection);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleJustCopy = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (selectionMenu && selectionMenu.text) {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('copy-and-lock', selectionMenu.text);
                if(typeof toast !== 'undefined') toast.success("已复制！请按 Ctrl+V");
            } else {
                navigator.clipboard.writeText(selectionMenu.text);
                if(typeof toast !== 'undefined') toast.success("已复制");
            }
            setSelectionMenu(null); window.getSelection().removeAllRanges(); 
        }
    };

    const handleSelectionFeedback = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (selectionMenu && selectionMenu.text) {
            navigator.clipboard.writeText(selectionMenu.text).then(() => {
                if (typeof setFeedbackContent === 'function') setFeedbackContent(`> ${selectionMenu.text}\n\n`);
                setShowFeedbackModal(true); setSelectionMenu(null); window.getSelection().removeAllRanges();
            });
        }
    };

    const handleCopyToTeam = () => {
        const content = concise?.content || "";
        if (!content) return;
        const cleanText = content.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/【(.*?)】/g, '$1').replace(/#{1,6}\s/g, '').replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim();
        const finalMsg = `${cleanText} (来自:海克斯教练)`;
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('copy-and-lock', finalMsg);
            setTeamCopied(true); if(typeof toast !== 'undefined') toast.success("已复制！请直接在游戏中按 Ctrl+V");
            setTimeout(() => setTeamCopied(false), 2000);
        } else {
            navigator.clipboard.writeText(finalMsg).then(() => {
                setTeamCopied(true); if(typeof toast !== 'undefined') toast.success("已复制！请直接在游戏中按 Ctrl+V");
                setTimeout(() => setTeamCopied(false), 2000);
            }).catch(() => alert("复制失败，请手动复制"));
        }
    };

    const handleClear = () => {
        if (confirm("确定要清空当前的分析结果吗？")) {
            if (onClear) onClear();
        }
    };

    const SelectionFloatingButton = () => {
        if (!selectionMenu) return null;
        return createPortal(
            <div id="selection-toolbar" className="fixed z-[9999] transform -translate-x-1/2 -translate-y-full pb-2 animate-in fade-in zoom-in duration-200 pointer-events-auto" style={{ top: selectionMenu.y, left: selectionMenu.x }}>
                <div className="flex items-center gap-1 bg-[#1a1a20] p-1 rounded-lg border border-slate-600/50 shadow-2xl backdrop-blur-md">
                    <button onMouseDown={handleJustCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs font-bold whitespace-nowrap" title="复制到剪贴板">
                        <Copy size={13} /> <span>复制</span>
                    </button>
                    <div className="w-[1px] h-4 bg-slate-700"></div>
                    <button onMouseDown={handleSelectionFeedback} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors text-xs font-bold whitespace-nowrap" title="引用此段内容进行反馈">
                        <MessageSquarePlus size={13} /> <span>反馈</span>
                    </button>
                </div>
                <div className="w-2 h-2 bg-[#1a1a20] border-r border-b border-slate-600/50 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
            </div>, document.body
        );
    };

    if (mode === 'loading' && !isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50 py-20">
                <Brain size={48} className="mb-4 text-slate-700" />
                <div className="text-sm">点击上方按钮开始分析</div>
            </div>
        );
    }

    // =================================================================
    // 🔥 Overlay 模式 (游戏内悬浮窗) - 保持卡片美化
    // =================================================================
    if (forceTab !== undefined) {
        if (forceTab === 0) {
            return (
                <div ref={scrollRef} className="flex flex-col h-full gap-2 overflow-y-auto custom-scrollbar p-1">
                    <div className="bg-[#232329]/95 backdrop-blur rounded-xl p-3 border border-amber-500/30 shadow-lg shrink-0 min-h-full">
                        <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-1">
                            <h2 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                                <Target size={12} className="text-[#C8AA6E]"/> {concise.title || "战术总览"}
                            </h2>
                            {thought && (
                                <button onClick={() => setShowThought(!showThought)} className={`text-amber-500 hover:text-amber-400 transition ${showThought ? 'opacity-100' : 'opacity-50'}`}>
                                    <Lightbulb size={12}/>
                                </button>
                            )}
                        </div>
                        {conciseCards.length > 0 ? (
                            <div className="space-y-2">
                                {conciseCards.map((card, idx) => (
                                    <ConciseVisualCard key={idx} title={card.title} content={card.content} />
                                ))}
                            </div>
                        ) : (
                            <div className="prose prose-invert prose-xs max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={HexMarkdownComponents}>
                                    {enhanceMarkdown(concise.content)}
                                </ReactMarkdown>
                            </div>
                        )}
                        {showThought && thought && (
                            <div className="mt-2 p-2 bg-black/40 rounded text-[10px] text-slate-500 font-mono italic border-l-2 border-amber-500/30">
                                {thought}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        const tabIndex = forceTab - 1;
        const currentTab = activeTabsData[tabIndex];

        if (currentTab) {
            return (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider bg-white/5 px-2 py-1 rounded w-fit flex items-center gap-2 border border-white/5 shrink-0">
                        <span className="text-amber-500 font-mono">#{forceTab}</span> {currentTab.title}
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar bg-[#232329]/90 p-3 rounded-lg border border-white/5 shadow-inner">
                        <div className="prose prose-invert prose-xs max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={HexMarkdownComponents}>
                                {enhanceMarkdown(currentTab.content)}
                            </ReactMarkdown>
                        </div>
                        <SelectionFloatingButton />
                    </div>
                </div>
            );
        }

        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <FileText size={24} className="opacity-20"/>
                <span>暂无此页数据</span>
            </div>
        );
    }

    // =================================================================
    // 🔥 Web 模式 (浏览器窗口) - 正常模式
    // =================================================================
    if (mode === 'markdown') {
        return (
            <div className="flex flex-col h-full bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#2c2c33]/50">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className={isAnalyzing ? "text-amber-400 animate-pulse" : "text-blue-400"} />
                        <span className="text-xs font-bold tracking-wider text-slate-300">{isAnalyzing ? "AI 正在撰写..." : "全文本报告"}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowDebug(!showDebug)} className="text-slate-500 hover:text-white"><Eye size={14}/></button>
                        <button onClick={() => setShowFeedbackModal(true)} className="text-slate-500 hover:text-red-400 flex items-center gap-1 text-[10px] transition-colors"><ShieldAlert size={12}/> 纠错</button>
                    </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative selection:bg-amber-500/30 selection:text-white">
                    <div className="prose prose-invert prose-sm max-w-3xl mx-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={HexMarkdownComponents}>
                            {enhanceMarkdown(data)}
                        </ReactMarkdown>
                        {isAnalyzing && <span className="inline-block w-2 h-5 bg-amber-500 ml-1 align-middle animate-pulse"></span>}
                    </div>
                    <SelectionFloatingButton />
                </div>
                {showDebug && <div className="absolute inset-0 bg-black/95 z-50 p-4 overflow-auto"><button onClick={() => setShowDebug(false)} className="absolute top-4 right-4 text-white"><EyeOff/></button><pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap">{aiResult}</pre></div>}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-[#C8AA6E]/30 shadow-2xl overflow-hidden relative group/container transition-all">
            
            {/* === 顶部区域：Concise (战术总览) === */}
            <div className="shrink-0 p-4 border-b border-white/10 bg-gradient-to-b from-[#091428] to-[#0c1018] relative z-20">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Target size={60} /></div>
                
                <div className="flex items-start gap-3 md:gap-4 relative z-10">
                    <div 
                        onClick={() => thought && setShowThought(!showThought)}
                        className={`
                            relative p-2 md:p-3 rounded-lg border shrink-0 transition-all duration-300 mt-1
                            ${thought ? 'cursor-pointer border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20' : 'opacity-40 border-transparent cursor-not-allowed bg-black/20'}
                            ${isAnalyzing && !thought ? 'animate-pulse' : ''} 
                        `}
                    >
                        <Lightbulb size={20} className={`md:w-6 md:h-6 transition-colors duration-300 ${thought ? 'text-amber-400' : 'text-slate-600'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                            <h2 className="text-base md:text-lg font-bold text-slate-100 leading-tight tracking-wide pr-4 truncate">
                                {concise.title || (isAnalyzing ? "正在进行战术推演..." : "等待分析结果")}
                            </h2>
                        </div>
                        
                        {/* 思考过程 */}
                        {showThought && thought && (
                            <div className="mb-3 max-h-[300px] overflow-y-auto bg-black/40 border-l-2 border-amber-500/50 p-3 rounded-r-lg text-[10px] md:text-[11px] font-mono text-slate-400 leading-relaxed custom-scrollbar animate-in slide-in-from-top-2 fade-in">
                                <div className="whitespace-pre-wrap break-words">{thought}</div>
                            </div>
                        )}

                        {/* 卡片列表 */}
                        <div className="mb-2 max-w-[800px] overflow-y-auto max-h-[40vh] custom-scrollbar pr-2">
                            {conciseCards.length > 0 ? (
                                <div className="space-y-1">
                                    {conciseCards.map((card, idx) => (
                                        <ConciseVisualCard key={idx} title={card.title} content={card.content} />
                                    ))}
                                </div>
                            ) : (
                                concise.content ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={HexMarkdownComponents}>
                                            {enhanceMarkdown(concise.content)}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    isAnalyzing && <div className="text-xs text-slate-500 animate-pulse">正在生成摘要...</div>
                                )
                            )}
                        </div>

                        {/* 工具栏 */}
                        <div className="flex justify-end items-center gap-2 mt-2 pt-2 border-t border-white/5">
                            <div className="flex-1"></div>
                            
                            <button 
                                onClick={handleClear} 
                                className="text-slate-600 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-500/10 mr-1"
                                title="清空当前分析结果"
                            >
                                <Trash2 size={16}/>
                            </button>

                            <button onClick={handleCopyToTeam} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer select-none ${teamCopied ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-amber-500 hover:bg-amber-500/10'}`}>
                                {teamCopied ? <Check size={12}/> : <Copy size={12}/>}<span>{teamCopied ? '已复制' : '复制'}</span>
                            </button>
                            <button onClick={() => setShowDebug(!showDebug)} className="text-slate-600 hover:text-amber-500 transition-colors p-1.5">{showDebug ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 底部区域：Tabs (详细内容) === */}
            <div className="flex-1 flex flex-col min-h-0 relative z-10 bg-transparent">
                
                {/* Tabs Header */}
                <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#2c2c33]/95 backdrop-blur-md pr-2 shadow-sm">
                    {/* Tab 按钮组 */}
                    <div className="flex overflow-x-auto scrollbar-hide flex-1">
                        <div className="flex items-center px-3 border-r border-white/5 text-slate-500 shrink-0">
                            <Layout size={14} />
                        </div>
                        {activeTabsData.length > 0 ? activeTabsData.map((tab, idx) => (
                            <button key={idx} onClick={() => setWebActiveTab(idx)}
                                className={`px-4 py-2.5 md:px-5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2
                                    ${webActiveTab === idx 
                                        ? 'border-amber-500 text-amber-400 bg-amber-500/5' 
                                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}>
                                {idx + 1}. {tab.title}
                            </button>
                        )) : (
                            <div className="px-5 py-3 text-xs text-slate-500 italic flex items-center gap-2">
                                {isAnalyzing ? <RefreshCw size={12} className="animate-spin"/> : <BookOpen size={12}/>}
                                {isAnalyzing ? "生成中..." : "等待数据..."}
                            </div>
                        )}
                    </div>

                    {/* 🔥 模式切换开关 (发光版) */}
                    <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5 m-1 shrink-0 ml-2">
                        {/* 🔥 修复：使用外部传入的 setViewMode，确保与快捷键同步 */}
                        <button 
                            onClick={() => setViewMode && setViewMode('simple')}
                            className={`px-3 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1.5 duration-500
                                ${viewMode === 'simple' 
                                    ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-400 border-opacity-100 scale-105 z-10' 
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                                }`}
                            title="切换至：口令模式 (简明指令)"
                        >
                            <Zap size={10} fill={viewMode === 'simple' ? "currentColor" : "none"}/> 简略
                        </button>
                        <button 
                            onClick={() => setViewMode && setViewMode('detailed')}
                            className={`px-3 py-1 text-[10px] font-bold rounded transition-all flex items-center gap-1.5 duration-500
                                ${viewMode === 'detailed' 
                                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400 border-opacity-100 scale-105 z-10' 
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                                }`}
                            title="切换至：详细模式 (深度分析)"
                        >
                            <FileText size={10}/> 详细
                        </button>
                    </div>
                </div>
                
                {/* Tab Content */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-transparent relative selection:bg-amber-500/30 selection:text-white scroll-smooth">
                    {activeTabsData[webActiveTab] ? (
                        <div className="prose prose-invert prose-sm max-w-[800px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={HexMarkdownComponents}>
                                {enhanceMarkdown(activeTabsData[webActiveTab].content)}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-2 opacity-50 min-h-[200px]">
                           {!isAnalyzing && "暂无此模式数据，请尝试切换视图"}
                        </div>
                    )}
                    <SelectionFloatingButton />
                </div>
                
                {/* Footer Actions */}
                <div className="p-2 border-t border-white/5 flex justify-end bg-[#2c2c33]/40 rounded-b-xl shrink-0">
                <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-500 pl-2 opacity-60 hover:opacity-100 transition-opacity select-none cursor-help" title="每一条认真反馈，都在让 Hex Coach 更接近“真正的教练”。">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0AC8B9]"></div>
                        <span>发现 AI 判断有问题？提交反馈可获奖励。</span>
                    </div>
                    <button onClick={() => setShowFeedbackModal(true)} className="flex items-center gap-2 text-xs transition-all group">
                        <span className="text-slate-500 group-hover:text-slate-400 flex items-center gap-1"><AlertTriangle size={12} /> 内容有误？</span>
                        <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full group-hover:bg-amber-500/20 group-hover:border-amber-500/40 group-hover:scale-105 transition-all duration-300">
                            <Gift size={12} className="animate-bounce" />
                            <span className="font-bold tracking-wide scale-90 sm:scale-100">纠错采纳送额度</span>
                        </div>
                    </button>
                </div>
            </div>

            {showDebug && <div className="absolute inset-0 bg-black/95 z-50 p-4 overflow-auto animate-in fade-in"><button onClick={() => setShowDebug(false)} className="absolute top-4 right-4 text-white hover:text-red-400"><EyeOff/></button><pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap border border-green-900/30 p-2 rounded bg-black/50">{aiResult}</pre></div>}
        </div>
    );
};

export default AnalysisResult;