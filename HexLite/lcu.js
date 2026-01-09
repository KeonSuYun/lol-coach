// HexLite/lcu.js
const find = require('find-process');
const WebSocket = require('ws');
const https = require('https');
const axios = require('axios');

const agent = new https.Agent({ rejectUnauthorized: false });

// 缓存系统
const basicInfoCache = {}; 
const mechanicsCache = {};
let currentSummonerId = null; // 本地玩家ID缓存

// 队列 ID 映射 (仅用于判断是否记录战绩)
const QUEUE_ID_MAP = {
    420: "排位赛 单/双",
    440: "灵活组排 5v5",
    430: "匹配模式 (盲选)",
    400: "匹配模式 (征召)", // 新增征召模式匹配
};

// --- 基础连接功能 ---

async function getCredentials() {
    try {
        const list = await find('name', 'LeagueClientUx.exe', true);
        if (list.length === 0) return { status: 'not-found' };
        
        const processInfo = list[0];
        const cmd = processInfo.cmd;
        if (!cmd) return { status: 'permission-denied' };

        const portMatch = cmd.match(/--app-port=["']?(\d+)["']?/);
        const passwordMatch = cmd.match(/--remoting-auth-token=["']?([\w-]+)["']?/);

        if (!portMatch || !passwordMatch) return { status: 'no-credentials' };

        return {
            status: 'success',
            port: portMatch[1],
            password: passwordMatch[1],
            url: `https://127.0.0.1:${portMatch[1]}`,
            auth: 'Basic ' + Buffer.from(`riot:${passwordMatch[1]}`).toString('base64')
        };
    } catch (e) { 
        return { status: 'error' }; 
    }
}

// --- 数据获取功能 ---

async function fetchChampionDetail(creds, championId, needMechanics = false) {
    if (!championId || championId === 0) return null;

    // 缓存命中检查
    if (!needMechanics && basicInfoCache[championId]) return basicInfoCache[championId];
    if (needMechanics && mechanicsCache[championId]) return mechanicsCache[championId];

    try {
        const res = await axios.get(`${creds.url}/lol-game-data/assets/v1/champions/${championId}.json`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth, 'Accept': 'application/json' },
            timeout: 2000 // 防止请求挂起
        });
        
        const data = res.data;
        if (!data) return null;

        const basicInfo = { id: data.id, alias: data.alias, name: data.name };
        basicInfoCache[championId] = basicInfo;

        if (!needMechanics) return basicInfo;

        // 详细技能处理 (仅对位和自己需要)
        const spellsInfo = (data.spells || []).map(s => {
            const cleanDesc = s.description ? s.description.replace(/<[^>]+>/g, '').substring(0, 300) : "暂无描述";
            return `【${s.spellKey.toUpperCase()} - ${s.name}】CD:${s.cooldownBurn}s | ${cleanDesc}`;
        });
        const cleanPassive = data.passive?.description ? data.passive.description.replace(/<[^>]+>/g, '').substring(0, 300) : "暂无";
        const rawText = `【被动 - ${data.passive?.name || '未知'}】${cleanPassive}\n${spellsInfo.join('\n')}`;

        const fullInfo = { ...basicInfo, fullMechanics: rawText };
        mechanicsCache[championId] = fullInfo;
        return fullInfo;

    } catch (e) { return null; }
}

async function fetchSession(creds) {
    try {
        const res = await axios.get(`${creds.url}/lol-champ-select/v1/session`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }, timeout: 1500
        });
        return res.data;
    } catch (e) { return null; }
}

async function fetchGameflowSession(creds) {
    try {
        const res = await axios.get(`${creds.url}/lol-gameflow/v1/session`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }, timeout: 1500
        });
        return res.data;
    } catch (e) { return null; }
}

async function fetchGameFlowPhase(creds) {
    try {
        const res = await axios.get(`${creds.url}/lol-gameflow/v1/gameflow-phase`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }, timeout: 1500
        });
        return res.data; 
    } catch (e) { return null; }
}

// --- 核心逻辑处理 ---

