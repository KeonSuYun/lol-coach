// src/components/UserGuide.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X, CheckCircle2, MousePointer2 } from 'lucide-react';

const GuideOverlay = ({ steps, isOpen, onClose, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isCalculated, setIsCalculated] = useState(false);

    // 监听窗口大小变化和步骤变化
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(0);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const updatePosition = () => {
            const step = steps[currentStep];
            if (!step) return;

            // 如果是 center 模式，不需要计算目标位置，直接跳过
            if (step.placement === 'center') {
                setTargetRect(null); 
                setIsCalculated(true);
                return;
            }

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
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                setTargetRect(null); 
                setIsCalculated(true); // 找不到元素也允许显示(居中兜底)
            }
        };

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

    // 🔥🔥🔥 [核心修复] 智能位置计算逻辑 🔥🔥🔥
    let tooltipStyle = {};

    if (step.placement === 'center') {
        // 强制居中模式
        tooltipStyle = {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px', // 稍微窄一点适应小窗口
            maxWidth: '90vw'
        };
    } else if (targetRect) {
        // 自动定位模式
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const cardHeight = 220; // 预估卡片高度
        
        let topPos;
        const spaceBelow = viewportHeight - targetRect.bottom;
        const spaceAbove = targetRect.top;

        // 1. 优先放下面
        if (spaceBelow > cardHeight + 20) {
            topPos = targetRect.bottom + 15;
        } 
        // 2. 否则放上面
        else if (spaceAbove > cardHeight + 20) {
            topPos = targetRect.top - cardHeight - 15;
        } 
        // 3. 实在放不下（比如窗口极小），强制卡在窗口内
        else {
            topPos = Math.max(10, viewportHeight - cardHeight - 10);
        }

        // 🔴 安全钳位：绝对不许超出屏幕顶部
        if (topPos < 10) topPos = 10;

        tooltipStyle = {
            top: topPos,
            left: Math.max(10, Math.min(targetRect.left, viewportWidth - 330)), // 防止右侧溢出
            width: '320px'
        };
    } else {
        // 兜底居中
        tooltipStyle = {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
        };
    }

    const handleNext = () => {
        if (isLast) {
            onComplete();
        } else {
            setIsCalculated(false);
            setCurrentStep(prev => prev + 1);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden font-sans">
            {/* 1. 全屏半透明遮罩 */}
            <div 
                className="absolute inset-0 bg-black/70 transition-all duration-300 ease-out"
                style={targetRect && step.placement !== 'center' ? {
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

            {/* 2. 高亮框 (仅在非居中模式下显示) */}
            {targetRect && step.placement !== 'center' && (
                <div 
                    className="absolute border-2 border-[#0AC8B9] rounded-lg shadow-[0_0_30px_rgba(10,200,185,0.5)] transition-all duration-300 ease-out pointer-events-none animate-pulse"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                    }}
                >
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white"></div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white"></div>
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white"></div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white"></div>
                </div>
            )}

            {/* 3. 说明卡片 */}
            <div 
                className={`absolute transition-all duration-300 ease-out ${isCalculated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={tooltipStyle}
            >
                <div className="bg-[#091428] border border-[#C8AA6E] rounded-xl shadow-2xl overflow-hidden relative">
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
        document.body
    );
};

export default GuideOverlay;