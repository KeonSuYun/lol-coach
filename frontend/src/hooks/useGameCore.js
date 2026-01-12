import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_BASE_URL, BRIDGE_WS_URL, DDRAGON_BASE } from '../config/constants';
import { analyzeStream } from '../utils/aiStream';
import { fetchMatchTips } from '../api/GlobalAPI';
// =========================================================================
// 1. 辅助函数 (定义在 Hook 外部)
// =========================================================================
const STANDARD_ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

const getPermutations = (arr) => {
    if (arr.length <= 1) return [arr];
    return arr.flatMap((v, i) => 
        getPermutations(arr.filter((_, j) => j !== i)).map(p => [v, ...p])
    );
};

const norm = (str) => str ? str.replace(/[\s\.\'\-]+/g, "").toLowerCase() : "";

const calculateScore = (hero, role, roleMapping) => {
    if (!hero) return 0;
    let score = 0;
    const cleanKey = norm(hero.key);
    const cleanName = norm(hero.name);
    
    let dbRoles = (roleMapping[cleanKey] || roleMapping[cleanName] || []).map(r => r.toUpperCase());
    
    if (dbRoles.includes(role)) {
        const index = dbRoles.indexOf(role);
        score += (1000 - index * 300);
    } else {
        score -= 500;
    }

    const tags = (hero.tags || []).map(t => t.toUpperCase());
    
    if (role === 'SUPPORT') {
        if (tags.includes('SUPPORT')) score += 300;
        if (tags.includes('MAGE') && !tags.includes('MARKSMAN')) score += 50; 
    }
    if (role === 'ADC') {
        if (tags.includes('MARKSMAN')) score += 500;
        else score -= 500; 
    }
    if (role === 'MID') {
        if (tags.includes('MAGE') || tags.includes('ASSASSIN')) score += 300;
    }
    if (role === 'TOP') {
        if (tags.includes('FIGHTER') || tags.includes('TANK')) score += 300;
    }
    if (role === 'JUNGLE') {
        if (tags.includes('FIGHTER') || tags.includes('ASSASSIN') || tags.includes('TANK')) score += 100;
        if (tags.includes('MARKSMAN') && !dbRoles.includes('JUNGLE')) score -= 1000;
    }

    return score;
};

const guessRoles = (team, roleMapping = {}, assignedPositions = []) => {
    const finalResult = { "TOP": "", "JUNGLE": "", "MID": "", "ADC": "", "SUPPORT": "" };
    const activeHeroes = team.map((h, idx) => ({ ...h, originalIndex: idx })).filter(h => h && h.name);
    
    if (activeHeroes.length === 0) return finalResult;

    const lockedIndices = new Set();
    const lockedRoles = new Set();

    if (assignedPositions && assignedPositions.length === 5 && assignedPositions.some(p => p)) {
        const lcuMap = { "TOP": "TOP", "JUNGLE": "JUNGLE", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUPPORT" };
        
        activeHeroes.forEach(hero => {
            const rawPos = assignedPositions[hero.originalIndex];
            const stdPos = lcuMap[rawPos] || rawPos;
            
            if (STANDARD_ROLES.includes(stdPos) && !finalResult[stdPos]) {
                finalResult[stdPos] = hero.name;
                lockedIndices.add(hero.originalIndex);
                lockedRoles.add(stdPos);
            }
        });
    }

    const remainingHeroes = activeHeroes.filter(h => !lockedIndices.has(h.originalIndex));
    const remainingRoles = STANDARD_ROLES.filter(r => !lockedRoles.has(r));

    if (remainingHeroes.length > 0) {
        const count = Math.min(remainingHeroes.length, remainingRoles.length);
        const targetRoles = remainingRoles.slice(0, count);
        const targetHeroes = remainingHeroes.slice(0, count);

        const rolePermutations = getPermutations(targetRoles);
        
        let maxScore = -999999;
        let bestPermutation = null;

        rolePermutations.forEach(permRoles => {
            let currentTotalScore = 0;
            targetHeroes.forEach((hero, idx) => {
                const assignedRole = permRoles[idx];
                currentTotalScore += calculateScore(hero, assignedRole, roleMapping);
            });

            if (currentTotalScore > maxScore) {
                maxScore = currentTotalScore;
                bestPermutation = permRoles;
            }
        });

        if (bestPermutation) {
            targetHeroes.forEach((hero, idx) => {
                const role = bestPermutation[idx];
                finalResult[role] = hero.name;
            });
        }
    }

    STANDARD_ROLES.forEach(r => {
        if (!finalResult[r]) finalResult[r] = "";
    });

    return finalResult;
};

// 🔥 新增：本地宽容型解析器 (用于在Hook中解析数据以便自动复制)
const tryLocalParse = (jsonStr) => {
    if (!jsonStr) return null;
    let clean = jsonStr.trim();
    clean = clean.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "");
    clean = clean.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "");
    try { return JSON.parse(clean); } catch (e) {}
    // 简单的补全尝试
    if (clean.lastIndexOf('}') === -1 && clean.lastIndexOf(']') === -1) return null; 
    return null; // Hook中不做太复杂的修复，依赖 aiStream 的解析或简单的 JSON.parse
};

const loadState = (key, defaultVal) => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved || saved === "undefined" || saved === "null") return defaultVal;
        const parsed = JSON.parse(saved);
        return (parsed !== null && parsed !== undefined) ? parsed : defaultVal;
    } catch (e) { return defaultVal; }
};

