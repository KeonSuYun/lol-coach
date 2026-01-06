// HexLite/lcu.js
const find = require('find-process');
const WebSocket = require('ws');
const https = require('https');
const axios = require('axios');

const agent = new https.Agent({ rejectUnauthorized: false });

// 缓存：分为“基础信息缓存”和“详细技能缓存”，避免重复请求
const basicInfoCache = {}; 
const mechanicsCache = {};

// 🔥 队列 ID 映射表
const QUEUE_ID_MAP = {
    420: "排位赛 单/双",
    440: "灵活组排 5v5"
};

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

// ⚡️ [智能获取] 根据需求决定是否解析技能文本
async function fetchChampionDetail(creds, championId, needMechanics = false) {
    if (!championId || championId === 0) return null;

    // 1. 如果只需要基础信息(头像)，且已有缓存，直接返回
    if (!needMechanics && basicInfoCache[championId]) {
        return basicInfoCache[championId];
    }

    // 2. 如果需要详细技能，且已有详细缓存，直接返回
    if (needMechanics && mechanicsCache[championId]) {
        return mechanicsCache[championId];
    }

    try {
        // 请求 LCU 获取数据
        const res = await axios.get(`${creds.url}/lol-game-data/assets/v1/champions/${championId}.json`, {
            httpsAgent: agent,
            headers: { 'Authorization': creds.auth, 'Accept': 'application/json' }
        });
        
        const data = res.data;
        if (!data) return null;

        // 构建基础信息 (用于显示头像)
        const basicInfo = {
            id: data.id,
            alias: data.alias, // 核心：用于前端拼接图片URL
            name: data.name
        };
        basicInfoCache[championId] = basicInfo; // 存入基础缓存

        // 如果不需要技能，直接返回基础版，节省大量CPU
        if (!needMechanics) {
            return basicInfo;
        }

        // --- 以下仅针对自己和对位执行 (繁重的文本处理) ---
        const spellsInfo = data.spells.map(s => {
            const cleanDesc = s.description.replace(/<[^>]+>/g, '').substring(0, 300);
            return `【${s.spellKey.toUpperCase()} - ${s.name}】CD:${s.cooldownBurn}s | ${cleanDesc}`;
        });
        const cleanPassive = data.passive.description.replace(/<[^>]+>/g, '').substring(0, 300);
        const rawText = `【被动 - ${data.passive.name}】${cleanPassive}\n${spellsInfo.join('\n')}`;

        const fullInfo = { ...basicInfo, fullMechanics: rawText };
        mechanicsCache[championId] = fullInfo; // 存入详细缓存
        
        return fullInfo;

    } catch (e) {
        return null;
    }
}

async function fetchSession(creds) {
    try {
        const res = await axios.get(`${creds.url}/lol-champ-select/v1/session`, {
            httpsAgent: agent,
            headers: { 'Authorization': creds.auth, 'Accept': 'application/json' }
        });
        return res.data;
    } catch (e) { return null; }
}

async function fetchGameFlowPhase(creds) {
    try {
        const res = await axios.get(`${creds.url}/lol-gameflow/v1/gameflow-phase`, {
            httpsAgent: agent,
            headers: { 'Authorization': creds.auth, 'Accept': 'application/json' }
        });
        return res.data; 
    } catch (e) { return null; }
}

// 🔥 [逻辑核心] 智能识别对位 + 修复数据传递
async function processSession(session, creds, callback) {
    if (!session || !session.myTeam) return;

    // 1. 找出我自己和我的对位
    const localCellId = session.localPlayerCellId;
    let myRole = null;
    let targetChampionIds = new Set(); // 需要读取技能的英雄ID集合

    // 先遍历找自己
    const myPlayer = session.myTeam.find(p => p.cellId === localCellId);
    if (myPlayer) {
        targetChampionIds.add(myPlayer.championId); // 添加自己
        myRole = myPlayer.assignedPosition; // e.g., "JUNGLE"
    }

    // 再遍历找对位 (在敌方阵营找同位置)
    if (myRole && session.theirTeam) {
        const enemyLaner = session.theirTeam.find(p => p.assignedPosition === myRole);
        if (enemyLaner) {
            targetChampionIds.add(enemyLaner.championId); // 添加对位
        }
    }

    // 2. 解析队伍 (应用智能筛选)
    const parseTeam = async (teamArr) => {
        const processed = await Promise.all(teamArr.map(async (p) => {
            let key = null;
            if (p.championId && p.championId !== 0) {
                // 🔥 关键判断：是否是目标英雄？
                const isTarget = targetChampionIds.has(p.championId);
                const detail = await fetchChampionDetail(creds, p.championId, isTarget);
                
                if (detail) key = detail.alias || detail.id; // 修复：确保前端能拿到 key
            }
            return {
                cellId: p.cellId,
                championId: p.championId || 0,
                championKey: key, // 用于显示头像
                summonerId: p.summonerId,
                assignedPosition: p.assignedPosition || ""
            };
        }));
        return processed;
    };

    const myTeam = await parseTeam(session.myTeam);
    const enemyTeam = await parseTeam(session.theirTeam);

    // 3. 构建 extraMechanics (仅包含筛选出的两个英雄)
    const extraMechanics = {};
    // 从缓存中提取刚才解析好的详细信息
    targetChampionIds.forEach(id => {
        if (mechanicsCache[id]) {
            // 使用 ID 作为 Key，与 server.py 保持一致
            // 注意：fetchChampionDetail 内部已经把 alias 放在 basicInfo 里了，
            // 但 extraMechanics 的 key 需要看 server.py 是用 id 还是 alias 查的。
            // 通常前端传给后端的是 ID (如 266) 或 Key (Aatrox)。
            // 这里我们用 alias (标准英文名) 做 key 更稳妥，或者两个都存。
            const info = mechanicsCache[id];
            if (info.alias) extraMechanics[info.alias] = info.fullMechanics;
            if (info.id) extraMechanics[info.id] = info.fullMechanics; // 兼容数字ID
        }
    });

    // 4. 判断红蓝方
    let mapSide = 'unknown';
    if (session.myTeam && session.myTeam.length > 0) {
        const firstMemberCellId = session.myTeam[0].cellId;
        mapSide = firstMemberCellId < 5 ? 'blue' : 'red';
    }

    // 5. 回调发送数据
    callback({ 
        myTeam, 
        enemyTeam, 
        mapSide,
        localPlayerCellId: localCellId,
        extraMechanics // ✅ 现在这里只包含极少量数据，不会卡顿
    });
}

