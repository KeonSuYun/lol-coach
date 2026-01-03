// src/components/UserGuide.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X, CheckCircle2, MousePointer2 } from 'lucide-react';

const GuideOverlay = ({ steps, isOpen, onClose, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isCalculated, setIsCalculated] = useState(false);

    // 监听窗口大小变化和步骤变化，重新计算高亮位置
    useEffect(() => {
        if (!isOpen) return;

        const updatePosition = () => {
            const step = steps[currentStep];
            if (!step) return;

            const element = document.querySelector(step.target);
            if (element) {
                const rect = element.getBoundingClientRect();
                setTargetRect({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                    right: rect.right
                });
                setIsCalculated(true);
                
                // 自动滚动到目标位置
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // 如果找不到元素（可能在其他Tab），直接跳过或显示在屏幕中心
                setTargetRect(null); 
            }
        };

        // 稍微延迟一点，等待DOM渲染或者动画结束
        const timer = setTimeout(updatePosition, 100);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
            clearTimeout(timer);
        };
    }, [currentStep, isOpen, steps]);

    if (!isOpen) return null;

    const step = steps[currentStep];
    const isLast = currentStep === steps.length - 1;

    // 计算提示框的位置 (优先显示在下方，如果不够显示在上方)
    const tooltipStyle = targetRect ? {
        top: targetRect.bottom + 20 > window.innerHeight - 200 ? targetRect.top - 200 : targetRect.bottom + 20,
        left: Math.max(20, Math.min(targetRect.left, window.innerWidth - 340)), // 防止超出屏幕左右
    } : {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
    };

    const handleNext = () => {
        if (isLast) {
            onComplete();
        } else {
            setIsCalculated(false);
            setCurrentStep(prev => prev + 1);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden">
            {/* 1. 全屏半透明遮罩 (使用 clip-path 挖空) */}
            <div 
                className="absolute inset-0 bg-black/70 transition-all duration-300 ease-out"
                style={targetRect ? {
                    clipPath: `polygon(
                        0% 0%, 
                        0% 100%, 
                        ${targetRect.left}px 100%, 
                        ${targetRect.left}px ${targetRect.top}px, 
                        ${targetRect.right}px ${targetRect.top}px, 
                        ${targetRect.right}px ${targetRect.bottom}px, 
                        ${targetRect.left}px ${targetRect.bottom}px, 
                        ${targetRect.left}px 100%, 
                        100% 100%, 
                        100% 0%
                    )`
                } : {}}
            ></div>

            {/* 2. 高亮框边框 (带动画) */}
            {targetRect && (
                <div 
                    className="absolute border-2 border-[#0AC8B9] rounded-lg shadow-[0_0_30px_rgba(10,200,185,0.5)] transition-all duration-300 ease-out pointer-events-none animate-pulse"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                    }}
                >
                    {/* 装饰角标 */}
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white"></div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white"></div>
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white"></div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white"></div>
                </div>
            )}

            {/* 3. 说明卡片 */}
            <div 
                className={`absolute w-[320px] transition-all duration-300 ease-out ${isCalculated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={tooltipStyle}
            >
                <div className="bg-[#091428] border border-[#C8AA6E] rounded-xl shadow-2xl overflow-hidden relative">
                    {/* 顶部装饰条 */}
                    <div className="h-1 bg-gradient-to-r from-[#0AC8B9] to-[#C8AA6E]"></div>
                    
                    <div className="p-5">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-bold text-[#0AC8B9] uppercase tracking-wider bg-[#0AC8B9]/10 px-2 py-0.5 rounded border border-[#0AC8B9]/20">
                                Step {currentStep + 1} / {steps.length}
                            </span>
                            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            {step.icon || <MousePointer2 size={18} className="text-[#C8AA6E]"/>}
                            {step.title}
                        </h3>
                        
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">
                            {step.description}
                        </p>

                        <div className="flex justify-between items-center">
                            <button 
                                onClick={onClose}
                                className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2"
                            >
                                跳过教程
                            </button>
                            
                            <button 
                                onClick={handleNext}
                                className={`
                                    flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95
                                    ${isLast 
                                        ? 'bg-gradient-to-r from-[#0AC8B9] to-emerald-600 text-white hover:brightness-110' 
                                        : 'bg-[#C8AA6E] hover:bg-[#b59a62] text-[#091428]'}
                                `}
                            >
                                {isLast ? '开始体验' : '下一步'}
                                {isLast ? <CheckCircle2 size={16}/> : <ChevronRight size={16}/>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body // 🔥 修复点：添加 document.body 作为挂载目标
    );
};

export default GuideOverlay;