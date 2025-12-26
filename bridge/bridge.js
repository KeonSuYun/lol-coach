const WebSocket = require('ws');
const { exec } = require('child_process');

// ================= 配置区域 =================
const WSS_PORT = 29150;
const wss = new WebSocket.Server({ port: WSS_PORT });

let frontendWs = null;
let lcuWs = null;
let isLcuConnected = false;
let lastGameData = null; // 🟢 缓存：保留你的成功逻辑

// 忽略 SSL 证书错误 (连接 LCU 必需)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

console.log("==============================================");
console.log(`🔌 HexCoach [最终稳定版] 助手已启动`);
console.log(`📡 监听端口: ${WSS_PORT}`);
console.log(`🛡️  正在检查管理员权限...`);
console.log("==============================================");

// 1. 管理员权限自检 (仅提示，不强制重启，防止由于提权导致的参数丢失)
function checkAdmin() {
    exec('net session', function(err, stdout, stderr) {
        if (err || (stderr && stderr.length > 0)) {
            console.log("\x1b[31m%s\x1b[0m", "❌ 提示：未检测到管理员权限。");
            console.log("\x1b[33m%s\x1b[0m", "   如果无法读取选人数据，请尝试以【管理员身份】重新运行程序。");
        } else {
            console.log("\x1b[32m%s\x1b[0m", "✅ 管理员权限确认。");
        }
        console.log("⏳ 正在扫描 LeagueClientUx.exe 进程...");
        console.log("==============================================");
    });
}
checkAdmin();

// 2. 处理网页连接 (完全保留你的成功逻辑)
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

// 3. 查找 LCU 进程 (采用你验证成功的 PowerShell 命令)
function findLCUAndConnect() {
    if (isLcuConnected) return;

    // 🟢 这里的命令是你成功的关键
    const psCommand = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'LeagueClientUx.exe'\\" | Select-Object -ExpandProperty CommandLine"`;

    exec(psCommand, (err, stdout, stderr) => {
        if (err || !stdout || stdout.trim() === "") return;
        
        const portMatch = stdout.match(/--app-port=([0-9]+)/);
        const passMatch = stdout.match(/--remoting-auth-token=([\w-]+)/);

        if (portMatch && passMatch) {
            connectToLCU(portMatch[1], passMatch[1]);
        }
    });
}

// 4. 连接到 LOL 客户端
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
        
        // 订阅 BP 事件
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
                console.log("⚡ 收到选人数据变动 (已更新缓存)");
                if (frontendWs) {
                    frontendWs.send(JSON.stringify({ type: 'CHAMP_SELECT', data: eventData }));
                }
            }
        } catch (e) { }
    });

    lcuWs.on('close', () => {
        console.log("❌ 客户端连接断开，重新扫描...");
        isLcuConnected = false;
        lastGameData = null; 
        lcuWs = null;
    });

    lcuWs.on('error', () => { isLcuConnected = false; });
}

// 启动循环扫描
setInterval(findLCUAndConnect, 8000);