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
// 引入英雄选择模态框
import ChampSelectModal from './components/modals/ChampSelectModal';

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
  const [roleMapping, setRoleMapping] = useState({});
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

  // 🟢 新增：选人模态框状态
  const [showChampSelect, setShowChampSelect] = useState(false);
  const [selectingSlot, setSelectingSlot] = useState(null); // { isEnemy: boolean, index: number }

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
        const initData = async () => {
        try {
            // 1. 获取 DDragon 数据 (保持不变)
            const vRes = await fetch(`${DDRAGON_BASE}/api/versions.json`);
            const versions = await vRes.json();
            setVersion(versions[0]);
            const cRes = await fetch(`${DDRAGON_BASE}/cdn/${versions[0]}/data/zh_CN/championFull.json`);
            const cData = await cRes.json();
            setChampionList(Object.values(cData.data).map(c => ({
                id: c.key, key: c.id, name: c.name, title: c.title, tags: c.tags,
                image_url: `${DDRAGON_BASE}/cdn/${versions[0]}/img/champion/${c.id}.png`,
            })));

            // 2. 获取后端精准分路数据
            const roleRes = await axios.get(`${API_BASE_URL}/champions/roles`);
            if (roleRes.data) {
                setRoleMapping(roleRes.data);
            }

        } catch (e) { console.error(e); }
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

  // 🟢 核心交互逻辑：打开选择框
  const handleSlotClick = (isEnemy, index) => {
      setSelectingSlot({ isEnemy, index });
      setShowChampSelect(true);
  };

  // 🟢 核心交互逻辑：处理英雄选择
  const handleModalSelect = (hero) => {
      if (!selectingSlot) return;
      const { isEnemy, index } = selectingSlot;
      const roles = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
      const roleName = roles[index];

      if (!isEnemy) {
          // 更新我方阵容
          const newTeam = [...blueTeam];
          newTeam[index] = hero;
          setBlueTeam(newTeam);
          
          // 如果该位置对应了 My Lane，同步更新分路指派
          if (roleName) {
              setMyLaneAssignments(prev => ({ ...prev, [roleName]: hero ? hero.name : "" }));
              // 更新位置标记
              const newRoles = [...myTeamRoles];
              newRoles[index] = roleName;
              setMyTeamRoles(newRoles);
          }
      } else {
          // 更新敌方阵容
          const newTeam = [...redTeam];
          newTeam[index] = hero;
          setRedTeam(newTeam);

          // 如果该位置对应了 Enemy Targets，同步更新分路指派
          if (roleName) {
              setEnemyLaneAssignments(prev => ({ ...prev, [roleName]: hero ? hero.name : "" }));
          }
      }
      setShowChampSelect(false);
  };

  return (
    <div className="min-h-screen">
      
      {/* 顶部金线 */}
      <div className="fixed top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-hex-gold/50 to-transparent z-50"></div>

      {/* 外层容器 */}
      <div className="relative z-10 flex flex-col items-center p-4 md:p-8 max-w-[1800px] mx-auto">
        
        <Header 
            version={version} lcuStatus={lcuStatus} 
            userRole={userRole} setUserRole={setUserRole} 
            currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
            useThinkingModel={useThinkingModel} setUseThinkingModel={setUseThinkingModel}
            setShowPricingModal={setShowPricingModal} accountInfo={accountInfo}
            userRank={userRank} setUserRank={setUserRank}  
        />

        {/* 🟢 主布局修正：水平对齐，宽度增加 */}
        <div className="w-full mt-6 flex flex-col lg:flex-row gap-6 items-start justify-center">
            
            {/* === 左侧：宽度增加到 380px === */}
            <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-5 sticky top-8">
                {/* 阵容面板 */}
                <div className="bg-hex-dark border border-hex-gold/30 rounded shadow-hex relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-hex-blue to-transparent opacity-50"></div>
                    
                    <div className="flex items-center justify-between px-3 py-2 bg-[#010A13]/80 border-b border-hex-gold/10">
                        <div className="flex items-center gap-2 text-hex-blue">
                            <Shield size={14} />
                            <span className="text-xs font-bold tracking-[0.15em] text-hex-gold-light uppercase">Ally Team</span>
                        </div>
                        <button onClick={handleClearSession} className="text-slate-500 hover:text-red-400 transition-colors opacity-50 hover:opacity-100">
                            <Trash2 size={12}/>
                        </button>
                    </div>
                    
                    <div className="p-1 space-y-1 bg-hex-black/30">
                        {blueTeam.map((c, i) => (
                            <div 
                                key={i} 
                                // 🟢 修改：点击卡片区域打开选人框
                                onClick={() => handleSlotClick(false, i)}
                                className={`relative transition-all duration-300 cursor-pointer ${userSlot === i ? 'bg-gradient-to-r from-hex-blue/20 to-transparent border-l-2 border-hex-blue' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
                            >
                                <ChampCard champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} role={myTeamRoles[i]} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 分路面板 (My Lane) - 美化版 */}
                <div className="p-3 bg-hex-dark border border-hex-gold/20 rounded shadow-lg relative">
                    <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-hex-gold/50"></div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-hex-blue rounded-full"></div>
                            <span className="text-[10px] font-bold text-hex-gold-light tracking-widest uppercase">My Lane</span>
                        </div>
                        <button onClick={() => setMyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-600 hover:text-hex-gold transition-colors">
                            <RefreshCcw size={10} />
                        </button>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => {
                             const lcuDefaultHero = blueTeam.find((_, i) => myTeamRoles[i] === role)?.name || "";
                             const isAssigned = !!myLaneAssignments[role];
                             return (
                                <div key={role} className="flex items-center justify-between gap-3 group">
                                    <label className="text-[10px] md:text-xs uppercase text-slate-500 font-bold w-8 text-right group-hover:text-hex-blue transition-colors">{role.substring(0,3)}</label>
                                    <div className={`flex-1 relative h-9 rounded bg-slate-900/80 border transition-all duration-300 ${isAssigned ? 'border-hex-blue shadow-[0_0_8px_rgba(10,200,185,0.15)] bg-hex-blue/5' : 'border-hex-gold/10 hover:border-hex-gold/30 hover:bg-white/5'}`}>
                                        <select 
                                            className="w-full h-full bg-transparent text-xs font-bold text-slate-300 outline-none appearance-none cursor-pointer absolute inset-0 z-10 px-2 text-center hover:text-white transition-colors"
                                            value={myLaneAssignments[role] || lcuDefaultHero}
                                            onChange={(e) => setMyLaneAssignments({...myLaneAssignments, [role]: e.target.value})}
                                        >
                                            <option value="" className="bg-slate-900 text-slate-500">- Select -</option>
                                            {blueTeam.map((c, i) => c?.name ? <option key={i} value={c.name} className="bg-slate-900">{c.name}</option> : null)}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                                            <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className="text-hex-gold"><path d="M5 6L0 0H10L5 6Z"/></svg>
                                        </div>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                </div>
            </div>
            
            {/* === 中间：限制最大宽度 780px === */}
            <div className="flex-1 min-w-0 max-w-[780px] flex flex-col gap-0 min-h-[600px]">
                {/* 顶部 Tab 栏 */}
                <div className="grid grid-cols-3 gap-0 bg-hex-black border border-hex-gold/30 rounded-t-lg overflow-hidden sticky top-[80px] z-30 shadow-2xl">
                    {[
                        { id: 'bp', label: 'BP 推荐', icon: <Users size={18}/>, desc: '阵容优劣' },
                        { id: 'personal', label: '王者私教', icon: <Zap size={18}/>, desc: '对线细节' },
                        { id: 'team', label: '运营指挥', icon: <Brain size={18}/>, desc: '大局决策' },
                    ].map(tab => {
                        const isActive = analyzeType === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab.id)}
                                className={`relative group flex flex-col items-center justify-center py-4 transition-all duration-300 border-r border-hex-gold/10 last:border-r-0
                                    ${isActive ? 'bg-gradient-to-b from-hex-dark to-[#050C18]' : 'bg-hex-black hover:bg-hex-dark/40'}
                                `}
                            >
                                <div className={`flex items-center gap-2 mb-0.5 ${isActive ? 'text-hex-gold-light drop-shadow-[0_0_5px_rgba(200,170,110,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                    {tab.icon}
                                    <span className="font-bold tracking-widest text-sm md:text-base">{tab.label}</span>
                                </div>
                                <span className="text-[10px] text-slate-600 font-mono tracking-wider">{tab.desc}</span>
                                {isActive && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-hex-gold shadow-[0_0_15px_#C8AA6E]"></div>}
                            </button>
                        )
                    })}
                </div>

                {/* 分析结果展示区 */}
                <div className="relative flex-1 flex flex-col bg-hex-dark border-x border-b border-hex-gold/30 rounded-b-lg shadow-hex p-1">
                    <div className="absolute inset-0 bg-magic-pattern opacity-5 pointer-events-none z-0"></div>
                    {aiResults[analyzeType] && !isModeAnalyzing(analyzeType) && (
                        <div className="absolute top-4 right-6 z-20">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleAnalyze(analyzeType, true); }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-hex-black/80 hover:bg-hex-blue/20 rounded border border-hex-gold/20 text-hex-gold hover:text-white transition-all backdrop-blur group"
                            >
                                <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                                <span className="text-xs font-bold">REGENERATE</span>
                            </button>
                        </div>
                    )}
                    <div className="relative z-10 min-h-[500px] h-auto">
                        <AnalysisResult 
                            aiResult={aiResults[analyzeType]} 
                            isAnalyzing={isModeAnalyzing(analyzeType)} 
                            viewMode={viewMode} setViewMode={setViewMode} 
                            activeTab={activeTab} setActiveTab={setActiveTab} 
                            setShowFeedbackModal={setShowFeedbackModal}
                        />
                    </div>
                </div>
            </div>
            
            {/* === 右侧：宽度 380px，移除 h-screen 强制高度 === */}
            <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-5 sticky top-8">
                
                {/* 敌方阵容 */}
                <div className="bg-[#1a0505] border border-red-900/30 rounded shadow-lg relative overflow-hidden shrink-0">
                    <div className="flex items-center justify-between px-3 py-2 bg-[#2a0a0a]/50 border-b border-red-900/20">
                        <div className="flex items-center gap-2 text-red-500">
                            <Crosshair size={14} />
                            <span className="text-xs font-bold tracking-[0.15em] text-red-200 uppercase">Enemy Team</span>
                        </div>
                    </div>
                    <div className="p-1 space-y-1 bg-black/20">
                        {redTeam.map((c, i) => (
                            <div 
                                key={i} 
                                // 🟢 修改：点击卡片区域打开选人框
                                onClick={() => handleSlotClick(true, i)}
                                className="relative hover:bg-red-900/10 rounded transition-colors border-l-2 border-transparent hover:border-red-800 cursor-pointer"
                            >
                                <ChampCard champ={c} idx={i} isEnemy={true} userSlot={userSlot} role={Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === c?.name)?.substring(0,3) || ""} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 敌方分路 (Targets) - 美化版 */}
                <div className="p-3 bg-[#1a0505] border border-red-900/20 rounded shadow-lg relative shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-red-600 rounded-full"></div>
                            <span className="text-[10px] font-bold text-red-200 tracking-widest uppercase">Targets</span>
                        </div>
                        <button onClick={() => setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-600 hover:text-red-400 transition-colors">
                            <RefreshCcw size={10} />
                        </button>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => (
                            <div key={role} className="flex items-center justify-between gap-3 group">
                                <label className="text-[10px] md:text-xs uppercase text-slate-600 font-bold w-8 text-right group-hover:text-red-400 transition-colors">{role.substring(0,3)}</label>
                                <div className={`flex-1 relative h-9 rounded bg-[#0f0404] border transition-all duration-300 ${enemyLaneAssignments[role] ? 'border-red-600/50 shadow-[0_0_8px_rgba(220,38,38,0.15)] bg-red-900/10' : 'border-red-900/20 hover:border-red-900/40 hover:bg-red-900/5'}`}>
                                    <select 
                                        className="w-full h-full bg-transparent text-xs font-bold text-slate-300 outline-none appearance-none cursor-pointer absolute inset-0 z-10 px-2 text-center hover:text-red-200 transition-colors"
                                        value={enemyLaneAssignments[role]}
                                        onChange={(e) => setEnemyLaneAssignments({...enemyLaneAssignments, [role]: e.target.value})}
                                    >
                                        <option value="" className="bg-[#1a0505] text-slate-500">- Target -</option>
                                        {redTeam.map((c, i) => c?.name ? <option key={i} value={c.name} className="bg-[#1a0505] text-red-200">{c.name}</option> : null)}
                                    </select>
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-30">
                                         <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className="text-red-600"><path d="M5 6L0 0H10L5 6Z"/></svg>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* 社区 Tips：设置固定高度，防止自动撑开 */}
                <div className="h-[320px] bg-hex-dark border border-hex-gold/20 rounded shadow-xl overflow-hidden flex flex-col shrink-0">
                    <CommunityTips tips={tips} currentUser={currentUser} onOpenPostModal={() => { if(!currentUser) setShowLoginModal(true); else setShowTipModal(true); }} onLike={handleLike} onDelete={handleDeleteTip} />
                </div>
            </div>
        </div>

        {/* 模态框组件 */}
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
        <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handlePostTip} />
        <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
        <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} username={currentUser} />
        <ChampSelectModal 
            isOpen={showChampSelect}
            onClose={() => setShowChampSelect(false)}
            championList={championList}
            onSelect={handleModalSelect}
            initialRoleIndex={selectingSlot?.index}
            roleMapping={roleMapping} // <--- 关键修改：传递映射数据
        />
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