// 1. 选人阶段 (Champ Select)
async function processSession(session, creds, callback) {
    if (!session || !session.myTeam) return;

    // 🔥 [修复] 变量名统一为 localPlayerCellId
    const localPlayerCellId = session.localPlayerCellId;
    let myRole = null;
    let targetChampionIds = new Set();

    // 找自己
    const myPlayer = session.myTeam.find(p => p.cellId === localPlayerCellId);
    if (myPlayer) {
        targetChampionIds.add(myPlayer.championId);
        myRole = myPlayer.assignedPosition;
    }

    // 找对位
    if (myRole && session.theirTeam) {
        const enemyLaner = session.theirTeam.find(p => p.assignedPosition === myRole);
        if (enemyLaner) targetChampionIds.add(enemyLaner.championId);
    }

    const parseTeam = async (teamArr) => {
        if (!Array.isArray(teamArr)) return [];
        return await Promise.all(teamArr.map(async (p) => {
            let key = null;
            if (p.championId && p.championId !== 0) {
                const isTarget = targetChampionIds.has(p.championId);
                const detail = await fetchChampionDetail(creds, p.championId, isTarget);
                if (detail) key = detail.alias || detail.id;
            }
            return {
                cellId: p.cellId,
                championId: p.championId || 0,
                championKey: key,
                summonerId: p.summonerId,
                assignedPosition: p.assignedPosition || ""
            };
        }));
    };

    const myTeam = await parseTeam(session.myTeam);
    const enemyTeam = await parseTeam(session.theirTeam);

    const extraMechanics = {};
    targetChampionIds.forEach(id => {
        if (mechanicsCache[id]) {
            const info = mechanicsCache[id];
            if (info.alias) extraMechanics[info.alias] = info.fullMechanics;
            if (info.id) extraMechanics[info.id] = info.fullMechanics;
        }
    });

    let mapSide = 'unknown';
    if (session.myTeam && session.myTeam.length > 0) {
        mapSide = session.myTeam[0].cellId < 5 ? 'blue' : 'red';
    }

    // 🔥 [修复] 这里现在能正确引用变量了
    callback({ myTeam, enemyTeam, mapSide, localPlayerCellId, extraMechanics });
}

// 2. 游戏加载阶段 (Gameflow - 修复盲选/人机问题)
async function processGameStartData(gameData, creds, callback) {
    if (!gameData || !gameData.gameData) return;
    
    const teamOne = gameData.gameData.teamOne || [];
    const teamTwo = gameData.gameData.teamTwo || [];

    // 确保有 summonerId
    if (!currentSummonerId) {
        const profile = await getProfileData();
        if (profile) currentSummonerId = profile.summonerId;
    }

    // 强类型比对
    let amInTeamOne = teamOne.some(p => String(p.summonerId) === String(currentSummonerId));
    let amInTeamTwo = teamTwo.some(p => String(p.summonerId) === String(currentSummonerId));

    // 智能兜底：人机模式下 ID 可能变异，靠人数判断
    if (!amInTeamOne && !amInTeamTwo) {
        if (teamOne.length > 0 && teamTwo.length === 0) amInTeamOne = true;
        else if (teamOne.length === 0 && teamTwo.length > 0) amInTeamOne = false;
        else amInTeamOne = true; // 默认蓝方
    }

    const myRawTeam = amInTeamOne ? teamOne : teamTwo;
    const enemyRawTeam = amInTeamOne ? teamTwo : teamOne;
    const mapSide = amInTeamOne ? 'blue' : 'red';

    // 手动计算 CellId (0-4 vs 5-9)
    let localPlayerCellId = 0;
    const myIndex = myRawTeam.findIndex(p => String(p.summonerId) === String(currentSummonerId));
    if (myIndex !== -1) {
        localPlayerCellId = (amInTeamOne ? 0 : 5) + myIndex;
    }

    const parseGameTeam = async (rawArr, offset) => {
        if (!Array.isArray(rawArr)) return [];
        return await Promise.all(rawArr.map(async (p, index) => {
            let key = null;
            if (p.championId && p.championId !== 0) {
                // 加载界面只读基础信息，不读技能，防卡顿
                const detail = await fetchChampionDetail(creds, p.championId, false);
                if (detail) key = detail.alias || detail.id;
            }
            return {
                cellId: offset + index, // 🔥 强制座位号
                championId: p.championId || 0,
                championKey: key,
                summonerName: p.summonerName,
                assignedPosition: p.selectedPosition || "" 
            };
        }));
    };

    const myTeam = await parseGameTeam(myRawTeam, amInTeamOne ? 0 : 5);
    const enemyTeam = await parseGameTeam(enemyRawTeam, amInTeamOne ? 5 : 0);

    // 防止空更新
    if (myTeam.length === 0) return;

    callback({
        myTeam,
        enemyTeam,
        mapSide,
        localPlayerCellId,
        extraMechanics: {} 
    });
}

