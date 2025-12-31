import React, { useMemo, useState, useEffect, useRef } from 'react';
import { RefreshCw, Lightbulb, Target, Swords, Brain, ShieldAlert, Eye, EyeOff, FileText, Layout, MessageSquarePlus, Copy, Check, Coffee } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';

// 🛠️ 智能解析器 V2.4 (修改点：增强思考过程提取)
const parseHybridContent = (rawString) => {
    if (!rawString || typeof rawString !== 'string') return { mode: 'loading', data: null, thought: "" };
    
    // 1. 🧠 提取思考过程 (支持流式未闭合标签)
    let thought = "";
    const thoughtMatch = rawString.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thoughtMatch) {
        thought = thoughtMatch[1].trim();
    }

    // 2. 🧹 清洗主体数据 (修改点：彻底移除思考标签，防止泄露)
    let cleanStr = rawString.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, ""); 
    cleanStr = cleanStr.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        const parsed = JSON.parse(cleanStr);
        return { mode: 'json', data: parsed, thought };
    } catch (e) { }

    // 3. 🕵️‍♀️ 流式提取 (容错路径) - 保持原有逻辑
    const hasJsonStructure = cleanStr.includes('"detailed_tabs"') || cleanStr.includes('"concise"');

    if (hasJsonStructure || cleanStr.startsWith('{')) {
        let conciseObj = { title: "正在分析战局...", content: "" };
        
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
                    const nextFieldIdx = cleanStr.indexOf('"detailed_tabs"', contentStart);
                    
                    if (nextFieldIdx !== -1) {
                        contentEnd = nextFieldIdx;
                        while (contentEnd > contentStart && [',', '}', '\n', ' ', '\r', '\t'].includes(cleanStr[contentEnd - 1])) {
                            contentEnd--;
                        }
                        if (cleanStr[contentEnd - 1] === '"' && cleanStr[contentEnd - 2] !== '\\') {
                            contentEnd--;
                        }
                    } else {
                        for (let i = contentStart; i < cleanStr.length; i++) {
                            if (cleanStr[i] === '"' && cleanStr[i - 1] !== '\\') {
                                contentEnd = i; 
                            }
                        }
                        if (contentEnd === -1) contentEnd = cleanStr.length;
                    }

                    if (contentEnd !== -1 && contentEnd > contentStart) {
                        conciseObj.content = cleanStr.substring(contentStart, contentEnd);
                    } else {
                        conciseObj.content = cleanStr.substring(contentStart);
                    }
                    
                    conciseObj.content = conciseObj.content
                        .replace(/\\"/g, '"')
                        .replace(/\\n/g, '\n')
                        .replace(/\\t/g, '\t');
                }
            }
        }

        // --- B. 提取 Detailed Tabs ---
        const tabs = [];
        const detailedStart = cleanStr.indexOf('"detailed_tabs"');
        
        if (detailedStart !== -1) {
            const detailedStr = cleanStr.substring(detailedStart);
            const titleRegex = /"title"\s*:\s*"([^"]+)"/g;
            let titleMatch;
            
            while ((titleMatch = titleRegex.exec(detailedStr)) !== null) {
                const title = titleMatch[1];
                const titleEndIdx = titleRegex.lastIndex;
                const contentLabelRegex = /"content"\s*:\s*"/g;
                contentLabelRegex.lastIndex = titleEndIdx;
                const contentMatch = contentLabelRegex.exec(detailedStr);
                
                if (contentMatch) {
                    const contentStartIdx = contentMatch.index + contentMatch[0].length;
                    let endQuoteIdx = -1;
                    
                    for (let i = contentStartIdx; i < detailedStr.length; i++) {
                        if (detailedStr[i] === '"' && detailedStr[i - 1] !== '\\') {
                            endQuoteIdx = i;
                            break;
                        }
                    }
                    
                    const content = endQuoteIdx !== -1 
                        ? detailedStr.substring(contentStartIdx, endQuoteIdx) 
                        : detailedStr.substring(contentStartIdx);
                    
                    tabs.push({
                        title: title.replace(/\\"/g, '"').replace(/\\n/g, '\n'),
                        content: content.replace(/\\"/g, '"').replace(/\\n/g, '\n')
                    });
                }
            }
        }

        return { 
            mode: 'json', 
            data: { concise: conciseObj, detailed_tabs: tabs }, 
            thought 
        };
    }

    // 4. 降级处理
    if (cleanStr.length > 0) {
        return { mode: 'markdown', data: cleanStr, thought };
    }

    return { mode: 'loading', data: null, thought };
};