const DEFAULT_MY_SIDE = [
    { key: "Malphite", name: "熔岩巨兽", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/Malphite.png](https://game.gtimg.cn/images/lol/act/img/champion/Malphite.png)" },
    { key: "LeeSin", name: "盲僧", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/LeeSin.png](https://game.gtimg.cn/images/lol/act/img/champion/LeeSin.png)" },
    { key: "Ahri", name: "九尾妖狐", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/Ahri.png](https://game.gtimg.cn/images/lol/act/img/champion/Ahri.png)" },
    { key: "Jinx", name: "暴走萝莉", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/Jinx.png](https://game.gtimg.cn/images/lol/act/img/champion/Jinx.png)" },
    { key: "Thresh", name: "魂锁典狱长", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/Thresh.png](https://game.gtimg.cn/images/lol/act/img/champion/Thresh.png)" }
];

const DEFAULT_ENEMY_SIDE = [
    { key: "Aatrox", name: "暗裔剑魔", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/Aatrox.png](https://game.gtimg.cn/images/lol/act/img/champion/Aatrox.png)" },
    { key: "JarvanIV", name: "德玛西亚皇子", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/JarvanIV.png](https://game.gtimg.cn/images/lol/act/img/champion/JarvanIV.png)" },
    { key: "Syndra", name: "暗黑元首", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/Syndra.png](https://game.gtimg.cn/images/lol/act/img/champion/Syndra.png)" },
    { key: "Kaisa", name: "虚空之女", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/Kaisa.png](https://game.gtimg.cn/images/lol/act/img/champion/Kaisa.png)" },
    { key: "Nautilus", name: "深海泰坦", image_url: "[https://game.gtimg.cn/images/lol/act/img/champion/Nautilus.png](https://game.gtimg.cn/images/lol/act/img/champion/Nautilus.png)" }
];

const DEFAULT_ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
const DEFAULT_MY_LANES = { "TOP": "熔岩巨兽", "JUNGLE": "盲僧", "MID": "九尾妖狐", "ADC": "暴走萝莉", "SUPPORT": "魂锁典狱长" };
const DEFAULT_ENEMY_LANES = { "TOP": "暗裔剑魔", "JUNGLE": "德玛西亚皇子", "MID": "暗黑元首", "ADC": "虚空之女", "SUPPORT": "深海泰坦" };

// =========================================================================
// 2. 核心 HOOK
// =========================================================================
export function useGameCore() {
    const [version, setVersion] = useState("V15.2");
    const [championList, setChampionList] = useState([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [adminView, setAdminView] = useState('dashboard');
    const [isOverlay, setIsOverlay] = useState(() => window.location.href.includes('overlay=true'));
    const [hasStarted, setHasStarted] = useState(() => window.location.href.includes('overlay=true'));
    const [showCommunity, setShowCommunity] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    
    // useRef 放在顶部
    const hasManualOverride = useRef(false);
    const aiResultsRef = useRef({ bp: null, personal: null, team: null });
    const analyzeTypeRef = useRef('personal');
    const myLaneAssignmentsRef = useRef(DEFAULT_MY_LANES);
    const enemyLaneAssignmentsRef = useRef(DEFAULT_ENEMY_LANES);
    const mySideTeamRef = useRef(DEFAULT_MY_SIDE);
    const enemySideTeamRef = useRef(DEFAULT_ENEMY_SIDE);
    const lcuStatusRef = useRef("disconnected");
    const wsRef = useRef(null);
    const isRemoteUpdate = useRef(false);
    const hasSyncedUserSlot = useRef(false); 
    const hasAutoTeamAnalysisTriggered = useRef(false);
    const lastAnalyzedTeamSignature = useRef("");
    const abortControllersRef = useRef({ bp: null, personal: null, team: null });

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [currentShortcuts, setCurrentShortcuts] = useState(null);
    const [sendChatTrigger, setSendChatTrigger] = useState(0);
    const [showSalesDashboard, setShowSalesDashboard] = useState(false);
    
    const [mySideTeam, setMySideTeam] = useState(() => loadState('localMyTeam', DEFAULT_MY_SIDE) || DEFAULT_MY_SIDE);
    const [enemySideTeam, setEnemySideTeam] = useState(() => loadState('localEnemyTeam', DEFAULT_ENEMY_SIDE) || DEFAULT_ENEMY_SIDE);
    
    const [myTeamRoles, setMyTeamRoles] = useState(() => loadState('myTeamRoles', DEFAULT_ROLES) || DEFAULT_ROLES);    
    const [userRole, setUserRole] = useState(() => loadState('userRole', 'JUNGLE'));
    const [lcuRealRole, setLcuRealRole] = useState("");
    
    const [userSlot, setUserSlot] = useState(() => {
        const saved = localStorage.getItem('userSlot');
        return saved ? JSON.parse(saved) : 1; 
    });

    const [lcuStatus, setLcuStatus] = useState("disconnected");
    const [userRank, setUserRank] = useState(() => loadState('userRank', 'Gold'));
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
        loadState('enemyLaneAssignments', DEFAULT_ENEMY_LANES) || DEFAULT_ENEMY_LANES
    );
    const [myLaneAssignments, setMyLaneAssignments] = useState(() =>
        loadState('myLaneAssignments', DEFAULT_MY_LANES) || DEFAULT_MY_LANES
    );
    const [manualMyLanes, setManualMyLanes] = useState(() => loadState('manualMyLanes', {}));
    const [manualEnemyLanes, setManualEnemyLanes] = useState(() => loadState('manualEnemyLanes', {}));
    
    const [useThinkingModel, setUseThinkingModel] = useState(() => loadState('useThinkingModel', false));
    const [aiResults, setAiResults] = useState(() => loadState('aiResults', { bp: null, personal: null, team: null }));
    const [analyzingStatus, setAnalyzingStatus] = useState({});
    const isModeAnalyzing = (mode) => !!analyzingStatus[mode];

    const [analyzeType, setAnalyzeType] = useState(() => loadState('analyzeType', 'personal'));
    const [viewMode, setViewMode] = useState('detailed');
    const [activeTab, setActiveTab] = useState(0); 

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

    // =========================================================================
    // 3. 基础 Effect 与 Refs 同步
    // =========================================================================
    useEffect(() => { if (isOverlay) document.body.classList.add('transparent-mode'); }, [isOverlay]);
    useEffect(() => { localStorage.setItem('manualMyLanes', JSON.stringify(manualMyLanes)); }, [manualMyLanes]);
    useEffect(() => { localStorage.setItem('manualEnemyLanes', JSON.stringify(manualEnemyLanes)); }, [manualEnemyLanes]);
    useEffect(() => { aiResultsRef.current = aiResults; }, [aiResults]);
    useEffect(() => { analyzeTypeRef.current = analyzeType; }, [analyzeType]);
    useEffect(() => { myLaneAssignmentsRef.current = myLaneAssignments; }, [myLaneAssignments]);
    useEffect(() => { enemyLaneAssignmentsRef.current = enemyLaneAssignments; }, [enemyLaneAssignments]);
    useEffect(() => { mySideTeamRef.current = mySideTeam; }, [mySideTeam]);
    useEffect(() => { enemySideTeamRef.current = enemySideTeam; }, [enemySideTeam]);
    useEffect(() => { lcuStatusRef.current = lcuStatus; }, [lcuStatus]);

    useEffect(() => { localStorage.setItem('localMyTeam', JSON.stringify(mySideTeam)); }, [mySideTeam]);
    useEffect(() => { localStorage.setItem('localEnemyTeam', JSON.stringify(enemySideTeam)); }, [enemySideTeam]);
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
    
    // 初始化数据
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

    // =========================================================================
    // 4. 功能函数 (Functions) - 提前定义
    // =========================================================================
    
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
        } catch (e) {
            console.error("Fetch info error", e);
        }
    };
    
    useEffect(() => { if (token) fetchUserInfo(); else setAccountInfo(null); }, [token]);

    const broadcastState = (type, payload) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data: payload }));
        }
    };

    const handleLcuUpdate = useCallback((session) => {
        if (!session || championList.length === 0) return;
        
        let currentMapSide = mapSide; 
        if (session.localPlayerCellId !== undefined && session.localPlayerCellId !== -1) {
            currentMapSide = session.localPlayerCellId < 5 ? "blue" : "red";
            if (currentMapSide !== mapSide) setMapSide(currentMapSide);
        }

        if (session.extraMechanics) setExtraMechanics(session.extraMechanics);

        const mapTeamByCellId = (players, offset) => {
            const result = Array(5).fill(null);
            players.forEach(p => {
                if (p.cellId >= offset && p.cellId < offset + 5) {
                    const relativeIdx = p.cellId - offset;
                    if (p.championId && p.championId !== 0) {
                        const hero = championList.find(c => c.id == p.championId);
                        if (hero) result[relativeIdx] = hero;
                    }
                }
            });
            return result;
        };

        const allPlayers = [...(session.myTeam || []), ...(session.theirTeam || [])];
        const rawBlue = mapTeamByCellId(allPlayers, 0);
        const rawRed = mapTeamByCellId(allPlayers, 5);

        let newMySideTeam, newEnemySideTeam;

        if (currentMapSide === 'red') {
            newMySideTeam = rawRed;
            newEnemySideTeam = rawBlue;
        } else {
            newMySideTeam = rawBlue;
            newEnemySideTeam = rawRed;
        }
        
        setMySideTeam(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newMySideTeam)) return prev;
            return newMySideTeam;
        });

        setEnemySideTeam(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newEnemySideTeam)) return prev;
            return newEnemySideTeam;
        });

        const roles = Array(5).fill("");
        const lcuRoleMap = { "TOP": "TOP", "JUNGLE": "JUNGLE", "MIDDLE": "MID", "BOTTOM": "ADC", "UTILITY": "SUPPORT" };
        
        if (session.myTeam) {
            session.myTeam.forEach(p => {
                const offset = currentMapSide === 'red' ? 5 : 0;
                const idx = p.cellId - offset;
                
                if (idx >= 0 && idx < 5) {
                    const rawRole = p.assignedPosition?.toUpperCase();
                    if (rawRole && lcuRoleMap[rawRole]) {
                        roles[idx] = lcuRoleMap[rawRole];
                    }
                }
            });
            
            if (roles.some(r => r !== "")) {
                setMyTeamRoles(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(roles)) return prev;
                    return roles;
                });
            }
        }

        if (session.localPlayerCellId !== undefined && session.localPlayerCellId !== -1) {
            if (!hasSyncedUserSlot.current) {
                const offset = currentMapSide === 'red' ? 5 : 0;
                const relativeSlot = session.localPlayerCellId - offset;
                
                setUserSlot(relativeSlot);
                hasSyncedUserSlot.current = true;
                
                if (roles[relativeSlot]) {
                    setUserRole(roles[relativeSlot]);
                    setLcuRealRole(roles[relativeSlot]);
                }
            }
        }
    }, [championList, mapSide]);

    const autoAssignLanes = (isEnemy) => {
        const team = isEnemy ? enemySideTeam : mySideTeam; 
        const setter = isEnemy ? setEnemyLaneAssignments : setMyLaneAssignments;
        const manualSetter = isEnemy ? setManualEnemyLanes : setManualMyLanes;
        
        const newRoles = guessRoles(team, roleMapping, []); 
        
        setter(newRoles);
        manualSetter(newRoles);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ 
                type: 'SYNC_LANE_ASSIGNMENTS', 
                data: { my: isEnemy ? myLaneAssignments : newRoles, enemy: isEnemy ? newRoles : enemyLaneAssignments } 
            }));
        }
        toast.success(isEnemy ? "已推断敌方分路" : "已校准我方分路", { icon: '🧠' });
    };

    // 🔥 [核心修改] 增加 autoCopy 参数，用于自动分析后的自动复制

    // 🔥 [终极修复版] handleAnalyze：包含流式输出稳态 + 自动复制 + 错误熔断
    // 🔥 [终极修复版] handleAnalyze：包含流式输出稳态 + 自动复制(延迟10s) + 错误熔断
    const handleAnalyze = async (mode, forceRestart = false, autoCopy = false) => {
        // 1. 基础检查
        if (!token) { setAuthMode('login'); setShowLoginModal(true); return; }
        if (analyzingStatus[mode] && !forceRestart) return;
        
        // 2. 切换 Tab
        if (mode !== analyzeType) {
            setAnalyzeType(mode);
            setActiveTab(0);
        }

        // 3. 标记开始分析
        setAnalyzingStatus(prev => ({ ...prev, [mode]: true }));
        
        // 4. 重置当前模式的结果 (清空旧数据)
        setAiResults(prev => { 
            const next = { ...prev }; 
            next[mode] = ""; 
            // 互斥逻辑：个人模式与野核模式互斥显示
            if (mode === 'personal') next['role_jungle_farming'] = null; 
            else if (mode === 'role_jungle_farming') next['personal'] = null; 
            return next; 
        });

        // 5. 准备上下文快照
        const baseResultsSnapshot = { ...aiResultsRef.current };
        // ⭐ 关键：本地累加器 (解决 React State 异步导致的丢字问题)
        let localAccumulator = ""; 

        // --- 智能身份识别逻辑 (User Role) ---
        let targetSlot = userSlot;
        let myHeroObj = mySideTeam[userSlot];

        // 自动修正空位选择
        if (!myHeroObj && mode !== 'bp') {
            const firstNonEmptyIndex = mySideTeam.findIndex(h => h !== null);
            if (firstNonEmptyIndex !== -1) {
                targetSlot = firstNonEmptyIndex; 
                myHeroObj = mySideTeam[firstNonEmptyIndex]; 
                setUserSlot(firstNonEmptyIndex); 
                const SLOT_TO_ROLE = { 0: "TOP", 1: "JUNGLE", 2: "MID", 3: "ADC", 4: "SUPPORT" };
                if (!lcuRealRole) setUserRole(SLOT_TO_ROLE[firstNonEmptyIndex]);
            }
        }

        // 构建分路参数
        const payloadAssignments = {};
        mySideTeam.forEach((hero, idx) => {
            const roleMap = { "TOP": "TOP", "JUG": "JUNGLE", "JUNGLE": "JUNGLE", "MID": "MID", "ADC": "ADC", "BOTTOM": "ADC", "SUP": "SUPPORT", "SUPPORT": "SUPPORT" };
            const rawRole = myTeamRoles[idx];
            const standardRole = roleMap[rawRole] || rawRole;
            if (hero && standardRole) { payloadAssignments[standardRole] = hero.key; }
        });
        Object.keys(myLaneAssignments).forEach(role => {
            const heroName = myLaneAssignments[role];
            if (heroName) { const hero = mySideTeam.find(h => h?.name === heroName); if (hero) payloadAssignments[role] = hero.key; }
        });

        // 确定最终角色
        const SLOT_TO_ROLE = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
        let finalUserRole = "MID"; 
        const defaultSlotRole = (myTeamRoles && myTeamRoles[userSlot]) ? myTeamRoles[userSlot] : (SLOT_TO_ROLE[userSlot] || "SUPPORT");
        const isManuallyChanged = userRole !== defaultSlotRole;

        if (isManuallyChanged) { finalUserRole = userRole; }
        else if (!myHeroObj) {
            const emptyRoles = Object.keys(myLaneAssignments).filter(r => !myLaneAssignments[r]);
            if (emptyRoles.length === 1) { finalUserRole = emptyRoles[0]; } else { finalUserRole = defaultSlotRole; }
        } 
        else {
            if (lcuRealRole) { finalUserRole = lcuRealRole; } else {
                const manualRole = Object.keys(myLaneAssignments).find(r => myLaneAssignments[r] === myHeroObj.name);
                finalUserRole = manualRole || defaultSlotRole;
            }
        }
        if (finalUserRole !== userRole) { setUserRole(finalUserRole); }

        // 阻断：非 BP 模式下必须选英雄
        if (!myHeroObj && mode !== 'bp') {
            setAiResults(prev => ({ ...prev, [mode]: JSON.stringify({ concise: { title: "无法识别英雄", content: "请先在左侧点击圆圈选择您的英雄，或等待游戏内自动同步。" } })}));
            setAnalyzingStatus(prev => ({ ...prev, [mode]: false }));
            return;
        }

        try {
            // 计算对位
            let primaryEnemyKey = "None";
            const enemyName = enemyLaneAssignments[finalUserRole];
            if (enemyName) {
                const enemyHeroObj = enemySideTeam.find(c => c?.name === enemyName);
                if (enemyHeroObj) { primaryEnemyKey = enemyHeroObj.key; }
            }

            // 构造 Payload
            const payload = {
                mode: mode,
                myHero: myHeroObj ? myHeroObj.key : "None",
                enemyHero: primaryEnemyKey, 
                myTeam: mySideTeam.map(c => c?.key || ""), 
                enemyTeam: enemySideTeam.map(c => c?.key || ""),
                userRole: finalUserRole, 
                mapSide: mapSide || "unknown", 
                rank: userRank || "Gold",
                myLaneAssignments: Object.keys(payloadAssignments).length > 0 ? payloadAssignments : null,
                enemyLaneAssignments: (() => {
                    const clean = {};
                    Object.keys(enemyLaneAssignments).forEach(k => { 
                        const heroName = enemyLaneAssignments[k]; 
                        const heroObj = enemySideTeam.find(c => c?.name === heroName); 
                        if(heroObj) clean[k] = heroObj.key; 
                    });
                    return Object.keys(clean).length > 0 ? clean : null;
                })(),
                model_type: useThinkingModel ? "reasoner" : "chat"
            };

            // 🔥 核心请求：调用 analyzeStream
            await analyzeStream(
                payload,
                token,
                // ✅ 回调 1: onDelta (流式逐字更新)
                (chunk) => {
                    // A. 更新 React 状态 (驱动 UI 渲染)
                    setAiResults(prev => {
                        // ⚠️ 关键修正：确保 oldText 是字符串，防止 null 导致崩溃
                        const oldText = typeof prev[mode] === 'string' ? prev[mode] : "";
                        return { ...prev, [mode]: oldText + chunk };
                    });
                    
                    // B. 更新本地累加器 (保证数据绝对连续)
                    localAccumulator += chunk;

                    // C. 同步给 Electron Overlay (节流 100ms)
                    const now = Date.now();
                    if (now - (window.lastStreamTime || 0) > 100) {
                        const streamData = { results: { ...baseResultsSnapshot, [mode]: localAccumulator }, currentMode: mode };
                        
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({ type: "SYNC_AI_RESULT", data: streamData }));
                        } else if (window.require) {
                            try { window.require('electron').ipcRenderer.send('analysis-result', streamData); } catch(e) {}
                        }
                        window.lastStreamTime = now;
                    }
                },
                // ✅ 回调 2: onDone (完成)
                (data, rawText) => {
                    setAnalyzingStatus(prev => ({ ...prev, [mode]: false }));
                    fetchUserInfo(); // 刷新剩余次数

                    // 发送最终完整帧 (确保不丢字)
                    const finalData = { results: { ...baseResultsSnapshot, [mode]: localAccumulator }, currentMode: mode };
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: "SYNC_AI_RESULT", data: finalData }));
                    } else if (window.require) {
                        try { window.require('electron').ipcRenderer.send('analysis-result', finalData); } catch(e) {}
                    }

                    // 📋 [修改] 自动复制逻辑：延迟 10 秒
                    if (autoCopy) {
                        setTimeout(() => {
                            // 尝试解析
                            const parsed = data || (localAccumulator ? JSON.parse(localAccumulator.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^```json/, "").replace(/```$/, "")) : null);
                            // 提取文案
                            const content = parsed?.concise?.content || (parsed?.dashboard?.headline ? `【赢法】${parsed.dashboard.headline}` : "");
                            
                            if (content) {
                                const cleanText = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/【/g, "[").replace(/】/g, "] ").trim();
                                const finalMsg = `${cleanText} (来自:海克斯教练)`;
                                
                                if (window.require) {
                                    try { 
                                        window.require('electron').ipcRenderer.send('copy-and-lock', finalMsg);
                                        toast.success("战术速览已自动复制！请直接在游戏内按 Ctrl+V", { duration: 5000, icon: '📋' });
                                    } catch(e) {}
                                } else {
                                    navigator.clipboard.writeText(finalMsg).then(() => {
                                        toast.success("战术速览已自动复制！请直接在游戏内按 Ctrl+V", { duration: 5000, icon: '📋' });
                                    }).catch(() => {});
                                }
                            }
                        }, 10000); // ⏱️ 10秒延迟
                    }
                },
                // ✅ 回调 3: onError (错误)
                (err) => {
                    if (err.message === 'AbortError') return;
                    const errorJson = JSON.stringify({ concise: { title: "分析中断", content: "连接不稳定，请重试。\n" + err.message } });
                    setAiResults(prev => ({ ...prev, [mode]: errorJson }));
                    setAnalyzingStatus(prev => ({ ...prev, [mode]: false }));
                }
            );

        } catch (error) {
            setAnalyzingStatus(prev => ({ ...prev, [mode]: false }));
            console.error("Analysis Error:", error);
        }
    };

    const handleClearAnalysis = (mode) => {
        setAiResults(prev => ({ ...prev, [mode]: null }));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { const baseResultsSnapshot = { ...aiResultsRef.current, [mode]: null }; wsRef.current.send(JSON.stringify({ type: "SYNC_AI_RESULT", data: { results: baseResultsSnapshot, currentMode: mode } })); }
    };
    
    const handleSaveShortcuts = (newShortcuts) => {
        setCurrentShortcuts(newShortcuts);
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-shortcuts', newShortcuts);
        }
    };
    
    const handleSyncProfile = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'REQ_LCU_PROFILE' }));
        } else {
            if (window.require) {
                try { window.require('electron').ipcRenderer.send('req-lcu-profile'); } catch(e) {}
            }
        }
    }, []);

    const markManualOverride = () => {
        hasManualOverride.current = true;
    };
    
    const handleTabClick = (mode) => { setAnalyzeType(mode); setActiveTab(0); };
    
    const handleLogin = async () => { try { const formData = new FormData(); formData.append("username", authForm.username); formData.append("password", authForm.password); const res = await axios.post(`${API_BASE_URL}/token`, formData); setToken(res.data.access_token); setCurrentUser(res.data.username); localStorage.setItem("access_token", res.data.access_token); localStorage.setItem("username", res.data.username); setShowLoginModal(false); fetchUserInfo(); } catch (e) { alert("登录失败"); } };
    const handleRegister = async () => { try { const payload = { ...authForm, sales_ref: authForm.sales_ref || localStorage.getItem('sales_ref') || null }; await axios.post(`${API_BASE_URL}/register`, payload); alert("注册成功"); setAuthMode("login"); localStorage.removeItem('sales_ref'); } catch (e) { alert(e.response?.data?.detail || "注册失败"); } };
    const logout = () => { setToken(null); setCurrentUser(null); setAccountInfo(null); localStorage.removeItem("access_token"); localStorage.removeItem("username"); };

    // 🔥 [新增] 处理清除对局信息 (注销时或手动触发)
    const handleClearSession = () => {
        setMySideTeam(DEFAULT_MY_SIDE);
        setEnemySideTeam(DEFAULT_ENEMY_SIDE);
        setMyLaneAssignments(DEFAULT_MY_LANES);
        setEnemyLaneAssignments(DEFAULT_ENEMY_LANES);
        setManualMyLanes({});
        setManualEnemyLanes({});
        setAiResults({ bp: null, personal: null, team: null });
        toast.success("对局信息已重置");
    };

    const handleCardClick = (idx, isEnemy) => { 
        setSelectingSlot(idx); 
        setSelectingIsEnemy(isEnemy); 
        setShowChampSelector(true);
        if (!isEnemy) { 
            setUserSlot(idx); 
            if (myTeamRoles && myTeamRoles[idx]) { setUserRole(myTeamRoles[idx]); } 
        } 
    };
    
    const handleSelectChampion = (hero) => { 
        const isEnemy = selectingIsEnemy; 
        const currentTeam = isEnemy ? [...enemySideTeam] : [...mySideTeam]; 
        const currentAssignments = isEnemy ? { ...enemyLaneAssignments } : { ...myLaneAssignments }; 
        const setAssignments = isEnemy ? setEnemyLaneAssignments : setMyLaneAssignments; 
        const setTeam = isEnemy ? setEnemySideTeam : setMySideTeam; 
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

    const fetchTips = async (targetOverride = null) => { 
        const myHeroName = mySideTeam[userSlot]?.name; 
        if (!myHeroName) return; 
        let target = targetOverride || tipTarget; 
        if (!target) { 
            if (userRole && enemyLaneAssignments[userRole]) { target = enemyLaneAssignments[userRole]; } 
            else if (userRole === 'JUNGLE') { 
                const enemyJg = Object.values(enemyLaneAssignments).find(h => enemySideTeam.find(c => c?.name === h)?.tags?.includes("Jungle") ) || enemySideTeam.find(c => c && c.tags && c.tags.includes("Jungle"))?.name; 
                target = enemyJg; 
            } 
            if (!target) target = enemySideTeam.find(c => c)?.name; 
        } 
        const data = await fetchMatchTips(myHeroName, target); 
        setTips(prev => { if (JSON.stringify(prev) === JSON.stringify(data)) return prev; return data; }); 
    };

    const handlePostTip = async (modalTarget, modalCategory) => { 
        if (!currentUser) return setShowLoginModal(true); 
        if (!inputContent.trim()) return; 
        const myHeroName = mySideTeam[userSlot]?.name; 
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
    const handleReportError = async () => { if (!currentUser) return setShowLoginModal(true); const contextData = { mode: analyzeType, myHero: mySideTeam[userSlot]?.name || "Unknown", userRole: userRole, mapSide: mapSide, myTeam: mySideTeam.map(c => c?.name || "Empty"), enemyTeam: enemySideTeam.map(c => c?.name || "Empty"), laneAssignments: { my: myLaneAssignments, enemy: enemyLaneAssignments } }; try { await authAxios.post(`/feedback`, { match_context: contextData, description: inputContent }); toast.success("反馈已提交", { icon: '📸' }); setShowFeedbackModal(false); setInputContent(""); } catch (e) { toast.error("反馈提交失败"); } };

    useEffect(() => { if (tipTarget) fetchTips(); }, [tipTarget]);
    useEffect(() => { setTipTarget(null); fetchTips(); }, [mySideTeam[userSlot], enemyLaneAssignments, userRole, enemySideTeam]);
    // =================================================================
    // 🔥 [升级版 V2] 自动团队分析触发器 (超强兼容性)
    // =================================================================
    
    useEffect(() => {
        // 1. 签名生成函数 (兼容所有字段格式)
        const getTeamSignature = (team) => {
            if (!Array.isArray(team)) return "";
            return team.map(h => {
                if (!h) return "null";
                // 优先取 ID，其次 Key，最后取 Name (确保手动/自动都能识别)
                return h.championId || h.key || h.championKey || h.name || "null";
            }).join("|");
        };

        const mySig = getTeamSignature(mySideTeam);
        const enemySig = getTeamSignature(enemySideTeam);
        const currentFullSignature = `${mySig}::${enemySig}`;

        // 2. 宽松的满员检查 (只要不是 null 且有基本信息即可)
        const isValidHero = (h) => h && (h.name || h.key || h.championKey || (h.championId && h.championId > 0));
        
        const isMyFull = Array.isArray(mySideTeam) && mySideTeam.length === 5 && mySideTeam.every(isValidHero);
        const isEnemyFull = Array.isArray(enemySideTeam) && enemySideTeam.length === 5 && enemySideTeam.every(isValidHero);

        // 3. 触发条件：双方满员 + 已登录
        if (isMyFull && isEnemyFull && token) {
            
            // 核心判断：如果当前阵容指纹 与 上次分析的不一样，且当前没有在分析中
            if (currentFullSignature !== lastAnalyzedTeamSignature.current && !analyzingStatus['team']) {
                console.log("🚀 [Auto] 阵容就绪，触发自动分析...");
                
                // 立即更新签名，防止重复触发
                lastAnalyzedTeamSignature.current = currentFullSignature;

                // 延迟 2 秒执行 (给用户一点反应时间，防止选人时的连点)
                const timer = setTimeout(() => {
                    // 🚀 触发分析：模式='team', 强制=false, 自动复制=true
                    handleAnalyze('team', false, true);
                    
                    toast.success("阵容已更新，正在生成策略...", { 
                        icon: '🧠',
                        duration: 3000,
                        style: { background: '#091428', color: '#C8AA6E', border: '1px solid #0AC8B9' }
                    });
                }, 2000);
                
                return () => clearTimeout(timer);
            }
        }
    }, [mySideTeam, enemySideTeam, token, analyzingStatus]);
    // 2. 如果阵容发生变动（变成不齐全），重置触发锁
    // 这样下一局（或重新选人）时可以再次自动触发
    useEffect(() => {
        const isMySideFull = Array.isArray(mySideTeam) && mySideTeam.length === 5 && mySideTeam.every(h => h && h.key);
        const isEnemySideFull = Array.isArray(enemySideTeam) && enemySideTeam.length === 5 && enemySideTeam.every(h => h && h.key);
        
        if (!isMySideFull || !isEnemySideFull) {
            hasAutoTeamAnalysisTriggered.current = false;
        }
    }, [mySideTeam, enemySideTeam]);

    // =========================================================================
    // 3. Effects (依赖于 Functions)
    // =========================================================================
    
    // 分路广播 Effect
    useEffect(() => {
        if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
        // 只要对象变化就广播
        broadcastState('SYNC_LANE_ASSIGNMENTS', { my: myLaneAssignments, enemy: enemyLaneAssignments });
    }, [myLaneAssignments, enemyLaneAssignments]);

    // 团队广播 Effect
    useEffect(() => {
         if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
         if (mySideTeam.some(c => c) || enemySideTeam.some(c => c)) {
             broadcastState('SYNC_TEAM_DATA', { myTeam: mySideTeam, enemyTeam: enemySideTeam });
         }
    }, [mySideTeam, enemySideTeam]);

    // 自动计算分路 Effects
    useEffect(() => {
        const myCurrentTeam = mySideTeam;
        if (myCurrentTeam.some(c => c !== null)) {
            setMyLaneAssignments(prev => {
                const next = {}; 
                const currentNames = myCurrentTeam.map(c => c?.name).filter(Boolean);
                const usedNames = new Set();
                Object.keys(manualMyLanes).forEach(role => {
                    const heroName = manualMyLanes[role];
                    if (heroName && currentNames.includes(heroName)) {
                        next[role] = heroName;
                        usedNames.add(heroName);
                    }
                });
                myCurrentTeam.forEach((hero, idx) => {
                    if (hero && !usedNames.has(hero.name)) {
                        const lcuRole = myTeamRoles[idx];
                        if (lcuRole && ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].includes(lcuRole) && !next[lcuRole]) {
                            next[lcuRole] = hero.name;
                            usedNames.add(hero.name);
                        }
                    }
                });
                const hasUnassignedHeroes = myCurrentTeam.some(c => c && !usedNames.has(c.name));
                if (hasUnassignedHeroes) {
                    const aiSuggestions = guessRoles(myCurrentTeam, roleMapping, myTeamRoles);
                    Object.keys(aiSuggestions).forEach(role => {
                        const suggested = aiSuggestions[role];
                        if (!next[role] && suggested && !usedNames.has(suggested)) {
                            next[role] = suggested;
                            usedNames.add(suggested);
                        }
                    });
                    const remaining = myCurrentTeam.filter(c => c && !usedNames.has(c.name));
                    ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].forEach(role => {
                        if (!next[role] && remaining.length > 0) {
                            next[role] = remaining.shift().name;
                        }
                    });
                }
                ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"].forEach(role => { if (!next[role]) next[role] = ""; });
                if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
                return next;
            });
        }
    }, [mySideTeam, myTeamRoles, roleMapping, manualMyLanes]);

    useEffect(() => {
        const enemyCurrentTeam = enemySideTeam;
        if (enemyCurrentTeam.some(c => c !== null)) {
            setEnemyLaneAssignments(prev => {
                const next = { ...prev };
                const currentNames = enemyCurrentTeam.map(c => c?.name).filter(Boolean);
                const usedNames = new Set();
                Object.keys(manualEnemyLanes).forEach(role => {
                    const heroName = manualEnemyLanes[role];
                    if (heroName && currentNames.includes(heroName)) {
                        next[role] = heroName;
                        usedNames.add(heroName);
                    }
                });
                Object.keys(next).forEach(role => { 
                    const assignedName = next[role]; 
                    if (assignedName && !usedNames.has(assignedName)) {
                        if (currentNames.includes(assignedName)) { usedNames.add(assignedName); } 
                        else { next[role] = ""; } 
                    }
                });
                const hasUnassignedHeroes = enemyCurrentTeam.some(c => c && !usedNames.has(c.name));
                if (hasUnassignedHeroes) {
                    const aiSuggestions = guessRoles(enemyCurrentTeam, roleMapping, []);
                    Object.keys(next).forEach(role => { 
                        if (!next[role]) { 
                            const suggested = aiSuggestions[role]; 
                            if (suggested && !usedNames.has(suggested)) { 
                                next[role] = suggested; 
                                usedNames.add(suggested); 
                            } 
                        } 
                    });
                    const remaining = enemyCurrentTeam.filter(c => c && !usedNames.has(c.name));
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
    }, [enemySideTeam, roleMapping, manualEnemyLanes]);

    // WebSocket Effect (uses handleLcuUpdate)
    useEffect(() => {
        let ws = null;
        let timer = null;
        let isMounted = true; 

        const connect = () => {
            if (!isMounted) return;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

            ws = new WebSocket(BRIDGE_WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("✅ [Frontend] WebSocket 连接成功");
                if (isMounted) setLcuStatus("connected");
                ws.send(JSON.stringify({ type: 'REQUEST_SYNC' }));
            };

            ws.onclose = () => {
                if (isMounted) {
                    console.log("⚠️ [Frontend] WebSocket 断开，3秒后重连...");
                    setLcuStatus("disconnected");
                    timer = setTimeout(connect, 3000); 
                }
            };

            ws.onerror = () => { if (ws) ws.close(); };

            ws.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const msg = JSON.parse(event.data);
                    
                    if (msg.type === 'LCU_PROFILE_UPDATE') {
                        setLcuProfile(msg.data);
                        if (token) {
                            axios.post(`${API_BASE_URL}/users/sync_profile`, msg.data, { 
                                headers: { Authorization: `Bearer ${token}` } 
                            }).then(() => {
                                if (typeof fetchUserInfo === 'function') fetchUserInfo();
                                setLcuProfile(null); 
                            }).catch(e => console.error(e));
                        }
                    }

                    if (msg.type === 'CHAMP_SELECT') {
                        isRemoteUpdate.current = true;
                        setRawLcuData(msg.data);

                        // 🔥 网页端收到数据后，手动触发状态更新
                        if (championList.length > 0) {
                            const data = msg.data;
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
                                localPlayerCellId: data.localPlayerCellId !== undefined ? data.localPlayerCellId : -1,
                                extraMechanics: data.extraMechanics || {}
                            };
                            
                            handleLcuUpdate(adaptedSession);
                            setLcuStatus("connected");
                        }
                    }
                    
                    if (msg.type === 'STATUS') {
                        if(msg.data === 'connected') setLcuStatus("connected");
                        else if(msg.data === 'disconnected') { setLcuStatus("disconnected"); setLcuRealRole(""); }
                    }

                    if (msg.type === 'REQUEST_SYNC') {
                        const currentMyTeam = mySideTeamRef.current;
                        const isDefault = JSON.stringify(currentMyTeam) === JSON.stringify(DEFAULT_MY_SIDE);
                        const isLCU = lcuStatusRef.current === 'connected';

                        if (!isDefault || isLCU || aiResultsRef.current?.personal) {
                            if (aiResultsRef.current) {
                                ws.send(JSON.stringify({ 
                                    type: 'SYNC_AI_RESULT', 
                                    data: { results: aiResultsRef.current, currentMode: analyzeTypeRef.current } 
                                }));
                            }
                            ws.send(JSON.stringify({ 
                                type: 'SYNC_LANE_ASSIGNMENTS', 
                                data: { my: myLaneAssignmentsRef.current, enemy: enemyLaneAssignmentsRef.current } 
                            }));
                            ws.send(JSON.stringify({ 
                                type: 'SYNC_TEAM_DATA', 
                                data: { myTeam: mySideTeamRef.current, enemyTeam: enemySideTeamRef.current } 
                            }));
                        }
                    }
                    
                    if (msg.type === 'SYNC_LANE_ASSIGNMENTS') {
                        if (!hasManualOverride.current) {
                            isRemoteUpdate.current = true;
                            setMyLaneAssignments(msg.data.my);
                            setEnemyLaneAssignments(msg.data.enemy);
                        }
                    }
                    
                    if (msg.type === 'SYNC_TEAM_DATA') {
                         isRemoteUpdate.current = true;
                         setMySideTeam(msg.data.myTeam);
                         setEnemySideTeam(msg.data.enemyTeam);
                    }
                    
                    if (msg.type === 'SYNC_AI_RESULT') {
                        const { results, currentMode } = msg.data;
                        if (results) setAiResults(results);
                        if (currentMode) setAnalyzeType(currentMode);
                    }

                } catch(e) { console.error("WS解析错误:", e); }
            };
        };

        connect();

        return () => {
            isMounted = false; 
            if (timer) clearTimeout(timer);
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
        };
    }, [championList]); // 添加 championList 依赖

    // IPC Effect
    useEffect(() => {
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.invoke('get-shortcuts').then(savedConfig => { if (savedConfig) setCurrentShortcuts(savedConfig); });

                const handleElectronLcuUpdate = (event, data) => {
                    if (!data) return;
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
                    if (token) {
                        axios.post(`${API_BASE_URL}/users/sync_profile`, profileData, { 
                            headers: { Authorization: `Bearer ${token}` } 
                        }).then(() => { if (typeof fetchUserInfo === 'function') fetchUserInfo(); })
                        .catch(e => console.error("Sync error", e));
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
                        if (!hasManualOverride.current) {
                            isRemoteUpdate.current = true;
                            setMyLaneAssignments(msg.data.my);
                            setEnemyLaneAssignments(msg.data.enemy);
                        }
                    }
                    if (msg.type === 'SYNC_TEAM_DATA') {
                        isRemoteUpdate.current = true;
                        setMySideTeam(msg.data.myTeam);
                        setEnemySideTeam(msg.data.enemyTeam);
                    }
                };

                // 🔥🔥🔥 [修复] 快捷键处理器：HUD 隔离逻辑 🔥🔥🔥
                const handleCommand = (event, command) => {
                    if (command === 'refresh') { 
                        handleAnalyze(analyzeTypeRef.current, true); 
                        toast("正在刷新...", { icon: '⏳', duration: 800 }); 
                        return;
                    }

                    // 🛡️ HUD/Overlay 模式下，禁止切换全局模式
                    if (isOverlay && (command === 'mode_prev' || command === 'mode_next')) {
                        return; 
                    }

                    const MODES = ['bp', 'personal', 'team'];
                    if (command === 'mode_prev') handleTabClick(MODES[(MODES.indexOf(analyzeTypeRef.current) - 1 + MODES.length) % MODES.length]);
                    if (command === 'mode_next') handleTabClick(MODES[(MODES.indexOf(analyzeTypeRef.current) + 1) % MODES.length]);
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
    }, [championList, token, isOverlay]); 

    return {
        state: { 
            version, championList, showAdminPanel, adminView, isOverlay, hasStarted, showCommunity, showProfile, showSettingsModal, currentShortcuts, sendChatTrigger, 
            blueTeam: mySideTeam, 
            redTeam: enemySideTeam, 
            myTeamRoles, userRole, lcuStatus, userRank, enemyLaneAssignments, myLaneAssignments, useThinkingModel, aiResults, analyzingStatus, isModeAnalyzing, analyzeType, viewMode, activeTab, showChampSelector, selectingSlot, selectingIsEnemy, roleMapping, currentUser, accountInfo, token, authMode, authForm, showLoginModal, showPricingModal, tips, tipTarget, inputContent, tipTargetEnemy, showTipModal, showFeedbackModal, userSlot, mapSide,showDownloadModal, showSalesDashboard,lcuProfile, gamePhase 
        },
        actions: { 
            autoAssignLanes,setHasStarted, setShowCommunity, setShowProfile, setShowAdminPanel,setAdminView, setShowSettingsModal, 
            setBlueTeam: setMySideTeam, 
            setRedTeam: setEnemySideTeam, 
            setUserRole, setUserRank, setMyLaneAssignments, setEnemyLaneAssignments, setUseThinkingModel, setAnalyzeType, setAiResults, setViewMode, setActiveTab, setShowChampSelector, setSelectingSlot, setSelectingIsEnemy, setAuthMode, setAuthForm, setShowLoginModal, setShowPricingModal, setInputContent, setShowTipModal, setShowFeedbackModal, setTipTarget, setUserSlot, handleLogin, handleRegister, logout, handleClearSession, handleAnalyze, fetchUserInfo, handleCardClick, handleSelectChampion, handleSaveShortcuts, handlePostTip, handleLike, handleDeleteTip, handleReportError, handleTabClick,setMapSide, setShowDownloadModal, setShowSalesDashboard,handleSyncProfile,handleClearAnalysis,
            markManualOverride 
        }
    };
}