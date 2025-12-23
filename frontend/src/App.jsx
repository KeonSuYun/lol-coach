import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { 
  RefreshCw, Activity, AlertTriangle, Search, X, 
  Shield, Zap, Brain, Crosshair, Globe, Dna, Layout, Sword,
  FileText, Users, ThumbsUp, Plus, MessageSquare, Send,
  Trash2, Lock, Unlock, Sparkles, Map, BookOpen, AlertOctagon, MonitorDown, Link, Unplug
} from 'lucide-react';

// ================= 配置区域 =================
// 🟢 后端地址 (Python)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
// 🟢 Sealos AI 地址
const SEALOS_API_URL = "https://<你的APPID>.laf.run/analyze"; 
// 🟢 本地 Bridge 地址
const BRIDGE_WS_URL = "ws://127.0.0.1:29150";

// 数据源：使用 DataDragon 以支持更丰富的数据显示
const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";

// 角色配置
const ROLES = [
  { id: 'TOP', label: '上单', icon: '🛡️', color: 'text-gray-400', bg: 'from-gray-500/20 to-gray-600/5' },
  { id: 'JUNGLE', label: '打野', icon: '🌿', color: 'text-green-400', bg: 'from-green-500/20 to-green-600/5' },
  { id: 'MIDDLE', label: '中单', icon: '🔮', color: 'text-red-400', bg: 'from-red-500/20 to-red-600/5' },
  { id: 'BOTTOM', label: '射手', icon: '🏹', color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/5' },
  { id: 'UTILITY', label: '辅助', icon: '❤️', color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-600/5' },
];

// ================= 组件 =================

const ChampCard = ({ champ, idx, isEnemy, userSlot, onSelectMe }) => {
  const isEmpty = !champ;
  const isMe = !isEnemy && idx === userSlot;

  return (
    <div className={`relative flex items-center gap-3 p-2.5 mb-2 rounded-lg border transition-all cursor-pointer group select-none backdrop-blur-sm
      ${isEnemy 
          ? 'bg-red-950/20 border-red-500/10 hover:border-red-500/40' 
          : isMe 
              ? 'bg-gradient-to-r from-amber-900/40 to-yellow-900/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
              : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}`}>
      
      {isMe && <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-500 rounded-r shadow-[0_0_10px_#f59e0b]"></div>}

      <div className={`w-12 h-12 rounded-lg bg-black overflow-hidden border relative shrink-0 transition-colors
          ${isEmpty ? 'border-slate-800' : isEnemy ? 'border-red-900/50' : isMe ? 'border-amber-500' : 'border-slate-700'}`}>
        {!isEmpty ? (
          <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover scale-110 group-hover:scale-125 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-700"><Search size={18} /></div>
        )}
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className={`text-sm font-bold truncate ${isEmpty ? 'text-slate-600 italic' : 'text-slate-200'}`}>
              {isEmpty ? '等待选择...' : champ.name}
          </div>
          {!isEmpty && <div className="text-[10px] text-slate-500 truncate">{champ.title}</div>}
      </div>

      {!isEnemy && (
           <div onClick={(e) => { e.stopPropagation(); onSelectMe(idx); }}
                className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide transition-all border cursor-pointer
                ${isMe ? 'bg-amber-600 border-amber-500 text-white shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-800'}`}>
               {isMe ? 'ME' : 'SET'}
           </div>
      )}
    </div>
  );
};

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

// ================= 主应用 =================
export default function App() {
  // --- 基础状态 ---
  const [version, setVersion] = useState("V15.1"); 
  const [championList, setChampionList] = useState([]);
  
  const [blueTeam, setBlueTeam] = useState(Array(5).fill(null));
  const [redTeam, setRedTeam] = useState(Array(5).fill(null));
  
  const [userRole, setUserRole] = useState('TOP'); 
  const [userSlot, setUserSlot] = useState(0); 
  
  const [lcuStatus, setLcuStatus] = useState("disconnected");

  // --- AI & 视图状态 ---
  const [aiResult, setAiResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeType, setAnalyzeType] = useState(""); 
  const [viewMode, setViewMode] = useState('detailed');
  const [activeTab, setActiveTab] = useState(0);

  // --- 社区状态 ---
  const [tips, setTips] = useState([]);
  const [showTipModal, setShowTipModal] = useState(false);
  const [newTipContent, setNewTipContent] = useState("");
  const [tipTargetEnemy, setTipTargetEnemy] = useState(null);
  
  // 用户ID
  const userId = useMemo(() => {
      let id = localStorage.getItem("temp_user_id");
      if(!id) { id = "user_" + Math.random().toString(36).substr(2, 9); localStorage.setItem("temp_user_id", id); }
      return id;
  }, []);

  // 1. 初始化数据 (DataDragon)
  useEffect(() => {
    const initData = async () => {
      try {
        const vRes = await fetch(`${DDRAGON_BASE}/api/versions.json`);
        const versions = await vRes.json();
        setVersion(versions[0]);

        const cRes = await fetch(`${DDRAGON_BASE}/cdn/${versions[0]}/data/zh_CN/championFull.json`);
        const cData = await cRes.json();
        
        const list = Object.values(cData.data).map(c => ({
             id: c.key, // 这里的 key 是数字ID (字符串格式)
             key: c.id, // 这里的 id 是英文名
             name: c.name,
             title: c.title,
             tags: c.tags,
             image_url: `${DDRAGON_BASE}/cdn/${versions[0]}/img/champion/${c.id}.png`,
        }));
        setChampionList(list);
      } catch (e) { console.error("Data init failed", e); }
    };
    initData();
  }, []);

  // 2. 🔌 连接 Bridge (自动同步)
  useEffect(() => {
      let ws;
      let timer;
      const connect = () => {
          ws = new WebSocket(BRIDGE_WS_URL);
          ws.onopen = () => { setLcuStatus("connected"); console.log("Bridge connected"); };
          ws.onclose = () => { setLcuStatus("disconnected"); timer = setTimeout(connect, 3000); };
          ws.onmessage = (event) => {
              try {
                  const msg = JSON.parse(event.data);
                  if (msg.type === 'CHAMP_SELECT') handleLcuUpdate(msg.data);
                  if (msg.type === 'STATUS' && msg.data === 'connected') setLcuStatus("connected");
              } catch(e){}
          };
      };
      connect();
      return () => { if(ws) ws.close(); clearTimeout(timer); };
  }, [championList]);

  // 处理 LCU 数据
  const handleLcuUpdate = (session) => {
      if (!session || championList.length === 0) return;
      const mapTeam = (teamArr) => {
          const result = Array(5).fill(null);
          teamArr.forEach(p => {
              const idx = p.cellId % 5; 
              if (p.championId && p.championId !== 0) {
                  const hero = championList.find(c => c.id == p.championId); // 匹配数字ID
                  if (hero) result[idx] = hero;
              }
          });
          return result;
      };
      setBlueTeam(mapTeam(session.myTeam));
      setRedTeam(mapTeam(session.theirTeam));
      
      const localPlayer = session.myTeam.find(p => p.cellId === session.localPlayerCellId);
      if (localPlayer) setUserSlot(localPlayer.cellId % 5);
  };

  // 3. 获取绝活 (Python 后端)
  const fetchTips = async () => {
      const myHero = blueTeam[userSlot]?.name;
      if (!myHero) return;
      
      try {
        const res = await axios.get(`${API_BASE_URL}/tips`, {
            params: { hero: myHero, enemy: "general", is_general: true } // 简化逻辑，先取通用
        });
        setTips(res.data);
      } catch (e) { console.error("Backend Error", e); }
  };

  useEffect(() => { fetchTips(); }, [blueTeam[userSlot]]);

  // 4. 发布绝活
  const handleSubmitTip = async () => {
      if (!newTipContent.trim() || !blueTeam[userSlot]) return;
      try {
        await axios.post(`${API_BASE_URL}/tips`, {
            hero: blueTeam[userSlot].name,
            enemy: tipTargetEnemy || "general",
            content: newTipContent,
            author_id: userId,
            is_general: !tipTargetEnemy
        });
        setNewTipContent("");
        setShowTipModal(false);
        fetchTips();
      } catch(e) { alert("发布失败，请检查后端是否启动"); }
  };

  const handleLike = async (tipId) => {
      try { await axios.post(`${API_BASE_URL}/like`, { tip_id: tipId, user_id: userId }); fetchTips(); } catch(e){}
  };

  // 5. AI 分析 (模拟不同模式)
  const handleAnalyze = async (mode) => {
      setAnalyzeType(mode);
      setIsAnalyzing(true);
      setAiResult(null);

      // 这里应该调用 Python 后端或者 Sealos
      // 为了演示，我们先用一个模拟的 Sealos 调用逻辑
      const payload = {
          mode: mode,
          myHero: blueTeam[userSlot]?.name || "未知",
          myTeam: blueTeam.map(c => c?.name || "未选"),
          enemyTeam: redTeam.map(c => c?.name || "未选"),
          userRole: userRole
      };

      try {
          const res = await axios.post(SEALOS_API_URL, { data: payload });
          setAiResult(res.data.data); // 假设返回结构 { concise:..., detailed_tabs:... }
      } catch (e) {
          // 容错模拟数据，让你看到界面效果
          setTimeout(() => {
             setAiResult({
                 concise: { title: "快速分析", content: "当前阵容优势在于中期团战..." },
                 detailed_tabs: [
                     { title: "对线技巧", content: "注意敌方打野动向，3级前保持压制..." },
                     { title: "团战思路", content: "优先处理敌方后排，保护我方C位..." },
                     { title: "出装推荐", content: "核心装备：星蚀、黑切..." }
                 ]
             });
             setIsAnalyzing(false);
          }, 1500);
      }
  };

  // 渲染内容辅助函数
  const getRenderContent = () => {
    if (!aiResult) return "";
    return viewMode === 'concise' 
        ? (aiResult.concise?.content || "暂无简报") 
        : (aiResult.detailed_tabs?.[activeTab]?.content || "暂无详情");
  };

  return (
    <div className="min-h-screen bg-[#050508] text-slate-300 font-sans p-2 md:p-6 flex flex-col items-center">
      
      {/* 顶部 Header */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-800/60 pb-6">
        <div>
            <h1 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tighter flex items-center gap-2">
                HEX<span className="text-amber-500">COACH</span>
            </h1>
            <div className="flex items-center gap-3 mt-2 text-xs font-mono text-slate-500">
                 <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${lcuStatus==='connected' ? 'border-green-500/30 bg-green-900/20 text-green-400' : 'border-red-500/30 bg-red-900/20 text-red-400'}`}>
                    {lcuStatus==='connected' ? <Link size={10}/> : <Unplug size={10}/>}
                    <span>{lcuStatus==='connected' ? "CLIENT CONNECTED" : "WAITING FOR CLIENT..."}</span>
                 </div>
                 <span>|</span>
                 <span>{version}</span>
            </div>
        </div>
        
        {/* 角色选择栏 */}
        <div className="flex p-1 bg-slate-900/80 rounded-xl border border-slate-800">
            {ROLES.map(r => (
                <button key={r.id} onClick={() => setUserRole(r.id)} 
                    className={`relative px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2
                    ${userRole===r.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
                    <span>{r.icon}</span>
                    <span className="hidden sm:inline">{r.label}</span>
                </button>
            ))}
        </div>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧：我方 */}
        <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 px-2">
                <Shield size={14} /> ALLY TEAM
            </div>
            {blueTeam.map((c, i) => (
                <ChampCard key={i} champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} />
            ))}
            
            {/* 移动端显示的分析按钮 */}
            <div className="lg:hidden grid grid-cols-3 gap-2 mt-4">
                <AnalysisButton mode="bp" activeColor="purple" icon={<Users size={20}/>} label="BP推荐" desc="实时数据" onClick={() => handleAnalyze('bp')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
                <AnalysisButton mode="personal" activeColor="amber" icon={<Zap size={20}/>} label="王者私教" desc="对线博弈" onClick={() => handleAnalyze('personal')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
                <AnalysisButton mode="team" activeColor="cyan" icon={<Brain size={20}/>} label="职业教练" desc="战术运营" onClick={() => handleAnalyze('team')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
            </div>
        </div>
        
        {/* 中间：分析控制台 */}
        <div className="lg:col-span-6 flex flex-col gap-4 h-[calc(100vh-200px)] lg:h-[750px]">
            
            {/* 桌面端：三个大按钮 (分组区块) */}
            <div className="hidden lg:grid grid-cols-3 gap-3">
                <AnalysisButton 
                    mode="bp" activeColor="purple" icon={<Users size={20}/>} label="BP 智能推荐" desc="阵容优劣分析" 
                    onClick={() => handleAnalyze('bp')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}
                />
                <AnalysisButton 
                    mode="personal" activeColor="amber" icon={<Zap size={20}/>} label="王者私教" desc="绝活对线指导" 
                    onClick={() => handleAnalyze('personal')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}
                />
                <AnalysisButton 
                    mode="team" activeColor="cyan" icon={<Brain size={20}/>} label="职业教练" desc="战队运营策略" 
                    onClick={() => handleAnalyze('team')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}
                />
            </div>

            {/* 分析结果显示框 */}
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
                    {/* Tabs */}
                    {aiResult && viewMode === 'detailed' && aiResult.detailed_tabs && (
                        <div className="flex gap-1">
                            {aiResult.detailed_tabs.map((tab, i) => (
                                <button key={i} onClick={() => setActiveTab(i)} className={`px-3 py-1 rounded text-xs font-bold ${activeTab===i?'bg-slate-800 text-white':'text-slate-500'}`}>{tab.title}</button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {aiResult ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{getRenderContent()}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                            {isAnalyzing ? <RefreshCw className="animate-spin text-blue-500" size={40}/> : <Activity size={64}/>}
                            <p className="font-mono text-sm">{isAnalyzing ? "NEURAL NETWORK COMPUTING..." : "SYSTEM READY"}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        {/* 右侧：敌方 + 绝活 */}
        <div className="lg:col-span-3 flex flex-col gap-4">
             <div className="flex flex-col gap-3">
                <div className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 px-2">
                    <Crosshair size={14} /> ENEMY TEAM
                </div>
                {redTeam.map((c, i) => (
                    <ChampCard key={i} champ={c} idx={i} isEnemy={true} userSlot={userSlot} />
                ))}
             </div>

             {/* 绝活社区 */}
             <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[300px]">
                <div className="bg-slate-950 p-3 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2 font-bold text-slate-300 text-xs">
                        <MessageSquare size={14} className="text-green-400"/> 社区绝活
                    </div>
                    <button onClick={() => setShowTipModal(true)} className="text-blue-400 hover:text-white"><Plus size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {tips.length > 0 ? tips.map(tip => (
                        <div key={tip.id} className="bg-slate-800 p-2 rounded text-xs text-slate-300 border border-transparent hover:border-slate-600">
                            <div className="flex justify-between mb-1 opacity-50 text-[10px]">
                                <span>VS {tip.enemy}</span>
                                <button onClick={() => handleLike(tip.id)} className="flex items-center gap-1 hover:text-red-400"><ThumbsUp size={10}/> {tip.liked_by?.length || 0}</button>
                            </div>
                            {tip.content}
                        </div>
                    )) : <div className="text-center text-slate-600 text-xs py-4">暂无数据</div>}
                </div>
             </div>
        </div>
      </div>

      {/* 发布弹窗 */}
      {showTipModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md">
                  <h3 className="text-white font-bold mb-4">分享绝活心得</h3>
                  <textarea 
                    className="w-full bg-black border border-slate-700 rounded p-3 text-white text-sm mb-4 h-32"
                    placeholder="分享你的对线技巧..."
                    value={newTipContent}
                    onChange={e => setNewTipContent(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowTipModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
                      <button onClick={handleSubmitTip} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500">发布</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}