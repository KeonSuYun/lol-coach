// lcu.js - 主动探测版
let find = require('find-process');
const WebSocket = require('ws');
const https = require('https');
const axios = require('axios');

// 兼容性修复
if (typeof find !== 'function' && find.default) {
    find = find.default;
}

// 忽略 SSL 证书错误
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
    } catch (e) {
        return null;
    }
}

// 🆕 新增：主动获取当前 Session 数据
async function fetchSession(creds) {
    try {
        const res = await axios.get(`${creds.url}/lol-champ-select/v1/session`, {
            httpsAgent: agent,
            headers: {
                'Authorization': creds.auth,
                'Accept': 'application/json'
            }
        });
        return res.data;
    } catch (e) {
        // 如果报错 404，说明当前不在选人阶段，这是正常的
        return null;
    }
}

// 通用数据处理逻辑
function processSession(session, callback) {
    if (!session || !session.myTeam) return;

    // ✨ 修改这里：增加 assignedPosition 字段
    const parseTeam = (teamArr) => teamArr.map(p => ({
        cellId: p.cellId,
        championId: p.championId || 0,
        summonerId: p.summonerId,
        // 👇 新增这一行，提取分路 (LCU返回的是英文，如 'middle', 'utility')
        assignedPosition: p.assignedPosition || "" 
    }));

    const matchData = {
        myTeam: parseTeam(session.myTeam),
        enemyTeam: parseTeam(session.theirTeam)
    };

    callback(matchData);
}

async function connectToLCU(callback) {
    console.log('🔍 [侦察兵] 正在寻找英雄联盟进程...');
    
    // 1. 获取凭证
    const creds = await getCredentials();
    if (!creds) {
        console.log('⚠️ 未找到游戏进程，请确保以【管理员身份】运行。');
        return;
    }

    // 2. ⚡️【关键修复】连接建立后，立刻主动拉取一次数据！
    // 这样就算你中途打开软件，也能立刻看到阵容
    const initialData = await fetchSession(creds);
    if (initialData) {
        console.log('⚡️ [初始化] 成功拉取到当前 BP 数据');
        processSession(initialData, callback);
    } else {
        console.log('💤 [初始化] 当前似乎不在选人阶段');
    }

    // 3. 建立 WebSocket 监听后续变化
    const wsUrl = `wss://riot:${creds.password}@127.0.0.1:${creds.port}`;
    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false });

    ws.on('open', () => {
        console.log('🔗 [连接] LCU WebSocket 已就绪，开始监听...');
        // 订阅选人事件
        ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
    });

    ws.on('message', (data) => {
        try {
            const json = JSON.parse(data);
            // 监听事件推送
            if (json[2] && json[2].uri === '/lol-champ-select/v1/session') {
                const eventType = json[2].eventType;
                
                if (eventType === 'Delete') {
                    console.log('🛑 [BP结束] 对局取消或结束');
                    // 可以传一个空数据重置界面
                    callback({ myTeam: [], enemyTeam: [] });
                    return;
                }

                // 处理 Create 或 Update 事件
                processSession(json[2].data, callback);
            }
        } catch (e) {}
    });

    ws.on('error', (err) => {
        console.error('❌ WebSocket 错误:', err.message);
    });
}

// 导出
module.exports = { connectToLCU };