// --- 用户信息获取 ---

async function getProfileData() {
    const creds = await getCredentials();
    if (creds.status !== 'success') return null;

    let summoner = {};
    let rankedStats = {};
    let masteryIds = [];
    let matchList = [];
    let calculatedKda = "0.0";

    // A. 获取基本信息 (这些通常很快)
    try {
        const res = await axios.get(`${creds.url}/lol-summoner/v1/current-summoner`, { 
            httpsAgent: agent, headers: { 'Authorization': creds.auth }, timeout: 2000 
        });
        summoner = res.data;
        currentSummonerId = summoner.summonerId;
    } catch (e) { console.error("LCU Summoner Error", e.message); return null; }

    // B. 获取段位 (优先单双排)
    try {
        console.log("正在读取段位数据...");
        const res = await axios.get(`${creds.url}/lol-ranked/v1/current-ranked-stats`, { 
            httpsAgent: agent, 
            headers: { 'Authorization': creds.auth }, 
            timeout: 5000 // 增加到 5秒，防止超时
        });
        
        const queues = res.data.queues || [];
        
        // 🔍 调试日志：打印出所有找到的队列，看看有没有你的段位
        // (在 VSCode 终端可以看到这个输出)
        console.log("🔎 [LCU] 扫描到的排位队列:", queues.map(q => `${q.queueType}: ${q.tier} ${q.division}`));

        // 1. 优先找 单双排
        rankedStats = queues.find(q => q.queueType === "RANKED_SOLO_5x5") || {};
        
        // 2. 如果单双没段位，找 灵活组排
        if (!rankedStats.tier) {
            rankedStats = queues.find(q => q.queueType === "RANKED_FLEX_SR") || {};
        }
        
        // 3. 如果还是没有，找 云顶之弈 (TFT) 或其他任何有段位的模式兜底
        if (!rankedStats.tier && queues.length > 0) {
            rankedStats = queues.find(q => q.tier && q.tier !== "NONE" && q.tier !== "NA") || {};
        }

    } catch (e) { 
        console.error("❌ [LCU] 获取段位失败:", e.message); 
    }

    // C. 获取熟练度
    try {
        const res = await axios.get(`${creds.url}/lol-champion-mastery/v1/local-player/champion-mastery`, { 
            httpsAgent: agent, headers: { 'Authorization': creds.auth }, timeout: 2000 
        });
        if (Array.isArray(res.data)) {
            masteryIds = res.data.sort((a, b) => b.championPoints - a.championPoints).slice(0, 3).map(m => m.championId);
        }
    } catch (e) {}

    // D. 🔥 核心修复：获取战绩 (增加重试机制 + 8秒长超时)
    try {
        console.log("正在拉取战绩...");
        const matchRes = await axios.get(`${creds.url}/lol-match-history/v1/products/lol/current-summoner/matches`, { 
            httpsAgent: agent, 
            headers: { 'Authorization': creds.auth }, 
            timeout: 8000 // 8秒超时，给客户端足够的反应时间
        });
        
        const rawGames = matchRes.data.games?.games || [];
        // 按游戏结束时间倒序 (最新的在最前)
        const allGamesSorted = rawGames.sort((a, b) => b.gameCreation - a.gameCreation);

        let validGames = [], k=0, d=0, a=0;
        for (const g of allGamesSorted) {
            // 🔥 严格过滤：如果不是我们定义的 ID，直接跳过
            if (!QUEUE_ID_MAP[g.queueId]) continue;
            
            const p = g.participants[0];
            k += p.stats.kills; d += p.stats.deaths; a += p.stats.assists;
            
            validGames.push({
                id: g.gameId, 
                gameId: g.gameId, // 兼容字段
                type: p.stats.win ? "victory" : "defeat", 
                champ: p.championId,
                kda: `${p.stats.kills}/${p.stats.deaths}/${p.stats.assists}`,
                // 传原始时间戳，方便后端排序
                gameCreation: g.gameCreation, 
                // 格式化时间 (例如: 2024/1/1)
                time: new Date(g.gameCreation).toLocaleDateString(),
                mode: QUEUE_ID_MAP[g.queueId]
            });
            if (validGames.length >= 20) break;
        }
        matchList = validGames;
        if (matchList.length > 0) calculatedKda = ((k+a)/(d===0?1:d)).toFixed(1) + ":1";
        
        console.log(`✅ [LCU] 战绩获取成功: 抓取到 ${matchList.length} 场有效对局`);

    } catch (e) {
        console.error("❌ [LCU] 战绩获取超时或失败:", e.message);
        // 这里不返回 null，而是返回空数组，避免整个档案同步失败
    }

    return {
        summonerId: summoner.summonerId,
        gameName: summoner.gameName || summoner.displayName || "Unknown", 
        tagLine: summoner.tagLine || "",
        level: summoner.summonerLevel || 1,
        profileIconId: summoner.profileIconId || 29,
        rank: rankedStats.tier ? `${rankedStats.tier} ${rankedStats.division}` : 'UNRANKED',
        lp: rankedStats.leaguePoints || 0,
        winRate: (rankedStats.wins + rankedStats.losses) > 0 ? Math.round((rankedStats.wins / (rankedStats.wins + rankedStats.losses)) * 100) : 0,
        matches: matchList, 
        kda: calculatedKda, 
        mastery: masteryIds
    };
}

