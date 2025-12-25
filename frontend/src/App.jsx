import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Shield, Users, Zap, Brain, Crosshair, RefreshCcw, ShieldAlert, RotateCcw, Trash2, Activity } from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
import { API_BASE_URL, BRIDGE_WS_URL, DDRAGON_BASE } from './config/constants';

import Header from './components/Header';
import ChampCard from './components/ChampCard';
import AnalysisButton from './components/AnalysisButton';
import AnalysisResult from './components/AnalysisResult';
import CommunityTips from './components/CommunityTips';

import LoginModal from './components/modals/LoginModal';
import TipModal from './components/modals/TipModal';
import FeedbackModal from './components/modals/FeedbackModal';
import PricingModal from './components/modals/PricingModal'; 

const loadState = (key, defaultVal) => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) { return defaultVal; }
};

export default function App() {
  const [version, setVersion] = useState("V15.2"); 
  const [championList, setChampionList] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const [blueTeam, setBlueTeam] = useState(() => loadState('blueTeam', Array(5).fill(null)));
  const [redTeam, setRedTeam] = useState(() => loadState('redTeam', Array(5).fill(null)));
  
  const [myTeamRoles, setMyTeamRoles] = useState(() => loadState('myTeamRoles', Array(5).fill("")));
  
  const [userRole, setUserRole] = useState(() => loadState('userRole', '')); 
  const [lcuRealRole, setLcuRealRole] = useState(""); 

  const [userSlot, setUserSlot] = useState(0); 
  const [lcuStatus, setLcuStatus] = useState("disconnected");
  const [userRank, setUserRank] = useState(() => loadState('userRank', 'Gold'));
  
  const [enemyLaneAssignments, setEnemyLaneAssignments] = useState(() => 
      loadState('enemyLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
  );

  const [myLaneAssignments, setMyLaneAssignments] = useState(() => 
      loadState('myLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
  );

  const [useThinkingModel, setUseThinkingModel] = useState(() => loadState('useThinkingModel', false));
  const [aiResults, setAiResults] = useState(() => loadState('aiResults', { bp: null, personal: null, team: null }));
  const [analyzingStatus, setAnalyzingStatus] = useState({}); 
  const abortControllersRef = useRef({ bp: null, personal: null, team: null });
  const isModeAnalyzing = (mode) => !!analyzingStatus[mode];
  const [analyzeType, setAnalyzeType] = useState(() => loadState('analyzeType', 'bp')); 
  const [viewMode, setViewMode] = useState('detailed');
  const [activeTab, setActiveTab] = useState(0);

  const [tips, setTips] = useState([]);
  const [inputContent, setInputContent] = useState(""); 
  const [tipTargetEnemy, setTipTargetEnemy] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [accountInfo, setAccountInfo] = useState(null);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [rawLcuData, setRawLcuData] = useState(null);

  useEffect(() => { localStorage.setItem('blueTeam', JSON.stringify(blueTeam)); }, [blueTeam]);
  useEffect(() => { localStorage.setItem('redTeam', JSON.stringify(redTeam)); }, [redTeam]);
  useEffect(() => { localStorage.setItem('myTeamRoles', JSON.stringify(myTeamRoles)); }, [myTeamRoles]);
  useEffect(() => { localStorage.setItem('userRole', JSON.stringify(userRole)); }, [userRole]);
  useEffect(() => { localStorage.setItem('enemyLaneAssignments', JSON.stringify(enemyLaneAssignments)); }, [enemyLaneAssignments]);
  useEffect(() => { localStorage.setItem('myLaneAssignments', JSON.stringify(myLaneAssignments)); }, [myLaneAssignments]);
  useEffect(() => { localStorage.setItem('aiResults', JSON.stringify(aiResults)); }, [aiResults]);
  useEffect(() => { localStorage.setItem('analyzeType', JSON.stringify(analyzeType)); }, [analyzeType]);
  useEffect(() => { localStorage.setItem('useThinkingModel', JSON.stringify(useThinkingModel)); }, [useThinkingModel]);
  useEffect(() => { localStorage.setItem('userRank', userRank);}, [userRank]);
  
  const handleClearSession = () => {
      if(!confirm("确定要清空当前对局记录吗？")) return;
      const emptyTeam = Array(5).fill(null);
      setBlueTeam(emptyTeam); setRedTeam(emptyTeam);
      setMyTeamRoles(Array(5).fill(""));
      setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" });
      setMyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" });
      
      setAiResults({ bp: null, personal: null, team: null });
      localStorage.removeItem('blueTeam'); localStorage.removeItem('redTeam');
      localStorage.removeItem('myTeamRoles'); localStorage.removeItem('enemyLaneAssignments');
      localStorage.removeItem('myLaneAssignments'); 
      localStorage.removeItem('aiResults');
  };

  const authAxios = useMemo(() => {
      const instance = axios.create({ baseURL: API_BASE_URL });
      instance.interceptors.request.use(config => {
          if (token) config.headers.Authorization = `Bearer ${token}`;
          return config;
      });
      return instance;
  }, [token]);

  const fetchUserInfo = async () => {
      if (!token) return;
      try {
          const res = await authAxios.get('/users/me');
          setAccountInfo(res.data);
      } catch (e) {}
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("username");
    if (storedToken && storedUser) { setToken(storedToken); setCurrentUser(storedUser); }
    const initData = async () => {
      try {
        const vRes = await fetch(`${DDRAGON_BASE}/api/versions.json`);
        const versions = await vRes.json();
        setVersion(versions[0]);
        const cRes = await fetch(`${DDRAGON_BASE}/cdn/${versions[0]}/data/zh_CN/championFull.json`);
        const cData = await cRes.json();
        setChampionList(Object.values(cData.data).map(c => ({
             id: c.key, key: c.id, name: c.name, title: c.title, tags: c.tags,
             image_url: `${DDRAGON_BASE}/cdn/${versions[0]}/img/champion/${c.id}.png`,
        })));
      } catch (e) {}
    };
    initData();
  }, []);

  useEffect(() => { if (token) fetchUserInfo(); else setAccountInfo(null); }, [token]);

  useEffect(() => {
      let ws; let timer;
      const connect = () => {
          ws = new WebSocket(BRIDGE_WS_URL);
          ws.onopen = () => setLcuStatus("connected");
          ws.onclose = () => { 
              setLcuStatus("disconnected"); 
              setLcuRealRole(""); 
              timer = setTimeout(connect, 3000); 
          };
          ws.onmessage = (event) => {
              try {
                  const msg = JSON.parse(event.data);
                  if (msg.type === 'CHAMP_SELECT') setRawLcuData(msg.data);
                  if (msg.type === 'STATUS') {
                       if(msg.data === 'connected') setLcuStatus("connected");
                       else if(msg.data === 'disconnected') {
                           setLcuStatus("disconnected");
                           setLcuRealRole("");
                       }
                  }
              } catch(e){}
          };
      };
      connect(); return () => { if(ws) ws.close(); clearTimeout(timer); };
  }, []); 

  useEffect(() => { if (rawLcuData && championList.length > 0) handleLcuUpdate(rawLcuData); }, [rawLcuData, championList]);

  const handleLcuUpdate = (session) => {
      if (!session || championList.length === 0) return;
      const mapTeam = (teamArr) => {
          const result = Array(5).fill(null);
          teamArr.forEach(p => {
              const idx = p.cellId % 5; 
              if (p.championId && p.championId !== 0) {
                  const hero = championList.find(c => c.id == p.championId); 
                  if (hero) result[idx] = hero;
              }
          });
          return result;
      };
      const newBlue = mapTeam(session.myTeam);
      const newRed = mapTeam(session.theirTeam);
      if (newBlue.some(c => c !== null) || newRed.some(c => c !== null)) { setBlueTeam(newBlue); setRedTeam(newRed); }
      
      const roles = Array(5).fill(""); 
      const lcuRoleMap = { "TOP": "TOP", "JUNGLE": "JUNGLE", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUPPORT" };
      session.myTeam.forEach(p => {
          const idx = p.cellId % 5;
          const rawRole = p.assignedPosition?.toUpperCase();
          if (rawRole && lcuRoleMap[rawRole]) roles[idx] = lcuRoleMap[rawRole];
      });
      if (roles.some(r => r !== "")) setMyTeamRoles(roles);
      
      const localPlayer = session.myTeam.find(p => p.cellId === session.localPlayerCellId);
      if (localPlayer) {
          setUserSlot(localPlayer.cellId % 5);
          const assigned = localPlayer.assignedPosition?.toUpperCase();
          if (assigned && lcuRoleMap[assigned]) {
              const standardRole = lcuRoleMap[assigned];
              setUserRole(standardRole);      
              setLcuRealRole(standardRole);   
          }
      }
  };
  
  const guessRoles = (team) => {
    const roles = { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" };
    const assignedIndices = new Set(); 
    const findHero = (conditionFn) => {
        for (let i = 0; i < team.length; i++) {
            if (team[i] && !assignedIndices.has(i) && conditionFn(team[i])) {
                assignedIndices.add(i); return team[i].name;
            }
        }
        return "";
    };
    roles["SUPPORT"] = findHero(c => c.tags.includes("Support") || c.tags.includes("Tank"));
    roles["ADC"] = findHero(c => c.tags.includes("Marksman"));
    roles["MID"] = findHero(c => c.tags.includes("Mage") || c.tags.includes("Assassin"));
    roles["TOP"] = findHero(c => c.tags.includes("Fighter") || c.tags.includes("Tank"));
    roles["JUNGLE"] = findHero(c => true); 
    return roles;
  };
  
  useEffect(() => {
    if (redTeam.some(c => c !== null)) {
        const guesses = guessRoles(redTeam);
        setEnemyLaneAssignments(prev => {
            const next = { ...prev };
            const currentEnemies = redTeam.map(c => c?.name).filter(Boolean);
            Object.keys(guesses).forEach(role => {
                const currentAssignedName = prev[role];
                if (!currentAssignedName || !currentEnemies.includes(currentAssignedName)) {
                    if (guesses[role]) next[role] = guesses[role];
                }
            });
            return next;
        });
    }
  }, [redTeam]);

  const handleLogin = async () => {
      try {
          const formData = new FormData(); formData.append("username", authForm.username); formData.append("password", authForm.password);
          const res = await axios.post(`${API_BASE_URL}/token`, formData);
          setToken(res.data.access_token); setCurrentUser(res.data.username);
          localStorage.setItem("access_token", res.data.access_token); localStorage.setItem("username", res.data.username);
          setShowLoginModal(false); fetchUserInfo();
      } catch (e) { alert("登录失败"); }
  };
  const handleRegister = async () => {
      try { await axios.post(`${API_BASE_URL}/register`, authForm); alert("注册成功！请登录。"); setAuthMode("login"); } catch (e) { alert("注册失败"); }
  };
  const logout = () => {
      setToken(null); setCurrentUser(null); setAccountInfo(null);
      localStorage.removeItem("access_token"); localStorage.removeItem("username");
  };
  const fetchTips = async () => {
      if (!blueTeam[userSlot]) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/tips`, { params: { hero: blueTeam[userSlot].name, is_general: true } });
        setTips(res.data);
      } catch (e) {}
  };
  useEffect(() => { fetchTips(); }, [blueTeam[userSlot]]);
  
  const handlePostTip = async () => {
      if (!currentUser) return setShowLoginModal(true);
      if (!inputContent.trim()) return;
      try { await authAxios.post(`/tips`, { hero: blueTeam[userSlot].name, enemy: tipTargetEnemy || "general", content: inputContent, is_general: !tipTargetEnemy }); setInputContent(""); setShowTipModal(false); fetchTips(); } catch(e) {}
  };
  const handleLike = async (tipId) => {
      if (!currentUser) return setShowLoginModal(true);
      try { await authAxios.post(`/like`, { tip_id: tipId }); fetchTips(); } catch(e){}
  };
  const handleDeleteTip = async (tipId) => {
      if (!currentUser) return setShowLoginModal(true);
      if(!confirm("确定删除？")) return;
      try { await authAxios.delete(`/tips/${tipId}`); fetchTips(); } catch (e) {}
  };

  const handleTabClick = (mode) => {
      setAnalyzeType(mode); 
      if (!aiResults[mode] && !analyzingStatus[mode]) handleAnalyze(mode);
  };

  const handleAnalyze = async (mode, forceRestart = false) => {
    if (!token) { setAuthMode('login'); setShowLoginModal(true); return; }
    if (analyzingStatus[mode] && !forceRestart) return;

    if (abortControllersRef.current[mode]) abortControllersRef.current[mode].abort();
    const newController = new AbortController(); abortControllersRef.current[mode] = newController;

    setAnalyzingStatus(prev => ({ ...prev, [mode]: true }));
    setAiResults(prev => ({ ...prev, [mode]: null })); 

    const payloadAssignments = {};
    blueTeam.forEach((hero, idx) => {
        const roleMap = { "TOP": "TOP", "JUG": "JUNGLE", "JUNGLE": "JUNGLE", "MID": "MID", "ADC": "ADC", "BOTTOM": "ADC", "SUP": "SUPPORT", "SUPPORT": "SUPPORT" };
        const rawRole = myTeamRoles[idx];
        const standardRole = roleMap[rawRole] || rawRole;
        if (hero && standardRole) {
             payloadAssignments[standardRole] = hero.key;
        }
    });

    Object.keys(myLaneAssignments).forEach(role => {
        const heroName = myLaneAssignments[role];
        if (heroName) {
            const hero = blueTeam.find(h => h?.name === heroName);
            if (hero) payloadAssignments[role] = hero.key;
        }
    });

    let finalUserRole = lcuRealRole || userRole;
    const myHeroName = blueTeam[userSlot]?.name;
    if (myHeroName) {
         const manualRole = Object.keys(myLaneAssignments).find(r => myLaneAssignments[r] === myHeroName);
         if (manualRole) finalUserRole = manualRole;
    }

    try {
        const payload = {
            mode, 
            myHero: blueTeam[userSlot]?.key || "", 
            myTeam: blueTeam.map(c => c?.key || ""), 
            enemyTeam: redTeam.map(c => c?.key || ""),
            userRole: finalUserRole, 
            rank: userRank,
            myLaneAssignments: Object.keys(payloadAssignments).length > 0 ? payloadAssignments : null,
            enemyLaneAssignments: (() => {
                const clean = {};
                Object.keys(enemyLaneAssignments).forEach(k => {
                     const heroName = enemyLaneAssignments[k];
                     const heroObj = redTeam.find(c => c?.name === heroName);
                     if(heroObj) clean[k] = heroObj.key;
                });
                return Object.keys(clean).length > 0 ? clean : null;
            })(),
            model_type: useThinkingModel ? "reasoner" : "chat" 
        };

        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload),
            signal: newController.signal
        });

        if (!response.ok) { if (response.status === 401) { setShowLoginModal(true); throw new Error("登录过期"); } throw new Error(`请求失败: ${response.status}`); }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false; let accumulatedText = "";

        while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;
                setAiResults(prev => ({ ...prev, [mode]: accumulatedText }));
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') return;
        setAiResults(prev => ({ ...prev, [mode]: JSON.stringify({ concise: { title: "错误", content: error.message || "网络异常" } })}));
    } finally {
        if (abortControllersRef.current[mode] === newController) { setAnalyzingStatus(prev => ({ ...prev, [mode]: false })); fetchUserInfo(); }
    }
  };

  const handleReportError = async () => {
    if (!currentUser) return setShowLoginModal(true);
    try { await authAxios.post(`/feedback`, { match_context: { myHero: blueTeam[userSlot]?.name, mode: analyzeType }, description: inputContent }); alert("反馈已提交"); setShowFeedbackModal(false); setInputContent(""); } catch (e) {}
  };

  return (
    // ✨ 美化点：径向渐变深色背景
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a2a30] via-[#1a1a20] to-[#121214] text-slate-300 font-sans selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* 顶部微弱光效 */}
      <div className="fixed top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent z-50"></div>

      <div className="relative z-10 flex flex-col items-center p-2 md:p-6">
        
        <Header 
            version={version} lcuStatus={lcuStatus} 
            userRole={userRole} setUserRole={setUserRole} 
            currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
            useThinkingModel={useThinkingModel} setUseThinkingModel={setUseThinkingModel}
            setShowPricingModal={setShowPricingModal} accountInfo={accountInfo}
            userRank={userRank} setUserRank={setUserRank}  
        />

        <div className="w-full max-w-[1480px] mt-2 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            
            {/* --- 左侧：我方阵容 (Ally) --- */}
            <div className="lg:col-span-3 flex flex-col gap-4">
                {/* 容器美化：半透明 + 边框 */}
                <div className="bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#2c2c33]/50">
                        <div className="flex items-center gap-2">
                            <Shield size={16} className="text-blue-500" />
                            <span className="text-sm font-bold tracking-wider text-slate-200">ALLY TEAM</span>
                        </div>
                        <button onClick={handleClearSession} className="text-slate-500 hover:text-red-400 transition-colors" title="清空对局">
                            <Trash2 size={15}/>
                        </button>
                    </div>
                    
                    <div className="p-3 space-y-2">
                        {blueTeam.map((c, i) => (
                            <div key={i} className={`relative rounded-lg overflow-hidden transition-all ${userSlot === i ? 'bg-[#32323a] ring-1 ring-blue-500/50' : ''}`}>
                                <ChampCard champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} role={myTeamRoles[i]} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 己方分路面板 */}
                <div className="p-4 bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-blue-400"/>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">MY LANE</span>
                        </div>
                        <button onClick={() => setMyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-500 hover:text-white transition-colors">
                            <RefreshCcw size={12} />
                        </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                        {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => {
                            const lcuDefaultHero = blueTeam.find((_, i) => myTeamRoles[i] === role)?.name || "";
                            return (
                                <div key={role} className="flex flex-col gap-1">
                                    <label className="text-[9px] uppercase text-slate-500 text-center font-bold">{role.substring(0,3)}</label>
                                    <select 
                                        className={`w-full text-[10px] py-1.5 rounded-md bg-[#1a1a20] outline-none appearance-none text-center cursor-pointer transition-all hover:bg-[#25252b]
                                            ${myLaneAssignments[role] 
                                                ? 'text-blue-400 font-bold border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                                                : 'text-slate-500 border border-white/5 hover:border-white/10'}
                                        `}
                                        value={myLaneAssignments[role] || lcuDefaultHero}
                                        onChange={(e) => setMyLaneAssignments({...myLaneAssignments, [role]: e.target.value})}
                                    >
                                        <option value="">-</option>
                                        {blueTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div className="lg:hidden grid grid-cols-3 gap-3">
                    {['bp', 'personal', 'team'].map(m => (
                        <AnalysisButton 
                            key={m} mode={m} activeColor={m==='bp'?'purple':m==='personal'?'amber':'cyan'} 
                            icon={m==='bp'?<Users size={18}/>:m==='personal'?<Zap size={18}/>:<Brain size={18}/>} 
                            label={m==='bp'?"BP":m==='personal'?"私教":"运营"} 
                            onClick={() => handleTabClick(m)} 
                            analyzeType={analyzeType} isAnalyzing={isModeAnalyzing(m)}
                        />
                    ))}
                </div>
            </div>
            
            {/* --- 中间：核心分析台 --- */}
            <div className="lg:col-span-6 flex flex-col gap-4 h-[calc(100vh-140px)] lg:h-[820px]">
                
                {/* Tab Bar */}
                <div className="hidden lg:grid grid-cols-3 gap-3 p-1 bg-[#232329]/90 backdrop-blur rounded-xl border border-white/5 shadow-lg">
                    <AnalysisButton mode="bp" activeColor="purple" icon={<Users size={18}/>} label="BP 推荐" desc="阵容优劣分析" onClick={() => handleTabClick('bp')} analyzeType={analyzeType} isAnalyzing={isModeAnalyzing('bp')}/>
                    <AnalysisButton mode="personal" activeColor="amber" icon={<Zap size={18}/>} label="王者私教" desc="绝活对线指导" onClick={() => handleTabClick('personal')} analyzeType={analyzeType} isAnalyzing={isModeAnalyzing('personal')}/>
                    <AnalysisButton mode="team" activeColor="cyan" icon={<Brain size={18}/>} label="运营教练" desc="大局观与决策" onClick={() => handleTabClick('team')} analyzeType={analyzeType} isAnalyzing={isModeAnalyzing('team')}/>
                </div>

                {/* 结果展示 */}
                <div className="relative flex-1 min-h-0 flex flex-col bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-2xl overflow-hidden group">
                    <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-${analyzeType==='bp'?'purple':analyzeType==='personal'?'amber':'cyan'}-500/50 to-transparent`}></div>
                    
                    {aiResults[analyzeType] && !isModeAnalyzing(analyzeType) && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleAnalyze(analyzeType, true); }}
                            className="absolute top-4 right-14 z-20 p-2 bg-[#1a1a20]/80 hover:bg-[#32323a] rounded-lg text-slate-400 hover:text-white transition-all border border-white/5 backdrop-blur"
                            title="重新生成"
                        >
                            <RotateCcw size={16} />
                        </button>
                    )}

                    <AnalysisResult 
                        aiResult={aiResults[analyzeType]} 
                        isAnalyzing={isModeAnalyzing(analyzeType)} 
                        viewMode={viewMode} setViewMode={setViewMode} 
                        activeTab={activeTab} setActiveTab={setActiveTab} 
                        setShowFeedbackModal={setShowFeedbackModal}
                    />
                </div>
            </div>
            
            {/* --- 右侧：敌方与社区 --- */}
            <div className="lg:col-span-3 flex flex-col gap-4">
                
                {/* 敌方阵容 */}
                <div className="bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#2c2c33]/50">
                        <div className="flex items-center gap-2">
                            <Crosshair size={16} className="text-red-500" />
                            <span className="text-sm font-bold tracking-wider text-slate-200">ENEMY TEAM</span>
                        </div>
                    </div>
                    <div className="p-3 space-y-2">
                        {redTeam.map((c, i) => (
                            <div key={i} className="relative rounded-lg overflow-hidden">
                                <ChampCard champ={c} idx={i} isEnemy={true} userSlot={userSlot} role={Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === c?.name)?.substring(0,3) || ""} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 敌方分路 */}
                <div className="p-4 bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-red-400"/>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">ENEMY LANE</span>
                        </div>
                        <button onClick={() => setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-600 hover:text-white transition-colors">
                            <RefreshCcw size={12} />
                        </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                        {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => (
                            <div key={role} className="flex flex-col gap-1">
                                <label className="text-[9px] uppercase text-slate-600 text-center font-bold">{role.substring(0,3)}</label>
                                <select 
                                    className={`w-full text-[10px] py-1.5 rounded-md bg-[#1a1a20] outline-none appearance-none text-center cursor-pointer transition-all hover:bg-[#25252b]
                                        ${enemyLaneAssignments[role] 
                                            ? 'text-amber-500 font-bold border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                                            : 'text-slate-500 border border-white/5 hover:border-white/10'}
                                    `}
                                    value={enemyLaneAssignments[role]}
                                    onChange={(e) => setEnemyLaneAssignments({...enemyLaneAssignments, [role]: e.target.value})}
                                >
                                    <option value="">-</option>
                                    {redTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* 社区 Tips */}
                <div className="flex-1 min-h-[300px] bg-[#232329]/80 backdrop-blur-sm rounded-xl border border-white/5 shadow-xl overflow-hidden flex flex-col">
                    <CommunityTips tips={tips} currentUser={currentUser} onOpenPostModal={() => { if(!currentUser) setShowLoginModal(true); else setShowTipModal(true); }} onLike={handleLike} onDelete={handleDeleteTip} />
                </div>
            </div>
        </div>

        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
        <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handlePostTip} />
        <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
        <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} username={currentUser} />
        {showAdminPanel && token && <AdminDashboard token={token} onClose={() => setShowAdminPanel(false)} />}
        
        {currentUser && ["admin", "root"].includes(currentUser) && (
            <button onClick={() => setShowAdminPanel(true)} className="fixed bottom-6 left-6 z-50 bg-red-600/90 hover:bg-red-500 text-white p-3 rounded-full shadow-lg backdrop-blur hover:scale-110 transition-all">
                <ShieldAlert size={20} />
            </button>
        )}
      </div>
    </div>
  );
}