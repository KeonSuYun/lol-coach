// lcu.js - 负责与游戏通讯的模块
const find = require('find-process');
const WebSocket = require('ws');
const https = require('https');

// 忽略 SSL 证书报错
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function connectToLCU(onChampSelect) {
    console.log('🔍 正在扫描英雄联盟进程...');

    try {
        // 1. 使用 find-process 直接查找进程参数 (替代读取 lockfile)
        const list = await find('name', 'LeagueClientUx.exe', true);

        if (list.length === 0) {
            console.log('⚠️ 未找到游戏，请先启动英雄联盟。');
            return false;
        }

        // 2. 提取端口和密码
        const cmd = list[0].cmd;
        const portMatch = cmd.match(/--app-port=([0-9]+)/);
        const passwordMatch = cmd.match(/--remoting-auth-token=([\w-]+)/);

        if (!portMatch || !passwordMatch) return false;

        const port = portMatch[1];
        const password = passwordMatch[1];
        const wsUrl = `wss://riot:${password}@127.0.0.1:${port}`;

        // 3. 建立 WebSocket 连接
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('✅ 已连接到游戏内部通讯 (LCU WebSocket)');
            // 订阅：只监听“选人阶段”的数据流
            ws.send(JSON.stringify([5, 'OnJsonApiEvent_lol-champ-select_v1_session']));
        });

        ws.on('message', (data) => {
            if (!data) return;
            try {
                const event = JSON.parse(data);
                // 过滤：只关心 "Update" 更新事件
                if (event[2] && event[2].eventType === 'Update') {
                    const session = event[2].data;
                    
                    // 提取核心数据：我是谁？我选了哪个英雄？
                    const localCellId = session.localPlayerCellId;
                    const me = session.myTeam.find(p => p.cellId === localCellId);
                    
                    if (me && me.championId !== 0) {
                        // 触发回调函数，把英雄ID传出去
                        onChampSelect(me.championId);
                    }
                }
            } catch (e) {
                // 忽略非JSON格式的心跳包
            }
        });

        return true;

    } catch (err) {
        console.error('连接错误:', err);
        return false;
    }
}

module.exports = { connectToLCU };