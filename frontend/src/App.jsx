import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Shield, Users, Zap, Brain, Crosshair, RefreshCcw, ShieldAlert, RotateCcw, Trash2, GripHorizontal, Settings } from 'lucide-react';

// 组件引入
import AdminDashboard from './components/AdminDashboard';
import Header from './components/Header';
import ChampCard from './components/ChampCard';
import AnalysisResult from './components/AnalysisResult';
import CommunityTips from './components/CommunityTips';
import AnalysisButton from './components/AnalysisButton';
import InviteCard from './components/InviteCard';
// ... 其他 import
import ChampSelectModal from './components/modals/ChampSelectModal'; // 🟢 引入弹窗组件
// 模态框引入
import LoginModal from './components/modals/LoginModal';
import TipModal from './components/modals/TipModal';
import FeedbackModal from './components/modals/FeedbackModal';
import PricingModal from './components/modals/PricingModal';
import SettingsModal from './components/modals/SettingsModal'; // 🟢 新增设置组件

import { API_BASE_URL, BRIDGE_WS_URL, DDRAGON_BASE } from './config/constants';

// 辅助：加载本地缓存
const loadState = (key, defaultVal) => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) { return defaultVal; }
};

export default function App() {
  // ================= 1. 基础状态定义 =================
  const [version, setVersion] = useState("V15.2");
  const [championList, setChampionList] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // 🟢 悬浮窗与设置状态
  const [isOverlay, setIsOverlay] = useState(() => 
      window.location.href.includes('overlay=true')
  );

  useEffect(() => {
    // 🔴 修改 2：确保 class 也加上
    if (isOverlay) {
        document.body.classList.add('transparent-mode');
    }
  }, [isOverlay]);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentShortcuts, setCurrentShortcuts] = useState(null);

  // ✨✨✨ 新增：聊天发送触发器 ✨✨✨
  // 用来通知子组件 AnalysisResult 执行“提取并发送”操作
  const [sendChatTrigger, setSendChatTrigger] = useState(0);

  // 游戏数据状态
  const [blueTeam, setBlueTeam] = useState(() => loadState('blueTeam', Array(5).fill(null)));
  const [redTeam, setRedTeam] = useState(() => loadState('redTeam', Array(5).fill(null)));
  const [myTeamRoles, setMyTeamRoles] = useState(() => loadState('myTeamRoles', Array(5).fill("")));
  const [userRole, setUserRole] = useState(() => loadState('userRole', ''));
  const [lcuRealRole, setLcuRealRole] = useState("");
  const [userSlot, setUserSlot] = useState(0);
  const [lcuStatus, setLcuStatus] = useState("disconnected");
  const [userRank, setUserRank] = useState(() => loadState('userRank', 'Gold'));
  
  // 🟢 选人弹窗相关状态
  const [showChampSelector, setShowChampSelector] = useState(false);
  const [selectingSlot, setSelectingSlot] = useState(null); // 记录当前正在给哪个格子选英雄
  const [selectingIsEnemy, setSelectingIsEnemy] = useState(false); // 记录是给我方还是敌方选
  const [roleMapping, setRoleMapping] = useState({}); // 🟢 存储从后端获取的英雄分类数据
  
  const [enemyLaneAssignments, setEnemyLaneAssignments] = useState(() =>
      loadState('enemyLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
  );
  const [myLaneAssignments, setMyLaneAssignments] = useState(() =>
      loadState('myLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
  );

  // 分析相关状态
  const [useThinkingModel, setUseThinkingModel] = useState(() => loadState('useThinkingModel', false));
  const [aiResults, setAiResults] = useState(() => loadState('aiResults', { bp: null, personal: null, team: null }));
  const [analyzingStatus, setAnalyzingStatus] = useState({});
  const abortControllersRef = useRef({ bp: null, personal: null, team: null });
  const isModeAnalyzing = (mode) => !!analyzingStatus[mode];

  const [analyzeType, setAnalyzeType] = useState(() => loadState('analyzeType', 'bp'));
  const [viewMode, setViewMode] = useState('detailed');
  const [activeTab, setActiveTab] = useState(0); // 控制 AnalysisResult 内部的 Tab (详细/对线/团战)

  // 为了让 IPC 监听器能获取到最新的 analyzeType，我们需要一个 Ref
  const analyzeTypeRef = useRef(analyzeType);
  useEffect(() => { analyzeTypeRef.current = analyzeType; }, [analyzeType]);

  // 攻略与社区状态
  const [tipTarget, setTipTarget] = useState(null);
  const [tips, setTips] = useState({ general: [], matchup: [] });

  const [inputContent, setInputContent] = useState("");
  const [tipTargetEnemy, setTipTargetEnemy] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  // 用户与鉴权
  const [currentUser, setCurrentUser] = useState(null);
  const [accountInfo, setAccountInfo] = useState(null);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [rawLcuData, setRawLcuData] = useState(null);

  // ================= 2. Electron IPC 与 快捷键逻辑 =================

  // 检测是否为悬浮窗模式 (保留原有 logic 作为双重保险)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('overlay') === 'true') {
        setIsOverlay(true);
    }
  }, []);

  // 🟢 Electron IPC 通信：处理全局快捷键
  useEffect(() => {
      // 只有在 Electron 环境下才运行 (通过 window.require 判断)
      if (window.require) {
          try {
              const { ipcRenderer } = window.require('electron');

              // 1. 初始化：获取当前快捷键设置
              ipcRenderer.invoke('get-shortcuts').then(saved => {
                  if (saved) setCurrentShortcuts(saved);
              });

              // 2. 监听 Bridge 发来的快捷键指令
              const handleCommand = (event, command) => {
                  console.log("⚡ [Shortcut Triggered]:", command);

                  if (command === 'tab_bp') handleTabClick('bp');
                  if (command === 'tab_personal') handleTabClick('personal');
                  if (command === 'tab_team') handleTabClick('team');

                  if (command === 'nav_next') setActiveTab(prev => prev + 1);
                  if (command === 'nav_prev') setActiveTab(prev => Math.max(0, prev - 1));

                  if (command === 'refresh') {
                      // 使用 Ref 获取当前选中的模式，触发刷新
                      // 只有当前不处于分析状态时才刷新
                      document.getElementById('regenerate-btn')?.click();
                  }

                  // ✨✨✨ 新增：处理发送聊天指令 ✨✨✨
                  if (command === 'send_chat') {
                      console.log("收到快捷键，通知子组件发送聊天...");
                      // 更新触发器，子组件监听到变化后会自动提取内容并请求发送
                      setSendChatTrigger(prev => prev + 1);
                  }
              };

              ipcRenderer.on('shortcut-triggered', handleCommand);

              return () => {
                  ipcRenderer.removeListener('shortcut-triggered', handleCommand);
              };
          } catch (e) {
              console.log("非 Electron 环境，跳过 IPC 初始化");
          }
      }
  }, []);

  // 🟢 保存快捷键到后端
  const handleSaveShortcuts = (newShortcuts) => {
      setCurrentShortcuts(newShortcuts);
      if (window.require) {
          const { ipcRenderer } = window.require('electron');
          ipcRenderer.send('update-shortcuts', newShortcuts);
      }
  };

  // ================= 3. 数据持久化与初始化 =================

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

  // 🟢 核心功能：初始化加载英雄分类数据
  useEffect(() => {
      axios.get(`${API_BASE_URL}/champions/roles`)
          .then(res => setRoleMapping(res.data))
          .catch(e => console.error("获取英雄分类失败", e));
  }, []);

  // 🟢 核心功能：点击卡片打开选人弹窗
  const handleCardClick = (idx, isEnemy) => {
      setSelectingSlot(idx);
      setSelectingIsEnemy(isEnemy);
      setShowChampSelector(true);
  };

  // 🟢 核心功能：处理弹窗选人结果
  const handleSelectChampion = (hero) => {
      const newTeam = selectingIsEnemy ? [...redTeam] : [...blueTeam];
      newTeam[selectingSlot] = hero;
      
      if (selectingIsEnemy) {
          setRedTeam(newTeam);
      } else {
          setBlueTeam(newTeam);
      }
      setShowChampSelector(false);
  };

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

  // ================= 4. WebSocket 连接 =================
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

