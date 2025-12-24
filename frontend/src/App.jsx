import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Shield, Users, Zap, Brain, Crosshair } from 'lucide-react';

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
  const [blueTeam, setBlueTeam] = useState(Array(5).fill(null));
  const [redTeam, setRedTeam] = useState(Array(5).fill(null));
  const [userRole, setUserRole] = useState('TOP'); 
  const [userSlot, setUserSlot] = useState(0); 
  const [lcuStatus, setLcuStatus] = useState("disconnected");

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

  // === 2. Bridge 连接 (只负责接收数据，不依赖 championList) ===
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
                  // 🟢 收到数据先存起来，不要急着处理
                  if (msg.type === 'CHAMP_SELECT') setRawLcuData(msg.data);
                  if (msg.type === 'STATUS' && msg.data === 'connected') setLcuStatus("connected");
              } catch(e){}
          };
      };
      connect();
      return () => { if(ws) ws.close(); clearTimeout(timer); };
  }, []); // 🟢 空依赖数组：确保只运行一次，不会反复断开！

  // 🟢 新增：专门负责处理数据的 Effect
  // 只要 [rawLcuData] 有了，且 [championList] 加载完了，就立马处理显示
  useEffect(() => {
      if (rawLcuData && championList.length > 0) {
          handleLcuUpdate(rawLcuData);
      }
  }, [rawLcuData, championList]);


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
      setBlueTeam(mapTeam(session.myTeam));
      setRedTeam(mapTeam(session.theirTeam));
      const localPlayer = session.myTeam.find(p => p.cellId === session.localPlayerCellId);
      if (localPlayer) setUserSlot(localPlayer.cellId % 5);
  };

  // === 3. 业务逻辑 ===
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

  const handleAnalyze = async (mode) => {
      setAnalyzeType(mode); setIsAnalyzing(true); setAiResult(null);
      try {
          const res = await axios.post(`${API_BASE_URL}/analyze`, {
              mode, myHero: blueTeam[userSlot]?.name || "未知", 
              myTeam: blueTeam.map(c => c?.name || "未选"), enemyTeam: redTeam.map(c => c?.name || "未选"), userRole
          });
          setAiResult(res.data); 
      } catch (e) {
          setTimeout(() => {
             setAiResult({ concise: { title: "模拟分析", content: "后端未连接..." }, detailed_tabs: [] });
             setIsAnalyzing(false);
          }, 1500);
      } finally { setIsAnalyzing(false); }
  };

  const handleReportError = async () => {
    if (!currentUser) return setShowLoginModal(true);
    try {
        await authAxios.post(`/feedback`, {
            match_context: { myHero: blueTeam[userSlot]?.name, ai_summary: aiResult?.concise?.title }, description: inputContent
        });
        alert("反馈已提交"); setShowFeedbackModal(false); setInputContent("");
    } catch (e) { alert("提交失败"); }
  };

  // === 4. 渲染 ===
  return (
    <div className="min-h-screen bg-[#050508] text-slate-300 font-sans p-2 md:p-6 flex flex-col items-center">
      
      <Header 
        version={version} lcuStatus={lcuStatus} 
        userRole={userRole} setUserRole={setUserRole} 
        currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
      />

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左侧：我方阵容 + 移动端按钮 */}
        <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 px-2">
                <Shield size={14} /> ALLY TEAM
            </div>
            {blueTeam.map((c, i) => (
                <ChampCard key={i} champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} />
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
        
        {/* 右侧：敌方 + 社区 */}
        <div className="lg:col-span-3 flex flex-col gap-4">
             <div className="flex flex-col gap-3">
                <div className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 px-2">
                    <Crosshair size={14} /> ENEMY TEAM
                </div>
                {redTeam.map((c, i) => (
                    <ChampCard key={i} champ={c} idx={i} isEnemy={true} userSlot={userSlot} />
                ))}
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
    </div>
  );
}