// ... getProfileData 保持不变 ...
async function getProfileData() {
    const creds = await getCredentials();
    if (creds.status !== 'success') return null;

    let summoner = {};
    let rankedStats = {};
    let masteryIds = [];
    let matchList = [];
    let calculatedKda = "0.0";

    try {
        const res = await axios.get(`${creds.url}/lol-summoner/v1/current-summoner`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }
        });
        summoner = res.data;
    } catch (e) { return null; }

    try {
        const res = await axios.get(`${creds.url}/lol-ranked/v1/current-ranked-stats`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }
        });
        const queues = res.data.queues || [];
        rankedStats = queues.find(q => q.queueType === "RANKED_SOLO_5x5") || 
                      queues.find(q => q.queueType === "RANKED_FLEX_SR") || {};
        if (!rankedStats.tier && queues.length > 0) rankedStats = queues.find(q => q.tier) || {};
    } catch (e) {}

    try {
        const res = await axios.get(`${creds.url}/lol-champion-mastery/v1/local-player/champion-mastery`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }
        });
        if (Array.isArray(res.data)) {
            masteryIds = res.data.sort((a, b) => b.championPoints - a.championPoints).slice(0, 3).map(m => m.championId);
        }
    } catch (e) {}

    try {
        const matchRes = await axios.get(`${creds.url}/lol-match-history/v1/products/lol/current-summoner/matches`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }
        });
        const rawGames = matchRes.data.games ? matchRes.data.games.games : [];
        const allGamesSorted = rawGames.sort((a, b) => b.gameCreation - a.gameCreation);

        let validGames = [];
        let totalKills = 0, totalDeaths = 0, totalAssists = 0;

        for (const g of allGamesSorted) {
            if (!QUEUE_ID_MAP[g.queueId]) continue;
            const p = g.participants[0];
            totalKills += p.stats.kills;
            totalDeaths += p.stats.deaths;
            totalAssists += p.stats.assists;

            const diffMs = Date.now() - g.gameCreation;
            let timeStr = diffMs > 86400000 ? `${Math.floor(diffMs / 86400000)}天前` : "今天";

            validGames.push({
                id: g.gameId,
                type: p.stats.win ? "victory" : "defeat",
                champ: p.championId,
                kda: `${p.stats.kills}/${p.stats.deaths}/${p.stats.assists}`,
                time: timeStr,
                mode: QUEUE_ID_MAP[g.queueId]
            });
            if (validGames.length >= 30) break;
        }
        matchList = validGames;
        if (matchList.length > 0) {
            const avgD = totalDeaths === 0 ? 1 : totalDeaths;
            calculatedKda = ((totalKills + totalAssists) / avgD).toFixed(1) + ":1";
        }
    } catch (e) {}

    return {
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

async function connectToLCU(callback, onWarning) {
    const result = await getCredentials();
    if (result.status !== 'success') {
        if (result.status === 'permission-denied' && onWarning) onWarning('permission-denied');
        return;
    }

    const creds = result; 

    // 初始化获取
    const initialData = await fetchSession(creds);
    if (initialData) await processSession(initialData, creds, callback);

    const initialPhase = await fetchGameFlowPhase(creds);
    if (initialPhase) callback({ gamePhase: initialPhase });

    // WebSocket 监听
    const wsUrl = `wss://riot:${creds.password}@127.0.0.1:${creds.port}`;
    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });

    ws.on('open', () => {
        console.log('✅ [Lite] LCU WebSocket 连接成功');
        ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
        ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-gameflow_v1_gameflow-phase']));
    });

    ws.on('message', async (data) => {
        try {
            const json = JSON.parse(data);
            if (!json || !json[2]) return;

            // BP 变化
            if (json[2].uri === '/lol-champ-select/v1/session') {
                if (json[2].eventType === 'Delete') { 
                    callback({ myTeam: [], enemyTeam: [] }); 
                    return; 
                }
                await processSession(json[2].data, creds, callback);
            }
            
            // 阶段变化
            if (json[2].uri === '/lol-gameflow/v1/gameflow-phase') {
                callback({ gamePhase: json[2].data });
            }
        } catch (e) {}
    });
}

module.exports = { connectToLCU, getProfileData };