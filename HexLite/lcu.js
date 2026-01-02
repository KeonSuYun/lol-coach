// HexLite/lcu.js
const find = require('find-process');
const WebSocket = require('ws');
const https = require('https');
const axios = require('axios');

const agent = new https.Agent({ rejectUnauthorized: false });

// 缓存英雄详情，避免重复请求 LCU
const championDetailsCache = {};

// 🔥 队列 ID 映射表 (用于筛选和汉化)
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

        if (!cmd) {
            return { status: 'permission-denied' };
        }

        const portMatch = cmd.match(/--app-port=["']?(\d+)["']?/);
        const passwordMatch = cmd.match(/--remoting-auth-token=["']?([\w-]+)["']?/);

        if (!portMatch || !passwordMatch) {
            return { status: 'no-credentials' };
        }

        return {
            status: 'success',
            port: portMatch[1],
            password: passwordMatch[1],
            url: `https://127.0.0.1:${portMatch[1]}`,
            auth: 'Basic ' + Buffer.from(`riot:${passwordMatch[1]}`).toString('base64')
        };
    } catch (e) { 
        console.log('LCU Process Check Error');
        return { status: 'error' }; 
    }
}

async function fetchChampionDetail(creds, championId) {
    if (!championId || championId === 0) return null;
    if (championDetailsCache[championId]) return championDetailsCache[championId];

    try {
        const res = await axios.get(`${creds.url}/lol-game-data/assets/v1/champions/${championId}.json`, {
            httpsAgent: agent,
            headers: { 'Authorization': creds.auth, 'Accept': 'application/json' }
        });
        
        const data = res.data;
        if (!data) return null;

        const spellsInfo = data.spells.map(s => {
            const cleanDesc = s.description.replace(/<[^>]+>/g, '').substring(0, 300);
            return `【${s.spellKey.toUpperCase()} - ${s.name}】CD:${s.cooldownBurn}s | ${cleanDesc}`;
        });

        const cleanPassive = data.passive.description.replace(/<[^>]+>/g, '').substring(0, 300);
        const passiveInfo = `【被动 - ${data.passive.name}】${cleanPassive}`;

        const rawText = `${passiveInfo}\n${spellsInfo.join('\n')}`;
        
        championDetailsCache[championId] = {
            name: data.name,
            alias: data.alias,
            fullMechanics: rawText 
        };
        return championDetailsCache[championId];
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

async function processSession(session, creds, callback) {
    if (!session || !session.myTeam) return;

    const parseTeam = (teamArr) => teamArr.map(p => ({
        cellId: p.cellId,
        championId: p.championId || 0,
        summonerId: p.summonerId,
        assignedPosition: p.assignedPosition || "" 
    }));

    const myTeam = parseTeam(session.myTeam);
    const enemyTeam = parseTeam(session.theirTeam);

    const allChampionIds = [...myTeam, ...enemyTeam]
        .map(p => p.championId)
        .filter(id => id > 0);

    const extraMechanics = {};
    
    await Promise.all(allChampionIds.map(async (id) => {
        const detail = await fetchChampionDetail(creds, id);
        if (detail) {
            extraMechanics[detail.alias] = detail.fullMechanics;
            extraMechanics[detail.name] = detail.fullMechanics; 
        }
    }));

    let mapSide = 'unknown';
    if (myTeam && myTeam.length > 0) {
        const firstMemberCellId = myTeam[0].cellId;
        mapSide = firstMemberCellId < 5 ? 'blue' : 'red';
    }
    console.log(`🗺️ [LCU] 地图方位分析结果: ${mapSide} (基准ID: ${myTeam[0]?.cellId})`);
    
    callback({ 
        myTeam, 
        enemyTeam, 
        extraMechanics, 
        mapSide 
    });
}

// 🔥🔥🔥【重点修复】高容错率的个人信息获取 (含排位筛选) 🔥🔥🔥
async function getProfileData() {
    const creds = await getCredentials();
    if (creds.status !== 'success') return null;

    let summoner = {};
    let rankedStats = {};
    let masteryIds = [];
    let matchList = [];
    let calculatedKda = "0.0";

    // 1. 获取基础信息
    try {
        const res = await axios.get(`${creds.url}/lol-summoner/v1/current-summoner`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }
        });
        summoner = res.data;
    } catch (e) {
        console.log("LCU Error [Summoner]:", e.response ? e.response.status : e.message);
        return null;
    }

    // 2. 获取排位信息
    try {
        const res = await axios.get(`${creds.url}/lol-ranked/v1/current-ranked-stats`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }
        });
        
        const queues = res.data.queues || [];
        rankedStats = queues.find(q => q.queueType === "RANKED_SOLO_5x5");
        if (!rankedStats) rankedStats = queues.find(q => q.queueType === "RANKED_FLEX_SR");
        if (!rankedStats) rankedStats = queues.find(q => q.tier && q.tier !== "NONE");
        rankedStats = rankedStats || {};

    } catch (e) {
        console.log("LCU Warning [Ranked]:", e.message);
    }

    // 3. 获取熟练度
    try {
        const res = await axios.get(`${creds.url}/lol-champion-mastery/v1/local-player/champion-mastery`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }
        });
        if (Array.isArray(res.data)) {
            masteryIds = res.data
                .sort((a, b) => b.championPoints - a.championPoints)
                .slice(0, 3)
                .map(m => m.championId);
        }
    } catch (e) {
        console.log("LCU Warning [Mastery]:", e.message);
    }

    // 4. 🔥🔥🔥【修改】获取战绩 (筛选排位 + 中文化 + 30局) 🔥🔥🔥
    try {
        const matchRes = await axios.get(`${creds.url}/lol-match-history/v1/products/lol/current-summoner/matches`, {
            httpsAgent: agent, headers: { 'Authorization': creds.auth }
        });
        
        const rawGames = matchRes.data.games ? matchRes.data.games.games : [];
        
        // A. 按时间倒序
        const allGamesSorted = rawGames.sort((a, b) => b.gameCreation - a.gameCreation);

        // B. 筛选与处理
        let validGames = [];
        let totalKills = 0;
        let totalDeaths = 0;
        let totalAssists = 0;

        for (const g of allGamesSorted) {
            // 只保留排位赛 (单双排 420, 灵活 440)
            // 提示：队列ID可能会随赛季变动，但420/440相对稳定
            if (!QUEUE_ID_MAP[g.queueId]) continue;

            const p = g.participants[0];
            
            // 累计 KDA 数据用于计算平均值
            totalKills += p.stats.kills;
            totalDeaths += p.stats.deaths;
            totalAssists += p.stats.assists;

            // 时间显示优化
            const diffMs = Date.now() - g.gameCreation;
            let timeStr = "刚刚";
            if (diffMs > 86400000) timeStr = `${Math.floor(diffMs / 86400000)}天前`;
            else if (diffMs > 3600000) timeStr = `${Math.floor(diffMs / 3600000)}小时前`;
            else if (diffMs > 60000) timeStr = `${Math.floor(diffMs / 60000)}分钟前`;

            validGames.push({
                id: g.gameId,
                type: p.stats.win ? "victory" : "defeat",
                champ: p.championId,
                champName: "", // 前端处理
                kda: `${p.stats.kills}/${p.stats.deaths}/${p.stats.assists}`,
                time: timeStr,
                mode: QUEUE_ID_MAP[g.queueId] // ✅ 使用中文模式名
            });

            // 达到 30 局上限停止
            if (validGames.length >= 30) break;
        }

        matchList = validGames;

        // 计算平均 KDA (基于筛选后的排位局)
        if (matchList.length > 0) {
            const avgD = totalDeaths === 0 ? 1 : totalDeaths;
            calculatedKda = ((totalKills + totalAssists) / avgD).toFixed(1) + ":1";
        }

    } catch (e) {
        console.log("LCU Warning [Matches]:", e.message);
    }

    // 5. 组装最终数据
    return {
        gameName: summoner.gameName || summoner.displayName || "Unknown", 
        tagLine: summoner.tagLine || "",
        level: summoner.summonerLevel || 1,
        profileIconId: summoner.profileIconId || 29,
        rank: rankedStats.tier ? `${rankedStats.tier} ${rankedStats.division}` : 'UNRANKED',
        lp: rankedStats.leaguePoints || 0,
        winRate: (rankedStats.wins + rankedStats.losses) > 0 
            ? Math.round((rankedStats.wins / (rankedStats.wins + rankedStats.losses)) * 100) 
            : 0,
        matches: matchList, 
        kda: calculatedKda, 
        mastery: masteryIds
    };
}

async function connectToLCU(callback, onWarning) {
    const result = await getCredentials();
    
    if (result.status === 'not-found') return;
    
    if (result.status === 'permission-denied') {
        console.log('🚫 检测到游戏进程，但无权限读取 (需管理员启动)');
        if (onWarning) onWarning('permission-denied');
        return;
    }
    
    if (result.status !== 'success') {
        console.log('⚠️ 无法获取连接凭据:', result.status);
        return;
    }

    const creds = result; 

    const initialData = await fetchSession(creds);
    if (initialData) await processSession(initialData, creds, callback);

    const wsUrl = `wss://riot:${creds.password}@127.0.0.1:${creds.port}`;
    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });

    ws.on('open', () => {
        console.log('✅ [Lite] LCU WebSocket 连接成功');
        ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
    });

    ws.on('message', async (data) => {
        try {
            const json = JSON.parse(data);
            if (json[2] && json[2].uri === '/lol-champ-select/v1/session') {
                if (json[2].eventType === 'Delete') { callback({ myTeam: [], enemyTeam: [] }); return; }
                await processSession(json[2].data, creds, callback);
            }
        } catch (e) {}
    });
}

module.exports = { connectToLCU, getProfileData };