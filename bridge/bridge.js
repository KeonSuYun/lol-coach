const WebSocket = require('ws');
const { exec } = require('child_process');
const https = require('https');

// ================= 配置区域 =================
const WSS_PORT = 29150;
const wss = new WebSocket.Server({ port: WSS_PORT });

let frontendWs = null;
let lcuWs = null;
let isLcuConnected = false;

// 解决自签名证书报错
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

console.log("==============================================");
console.log(`🔌 DeepCoach [PowerShell版] 助手已启动`);
console.log(`📡 监听端口: ${WSS_PORT}`);
console.log("⏳ 正在扫描 LeagueClientUx.exe 进程...");
console.log("==============================================");

// 1. 处理网页连接
wss.on('connection', (ws) => {
    frontendWs = ws;
    console.log("🔗 网页端已连接");
    if (isLcuConnected) {
        ws.send(JSON.stringify({ type: 'STATUS', data: 'connected' }));
    }
});

// 2. 核心逻辑：使用 PowerShell 查找 LCU
function findLCUAndConnect() {
    if (isLcuConnected) return;

    // ⚡️ 核心修改：改用 PowerShell 命令，更稳定
    const psCommand = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'LeagueClientUx.exe'\\" | Select-Object -ExpandProperty CommandLine"`;

    exec(psCommand, (err, stdout, stderr) => {
        if (err || !stdout || stdout.trim() === "") {
            // 没找到进程，静默等待下一次扫描
            return;
        }

        // 正则提取端口和密码
        const portMatch = stdout.match(/--app-port=([0-9]+)/);
        const passMatch = stdout.match(/--remoting-auth-token=([\w-]+)/);

        if (portMatch && passMatch) {
            const port = portMatch[1];
            const password = passMatch[1];
            connectToLCU(port, password);
        }
    });
}

// 3. 连接到 LOL 客户端
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
                console.log("⚡ 收到选人数据变动");
                if (frontendWs) {
                    frontendWs.send(JSON.stringify({ type: 'CHAMP_SELECT', data: eventData }));
                }
            }
        } catch (e) { }
    });

    lcuWs.on('close', () => {
        console.log("❌ 客户端连接断开，重新扫描...");
        isLcuConnected = false;
        lcuWs = null;
    });

    lcuWs.on('error', (err) => {
        isLcuConnected = false;
    });
}

// 4. 每 2 秒扫描一次
setInterval(findLCUAndConnect, 2000);