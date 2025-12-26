import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // 🟢 必须引入这个插件才能解析表格
import { Bot, Terminal, Copy, Check, Cpu, Sparkles, AlertTriangle, Activity } from 'lucide-react';

export default function AnalysisResult({ aiResult, isAnalyzing, viewMode, setViewMode, activeTab, setActiveTab, setShowFeedbackModal }) {
    const [copied, setCopied] = useState(false);

    // 自动滚动到底部
    const messagesEndRef = useRef(null);
    useEffect(() => {
        if (isAnalyzing) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [aiResult, isAnalyzing]);

    const handleCopy = () => {
        if (!aiResult) return;
        const text = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult, null, 2);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // 解析 JSON 结果
    let parsedContent = null;
    let isJson = false;
    try {
        if (aiResult && typeof aiResult === 'string') {
            const trimmed = aiResult.trim();
            // 尝试提取 JSON 部分（防止 AI 在 JSON 前后加废话）
            const jsonStart = trimmed.indexOf('{');
            const jsonEnd = trimmed.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = trimmed.substring(jsonStart, jsonEnd + 1);
                parsedContent = JSON.parse(jsonStr);
                isJson = true;
            }
        }
    } catch (e) { isJson = false; }

    // === 海克斯科技 Markdown 组件样式 ===
    const HexMarkdownComponents = {
        // 🟢 修复表格：自定义渲染 Table 组件
        table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4 rounded-sm border border-hex-gold/20 shadow-lg">
                <table className="w-full text-left border-collapse bg-hex-black/50" {...props} />
            </div>
        ),
        thead: ({node, ...props}) => (
            <thead className="bg-gradient-to-r from-hex-dark to-hex-black border-b border-hex-gold/30" {...props} />
        ),
        tbody: ({node, ...props}) => (
            <tbody className="divide-y divide-hex-gold/5" {...props} />
        ),
        tr: ({node, ...props}) => (
            <tr className="hover:bg-hex-blue/5 transition-colors duration-200" {...props} />
        ),
        th: ({node, ...props}) => (
            <th className="px-4 py-3 text-xs font-bold text-hex-gold uppercase tracking-wider whitespace-nowrap" {...props} />
        ),
        td: ({node, ...props}) => (
            <td className="px-4 py-3 text-sm text-slate-300 leading-relaxed" {...props} />
        ),
        // 其他样式优化
        strong: ({node, ...props}) => <span className="text-hex-gold-light font-bold bg-hex-gold/10 px-1 rounded shadow-[0_0_5px_rgba(200,170,110,0.2)]" {...props} />,
        a: ({node, ...props}) => <a className="text-hex-blue hover:underline hover:text-hex-blue/80 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
        h1: ({node, ...props}) => <h1 className="text-xl font-bold text-hex-gold border-b border-hex-gold/20 pb-2 mb-4 mt-6 flex items-center gap-2" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-lg font-bold text-hex-blue mb-3 mt-5 flex items-center gap-2 before:content-[''] before:w-1 before:h-4 before:bg-hex-blue before:rounded-full before:mr-1" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-base font-bold text-slate-200 mb-2 mt-4" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 mb-4 marker:text-hex-gold" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 mb-4 marker:text-hex-blue" {...props} />,
        blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-hex-gold/50 pl-4 py-1 my-4 bg-hex-gold/5 italic text-slate-400 rounded-r" {...props} />,
        code: ({node, inline, className, children, ...props}) => {
             return inline ? 
                <code className="bg-hex-black border border-hex-gold/20 px-1.5 py-0.5 rounded text-xs font-mono text-hex-blue" {...props}>{children}</code> :
                <pre className="bg-[#050508] border border-hex-gold/10 p-3 rounded-lg overflow-x-auto my-3 text-xs font-mono text-slate-300 scrollbar-thin" {...props}><code>{children}</code></pre>
        }
    };

    // 渲染加载态
    if (isAnalyzing) {
        return (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden group">
                {/* 动态扫描线 */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-hex-blue to-transparent animate-scan z-10"></div>
                <div className="absolute inset-0 bg-magic-pattern opacity-5 animate-pulse-slow"></div>
                
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-hex-blue blur-2xl opacity-20 animate-pulse"></div>
                        <Cpu size={64} className="text-hex-blue animate-spin-slow duration-[3s]" />
                        <Sparkles size={24} className="absolute -top-2 -right-2 text-hex-gold animate-bounce" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-hex-gold-light tracking-[0.2em] font-serif uppercase">
                            Tactical Analysis
                        </h3>
                        <p className="text-hex-blue/60 text-xs font-mono uppercase tracking-widest flex items-center gap-2 justify-center">
                            <Activity size={12} className="animate-pulse"/>
                            DeepSeek R1 Processing
                        </p>
                    </div>
                    <div className="w-72 h-32 overflow-hidden text-[10px] font-mono text-hex-blue/50 text-left bg-black/40 p-3 rounded border border-hex-blue/10 backdrop-blur-sm">
                        <TypewriterLogs />
                    </div>
                </div>
            </div>
        );
    }

    if (!aiResult) {
        return (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-600">
                <div className="w-20 h-20 rounded-full bg-hex-black border border-hex-gold/10 flex items-center justify-center mb-4 group hover:border-hex-gold/30 transition-all">
                    <Bot size={40} className="opacity-50 group-hover:text-hex-gold group-hover:opacity-100 transition-all" />
                </div>
                <p className="text-sm font-bold tracking-widest uppercase opacity-50">Awaiting Battle Data</p>
            </div>
        );
    }

    // 渲染 JSON 结构化数据
    if (isJson && parsedContent) {
        return (
            <div className="flex flex-col h-full">
                {/* 1. 核心简报 Banner */}
                <div className="mb-6 p-[1px] bg-gradient-to-r from-hex-gold/0 via-hex-gold/40 to-hex-gold/0">
                    <div className="bg-gradient-to-r from-hex-dark/90 via-hex-black/90 to-hex-dark/90 p-5 flex items-start gap-5 backdrop-blur-md">
                        <div className="mt-1 p-3 bg-hex-gold/10 rounded-full border border-hex-gold/30 shadow-[0_0_15px_rgba(200,170,110,0.15)] shrink-0">
                            <Sparkles className="text-hex-gold" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-hex-gold font-bold text-lg mb-2 tracking-wide uppercase flex items-center gap-2">
                                {parsedContent.concise?.title || "Strategic Priority"}
                            </h3>
                            <p className="text-hex-gold-light text-base leading-relaxed font-medium">
                                {parsedContent.concise?.content}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleCopy} className="p-2 hover:bg-white/5 rounded text-slate-400 hover:text-hex-gold transition-colors">
                                {copied ? <Check size={16}/> : <Copy size={16}/>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. 详情 Tab 切换 */}
                {parsedContent.detailed_tabs && (
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Tab 导航 */}
                        <div className="flex gap-1 border-b border-hex-gold/20 mb-4 px-2">
                            {parsedContent.detailed_tabs.map((tab, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveTab(idx)}
                                    className={`px-5 py-3 text-sm font-bold tracking-wider transition-all relative top-[1px]
                                        ${activeTab === idx 
                                            ? 'text-hex-blue border-b-2 border-hex-blue bg-hex-blue/5 shadow-[0_-5px_10px_rgba(10,200,185,0.05)]' 
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-b-2 border-transparent'
                                        }`}
                                >
                                    {tab.title}
                                </button>
                            ))}
                        </div>
                        
                        {/* Tab 内容 */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
                            <div className="prose prose-invert max-w-none">
                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]} // 🟢 关键：启用表格支持
                                    components={HexMarkdownComponents}
                                >
                                    {parsedContent.detailed_tabs[activeTab]?.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 底部反馈 */}
                <div className="mt-4 pt-4 border-t border-hex-gold/10 flex justify-end">
                     <button 
                        onClick={() => setShowFeedbackModal(true)}
                        className="text-[10px] text-slate-600 hover:text-hex-gold flex items-center gap-1 transition-colors"
                     >
                        <AlertTriangle size={10} /> Report Analysis Issue
                     </button>
                </div>
            </div>
        );
    }

    // 兜底渲染 (流式文本)
    return (
        <div className="h-full p-4 overflow-y-auto custom-scrollbar font-sans text-sm leading-relaxed text-slate-300">
            <ReactMarkdown 
                remarkPlugins={[remarkGfm]} // 🟢 关键：启用表格支持
                components={HexMarkdownComponents}
            >
                {aiResult}
            </ReactMarkdown>
            <div ref={messagesEndRef} />
        </div>
    );
}

// 模拟终端日志组件
const TypewriterLogs = () => {
    const [logs, setLogs] = useState([]);
    const lines = [
        "Initializing Neural Link...",
        "Connecting to LCU Gateway...",
        "Fetching Matchup Data [S15 Patch]...",
        "Analyzing Team Composition...",
        "Calculating Win Conditions...",
        "Simulating Jungle Pathing...",
        "Optimizing Rune Vectors...",
        "Drafting Tactical Report..."
    ];

    useEffect(() => {
        let i = 0;
        const interval = setInterval(() => {
            if (i < lines.length) {
                setLogs(prev => [...prev, lines[i]]);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 600);
        return () => clearInterval(interval);
    }, []);

    return <div className="flex flex-col gap-1">{logs.map((l, i) => <div key={i} className="truncate">&gt; {l}</div>)}</div>;
};