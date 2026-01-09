// test_lcu_runner.js
// 这是一个独立的测试运行器，它会 Mock 所有依赖并暴力测试 lcu.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const WebSocket = require('ws');

// === 1. MOCK 模块 ===
// 我们不使用 require 劫持，而是通过创建一个模拟环境来运行 lcu.js 的逻辑

const MOCK_PORT = 12345;
const MOCK_PASSWORD = 'test-password';
const MOCK_AUTH = 'Basic ' + Buffer.from(`riot:${MOCK_PASSWORD}`).toString('base64');

// 模拟 find-process
const mockFindProcess = async (name) => {
    return [{
        cmd: `"LeagueClientUx.exe" --app-port=${MOCK_PORT} --remoting-auth-token=${MOCK_PASSWORD}`
    }];
};

// 模拟 Axios (指向我们的 Mock Server)
const mockAxios = {
    get: async (url, config) => {
        // 随机抛出网络错误
        if (Math.random() < 0.05) throw new Error("Network Error");
        
        if (url.includes('/lol-gameflow/v1/session')) {
            return { data: { gameData: { teamOne: [{summonerId:1}], teamTwo: [] } } };
        }
        return { data: { myTeam: [], theirTeam: [] } };
    }
};

// 模拟 HTTPS Agent
const mockHttps = { Agent: function() {} };

// === 2. 动态加载 lcu.js 并注入 Mocks ===
// 我们读取文件内容，用 Function 构造器注入 mock 对象
const lcuCode = fs.readFileSync(path.join(__dirname, 'lcu.js'), 'utf8');

// 构造一个沙箱环境
const sandboxFactory = new Function(
    'require', 'module', 'exports',
    `
    // 拦截 require
    const originalRequire = require;
    const interceptedRequire = (name) => {
        if (name === 'find-process') return ${mockFindProcess.toString()};
        if (name === 'axios') return mockAxios;
        if (name === 'https') return mockHttps;
        return originalRequire(name);
    };
    // 还需要把 axios 注入到全局闭包里，因为源码里有 const axios = require...
    // 这里我们简单粗暴地替换源码字符串来注入 mock
    // 但更简单的是：直接在运行上下文提供 mock
    
    ${lcuCode.replace("require('find-process')", "mockFindProcess")
             .replace("require('axios')", "mockAxios")
             .replace("require('https')", "mockHttps")}
    `
);

// 准备 Mock 变量
const mockModule = { exports: {} };
const mockFindProcessRef = mockFindProcess; // 传递引用
const mockAxiosRef = mockAxios;
const mockHttpsRef = mockHttps;

console.log("🔥 正在加载 lcu.js 并注入 Mock 环境...");

// 执行 lcu.js 代码 (注入 mock)
// 注意：上面的 replace 可能不够，因为 require 是在顶部。
// 我们使用 vm 模块或者直接 eval 稍微改写过的代码更稳妥。
// 这里为了简单，我们用 eval + 变量覆盖。

// 修正：直接重写 lcu.js 的 require 部分太麻烦，
// 我们启动一个真实的 Mock Server，让 lcu.js 真正连上去，
// 然后我们只 Mock `find-process` 这一步即可。

// === 重新策略：真实 Mock Server 测试 ===

async function startMockServer() {
    console.log(`🚀 启动 Mock LCU Server on port ${MOCK_PORT}...`);
    
    const wss = new WebSocket.Server({ port: MOCK_PORT });
    
    wss.on('connection', (ws) => {
        ws.on('message', (msg) => {
            // console.log('收到订阅:', msg.toString());
        });
        
        // 💣 暴力测试开始
        let counter = 0;
        const interval = setInterval(() => {
            counter++;
            const phase = Math.random() > 0.5 ? 'ChampSelect' : 'InProgress';
            
            // 1. 发送游戏流程事件
            ws.send(JSON.stringify([5, 'OnJsonApiEvent', {
                uri: '/lol-gameflow/v1/gameflow-phase',
                data: phase
            }]));

            // 2. 发送选人事件 (包含大量垃圾数据)
            ws.send(JSON.stringify([5, 'OnJsonApiEvent', {
                uri: '/lol-champ-select/v1/session',
                data: {
                    localPlayerCellId: 0,
                    myTeam: Array(5).fill(0).map((_,i) => ({ cellId: i, championId: Math.floor(Math.random()*100) })),
                    theirTeam: Array(5).fill(0).map((_,i) => ({ cellId: 5+i, championId: Math.floor(Math.random()*100) }))
                }
            }]));

            // 3. 随机发送格式错误的数据
            if (Math.random() < 0.1) ws.send("IAMNOTJSON");
            if (Math.random() < 0.1) ws.send(JSON.stringify({ bad: "structure" }));

            // 4. 模拟断开
            if (counter % 500 === 0) {
                ws.close();
                clearInterval(interval);
            }
        }, 10); // 每 10ms 发送一次 = 100 FPS 的轰炸
    });

    return wss;
}

// 劫持 require ('find-process')
// 这是一个简易的 loader hack
const originalLoader = require('module')._load;
require('module')._load = function(request, parent, isMain) {
    if (request === 'find-process') {
        return async () => [{ cmd: `--app-port="${MOCK_PORT}" --remoting-auth-token="${MOCK_PASSWORD}"` }];
    }
    return originalLoader(request, parent, isMain);
};

// 启动测试
(async () => {
    await startMockServer();
    const { connectToLCU } = require('./lcu.js'); // 加载刚才保存的 lcu.js

    console.log("🧪 开始暴力测试 lcu.js...");
    let callbackCount = 0;

    connectToLCU((data) => {
        callbackCount++;
        if (callbackCount % 100 === 0) {
            process.stdout.write(`\r✅ 已稳定处理 ${callbackCount} 次回调... 内存状态: ${JSON.stringify(process.memoryUsage().heapUsed/1024/1024|0)}MB`);
        }
    });

    // 运行 10 秒
    setTimeout(() => {
        console.log("\n\n🎉 测试完成！没有崩溃。");
        process.exit(0);
    }, 10000);
})();