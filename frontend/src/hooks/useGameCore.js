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

// 🔥 [配置] 默认演示阵容 (中文名 + 中文称号 + 腾讯图床 + 完整Tags)
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
    
    // 🔥 [修改] 默认设置为蓝色方 (Blue Side)
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

    const broadcastState = (type, payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data: payload }));
        }
    };

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

    // 🔥🔥🔥 [核心修改] 增强版分路猜测算法 🔥🔥🔥
const guessRoles = (team) => {
        const roles = { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" };
        // 记录已被分配位置的英雄索引，防止一人分饰两角
        const assignedIndices = new Set();
        
        const norm = (str) => str ? str.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";

        // === 1. 定义独占白名单 (严格互斥) ===
        const FORCE_JUNGLE = [
            "LeeSin", "RekSai", "Sylas", "BelVeth", "Nidalee", "Aatrox", "Jayce", "Shaco", "XinZhao", "Warwick", "Zaahen",
            "Karthus", "Ivern", "Ekko", "Zac", "Nunu", "Wukong", "KhaZix", "Lillia", "Kindred", "Evelynn", "Viego", "Rammus", 
            "JarvanIV", "Briar", "MasterYi", "Graves", "DrMundo", "Hecarim", "Nocturne", "Vi", "Trundle", "Kayn", "Sejuani", 
            "Udyr", "Skarner", "Fiddlesticks", "Amumu", "Maokai", "Volibear", "Diana", "Taliyah", "Zyra", "Brand", "Morgana"
        ];

        const FORCE_ADC = [
            "MissFortune", "Ashe", "Lucian", "Jhin", "Kaisa", "Jinx", "Swain", "Aphelios", "Sivir", "Tristana", "Ezreal", 
            "Smolder", "Yunara", "Vayne", "Draven", "Xayah", "Samira", "Caitlyn", "Ziggs", "KogMaw", "Zeri", "Twitch", 
            "Varus", "Nilah", "Corki", "Kalista"
        ];

        const FORCE_SUP = [
            "Leona", "Braum", "Poppy", "Karma", "Bard", "Thresh", "Pyke", "Nautilus", "Blitzcrank", "Lulu", "Zilean", 
            "Nami", "Seraphine", "Neeko", "Rell", "VelKoz", "Rakan", "Alistar", "Milio", "Taric", "Soraka", "Senna", 
            "Xerath", "Yuumi", "Lux", "Janna", "TahmKench", "Sona", "Renata", "Pantheon"
        ];

        // 加里奥、兰博 必须在这里
        const FORCE_MID = [
            "Zoe", "Ahri", "Viktor", "Orianna", "Katarina", "TwistedFate", "Qiyana", "LeBlanc", "Akali", "Vex", "Syndra", 
            "Zed", "Anivia", "Talon", "Naafiri", "Fizz", "Veigar", "Akshan", "Galio", "Hwei", "Malzahar", "Ryze", "Lissandra", 
            "AurelionSol", "Yone", "Kassadin", "Annie", "Aurora", "Mel", "Azir", "Yasuo", "Cassiopeia", "Vladimir", "Irelia"
        ];

        // 兰博 也可以在这里 (但为了防止他去中，MID名单里可以去掉他，或者这里优先级放低)
        const FORCE_TOP = [
            "Malphite", "Ambessa", "Singed", "Kennen", "Olaf", "Jax", "Gangplank", "Sion", "Rumble", "Fiora", "Renekton", 
            "Riven", "Sett", "Darius", "Heimerdinger", "Quinn", "Shen", "Kled", "Garen", "Camille", "Gnar", "Urgot", "Gragas", 
            "Mordekaiser", "Teemo", "KSante", "Gwen", "Kayle", "Ornn", "Yorick", "Nasus", "Illaoi", "Rengar", "ChoGath", 
            "Tryndamere"
        ];

        // 辅助检测函数
        const checkWhitelist = (hero, list) => {
            if (!hero) return false;
            return list.some(n => norm(n) === norm(hero.key) || norm(n) === norm(hero.id));
        };

        const checkDB = (hero, roleId) => {
            if (!hero) return false;
            const cleanKey = norm(hero.key);
            const cleanName = norm(hero.name);
            const dbRoles = roleMapping[cleanKey] || roleMapping[cleanName];
            return dbRoles && dbRoles.includes(roleId);
        };

        const checkTags = (hero, tag) => {
            return hero?.tags?.some(t => t.toLowerCase() === tag.toLowerCase());
        };

        // === 🚀 阶段一：白名单绝对锁定 (Phase 1: Whitelist) ===
        // 这一步完全忽略 API 数据，只看我们定义的“独占名单”。
        // 顺序很重要：先定死专职英雄。
        const PHASE_1_ORDER = ["JUNGLE", "ADC", "SUPPORT", "MID", "TOP"];
        const LIST_MAP = { "JUNGLE": FORCE_JUNGLE, "ADC": FORCE_ADC, "SUPPORT": FORCE_SUP, "MID": FORCE_MID, "TOP": FORCE_TOP };

        PHASE_1_ORDER.forEach(roleId => {
            // 在队伍里找一个【在白名单里】且【还没分配】的英雄
            const idx = team.findIndex((h, i) => !assignedIndices.has(i) && checkWhitelist(h, LIST_MAP[roleId]));
            if (idx !== -1) {
                roles[roleId] = team[idx].name;
                assignedIndices.add(idx);
            }
        });

        // === 🚀 阶段二：数据库/API 补位 (Phase 2: DB/API) ===
        // 只给还没填满的坑找人
        PHASE_1_ORDER.forEach(roleId => {
            if (roles[roleId]) return; // 这个坑已经填了，跳过
            
            const idx = team.findIndex((h, i) => !assignedIndices.has(i) && checkDB(h, roleId));
            if (idx !== -1) {
                roles[roleId] = team[idx].name;
                assignedIndices.add(idx);
            }
        });

        // === 🚀 阶段三：Tag 补位 (Phase 3: Tags) ===
        const TAG_MAP = { "JUNGLE": "Jungle", "ADC": "Marksman", "SUPPORT": "Support", "MID": "Mage", "TOP": "Fighter" };
        PHASE_1_ORDER.forEach(roleId => {
            if (roles[roleId]) return;
            const idx = team.findIndex((h, i) => !assignedIndices.has(i) && checkTags(h, TAG_MAP[roleId]));
            if (idx !== -1) {
                roles[roleId] = team[idx].name;
                assignedIndices.add(idx);
            }
        });

        // === 🚀 阶段四：暴力填空 (Phase 4: Fill Remaining) ===
        // 剩下的萝卜填剩下的坑
        const remainingHeroes = team.filter((h, i) => !assignedIndices.has(i) && h); 
        
        PHASE_1_ORDER.forEach(roleId => {
            if (!roles[roleId] && remainingHeroes.length > 0) {
                roles[roleId] = remainingHeroes.shift().name;
            }
        });
        return roles;
    };
    const autoAssignLanes = (isEnemy) => {
        const team = isEnemy ? redTeam : blueTeam;
        const setter = isEnemy ? setEnemyLaneAssignments : setMyLaneAssignments;
        
        const newRoles = guessRoles(team);
        setter(newRoles);
        
        // 触发广播同步
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ 
                type: 'SYNC_LANE_ASSIGNMENTS', 
                data: { 
                    my: isEnemy ? myLaneAssignments : newRoles, 
                    enemy: isEnemy ? newRoles : enemyLaneAssignments 
                } 
            }));
        }
        
        toast.success("分路已重新校准", { icon: '🔄' });
    };
    // 自动同步我方分路
    useEffect(() => {
        if (blueTeam.some(c => c !== null)) {
            setMyLaneAssignments(prev => {
                const next = { ...prev };
                const currentNames = blueTeam.map(c => c?.name).filter(Boolean);
                const usedNames = new Set(); // 记录已“名花有主”的英雄

                // 1. 【第一优先级：用户手动】(User Selection)
                // 只要英雄还在队里，就绝对保留您上次的设置，不覆盖
                Object.keys(next).forEach(role => {
                    const assignedName = next[role];
                    if (assignedName) {
                        if (currentNames.includes(assignedName)) {
                            usedNames.add(assignedName); // 标记：这个英雄已经有位置了
                        } else {
                            next[role] = ""; // 英雄已离队（换人了），位置腾空
                        }
                    }
                });

                // 2. 【第二优先级：LCU 客户端分路】(Game Client)
                // 遍历队伍，如果英雄还没位置，看看游戏客户端给他分了什么位置
                blueTeam.forEach((hero, idx) => {
                    // 只处理还没被用户锁定的英雄
                    if (hero && !usedNames.has(hero.name)) {
                        // 获取该位置 LCU 传来的角色 (如 "JUNGLE")
                        const lcuRole = myTeamRoles[idx];
                        
                        // 校验：1. LCU给了有效位置 2. 这个位置目前是空的
                        if (lcuRole && ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].includes(lcuRole) && !next[lcuRole]) {
                            next[lcuRole] = hero.name;
                            usedNames.add(hero.name); // 标记：听游戏系统的，入座
                        }
                    }
                });

                // 3. 【第三优先级：AI 智能识别】(Auto Guess)
                // 如果还有英雄没位置（比如LCU没数据，或者是匹配模式），才让 AI 介入
                const hasUnassignedHeroes = blueTeam.some(c => c && !usedNames.has(c.name));
                
                if (hasUnassignedHeroes) {
                    const aiSuggestions = guessRoles(blueTeam);
                    
                    Object.keys(next).forEach(role => {
                        // 只填补依然空着的位置
                        if (!next[role]) {
                            const suggested = aiSuggestions[role];
                            // 且建议的英雄没被占用
                            if (suggested && !usedNames.has(suggested)) {
                                next[role] = suggested;
                                usedNames.add(suggested);
                            }
                        }
                    });
                    
                    // 4. 【兜底：填空】
                    // 实在分不出来的（比如5个打野英雄），按顺序填入剩下的空位
                    const remaining = blueTeam.filter(c => c && !usedNames.has(c.name));
                    if (remaining.length > 0) {
                        Object.keys(next).forEach(role => {
                            if (!next[role] && remaining.length > 0) {
                                next[role] = remaining.shift().name;
                            }
                        });
                    }
                }

                if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
                return next;
            });
        }
    }, [blueTeam, myTeamRoles, roleMapping]);

    // 自动同步敌方分路
    useEffect(() => {
        if (redTeam.some(c => c !== null)) {
            setEnemyLaneAssignments(prev => {
                const next = { ...prev };
                const currentNames = redTeam.map(c => c?.name).filter(Boolean);
                const usedNames = new Set();

                // 1. 保留有效的手动设置
                Object.keys(next).forEach(role => {
                    const assignedName = next[role];
                    if (assignedName) {
                        if (currentNames.includes(assignedName)) {
                            usedNames.add(assignedName);
                        } else {
                            next[role] = "";
                        }
                    }
                });

                // 2. 填补空缺
                const hasUnassignedHeroes = redTeam.some(c => c && !usedNames.has(c.name));
                
                if (hasUnassignedHeroes) {
                    const aiSuggestions = guessRoles(redTeam);
                    
                    Object.keys(next).forEach(role => {
                        if (!next[role]) {
                            const suggested = aiSuggestions[role];
                            if (suggested && !usedNames.has(suggested)) {
                                next[role] = suggested;
                                usedNames.add(suggested);
                            }
                        }
                    });
                    
                    // 3. 兜底
                    const remaining = redTeam.filter(c => c && !usedNames.has(c.name));
                    if (remaining.length > 0) {
                        Object.keys(next).forEach(role => {
                            if (!next[role] && remaining.length > 0) {
                                next[role] = remaining.shift().name;
                            }
                        });
                    }
                }

                if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
                return next;
            });
        }
    }, [redTeam, roleMapping]);
    // IPC & WebSocket
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

    // 初始化时拉取中文版数据
    useEffect(() => {
        axios.get(`${API_BASE_URL}/champions/roles`).then(res => setRoleMapping(res.data)).catch(e => console.error(e));
        const storedToken = localStorage.getItem("access_token");
        const storedUser = localStorage.getItem("username");
        if (storedToken && storedUser) { setToken(storedToken); setCurrentUser(storedUser); }
        
        const initData = async () => {
            try {
                // 请求 DDragon 的中文数据
                const vRes = await fetch(`${DDRAGON_BASE}/api/versions.json`);
                const versions = await vRes.json();
                setVersion(versions[0]);
                const cRes = await fetch(`${DDRAGON_BASE}/cdn/${versions[0]}/data/zh_CN/championFull.json`);
                const cData = await cRes.json();
                
                // 使用腾讯源 (gtimg.cn)
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
        ['blueTeam','redTeam','myTeamRoles','enemyLaneAssignments','myLaneAssignments','aiResults', 'mapSide', 'userSlot'].forEach(k => localStorage.removeItem(k));
        // Reset userSlot to default
        setUserSlot(1); 
        setUserRole('JUNGLE');
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
        actions: { autoAssignLanes,setHasStarted, setShowCommunity, setShowProfile, setShowAdminPanel,setAdminView, setShowSettingsModal, setBlueTeam, setRedTeam, setUserRole, setUserRank, setMyLaneAssignments, setEnemyLaneAssignments, setUseThinkingModel, setAnalyzeType, setAiResults, setViewMode, setActiveTab, setShowChampSelector, setSelectingSlot, setSelectingIsEnemy, setAuthMode, setAuthForm, setShowLoginModal, setShowPricingModal, setInputContent, setShowTipModal, setShowFeedbackModal, setTipTarget, setUserSlot, handleLogin, handleRegister, logout, handleClearSession, handleAnalyze, fetchUserInfo, handleCardClick, handleSelectChampion, handleSaveShortcuts, handlePostTip, handleLike, handleDeleteTip, handleReportError, handleTabClick,setMapSide, setShowDownloadModal, setShowSalesDashboard,handleSyncProfile,handleClearAnalysis }
    };
}