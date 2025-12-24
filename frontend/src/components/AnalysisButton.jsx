import React from 'react';
import { RefreshCw } from 'lucide-react';

const AnalysisButton = ({ mode, icon, label, desc, activeColor, isAnalyzing, analyzeType, onClick }) => {
  const isActive = analyzeType === mode;
  const theme = {
      bp: { border: 'border-purple-500', bg: 'bg-purple-900/20', text: 'text-purple-400' },
      personal: { border: 'border-amber-500', bg: 'bg-amber-900/20', text: 'text-amber-400' },
      team: { border: 'border-cyan-500', bg: 'bg-cyan-900/20', text: 'text-cyan-400' }
  }[mode];

  return (
      <button 
          onClick={onClick} 
          disabled={isAnalyzing} 
          className={`flex-1 relative group overflow-hidden rounded-xl border p-3 md:p-4 text-left transition-all duration-300 transform active:scale-95
          ${isActive 
              ? `${theme.bg} ${theme.border} ring-1 ring-${activeColor}-500/50` 
              : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800 hover:border-slate-700'}`}
      >
          {isActive && <div className={`absolute inset-0 opacity-10 bg-${activeColor}-500 blur-xl`}></div>}
          
          <div className="flex items-start justify-between mb-2 relative z-10">
              <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800 ${isActive ? theme.text : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {isAnalyzing && isActive ? <RefreshCw className="animate-spin" size={20}/> : icon}
              </div>
              {isActive && <div className={`w-2 h-2 rounded-full bg-${activeColor}-500 shadow-[0_0_8px_currentColor] animate-pulse`} />}
          </div>
          
          <div className="relative z-10">
              <div className={`font-black text-sm md:text-base mb-0.5 uppercase tracking-wide ${isActive ? 'text-white' : 'text-slate-300'}`}>{label}</div>
              <div className="text-[10px] md:text-xs text-slate-500 leading-tight">{desc}</div>
          </div>
      </button>
  );
};

export default AnalysisButton;