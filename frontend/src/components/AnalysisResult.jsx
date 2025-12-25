import React, { useMemo, useState, useEffect, useRef } from 'react';
import { RefreshCw, Lightbulb, Target, Swords, Brain, ShieldAlert, Eye, EyeOff, FileText, Layout } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// 🛠️ 智能解析器：同时兼容 JSON 和 纯文本
const parseHybridContent = (rawString) => {
    if (!rawString || typeof rawString !== 'string') return { mode: 'loading', data: null };
    
    // 1. 🧹 清洗数据 (去除 <think> 和 markdown 代码块标记)
    let cleanStr = rawString.replace(/<think>[\s\S]*?<\/think>/g, ""); // 去除思考过程
    cleanStr = cleanStr.replace(/```json/g, "").replace(/```/g, "").trim();

    // 2. 🕵️‍♀️ 尝试提取 JSON 结构
    // 先找找有没有 "detailed_tabs" 这个关键字段
    const hasJsonStructure = cleanStr.includes('"detailed_tabs"') || cleanStr.includes('"concise"');

    if (hasJsonStructure) {
        // --- 进入 JSON 解析模式 ---
        
        // 尝试提取 JSON 范围 (从第一个 { 到最后一个 })
        const firstOpen = cleanStr.indexOf('{');
        const lastClose = cleanStr.lastIndexOf('}');
        let jsonCandidate = cleanStr;
        if (firstOpen !== -1 && lastClose > firstOpen) {
            jsonCandidate = cleanStr.substring(firstOpen, lastClose + 1);
        } else if (firstOpen !== -1) {
            jsonCandidate = cleanStr.substring(firstOpen);
        }

        // 尝试 JSON.parse
        try {
            const parsed = JSON.parse(jsonCandidate);
            return { mode: 'json', data: parsed };
        } catch (e) {
            // JSON 不完整，尝试正则提取 (流式兼容)
        }

        // 正则提取逻辑
        const extractField = (source, key) => {
            const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`, 's'); 
            const match = source.match(regex);
            return match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : "";
        };

        const tabs = [];
        try {
            const tabsStart = cleanStr.indexOf('"detailed_tabs"');
            if (tabsStart !== -1) {
                const tabsStr = cleanStr.substring(tabsStart);
                const tabRegex = /{\s*"title"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"\s*,\s*"content"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/g;
                let match;
                while ((match = tabRegex.exec(tabsStr)) !== null) {
                    tabs.push({
                        title: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
                        content: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n')
                    });
                }
            }
        } catch (e) {}

        // 只要提取到了 Tabs，或者看起来像是 JSON，就认定为 JSON 模式
        if (tabs.length > 0 || cleanStr.trim().startsWith('{')) {
            return {
                mode: 'json',
                data: {
                    concise: {
                        title: extractField(cleanStr, "title") || "战术生成中...",
                        content: extractField(cleanStr, "content")
                    },
                    detailed_tabs: tabs
                }
            };
        }
    }

    // 3. 📝 降级处理：如果找不到 JSON 结构，且内容不为空，则视为纯 Markdown
    if (cleanStr.length > 0) {
        return { mode: 'markdown', data: cleanStr };
    }

    return { mode: 'loading', data: null };
};

const AnalysisResult = ({ aiResult, isAnalyzing, setShowFeedbackModal }) => {
    const [showDebug, setShowDebug] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const scrollRef = useRef(null);

    // 🧠 实时解析内容
    const { mode, data } = useMemo(() => parseHybridContent(aiResult), [aiResult]);

    // 自动滚动
    useEffect(() => {
        if (isAnalyzing && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [aiResult, isAnalyzing, activeTab, mode]);

    // 空状态
    if (mode === 'loading' && !isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                <Brain size={48} className="mb-4 text-slate-700" />
                <div className="text-sm">点击左侧按钮开始分析</div>
            </div>
        );
    }

    // =========================================================
    // 🎨 模式 A: 纯 Markdown 渲染 (当 AI 输出纯文本时)
    // =========================================================
    if (mode === 'markdown') {
        return (
            <div className="flex flex-col h-full bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-2xl overflow-hidden relative">
                {/* 顶部栏 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#2c2c33]/50">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className={isAnalyzing ? "text-amber-400 animate-pulse" : "text-blue-400"} />
                        <span className="text-xs font-bold tracking-wider text-slate-300">
                            {isAnalyzing ? "AI 正在撰写分析..." : "全文本报告"}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowDebug(!showDebug)} className="text-slate-500 hover:text-white"><Eye size={14}/></button>
                        <button onClick={() => setShowFeedbackModal(true)} className="text-slate-500 hover:text-white flex items-center gap-1 text-[10px]"><ShieldAlert size={12}/> 反馈</button>
                    </div>
                </div>
                {/* 内容区 */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="prose prose-invert max-w-none prose-headings:text-amber-400 prose-headings:font-bold prose-h2:text-xl prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2 prose-strong:text-white prose-blockquote:border-l-4 prose-blockquote:border-amber-500/50 prose-blockquote:bg-[#282830] prose-blockquote:py-2 prose-blockquote:px-4">
                        <ReactMarkdown>{data}</ReactMarkdown>
                        {isAnalyzing && <span className="inline-block w-2 h-5 bg-amber-500 ml-1 align-middle animate-pulse"></span>}
                    </div>
                </div>
                {showDebug && <DebugLayer content={aiResult} onClose={() => setShowDebug(false)} />}
            </div>
        );
    }

    // =========================================================
    // 🎨 模式 B: 结构化 JSON 渲染 (当 AI 输出 Tab 结构时)
    // =========================================================
    const concise = data?.concise || {};
    const tabs = data?.detailed_tabs || [];

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden relative">
            
            {/* 1. 顶部简述卡片 */}
            <div className="bg-[#232329]/90 backdrop-blur rounded-xl p-4 border border-white/10 shadow-lg shrink-0 transition-all group">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/30 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Lightbulb size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h2 className="text-lg font-bold text-slate-100 mb-1 leading-tight tracking-wide">
                                {concise.title || "生成中..."}
                            </h2>
                            <button onClick={() => setShowDebug(!showDebug)} className="text-slate-600 hover:text-amber-500 transition-colors">
                                {showDebug ? <EyeOff size={14}/> : <Eye size={14}/>}
                            </button>
                        </div>
                        <div className="text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-wrap break-words mt-2 opacity-90">
                             {concise.content}
                             {isAnalyzing && <span className="inline-block w-2 h-4 bg-amber-500 ml-1 animate-pulse align-middle"/>}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 详细 Tabs 区域 */}
            <div className="flex-1 bg-[#232329]/80 backdrop-blur rounded-xl border border-white/5 flex flex-col min-h-0 relative shadow-inner">
                {/* Tab 标题栏 */}
                <div className="flex border-b border-white/5 overflow-x-auto scrollbar-hide bg-[#2c2c33]/40">
                    <div className="flex items-center px-3 border-r border-white/5 text-slate-500">
                        <Layout size={14} />
                    </div>
                    {tabs.length > 0 ? tabs.map((tab, idx) => (
                        <button key={idx} onClick={() => setActiveTab(idx)}
                            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2
                                ${activeTab === idx 
                                    ? 'border-amber-500 text-amber-400 bg-amber-500/5' 
                                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}>
                            {idx === 0 && <Target size={14}/>}
                            {idx === 1 && <Swords size={14}/>}
                            {tab.title}
                        </button>
                    )) : (
                        <div className="px-5 py-3 text-xs text-slate-500 italic flex items-center gap-2">
                             {isAnalyzing && <RefreshCw size={12} className="animate-spin"/>}
                             {isAnalyzing ? "战术推演中..." : "等待数据..."}
                        </div>
                    )}
                </div>

                {/* Tab 内容区 */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-transparent">
                    {tabs[activeTab] ? (
                        <div className="prose prose-invert prose-sm max-w-none 
                            prose-headings:text-amber-400 prose-headings:font-bold prose-h3:text-lg prose-h3:border-l-4 prose-h3:border-amber-500 prose-h3:pl-3
                            prose-p:text-slate-300 prose-p:leading-7
                            prose-strong:text-white prose-strong:font-black prose-strong:bg-white/5 prose-strong:px-1 prose-strong:rounded
                            prose-li:text-slate-300 prose-ul:pl-5
                            prose-blockquote:border-l-4 prose-blockquote:border-blue-500/50 prose-blockquote:bg-[#282830] prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r prose-blockquote:text-slate-400
                        ">
                             <ReactMarkdown>{tabs[activeTab].content}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-2 opacity-50">
                           {!isAnalyzing && "暂无详细数据"}
                        </div>
                    )}
                </div>
                
                {/* 反馈功能栏 */}
                <div className="p-2 border-t border-white/5 flex justify-end bg-[#2c2c33]/40 rounded-b-xl">
                    <button onClick={() => setShowFeedbackModal(true)} className="text-[10px] text-slate-500 hover:text-red-300 flex items-center gap-1.5 px-2 py-1 transition-colors">
                        <ShieldAlert size={12}/> <span>内容有误？点击反馈</span>
                    </button>
                </div>
            </div>

            {showDebug && <DebugLayer content={aiResult} onClose={() => setShowDebug(false)} />}
        </div>
    );
};

// 简单的 Debug 浮层组件
const DebugLayer = ({ content, onClose }) => (
    <div className="absolute inset-0 bg-black/95 z-50 p-4 overflow-auto animate-in fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-red-400"><EyeOff/></button>
        <div className="text-xs text-slate-500 mb-2 font-bold">RAW DATA STREAM:</div>
        <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all border border-green-900/30 p-2 rounded bg-black/50">{content}</pre>
    </div>
);

export default AnalysisResult;