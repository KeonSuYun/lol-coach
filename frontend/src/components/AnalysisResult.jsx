import React from 'react';
import ReactMarkdown from 'react-markdown';
import { RefreshCw, Activity, Bug } from 'lucide-react';

const AnalysisResult = ({ 
  aiResult, isAnalyzing, viewMode, setViewMode, activeTab, setActiveTab, setShowFeedbackModal 
}) => {
  // 渲染逻辑内聚
  const renderContent = () => {
    if (!aiResult) return "";
    return viewMode === 'concise' 
        ? (aiResult.concise?.content || "暂无简报") 
        : (aiResult.detailed_tabs?.[activeTab]?.content || "暂无详情");
  };

  return (
    <div className="flex-1 bg-[#0c0c0e] border border-slate-800 rounded-2xl overflow-hidden relative flex flex-col shadow-2xl">
        {/* 状态栏 */}
        <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
                {aiResult && (
                    <>
                        <button onClick={() => setViewMode('concise')} className={`px-3 py-1 rounded text-xs font-bold ${viewMode==='concise'?'bg-amber-600 text-white':'text-slate-500'}`}>速读</button>
                        <button onClick={() => setViewMode('detailed')} className={`px-3 py-1 rounded text-xs font-bold ${viewMode==='detailed'?'bg-blue-600 text-white':'text-slate-500'}`}>深度</button>
                    </>
                )}
            </div>
            {/* Tabs + 纠错按钮 */}
            <div className="flex items-center gap-2">
                {aiResult && viewMode === 'detailed' && aiResult.detailed_tabs && (
                    <div className="flex gap-1">
                        {aiResult.detailed_tabs.map((tab, i) => (
                            <button key={i} onClick={() => setActiveTab(i)} className={`px-3 py-1 rounded text-xs font-bold ${activeTab===i?'bg-slate-800 text-white':'text-slate-500'}`}>{tab.title}</button>
                        ))}
                    </div>
                )}
                
                {aiResult && (
                    <button 
                        onClick={() => setShowFeedbackModal(true)}
                        className="ml-2 flex items-center gap-1 px-3 py-1 text-xs font-bold text-red-400 border border-red-900/50 rounded hover:bg-red-900/20 transition-colors"
                    >
                        <Bug size={14} /> 纠错
                    </button>
                )}
            </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {aiResult ? (
                <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{renderContent()}</ReactMarkdown>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                    {isAnalyzing ? <RefreshCw className="animate-spin text-blue-500" size={40}/> : <Activity size={64}/>}
                    <p className="font-mono text-sm">{isAnalyzing ? "NEURAL NETWORK COMPUTING..." : "SYSTEM READY"}</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default AnalysisResult;