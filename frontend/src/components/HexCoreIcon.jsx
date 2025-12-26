import React from 'react';

const HexCoreIcon = ({ className = "w-14 h-14" }) => (
  <svg 
    viewBox="0 0 512 512" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]`} // 外部青色辉光
  >
    <defs>
      {/* 1. 奥术深渊背景：中心亮 -> 青 -> 紫 -> 深黑 */}
      <radialGradient id="arcane_depth" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(256 256) scale(220)">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" /> {/* 奇点 */}
        <stop offset="0.2" stopColor="#22D3EE" /> {/* 海克斯青 */}
        <stop offset="0.5" stopColor="#818CF8" /> {/* 奥术紫 */}
        <stop offset="0.8" stopColor="#0F172A" /> {/* 虚空深蓝 */}
        <stop offset="1.0" stopColor="#000000" stopOpacity="0" />
      </radialGradient>

      {/* 2. 纹路渐变：青紫流动 */}
      <linearGradient id="rune_flow" x1="100" y1="100" x2="400" y2="400" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#22D3EE" />
        <stop offset="0.5" stopColor="#C084FC" />
        <stop offset="1" stopColor="#22D3EE" />
      </linearGradient>

      {/* 3. 核心高光滤镜 */}
      <filter id="core_bloom">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* --- 1. 能量球体基底 --- */}
    <circle cx="256" cy="256" r="180" fill="url(#arcane_depth)" opacity="0.9" />

    {/* --- 2. 内部复杂回路 (The Circuits) --- */}
    <g opacity="0.8">
        {/* 核心螺旋线：模拟魔法流 */}
        <path d="M256 256 m-60 0 a 60 60 0 1 1 120 0 a 60 60 0 1 1 -120 0" 
              stroke="url(#rune_flow)" strokeWidth="2" fill="none" 
              strokeDasharray="10 5 2 5" transform="rotate(45 256 256)" />
        
        <path d="M256 256 m-90 0 a 90 90 0 1 0 180 0 a 90 90 0 1 0 -180 0" 
              stroke="url(#rune_flow)" strokeWidth="1.5" fill="none" 
              strokeDasharray="40 20" transform="rotate(-30 256 256)" opacity="0.6"/>
        
        {/* 交错的几何连线：模拟神经网络/魔法阵 */}
        <path d="M256 130 L320 180 L320 332 L256 382 L192 332 L192 180 Z" 
              stroke="#A5F3FC" strokeWidth="1" fill="none" opacity="0.4" />
        
        <path d="M256 130 L256 220 M320 180 L280 240 M320 332 L280 272 M256 382 L256 292 M192 332 L232 272 M192 180 L232 240" 
              stroke="#A5F3FC" strokeWidth="1" opacity="0.3" />
    </g>

    {/* --- 3. 核心符文节点 (Active Runes) --- */}
    <g filter="url(#core_bloom)">
        {/* 悬浮的主符文环 */}
        <ellipse cx="256" cy="256" rx="130" ry="130" 
                 stroke="#22D3EE" strokeWidth="2" strokeDasharray="4 8 20 8" strokeLinecap="round" 
                 transform="rotate(90 256 256)" opacity="0.8" />
        
        <ellipse cx="256" cy="256" rx="140" ry="60" 
                 stroke="#C084FC" strokeWidth="2" strokeDasharray="10 30" strokeLinecap="round" 
                 transform="rotate(-45 256 256)" opacity="0.7" />

        <ellipse cx="256" cy="256" rx="140" ry="60" 
                 stroke="#22D3EE" strokeWidth="2" strokeDasharray="50 50" strokeLinecap="round" 
                 transform="rotate(45 256 256)" opacity="0.7" />
    </g>

    {/* --- 4. 能量粒子与火花 (Sparkles) --- */}
    <circle cx="256" cy="256" r="8" fill="#FFFFFF" filter="url(#core_bloom)" />
    <circle cx="360" cy="220" r="3" fill="#A5F3FC" opacity="0.8" />
    <circle cx="150" cy="300" r="2" fill="#C084FC" opacity="0.8" />
    <rect x="254" y="100" width="4" height="20" fill="#22D3EE" opacity="0.6" />
    <rect x="254" y="392" width="4" height="20" fill="#818CF8" opacity="0.6" />

  </svg>
);

export default HexCoreIcon;