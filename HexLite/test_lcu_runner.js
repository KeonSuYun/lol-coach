// test_lcu_runner.js
// 🏆 最终修复版：解决了沙箱作用域变量缺失的问题

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// === 配置常量 ===
const MOCK_PORT = 12345;
const MOCK_PASSWORD = 'test-password';

// 模拟 Axios (API 请求)
const mockAxios = {
    get: async (url, config) => {
        // 随机模拟 5% 的网络波动错误
        if (Math.random() < 0.05) throw new Error("Simulated Network Error");
        
        // 模拟 Gameflow 接口返回
        if (url.includes('/lol-gameflow/v1/session')) {
            return { data: { gameData: { teamOne: [{summonerId:1}], teamTwo: [] } } };
        }
        // 模拟选人接口返回
        return { data: { myTeam: [], theirTeam: [] } };
    }
};

// 模拟 HTTPS Agent
const mockHttps = { Agent: function() {} };

// === 动态加载 lcu.js 并注入 Mocks ===
const lcuCode = fs.readFileSync(path.join(__dirname, 'lcu.js'), 'utf8');

const sandboxFactory = new Function(
    'require', 'module', 'exports', 'mockAxios', 'mockHttps',
    `
    // 🔥 关键修复：在沙箱内定义常量，否则 mockFindProcess 找不到变量
    const MOCK_PORT = 12345;
    const MOCK_PASSWORD = 'test-password';

    // 定义 Mock 函数 (它现在能访问上面的常量了)
    const mockFindProcess = async (name) => {
        return [{
            cmd: \`"LeagueClientUx.exe" --app-port=\${MOCK_PORT} --remoting-auth-token=\${MOCK_PASSWORD}\`
        }];
    };

    // 拦截 require
    const originalRequire = require;
    const interceptedRequire = (name) => {
        if (name === 'find-process') return mockFindProcess;
        if (name === 'axios') return mockAxios;
        if (name === 'https') return mockHttps;
        return originalRequire(name);
    };

    // --- 注入替换 ---
    // 1. 替换 require 为我们的拦截器 (注意这里不能直接替换 require 关键字，而是替换调用)
    // 2. 强制 WS/HTTP 协议降级
    
    ${lcuCode
        .replace(/require\('find-process'\)/g, "mockFindProcess") // 直接替换为函数引用
        .replace(/require\('axios'\)/g, "mockAxios")
        .replace(/require\('https'\)/g, "mockHttps")
        .replace(/wss:\/\//g, "ws://")
        .replace(/https:\/\//g, "http://")
    }
    `
);

// 准备模块容器
const mockModule = { exports: {} };

console.log("🔥 正在加载 lcu.js 并注入 Mock 环境...");

// 执行代码
try {
    sandboxFactory(require, mockModule, mockModule.exports, mockAxios, mockHttps);
} catch (e) {
    console.error("❌ 沙箱注入失败:", e);
    process.exit(1);
}

// 获取导出函数
const { connectToLCU } = mockModule.exports;

// === 启动真实 Mock Server ===
async function startMockServer() {
    console.log(`🚀 启动 Mock LCU Server on port ${MOCK_PORT}...`);
    
    const wss = new WebSocket.Server({ port: MOCK_PORT });
    
    wss.on('connection', (ws) => {
        // console.log("🔌 LCU Client Connected!");
        
        let counter = 0;
        const interval = setInterval(() => {
            counter++;
            const phase = Math.random() > 0.5 ? 'ChampSelect' : 'InProgress';
            
            if (ws.readyState === WebSocket.OPEN) {
                // 1. 模拟游戏阶段
                ws.send(JSON.stringify([5, 'OnJsonApiEvent', {
                    uri: '/lol-gameflow/v1/gameflow-phase',
                    data: phase
                }]));

                // 2. 模拟选人数据
                ws.send(JSON.stringify([5, 'OnJsonApiEvent', {
                    uri: '/lol-champ-select/v1/session',
                    data: {
                        localPlayerCellId: 0,
                        myTeam: Array(5).fill(0).map((_,i) => ({ cellId: i, championId: Math.floor(Math.random()*150)+1 })),
                        theirTeam: Array(5).fill(0).map((_,i) => ({ cellId: 5+i, championId: Math.floor(Math.random()*150)+1 }))
                    }
                }]));
            }

            if (counter % 500 === 0) {
                ws.close();
                clearInterval(interval);
            }
        }, 10); // 10ms 极速轰炸
    });

    return wss;
}

// === 运行测试 ===
(async () => {
    await startMockServer();

    console.log("🧪 开始暴力测试 lcu.js...");
    let callbackCount = 0;

    connectToLCU((data) => {
        callbackCount++;
        if (callbackCount % 100 === 0) {
            process.stdout.write(`\r✅ 已稳定处理 ${callbackCount} 次回调... 内存: ${(process.memoryUsage().heapUsed/1024/1024).toFixed(1)}MB`);
        }
    }, (err) => {
        console.log("\n⚠️ 收到警告:", err);
    });

    setTimeout(() => {
        console.log(`\n\n🎉 测试完成！`);
        console.log(`📊 统计: 处理消息 ${callbackCount} 条`);
        if (callbackCount > 0) {
            console.log(`🛡️ 状态: 测试通过 (Success)`);
        } else {
            console.log(`❌ 状态: 测试失败 (未收到消息)`);
        }
        process.exit(0);
    }, 10000);
})();