// --- 主连接函数 ---

async function connectToLCU(callback, onWarning) {
    const result = await getCredentials();
    if (result.status !== 'success') {
        if (result.status === 'permission-denied' && onWarning) onWarning('permission-denied');
        return;
    }
    const creds = result; 

    // 初始状态检查
    try {
        const initialData = await fetchSession(creds);
        if (initialData) await processSession(initialData, creds, callback);
        
        await getProfileData(); // 预热 ID

        const initialPhase = await fetchGameFlowPhase(creds);
        if (initialPhase) {
            callback({ gamePhase: initialPhase });
            if (initialPhase === 'InProgress') {
                const gameData = await fetchGameflowSession(creds);
                if (gameData) await processGameStartData(gameData, creds, callback);
            }
        }
    } catch (e) {}

    // WebSocket 连接
    const wsUrl = `wss://riot:${creds.password}@127.0.0.1:${creds.port}`;
    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });

    ws.on('open', () => {
        console.log('✅ [Lite] LCU WebSocket 连接成功');
        ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
        ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-gameflow_v1_gameflow-phase']));
    });

    ws.on('error', () => { /* 静默错误，等待重连逻辑 */ });

    ws.on('message', async (data) => {
        try {
            if (!data) return;
            const json = JSON.parse(data);
            if (!json || !json[2]) return;

            const uri = json[2].uri;
            const eventType = json[2].eventType;
            const payload = json[2].data;

            // BP 变化
            if (uri === '/lol-champ-select/v1/session') {
                if (eventType === 'Delete') { 
                    callback({ myTeam: [], enemyTeam: [] }); 
                    return; 
                }
                await processSession(payload, creds, callback);
            }
            
            // 阶段变化
            if (uri === '/lol-gameflow/v1/gameflow-phase') {
                callback({ gamePhase: payload });
                
                // 🔥 加载界面重读逻辑
                if (payload === 'InProgress') {
                    console.log('🔄 [LCU] 进入加载界面，尝试 Gameflow 数据...');
                    setTimeout(async () => {
                        try {
                            const gameData = await fetchGameflowSession(creds);
                            if (gameData) await processGameStartData(gameData, creds, callback);
                        } catch (e) { console.error('Error fetching gameflow:', e); }
                    }, 2000); 
                }
            }
        } catch (e) {}
    });
}

module.exports = { connectToLCU, getProfileData };