const AnalysisResult = ({ aiResult, isAnalyzing, setShowFeedbackModal, handleRegenerate, setFeedbackContent, sendChatTrigger }) => {
    const [showDebug, setShowDebug] = useState(false);
    const [showThought, setShowThought] = useState(false); 
    const [activeTab, setActiveTab] = useState(0);
    const [teamCopied, setTeamCopied] = useState(false);
    const [selectionMenu, setSelectionMenu] = useState(null); 
    const scrollRef = useRef(null);

    const { mode, data, thought } = useMemo(() => parseHybridContent(aiResult), [aiResult]);

    useEffect(() => {
        if (isAnalyzing && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [aiResult, isAnalyzing, activeTab, mode]);

    // 监听一键发送快捷键触发器
    useEffect(() => {
        if (sendChatTrigger > 0) {
            const content = data?.concise?.content || "";
            if (!content) return;
            const cleanText = content
                .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '')
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/#{1,6}\s/g, '')
                .replace(/\n{2,}/g, '\n')
                .replace(/[ \t]+/g, ' ')
                .trim();
            const finalMsg = `${cleanText} (来自:海克斯教练)`;
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                // 使用 copy-and-lock 确保发送后也能归还焦点
                ipcRenderer.send('copy-and-lock', finalMsg); 
                if(typeof toast !== 'undefined') toast.success("已复制到剪贴板");
            }
        }
    }, [sendChatTrigger, data]);

    // 文本选中监听
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
                setSelectionMenu({ 
                    x: rect.left + rect.width / 2, 
                    y: rect.top - 10, 
                    text: text 
                });
            }
        };

        const handleClickOutside = (e) => {
            if (e.target.closest('#selection-toolbar')) return;
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                setSelectionMenu(null);
            }
        };

        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mouseup', handleSelection);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // ✅ 修复 1：选中文本复制后，也自动锁屏
    const handleJustCopy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectionMenu && selectionMenu.text) {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('copy-and-lock', selectionMenu.text);
                if(typeof toast !== 'undefined') toast.success("已复制！请按 Ctrl+V");
            } else {
                navigator.clipboard.writeText(selectionMenu.text);
                if(typeof toast !== 'undefined') toast.success("已复制");
            }
            setSelectionMenu(null);
            window.getSelection().removeAllRanges(); 
        }
    };

    const handleSelectionFeedback = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectionMenu && selectionMenu.text) {
            navigator.clipboard.writeText(selectionMenu.text).then(() => {
                if (typeof setFeedbackContent === 'function') {
                    setFeedbackContent(`> ${selectionMenu.text}\n\n`);
                }
                setShowFeedbackModal(true);
                setSelectionMenu(null);
                window.getSelection().removeAllRanges();
            });
        }
    };

    // ✅ 修复 2：一键复制逻辑，使用 copy-and-lock IPC，完全保留你的正则
    const handleCopyToTeam = () => {
        const content = data?.concise?.content || "";
        if (!content) return;
        
        // --- 你的原始正则开始 ---
        const cleanText = content
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/#{1,6}\s/g, '')
            .replace(/\n{2,}/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
        // --- 你的原始正则结束 ---
            
        const finalMsg = `${cleanText} (来自:海克斯教练)`;

        // 优先使用 Electron 主进程复制，这是在游戏中粘贴成功的关键
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            // 发送指令：后端写入剪贴板 + 强制锁屏 + 强制失焦
            // 这样你只需要按 Ctrl+V 即可，无需手动点游戏
            ipcRenderer.send('copy-and-lock', finalMsg);
            
            setTeamCopied(true);
            if(typeof toast !== 'undefined') toast.success("已复制！请直接在游戏中按 Ctrl+V");
            setTimeout(() => setTeamCopied(false), 2000);
        } else {
            // 浏览器环境兜底
            navigator.clipboard.writeText(finalMsg).then(() => {
                setTeamCopied(true);
                if(typeof toast !== 'undefined') toast.success("已复制！请直接在游戏中按 Ctrl+V");
                setTimeout(() => setTeamCopied(false), 2000);
            }).catch(() => alert("复制失败，请手动复制"));
        }
    };

    // 悬浮菜单组件
    const SelectionFloatingButton = () => {
        if (!selectionMenu) return null;
        return createPortal(
            <div 
                id="selection-toolbar"
                className="fixed z-[9999] transform -translate-x-1/2 -translate-y-full pb-2 animate-in fade-in zoom-in duration-200 pointer-events-auto" 
                style={{ top: selectionMenu.y, left: selectionMenu.x }}
            >
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

    // 1. 加载状态
    if (mode === 'loading' && !isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50 py-20">
                <Brain size={48} className="mb-4 text-slate-700" />
                <div className="text-sm">点击左侧按钮开始分析</div>
            </div>
        );
    }

    // 2. Markdown 模式 (兜底)
    if (mode === 'markdown') {
        return (
            <div className="flex flex-col h-full bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#2c2c33]/50">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className={isAnalyzing ? "text-amber-400 animate-pulse" : "text-blue-400"} />
                        <span className="text-xs font-bold tracking-wider text-slate-300">{isAnalyzing ? "AI 正在撰写分析..." : "全文本报告"}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowDebug(!showDebug)} className="text-slate-500 hover:text-white"><Eye size={14}/></button>
                        <button onClick={() => setShowFeedbackModal(true)} className="text-slate-500 hover:text-red-400 flex items-center gap-1 text-[10px] transition-colors"><ShieldAlert size={12}/> 纠错</button>
                    </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative selection:bg-amber-500/30 selection:text-white">
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-amber-400 prose-headings:font-bold prose-strong:text-white prose-blockquote:border-l-4 prose-blockquote:border-amber-500/50 prose-blockquote:bg-[#282830] prose-blockquote:py-2 prose-blockquote:px-4">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data}</ReactMarkdown>
                        {isAnalyzing && <span className="inline-block w-2 h-5 bg-amber-500 ml-1 align-middle animate-pulse"></span>}
                    </div>
                    <SelectionFloatingButton />
                </div>
                {showDebug && <DebugLayer content={aiResult} onClose={() => setShowDebug(false)} />}
            </div>
        );
    }

    const concise = data?.concise || {};
    const tabs = data?.detailed_tabs || [];

    const HexMarkdownComponents = {
        table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-sm border border-hex-gold/20 shadow-lg"><table className="w-full text-left border-collapse bg-hex-black/50 min-w-[300px]" {...props} /></div>,
        thead: ({node, ...props}) => <thead className="bg-gradient-to-r from-hex-dark to-hex-black border-b border-hex-gold/30" {...props} />,
        tbody: ({node, ...props}) => <tbody className="divide-y divide-hex-gold/5" {...props} />,
        tr: ({node, ...props}) => <tr className="hover:bg-hex-blue/5 transition-colors duration-200" {...props} />,
        th: ({node, ...props}) => <th className="px-3 py-2 md:px-4 md:py-3 text-xs font-bold text-hex-gold uppercase tracking-wider whitespace-nowrap" {...props} />,
        td: ({node, ...props}) => <td className="px-3 py-2 md:px-4 md:py-3 text-sm text-slate-300 leading-relaxed" {...props} />,
    };

    return (
        <div className="flex flex-col h-full gap-3 md:gap-4 overflow-hidden relative">
            
            {/* === 顶部：核心简报区域 === */}
            <div className="bg-[#232329]/90 backdrop-blur rounded-xl p-3 md:p-4 border border-white/10 shadow-lg shrink-0 transition-all group relative">
                
                {/* 注意：原有的 handleRegenerate 按钮已被移除，因为它集成到了外部 */}

                <div className="flex items-start gap-3 md:gap-4">
                    {/* 🔥 重点修改：思考过程灯泡 🔥 */}
                    <div 
                        onClick={() => thought && setShowThought(!showThought)}
                        className={`
                            relative p-2 md:p-3 rounded-lg border shrink-0 transition-all duration-300 mt-1
                            ${thought 
                                ? 'cursor-pointer border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 hover:scale-105 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                                : 'opacity-40 border-transparent cursor-not-allowed bg-black/20'}
                            ${showThought ? 'bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.4)] border-amber-500' : ''}
                            ${isAnalyzing && !thought ? 'animate-pulse' : ''} 
                        `}
                        title={thought ? "点击查看深度思考过程" : "等待思考内容..."}
                    >
                        <Lightbulb 
                            size={20} 
                            className={`
                                md:w-6 md:h-6 transition-colors duration-300
                                ${thought ? 'text-amber-400' : 'text-slate-600'}
                                ${isAnalyzing && thought ? 'animate-pulse' : ''}
                            `} 
                        />
                        {/* 正在生成思考时的小红点动画 */}
                        {isAnalyzing && thought && !showThought && (
                            <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                        )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex justify-between items-center mb-1 md:mb-2">
                            <h2 className="text-base md:text-lg font-bold text-slate-100 leading-tight tracking-wide pr-4 truncate">
                                {concise.title || (isAnalyzing ? "正在进行战术推演..." : "等待分析结果")}
                            </h2>
                        </div>
                        
                        {/* 简报内容 */}
                        <div className="text-xs md:text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-wrap break-words opacity-90 mb-2 selection:bg-amber-500/30 selection:text-white">
                             {concise.content}
                             {isAnalyzing && !concise.content && <span className="inline-block w-1.5 h-3 md:w-2 md:h-4 bg-amber-500 ml-1 animate-pulse align-middle"/>}
                        </div>

                        {/* 🔥 新增：思考过程展开区域 🔥 */}
                        <div className={`
                            overflow-hidden transition-all duration-500 ease-in-out
                            ${showThought && thought ? 'max-h-[600px] opacity-100 mb-3' : 'max-h-0 opacity-0'}
                        `}>
                            <div className="bg-black/40 border-l-2 border-amber-500/50 p-3 rounded-r-lg text-[10px] md:text-[11px] font-mono text-slate-400 leading-relaxed relative group/thought">
                                <div className="flex items-center gap-2 mb-2 text-amber-500/70 font-bold uppercase tracking-tighter sticky top-0 bg-black/80 backdrop-blur py-1 z-10 w-fit px-2 rounded">
                                    <Coffee size={10} /> 深度思考链 (CoT)
                                </div>
                                <div className="whitespace-pre-wrap break-words">
                                    {thought}
                                    {isAnalyzing && <span className="inline-block w-1 h-3 bg-amber-500 ml-1 animate-pulse"/>}
                                </div>
                            </div>
                        </div>

                        {/* 底部按钮栏 (保持不变) */}
                        <div className="flex justify-end items-center gap-2 mt-2 pt-2 border-t border-white/5">
                            <div className="flex-1"></div>
                            {/* ... 复制和 Debug 按钮 ... */}
                            <button onClick={handleCopyToTeam} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold border transition-all cursor-pointer select-none ${teamCopied ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-amber-500 hover:bg-amber-500/10'}`}>
                                {teamCopied ? <Check size={12}/> : <Copy size={12}/>}<span>{teamCopied ? '已复制' : '复制'}</span>
                            </button>
                            <button onClick={() => setShowDebug(!showDebug)} className="text-slate-600 hover:text-amber-500 transition-colors p-1.5">{showDebug ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 底部：详细内容 Tabs 区域 === */}
            <div className="flex-1 bg-[#232329]/80 backdrop-blur rounded-xl border border-white/5 flex flex-col min-h-0 relative shadow-inner overflow-hidden">
                <div className="sticky top-0 z-10 flex border-b border-white/5 overflow-x-auto scrollbar-hide bg-[#2c2c33]/90 backdrop-blur-md">
                    <div className="flex items-center px-3 border-r border-white/5 text-slate-500 shrink-0">
                        <Layout size={14} />
                    </div>
                    {tabs.length > 0 ? tabs.map((tab, idx) => (
                        <button key={idx} onClick={() => setActiveTab(idx)}
                            className={`px-4 py-2.5 md:px-5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2
                                ${activeTab === idx 
                                    ? 'border-amber-500 text-amber-400 bg-amber-500/5' 
                                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}>
                            {idx === 0 && <Target size={12} className="md:w-3.5 md:h-3.5"/>}
                            {idx === 1 && <Swords size={12} className="md:w-3.5 md:h-3.5"/>}
                            {tab.title}
                        </button>
                    )) : (
                        <div className="px-5 py-3 text-xs text-slate-500 italic flex items-center gap-2">
                             {isAnalyzing && <RefreshCw size={12} className="animate-spin"/>}
                             {isAnalyzing ? "战术推演中..." : "等待数据..."}
                        </div>
                    )}
                </div>
                
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-transparent relative selection:bg-amber-500/30 selection:text-white scroll-smooth">
                    {tabs[activeTab] ? (
                        <div className="prose prose-invert prose-sm max-w-none 
                            prose-headings:text-amber-400 prose-headings:font-bold prose-h3:text-base md:prose-h3:text-lg prose-h3:border-l-4 prose-h3:border-amber-500 prose-h3:pl-3 
                            prose-p:text-slate-300 prose-p:leading-relaxed md:prose-p:leading-7 prose-p:text-xs md:prose-p:text-sm
                            prose-strong:text-white prose-strong:font-black prose-strong:bg-white/5 prose-strong:px-1 prose-strong:rounded prose-li:text-slate-300 prose-ul:pl-4 
                            prose-blockquote:border-l-4 prose-blockquote:border-blue-500/50 prose-blockquote:bg-[#282830] prose-blockquote:py-2 prose-blockquote:px-3 prose-blockquote:rounded-r prose-blockquote:text-slate-400 prose-blockquote:text-xs">
                             <ReactMarkdown remarkPlugins={[remarkGfm]} components={HexMarkdownComponents}>{tabs[activeTab].content}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-2 opacity-50 min-h-[200px]">
                           {!isAnalyzing && "暂无详细数据"}
                        </div>
                    )}
                    <SelectionFloatingButton />
                </div>
                
                <div className="p-2 border-t border-white/5 flex justify-end bg-[#2c2c33]/40 rounded-b-xl shrink-0">
                    <button 
                        onClick={() => setShowFeedbackModal(true)} 
                        className="text-[10px] text-slate-500 hover:text-red-300 flex items-center gap-1.5 px-2 py-1 transition-colors"
                    >
                        <ShieldAlert size={12}/> <span>内容有误？点击反馈</span>
                    </button>
                </div>
            </div>
            {showDebug && <DebugLayer content={aiResult} onClose={() => setShowDebug(false)} />}
        </div>
    );
};

const DebugLayer = ({ content, onClose }) => (
    <div className="absolute inset-0 bg-black/95 z-50 p-4 overflow-auto animate-in fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-red-400"><EyeOff/></button>
        <div className="text-xs text-slate-500 mb-2 font-bold">RAW DATA STREAM:</div>
        <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all border border-green-900/30 p-2 rounded bg-black/50">{content}</pre>
    </div>
);

export default AnalysisResult;