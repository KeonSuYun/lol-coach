import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; // 👈 关键：引入 Portal 解决框选菜单被遮挡问题
import { RefreshCw, Lightbulb, Target, Swords, Brain, ShieldAlert, Eye, EyeOff, FileText, Layout, MessageSquarePlus, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';

// 🛠️ 智能解析器：同时兼容 JSON 和 纯文本
const parseHybridContent = (rawString) => {
    if (!rawString || typeof rawString !== 'string') return { mode: 'loading', data: null };
    
    // 1. 🧹 清洗数据 (去除 <think> 和 markdown 代码块标记)
    let cleanStr = rawString.replace(/<think>[\s\S]*?<\/think>/g, ""); // 去除思考过程
    cleanStr = cleanStr.replace(/```json/g, "").replace(/```/g, "").trim();

    // 2. 🕵️‍♀️ 尝试提取 JSON 结构
    const hasJsonStructure = cleanStr.includes('"detailed_tabs"') || cleanStr.includes('"concise"');

    if (hasJsonStructure) {
        // --- 进入 JSON 解析模式 ---
        const firstOpen = cleanStr.indexOf('{');
        const lastClose = cleanStr.lastIndexOf('}');
        let jsonCandidate = cleanStr;
        if (firstOpen !== -1 && lastClose > firstOpen) {
            jsonCandidate = cleanStr.substring(firstOpen, lastClose + 1);
        } else if (firstOpen !== -1) {
            jsonCandidate = cleanStr.substring(firstOpen);
        }

        try {
            const parsed = JSON.parse(jsonCandidate);
            return { mode: 'json', data: parsed };
        } catch (e) { }

        // 正则提取逻辑 (降级方案)
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

    if (cleanStr.length > 0) {
        return { mode: 'markdown', data: cleanStr };
    }

    return { mode: 'loading', data: null };
};

// 👇 注意这里：加入了 handleRegenerate 参数
const AnalysisResult = ({ aiResult, isAnalyzing, setShowFeedbackModal, handleRegenerate }) => {
    const [showDebug, setShowDebug] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [teamCopied, setTeamCopied] = useState(false); // 战术复制状态
    
    // 🖱️ 选中文本反馈状态
    const [selectionMenu, setSelectionMenu] = useState(null); 

    const scrollRef = useRef(null);

    // 🧠 实时解析内容
    const { mode, data } = useMemo(() => parseHybridContent(aiResult), [aiResult]);

    // 自动滚动
    useEffect(() => {
        if (isAnalyzing && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [aiResult, isAnalyzing, activeTab, mode]);

    // 🖱️ 监听选中文本事件
    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                setSelectionMenu(null);
                return;
            }

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

        document.addEventListener('mouseup', handleSelection);
        return () => document.removeEventListener('mouseup', handleSelection);
    }, []);

    const handleSelectionFeedback = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectionMenu && selectionMenu.text) {
            navigator.clipboard.writeText(selectionMenu.text).then(() => {
                setShowFeedbackModal(true);
                window.getSelection().removeAllRanges();
                setSelectionMenu(null);
            });
        }
    };

    // ==========================================
    // 📋 核心功能：复制战术给队友 (防封版)
    // ==========================================
    const handleCopyToTeam = () => {
        const content = data?.concise?.content || "";
        if (!content) return;

        // 🛡️ 核心修复：针对国服审查的“防封清洗”逻辑
        const cleanText = content
            // 1. 🛑 必须去掉 Emoji：这是国服判定“代练广告”的首要特征
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '')
            // 2. 去除 Markdown 加粗 (**重点**) -> 重点
            .replace(/\*\*(.*?)\*\*/g, '$1')
            // 3. 去除标题符号 (##)
            .replace(/#{1,6}\s/g, '')
            // 4. 处理换行：不再转为竖线，而是保留换行但压缩连续空行
            .replace(/\n{2,}/g, '\n')
            // 5. 去除行内多余空格
            .replace(/[ \t]+/g, ' ')
            .trim();

        // 3. ✨ 软广标识：保留品牌，但放在最后，且用更自然的语气
        const finalMsg = `${cleanText} (来自:海克斯教练)`;

        navigator.clipboard.writeText(finalMsg).then(() => {
            setTeamCopied(true);
            // 提示用户：已自动优化格式
            if(typeof toast !== 'undefined') toast.success("复制成功！已自动去除Emoji并优化排版");
            setTimeout(() => setTeamCopied(false), 2000);
        }).catch(() => {
            alert("复制失败，请手动复制");
        });
    };

    // 🔥 修复版：悬浮反馈按钮 (使用 Portal 强制置顶)
    const SelectionFloatingButton = () => {
        if (!selectionMenu) return null;
        
        // 使用 Portal 将按钮直接挂载到 body 上，避免被父容器 overflow:hidden 截断
        return createPortal(
            <div 
                className="fixed z-[9999] transform -translate-x-1/2 -translate-y-full pb-2 animate-in fade-in zoom-in duration-200 pointer-events-auto"
                style={{ top: selectionMenu.y, left: selectionMenu.x }}
            >
                <div className="relative group">
                    <button
                        onMouseDown={handleSelectionFeedback}
                        className="flex items-center gap-2 bg-slate-900 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xl border border-amber-500/50 hover:bg-amber-500 hover:text-slate-900 transition-all cursor-pointer whitespace-nowrap backdrop-blur-md"
                    >
                        <MessageSquarePlus size={14} />
                        <span>反馈选中内容</span>
                    </button>
                    {/* 下方的小三角箭头 */}
                    <div className="w-2 h-2 bg-slate-900 border-r border-b border-amber-500/50 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 group-hover:bg-amber-500 transition-colors"></div>
                </div>
            </div>,
            document.body // 👈 挂载目标
        );
    };

    if (mode === 'loading' && !isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                <Brain size={48} className="mb-4 text-slate-700" />
                <div className="text-sm">点击左侧按钮开始分析</div>
            </div>
        );
    }

    if (mode === 'markdown') {
        return (
            <div className="flex flex-col h-full bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#2c2c33]/50">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className={isAnalyzing ? "text-amber-400 animate-pulse" : "text-blue-400"} />
                        <span className="text-xs font-bold tracking-wider text-slate-300">
                            {isAnalyzing ? "AI 正在撰写分析..." : "全文本报告"}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowDebug(!showDebug)} className="text-slate-500 hover:text-white"><Eye size={14}/></button>
                        <button 
                            onClick={() => setShowFeedbackModal(true)} 
                            className="text-slate-500 hover:text-red-400 flex items-center gap-1 text-[10px] transition-colors"
                            title="如果发现有错误的地方，请复制内容反馈"
                        >
                            <ShieldAlert size={12}/> 纠错
                        </button>
                    </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                    <div className="prose prose-invert max-w-none prose-headings:text-amber-400 prose-headings:font-bold prose-h2:text-xl prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2 prose-strong:text-white prose-blockquote:border-l-4 prose-blockquote:border-amber-500/50 prose-blockquote:bg-[#282830] prose-blockquote:py-2 prose-blockquote:px-4">
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
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden relative">
            
            {/* 1. 顶部简述卡片 (包含复制按钮) */}
            <div className="bg-[#232329]/90 backdrop-blur rounded-xl p-4 border border-white/10 shadow-lg shrink-0 transition-all group relative">
                
                {/* 🔄 重新分析按钮 (右上角 - 绝对定位) */}
                {handleRegenerate && (
                    <button 
                        onClick={handleRegenerate}
                        disabled={isAnalyzing}
                        className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold border border-slate-600 bg-slate-800 text-slate-300 hover:text-white hover:border-amber-500 hover:bg-amber-500/10 transition-all z-10"
                        title="重新分析战局"
                    >
                        <RefreshCw size={12} className={isAnalyzing ? "animate-spin" : ""} />
                        <span>{isAnalyzing ? "分析中..." : "重新分析"}</span>
                    </button>
                )}

                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/30 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Lightbulb size={24} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold text-slate-100 leading-tight tracking-wide pr-24">
                                {concise.title || "生成中..."}
                            </h2>
                        </div>
                        <div className="text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-wrap break-words opacity-90">
                             {concise.content}
                             {isAnalyzing && <span className="inline-block w-2 h-4 bg-amber-500 ml-1 animate-pulse align-middle"/>}
                        </div>

                        {/* ⬇️⬇️⬇️ 按钮区域 (右下角 - 复制与Debug) ⬇️⬇️⬇️ */}
                        <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-white/5">
                            <button 
                                onClick={handleCopyToTeam}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer select-none
                                    ${teamCopied 
                                        ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-amber-500 hover:bg-amber-500/10'
                                    }`}
                                title="复制纯文本发给队友（自动去除Emoji以防屏蔽）"
                            >
                                {teamCopied ? <Check size={12}/> : <Copy size={12}/>}
                                <span>{teamCopied ? '已复制' : '复制战术 (防屏蔽)'}</span>
                            </button>
                            <button onClick={() => setShowDebug(!showDebug)} className="text-slate-600 hover:text-amber-500 transition-colors p-1">
                                {showDebug ? <EyeOff size={14}/> : <Eye size={14}/>}
                            </button>
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
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-transparent relative">
                    {tabs[activeTab] ? (
                        <div className="prose prose-invert prose-sm max-w-none 
                            prose-headings:text-amber-400 prose-headings:font-bold prose-h3:text-lg prose-h3:border-l-4 prose-h3:border-amber-500 prose-h3:pl-3
                            prose-p:text-slate-300 prose-p:leading-7
                            prose-strong:text-white prose-strong:font-black prose-strong:bg-white/5 prose-strong:px-1 prose-strong:rounded
                            prose-li:text-slate-300 prose-ul:pl-5
                            prose-blockquote:border-l-4 prose-blockquote:border-blue-500/50 prose-blockquote:bg-[#282830] prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r prose-blockquote:text-slate-400
                        ">
                             <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={HexMarkdownComponents}
                             >
                                {tabs[activeTab].content}
                             </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-2 opacity-50">
                           {!isAnalyzing && "暂无详细数据"}
                        </div>
                    )}
                    <SelectionFloatingButton />
                </div>
                
                {/* 反馈功能栏 */}
                <div className="p-2 border-t border-white/5 flex justify-end bg-[#2c2c33]/40 rounded-b-xl">
                    <button 
                        onClick={() => setShowFeedbackModal(true)} 
                        className="text-[10px] text-slate-500 hover:text-red-300 flex items-center gap-1.5 px-2 py-1 transition-colors"
                        title="如果发现有错误的地方，请复制内容反馈"
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