const normalizeKey = (key) => key ? key.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";

  const guessRoles = (team) => {
    const roles = { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" };
    const assignedIndices = new Set();
    
    // 定义查找函数：优先查 roleMapping，查不到再查 Tags
    const findHeroForRole = (roleId, tagFallbackFn) => {
        // 1. 优先：数据库匹配
        for (let i = 0; i < team.length; i++) {
            const hero = team[i];
            if (!hero || assignedIndices.has(i)) continue;

            const cleanKey = normalizeKey(hero.key);
            const cleanName = normalizeKey(hero.name);
            
            // 查表 (支持 ID 或 名字)
            const dbRoles = roleMapping[cleanKey] || roleMapping[cleanName];
            
            if (dbRoles && dbRoles.includes(roleId)) {
                assignedIndices.add(i);
                return hero.name;
            }
        }

        // 2. 兜底：如果数据库没数据，回退到 Tag 判断 (防止界面全空)
        for (let i = 0; i < team.length; i++) {
            const hero = team[i];
            if (!hero || assignedIndices.has(i)) continue;
            
            if (tagFallbackFn && tagFallbackFn(hero)) {
                assignedIndices.add(i);
                return hero.name;
            }
        }
        return "";
    };

    // 按特征明显程度排序：打野/辅助优先 -> ADC -> 中上
    roles["JUNGLE"] = findHeroForRole("JUNGLE", c => c.tags.includes("Jungle") || (c.tags.includes("Assassin") && !c.tags.includes("Mage")));
    roles["SUPPORT"] = findHeroForRole("SUPPORT", c => c.tags.includes("Support") || c.tags.includes("Tank"));
    roles["ADC"] = findHeroForRole("ADC", c => c.tags.includes("Marksman"));
    roles["MID"] = findHeroForRole("MID", c => c.tags.includes("Mage") || c.tags.includes("Assassin"));
    roles["TOP"] = findHeroForRole("TOP", c => c.tags.includes("Fighter") || c.tags.includes("Tank"));
    
    // 最后兜底：把剩下的英雄填入剩下的空位
    const remainingRoles = Object.keys(roles).filter(r => !roles[r]);
    remainingRoles.forEach(r => {
        for (let i = 0; i < team.length; i++) {
            if (team[i] && !assignedIndices.has(i)) {
                roles[r] = team[i].name;
                assignedIndices.add(i);
                break;
            }
        }
    });

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
                // 仅当当前位置没人，或者那个人已经不在敌方队伍里了 -> 才覆盖
                if (!currentAssignedName || !currentEnemies.includes(currentAssignedName)) {
                    if (guesses[role]) next[role] = guesses[role];
                }
            });
            return next;
        });
    }
  }, [redTeam, roleMapping]);

  // ================= 5. 鉴权与业务操作 =================

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

  // Tips 逻辑
  const fetchTips = async () => {
      const myHeroName = blueTeam[userSlot]?.name;
      if (!myHeroName) return;
      let target = tipTarget;
      if (!target) {
          if (userRole && enemyLaneAssignments[userRole]) target = enemyLaneAssignments[userRole];
          else if (userRole === 'JUNGLE') {
              const enemyJg = Object.values(enemyLaneAssignments).find(h => redTeam.find(c => c?.name === h)?.tags.includes("Jungle"))
                              || redTeam.find(c => c?.tags.includes("Jungle"))?.name;
              target = enemyJg;
          }
          if (!target) target = redTeam.find(c => c)?.name;
      }
      try {
        const res = await axios.get(`${API_BASE_URL}/tips`, { params: { hero: myHeroName, enemy: target || "None" } });
        setTips(res.data);
      } catch (e) {}
  };

  useEffect(() => { if (tipTarget) fetchTips(); }, [tipTarget]);
  useEffect(() => { setTipTarget(null); fetchTips(); }, [blueTeam[userSlot], enemyLaneAssignments, userRole, redTeam]);

  const handlePostTip = async (isGeneralIntent) => {
      if (!currentUser) return setShowLoginModal(true);
      if (!inputContent.trim()) return;
      const myHeroName = blueTeam[userSlot]?.name;
      const currentTarget = tipTarget || enemyLaneAssignments[userRole] || "general";
      const finalEnemyParam = isGeneralIntent ? "general" : currentTarget;
      try {
          await authAxios.post(`/tips`, { hero: myHeroName, enemy: finalEnemyParam, content: inputContent, is_general: isGeneralIntent });
          setInputContent(""); setShowTipModal(false); fetchTips();
      } catch(e) {}
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
  const handleReportError = async () => {
      if (!currentUser) return setShowLoginModal(true);
      try { await authAxios.post(`/feedback`, { match_context: { myHero: blueTeam[userSlot]?.name, mode: analyzeType }, description: inputContent }); alert("反馈已提交"); setShowFeedbackModal(false); setInputContent(""); } catch (e) {}
  };

  // 核心分析逻辑
  const handleTabClick = (mode) => {
      setAnalyzeType(mode);
      setActiveTab(0);
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
        if (hero && standardRole) { payloadAssignments[standardRole] = hero.key; }
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

  // =================================================================
  // 🟢 6. 渲染逻辑 A：悬浮窗模式 (精简版 UI)
  // =================================================================
  if (isOverlay) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-slate-900/95 backdrop-blur-md border border-hex-gold/30 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        
        {/* A. 顶部拖拽条 */}
        <div className="bg-hex-black/90 cursor-move drag-region select-none border-b border-hex-gold/20 flex flex-col shrink-0">
            <div className="h-6 flex items-center justify-between px-3">
                <div className="flex items-center gap-2 text-hex-gold text-[10px] font-bold tracking-widest opacity-70">
                    <GripHorizontal size={12} />
                    HEX COACH
                </div>
                
                <div className="flex items-center gap-2 no-drag">
                    {/* ⚙️ 设置按钮 (入口) */}
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="text-slate-500 hover:text-hex-gold transition-colors p-1"
                        title="设置全局快捷键"
                    >
                        <Settings size={12} />
                    </button>
                    
                    {/* 连接状态 */}
                    <div className={`w-1.5 h-1.5 rounded-full ${lcuStatus === 'connected' ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-red-500'}`}></div>
                </div>
            </div>

            {/* B. 大栏目 Tab */}
            <div className="flex border-t border-white/5 no-drag">
                {[
                    { id: 'bp', label: '1.BP', icon: <Users size={12}/> },
                    { id: 'personal', label: '2.私教', icon: <Zap size={12}/> },
                    { id: 'team', label: '3.指挥', icon: <Brain size={12}/> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold transition-all
                            ${analyzeType === tab.id
                                ? 'bg-hex-blue/10 text-hex-gold border-b-2 border-hex-gold'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-b-2 border-transparent'}`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>
        </div>

        {/* C. 核心内容区 (只保留中间分析台) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-transparent relative no-drag">
            {/* 背景纹理 */}
            <div className="absolute inset-0 bg-magic-pattern opacity-5 pointer-events-none z-0"></div>

            {aiResults[analyzeType] ? (
                <div className="h-full p-2">
                    <AnalysisResult
                        aiResult={aiResults[analyzeType]}
                        isAnalyzing={isModeAnalyzing(analyzeType)}
                        viewMode="concise"
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        setShowFeedbackModal={setShowFeedbackModal}
                        setFeedbackContent={setInputContent}
                        // 🟢 刷新回调
                        handleRegenerate={() => handleAnalyze(analyzeType, true)}
                        // ✨ 传入聊天触发器
                        sendChatTrigger={sendChatTrigger}
                    />
                    {/* 隐藏的刷新触发点，供快捷键调用 */}
                    <button
                        id="regenerate-btn"
                        className="hidden"
                        onClick={() => handleAnalyze(analyzeType, true)}
                    />
                </div>
            ) : (
                // 等待页面
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 opacity-60">
                    <div className="animate-pulse text-hex-gold"><Shield size={40} /></div>
                    <div className="text-center space-y-1">
                        <p className="text-xs font-bold">等待分析数据...</p>
                        <p className="text-[10px]">请在游戏选人阶段点击上方 Tab</p>
                    </div>
                    {/* 手动触发兜底 */}
                    <button
                        onClick={() => handleAnalyze(analyzeType)}
                        className="px-4 py-1.5 bg-hex-blue/20 text-hex-blue text-xs rounded border border-hex-blue/30 hover:bg-hex-blue/30 transition-all mt-2"
                    >
                        手动开始
                    </button>
                </div>
            )}
        </div>

        {/* D. 悬浮窗专用弹窗 */}
        <div className="no-drag">
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
            <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
            <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentShortcuts={currentShortcuts} onSave={handleSaveShortcuts} />
        </div>
      </div>
    );
  }

  // =================================================================
  // 🟢 7. 渲染逻辑 B：网页版 (完整 UI)
  // =================================================================
  return (
    <div className="min-h-screen">
      <div className="fixed top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-hex-gold/50 to-transparent z-50"></div>
      <div className="relative z-10 flex flex-col items-center p-4 md:p-8 max-w-[1800px] mx-auto">
        
        <Header
            version={version} lcuStatus={lcuStatus}
            userRole={userRole} setUserRole={setUserRole}
            currentUser={currentUser} logout={logout} setShowLoginModal={setShowLoginModal}
            useThinkingModel={useThinkingModel} setUseThinkingModel={setUseThinkingModel}
            setShowPricingModal={setShowPricingModal} accountInfo={accountInfo}
            userRank={userRank} setUserRank={setUserRank}
        />

        <div className="w-full mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* 左侧：我方 (Ally) */}
            <div className="lg:col-span-3 flex flex-col gap-5 sticky top-8">
                
                {/* 1. 阵容面板 */}
                <div className="bg-hex-dark border border-hex-gold/30 rounded shadow-hex relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-hex-blue to-transparent opacity-50"></div>
                    <div className="flex items-center justify-between px-3 py-2 bg-[#010A13]/80 border-b border-hex-gold/10">
                        <div className="flex items-center gap-2 text-hex-blue">
                            <Shield size={14} />
                            <span className="text-xs font-bold tracking-[0.15em] text-hex-gold-light uppercase">我方阵容</span>
                        </div>
                        <button onClick={handleClearSession} className="text-slate-500 hover:text-red-400 transition-colors opacity-50 hover:opacity-100">
                            <Trash2 size={12}/>
                        </button>
                    </div>
                    <div className="p-1 space-y-1 bg-hex-black/30">
                        {blueTeam.map((c, i) => (
                            <div 
                                key={i} 
                                // 点击卡片打开选人弹窗
                                onClick={() => handleCardClick(i, false)}
                                className={`cursor-pointer transition-all duration-300 ${userSlot === i ? 'bg-gradient-to-r from-hex-blue/20 to-transparent border-l-2 border-hex-blue' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
                            >
                                <ChampCard champ={c} idx={i} isEnemy={false} userSlot={userSlot} onSelectMe={setUserSlot} role={myTeamRoles[i]} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. 分路面板 */}
                <div className="p-3 bg-hex-dark border border-hex-gold/20 rounded shadow-lg relative">
                    <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-hex-gold/50"></div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-hex-blue rounded-full"></div>
                            <span className="text-[10px] font-bold text-hex-gold-light tracking-widest uppercase">本局分路</span>
                        </div>
                        <button onClick={() => setMyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-600 hover:text-hex-gold transition-colors">
                            <RefreshCcw size={10} />
                        </button>
                    </div>
                    <div className="flex flex-col gap-2">
                        {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => {
                             const lcuDefaultHero = blueTeam.find((_, i) => myTeamRoles[i] === role)?.name || "";
                             const isAssigned = !!myLaneAssignments[role];
                             return (
                                <div key={role} className="flex items-center justify-between gap-2 group">
                                    <label className="text-[9px] uppercase text-slate-500 font-bold w-8 text-right group-hover:text-hex-blue transition-colors">{role.substring(0,3)}</label>
                                    <div className={`flex-1 relative h-6 rounded bg-hex-black border transition-all ${isAssigned ? 'border-hex-blue shadow-[0_0_5px_rgba(10,200,185,0.2)]' : 'border-hex-gold/10 hover:border-hex-gold/30'}`}>
                                        <select
                                            className="w-full h-full bg-transparent text-[10px] text-center font-bold text-slate-300 outline-none appearance-none cursor-pointer absolute inset-0 z-10"
                                            value={myLaneAssignments[role] || lcuDefaultHero}
                                            onChange={(e) => setMyLaneAssignments({...myLaneAssignments, [role]: e.target.value})}
                                        >
                                            <option value="">-</option>
                                            {blueTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                                        </select>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                </div>

                {/* 3. 🟢 新增：邀请有礼卡片 (仅登录后显示) */}
                {token && currentUser && (
                    <InviteCard 
                        token={token}
                        username={currentUser}
                        onUpdateSuccess={() => {
                            // 兑换成功后，刷新用户信息(更新Pro时间和R1额度)
                            fetchUserInfo();
                        }}
                    />
                )}
            </div>
            
            {/* 中间：核心分析台 (完整版) */}
            <div className="lg:col-span-6 flex flex-col gap-0 min-h-[600px]">
                {/* 🟢 1. 在这里插入 AnalysisButton 组件 */}
                <div className="mb-4 px-1">
                    <AnalysisButton 
                        selectedHero={blueTeam[userSlot]} 
                        // 🟢 修改点：传入 -1 作为特殊标记，表示“我要从现有阵容里选自己”
                        onOpenChampSelect={() => {
                            setSelectingSlot(-1); 
                            setShowChampSelector(true);
                        }} 
                        onResult={(res) => setAiResults(prev => ({ ...prev, [analyzeType]: res }))} 
                        setLoading={(val) => setAnalyzingStatus(prev => ({ ...prev, [analyzeType]: val }))} 
                        isAnalyzing={isModeAnalyzing(analyzeType)} 
                        currentUser={currentUser}
                        userRole={accountInfo?.role}
                    />
                </div>
                {/* Tab */}
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

                {/* 内容 */}
                <div className="relative flex-1 flex flex-col bg-hex-dark border-x border-b border-hex-gold/30 rounded-b-lg shadow-hex p-1">
                    <div className="absolute inset-0 bg-magic-pattern opacity-5 pointer-events-none z-0"></div>
                    {/* 刷新 */}
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
                            setFeedbackContent={setInputContent}
                            // ✨ 传入聊天触发器
                            sendChatTrigger={sendChatTrigger}
                        />
                    </div>
                </div>
            </div>
            
            {/* 右侧：敌方 (Enemy) */}
            <div className="lg:col-span-3 flex flex-col gap-5 sticky top-8">
                {/* 敌方阵容 */}
                <div className="bg-[#1a0505] border border-red-900/30 rounded shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-[#2a0a0a]/50 border-b border-red-900/20">
                        <div className="flex items-center gap-2 text-red-500">
                            <Crosshair size={14} />
                            <span className="text-xs font-bold tracking-[0.15em] text-red-200 uppercase">敌方阵容</span>
                        </div>
                    </div>
                    <div className="p-1 space-y-1 bg-black/20">
                        {redTeam.map((c, i) => (
                            <div 
                                key={i} 
                                // 🟢 修改：添加 onClick 事件打开弹窗
                                onClick={() => handleCardClick(i, true)}
                                className="cursor-pointer hover:bg-red-900/10 rounded transition-colors border-l-2 border-transparent hover:border-red-800"
                            >
                                <ChampCard champ={c} idx={i} isEnemy={true} userSlot={userSlot} role={Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === c?.name)?.substring(0,3) || ""} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 敌方分路 */}
                <div className="p-3 bg-[#1a0505] border border-red-900/20 rounded shadow-lg relative">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-red-600 rounded-full"></div>
                            <span className="text-[10px] font-bold text-red-200 tracking-widest uppercase">敌方分路</span>
                        </div>
                        <button onClick={() => setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })} className="text-slate-600 hover:text-red-400 transition-colors">
                            <RefreshCcw size={10} />
                        </button>
                    </div>
                    <div className="flex flex-col gap-2">
                        {["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].map(role => (
                            <div key={role} className="flex items-center justify-between gap-2 group">
                                <label className="text-[9px] uppercase text-slate-600 font-bold w-8 text-right group-hover:text-red-400 transition-colors">{role.substring(0,3)}</label>
                                <div className={`flex-1 relative h-6 rounded bg-[#0a0202] border transition-all ${enemyLaneAssignments[role] ? 'border-red-600/50 shadow-[0_0_5px_rgba(220,38,38,0.2)]' : 'border-red-900/20 hover:border-red-900/40'}`}>
                                    <select
                                        className="w-full h-full bg-transparent text-[10px] text-center font-bold text-slate-300 outline-none appearance-none cursor-pointer absolute inset-0 z-10"
                                        value={enemyLaneAssignments[role]}
                                        onChange={(e) => setEnemyLaneAssignments({...enemyLaneAssignments, [role]: e.target.value})}
                                    >
                                        <option value="">-</option>
                                        {redTeam.map((c, i) => c?.name ? <option key={i} value={c.name}>{c.name}</option> : null)}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* 社区 Tips */}
                <div className="flex-1 min-h-[300px] bg-hex-dark border border-hex-gold/20 rounded shadow-xl overflow-hidden flex flex-col">
                    <CommunityTips
                        tips={tips}
                        currentUser={currentUser}
                        currentHero={blueTeam[userSlot]?.name}
                        currentTarget={tipTarget || enemyLaneAssignments[userRole]}
                        allies={blueTeam}
                        enemies={redTeam}
                        onTargetChange={(newTarget) => setTipTarget(newTarget)}
                        userRole={userRole}
                        onOpenPostModal={(isGeneralIntent) => {
                            if(!currentUser) setShowLoginModal(true);
                            else {
                                const currentT = tipTarget || enemyLaneAssignments[userRole];
                                setTipTargetEnemy(isGeneralIntent ? null : currentT);
                                setShowTipModal(true);
                            }
                        }}
                        onLike={handleLike}
                        onDelete={handleDeleteTip}
                    />
                </div>
            </div>
        </div>

        {/* 模态框组件 (完整版) */}
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} setAuthForm={setAuthForm} handleLogin={handleLogin} handleRegister={handleRegister} />
        <TipModal 
            isOpen={showTipModal} 
            onClose={() => setShowTipModal(false)} 
            content={inputContent} 
            setContent={setInputContent} 
            onSubmit={() => handlePostTip(false)}
            heroName={blueTeam[userSlot]?.name || "英雄"}
            targetName={tipTargetEnemy} 
        />
        <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} content={inputContent} setContent={setInputContent} onSubmit={handleReportError} />
        <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} username={currentUser} />
        <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} currentShortcuts={currentShortcuts} onSave={handleSaveShortcuts} />
        
                {/* 🟢 渲染选人弹窗 */}
        <ChampSelectModal
            isOpen={showChampSelector}
            onClose={() => setShowChampSelector(false)}
            
            // 🟢 核心修改 1：动态列表
            // 如果是选主视角 (-1)，只显示我方已有的英雄；否则显示全英雄
            championList={
                selectingSlot === -1 
                ? blueTeam.filter(c => c !== null) 
                : championList
            }
            
            // 🟢 核心修改 2：动态回调
            onSelect={(hero) => {
                if (selectingSlot === -1) {
                    // A. 切换视角模式：找到这个英雄在队伍里的位置，设为“我”
                    const idx = blueTeam.findIndex(c => c && c.key === hero.key);
                    if (idx !== -1) {
                        setUserSlot(idx);
                        // 顺便自动更新用户角色 (如果有分路数据)
                        if (myTeamRoles[idx]) setUserRole(myTeamRoles[idx]);
                    }
                    setShowChampSelector(false);
                } else {
                    // B. 修改阵容模式：走原有逻辑
                    handleSelectChampion(hero);
                }
            }}
            
            roleMapping={roleMapping} 
            
            // 智能预选分路 (保持原样，或者在视角模式下传 undefined 既然人少不需要筛选)
            initialRoleIndex={
                selectingSlot === -1 
                ? undefined 
                : (selectingIsEnemy 
                    ? ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].indexOf(Object.keys(enemyLaneAssignments).find(k => enemyLaneAssignments[k] === redTeam[selectingSlot]?.name))
                    : ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].indexOf(myTeamRoles[selectingSlot]))
            }
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