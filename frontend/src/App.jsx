import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Shield, Users, Zap, Brain, Crosshair, RefreshCcw } from 'lucide-react';
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

export default function App() {
  // === 状态定义 ===
  const [version, setVersion] = useState("V15.2"); 
  const [championList, setChampionList] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  // 阵容数据
  const [blueTeam, setBlueTeam] = useState(Array(5).fill(null));
  const [redTeam, setRedTeam] = useState(Array(5).fill(null));
  
  // ✨ 新增：队友真实分路 (用于卡片显示 TOP/JUG 等)
  const [myTeamRoles, setMyTeamRoles] = useState(Array(5).fill(""));

  // 用户状态
  // 默认为空字符串，代表 "Auto/未定"，让后端智能判断
  const [userRole, setUserRole] = useState(''); 
  const [userSlot, setUserSlot] = useState(0); 
  const [lcuStatus, setLcuStatus] = useState("disconnected");

  // ✨ 敌方分路手动修正状态
  const [enemyLaneAssignments, setEnemyLaneAssignments] = useState({
      "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": ""
  });

  // AI & 视图
  const [aiResult, setAiResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeType, setAnalyzeType] = useState(""); 
  const [viewMode, setViewMode] = useState('detailed');
  const [activeTab, setActiveTab] = useState(0);

  // 社区 & 输入
  const [tips, setTips] = useState([]);
  const [inputContent, setInputContent] = useState(""); 
  const [tipTargetEnemy, setTipTargetEnemy] = useState(null);

  // 弹窗可见性
  const [showTipModal, setShowTipModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 认证状态
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [rawLcuData, setRawLcuData] = useState(null);

  // === 1. 初始化 & Auth ===
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
        const list = Object.values(cData.data).map(c => ({
             id: c.key, key: c.id, name: c.name, title: c.title, tags: c.tags,
             image_url: `${DDRAGON_BASE}/cdn/${versions[0]}/img/champion/${c.id}.png`,
        }));
        setChampionList(list);
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

  // === 2. Bridge 连接 ===
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

  // LCU 数据处理
  useEffect(() => {
      if (rawLcuData && championList.length > 0) {
          handleLcuUpdate(rawLcuData);
      }
  }, [rawLcuData, championList]);

  // 🔥 核心逻辑：处理 LCU 数据并解析位置
  const handleLcuUpdate = (session) => {
      if (!session || championList.length === 0) return;

      // 1. 映射英雄对象
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
      setBlueTeam(mapTeam(session.myTeam));
      setRedTeam(mapTeam(session.theirTeam));

      // 2. ✨ 解析队友真实分路 (Assigned Position)
      const roles = Array(5).fill(""); 
      const lcuRoleMap = {
          "TOP": "TOP", "JUNGLE": "JUG", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUP"
      };

      session.myTeam.forEach(p => {
          const idx = p.cellId % 5;
          const rawRole = p.assignedPosition?.toUpperCase();
          if (rawRole && lcuRoleMap[rawRole]) {
              roles[idx] = lcuRoleMap[rawRole];
          }
      });
      setMyTeamRoles(roles);

      // 3. 自动同步用户自己的位置
      const localPlayer = session.myTeam.find(p => p.cellId === session.localPlayerCellId);
      if (localPlayer) {
          setUserSlot(localPlayer.cellId % 5);
          // 这里的映射需匹配后端 API (JUNGLE, SUPPORT 全称)
          const apiRoleMap = { "TOP": "TOP", "JUNGLE": "JUNGLE", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUPPORT" };
          const assigned = localPlayer.assignedPosition?.toUpperCase();
          if (assigned && apiRoleMap[assigned]) {
              setUserRole(apiRoleMap[assigned]);
          }
      }
  };

  // === 3. 敌方分路自动预判 (Auto Guess) ===
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

    // 简单策略：按职业标签排除法
    roles["SUPPORT"] = findHero(c => c.tags.includes("Support") || c.tags.includes("Tank"));
    roles["ADC"] = findHero(c => c.tags.includes("Marksman"));
    roles["MID"] = findHero(c => c.tags.includes("Mage") || c.tags.includes("Assassin"));
    roles["TOP"] = findHero(c => c.tags.includes("Fighter") || c.tags.includes("Tank"));
    roles["JUNGLE"] = findHero(c => true); // 剩下的给打野

    return roles;
  };

  // 当敌方阵容变化时，自动填充空白的下拉框
  useEffect(() => {
    const hasHeroes = redTeam.some(c => c !== null);
    if (hasHeroes) {
        const guesses = guessRoles(redTeam);
        setEnemyLaneAssignments(prev => {
            const next = { ...prev };
            Object.keys(guesses).forEach(role => {
                // 仅当当前位置为空或之前的英雄已不在场时，才覆盖 (避免覆盖用户的手动修正)
                const currentHeroName = prev[role];
                const isHeroStillInTeam = redTeam.some(c => c?.name === currentHeroName);
                if (!currentHeroName || !isHeroStillInTeam) {
                    next[role] = guesses[role];
                }
            });
            return next;
        });
    }
  }, [redTeam]);

  // === 4. 业务逻辑 ===
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
      try {
          await axios.post(`${API_BASE_URL}/register`, authForm);
          alert("注册成功！请登录。");
          setAuthMode("login");
      } catch (e) { alert("注册失败"); }
  };

  const logout = () => {
      setToken(null); setCurrentUser(null);
      localStorage.removeItem("access_token"); localStorage.removeItem("username");
  };

  const fetchTips = async () => {
      if (!blueTeam[userSlot]) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/tips`, {
            params: { hero: blueTeam[userSlot].name, is_general: true } 
        });
        setTips(res.data);
      } catch (e) {}
  };
  useEffect(() => { fetchTips(); }, [blueTeam[userSlot]]);

  const handlePostTip = async () => {
      if (!currentUser) return setShowLoginModal(true);
      if (!inputContent.trim()) return;
      try {
        await authAxios.post(`/tips`, {
            hero: blueTeam[userSlot].name, enemy: tipTargetEnemy || "general", content: inputContent, is_general: !tipTargetEnemy
        });
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

  // 🔥 核心修改：流式分析 + 携带分路数据
  const handleAnalyze = async (mode) => {
      setAnalyzeType(mode); setIsAnalyzing(true); setAiResult(null);
      
      // 1. 整理有效的修正数据
      const validAssignments = {};
      const currentEnemyNames = redTeam.map(c => c?.name).filter(Boolean); 
      Object.keys(enemyLaneAssignments).forEach(key => {
          const hero = enemyLaneAssignments[key];
          if (hero && currentEnemyNames.includes(hero)) {
              validAssignments[key] = hero;
          }
      });

      try {
          const payload = {
              mode, 
              myHero: blueTeam[userSlot]?.name || "未知", 
              myTeam: blueTeam.map(c => c?.name || "未选"), 
              enemyTeam: redTeam.map(c => c?.name || "未选"), 
              userRole, // 这里如果是空，后端会启用智能识别
              ...(Object.keys(validAssignments).length > 0 && { enemyLaneAssignments: validAssignments })
          };

          // ✨ 使用 fetch 进行流式读取
          const response = await fetch(`${API_BASE_URL}/analyze`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify(payload)
          });

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
                  // 实时传给 UI 组件，让脏 JSON 解析器处理
                  setAiResult(accumulatedText);
              }
          }

      } catch (e) {
          console.error(e);
          setAiResult({ concise: { title: "分析中断", content: "无法连接到 AI 服务" }, detailed_tabs: [] });
      } finally { 
          setIsAnalyzing(false); 
      }
  };

  const handleReportError = async () => {
    if (!currentUser) return setShowLoginModal(true);
    try {
        await authAxios.post(`/feedback`, {
            match_context: { myHero: blueTeam[userSlot]?.name, ai_summary: typeof aiResult === 'object' ? aiResult?.concise?.title : "Streaming..." }, description: inputContent
        });
        alert("反馈已提交"); setShowFeedbackModal(false); setInputContent("");
    } catch (e) { alert("提交失败"); }
  };

  // === 5. 渲染 ===
  return (
    <div className="min-h-screen bg-[#050508] text-slate-300 font-sans p-2 md:p-6 flex flex-col items-center">
      
      <Header 
        version={version} lcuStatus={lcuStatus} 
        userRole={userRole} setUserRole={setUserRole} 
        currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
      />

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧：我方阵容 */}
        <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 px-2">
                <Shield size={14} /> ALLY TEAM
            </div>
            {blueTeam.map((c, i) => (
                <ChampCard 
                    key={i} 
                    champ={c} 
                    idx={i} 
                    isEnemy={false} 
                    userSlot={userSlot} 
                    onSelectMe={setUserSlot} 
                    // ✨ 传入 LCU 解析出的真实位置
                    role={myTeamRoles[i]} 
                />
            ))}
            
            <div className="lg:hidden grid grid-cols-3 gap-2 mt-4">
                <AnalysisButton mode="bp" activeColor="purple" icon={<Users size={20}/>} label="BP推荐" desc="实时" onClick={() => handleAnalyze('bp')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
                <AnalysisButton mode="personal" activeColor="amber" icon={<Zap size={20}/>} label="私教" desc="对线" onClick={() => handleAnalyze('personal')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
                <AnalysisButton mode="team" activeColor="cyan" icon={<Brain size={20}/>} label="教练" desc="运营" onClick={() => handleAnalyze('team')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
            </div>
        </div>
        
        {/* 中间：AI 分析台 */}
        <div className="lg:col-span-6 flex flex-col gap-4 h-[calc(100vh-200px)] lg:h-[750px]">
            {/* 桌面端按钮 */}
            <div className="hidden lg:grid grid-cols-3 gap-3">
                <AnalysisButton mode="bp" activeColor="purple" icon={<Users size={20}/>} label="BP 智能推荐" desc="阵容优劣分析" onClick={() => handleAnalyze('bp')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
                <AnalysisButton mode="personal" activeColor="amber" icon={<Zap size={20}/>} label="王者私教" desc="绝活对线指导" onClick={() => handleAnalyze('personal')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
                <AnalysisButton mode="team" activeColor="cyan" icon={<Brain size={20}/>} label="职业教练" desc="战队运营策略" onClick={() => handleAnalyze('team')} analyzeType={analyzeType} isAnalyzing={isAnalyzing}/>
            </div>

            <AnalysisResult 
                aiResult={aiResult} isAnalyzing={isAnalyzing} 
                viewMode={viewMode} setViewMode={setViewMode} 
                activeTab={activeTab} setActiveTab={setActiveTab} 
                setShowFeedbackModal={setShowFeedbackModal}
            />
        </div>
        
        {/* 右侧：敌方 + 修正 + 社区 */}
        <div className="lg:col-span-3 flex flex-col gap-4">
             {/* 敌方列表 */}
             <div className="flex flex-col gap-3">
                <div className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 px-2">
                    <Crosshair size={14} /> ENEMY TEAM
                </div>
                {redTeam.map((c, i) => (
                    <ChampCard 
                        key={i} 
                        champ={c} 
                        idx={i} 
                        isEnemy={true} 
                        userSlot={userSlot}
                        // 小彩蛋：如果该英雄被手动指定了位置，在卡片上也显示出来
                        role={Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === c?.name)?.substring(0,3) || ""}
                    />
                ))}
             </div>

             {/* ✨ 敌方分路修正面板 */}
             <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <Users size={12} /> 敌方分路 (智能预判/修正)
                    </h3>
                    <button 
                        onClick={() => setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })}
                        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                        title="重置"
                    >
                        <RefreshCcw size={10} />
                    </button>
                </div>
                <div className="grid grid-cols-5 gap-1">
                    {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => (
                        <div key={role} className="flex flex-col">
                            <label className="text-[9px] uppercase text-slate-600 text-center mb-0.5 font-bold">{role.substring(0,3)}</label>
                            <select 
                                className={`
                                    text-[10px] p-1 rounded border outline-none truncate appearance-none text-center cursor-pointer hover:bg-slate-700
                                    ${enemyLaneAssignments[role] ? 'bg-slate-800 text-amber-400 border-slate-600' : 'bg-slate-800 text-slate-500 border-slate-700'}
                                `}
                                value={enemyLaneAssignments[role]}
                                onChange={(e) => setEnemyLaneAssignments({...enemyLaneAssignments, [role]: e.target.value})}
                            >
                                <option value="" className="text-slate-500">Auto</option>
                                {redTeam.map((c, i) => c?.name ? (
                                    <option key={i} value={c.name}>{c.name}</option>
                                ) : null)}
                            </select>
                        </div>
                    ))}
                </div>
             </div>

             <CommunityTips 
                tips={tips} currentUser={currentUser} 
                onOpenPostModal={() => { if(!currentUser) setShowLoginModal(true); else setShowTipModal(true); }}
                onLike={handleLike} onDelete={handleDeleteTip}
             />
        </div>
      </div>

      {/* 弹窗挂载点 */}
      <LoginModal 
          isOpen={showLoginModal} onClose={() => setShowLoginModal(false)}
          authMode={authMode} setAuthMode={setAuthMode}
          authForm={authForm} setAuthForm={setAuthForm}
          handleLogin={handleLogin} handleRegister={handleRegister}
      />

      <TipModal 
          isOpen={showTipModal} onClose={() => setShowTipModal(false)}
          content={inputContent} setContent={setInputContent}
          onSubmit={handlePostTip}
      />

      <FeedbackModal 
          isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)}
          content={inputContent} setContent={setInputContent}
          onSubmit={handleReportError}
      />
    {/* ================= 🛡️ 新增：管理员功能区 ================= */}
      
      {/* 1. 管理员面板弹窗 (只有打开且有Token时渲染) */}
      {showAdminPanel && token && (
          <AdminDashboard token={token} onClose={() => setShowAdminPanel(false)} />
      )}

      {/* 2. 管理员入口按钮 (左下角红色悬浮盾牌) */}
      {/* 逻辑：只有登录了，且用户名在白名单里才显示按钮 */}
      {currentUser && ["admin", "root", "keonsuyun", "HexCoach"].includes(currentUser) && (
          <button 
              onClick={() => setShowAdminPanel(true)}
              className="fixed bottom-4 left-4 z-50 bg-red-950/90 hover:bg-red-700 text-red-100 p-3 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)] border border-red-500 transition-all hover:scale-110 group"
              title="打开管理员审核台"
          >
              <ShieldAlert size={24} className="group-hover:animate-pulse"/>
          </button>
      )}

    </div>
  );
}