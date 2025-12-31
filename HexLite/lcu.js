// HexLite/lcu.js
const find = require('find-process');
const WebSocket = require('ws');
const https = require('https');
const axios = require('axios');

const agent = new https.Agent({ rejectUnauthorized: false });

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

async function fetchSession(creds) {
    try {
        const res = await axios.get(`${creds.url}/lol-champ-select/v1/session`, {
            httpsAgent: agent,
            headers: { 'Authorization': creds.auth, 'Accept': 'application/json' }
        });
        return res.data;
    } catch (e) { return null; }
}

function processSession(session, callback) {
    if (!session || !session.myTeam) return;
    const parseTeam = (teamArr) => teamArr.map(p => ({
        cellId: p.cellId,
        championId: p.championId || 0,
        summonerId: p.summonerId,
        assignedPosition: p.assignedPosition || "" 
    }));
    callback({ myTeam: parseTeam(session.myTeam), enemyTeam: parseTeam(session.theirTeam) });
}

async function connectToLCU(callback) {
    console.log('🔍 [Lite] 正在寻找游戏进程...');
    const creds = await getCredentials();
    if (!creds) {
        console.log('⚠️ 未找到游戏，请管理员运行');
        return;
    }

    const initialData = await fetchSession(creds);
    if (initialData) processSession(initialData, callback);

    const wsUrl = `wss://riot:${creds.password}@127.0.0.1:${creds.port}`;
    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });

    ws.on('open', () => {
        console.log('✅ [Lite] 连接成功');
        ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
    });

    ws.on('message', (data) => {
        try {
            const json = JSON.parse(data);
            if (json[2] && json[2].uri === '/lol-champ-select/v1/session') {
                if (json[2].eventType === 'Delete') { callback({ myTeam: [], enemyTeam: [] }); return; }
                processSession(json[2].data, callback);
            }
        } catch (e) {}
    });
}

module.exports = { connectToLCU };