import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, Zap, Search, ChevronRight, Swords, Brain } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../config/constants';

// 假设我们有一个简单的 lane 映射，或者您可以从 props 传入 lane
const DEFAULT_LANE = 'MID'; 

export default function AnalysisButton({ 
    selectedHero, 
    onOpenChampSelect, 
    onResult, 
    setLoading, 
    isAnalyzing,
    currentUser, // 用于鉴权或记录
    userRole // 用于判断是否解锁高级模型
}) {
    
    // 处理分析请求
    const handleAnalyze = async () => {
        if (!selectedHero) {
            toast.error("请先选择一个英雄！");
            onOpenChampSelect();
            return;
        }

        if (isAnalyzing) return;

        setLoading(true);
        // 清空旧结果，给用户一种“重新开始”的感觉
        onResult(""); 

        try {
            // 构造请求数据 (根据您的后端 API 调整)
            const payload = {
                hero_name: selectedHero.name,
                hero_key: selectedHero.key,
                // 这里假设是对位分析，如果没有选敌方，可以留空或由后端处理
                // enemy_name: targetHero?.name, 
                lane: DEFAULT_LANE, 
                user_id: currentUser || "guest"
            };

            // 模拟 API 调用 (请替换为您真实的 endpoint)
            // const response = await axios.post(`${API_BASE_URL}/analyze`, payload);
            
            // 🟢 临时模拟流式输出效果 (如果您后端是流式的，请改用 EventSource 或 fetch stream)
            // 这里为了演示效果，使用 axios 请求
            const response = await axios.post(`${API_BASE_URL}/generate_tactics`, payload);
            
            // 假设后端直接返回 { result: "..." } 或直接是字符串
            const resultText = response.data.result || response.data;
            onResult(resultText);
            toast.success("战术分析完成！");

        } catch (error) {
            console.error("Analysis failed:", error);
            const errMsg = error.response?.data?.detail || "分析服务暂时不可用，请稍后重试";
            toast.error(errMsg);
            onResult(`❌ **分析失败**: ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto relative group z-20">
            {/* 背景光晕装饰 */}
            <div className={`absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 ${isAnalyzing ? 'animate-pulse opacity-50' : ''}`}></div>
            
            <div className="relative flex h-14 md:h-16 bg-[#091428] border border-hex-gold/30 rounded-xl overflow-hidden shadow-2xl">
                
                {/* === 左侧：英雄选择区 (35%) === */}
                <button 
                    onClick={onOpenChampSelect}
                    className="w-[35%] h-full flex items-center justify-center gap-2 md:gap-3 bg-[#010A13]/80 border-r border-hex-gold/20 hover:bg-[#1a2332] transition-all relative overflow-hidden group/select"
                >
                    {/* 选中英雄时的状态 */}
                    {selectedHero ? (
                        <>
                            <div className="relative w-8 h-8 md:w-10 md:h-10 rounded border border-hex-gold/50 shadow-lg overflow-hidden shrink-0 group-hover/select:scale-110 transition-transform">
                                <img src={selectedHero.image_url} alt={selectedHero.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                                <span className="text-xs text-slate-400 scale-90 origin-left">当前</span>
                                <span className="text-xs md:text-sm font-bold text-hex-gold truncate max-w-[60px] md:max-w-[80px] leading-tight">
                                    {selectedHero.name}
                                </span>
                            </div>
                        </>
                    ) : (
                        // 未选时的状态
                        <>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded border border-dashed border-slate-600 flex items-center justify-center text-slate-500">
                                <Search size={16} />
                            </div>
                            <span className="text-xs font-bold text-slate-400">选择英雄</span>
                        </>
                    )}
                    
                    {/* 只有没选人时才显示的提示光效 */}
                    {!selectedHero && <div className="absolute inset-0 bg-white/5 animate-pulse pointer-events-none"></div>}
                </button>

                {/* === 右侧：分析按钮 (65%) === */}
                <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !selectedHero}
                    className={`flex-1 h-full flex items-center justify-center gap-2 md:gap-3 transition-all relative overflow-hidden
                        ${!selectedHero 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                            : isAnalyzing
                                ? 'bg-blue-900/50 text-blue-300 cursor-wait'
                                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                        }
                    `}
                >
                    {/* 按钮内容 */}
                    {isAnalyzing ? (
                        <>
                            <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm md:text-base font-bold tracking-widest animate-pulse">R1 推演中...</span>
                        </>
                    ) : (
                        <>
                            {/* 这里的图标根据状态变化 */}
                            <div className={`p-1.5 rounded-full ${selectedHero ? 'bg-white/20' : 'bg-black/20'}`}>
                                <Brain size={18} className={selectedHero ? 'text-white' : 'text-slate-500'} />
                            </div>
                            
                            <div className="flex flex-col items-start">
                                <span className={`text-sm md:text-base font-black tracking-wider leading-none ${!selectedHero ? 'opacity-50' : ''}`}>
                                    {selectedHero ? "开始分析" : "准备就绪"}
                                </span>
                                {selectedHero && (
                                    <span className="text-[10px] font-mono opacity-80 scale-90 origin-left">
                                        START ENGINE
                                    </span>
                                )}
                            </div>
                            
                            {/* 箭头动画 */}
                            {selectedHero && (
                                <ChevronRight size={18} className="absolute right-4 opacity-50 animate-in slide-in-from-left-2 repeat-infinite duration-1000" />
                            )}
                        </>
                    )}

                    {/* 扫光特效 (仅在可用状态下显示) */}
                    {selectedHero && !isAnalyzing && (
                        <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-[shimmer_2s_infinite]"></div>
                    )}
                </button>
            </div>
            
            {/* 底部小字提示 */}
            {!selectedHero && (
                <div className="absolute -bottom-6 left-0 w-full text-center">
                    <span className="text-[10px] text-red-400 flex items-center justify-center gap-1 animate-bounce">
                        <Swords size={10}/> 请先点击左侧选择你的英雄
                    </span>
                </div>
            )}
        </div>
    );
}