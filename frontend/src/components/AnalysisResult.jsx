import React, { useMemo, useState } from 'react';
import { RefreshCw, Lightbulb, Target, Swords, Brain, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// 🛠️ 强力脏 JSON 解析器
const tryParsePartialJson = (jsonString) => {
    if (!jsonString || typeof jsonString !== 'string') return null;
    
    // 1. 预处理：去掉 Markdown 代码块标记
    let cleanStr = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // 2. 尝试完美解析 (只有当流彻底结束且格式完美时才会成功)
    try {
        const parsed = JSON.parse(cleanStr);
        return parsed; // 完美解析直接返回
    } catch (e) {
        // console.log("JSON尚未闭合，转为正则提取...");
    }

    // 3. 🛡️ 正则暴力提取 (针对流式残缺数据)
    
    // A. 提取 Concise 部分
    // 使用非贪婪匹配，兼容换行符
    const extractField = (source, key) => {
        const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`, 's'); 
        const match = source.match(regex);
        return match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : "";
    };

    const conciseTitle = extractField(cleanStr, "title");
    const conciseContent = extractField(cleanStr, "content");

    // B. 提取 Detailed Tabs (数组部分)
    // 这是之前的盲区！我们需要从 unfinished JSON 中提取数组里的对象
    const tabs = [];
    try {
        // 1. 先截取 detailed_tabs 之后的内容
        const tabsStart = cleanStr.indexOf('"detailed_tabs"');
        if (tabsStart !== -1) {
            const tabsStr = cleanStr.substring(tabsStart);
            
            // 2. 循环匹配数组中的每个对象 { "title": "...", "content": "..." }
            // 正则解释：寻找成对的 title 和 content
            const tabRegex = /{\s*"title"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"\s*,\s*"content"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/g;
            
            let match;
            while ((match = tabRegex.exec(tabsStr)) !== null) {
                tabs.push({
                    title: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
                    content: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n')
                });
            }
        }
    } catch (e) {
        console.error("Tab解析失败", e);
    }

    // 4. 构建返回对象
    // 如果连正则都提取不到内容，直接把 cleanStr 当作内容显示，避免白屏
    const rawDisplay = cleanStr || "AI 数据接收中...";

    return {
        concise: {
            title: conciseTitle || (cleanStr.length > 10 ? "分析生成中..." : "等待响应..."),
            content: conciseContent || (tabs.length > 0 ? "" : rawDisplay) // 如果有 Tabs 了，简报为空也行；否则显示原文
        },
        detailed_tabs: tabs
    };
};

const AnalysisResult = ({ aiResult, isAnalyzing, viewMode, setViewMode, activeTab, setActiveTab, setShowFeedbackModal }) => {
    
    const [showDebug, setShowDebug] = useState(false);

    // 🧠 实时解析
    const parsedData = useMemo(() => tryParsePartialJson(aiResult), [aiResult]);
    
    const concise = parsedData?.concise || {};
    const tabs = parsedData?.detailed_tabs || [];
    
    // 只要有数据流进来，就显示面板
    const hasData = aiResult && aiResult.length > 0;
    const showPanel = isAnalyzing || hasData;

    if (!showPanel) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                <Brain size={48} className="mb-4 text-slate-700" />
                <div className="text-sm">点击左侧按钮开始分析</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden relative">
            
            {/* 1. 简报卡片 */}
            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/50 shadow-lg shrink-0 transition-all">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/30 shrink-0">
                        <Lightbulb size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h2 className="text-lg font-bold text-slate-100 mb-1 leading-tight">
                                {concise.title}
                            </h2>
                            {/* 调试开关小眼睛 */}
                            <button onClick={() => setShowDebug(!showDebug)} className="text-slate-600 hover:text-amber-500" title="查看原始数据">
                                {showDebug ? <EyeOff size={14}/> : <Eye size={14}/>}
                            </button>
                        </div>
                        <div className="text-sm text-slate-400 leading-relaxed font-mono whitespace-pre-wrap break-words">
                             {concise.content}
                             {isAnalyzing && <span className="inline-block w-2 h-4 bg-amber-500 ml-1 animate-pulse align-middle"/>}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 详细 Tabs */}
            <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col min-h-0 relative">
                
                {/* Tab 标题栏 */}
                <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-hide">
                    {tabs.length > 0 ? tabs.map((tab, idx) => (
                        <button key={idx} onClick={() => setActiveTab(idx)}
                            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2
                                ${activeTab === idx ? 'border-amber-500 text-amber-400 bg-amber-900/10' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            {idx === 0 && <Target size={14}/>}
                            {idx === 1 && <Swords size={14}/>}
                            {tab.title}
                        </button>
                    )) : (
                        // 如果还没有 Tab，显示占位提示
                        <div className="px-4 py-3 text-xs text-slate-600 italic flex items-center gap-2">
                             {isAnalyzing && <RefreshCw size={12} className="animate-spin"/>}
                             {isAnalyzing ? "正在生成详细战术..." : "等待数据..."}
                        </div>
                    )}
                </div>

                {/* Tab 内容区 */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0a0a0c]">
                    {tabs[activeTab] ? (
                        <div className="prose prose-invert prose-sm max-w-none prose-headings:text-amber-500 prose-strong:text-amber-100">
                             <ReactMarkdown>{tabs[activeTab].content}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-2">
                            {tabs.length === 0 && !isAnalyzing ? "未能解析出详细数据" : ""}
                        </div>
                    )}
                </div>
                
                <div className="p-2 border-t border-slate-800 flex justify-end">
                    <button onClick={() => setShowFeedbackModal(true)} className="text-[10px] text-slate-600 hover:text-slate-400 flex items-center gap-1">
                        <ShieldAlert size={12}/> 反馈
                    </button>
                </div>
            </div>

            {/* 3. 🔴 调试面板 (点击小眼睛显示) */}
            {showDebug && (
                <div className="absolute inset-0 bg-black/95 z-50 p-4 overflow-auto animate-in fade-in slide-in-from-bottom-10">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-red-500 font-bold text-xs">RAW DATA STREAM</span>
                        <button onClick={() => setShowDebug(false)} className="text-slate-400"><EyeOff size={16}/></button>
                    </div>
                    <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all border border-green-900 p-2 rounded">
                        {aiResult || "No Data"}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default AnalysisResult;