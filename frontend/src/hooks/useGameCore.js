import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_BASE_URL, BRIDGE_WS_URL, DDRAGON_BASE } from '../config/constants';

// 辅助：加载本地缓存
const loadState = (key, defaultVal) => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) { return defaultVal; }
};

export function useGameCore() {
    // ================= 1. 基础状态定义 =================
    const [version, setVersion] = useState("V15.2");
    const [championList, setChampionList] = useState([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    // 页面状态
    const [isOverlay, setIsOverlay] = useState(() => window.location.href.includes('overlay=true'));
    const [hasStarted, setHasStarted] = useState(() => window.location.href.includes('overlay=true'));
    const [showCommunity, setShowCommunity] = useState(false);

    useEffect(() => {
        if (isOverlay) document.body.classList.add('transparent-mode');
    }, [isOverlay]);

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [currentShortcuts, setCurrentShortcuts] = useState(null);
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
    const [extraMechanics, setExtraMechanics] = useState({});
    
    // 🔥🔥🔥【关键修复1】增加持久化，防止刷新后丢失方位 🔥🔥🔥
    const [mapSide, setMapSide] = useState(() => loadState('mapSide', "unknown")); 

    // 选人弹窗
    const [showChampSelector, setShowChampSelector] = useState(false);
    const [selectingSlot, setSelectingSlot] = useState(null); 
    const [selectingIsEnemy, setSelectingIsEnemy] = useState(false); 
    const [roleMapping, setRoleMapping] = useState({}); 

    // 分路
    const [enemyLaneAssignments, setEnemyLaneAssignments] = useState(() =>
        loadState('enemyLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
    );
    const [myLaneAssignments, setMyLaneAssignments] = useState(() =>
        loadState('myLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
    );

    // 分析状态
    const [useThinkingModel, setUseThinkingModel] = useState(() => loadState('useThinkingModel', false));
    const [aiResults, setAiResults] = useState(() => loadState('aiResults', { bp: null, personal: null, team: null }));
    const [analyzingStatus, setAnalyzingStatus] = useState({});
    const abortControllersRef = useRef({ bp: null, personal: null, team: null });
    const isModeAnalyzing = (mode) => !!analyzingStatus[mode];

    const [analyzeType, setAnalyzeType] = useState(() => loadState('analyzeType', 'bp'));
    const [viewMode, setViewMode] = useState('detailed');
    const [activeTab, setActiveTab] = useState(0); 

    const analyzeTypeRef = useRef(analyzeType);
    useEffect(() => { analyzeTypeRef.current = analyzeType; }, [analyzeType]);

    // 攻略与社区
    const [tipTarget, setTipTarget] = useState(null);
    const [tips, setTips] = useState({ general: [], matchup: [] });
    const [inputContent, setInputContent] = useState("");
    const [tipTargetEnemy, setTipTargetEnemy] = useState(null);
    const [showTipModal, setShowTipModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);

    // 用户
    const [currentUser, setCurrentUser] = useState(null);
    const [accountInfo, setAccountInfo] = useState(null);
    const [token, setToken] = useState(null);
    const [authMode, setAuthMode] = useState("login");
    const [authForm, setAuthForm] = useState({ username: "", password: "" });
    const [rawLcuData, setRawLcuData] = useState(null);

    // ================= 2. Electron IPC (核心通信逻辑) =================
    useEffect(() => {
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                
                // 初始化获取快捷键
                ipcRenderer.invoke('get-shortcuts').then(savedConfig => {
                    if (savedConfig) setCurrentShortcuts(savedConfig);
                });

                const handleElectronLcuUpdate = (event, data) => {
                    if (!data) return;

                    // 🔥🔥🔥【关键修复2】独立接收方位，不再受 championList 为空的影响 🔥🔥🔥
                    if (data.mapSide && data.mapSide !== "unknown") {
                        console.log("📍 前端收到方位更新:", data.mapSide);
                        setMapSide(data.mapSide);
                    }

                    if (data.extraMechanics) {
                        setExtraMechanics(data.extraMechanics);
                    }

                    // 只有当英雄列表加载完毕后，才处理阵容数据
                    if (championList.length > 0) {
                        const adaptedSession = {
                            // 1. 处理我方数据
                            myTeam: (data.myTeam || []).map(p => ({
                                cellId: p.cellId,
                                championId: p.championId, 
                                championName: (p.championId === 0 || !p.championId) ? "未选" : (p.championName || "未知英雄"),
                                summonerName: p.summonerName || "",
                                assignedPosition: p.assignedPosition || "" // 确保有位置信息 (top, jungle 等)
                            })),
                            // 2. 处理敌方数据
                            theirTeam: (data.enemyTeam || []).map(p => ({
                                cellId: p.cellId,
                                championId: p.championId,
                                championName: (p.championId === 0 || !p.championId) ? "未选" : (p.championName || "未知英雄"),
                                summonerName: p.summonerName || "",
                                assignedPosition: p.assignedPosition || ""
                            })),
                            
                            localPlayerCellId: data.localPlayerCellId || -1
                        };
                        handleLcuUpdate(adaptedSession);
                        setLcuStatus("connected");
                    }
                };

                const handleRemoteSync = (event, remoteData) => {
                    if (remoteData && remoteData.results) {
                        setAiResults(remoteData.results);
                        if (remoteData.currentMode) {
                            setAnalyzeType(remoteData.currentMode);
                        }
                    }
                };

                const handleCommand = (event, command) => {
                    const MODES = ['bp', 'personal', 'team'];

                    // 1. 模式切换 (静默循环)
                    if (command === 'mode_prev') {
                        const currentIndex = MODES.indexOf(analyzeTypeRef.current);
                        const prevIndex = (currentIndex - 1 + MODES.length) % MODES.length;
                        handleTabClick(MODES[prevIndex]);
                    }
                    if (command === 'mode_next') {
                        const currentIndex = MODES.indexOf(analyzeTypeRef.current);
                        const nextIndex = (currentIndex + 1) % MODES.length;
                        handleTabClick(MODES[nextIndex]);
                    }
                    
                    // 2. 内容翻页 (修复双重弹窗问题)
                    if (command === 'nav_next') {
                        setActiveTab(prev => {
                            if (prev >= 3) {
                                // 🔥 加上 id: 'nav-limit'，防止 React 严格模式下弹出两次
                                toast("已是最后一页", { icon: '🛑', duration: 800, id: 'nav-limit' });
                                return 3; 
                            }
                            return prev + 1; 
                        }); 
                    }
                    if (command === 'nav_prev') {
                        setActiveTab(prev => {
                            if (prev <= 0) {
                                // 🔥 加上 id: 'nav-limit'，防止 React 严格模式下弹出两次
                                toast("已是第一页", { icon: '🛑', duration: 800, id: 'nav-limit' });
                                return 0; 
                            }
                            return prev - 1; 
                        });
                    }
                    
                    // 3. 刷新
                    if (command === 'refresh') {
                        handleAnalyze(analyzeTypeRef.current, true);
                        toast("正在刷新...", { icon: '⏳', duration: 800, id: 'refresh-toast' });
                    }
                };

                const handleShortcutsUpdated = (event, newConfig) => {
                    setCurrentShortcuts(newConfig);
                };

                ipcRenderer.on('lcu-update', handleElectronLcuUpdate);
                ipcRenderer.on('sync-analysis', handleRemoteSync);
                ipcRenderer.on('shortcut-triggered', handleCommand);
                ipcRenderer.on('shortcuts-updated', handleShortcutsUpdated);
                
                // 🔥🔥🔥【关键修复3】主动向主进程索要缓存数据 🔥🔥🔥
                ipcRenderer.send('fetch-lcu-data');

                return () => {
                    ipcRenderer.removeListener('lcu-update', handleElectronLcuUpdate);
                    ipcRenderer.removeListener('sync-analysis', handleRemoteSync);
                    ipcRenderer.removeListener('shortcut-triggered', handleCommand);
                    ipcRenderer.removeListener('shortcuts-updated', handleShortcutsUpdated);
                };
            } catch (e) {
                console.error("Electron IPC init failed:", e);
            }
        }
    }, [championList]); // 依赖 championList，确保列表加载后能处理积压的 update

    const handleSaveShortcuts = (newShortcuts) => {
        setCurrentShortcuts(newShortcuts);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-shortcuts', newShortcuts);
        }
    };

    // ================= 3. 数据持久化 & 初始化 =================
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
    // 🔥 缓存方位，防止刷新后丢失
    useEffect(() => { localStorage.setItem('mapSide', mapSide); }, [mapSide]);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/champions/roles`)
            .then(res => setRoleMapping(res.data))
            .catch(e => console.error(e));
            
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
    useEffect(() => { if (token) fetchUserInfo(); else setAccountInfo(null); }, [token]);

    // ================= 4. WebSocket (Web 端兼容) & 结果广播 =================
    const wsRef = useRef(null);

    // 连接 Bridge 并接收消息 (非 Electron 环境使用)
    useEffect(() => {
        if (window.require) return; // 如果在 Electron 中，跳过 WebSocket 连接，直接走 IPC

        let ws; let timer;
        const connect = () => {
            ws = new WebSocket(BRIDGE_WS_URL);
            wsRef.current = ws;

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
                        else if(msg.data === 'disconnected') { setLcuStatus("disconnected"); setLcuRealRole(""); }
                    }
                    if (msg.type === 'ALERT') {
                        toast(msg.data.content, { icon: '🚨', duration: 5000, style: { background: '#450a0a', color: '#fecaca' } });
                    }
                } catch(e){}
            };
        };
        connect(); 
        return () => { if(ws) ws.close(); clearTimeout(timer); };
    }, []);

    // 🔥 核心：当分析结果变化时，广播给 Electron 或 WebSocket
    useEffect(() => {
        // 1. WebSocket 广播 (Web 模式)
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && aiResults) {
            wsRef.current.send(JSON.stringify({
                type: "SYNC_AI_RESULT",
                data: { results: aiResults, currentMode: analyzeType }
            }));
        }

        // 2. Electron IPC 广播 (本地应用模式)
        if (window.require && aiResults) {
            try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('analysis-result', {
                    results: aiResults,
                    currentMode: analyzeType
                });
            } catch (e) {}
        }
    }, [aiResults, analyzeType]);

    useEffect(() => { if (rawLcuData && championList.length > 0) handleLcuUpdate(rawLcuData); }, [rawLcuData, championList]);

    // LCU 数据处理逻辑
    const handleLcuUpdate = (session) => {
        if (!session || championList.length === 0) return;
        if (session.mapSide && session.mapSide !== "unknown") {
            console.log("🌐 [Web] WebSocket 收到方位更新:", session.mapSide);
            setMapSide(session.mapSide);
        }

        if (session.extraMechanics) {
            setExtraMechanics(session.extraMechanics);
        }
        // 映射队伍 ID 到英雄对象
        const mapTeam = (teamArr) => {
            const result = Array(5).fill(null);
            teamArr.forEach(p => {
                // Electron 传来的 cellId 可能不规范，如果数据源直接是 index 也兼容
                const idx = (p.cellId !== undefined) ? p.cellId % 5 : -1; 
                // 如果 idx 无效（如 -1），说明可能需要另一种方式映射，这里暂按 cellId 处理
                
                if (p.championId && p.championId !== 0 && idx >= 0 && idx < 5) {
                    const hero = championList.find(c => c.id == p.championId);
                    if (hero) result[idx] = hero;
                }
            });
            return result;
        };

        // 如果 session.myTeam 是数组，直接处理
        if (Array.isArray(session.myTeam)) {
            const newBlue = mapTeam(session.myTeam);
            // 这里假设 enemyTeam 也是类似结构
            const enemyArr = session.theirTeam || session.enemyTeam || []; // 兼容不同命名
            const newRed = mapTeam(enemyArr);
            
            if (newBlue.some(c => c !== null) || newRed.some(c => c !== null)) { 
                setBlueTeam(newBlue); 
                setRedTeam(newRed); 
            }

            const roles = Array(5).fill("");
            const lcuRoleMap = { "TOP": "TOP", "JUNGLE": "JUNGLE", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUPPORT" };
            session.myTeam.forEach(p => {
                const idx = p.cellId % 5;
                const rawRole = p.assignedPosition?.toUpperCase();
                if (rawRole && lcuRoleMap[rawRole] && idx >= 0) roles[idx] = lcuRoleMap[rawRole];
            });
            if (roles.some(r => r !== "")) setMyTeamRoles(roles);

            // 尝试定位自己
            if (session.localPlayerCellId !== undefined) {
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
            }
        }
    };

    // 智能分路推断
    const normalizeKey = (key) => key ? key.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";
    const guessRoles = (team) => {
        const roles = { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" };
        const assignedIndices = new Set();
        const findHeroForRole = (roleId, tagFallbackFn) => {
            for (let i = 0; i < team.length; i++) {
                const hero = team[i];
                if (!hero || assignedIndices.has(i)) continue;
                const cleanKey = normalizeKey(hero.key);
                const cleanName = normalizeKey(hero.name);
                const dbRoles = roleMapping[cleanKey] || roleMapping[cleanName];
                if (dbRoles && dbRoles.includes(roleId)) {
                    assignedIndices.add(i);
                    return hero.name;
                }
            }
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
        roles["JUNGLE"] = findHeroForRole("JUNGLE", c => c.tags.includes("Jungle") || (c.tags.includes("Assassin") && !c.tags.includes("Mage")));
        roles["SUPPORT"] = findHeroForRole("SUPPORT", c => c.tags.includes("Support") || c.tags.includes("Tank"));
        roles["ADC"] = findHeroForRole("ADC", c => c.tags.includes("Marksman"));
        roles["MID"] = findHeroForRole("MID", c => c.tags.includes("Mage") || c.tags.includes("Assassin"));
        roles["TOP"] = findHeroForRole("TOP", c => c.tags.includes("Fighter") || c.tags.includes("Tank"));
        
        Object.keys(roles).filter(r => !roles[r]).forEach(r => {
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
                    if (!currentAssignedName || !currentEnemies.includes(currentAssignedName)) {
                        if (guesses[role]) next[role] = guesses[role];
                    }
                });
                return next;
            });
        }
    }, [redTeam, roleMapping]);

    // ================= 5. 业务操作实现 =================

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
        try { await axios.post(`${API_BASE_URL}/register`, authForm); alert("注册成功"); setAuthMode("login"); } catch (e) { alert("注册失败"); }
    };
    const logout = () => {
        setToken(null); setCurrentUser(null); setAccountInfo(null);
        localStorage.removeItem("access_token"); localStorage.removeItem("username");
    };

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

    const handleTabClick = (mode) => {
        setAnalyzeType(mode);
        setActiveTab(0);
    };

    const handleCardClick = (idx, isEnemy) => {
        setSelectingSlot(idx);
        setSelectingIsEnemy(isEnemy);
        setShowChampSelector(true);
    };

    const handleSelectChampion = (hero) => {
        const newTeam = selectingIsEnemy ? [...redTeam] : [...blueTeam];
        newTeam[selectingSlot] = hero;
        selectingIsEnemy ? setRedTeam(newTeam) : setBlueTeam(newTeam);
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
        setMapSide("unknown"); // 重置方位
        ['blueTeam','redTeam','myTeamRoles','enemyLaneAssignments','myLaneAssignments','aiResults', 'mapSide'].forEach(k => localStorage.removeItem(k));
    };

    // 核心分析逻辑 (包含流式读取和广播)
    const handleAnalyze = async (mode, forceRestart = false) => {
        if (!token) { setAuthMode('login'); setShowLoginModal(true); return; }
        if (analyzingStatus[mode] && !forceRestart) return;

        if (abortControllersRef.current[mode]) abortControllersRef.current[mode].abort();
        const newController = new AbortController(); abortControllersRef.current[mode] = newController;

        setAnalyzingStatus(prev => ({ ...prev, [mode]: true }));
        setAiResults(prev => ({ ...prev, [mode]: null })); // 🔥 这里更新 state 会自动触发 useEffect 广播 "空" 状态

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
                mapSide: mapSide, // 🔥🔥🔥【修改】直接使用 state 变量，而不是未定义的 lcuData 🔥🔥🔥
                rank: userRank,
                extraMechanics: extraMechanics,
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
                    setAiResults(prev => ({ ...prev, [mode]: accumulatedText })); // 🔥 关键：每次流更新，都会触发 useEffect 广播
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
            setAiResults(prev => ({ ...prev, [mode]: JSON.stringify({ concise: { title: "错误", content: error.message || "网络异常" } })}));
        } finally {
            if (abortControllersRef.current[mode] === newController) { setAnalyzingStatus(prev => ({ ...prev, [mode]: false })); fetchUserInfo(); }
        }
    };

    return {
        state: {
            version, championList, showAdminPanel, isOverlay, hasStarted, showCommunity,
            showSettingsModal, currentShortcuts, sendChatTrigger,
            blueTeam, redTeam, myTeamRoles, userRole, lcuStatus, userRank,
            enemyLaneAssignments, myLaneAssignments,
            useThinkingModel, aiResults, analyzingStatus, isModeAnalyzing, analyzeType, viewMode, activeTab,
            showChampSelector, selectingSlot, selectingIsEnemy, roleMapping,
            currentUser, accountInfo, token, authMode, authForm, showLoginModal, showPricingModal,
            tips, tipTarget, inputContent, tipTargetEnemy, showTipModal, showFeedbackModal, userSlot
        },
        actions: {
            setHasStarted, setShowCommunity, setShowAdminPanel, setShowSettingsModal,
            setBlueTeam, setRedTeam, setUserRole, setUserRank, setMyLaneAssignments, setEnemyLaneAssignments,
            setUseThinkingModel, setAnalyzeType, setAiResults, setViewMode, setActiveTab,
            setShowChampSelector, setSelectingSlot, setSelectingIsEnemy,
            setAuthMode, setAuthForm, setShowLoginModal, setShowPricingModal,
            setInputContent, setShowTipModal, setShowFeedbackModal, setTipTarget, setUserSlot,
            
            handleLogin, handleRegister, logout, handleClearSession, handleAnalyze, fetchUserInfo,
            handleCardClick, handleSelectChampion, handleSaveShortcuts,
            handlePostTip, handleLike, handleDeleteTip, handleReportError, handleTabClick
        }
    };
}