import React, { useMemo, useState, useEffect, useRef } from 'react';
import { RefreshCw, Lightbulb, Target, Swords, Brain, ShieldAlert, Eye, EyeOff, FileText, Layout, MessageSquarePlus, Copy, Check, Coffee } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { createPortal } from 'react-dom';

// 🛠️ 智能解析器 V2.3 (支持思考过程提取 + 定点截取版)
// 此解析器负责将 AI 返回的混合字符串解析为结构化数据
const parseHybridContent = (rawString) => {
    // 0. 基础校验
    if (!rawString || typeof rawString !== 'string') return { mode: 'loading', data: null, thought: "" };
    
    // 1. 🧠 提取思考过程 (DeepSeek 专属 <think> 标签)
    // DeepSeek 模型会在正式回答前输出 <think>...</think> 的思维链
    let thought = "";
    const thoughtMatch = rawString.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thoughtMatch) {
        thought = thoughtMatch[1].trim();
    }

    // 2. 🧹 清洗主体数据
    // 移除 <think> 标签，以免干扰 JSON 解析
    let cleanStr = rawString.replace(/<think>[\s\S]*?<\/think>/g, ""); 
    // 移除 markdown 代码块标记，只保留纯文本/JSON
    cleanStr = cleanStr.replace(/```json/g, "").replace(/```/g, "").trim();

    // 尝试直接解析完整 JSON (针对已完成的请求，这是最理想的情况)
    try {
        const parsed = JSON.parse(cleanStr);
        return { mode: 'json', data: parsed, thought };
    } catch (e) { }

    // 3. 🕵️‍♀️ 流式提取 (容错路径 - 处理 JSON 结构尚不完整的情况)
    // 只要字符串包含关键字段或以 '{' 开头，就尝试手动提取内容
    const hasJsonStructure = cleanStr.includes('"detailed_tabs"') || cleanStr.includes('"concise"');

    if (hasJsonStructure || cleanStr.startsWith('{')) {
        
        // --- A. 提取 Concise (黄色简报区域) ---
        let conciseObj = { title: "正在分析战局...", content: "" };
        
        const conciseStart = cleanStr.indexOf('"concise"');
        if (conciseStart !== -1) {
            // 找到 concise 区域的大括号起始点
            const braceStart = cleanStr.indexOf('{', conciseStart);
            if (braceStart !== -1) {
                // 1. 提取 Title 字段
                const titleMatch = cleanStr.substring(braceStart).match(/"title"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/);
                if (titleMatch) conciseObj.title = titleMatch[1];

                // 2. 提取 Content 字段
                const contentLabelRegex = /"content"\s*:\s*"/g;
                contentLabelRegex.lastIndex = braceStart;
                const contentMatch = contentLabelRegex.exec(cleanStr);
                
                if (contentMatch) {
                    const contentStart = contentMatch.index + contentMatch[0].length;
                    let contentEnd = -1;
                    
                    // 🛡️ 核心修复：寻找安全边界
                    // 优先找下一个字段 "detailed_tabs" 作为截止点，防止截取过多
                    const nextFieldIdx = cleanStr.indexOf('"detailed_tabs"', contentStart);
                    
                    if (nextFieldIdx !== -1) {
                        // 如果有下一个字段，内容一定在它之前结束
                        contentEnd = nextFieldIdx;
                        // 倒序回溯，去掉逗号、换行、右大括号、空格
                        while (contentEnd > contentStart && [',', '}', '\n', ' ', '\r', '\t'].includes(cleanStr[contentEnd - 1])) {
                            contentEnd--;
                        }
                        // 还要去掉末尾的引号
                        if (cleanStr[contentEnd - 1] === '"' && cleanStr[contentEnd - 2] !== '\\') {
                            contentEnd--;
                        }
                    } else {
                        // 如果还没生成到 detailed_tabs，尝试找当前字符串末尾的引号
                        for (let i = contentStart; i < cleanStr.length; i++) {
                            if (cleanStr[i] === '"' && cleanStr[i - 1] !== '\\') {
                                contentEnd = i; // 暂时标记，继续找，取最后一个闭合的
                            }
                        }
                        // 流式中：如果找不到明确的结束标志，直接截取到最后 (用户能看到正在打字的效果)
                        if (contentEnd === -1) contentEnd = cleanStr.length;
                    }

                    if (contentEnd !== -1 && contentEnd > contentStart) {
                        conciseObj.content = cleanStr.substring(contentStart, contentEnd);
                    } else {
                        conciseObj.content = cleanStr.substring(contentStart);
                    }
                    
                    // 清理转义字符 (将 \" 转回 ")
                    conciseObj.content = conciseObj.content
                        .replace(/\\"/g, '"')
                        .replace(/\\n/g, '\n')
                        .replace(/\\t/g, '\t');
                }
            }
        }

        // --- B. 提取 Detailed Tabs (详细标签页) ---
        const tabs = [];
        const detailedStart = cleanStr.indexOf('"detailed_tabs"');
        
        if (detailedStart !== -1) {
            const detailedStr = cleanStr.substring(detailedStart);
            
            // 循环提取每一个 Tab 对象
            const titleRegex = /"title"\s*:\s*"([^"]+)"/g;
            let titleMatch;
            
            while ((titleMatch = titleRegex.exec(detailedStr)) !== null) {
                const title = titleMatch[1];
                const titleEndIdx = titleRegex.lastIndex;
                
                // 提取对应的 Content
                const contentLabelRegex = /"content"\s*:\s*"/g;
                contentLabelRegex.lastIndex = titleEndIdx;
                const contentMatch = contentLabelRegex.exec(detailedStr);
                
                if (contentMatch) {
                    const contentStartIdx = contentMatch.index + contentMatch[0].length;
                    let endQuoteIdx = -1;
                    
                    // 寻找内容结束的引号
                    for (let i = contentStartIdx; i < detailedStr.length; i++) {
                        if (detailedStr[i] === '"' && detailedStr[i - 1] !== '\\') {
                            endQuoteIdx = i;
                            break;
                        }
                    }
                    
                    // 截取内容
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

        // 返回包含思考过程和主体数据的完整对象
        return { 
            mode: 'json', 
            data: { 
                concise: conciseObj, 
                detailed_tabs: tabs 
            }, 
            thought 
        };
    }

    // 4. 降级处理：如果不像 JSON，则作为纯 Markdown 显示
    if (cleanStr.length > 0) {
        return { mode: 'markdown', data: cleanStr, thought };
    }

    return { mode: 'loading', data: null, thought };
};

// 🟢 修改点：接收 sendChatTrigger 参数
const AnalysisResult = ({ aiResult, isAnalyzing, setShowFeedbackModal, handleRegenerate, setFeedbackContent, sendChatTrigger }) => {
    const [showDebug, setShowDebug] = useState(false);
    const [showThought, setShowThought] = useState(false); // 🟢 新增：控制思考过程是否展开
    const [activeTab, setActiveTab] = useState(0);
    const [teamCopied, setTeamCopied] = useState(false);
    const [selectionMenu, setSelectionMenu] = useState(null); 
    const scrollRef = useRef(null);

    // 使用 useMemo 缓存解析结果，避免重复计算
    const { mode, data, thought } = useMemo(() => parseHybridContent(aiResult), [aiResult]);

    // 🔄 自动滚动：当内容生成时，自动滚动到底部方便阅读
    useEffect(() => {
        if (isAnalyzing && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [aiResult, isAnalyzing, activeTab, mode]);

    // ✨✨✨ 新增：监听一键发送快捷键触发器 (复用复制逻辑) ✨✨✨
    useEffect(() => {
        // 只有当 trigger 变化(大于0) 且 有数据时执行
        if (sendChatTrigger > 0) {
            const content = data?.concise?.content || "";
            if (!content) return;
            
            // 🔥 复用 handleCopyToTeam 的核心清洗逻辑
            const cleanText = content
                .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '') // 去 Emoji
                .replace(/\*\*(.*?)\*\*/g, '$1') // 去加粗
                .replace(/#{1,6}\s/g, '') // 去标题符
                .replace(/\n{2,}/g, '\n') // 压缩换行
                .replace(/[ \t]+/g, ' ')  // 压缩空格
                .trim();
            
            const finalMsg = `${cleanText} (来自:海克斯教练)`;

            // 发送给 Electron 主进程
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('perform-send-chat', finalMsg);
                // 提示用户
                if(typeof toast !== 'undefined') toast.success("已发送到游戏聊天框");
            }
        }
    }, [sendChatTrigger, data]); // 依赖 sendChatTrigger 和 data

    // 🖱️ 文本选中监听：用于弹出“复制/反馈”菜单
    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                return;
            }
            const text = selection.toString().trim();
            if (!text) return;
            
            // 计算选区位置
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

        // 点击外部关闭菜单
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

    // 🟢 功能 A：纯复制选中内容
    const handleJustCopy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectionMenu && selectionMenu.text) {
            navigator.clipboard.writeText(selectionMenu.text).then(() => {
                if(typeof toast !== 'undefined') toast.success("已复制选中内容");
                setSelectionMenu(null);
                window.getSelection().removeAllRanges(); 
            });
        }
    };

    // 🟢 功能 B：复制并作为反馈内容 (自动填充)
    const handleSelectionFeedback = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectionMenu && selectionMenu.text) {
            navigator.clipboard.writeText(selectionMenu.text).then(() => {
                // ✨ 关键交互：调用父组件传入的 setFeedbackContent 方法
                // 这样打开反馈弹窗时，内容框里就已经填好了引用的文字
                if (typeof setFeedbackContent === 'function') {
                    setFeedbackContent(`> ${selectionMenu.text}\n\n`);
                }
                
                setShowFeedbackModal(true);
                setSelectionMenu(null);
                window.getSelection().removeAllRanges();
            });
        }
    };

    // 🟢 功能 C：复制战术给队友 (防屏蔽处理)
    const handleCopyToTeam = () => {
        const content = data?.concise?.content || "";
        if (!content) return;
        // 清洗 Emoji 和 Markdown 符号，防止游戏内显示乱码
        const cleanText = content
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/#{1,6}\s/g, '')
            .replace(/\n{2,}/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
        // 添加小尾巴，实现病毒式传播
        const finalMsg = `${cleanText} (来自:海克斯教练)`;
        navigator.clipboard.writeText(finalMsg).then(() => {
            setTeamCopied(true);
            if(typeof toast !== 'undefined') toast.success("复制成功！");
            setTimeout(() => setTeamCopied(false), 2000);
        }).catch(() => alert("复制失败，请手动复制"));
    };

    // 渲染：加载中状态
    if (mode === 'loading' && !isAnalyzing) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                <Brain size={48} className="mb-4 text-slate-700" />
                <div className="text-sm">点击左侧按钮开始分析</div>
            </div>
        );
    }

    // 悬浮菜单组件 (Portal 到 body，避免被 overflow 遮挡)
    const SelectionFloatingButton = () => {
        if (!selectionMenu) return null;
        return createPortal(
            <div 
                id="selection-toolbar"
                className="fixed z-[9999] transform -translate-x-1/2 -translate-y-full pb-2 animate-in fade-in zoom-in duration-200 pointer-events-auto" 
                style={{ top: selectionMenu.y, left: selectionMenu.x }}
            >
                <div className="flex items-center gap-1 bg-[#1a1a20] p-1 rounded-lg border border-slate-600/50 shadow-2xl backdrop-blur-md">
                    {/* 复制按钮 */}
                    <button 
                        onMouseDown={handleJustCopy} 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-xs font-bold whitespace-nowrap"
                        title="复制到剪贴板"
                    >
                        <Copy size={13} /> <span>复制</span>
                    </button>
                    
                    <div className="w-[1px] h-4 bg-slate-700"></div>

                    {/* 反馈按钮 */}
                    <button 
                        onMouseDown={handleSelectionFeedback} 
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors text-xs font-bold whitespace-nowrap"
                        title="引用此段内容进行反馈"
                    >
                        <MessageSquarePlus size={13} /> <span>反馈</span>
                    </button>
                </div>
                <div className="w-2 h-2 bg-[#1a1a20] border-r border-b border-slate-600/50 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
            </div>, document.body
        );
    };

    // 渲染：Markdown 纯文本模式 (兜底)
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
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar relative selection:bg-amber-500/30 selection:text-white">
                    <div className="prose prose-invert max-w-none prose-headings:text-amber-400 prose-headings:font-bold prose-strong:text-white prose-blockquote:border-l-4 prose-blockquote:border-amber-500/50 prose-blockquote:bg-[#282830] prose-blockquote:py-2 prose-blockquote:px-4">
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

    // 自定义 Markdown 组件 (优化表格显示)
    const HexMarkdownComponents = {
        table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-sm border border-hex-gold/20 shadow-lg"><table className="w-full text-left border-collapse bg-hex-black/50" {...props} /></div>,
        thead: ({node, ...props}) => <thead className="bg-gradient-to-r from-hex-dark to-hex-black border-b border-hex-gold/30" {...props} />,
        tbody: ({node, ...props}) => <tbody className="divide-y divide-hex-gold/5" {...props} />,
        tr: ({node, ...props}) => <tr className="hover:bg-hex-blue/5 transition-colors duration-200" {...props} />,
        th: ({node, ...props}) => <th className="px-4 py-3 text-xs font-bold text-hex-gold uppercase tracking-wider whitespace-nowrap" {...props} />,
        td: ({node, ...props}) => <td className="px-4 py-3 text-sm text-slate-300 leading-relaxed" {...props} />,
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden relative">
            {/* === 顶部：核心简报区域 === */}
            <div className="bg-[#232329]/90 backdrop-blur rounded-xl p-4 border border-white/10 shadow-lg shrink-0 transition-all group relative">
                {handleRegenerate && (
                    <button onClick={handleRegenerate} disabled={isAnalyzing} className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold border border-slate-600 bg-slate-800 text-slate-300 hover:text-white hover:border-amber-500 hover:bg-amber-500/10 transition-all z-10">
                        <RefreshCw size={12} className={isAnalyzing ? "animate-spin" : ""} /><span>{isAnalyzing ? "分析中..." : "重新分析"}</span>
                    </button>
                )}
                <div className="flex items-start gap-4">
                    {/* 🟢 灯泡图标交互优化：
                        1. 添加 onClick 事件，点击切换思考显示
                        2. 如果有 thought 内容，显示 cursor-pointer 和 hover 效果
                        3. 如果 showThought 为 true，灯泡高亮
                    */}
                    <div 
                        onClick={() => thought && setShowThought(!showThought)}
                        className={`
                            p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all duration-300
                            ${thought ? 'cursor-pointer hover:bg-amber-500/30 hover:scale-105' : 'opacity-80'}
                            ${showThought ? 'bg-amber-500/40 text-white shadow-[0_0_25px_rgba(245,158,11,0.5)]' : 'text-amber-400'}
                            ${isAnalyzing ? 'animate-pulse' : ''}
                        `}
                        title={thought ? "点击查看/隐藏深度思考过程" : "AI 正在分析..."}
                    >
                        <Lightbulb size={24} />
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold text-slate-100 leading-tight tracking-wide pr-24">{concise.title || "正在分析战局..."}</h2>
                        </div>
                        <div className="text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-wrap break-words opacity-90 mb-2 selection:bg-amber-500/30 selection:text-white">
                             {concise.content}
                             {isAnalyzing && !concise.content && <span className="inline-block w-2 h-4 bg-amber-500 ml-1 animate-pulse align-middle"/>}
                        </div>

                        {/* 🟢 深度思考过程显示区域 (折叠动画) */}
                        {thought && (
                            <div className={`mt-2 mb-3 overflow-hidden transition-all duration-300 ease-in-out ${showThought ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="bg-black/40 border-l-2 border-amber-500/50 p-3 rounded-r-lg text-[11px] font-mono text-slate-400 leading-relaxed italic animate-in fade-in slide-in-from-left-2">
                                    <div className="flex items-center gap-2 mb-1 text-amber-500/70 not-italic font-bold uppercase tracking-tighter">
                                        <Coffee size={10} /> 深度思考过程：
                                    </div>
                                    {thought}
                                    {isAnalyzing && <span className="inline-block w-1 h-3 bg-slate-600 ml-1 animate-pulse"/>}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end items-center gap-2 mt-3 pt-2 border-t border-white/5">
                            {/* 🟢 切换按钮：查看/收起思考过程 */}
                            {thought && (
                                <button 
                                    onClick={() => setShowThought(!showThought)} 
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-colors ${showThought ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-amber-400'}`}
                                >
                                    <Brain size={12} className={isAnalyzing && showThought ? "animate-bounce" : ""} />
                                    {showThought ? "收起思考" : "查看思考过程"}
                                </button>
                            )}
                            <div className="flex-1"></div>
                            
                            <button onClick={handleCopyToTeam} className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer select-none ${teamCopied ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-amber-500 hover:bg-amber-500/10'}`}>
                                {teamCopied ? <Check size={12}/> : <Copy size={12}/>}<span>{teamCopied ? '已复制' : '复制战术 (防屏蔽)'}</span>
                            </button>
                            <button onClick={() => setShowDebug(!showDebug)} className="text-slate-600 hover:text-amber-500 transition-colors p-1">{showDebug ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 底部：详细内容 Tabs 区域 === */}
            <div className="flex-1 bg-[#232329]/80 backdrop-blur rounded-xl border border-white/5 flex flex-col min-h-0 relative shadow-inner">
                {/* Tab 导航栏 */}
                <div className="flex border-b border-white/5 overflow-x-auto scrollbar-hide bg-[#2c2c33]/40">
                    <div className="flex items-center px-3 border-r border-white/5 text-slate-500"><Layout size={14} /></div>
                    {tabs.length > 0 ? tabs.map((tab, idx) => (
                        <button key={idx} onClick={() => setActiveTab(idx)} className={`px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === idx ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                            {idx === 0 && <Target size={14}/>}{idx === 1 && <Swords size={14}/>}{tab.title}
                        </button>
                    )) : (
                        <div className="px-5 py-3 text-xs text-slate-500 italic flex items-center gap-2">{isAnalyzing && <RefreshCw size={12} className="animate-spin"/>}{isAnalyzing ? "战术推演中..." : "等待数据..."}</div>
                    )}
                </div>
                
                {/* 内容显示区 */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-transparent relative selection:bg-amber-500/30 selection:text-white">
                    {tabs[activeTab] ? (
                        <div className="prose prose-invert prose-sm max-w-none prose-headings:text-amber-400 prose-headings:font-bold prose-h3:text-lg prose-h3:border-l-4 prose-h3:border-amber-500 prose-h3:pl-3 prose-p:text-slate-300 prose-p:leading-7 prose-strong:text-white prose-strong:font-black prose-strong:bg-white/5 prose-strong:px-1 prose-strong:rounded prose-li:text-slate-300 prose-ul:pl-5 prose-blockquote:border-l-4 prose-blockquote:border-blue-500/50 prose-blockquote:bg-[#282830] prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r prose-blockquote:text-slate-400">
                             <ReactMarkdown remarkPlugins={[remarkGfm]} components={HexMarkdownComponents}>{tabs[activeTab].content}</ReactMarkdown>
                        </div>
                    ) : <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-2 opacity-50">{!isAnalyzing && "暂无详细数据"}</div>}
                    <SelectionFloatingButton />
                </div>
                
                {/* 底部纠错按钮 */}
                <div className="p-2 border-t border-white/5 flex justify-end bg-[#2c2c33]/40 rounded-b-xl">
                    <button onClick={() => setShowFeedbackModal(true)} className="text-[10px] text-slate-500 hover:text-red-300 flex items-center gap-1.5 px-2 py-1 transition-colors"><ShieldAlert size={12}/> <span>内容有误？点击反馈</span></button>
                </div>
            </div>
            {showDebug && <DebugLayer content={aiResult} onClose={() => setShowDebug(false)} />}
        </div>
    );
};

// 调试图层组件
const DebugLayer = ({ content, onClose }) => (
    <div className="absolute inset-0 bg-black/95 z-50 p-4 overflow-auto animate-in fade-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-red-400"><EyeOff/></button>
        <div className="text-xs text-slate-500 mb-2 font-bold">RAW DATA STREAM:</div>
        <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all border border-green-900/30 p-2 rounded bg-black/50">{content}</pre>
    </div>
);

export default AnalysisResult;