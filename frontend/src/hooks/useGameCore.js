import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_BASE_URL, BRIDGE_WS_URL, DDRAGON_BASE } from '../config/constants';
import { fetchMatchTips } from '../api/GlobalAPI';
const loadState = (key, defaultVal) => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) { return defaultVal; }
};

// 🔥 [配置] 默认演示阵容
const DEFAULT_BLUE = [
    { key: "Malphite", name: "熔岩巨兽", title: "墨菲特", tags: ["Tank", "Fighter"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/Malphite.png" },
    { key: "LeeSin", name: "盲僧", title: "李青", tags: ["Fighter", "Assassin"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/LeeSin.png" },
    { key: "Ahri", name: "九尾妖狐", title: "阿狸", tags: ["Mage", "Assassin"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/Ahri.png" },
    { key: "Jinx", name: "暴走萝莉", title: "金克丝", tags: ["Marksman"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/Jinx.png" },
    { key: "Thresh", name: "魂锁典狱长", title: "锤石", tags: ["Support", "Fighter"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/Thresh.png" }
];

const DEFAULT_RED = [
    { key: "Aatrox", name: "暗裔剑魔", title: "亚托克斯", tags: ["Fighter", "Tank"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/Aatrox.png" },
    { key: "JarvanIV", name: "德玛西亚皇子", title: "嘉文四世", tags: ["Tank", "Fighter"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/JarvanIV.png" },
    { key: "Syndra", name: "暗黑元首", title: "辛德拉", tags: ["Mage"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/Syndra.png" },
    { key: "Kaisa", name: "虚空之女", title: "卡莎", tags: ["Marksman"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/Kaisa.png" },
    { key: "Nautilus", name: "深海泰坦", title: "诺提勒斯", tags: ["Tank", "Support"], image_url: "https://game.gtimg.cn/images/lol/act/img/champion/Nautilus.png" }
];

// 强制预设位置
const DEFAULT_ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

const DEFAULT_MY_LANES = { "TOP": "熔岩巨兽", "JUNGLE": "盲僧", "MID": "九尾妖狐", "ADC": "暴走萝莉", "SUPPORT": "魂锁典狱长" };
const DEFAULT_ENEMY_LANES = { "TOP": "暗裔剑魔", "JUNGLE": "德玛西亚皇子", "MID": "暗黑元首", "ADC": "虚空之女", "SUPPORT": "深海泰坦" };

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
    
    // 默认加载演示阵容
    const [blueTeam, setBlueTeam] = useState(() => loadState('blueTeam', DEFAULT_BLUE));
    const [redTeam, setRedTeam] = useState(() => loadState('redTeam', DEFAULT_RED));
    
    // 默认使用标准位置数组
    const [myTeamRoles, setMyTeamRoles] = useState(() => loadState('myTeamRoles', DEFAULT_ROLES));
    
    const [userRole, setUserRole] = useState(() => loadState('userRole', 'JUNGLE'));
    const [lcuRealRole, setLcuRealRole] = useState("");
    
    // 默认选中盲僧 (Index 1)
    const [userSlot, setUserSlot] = useState(() => {
        const saved = localStorage.getItem('userSlot');
        return saved ? JSON.parse(saved) : 1; 
    });

    const [lcuStatus, setLcuStatus] = useState("disconnected");
    const [userRank, setUserRank] = useState(() => loadState('userRank', 'Gold'));
    
    // 默认设置为蓝色方 (Blue Side)
    const [mapSide, setMapSide] = useState(() => loadState('mapSide', "blue"));
    
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [extraMechanics, setExtraMechanics] = useState({});
    const [gamePhase, setGamePhase] = useState("None"); 
    const [lcuProfile, setLcuProfile] = useState(null);

    const [showChampSelector, setShowChampSelector] = useState(false);
    const [selectingSlot, setSelectingSlot] = useState(null); 
    const [selectingIsEnemy, setSelectingIsEnemy] = useState(false); 
    const [roleMapping, setRoleMapping] = useState({}); 

    const [enemyLaneAssignments, setEnemyLaneAssignments] = useState(() =>
        loadState('enemyLaneAssignments', DEFAULT_ENEMY_LANES)
    );
    const [myLaneAssignments, setMyLaneAssignments] = useState(() =>
        loadState('myLaneAssignments', DEFAULT_MY_LANES)
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
    const isRemoteUpdate = useRef(false);
    
    // 🔥 [核心] 同步锁：防止 LCU 反复抢夺视角 (修复跳回一楼问题)
    const hasSyncedUserSlot = useRef(false); 

    const broadcastState = (type, payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data: payload }));
        }
    };

    // 🔥 [新增] 自动同步真实段位
    // 作用：当检测到 LCU 或 账号数据中有段位信息时，自动更新 userRank
    // 这样发送给后端的 payload 里就会包含 "Diamond" 或 "Emerald"，从而触发不同的推荐逻辑
    useEffect(() => {
        const realRank = lcuProfile?.rank || accountInfo?.game_profile?.rank;
        // 过滤无效段位
        if (realRank && realRank !== "Unranked" && realRank !== "UNRANKED") {
            if (userRank !== realRank) {
                // console.log(`📍 [AutoSync] 检测到真实段位 ${realRank}，已同步`);
                setUserRank(realRank);
            }
        }
    }, [lcuProfile, accountInfo]);

    useEffect(() => {
        if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
        if (Object.keys(myLaneAssignments).some(k => myLaneAssignments[k])) {
            broadcastState('SYNC_LANE_ASSIGNMENTS', { my: myLaneAssignments, enemy: enemyLaneAssignments });
        }
    }, [myLaneAssignments, enemyLaneAssignments]);

    useEffect(() => {
         if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
         if (blueTeam.some(c => c) || redTeam.some(c => c)) {
             broadcastState('SYNC_TEAM_DATA', { blueTeam, redTeam });
         }
    }, [blueTeam, redTeam]);

    const normalizeKey = (key) => key ? key.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";

    // 增强版分路猜测算法
    const guessRoles = (team) => {
        const roles = { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" };
        const assignedIndices = new Set();
        const norm = (str) => str ? str.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";

        const FORCE_JUNGLE = ["LeeSin", "RekSai", "Sylas", "BelVeth", "Nidalee", "Aatrox", "Jayce", "Shaco", "XinZhao", "Warwick", "Zaahen", "Karthus", "Ivern", "Ekko", "Zac", "Nunu", "Wukong", "KhaZix", "Lillia", "Kindred", "Evelynn", "Viego", "Rammus", "JarvanIV", "Briar", "MasterYi", "Graves", "DrMundo", "Hecarim", "Nocturne", "Vi", "Trundle", "Kayn", "Sejuani", "Udyr", "Skarner", "Fiddlesticks", "Amumu", "Maokai", "Volibear", "Diana", "Taliyah", "Zyra", "Brand", "Morgana"];
        const FORCE_ADC = ["MissFortune", "Ashe", "Lucian", "Jhin", "Kaisa", "Jinx", "Swain", "Aphelios", "Sivir", "Tristana", "Ezreal", "Smolder", "Yunara", "Vayne", "Draven", "Xayah", "Samira", "Caitlyn", "Ziggs", "KogMaw", "Zeri", "Twitch", "Varus", "Nilah", "Corki", "Kalista"];
        const FORCE_SUP = ["Leona", "Braum", "Poppy", "Karma", "Bard", "Thresh", "Pyke", "Nautilus", "Blitzcrank", "Lulu", "Zilean", "Nami", "Seraphine", "Neeko", "Rell", "VelKoz", "Rakan", "Alistar", "Milio", "Taric", "Soraka", "Senna", "Xerath", "Yuumi", "Lux", "Janna", "TahmKench", "Sona", "Renata", "Pantheon"];
        const FORCE_MID = ["Zoe", "Ahri", "Viktor", "Orianna", "Katarina", "TwistedFate", "Qiyana", "LeBlanc", "Akali", "Vex", "Syndra", "Zed", "Anivia", "Talon", "Naafiri", "Fizz", "Veigar", "Akshan", "Galio", "Hwei", "Malzahar", "Ryze", "Lissandra", "AurelionSol", "Yone", "Kassadin", "Annie", "Aurora", "Mel", "Azir", "Yasuo", "Cassiopeia", "Vladimir", "Irelia"];
        const FORCE_TOP = ["Malphite", "Ambessa", "Singed", "Kennen", "Olaf", "Jax", "Gangplank", "Sion", "Rumble", "Fiora", "Renekton", "Riven", "Sett", "Darius", "Heimerdinger", "Quinn", "Shen", "Kled", "Garen", "Camille", "Gnar", "Urgot", "Gragas", "Mordekaiser", "Teemo", "KSante", "Gwen", "Kayle", "Ornn", "Yorick", "Nasus", "Illaoi", "Rengar", "ChoGath", "Tryndamere"];

        const checkWhitelist = (hero, list) => { if (!hero) return false; return list.some(n => norm(n) === norm(hero.key) || norm(n) === norm(hero.id)); };
        const checkDB = (hero, roleId) => { if (!hero) return false; const cleanKey = norm(hero.key); const cleanName = norm(hero.name); const dbRoles = roleMapping[cleanKey] || roleMapping[cleanName]; return dbRoles && dbRoles.includes(roleId); };
        const checkTags = (hero, tag) => { return hero?.tags?.some(t => t.toLowerCase() === tag.toLowerCase()); };

        const PHASE_1_ORDER = ["JUNGLE", "ADC", "SUPPORT", "MID", "TOP"];
        const LIST_MAP = { "JUNGLE": FORCE_JUNGLE, "ADC": FORCE_ADC, "SUPPORT": FORCE_SUP, "MID": FORCE_MID, "TOP": FORCE_TOP };

        PHASE_1_ORDER.forEach(roleId => { const idx = team.findIndex((h, i) => !assignedIndices.has(i) && checkWhitelist(h, LIST_MAP[roleId])); if (idx !== -1) { roles[roleId] = team[idx].name; assignedIndices.add(idx); } });
        PHASE_1_ORDER.forEach(roleId => { if (roles[roleId]) return; const idx = team.findIndex((h, i) => !assignedIndices.has(i) && checkDB(h, roleId)); if (idx !== -1) { roles[roleId] = team[idx].name; assignedIndices.add(idx); } });
        const TAG_MAP = { "JUNGLE": "Jungle", "ADC": "Marksman", "SUPPORT": "Support", "MID": "Mage", "TOP": "Fighter" };
        PHASE_1_ORDER.forEach(roleId => { if (roles[roleId]) return; const idx = team.findIndex((h, i) => !assignedIndices.has(i) && checkTags(h, TAG_MAP[roleId])); if (idx !== -1) { roles[roleId] = team[idx].name; assignedIndices.add(idx); } });
        const remainingHeroes = team.filter((h, i) => !assignedIndices.has(i) && h); 
        PHASE_1_ORDER.forEach(roleId => { if (!roles[roleId] && remainingHeroes.length > 0) { roles[roleId] = remainingHeroes.shift().name; } });
        return roles;
    };

    const autoAssignLanes = (isEnemy) => {
        const team = isEnemy ? redTeam : blueTeam;
        const setter = isEnemy ? setEnemyLaneAssignments : setMyLaneAssignments;
        const newRoles = guessRoles(team);
        setter(newRoles);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'SYNC_LANE_ASSIGNMENTS', data: { my: isEnemy ? myLaneAssignments : newRoles, enemy: isEnemy ? newRoles : enemyLaneAssignments } }));
        }
        toast.success("分路已重新校准", { icon: '🔄' });
    };

    // 分路自动同步 Effects
    useEffect(() => {
        if (blueTeam.some(c => c !== null)) {
            setMyLaneAssignments(prev => {
                const next = { ...prev };
                const currentNames = blueTeam.map(c => c?.name).filter(Boolean);
                const usedNames = new Set();
                Object.keys(next).forEach(role => { const assignedName = next[role]; if (assignedName) { if (currentNames.includes(assignedName)) { usedNames.add(assignedName); } else { next[role] = ""; } } });
                blueTeam.forEach((hero, idx) => { if (hero && !usedNames.has(hero.name)) { const lcuRole = myTeamRoles[idx]; if (lcuRole && ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].includes(lcuRole) && !next[lcuRole]) { next[lcuRole] = hero.name; usedNames.add(hero.name); } } });
                const hasUnassignedHeroes = blueTeam.some(c => c && !usedNames.has(c.name));
                if (hasUnassignedHeroes) {
                    const aiSuggestions = guessRoles(blueTeam);
                    Object.keys(next).forEach(role => { if (!next[role]) { const suggested = aiSuggestions[role]; if (suggested && !usedNames.has(suggested)) { next[role] = suggested; usedNames.add(suggested); } } });
                    const remaining = blueTeam.filter(c => c && !usedNames.has(c.name));
                    if (remaining.length > 0) { Object.keys(next).forEach(role => { if (!next[role] && remaining.length > 0) { next[role] = remaining.shift().name; } }); }
                }
                if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
                return next;
            });
        }
    }, [blueTeam, myTeamRoles, roleMapping]);

    useEffect(() => {
        if (redTeam.some(c => c !== null)) {
            setEnemyLaneAssignments(prev => {
                const next = { ...prev };
                const currentNames = redTeam.map(c => c?.name).filter(Boolean);
                const usedNames = new Set();
                Object.keys(next).forEach(role => { const assignedName = next[role]; if (assignedName) { if (currentNames.includes(assignedName)) { usedNames.add(assignedName); } else { next[role] = ""; } } });
                const hasUnassignedHeroes = redTeam.some(c => c && !usedNames.has(c.name));
                if (hasUnassignedHeroes) {
                    const aiSuggestions = guessRoles(redTeam);
                    Object.keys(next).forEach(role => { if (!next[role]) { const suggested = aiSuggestions[role]; if (suggested && !usedNames.has(suggested)) { next[role] = suggested; usedNames.add(suggested); } } });
                    const remaining = redTeam.filter(c => c && !usedNames.has(c.name));
                    if (remaining.length > 0) { Object.keys(next).forEach(role => { if (!next[role] && remaining.length > 0) { next[role] = remaining.shift().name; } }); }
                }
                if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
                return next;
            });
        }
    }, [redTeam, roleMapping]);

    useEffect(() => {


        
        let ws; 
        let timer;
        
        const connect = () => {
            // 创建连接
            ws = new WebSocket(BRIDGE_WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("✅ [Frontend] WebSocket 连接成功");
                setLcuStatus("connected");
                // 连接成功后，立即请求一次数据
                ws.send(JSON.stringify({ type: 'REQUEST_SYNC' }));
            };

            ws.onclose = () => { 
                console.log("⚠️ [Frontend] WebSocket 断开，3秒后重连...");
                setLcuStatus("disconnected"); 
                setLcuRealRole(""); 
                timer = setTimeout(connect, 3000); 
            };

            ws.onerror = (err) => {
                // 捕获错误防止红字刷屏，但要记录日志
                // console.warn("WS连接错误:", err); 
                if(ws) ws.close();
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    
                    // 🔥🔥 核心修复：同步后刷新全站数据 🔥🔥
                    if (msg.type === 'LCU_PROFILE_UPDATE') {
                        console.log("📦 [WS] 收到战绩数据:", msg.data);
                        // 先临时展示本地数据，让用户感觉“快”
                        setLcuProfile(msg.data);
                        
                        if (token) {
                            axios.post(`${API_BASE_URL}/users/sync_profile`, msg.data, { 
                                headers: { Authorization: `Bearer ${token}` } 
                            })
                            .then(async (res) => {
                                console.log("✅ 同步至云端成功");
                                
                                // 1. 立即从后端拉取最新的完整数据 (包含合并后的8场战绩 + 新段位)
                                if (fetchUserInfo) {
                                    await fetchUserInfo(); 
                                }
                        
                                setLcuProfile(null); 
                                
                                if (typeof toast !== 'undefined') toast.success("档案已同步，数据已合并");
                            })
                            .catch(e => console.error("同步云端失败", e));
                        }
                    }

                    // === 处理其他状态 ===
                    if (msg.type === 'CHAMP_SELECT') setRawLcuData(msg.data);
                    
                    if (msg.type === 'STATUS') {
                        if(msg.data === 'connected') setLcuStatus("connected");
                        else if(msg.data === 'disconnected') { setLcuStatus("disconnected"); setLcuRealRole(""); }
                    }
                    
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

                } catch(e) { console.error("WS解析错误:", e); }
            };
        };

        // 延迟 1 秒启动，给本地服务一点准备时间
        timer = setTimeout(connect, 1000); 
        
        return () => { 
            if(ws) ws.close(); 
            clearTimeout(timer); 
        };
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
                    // 1. 打印数据，确认前端收到了 IPC 消息
                    console.log("📦 [Debug] 前端收到 LCU 数据:", profileData);
                    setLcuProfile(profileData);

                    if (token) {
                        console.log("🚀 [Debug] 正在向后端发送同步请求...");
                        
                        axios.post(`${API_BASE_URL}/users/sync_profile`, profileData, { 
                            headers: { Authorization: `Bearer ${token}` } 
                        })
                        .then(res => {
                            console.log("✅ [Debug] 同步成功，后端返回:", res.data);
                            if (typeof toast !== 'undefined') toast.success("战绩同步成功！");
                            
                            // 触发个人信息刷新
                            if (fetchUserInfo) fetchUserInfo();
                        })
                        .catch(e => {
                            // 🔥 2. 这里的 console.error 是关键！它会让错误现形！
                            console.error("❌ [Error] 同步请求失败:", e);
                            
                            if (e.response) {
                                // 如果是服务器拒绝 (401/422/500)
                                console.error("   状态码:", e.response.status);
                                console.error("   错误信息:", e.response.data);
                                if (typeof toast !== 'undefined') toast.error(`同步失败: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
                            } else {
                                // 如果是网络不通
                                if (typeof toast !== 'undefined') toast.error("同步失败: 网络连接错误");
                            }
                        });
                    } else {
                        console.warn("⚠️ [Warn] Token 为空，无法同步。请尝试重新登录。");
                        if (typeof toast !== 'undefined') toast.error("未检测到登录状态，请重新登录");
                    }
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

    const handleSaveShortcuts = (newShortcuts) => {
        setCurrentShortcuts(newShortcuts);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-shortcuts', newShortcuts);
        }
    };
    
    const handleSyncProfile = useCallback(() => {
        console.log("🚀 [Frontend] 发起同步请求...");
        
        // 🔥 强制优先使用 WebSocket 发送请求
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log("📡 [Frontend] 通过 WebSocket 发送 REQ_LCU_PROFILE...");
            wsRef.current.send(JSON.stringify({ type: 'REQ_LCU_PROFILE' }));
        } else {
            console.warn("⚠️ [Frontend] WebSocket 未连接，尝试 IPC 兜底...");
            // 只有 WS 断了才尝试 IPC
            if (window.require) {
                try {
                    window.require('electron').ipcRenderer.send('req-lcu-profile');
                } catch(e) { console.error("IPC 也失败了", e); }
            }
        }
    }, []);


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
    useEffect(() => { localStorage.setItem('userSlot', JSON.stringify(userSlot)); }, [userSlot]);

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
                    id: c.key, 
                    key: c.id, 
                    name: c.name, 
                    title: c.title, 
                    tags: c.tags,
                    image_url: `https://game.gtimg.cn/images/lol/act/img/champion/${c.id}.png`,
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
                // 🔥 [修改] 使用 hasSyncedUserSlot 锁，防止 LCU 反复抢夺视角
                if (localPlayer && !hasSyncedUserSlot.current) {
                    setUserSlot(localPlayer.cellId % 5);
                    hasSyncedUserSlot.current = true; // 🔒 锁定，不再自动跳

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
        // 如果自己没选英雄，直接不请求
        if (!myHeroName) return;
        
        let target = targetOverride || tipTarget;
        
        // 如果没有指定目标，尝试自动寻找对位
        if (!target) {
            // 1. 优先找当前分路的对手 (例如我是上单，找对面已知的上单)
            if (userRole && enemyLaneAssignments[userRole]) {
                target = enemyLaneAssignments[userRole];
            } 
            // 2. 如果我是打野，且分路表里没找到，尝试去对面阵容里找带 "Jungle" 标签的英雄
            else if (userRole === 'JUNGLE') {
                const enemyJg = Object.values(enemyLaneAssignments).find(h => 
                    redTeam.find(c => c?.name === h)?.tags?.includes("Jungle")
                ) || redTeam.find(c => c && c.tags && c.tags.includes("Jungle"))?.name;
                target = enemyJg;
            }
            // 3. 实在找不到，兜底找对面第一个有名字的英雄 (防止报错)
            if (!target) target = redTeam.find(c => c)?.name;
        }

        // ✅ 使用带缓存的新 API (这就解决了刷屏问题)
        const data = await fetchMatchTips(myHeroName, target);
        
        // 🔒 只有当数据真的变了才更新 State，彻底杜绝死循环
        setTips(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
            return data;
        });
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
    
    // 🔥 [修改] handleCardClick：允许空位点击并切换视角
    const handleCardClick = (idx, isEnemy) => { 
        setSelectingSlot(idx); 
        setSelectingIsEnemy(isEnemy); 
        setShowChampSelector(true);
        
        if (!isEnemy) {
            setUserSlot(idx);
            
            // 顺便同步该楼层的分路 (基于默认位置表)
            // myTeamRoles 类似于 ["TOP", "JUNGLE", ...]
            if (myTeamRoles && myTeamRoles[idx]) {
                setUserRole(myTeamRoles[idx]);
            }
        }
    };
    
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
        hasSyncedUserSlot.current = false; // 🔥 [新增] 重置同步锁
        if(!confirm("确定要清空当前对局记录吗？")) return;
        setBlueTeam(Array(5).fill(null)); setRedTeam(Array(5).fill(null));
        setMyTeamRoles(Array(5).fill(""));
        setEnemyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" });
        setMyLaneAssignments({ "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" });
        setAiResults({ bp: null, personal: null, team: null });
        setMapSide("unknown"); 
        ['blueTeam','redTeam','myTeamRoles','enemyLaneAssignments','myLaneAssignments','aiResults', 'mapSide', 'userSlot'].forEach(k => localStorage.removeItem(k));
        // Reset userSlot to default
        setUserSlot(1); 
        setUserRole('JUNGLE');
    };

    const handleAnalyze = async (mode, forceRestart = false) => {
        // 1. 登录与状态检查
        if (!token) { setAuthMode('login'); setShowLoginModal(true); return; }
        if (analyzingStatus[mode] && !forceRestart) return;
        
        if (abortControllersRef.current[mode]) abortControllersRef.current[mode].abort();
        const newController = new AbortController(); abortControllersRef.current[mode] = newController;

        setAnalyzingStatus(prev => ({ ...prev, [mode]: true }));
        setAiResults(prev => { 
            const next = { ...prev }; 
            next[mode] = null; 
            if (mode === 'personal') next['role_jungle_farming'] = null; 
            else if (mode === 'role_jungle_farming') next['personal'] = null; 
            return next; 
        });

        const baseResultsSnapshot = { ...aiResultsRef.current };
        let targetSlot = userSlot;
        let myHeroObj = blueTeam[userSlot];

        // 2. 自动跳转逻辑 (仅非 BP 模式启用)
        if (!myHeroObj && mode !== 'bp') {
            const firstNonEmptyIndex = blueTeam.findIndex(h => h !== null);
            if (firstNonEmptyIndex !== -1) {
                targetSlot = firstNonEmptyIndex; 
                myHeroObj = blueTeam[firstNonEmptyIndex]; 
                setUserSlot(firstNonEmptyIndex); 
                
                const SLOT_TO_ROLE = { 0: "TOP", 1: "JUNGLE", 2: "MID", 3: "ADC", 4: "SUPPORT" };
                if (!lcuRealRole) setUserRole(SLOT_TO_ROLE[firstNonEmptyIndex]);
            }
        }

        // 3. 构建 payloadAssignments (为了给后端传 myLaneAssignments)
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

        // 🔥🔥🔥 [核心修改] 智能身份推断 v2.0 (尊贵的手动挡) 🔥🔥🔥
        const SLOT_TO_ROLE = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
        let finalUserRole = "MID"; // 初始化

        // 1. 获取基于楼层的“默认角色” (用于对比)
        const defaultSlotRole = (myTeamRoles && myTeamRoles[userSlot]) ? myTeamRoles[userSlot] : (SLOT_TO_ROLE[userSlot] || "SUPPORT");

        // 2. 判断用户是否“手动修改过”角色
        // 如果当前 state 里的 userRole 和楼层默认的不一样，说明用户手动切过了 (比如5楼切成了中单)
        const isManuallyChanged = userRole !== defaultSlotRole;

        // === 逻辑分支 ===
        
        // 分支 A: 用户手动改过 -> 听用户的！(最高优先级)
        if (isManuallyChanged) {
            finalUserRole = userRole;
            // console.log(`🤖 [HexCoach] 采纳用户手动设置: ${finalUserRole}`);
        }
        // 分支 B: 用户没改过，且当前是空位 -> 尝试智能推断
        else if (!myHeroObj) {
            // 检查分路表，看看还有哪些位置是空的
            const emptyRoles = Object.keys(myLaneAssignments).filter(r => !myLaneAssignments[r]);
            
            // 如果全队只剩 1 个坑没填 (例如 MID)，那大概率就是 MID
            if (emptyRoles.length === 1) {
                finalUserRole = emptyRoles[0];
                // console.log(`🤖 [HexCoach] 智能推断唯一空位: ${finalUserRole}`);
            } else {
                // 猜不出来，回退到楼层默认
                finalUserRole = defaultSlotRole;
            }
        } 
        // 分支 C: 已选英雄 -> 优先用英雄的分路，没有则用楼层
        else {
            if (lcuRealRole) {
                finalUserRole = lcuRealRole;
            } else {
                const manualRole = Object.keys(myLaneAssignments).find(r => myLaneAssignments[r] === myHeroObj.name);
                finalUserRole = manualRole || defaultSlotRole;
            }
        }
        
        // 🔥 [新增] 强制同步状态：让 UI (顶部导航栏) 也跟着变
        // 这样如果你被推断成了 MID，顶部也会自动跳到 MID，让你知道发生了什么
        if (finalUserRole !== userRole) {
            setUserRole(finalUserRole);
        }

        // 4. 拦截逻辑
        if (!myHeroObj && mode !== 'bp') {
            setAiResults(prev => ({ ...prev, [mode]: JSON.stringify({ concise: { title: "无法识别英雄", content: "请先在左侧点击圆圈选择您的英雄，或等待游戏内自动同步。" } })}));
            setAnalyzingStatus(prev => ({ ...prev, [mode]: false }));
            return;
        }

        try {
            // 计算 enemySide 仅供前端逻辑参考，不发给后端
            let enemySide = "unknown";
            if (mapSide === "blue") enemySide = "red"; else if (mapSide === "red") enemySide = "blue";

            // 🔥🔥🔥 [核心修改] 寻找我的对位英雄 (Primary Enemy)
            // 根据我的分路，去敌方分路表里找对应的人
            let primaryEnemyKey = "None";
            
            // enemyLaneAssignments 结构: { "TOP": "Aatrox", "MID": "", ... }
            // 注意：这里存的是英雄名(Name)，我们需要转成 Key
            const enemyName = enemyLaneAssignments[finalUserRole];
            
            if (enemyName) {
                // 如果敌方分路表里有名字，去 redTeam 里找对应的英雄对象拿到 Key
                const enemyHeroObj = redTeam.find(c => c?.name === enemyName);
                if (enemyHeroObj) {
                    primaryEnemyKey = enemyHeroObj.key;
                }
            }

            const payload = {
                mode: mode,
                // ✅ 空位传 "None"
                myHero: myHeroObj ? myHeroObj.key : "None",
                // ✅ 传对位英雄 Key
                enemyHero: primaryEnemyKey, 

                myTeam: blueTeam.map(c => c?.key || ""), 
                enemyTeam: redTeam.map(c => c?.key || ""),
                
                // ✅ 使用刚才智能推断出的角色 (例如 "MID")
                userRole: finalUserRole, 
                
                mapSide: mapSide || "unknown", 
                rank: userRank || "Gold",
                
                // ❌ 彻底删除 enemySide 字段，防止 422
                
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
        actions: { autoAssignLanes,setHasStarted, setShowCommunity, setShowProfile, setShowAdminPanel,setAdminView, setShowSettingsModal, setBlueTeam, setRedTeam, setUserRole, setUserRank, setMyLaneAssignments, setEnemyLaneAssignments, setUseThinkingModel, setAnalyzeType, setAiResults, setViewMode, setActiveTab, setShowChampSelector, setSelectingSlot, setSelectingIsEnemy, setAuthMode, setAuthForm, setShowLoginModal, setShowPricingModal, setInputContent, setShowTipModal, setShowFeedbackModal, setTipTarget, setUserSlot, handleLogin, handleRegister, logout, handleClearSession, handleAnalyze, fetchUserInfo, handleCardClick, handleSelectChampion, handleSaveShortcuts, handlePostTip, handleLike, handleDeleteTip, handleReportError, handleTabClick,setMapSide, setShowDownloadModal, setShowSalesDashboard,handleSyncProfile,handleClearAnalysis }
    };
}