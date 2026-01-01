// HexLite/lcu.js
const find = require('find-process');
const WebSocket = require('ws');
const https = require('https');
const axios = require('axios');

const agent = new https.Agent({ rejectUnauthorized: false });

// 缓存英雄详情，避免重复请求 LCU
const championDetailsCache = {};

async function getCredentials() {
    try {
        const list = await find('name', 'LeagueClientUx.exe', true);
        if (list.length === 0) return null;
        const cmd = list[0].cmd;
        if (!cmd) return null;
        const portMatch = cmd.match(/--app-port=["']?(\d+)["']?/);
        const passwordMatch = cmd.match(/--remoting-auth-token=["']?([\w-]+)["']?/);
        if (!portMatch || !passwordMatch) return null;
        return {
            port: portMatch[1],
            password: passwordMatch[1],
            url: `https://127.0.0.1:${portMatch[1]}`,
            auth: 'Basic ' + Buffer.from(`riot:${passwordMatch[1]}`).toString('base64')
        };
    } catch (e) { return null; }
}

// 🔥 新增：获取单个英雄的详细技能信息 (带CD)
async function fetchChampionDetail(creds, championId) {
    if (!championId || championId === 0) return null;
    if (championDetailsCache[championId]) return championDetailsCache[championId];

    try {
        // LCU 官方接口：获取英雄详细数据（含技能数值、CD）
        const res = await axios.get(`${creds.url}/lol-game-data/assets/v1/champions/${championId}.json`, {
            httpsAgent: agent,
            headers: { 'Authorization': creds.auth, 'Accept': 'application/json' }
        });
        
        const data = res.data;
        if (!data) return null;

        // 提取 Q W E R 的关键信息
        // spells[0]=Q, 1=W, 2=E, 3=R
        const spellsInfo = data.spells.map(s => {
            // 🟢 修改：将长度限制提升至 300，防止关键数值被截断
            // 🟢 移除所有 <tags> 保持纯文本
            const cleanDesc = s.description.replace(/<[^>]+>/g, '').substring(0, 300);
            return `【${s.spellKey.toUpperCase()} - ${s.name}】CD:${s.cooldownBurn}s | ${cleanDesc}`;
        });

        const cleanPassive = data.passive.description.replace(/<[^>]+>/g, '').substring(0, 300);
        const passiveInfo = `【被动 - ${data.passive.name}】${cleanPassive}`;

        // 组合成一段 AI 可读的文本
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

// 🔥 修改：处理 Session 时，并发抓取所有英雄的技能
async function processSession(session, creds, callback) {
    if (!session || !session.myTeam) return;

    // 1. 解析基础名单
    const parseTeam = (teamArr) => teamArr.map(p => ({
        cellId: p.cellId,
        championId: p.championId || 0,
        summonerId: p.summonerId,
        assignedPosition: p.assignedPosition || "" 
    }));

    const myTeam = parseTeam(session.myTeam);
    const enemyTeam = parseTeam(session.theirTeam);

    // 2. 🔥 提取所有英雄 ID (我方+敌方)
    const allChampionIds = [...myTeam, ...enemyTeam]
        .map(p => p.championId)
        .filter(id => id > 0);

    // 3. 🔥 并发抓取详细技能数据 (提取 extraMechanics)
    const extraMechanics = {};
    
    // 使用 Promise.all 加速抓取
    await Promise.all(allChampionIds.map(async (id) => {
        const detail = await fetchChampionDetail(creds, id);
        if (detail) {
            // Key 用英雄的英文 Alias (如 "Aatrox")，这是 AI 最熟悉的 ID
            extraMechanics[detail.alias] = detail.fullMechanics;
            // 同时也存一份中文名的引用，防止匹配失败
            extraMechanics[detail.name] = detail.fullMechanics; 
        }
    }));

    // 🔥🔥🔥【新增逻辑：判断红蓝方】🔥🔥🔥
    // 逻辑：如果我方第一个人的 cellId 是 0-4，就是蓝色方；否则是红色方
    // mapSide 只有两个值: 'blue' or 'red'
    let mapSide = 'unknown';
    if (myTeam && myTeam.length > 0) {
        const firstMemberCellId = myTeam[0].cellId;
        mapSide = firstMemberCellId < 5 ? 'blue' : 'red';
    }
    console.log(`🗺️ [LCU] 地图方位分析结果: ${mapSide} (基准ID: ${myTeam[0]?.cellId})`);
    // 4. 回调发送完整数据给前端/Electron
    callback({ 
        myTeam, 
        enemyTeam, 
        extraMechanics, // 🟢 这里把抓到的技能包传出去
        mapSide // 🟢 把算好的红蓝方传出去
    });
}

async function connectToLCU(callback) {
    console.log('🔍 [Lite] 正在寻找游戏进程...');
    const creds = await getCredentials();
    if (!creds) {
        console.log('⚠️ 未找到游戏，请管理员运行');
        return;
    }

    // 初始化获取一次
    const initialData = await fetchSession(creds);
    if (initialData) await processSession(initialData, creds, callback);

    const wsUrl = `wss://riot:${creds.password}@127.0.0.1:${creds.port}`;
    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });

    ws.on('open', () => {
        console.log('✅ [Lite] 连接成功');
        ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
    });

    ws.on('message', async (data) => {
        try {
            const json = JSON.parse(data);
            if (json[2] && json[2].uri === '/lol-champ-select/v1/session') {
                if (json[2].eventType === 'Delete') { callback({ myTeam: [], enemyTeam: [] }); return; }
                // 变成异步调用
                await processSession(json[2].data, creds, callback);
            }
        } catch (e) {}
    });
}

module.exports = { connectToLCU };