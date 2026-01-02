import React from 'react';

const GlassCard = ({ children, className = "", onClick, highlight = false }) => (
    <div 
        onClick={onClick}
        className={`
            relative bg-[#091428]/80 backdrop-blur-md border 
            ${highlight ? 'border-[#C8AA6E] shadow-[0_0_20px_rgba(200,170,110,0.15)]' : 'border-white/5 hover:border-[#0AC8B9]/50'}
            transition-all duration-300 rounded-sm overflow-hidden group ${className}
            ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''}
        `}
    >
        {highlight && <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-[#C8AA6E]/20 to-transparent" />}
        {children}
    </div>
);

export default GlassCard;