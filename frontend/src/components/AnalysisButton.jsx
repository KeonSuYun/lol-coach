import React from 'react'; 
import { Search, ChevronRight, Swords, Brain } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../config/constants';

export default function AnalysisButton({ 
    selectedHero, 
    onOpenChampSelect, 
    onResult, 
    setLoading, 
    isAnalyzing,
    currentUser, 
    userRole 
}) {
    
    const handleAnalyze = async () => {
        if (!selectedHero) {
            toast.error("请先选择一个英雄！");
            onOpenChampSelect();
            return;
        }

        if (isAnalyzing) return;
        setLoading(true);
        onResult(""); 

        const token = localStorage.getItem("access_token");

        try {
            const payload = {
                hero_name: selectedHero.name,
                hero_key: selectedHero.key,
                lane: userRole || 'MID', 
                user_id: currentUser || "guest",
                model_type: "reasoner" 
            };

            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || `请求失败: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;
            let accumulatedText = "";

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    accumulatedText += chunk;
                    onResult(accumulatedText);
                }
            }
            
            toast.success("战术推演完成！");

        } catch (error) {
            console.error("Analysis failed:", error);
            const errMsg = error.message || "服务连接失败";
            toast.error(errMsg);
            onResult(prev => prev ? prev + `\n\n❌ **中断**: ${errMsg}` : `❌ **分析失败**: ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        // 🟢 调整 1：mb-10 (增加底部间距，给跳动的文字留出空间)
        <div className="w-full max-w-xl mx-auto relative group z-20 mb-6">
            
            {/* 背景光晕 */}
            <div className={`absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 ${isAnalyzing ? 'animate-pulse opacity-50' : ''}`}></div>
            
            <div className="relative flex h-14 md:h-16 bg-[#091428] border border-[#C8AA6E]/30 rounded-xl overflow-hidden shadow-2xl">
                
                {/* === 左侧：英雄选择区 === */}
                <button 
                    onClick={onOpenChampSelect}
                    className="w-[35%] h-full flex items-center justify-center gap-2 md:gap-3 bg-[#010A13]/80 border-r border-[#C8AA6E]/20 hover:bg-[#1a2332] transition-all relative overflow-hidden group/select"
                >
                    {selectedHero ? (
                        <>
                            <div className="relative w-8 h-8 md:w-10 md:h-10 rounded border border-[#C8AA6E]/50 shadow-lg overflow-hidden shrink-0 group-hover/select:scale-110 transition-transform">
                                <img src={selectedHero.image_url} alt={selectedHero.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                                <span className="text-xs text-slate-400 scale-90 origin-left">当前</span>
                                <span className="text-xs md:text-sm font-bold text-[#C8AA6E] truncate max-w-[60px] md:max-w-[80px] leading-tight">
                                    {selectedHero.name}
                                </span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded border border-dashed border-slate-600 flex items-center justify-center text-slate-500">
                                <Search size={16} />
                            </div>
                            <span className="text-xs font-bold text-slate-400">选择英雄</span>
                        </>
                    )}
                    {!selectedHero && <div className="absolute inset-0 bg-white/5 animate-pulse pointer-events-none"></div>}
                </button>

                {/* === 右侧：分析按钮 === */}
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
                    {isAnalyzing ? (
                        <>
                            <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm md:text-base font-bold tracking-widest animate-pulse">R1 推演中...</span>
                        </>
                    ) : (
                        <>
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
                            {selectedHero && (
                                <ChevronRight size={18} className="absolute right-4 opacity-50 animate-in slide-in-from-left-2 repeat-infinite duration-1000" />
                            )}
                        </>
                    )}
                    {selectedHero && !isAnalyzing && (
                        <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-[shimmer_2s_infinite]"></div>
                    )}
                </button>
            </div>
            
            {/* 底部小字提示 */}
            {!selectedHero && (
                // 🟢 调整 2：位置下移 (-bottom-10)，去除背景色和边框，只留红色发光文字
                <div className="absolute -bottom-8 left-0 w-full text-center z-10">
                    <span className="text-[10px] text-red-500 font-bold tracking-wider flex items-center justify-center gap-1 animate-bounce drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                        <Swords size={12}/> 请先点击左侧选择你的英雄
                    </span>
                </div>
            )}
        </div>
    );
}