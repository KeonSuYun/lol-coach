import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Shield, Users, Zap, Brain, Crosshair, RefreshCcw, ShieldAlert, RotateCcw, Trash2 } from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
// 引入配置
import { API_BASE_URL, BRIDGE_WS_URL, DDRAGON_BASE } from './config/constants';

// 引入组件
import Header from './components/Header';
import ChampCard from './components/ChampCard';
import AnalysisButton from './components/AnalysisButton';
import AnalysisResult from './components/AnalysisResult';
import CommunityTips from './components/CommunityTips';

// 引入弹窗
import LoginModal from './components/modals/LoginModal';
import TipModal from './components/modals/TipModal';
import FeedbackModal from './components/modals/FeedbackModal';

// 🔧 辅助函数：安全读取 LocalStorage
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
  
  // === 💾 1. 状态定义 (带持久化) ===
  const [blueTeam, setBlueTeam] = useState(() => loadState('blueTeam', Array(5).fill(null)));
  const [redTeam, setRedTeam] = useState(() => loadState('redTeam', Array(5).fill(null)));
  
  // LCU 读取的真实分路
  const [myTeamRoles, setMyTeamRoles] = useState(() => loadState('myTeamRoles', Array(5).fill("")));
  
  const [userRole, setUserRole] = useState(() => loadState('userRole', '')); 
  const [userSlot, setUserSlot] = useState(0); 
  const [lcuStatus, setLcuStatus] = useState("disconnected");

  // 敌方分路手动修正
  const [enemyLaneAssignments, setEnemyLaneAssignments] = useState(() => 
      loadState('enemyLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
  );

  // ✨ 新增：模型模式状态 (默认 false = 极速模式)
  const [useThinkingModel, setUseThinkingModel] = useState(() => loadState('useThinkingModel', false));

  // AI 结果多轨化
  const [aiResults, setAiResults] = useState(() => 
      loadState('aiResults', { bp: null, personal: null, team: null })
  );

  // 运行状态
  const [analyzingStatus, setAnalyzingStatus] = useState({}); 
  
  // 控制器引用
  const abortControllersRef = useRef({ bp: null, personal: null, team: null });

  // 辅助函数
  const isModeAnalyzing = (mode) => !!analyzingStatus[mode];
  const [analyzeType, setAnalyzeType] = useState(() => loadState('analyzeType', 'bp')); 
  const [viewMode, setViewMode] = useState('detailed');
  const [activeTab, setActiveTab] = useState(0);

  // 社区 & 弹窗
  const [tips, setTips] = useState([]);
  const [inputContent, setInputContent] = useState(""); 
  const [tipTargetEnemy, setTipTargetEnemy] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 认证
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [rawLcuData, setRawLcuData] = useState(null);

  // === 💾 2. 自动保存副作用 ===
  useEffect(() => { localStorage.setItem('blueTeam', JSON.stringify(blueTeam)); }, [blueTeam]);
  useEffect(() => { localStorage.setItem('redTeam', JSON.stringify(redTeam)); }, [redTeam]);
  useEffect(() => { localStorage.setItem('myTeamRoles', JSON.stringify(myTeamRoles)); }, [myTeamRoles]);
  useEffect(() => { localStorage.setItem('userRole', JSON.stringify(userRole)); }, [userRole]);
  useEffect(() => { localStorage.setItem('enemyLaneAssignments', JSON.stringify(enemyLaneAssignments)); }, [enemyLaneAssignments]);
  useEffect(() => { localStorage.setItem('aiResults', JSON.stringify(aiResults)); }, [aiResults]);
  useEffect(() => { localStorage.setItem('analyzeType', JSON.stringify(analyzeType)); }, [analyzeType]);
  // ✨ 保存模型偏好
  useEffect(() => { localStorage.setItem('useThinkingModel', JSON.stringify(useThinkingModel)); }, [useThinkingModel]);

  // 🧹 清空会话
  const handleClearSession = () => {
      if(!confirm("确定要清空当前对局记录吗？\n(这也将清除所有AI分析结果)")) return;
      
      const emptyTeam = Array(5).fill(null);
      setBlueTeam(emptyTeam);
      setRedTeam(emptyTeam);
      setMyTeamRoles(Array(5).fill(""));
      setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" });
      setAiResults({ bp: null, personal: null, team: null });
      
      localStorage.removeItem('blueTeam');
      localStorage.removeItem('redTeam');
      localStorage.removeItem('myTeamRoles');
      localStorage.removeItem('enemyLaneAssignments');
      localStorage.removeItem('aiResults');
  };

  // === 3. 初始化 & Auth ===
  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("username");
    if (storedToken && storedUser) {
        setToken(storedToken);
        setCurrentUser(storedUser);
    }
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
      } catch (e) { console.error("Data init failed", e); }
    };
    initData();
  }, []);

  const authAxios = useMemo(() => {
      const instance = axios.create({ baseURL: API_BASE_URL });
      instance.interceptors.request.use(config => {
          if (token) config.headers.Authorization = `Bearer ${token}`;
          return config;
      });
      return instance;
  }, [token]);

  // === 4. Bridge 连接 ===
  useEffect(() => {
      let ws;
      let timer;
      const connect = () => {
          ws = new WebSocket(BRIDGE_WS_URL);
          ws.onopen = () => { setLcuStatus("connected"); };
          ws.onclose = () => { setLcuStatus("disconnected"); timer = setTimeout(connect, 3000); };
          ws.onmessage = (event) => {
              try {
                  const msg = JSON.parse(event.data);
                  if (msg.type === 'CHAMP_SELECT') setRawLcuData(msg.data);
                  if (msg.type === 'STATUS' && msg.data === 'connected') setLcuStatus("connected");
              } catch(e){}
          };
      };
      connect();
      return () => { if(ws) ws.close(); clearTimeout(timer); };
  }, []); 

  useEffect(() => {
      if (rawLcuData && championList.length > 0) handleLcuUpdate(rawLcuData);
  }, [rawLcuData, championList]);

  // LCU 数据处理
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
      
      if (newBlue.some(c => c !== null) || newRed.some(c => c !== null)) {
          setBlueTeam(newBlue);
          setRedTeam(newRed);
      }

      const roles = Array(5).fill(""); 
      const lcuRoleMap = { "TOP": "TOP", "JUNGLE": "JUG", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUP" };
      session.myTeam.forEach(p => {
          const idx = p.cellId % 5;
          const rawRole = p.assignedPosition?.toUpperCase();
          if (rawRole && lcuRoleMap[rawRole]) roles[idx] = lcuRoleMap[rawRole];
      });
      if (roles.some(r => r !== "")) setMyTeamRoles(roles);

      const localPlayer = session.myTeam.find(p => p.cellId === session.localPlayerCellId);
      if (localPlayer) {
          setUserSlot(localPlayer.cellId % 5);
          const apiRoleMap = { "TOP": "TOP", "JUNGLE": "JUNGLE", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUPPORT" };
          const assigned = localPlayer.assignedPosition?.toUpperCase();
          if (assigned && apiRoleMap[assigned]) setUserRole(apiRoleMap[assigned]);
      }
  };

  // 敌方位置猜测
  const guessRoles = (team) => {
    const roles = { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" };
    const assignedIndices = new Set(); 
    const findHero = (conditionFn) => {
        for (let i = 0; i < team.length; i++) {
            if (team[i] && !assignedIndices.has(i) && conditionFn(team[i])) {
                assignedIndices.add(i);
                return team[i].name;
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
            Object.keys(guesses).forEach(role => {
                const current = prev[role];
                if (!current || !redTeam.some(c => c?.name === current)) next[role] = guesses[role];
            });
            return next;
        });
    }
  }, [redTeam]);

  // === 5. 业务操作 ===
  const handleLogin = async () => {
      try {
          const formData = new FormData();
          formData.append("username", authForm.username);
          formData.append("password", authForm.password);
          const res = await axios.post(`${API_BASE_URL}/token`, formData);
          setToken(res.data.access_token);
          setCurrentUser(res.data.username);
          localStorage.setItem("access_token", res.data.access_token);
          localStorage.setItem("username", res.data.username);
          setShowLoginModal(false);
      } catch (e) { alert("登录失败: " + (e.response?.data?.detail || "检查信息")); }
  };
  const handleRegister = async () => {
      try { await axios.post(`${API_BASE_URL}/register`, authForm); alert("注册成功！请登录。"); setAuthMode("login"); } catch (e) { alert("注册失败"); }
  };
  const logout = () => {
      setToken(null); setCurrentUser(null);
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
      try {
        await authAxios.post(`/tips`, { hero: blueTeam[userSlot].name, enemy: tipTargetEnemy || "general", content: inputContent, is_general: !tipTargetEnemy });
        setInputContent(""); setShowTipModal(false); fetchTips();
      } catch(e) { alert("发布失败"); }
  };
  const handleLike = async (tipId) => {
      if (!currentUser) return setShowLoginModal(true);
      try { await authAxios.post(`/like`, { tip_id: tipId }); fetchTips(); } catch(e){}
  };
  const handleDeleteTip = async (tipId, tipAuthorId) => {
      if (!currentUser) return setShowLoginModal(true);
      if(!confirm("确定删除？")) return;
      try { await authAxios.delete(`/tips/${tipId}`); fetchTips(); } catch (e) { alert("删除失败"); }
  };

  // === 6. 核心分析逻辑 ===
  const handleTabClick = (mode) => {
      setAnalyzeType(mode); 
      if (!aiResults[mode] && !analyzingStatus[mode]) {
          handleAnalyze(mode);
      }
  };

  const handleAnalyze = async (mode, forceRestart = false) => {
    if (!token) { setAuthMode('login'); setShowLoginModal(true); return; }
    if (analyzingStatus[mode] && !forceRestart) return;

    if (abortControllersRef.current[mode]) {
        abortControllersRef.current[mode].abort();
    }
    const newController = new AbortController();
    abortControllersRef.current[mode] = newController;

    setAnalyzingStatus(prev => ({ ...prev, [mode]: true }));
    setAiResults(prev => ({ ...prev, [mode]: null })); 

    const myLaneAssignments = {};
    const roleMapping = { "TOP": "TOP", "JUG": "JUNGLE", "MID": "MID", "ADC": "ADC", "SUP": "SUPPORT" };
    
    blueTeam.forEach((hero, idx) => {
        if (hero && myTeamRoles[idx]) {
            const standardRole = roleMapping[myTeamRoles[idx]];
            if (standardRole) {
                myLaneAssignments[standardRole] = hero.name;
            }
        }
    });

    const validEnemyAssignments = {};
    const currentEnemyNames = redTeam.map(c => c?.name).filter(Boolean);
    Object.keys(enemyLaneAssignments).forEach(key => {
        const hero = enemyLaneAssignments[key];
        if (hero && currentEnemyNames.includes(hero)) validEnemyAssignments[key] = hero;
    });

    try {
        const payload = {
            mode,
            myHero: blueTeam[userSlot]?.name || "未知",
            myTeam: blueTeam.map(c => c?.name || "未选"),
            enemyTeam: redTeam.map(c => c?.name || "未选"),
            userRole,
            myLaneAssignments: Object.keys(myLaneAssignments).length > 0 ? myLaneAssignments : null,
            enemyLaneAssignments: Object.keys(validEnemyAssignments).length > 0 ? validEnemyAssignments : null,
            // 🔥 发送模型参数
            model_type: useThinkingModel ? "reasoner" : "chat" 
        };

        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload),
            signal: newController.signal
        });

        if (!response.ok) {
             if (response.status === 401) { setShowLoginModal(true); throw new Error("登录过期"); }
             throw new Error(`请求失败: ${response.status}`);
        }
        if (!response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let accumulatedText = "";

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
        console.error("Analysis Error:", error);
        setAiResults(prev => ({ ...prev, [mode]: JSON.stringify({
            concise: { title: "错误", content: error.message || "网络异常" }
        })}));
    } finally {
        if (abortControllersRef.current[mode] === newController) {
            setAnalyzingStatus(prev => ({ ...prev, [mode]: false }));
        }
    }
  };

  const handleReportError = async () => {
    if (!currentUser) return setShowLoginModal(true);
    const currentAiContent = aiResults[analyzeType];
    const summary = typeof currentAiContent === 'string' && currentAiContent.includes('concise') ? "AI Response..." : "Streaming/Empty";
    try {
        await authAxios.post(`/feedback`, { 
            match_context: { myHero: blueTeam[userSlot]?.name, mode: analyzeType, ai_summary: summary }, 
            description: inputContent 
        });
        alert("反馈已提交"); setShowFeedbackModal(false); setInputContent("");
    } catch (e) { alert("提交失败"); }
  };

  // === 7. 渲染 ===
  return (
    <div className="min-h-screen bg-[#050508] text-slate-300 font-sans p-2 md:p-6 flex flex-col items-center">
      
      <Header 
        version={version} lcuStatus={lcuStatus} 
        userRole={userRole} setUserRole={setUserRole} 
        currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
        // ✨ 传递模型切换参数
        useThinkingModel={useThinkingModel}
        setUseThinkingModel={setUseThinkingModel}
      />

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧：我方 */}
        <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center justify-between px-2">
                <span className="flex items-center gap-2"><Shield size={14} /> ALLY TEAM</span>
                <button onClick={handleClearSession} className="text-slate-600 hover:text-red-500 transition" title="清空对局记录 (新对局)">
                    <Trash2 size={12}/>
                </button>
            </div>
            {blueTeam.map((c, i) => (
                <ChampCard key={i} champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} role={myTeamRoles[i]} />
            ))}
            
            <div className="lg:hidden grid grid-cols-3 gap-2 mt-4">
                {['bp', 'personal', 'team'].map(m => (
                    <AnalysisButton 
                        key={m} mode={m} activeColor={m==='bp'?'purple':m==='personal'?'amber':'cyan'} 
                        icon={m==='bp'?<Users size={20}/>:m==='personal'?<Zap size={20}/>:<Brain size={20}/>} 
                        label={m==='bp'?"BP推荐":m==='personal'?"私教":"教练"} desc="点击分析"
                        onClick={() => handleTabClick(m)} 
                        analyzeType={analyzeType} isAnalyzing={isModeAnalyzing(m)}
                    />
                ))}
            </div>
        </div>
        
        {/* 中间：分析台 */}
        <div className="lg:col-span-6 flex flex-col gap-4 h-[calc(100vh-200px)] lg:h-[750px]">
            <div className="hidden lg:grid grid-cols-3 gap-3">
                 <AnalysisButton mode="bp" activeColor="purple" icon={<Users size={20}/>} label="BP 智能推荐" desc="阵容优劣分析" onClick={() => handleTabClick('bp')} analyzeType={analyzeType} isAnalyzing={isModeAnalyzing('bp')}/>
                 <AnalysisButton mode="personal" activeColor="amber" icon={<Zap size={20}/>} label="王者私教" desc="绝活对线指导" onClick={() => handleTabClick('personal')} analyzeType={analyzeType} isAnalyzing={isModeAnalyzing('personal')}/>
                 <AnalysisButton mode="team" activeColor="cyan" icon={<Brain size={20}/>} label="职业教练" desc="战队运营策略" onClick={() => handleTabClick('team')} analyzeType={analyzeType} isAnalyzing={isModeAnalyzing('team')}/>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col">
                {/* 重新生成按钮 */}
                {aiResults[analyzeType] && !isModeAnalyzing(analyzeType) && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleAnalyze(analyzeType, true); }}
                        className="absolute top-4 right-14 z-20 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition shadow-lg border border-slate-700"
                        title="重新生成当前内容"
                    >
                        <RotateCcw size={14} />
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
        
        {/* 右侧：敌方 & 社区 */}
        <div className="lg:col-span-3 flex flex-col gap-4">
             <div className="flex flex-col gap-3">
                <div className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 px-2"><Crosshair size={14} /> ENEMY TEAM</div>
                {redTeam.map((c, i) => (
                    <ChampCard key={i} champ={c} idx={i} isEnemy={true} userSlot={userSlot} role={Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === c?.name)?.substring(0,3) || ""} />
                ))}
             </div>

             <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1"><Users size={12} /> 敌方分路</h3>
                    <button onClick={() => setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-500 hover:text-slate-300"><RefreshCcw size={10} /></button>
                </div>
                <div className="grid grid-cols-5 gap-1">
                    {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => (
                        <div key={role} className="flex flex-col">
                            <label className="text-[9px] uppercase text-slate-600 text-center mb-0.5 font-bold">{role.substring(0,3)}</label>
                            <select 
                                className={`text-[10px] p-1 rounded border outline-none truncate appearance-none text-center cursor-pointer hover:bg-slate-700 ${enemyLaneAssignments[role] ? 'bg-slate-800 text-amber-400 border-slate-600' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
                                value={enemyLaneAssignments[role]}
                                onChange={(e) => setEnemyLaneAssignments({...enemyLaneAssignments, [role]: e.target.value})}
                            >
                                <option value="">Auto</option>
                                {redTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                            </select>
                        </div>
                    ))}
                </div>
             </div>
             <CommunityTips tips={tips} currentUser={currentUser} onOpenPostModal={() => { if(!currentUser) setShowLoginModal(true); else setShowTipModal(true); }} onLike={handleLike} onDelete={handleDeleteTip} />
        </div>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
      <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handlePostTip} />
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
      {showAdminPanel && token && <AdminDashboard token={token} onClose={() => setShowAdminPanel(false)} />}
      
      {currentUser && ["admin", "root", "keonsuyun", "myname"].includes(currentUser) && (
          <button onClick={() => setShowAdminPanel(true)} className="fixed bottom-4 left-4 z-50 bg-red-950/90 hover:bg-red-700 text-red-100 p-3 rounded-full shadow border border-red-500 hover:scale-110 group"><ShieldAlert size={24} className="group-hover:animate-pulse"/></button>
      )}
    </div>
  );
}