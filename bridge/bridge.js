const WebSocket = require('ws');
// 🟢 修改点1：引入 spawn 用于重启进程
const { exec, spawn } = require('child_process');

// ================= 配置区域 =================
const WSS_PORT = 29150;
// 🔴 注意：wss 变量声明移动到后面，只有权限检查通过才创建

let wss = null;
let frontendWs = null;
let lcuWs = null;
let isLcuConnected = false;
let lastGameData = null; // 🟢 缓存：保留原代码逻辑

// 忽略 SSL 证书错误 (连接 LCU 必需)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

console.log("==============================================");
console.log(`🔌 DeepCoach [最终完整版] 助手已启动`);
console.log(`📡 监听端口: ${WSS_PORT}`);
console.log(`🛡️  正在检查管理员权限...`);
console.log("==============================================");

// 🟢 修改点2：改造 checkAdmin 函数，加入自动提权逻辑
function checkAdminAndStart() {
    exec('net session', function(err, stdout, stderr) {
        if (err || (stderr && stderr.length > 0)) {
            // --- 保留原代码的美化警告 ---
            console.log("\x1b[31m%s\x1b[0m", "❌ 警告：未检测到管理员权限！");
            console.log("\x1b[33m%s\x1b[0m", "   程序即将尝试以管理员身份重启...");

            // --- 新增：自动提权重启逻辑 ---
            const target = process.execPath; 
            spawn('powershell', ['Start-Process', `"${target}"`, '-Verb', 'RunAs'], {
                detached: true,
                stdio: 'ignore'
            }).unref();

            // 退出当前无权限的进程
            process.exit(0);
        } else {
            // --- 保留原代码的成功提示 ---
            console.log("\x1b[32m%s\x1b[0m", "✅ 管理员权限确认。正在启动服务并扫描客户端...");
            
            // 只有权限确认后，才执行原代码的主逻辑
            startMainApp();
        }
    });
}

// 执行入口
checkAdminAndStart();

// ============================================================
// 🟢 修改点3：将原代码的主逻辑封装在 startMainApp 中
// 这样防止没权限时 WebSocket 报错或空跑
// ============================================================
function startMainApp() {
    wss = new WebSocket.Server({ port: WSS_PORT });

    // 1. 处理网页连接 (完全保留原逻辑)
    wss.on('connection', (ws) => {
        frontendWs = ws;
        console.log("🔗 网页端已连接");
        
        if (isLcuConnected) {
            ws.send(JSON.stringify({ type: 'STATUS', data: 'connected' }));
        }
        if (lastGameData) {
            console.log("📦 发送缓存的选人数据...");
            ws.send(JSON.stringify({ type: 'CHAMP_SELECT', data: lastGameData }));
        }
    });

    // 2. 查找 LCU 进程 (完全保留原逻辑)
    function findLCUAndConnect() {
        if (isLcuConnected) return;

        const command = `wmic PROCESS WHERE name='LeagueClientUx.exe' GET commandline`;

        exec(command, (err, stdout, stderr) => {
            if (err || !stdout) return;
            
            const portMatch = stdout.match(/--app-port=([0-9]+)/);
            const passMatch = stdout.match(/--remoting-auth-token=([\w-]+)/);

            if (portMatch && passMatch) {
                connectToLCU(portMatch[1], passMatch[1]);
            }
        });
    }

    // 3. 连接到 LOL 客户端 (完全保留原逻辑)
    function connectToLCU(port, password) {
        if (isLcuConnected) return;

        const cert = Buffer.from(`riot:${password}`).toString('base64');
        const url = `wss://127.0.0.1:${port}`;

        lcuWs = new WebSocket(url, {
            headers: { 'Authorization': `Basic ${cert}` },
            rejectUnauthorized: false
        });

        lcuWs.on('open', () => {
            isLcuConnected = true;
            console.log(`✅ 成功连接到客户端! (Port: ${port})`);
            
            lcuWs.send(JSON.stringify([5, "OnJsonApiEvent", {
                uri: "/lol-champ-select/v1/session"
            }]));

            if (frontendWs) frontendWs.send(JSON.stringify({ type: 'STATUS', data: 'connected' }));
        });

        lcuWs.on('message', (data) => {
            if (!data) return;
            try {
                const msg = JSON.parse(data);
                if (msg[2] && msg[2].uri === "/lol-champ-select/v1/session") {
                    const eventData = msg[2].data;
                    lastGameData = eventData; 
                    if (frontendWs) {
                        frontendWs.send(JSON.stringify({ type: 'CHAMP_SELECT', data: eventData }));
                    }
                }
            } catch (e) { }
        });

        lcuWs.on('close', () => {
            console.log("❌ 客户端连接断开，重新扫描...");
            isLcuConnected = false;
            // 🟢 这一行是你原代码有的，新代码之前漏掉了，现在保留了
            lastGameData = null; 
            lcuWs = null;
        });

        lcuWs.on('error', () => { isLcuConnected = false; });
    }

    // 启动循环扫描
    setInterval(findLCUAndConnect, 2000);
}