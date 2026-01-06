import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_BASE_URL, BRIDGE_WS_URL, DDRAGON_BASE } from '../config/constants';

const loadState = (key, defaultVal) => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) { return defaultVal; }
};

export function useGameCore() {
    const [version, setVersion] = useState("V15.2");
    const [championList, setChampionList] = useState([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [adminView, setAdminView] = useState('dashboard');
    const [isOverlay, setIsOverlay] = useState(() => window.location.href.includes('overlay=true'));
    const [hasStarted, setHasStarted] = useState(() => window.location.href.includes('overlay=true'));
    const [showCommunity, setShowCommunity] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    
    useEffect(() => {
        if (isOverlay) document.body.classList.add('transparent-mode');
    }, [isOverlay]);

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [currentShortcuts, setCurrentShortcuts] = useState(null);
    const [sendChatTrigger, setSendChatTrigger] = useState(0);
    const [showSalesDashboard, setShowSalesDashboard] = useState(false);
    
    const [blueTeam, setBlueTeam] = useState(() => loadState('blueTeam', Array(5).fill(null)));
    const [redTeam, setRedTeam] = useState(() => loadState('redTeam', Array(5).fill(null)));
    const [myTeamRoles, setMyTeamRoles] = useState(() => loadState('myTeamRoles', Array(5).fill("")));
    const [userRole, setUserRole] = useState(() => loadState('userRole', ''));
    const [lcuRealRole, setLcuRealRole] = useState("");
    const [userSlot, setUserSlot] = useState(0);
    const [lcuStatus, setLcuStatus] = useState("disconnected");
    const [userRank, setUserRank] = useState(() => loadState('userRank', 'Gold'));
    const [mapSide, setMapSide] = useState(() => loadState('mapSide', "unknown"));
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [extraMechanics, setExtraMechanics] = useState({});
    const [gamePhase, setGamePhase] = useState("None"); 
    const [lcuProfile, setLcuProfile] = useState(null);

    const [showChampSelector, setShowChampSelector] = useState(false);
    const [selectingSlot, setSelectingSlot] = useState(null); 
    const [selectingIsEnemy, setSelectingIsEnemy] = useState(false); 
    const [roleMapping, setRoleMapping] = useState({}); 

    const [enemyLaneAssignments, setEnemyLaneAssignments] = useState(() =>
        loadState('enemyLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
    );
    const [myLaneAssignments, setMyLaneAssignments] = useState(() =>
        loadState('myLaneAssignments', { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" })
    );

    const [useThinkingModel, setUseThinkingModel] = useState(() => loadState('useThinkingModel', false));
    const [aiResults, setAiResults] = useState(() => loadState('aiResults', { bp: null, personal: null, team: null }));
    const aiResultsRef = useRef(aiResults);
    useEffect(() => { aiResultsRef.current = aiResults; }, [aiResults]);

    const [analyzingStatus, setAnalyzingStatus] = useState({});
    const abortControllersRef = useRef({ bp: null, personal: null, team: null });
    const isModeAnalyzing = (mode) => !!analyzingStatus[mode];

    const [analyzeType, setAnalyzeType] = useState(() => loadState('analyzeType', 'personal'));
    const [viewMode, setViewMode] = useState('detailed');
    const [activeTab, setActiveTab] = useState(0); 
    const analyzeTypeRef = useRef(analyzeType);
    useEffect(() => { analyzeTypeRef.current = analyzeType; }, [analyzeType]);

    const [tipTarget, setTipTarget] = useState(null);
    const [tips, setTips] = useState({ general: [], matchup: [] });
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

    const wsRef = useRef(null);
    const isRemoteUpdate = useRef(false); // 🔥 防止循环广播标记

    const broadcastState = (type, payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data: payload }));
        }
    };

    // 1. 监听分路变化并广播
    useEffect(() => {
        if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
        if (Object.keys(myLaneAssignments).some(k => myLaneAssignments[k])) {
            broadcastState('SYNC_LANE_ASSIGNMENTS', { my: myLaneAssignments, enemy: enemyLaneAssignments });
        }
    }, [myLaneAssignments, enemyLaneAssignments]);

    // 2. 监听阵容变化并广播
    useEffect(() => {
         if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
         if (blueTeam.some(c => c) || redTeam.some(c => c)) {
             broadcastState('SYNC_TEAM_DATA', { blueTeam, redTeam });
         }
    }, [blueTeam, redTeam]);

    // 🔥 [核心修复] 辅助函数：标准化名称 (去空格/小写)
    const normalizeKey = (key) => key ? key.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";

    // 🔥 [核心修复] 猜测分路逻辑 (复用于敌我双方)
    const guessRoles = (team) => {
        const roles = { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" };
        const assignedIndices = new Set();
        
        const findHeroForRole = (roleId, tagFallbackFn) => {
            // 1. 优先查数据库预设分路 (Role Mapping)
            for (let i = 0; i < team.length; i++) {
                const hero = team[i];
                if (!hero || assignedIndices.has(i)) continue;
                const cleanKey = normalizeKey(hero.key);
                const cleanName = normalizeKey(hero.name);
                const dbRoles = roleMapping[cleanKey] || roleMapping[cleanName];
                if (dbRoles && dbRoles.includes(roleId)) { assignedIndices.add(i); return hero.name; }
            }
            // 2. 兜底查 Tags (Marksman, Mage, etc.)
            for (let i = 0; i < team.length; i++) {
                const hero = team[i];
                if (!hero || assignedIndices.has(i)) continue;
                if (tagFallbackFn && tagFallbackFn(hero)) { assignedIndices.add(i); return hero.name; }
            }
            return "";
        };

        roles["JUNGLE"] = findHeroForRole("JUNGLE", c => c.tags.includes("Jungle") || (c.tags.includes("Assassin") && !c.tags.includes("Mage")));
        roles["SUPPORT"] = findHeroForRole("SUPPORT", c => c.tags.includes("Support") || c.tags.includes("Tank"));
        roles["ADC"] = findHeroForRole("ADC", c => c.tags.includes("Marksman"));
        roles["MID"] = findHeroForRole("MID", c => c.tags.includes("Mage") || c.tags.includes("Assassin"));
        roles["TOP"] = findHeroForRole("TOP", c => c.tags.includes("Fighter") || c.tags.includes("Tank"));
        
        // 3. 填补剩余空位
        Object.keys(roles).filter(r => !roles[r]).forEach(r => {
            for (let i = 0; i < team.length; i++) {
                if (team[i] && !assignedIndices.has(i)) {
                    roles[r] = team[i].name; assignedIndices.add(i); break;
                }
            }
        });
        return roles;
    };

    // 🔥 [核心修复] 自动同步我方分路 (解决 MF 显示在 MID 的问题)
    useEffect(() => {
        // 只有当阵容非空时才执行
        if (blueTeam.some(c => c !== null)) {
            setMyLaneAssignments(prev => {
                const next = { ...prev };
                
                // 策略 A: 优先使用 LCU 分配的位置 (myTeamRoles)
                let usedLcuRoles = false;
                const usedNames = new Set();

                blueTeam.forEach((hero, idx) => {
                    if (!hero) return;
                    const assignedRole = myTeamRoles[idx]; // "TOP", "JUNGLE" ...
                    
                    if (assignedRole && ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].includes(assignedRole)) {
                        next[assignedRole] = hero.name; // 强行校准：该位置就是这个英雄
                        usedNames.add(hero.name);
                        usedLcuRoles = true;
                    }
                });

                // 策略 B: 如果 LCU 没给位置 (比如盲选)，则使用猜测算法
                if (!usedLcuRoles) {
                    const guesses = guessRoles(blueTeam);
                    Object.keys(guesses).forEach(role => {
                        if (guesses[role]) next[role] = guesses[role];
                    });
                } else {
                    // 清理不在当前阵容里的旧数据
                    const currentNames = blueTeam.map(c => c?.name).filter(Boolean);
                    Object.keys(next).forEach(r => {
                        if (next[r] && !currentNames.includes(next[r])) next[r] = "";
                    });
                }

                // 只有数据真的变了才更新，避免死循环
                if (JSON.stringify(prev) !== JSON.stringify(next)) {
                    return next;
                }
                return prev;
            });
        }
    }, [blueTeam, myTeamRoles, roleMapping]);

    // 自动同步敌方分路 (保持不变)
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

    // WebSocket / IPC 逻辑保持不变，确保 isRemoteUpdate 正常工作
    useEffect(() => {
        if (window.require) return; 
        let ws; let timer;
        const connect = () => {
            ws = new WebSocket(BRIDGE_WS_URL);
            wsRef.current = ws;
            ws.onopen = () => setLcuStatus("connected");
            ws.onclose = () => { setLcuStatus("disconnected"); setLcuRealRole(""); timer = setTimeout(connect, 3000); };
            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'CHAMP_SELECT') setRawLcuData(msg.data);
                    if (msg.type === 'STATUS') {
                        if(msg.data === 'connected') setLcuStatus("connected");
                        else if(msg.data === 'disconnected') { setLcuStatus("disconnected"); setLcuRealRole(""); }
                    }
                    if (msg.type === 'LCU_PROFILE_UPDATE') {
                        setLcuProfile(msg.data);
                        if (token) axios.post(`${API_BASE_URL}/users/sync_profile`, msg.data, { headers: { Authorization: `Bearer ${token}` } }).catch(e=>{});
                    }
                    // 同步处理
                    if (msg.type === 'SYNC_LANE_ASSIGNMENTS') {
                        isRemoteUpdate.current = true;
                        if (JSON.stringify(myLaneAssignments) !== JSON.stringify(msg.data.my)) setMyLaneAssignments(msg.data.my);
                        if (JSON.stringify(enemyLaneAssignments) !== JSON.stringify(msg.data.enemy)) setEnemyLaneAssignments(msg.data.enemy);
                    }
                    if (msg.type === 'SYNC_TEAM_DATA') {
                         isRemoteUpdate.current = true;
                         setBlueTeam(msg.data.blueTeam);
                         setRedTeam(msg.data.redTeam);
                    }
                    if (msg.type === 'SYNC_AI_RESULT') {
                        const { results, currentMode } = msg.data;
                        if (results) setAiResults(results);
                        if (currentMode) setAnalyzeType(currentMode);
                    }
                } catch(e){}
            };
        };
        connect(); 
        return () => { if(ws) ws.close(); clearTimeout(timer); };
    }, [token, myLaneAssignments, enemyLaneAssignments, blueTeam, redTeam]);

    useEffect(() => {
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.invoke('get-shortcuts').then(savedConfig => { if (savedConfig) setCurrentShortcuts(savedConfig); });

                const handleElectronLcuUpdate = (event, data) => {
                    if (!data) return;
                    if (data.mapSide && data.mapSide !== "unknown") setMapSide(data.mapSide);
                    if (data.extraMechanics) setExtraMechanics(data.extraMechanics);
                    if (championList.length > 0) {
                        const adaptedSession = {
                            myTeam: (data.myTeam || []).map(p => ({
                                cellId: p.cellId,
                                championId: p.championId, 
                                championName: (p.championId === 0 || !p.championId) ? "未选" : (p.championName || "未知英雄"),
                                summonerName: p.summonerName || "",
                                assignedPosition: p.assignedPosition || "" 
                            })),
                            theirTeam: (data.enemyTeam || []).map(p => ({
                                cellId: p.cellId,
                                championId: p.championId,
                                championName: (p.championId === 0 || !p.championId) ? "未选" : (p.championName || "未知英雄"),
                                summonerName: p.summonerName || "",
                                assignedPosition: p.assignedPosition || ""
                            })),
                            localPlayerCellId: data.localPlayerCellId !== undefined ? data.localPlayerCellId : -1
                        };
                        handleLcuUpdate(adaptedSession);
                        setLcuStatus("connected");
                    }
                };
            
                const handleLcuProfileUpdate = (event, profileData) => {
                    setLcuProfile(profileData);
                    if (token) axios.post(`${API_BASE_URL}/users/sync_profile`, profileData, { headers: { Authorization: `Bearer ${token}` } }).catch(e=>{});
                };

                const handleRemoteSync = (event, remoteData) => {
                    if (remoteData && remoteData.results) {
                        setAiResults(remoteData.results);
                        if (remoteData.currentMode) setAnalyzeType(remoteData.currentMode);
                    }
                };

                const handleBroadcastSync = (event, msg) => {
                    if (msg.type === 'SYNC_LANE_ASSIGNMENTS') {
                        isRemoteUpdate.current = true;
                        setMyLaneAssignments(msg.data.my);
                        setEnemyLaneAssignments(msg.data.enemy);
                    }
                    if (msg.type === 'SYNC_TEAM_DATA') {
                        isRemoteUpdate.current = true;
                        setBlueTeam(msg.data.blueTeam);
                        setRedTeam(msg.data.redTeam);
                    }
                };

                const handleCommand = (event, command) => {
                    const MODES = ['bp', 'personal', 'team'];
                    if (command === 'mode_prev') handleTabClick(MODES[(MODES.indexOf(analyzeTypeRef.current) - 1 + MODES.length) % MODES.length]);
                    if (command === 'mode_next') handleTabClick(MODES[(MODES.indexOf(analyzeTypeRef.current) + 1) % MODES.length]);
                    if (command === 'refresh') { handleAnalyze(analyzeTypeRef.current, true); toast("正在刷新...", { icon: '⏳', duration: 800 }); }
                };

                const handleShortcutsUpdated = (event, newConfig) => setCurrentShortcuts(newConfig);
                const handleOpenSettings = () => setShowSettingsModal(true);
                const handleGamePhaseUpdate = (event, phase) => setGamePhase(phase);

                ipcRenderer.on('lcu-update', handleElectronLcuUpdate);
                ipcRenderer.on('lcu-profile-update', handleLcuProfileUpdate);
                ipcRenderer.on('sync-analysis', handleRemoteSync);
                ipcRenderer.on('shortcut-triggered', handleCommand);
                ipcRenderer.on('shortcuts-updated', handleShortcutsUpdated);
                ipcRenderer.on('open-settings', handleOpenSettings); 
                ipcRenderer.on('game-phase', handleGamePhaseUpdate);
                ipcRenderer.on('broadcast-sync', handleBroadcastSync);

                ipcRenderer.send('fetch-lcu-data');

                return () => {
                    ipcRenderer.removeListener('lcu-update', handleElectronLcuUpdate);
                    ipcRenderer.removeListener('lcu-profile-update', handleLcuProfileUpdate);
                    ipcRenderer.removeListener('sync-analysis', handleRemoteSync);
                    ipcRenderer.removeListener('shortcut-triggered', handleCommand);
                    ipcRenderer.removeListener('shortcuts-updated', handleShortcutsUpdated);
                    ipcRenderer.removeListener('open-settings', handleOpenSettings); 
                    ipcRenderer.removeListener('game-phase', handleGamePhaseUpdate);
                    ipcRenderer.removeListener('broadcast-sync', handleBroadcastSync);
                };
            } catch (e) { console.error("IPC Error", e); }
        }
    }, [championList, token]); 

    // 辅助函数保持不变
    const handleSaveShortcuts = (newShortcuts) => {
        setCurrentShortcuts(newShortcuts);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-shortcuts', newShortcuts);
        }
    };
    
    const handleSyncProfile = useCallback(() => {
        if (window.require) window.require('electron').ipcRenderer.send('req-lcu-profile'); 
        else if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'REQ_LCU_PROFILE' }));
    }, []); 

    const hasAutoSynced = useRef(false);
    useEffect(() => {
        if (lcuStatus === 'connected') {
            if (hasAutoSynced.current) return;
            const timer = setTimeout(() => { handleSyncProfile(); hasAutoSynced.current = true; }, 1000);
            return () => clearTimeout(timer);
        } else if (lcuStatus === 'disconnected') hasAutoSynced.current = false;
    }, [lcuStatus, handleSyncProfile]);

    // LocalStorage Sync
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
    useEffect(() => { localStorage.setItem('mapSide', mapSide); }, [mapSide]);

    // Init & Auth
    useEffect(() => {
        axios.get(`${API_BASE_URL}/champions/roles`).then(res => setRoleMapping(res.data)).catch(e => console.error(e));
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
        instance.interceptors.request.use(config => { if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
        return instance;
    }, [token]);

    const fetchUserInfo = async () => {
        if (!token) return;
        try { const res = await authAxios.get('/users/me'); setAccountInfo(res.data); } catch (e) {}
    };
    useEffect(() => { if (token) fetchUserInfo(); else setAccountInfo(null); }, [token]);
    useEffect(() => { if (rawLcuData && championList.length > 0) handleLcuUpdate(rawLcuData); }, [rawLcuData, championList]);

    const handleLcuUpdate = (session) => {
        if (!session || championList.length === 0) return;
        if (session.mapSide && session.mapSide !== "unknown") setMapSide(session.mapSide);
        if (session.extraMechanics) setExtraMechanics(session.extraMechanics);
        
        const mapTeam = (teamArr) => {
            const result = Array(5).fill(null);
            teamArr.forEach(p => {
                const idx = (p.cellId !== undefined) ? p.cellId % 5 : -1; 
                if (p.championId && p.championId !== 0 && idx >= 0 && idx < 5) {
                    const hero = championList.find(c => c.id == p.championId);
                    if (hero) result[idx] = hero;
                }
            });
            return result;
        };

        if (Array.isArray(session.myTeam)) {
            const newBlue = mapTeam(session.myTeam);
            const enemyArr = session.theirTeam || session.enemyTeam || []; 
            const newRed = mapTeam(enemyArr);
            
            if (newBlue.some(c => c !== null) || newRed.some(c => c !== null)) { 
                setBlueTeam(newBlue); setRedTeam(newRed); 
            }

            const roles = Array(5).fill("");
            const lcuRoleMap = { "TOP": "TOP", "JUNGLE": "JUNGLE", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUPPORT" };
            session.myTeam.forEach(p => {
                const idx = p.cellId % 5;
                const rawRole = p.assignedPosition?.toUpperCase();
                if (rawRole && lcuRoleMap[rawRole] && idx >= 0) roles[idx] = lcuRoleMap[rawRole];
            });
            if (roles.some(r => r !== "")) setMyTeamRoles(roles);

            if (session.localPlayerCellId !== undefined && session.localPlayerCellId !== -1) {
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

    // ... (handleLogin, handleRegister, logout, etc 保持不变)
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
        try { 
            const payload = { ...authForm, sales_ref: authForm.sales_ref || localStorage.getItem('sales_ref') || null };
            await axios.post(`${API_BASE_URL}/register`, payload); 
            alert("注册成功"); setAuthMode("login"); localStorage.removeItem('sales_ref');
        } catch (e) { alert(e.response?.data?.detail || "注册失败"); }
    };
    const logout = () => { setToken(null); setCurrentUser(null); setAccountInfo(null); localStorage.removeItem("access_token"); localStorage.removeItem("username"); };

    const fetchTips = async (targetOverride = null) => {
        const myHeroName = blueTeam[userSlot]?.name;
        if (!myHeroName) return;
        let target = targetOverride || tipTarget;
        if (!target) {
            if (userRole && enemyLaneAssignments[userRole]) target = enemyLaneAssignments[userRole];
            else if (userRole === 'JUNGLE') {
                const enemyJg = Object.values(enemyLaneAssignments).find(h => redTeam.find(c => c?.name === h)?.tags.includes("Jungle")) || redTeam.find(c => c?.tags.includes("Jungle"))?.name;
                target = enemyJg;
            }
            if (!target) target = redTeam.find(c => c)?.name;
        }
        try { const res = await axios.get(`${API_BASE_URL}/tips`, { params: { hero: myHeroName, enemy: target || "None" } }); setTips(res.data); } catch (e) {}
    };
    useEffect(() => { if (tipTarget) fetchTips(); }, [tipTarget]);
    useEffect(() => { setTipTarget(null); fetchTips(); }, [blueTeam[userSlot], enemyLaneAssignments, userRole, redTeam]);

    const handlePostTip = async (modalTarget, modalCategory) => {
        if (!currentUser) return setShowLoginModal(true);
        if (!inputContent.trim()) return;
        const myHeroName = blueTeam[userSlot]?.name;
        const isGeneralIntent = ["高光", "讨论", "求助", "吐槽"].includes(modalCategory);
        let finalEnemyParam = isGeneralIntent ? "general" : modalTarget;
        if (!isGeneralIntent && (!finalEnemyParam || finalEnemyParam === "上单对位")) finalEnemyParam = tipTarget || enemyLaneAssignments[userRole];
        try {
            await authAxios.post(`/tips`, { hero: myHeroName, enemy: finalEnemyParam, content: inputContent, is_general: isGeneralIntent });
            setInputContent(""); setShowTipModal(false); 
            if (!isGeneralIntent && finalEnemyParam) setTipTarget(finalEnemyParam);
            fetchTips(finalEnemyParam); toast.success("发布成功！");
        } catch(e) { toast.error("发布失败，请重试"); }
    };
    const handleLike = async (tipId) => { if (!currentUser) return setShowLoginModal(true); try { await authAxios.post(`/like`, { tip_id: tipId }); fetchTips(); } catch(e){} };
    const handleDeleteTip = async (tipId) => { if (!currentUser) return setShowLoginModal(true); if(!confirm("确定删除？")) return; try { await authAxios.delete(`/tips/${tipId}`); fetchTips(); } catch (e) {} };
    const handleReportError = async () => {
        if (!currentUser) return setShowLoginModal(true);
        const contextData = { mode: analyzeType, myHero: blueTeam[userSlot]?.name || "Unknown", userRole: userRole, mapSide: mapSide, myTeam: blueTeam.map(c => c?.name || "Empty"), enemyTeam: redTeam.map(c => c?.name || "Empty"), laneAssignments: { my: myLaneAssignments, enemy: enemyLaneAssignments } };
        try { await authAxios.post(`/feedback`, { match_context: contextData, description: inputContent }); toast.success("反馈已提交", { icon: '📸' }); setShowFeedbackModal(false); setInputContent(""); } catch (e) { toast.error("反馈提交失败"); }
    };

    const handleTabClick = (mode) => { setAnalyzeType(mode); setActiveTab(0); };
    const handleCardClick = (idx, isEnemy) => { setSelectingSlot(idx); setSelectingIsEnemy(isEnemy); setShowChampSelector(true); };
    const handleSelectChampion = (hero) => {
        const isEnemy = selectingIsEnemy;
        const currentTeam = isEnemy ? [...redTeam] : [...blueTeam];
        const currentAssignments = isEnemy ? { ...enemyLaneAssignments } : { ...myLaneAssignments };
        const setAssignments = isEnemy ? setEnemyLaneAssignments : setMyLaneAssignments;
        const setTeam = isEnemy ? setRedTeam : setBlueTeam;

        const oldHero = currentTeam[selectingSlot];
        currentTeam[selectingSlot] = hero;
        setTeam(currentTeam);
        
        const SLOT_TO_ROLE = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
        let targetRole = null;
        if (oldHero && oldHero.name) targetRole = Object.keys(currentAssignments).find(role => currentAssignments[role] === oldHero.name);
        if (!targetRole) targetRole = SLOT_TO_ROLE[selectingSlot];

        if (targetRole) {
            const newName = hero ? hero.name : "";
            if (currentAssignments[targetRole] !== newName) {
                const newAssignments = { ...currentAssignments, [targetRole]: newName };
                setAssignments(newAssignments);
            }
        }
        setShowChampSelector(false);
    };

    const handleClearSession = () => {
        if(!confirm("确定要清空当前对局记录吗？")) return;
        setBlueTeam(Array(5).fill(null)); setRedTeam(Array(5).fill(null));
        setMyTeamRoles(Array(5).fill(""));
        setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" });
        setMyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" });
        setAiResults({ bp: null, personal: null, team: null });
        setMapSide("unknown"); 
        ['blueTeam','redTeam','myTeamRoles','enemyLaneAssignments','myLaneAssignments','aiResults', 'mapSide'].forEach(k => localStorage.removeItem(k));
    };

    const handleAnalyze = async (mode, forceRestart = false) => {
        if (!token) { setAuthMode('login'); setShowLoginModal(true); return; }
        if (analyzingStatus[mode] && !forceRestart) return;
        if (abortControllersRef.current[mode]) abortControllersRef.current[mode].abort();
        const newController = new AbortController(); abortControllersRef.current[mode] = newController;

        setAnalyzingStatus(prev => ({ ...prev, [mode]: true }));
        setAiResults(prev => { const next = { ...prev }; next[mode] = null; if (mode === 'personal') next['role_jungle_farming'] = null; else if (mode === 'role_jungle_farming') next['personal'] = null; return next; });

        const baseResultsSnapshot = { ...aiResultsRef.current };
        let targetSlot = userSlot;
        let myHeroObj = blueTeam[userSlot];

        if (!myHeroObj) {
            const firstNonEmptyIndex = blueTeam.findIndex(h => h !== null);
            if (firstNonEmptyIndex !== -1) {
                targetSlot = firstNonEmptyIndex; myHeroObj = blueTeam[firstNonEmptyIndex]; setUserSlot(firstNonEmptyIndex); 
                const SLOT_TO_ROLE = { 0: "TOP", 1: "JUNGLE", 2: "MID", 3: "ADC", 4: "SUPPORT" };
                if (!lcuRealRole) setUserRole(SLOT_TO_ROLE[firstNonEmptyIndex]);
            }
        }

        const payloadAssignments = {};
        blueTeam.forEach((hero, idx) => {
            const roleMap = { "TOP": "TOP", "JUG": "JUNGLE", "JUNGLE": "JUNGLE", "MID": "MID", "ADC": "ADC", "BOTTOM": "ADC", "SUP": "SUPPORT", "SUPPORT": "SUPPORT" };
            const rawRole = myTeamRoles[idx];
            const standardRole = roleMap[rawRole] || rawRole;
            if (hero && standardRole) { payloadAssignments[standardRole] = hero.key; }
        });
        Object.keys(myLaneAssignments).forEach(role => {
            const heroName = myLaneAssignments[role];
            if (heroName) { const hero = blueTeam.find(h => h?.name === heroName); if (hero) payloadAssignments[role] = hero.key; }
        });

        let finalUserRole = lcuRealRole || userRole;
        if (!finalUserRole) { const SLOT_TO_ROLE = { 0: "TOP", 1: "JUNGLE", 2: "MID", 3: "ADC", 4: "SUPPORT" }; finalUserRole = SLOT_TO_ROLE[targetSlot] || "MID"; }
        const myHeroName = myHeroObj?.name;
        if (myHeroName) { const manualRole = Object.keys(myLaneAssignments).find(r => myLaneAssignments[r] === myHeroName); if (manualRole) finalUserRole = manualRole; }

        if (!myHeroObj) {
            setAiResults(prev => ({ ...prev, [mode]: JSON.stringify({ concise: { title: "无法识别英雄", content: "请先在左侧点击圆圈选择您的英雄，或等待游戏内自动同步。" } })}));
            setAnalyzingStatus(prev => ({ ...prev, [mode]: false }));
            return;
        }

        try {
            let enemySide = "unknown";
            if (mapSide === "blue") enemySide = "red"; else if (mapSide === "red") enemySide = "blue";

            const payload = {
                mode, myHero: myHeroObj.key, 
                myTeam: blueTeam.map(c => c?.key || ""), enemyTeam: redTeam.map(c => c?.key || ""),
                userRole: finalUserRole, mapSide: mapSide, enemySide: enemySide, rank: userRank,
                myLaneAssignments: Object.keys(payloadAssignments).length > 0 ? payloadAssignments : null,
                enemyLaneAssignments: (() => {
                    const clean = {};
                    Object.keys(enemyLaneAssignments).forEach(k => { const heroName = enemyLaneAssignments[k]; const heroObj = redTeam.find(c => c?.name === heroName); if(heroObj) clean[k] = heroObj.key; });
                    return Object.keys(clean).length > 0 ? clean : null;
                })(),
                model_type: useThinkingModel ? "reasoner" : "chat"
            };

            const response = await fetch(`${API_BASE_URL}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload), signal: newController.signal });

            if (!response.ok) { 
                if (response.status === 401) { setShowLoginModal(true); throw new Error("登录过期"); } 
                try { const errorText = await response.text(); const errorJson = JSON.parse(errorText); if (errorJson.concise) { setAiResults(prev => ({ ...prev, [mode]: JSON.stringify(errorJson) })); return; } if (errorJson.detail) throw new Error(errorJson.detail); } catch (parseErr) {}
                throw new Error(`请求失败: ${response.status}`); 
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false; let accumulatedText = ""; let lastStreamTime = 0;

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    accumulatedText += chunk;
                    setAiResults(prev => ({ ...prev, [mode]: accumulatedText })); 
                    const now = Date.now();
                    if (now - lastStreamTime > 100) {
                        const streamData = { results: { ...baseResultsSnapshot, [mode]: accumulatedText }, currentMode: mode };
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "SYNC_AI_RESULT", data: streamData }));
                        else if (window.require) { try { const { ipcRenderer } = window.require('electron'); ipcRenderer.send('analysis-result', streamData); } catch(e) {} }
                        lastStreamTime = now;
                    }
                }
            }
            const finalData = { results: { ...baseResultsSnapshot, [mode]: accumulatedText }, currentMode: mode };
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "SYNC_AI_RESULT", data: finalData }));
            else if (window.require) { try { const { ipcRenderer } = window.require('electron'); ipcRenderer.send('analysis-result', finalData); } catch(e) {} }

        } catch (error) {
            if (error.name === 'AbortError') return;
            const errorData = { concise: { title: "错误", content: error.message || "网络异常" } };
            const errorString = JSON.stringify(errorData);
            setAiResults(prev => ({ ...prev, [mode]: errorString }));
            const errorPayload = { results: { ...baseResultsSnapshot, [mode]: errorString }, currentMode: mode };
            if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "SYNC_AI_RESULT", data: errorPayload }));
        } finally {
            if (abortControllersRef.current[mode] === newController) { setAnalyzingStatus(prev => ({ ...prev, [mode]: false })); fetchUserInfo(); }
        }
    };
    const handleClearAnalysis = (mode) => {
        setAiResults(prev => ({ ...prev, [mode]: null }));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { const baseResultsSnapshot = { ...aiResultsRef.current, [mode]: null }; wsRef.current.send(JSON.stringify({ type: "SYNC_AI_RESULT", data: { results: baseResultsSnapshot, currentMode: mode } })); }
    };
    
    return {
        state: { version, championList, showAdminPanel, adminView,isOverlay, hasStarted, showCommunity, showProfile, showSettingsModal, currentShortcuts, sendChatTrigger, blueTeam, redTeam, myTeamRoles, userRole, lcuStatus, userRank, enemyLaneAssignments, myLaneAssignments, useThinkingModel, aiResults, analyzingStatus, isModeAnalyzing, analyzeType, viewMode, activeTab, showChampSelector, selectingSlot, selectingIsEnemy, roleMapping, currentUser, accountInfo, token, authMode, authForm, showLoginModal, showPricingModal, tips, tipTarget, inputContent, tipTargetEnemy, showTipModal, showFeedbackModal, userSlot, mapSide,showDownloadModal, showSalesDashboard,lcuProfile, gamePhase },
        actions: { setHasStarted, setShowCommunity, setShowProfile, setShowAdminPanel,setAdminView, setShowSettingsModal, setBlueTeam, setRedTeam, setUserRole, setUserRank, setMyLaneAssignments, setEnemyLaneAssignments, setUseThinkingModel, setAnalyzeType, setAiResults, setViewMode, setActiveTab, setShowChampSelector, setSelectingSlot, setSelectingIsEnemy, setAuthMode, setAuthForm, setShowLoginModal, setShowPricingModal, setInputContent, setShowTipModal, setShowFeedbackModal, setTipTarget, setUserSlot, handleLogin, handleRegister, logout, handleClearSession, handleAnalyze, fetchUserInfo, handleCardClick, handleSelectChampion, handleSaveShortcuts, handlePostTip, handleLike, handleDeleteTip, handleReportError, handleTabClick,setMapSide, setShowDownloadModal, setShowSalesDashboard,handleSyncProfile,handleClearAnalysis }
    };
}