const { app, BrowserWindow, screen, dialog, globalShortcut, ipcMain, shell, Tray, Menu } = require('electron');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// ================= 🔧 配置区域 =================
// 注意：这个 URL 仅在开发模式或者找不到本地文件时作为兜底使用
const DEFAULT_FRONTEND_URL = "http://localhost:5173"; 
const WSS_PORT = 29150;
const CONFIG_FILE = path.join(app.getPath('userData'), 'bridge-config.json');

// 默认快捷键
const DEFAULT_SHORTCUTS = {
    'tab_bp': 'Alt+1', 
    'tab_personal': 'Alt+2', 
    'tab_team': 'Alt+3',
    'nav_prev': 'Alt+Left', 
    'nav_next': 'Alt+Right',
    'refresh': 'Alt+R', 
    'toggle_visible': 'Alt+H',
    'send_chat': 'Alt+S' // ✨✨✨ 新增：一键发送聊天快捷键
};

// ================= 🛑 核心修复 1: 单实例锁 (防止双开崩溃) =================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log("⚠️ 检测到另一个实例，自动退出...");
    app.quit();
    process.exit(0); // 强制终止
}

// ================= 全局变量 =================
let mainWindow = null;
let tray = null; // 🟢 托盘图标实例
let isQuitting = false; // 🟢 标记是否真的要退出

let frontendWs = null;
let lcuWs = null;
let isLcuConnected = false;
let lastGameData = null;
let cachedGameDir = null;
let currentShortcuts = { ...DEFAULT_SHORTCUTS };
let currentFrontendUrl = DEFAULT_FRONTEND_URL;
let hasAskedUser = false; 

// 忽略 SSL 错误
app.commandLine.appendSwitch('ignore-certificate-errors');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// 设置 App ID (防止通知栏归类错误)
app.setAppUserModelId("com.hexcoach.client");

// ================= 1. 配置管理 (含窗口位置记忆) =================

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (data.path && fs.existsSync(data.path)) cachedGameDir = data.path;
            if (data.shortcuts) currentShortcuts = { ...DEFAULT_SHORTCUTS, ...data.shortcuts };
            // 注意：我们移除了从配置读取 frontendUrl 的强逻辑，优先使用本地文件
            return data;
        }
    } catch (e) {}
    return {};
}

function saveConfig(newData) {
    try {
        let existing = {};
        if (fs.existsSync(CONFIG_FILE)) existing = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const merged = { ...existing, ...newData };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
    } catch (e) {}
}

// ================= 2. 窗口与托盘逻辑 =================

function createTray() {
    // 🟢 修复路径：
    const iconPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'icon.ico') // 生产环境：不变 (从 extraResources 读取)
        : path.join(__dirname, 'icon.ico');            // 开发环境：直接读取旁边的 icon.ico (不需要 ../ 了)

    try {
        if (fs.existsSync(iconPath)) {
            tray = new Tray(iconPath);
            
            const contextMenu = Menu.buildFromTemplate([
                { label: '显示悬浮窗', click: () => mainWindow.show() },
                { label: '重启助手', click: () => { app.relaunch(); app.exit(); } },
                { type: 'separator' },
                { label: '退出', click: () => {
                    isQuitting = true; // 🚨 标记为真退出
                    app.quit();
                }}
            ]);
            
            tray.setToolTip('HexCoach 助手');
            tray.setContextMenu(contextMenu);
            
            // 双击托盘显示窗口
            tray.on('double-click', () => mainWindow.show());
        } else {
            console.warn("⚠️ 未找到托盘图标:", iconPath);
        }
    } catch (e) {
        console.error("⚠️ 创建托盘失败:", e);
    }
}

function createOverlayWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    const config = loadConfig();

    // 🟢 核心修复 2: 恢复上次的窗口位置
    let startX = width - 450;
    let startY = 100;
    if (config.windowX !== undefined && config.windowY !== undefined) {
        startX = config.windowX;
        startY = config.windowY;
    }

    mainWindow = new BrowserWindow({
        width: 420, height: 800,
        x: startX, y: startY,
        frame: false, transparent: true, alwaysOnTop: true,
        resizable: true, hasShadow: false, skipTaskbar: true, 
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    if (app.isPackaged) {
        // 🟢 生产环境：直接读取旁边的 dist
        mainWindow.loadFile(path.join(__dirname, 'dist/index.html'), {
            hash: 'overlay=true'
        });
        console.log("🚀 [生产模式] 加载本地打包资源");
    } else {
        // 🟢 开发模式：
        // 依然连接本地 React 开发服务器
        mainWindow.loadURL("http://localhost:5173?overlay=true");
        console.log("🚀 [开发模式] 加载本地服务器");
    }

    // 限制外链跳转
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // 允许 file 协议 (本地文件)
        if (url.startsWith('file:')) return { action: 'allow' };
        // 允许开发服务器
        if (url.startsWith('http://localhost')) return { action: 'allow' };
        
        // 其他链接调用外部浏览器打开
        shell.openExternal(url);
        return { action: 'deny' };
    });

    registerGlobalShortcuts(mainWindow);

    // 🟢 核心修复 3: 拦截关闭事件 -> 最小化到托盘
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault(); // 阻止真正的关闭
            mainWindow.hide(); // 只是隐藏
        } else {
            // 保存最后的位置
            try {
                const bounds = mainWindow.getBounds();
                saveConfig({ windowX: bounds.x, windowY: bounds.y });
            } catch(e) {}
        }
    });

    // 监听移动结束，保存位置 (防抖保存)
    let moveTimeout;
    mainWindow.on('move', () => {
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
            if(!mainWindow.isDestroyed()) {
                const bounds = mainWindow.getBounds();
                saveConfig({ windowX: bounds.x, windowY: bounds.y });
            }
        }, 1000);
    });
}

function registerGlobalShortcuts(win) {
    globalShortcut.unregisterAll();
    Object.keys(currentShortcuts).forEach(action => {
        const key = currentShortcuts[action];
        if (!key) return;
        try {
            globalShortcut.register(key, () => {
                if (action === 'toggle_visible') {
                    if (win && !win.isDestroyed()) {
                        win.isVisible() ? win.hide() : win.show();
                    }
                    return;
                }
                if (win && !win.isDestroyed()) {
                    if (!win.isVisible()) win.show();
                    if (win.isMinimized()) win.restore();
                    win.webContents.send('shortcut-triggered', action);
                }
            });
        } catch (e) {
            console.error(`注册快捷键失败 ${key}:`, e);
        }
    });
}

// ================= 3. App 生命周期 =================

app.whenReady().then(() => {
    // 只有拿到锁的实例才会执行到这里
    loadConfig();
    startWebSocketServer();
    createOverlayWindow();
    createTray(); // 创建托盘
    
    // 定时器检查连接
    setInterval(findLCUAndConnect, 3000);
    findLCUAndConnect();

    ipcMain.on('update-shortcuts', (event, newShortcuts) => {
        currentShortcuts = newShortcuts;
        saveConfig({ shortcuts: newShortcuts });
        if (mainWindow) registerGlobalShortcuts(mainWindow);
    });
    
    ipcMain.handle('get-shortcuts', () => currentShortcuts);

    // ✨✨✨ 新增：监听前端发来的“发送聊天”请求 ✨✨✨
    ipcMain.on('perform-send-chat', (event, text) => {
        if (!isLcuConnected || !lcuWs) {
            console.log("LCU 未连接，无法发送聊天");
            return;
        }
        
        console.log("准备发送聊天:", text);
        
        // 1. 获取所有对话，找到 champSelect 类型的对话 ID
        // LCU JSON-RPC 格式: [2, "请求ID", "方法", "URI", Body]
        const reqId = "GetChat_" + Date.now();
        lcuWs.send(JSON.stringify([2, reqId, "GET", "/lol-chat/v1/conversations", null]));

        // 我们需要临时监听一次消息来获取 ID
        const chatHandler = (data) => {
            try {
                const msg = JSON.parse(data);
                // 匹配我们刚才发的请求 ID: [3, "ReqId", Result]
                if (msg[0] === 3 && msg[1] === reqId) { 
                    const conversations = msg[2]; // 结果列表
                    const champSelectChat = conversations.find(c => c.type === "championSelect");
                    
                    if (champSelectChat) {
                        const chatId = champSelectChat.id;
                        // 2. 发送消息到该聊天室
                        const postReqId = "PostMsg_" + Date.now();
                        lcuWs.send(JSON.stringify([
                            2, 
                            postReqId, 
                            "POST", 
                            `/lol-chat/v1/conversations/${chatId}/messages`, 
                            { "body": text, "type": "chat" }
                        ]));
                        console.log("✅ 消息已发送到选人房间:", chatId);
                    } else {
                        console.log("⚠️ 未找到选人房间，可能不在选人阶段");
                    }
                    
                    // 用完就移除监听，防止内存泄漏
                    lcuWs.removeListener('message', chatHandler);
                }
            } catch (e) {
                // 忽略解析错误
            }
        };

        lcuWs.on('message', chatHandler);
    });
});

// 第二个实例试图启动时触发
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
    }
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });

// ================= 4. WebSocket 服务 =================
function startWebSocketServer() {
    const wss = new WebSocket.Server({ port: WSS_PORT });
    wss.on('connection', (ws) => {
        frontendWs = ws;
        if (isLcuConnected) ws.send(JSON.stringify({ type: 'STATUS', data: 'connected' }));
        if (lastGameData) ws.send(JSON.stringify({ type: 'CHAMP_SELECT', data: lastGameData }));
    });
    wss.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error("端口被占用，但这不应该发生（单实例锁已生效）。");
        }
    });
}

// ================= 5. LCU 连接逻辑 (最终稳定版) =================
function getGameDirectory() {
    if (cachedGameDir && fs.existsSync(path.join(cachedGameDir, 'lockfile'))) return cachedGameDir;

    const defPaths = [
        'C:\\WeGameApps\\英雄联盟\\LeagueClient',
        'D:\\WeGameApps\\英雄联盟\\LeagueClient',
        'F:\\WeGameApps\\英雄联盟\\LeagueClient',
        'G:\\WeGameApps\\英雄联盟\\LeagueClient',
        'C:\\Riot Games\\League of Legends',
        'D:\\Riot Games\\League of Legends',
        'F:\\Riot Games\\League of Legends'
    ];

    for (const p of defPaths) {
        const lockPath = path.join(p, 'lockfile');
        if (fs.existsSync(lockPath)) {
            // 新鲜度检查 (12小时内)
            try {
                if (new Date().getTime() - fs.statSync(lockPath).mtime.getTime() > 12 * 3600 * 1000) continue;
            } catch(e) { continue; }
            // 内容检查
            try {
                if (fs.readFileSync(lockPath, 'utf8').split(':')[0] !== 'LeagueClient') continue;
            } catch (e) { continue; }

            cachedGameDir = p;
            return p;
        }
    }
    
    // 只在主窗口存在且未询问过时弹窗
    if (mainWindow && !mainWindow.isDestroyed() && !cachedGameDir && !hasAskedUser) {
        hasAskedUser = true;
        // 延迟一点弹出，确保窗口已加载
        setTimeout(() => {
            const result = dialog.showOpenDialogSync(mainWindow, { 
                title: '请选择 LeagueClient 所在文件夹 (含lockfile)', 
                properties: ['openDirectory'] 
            });
            if (result && result.length > 0) {
                cachedGameDir = result[0];
                saveConfig({ path: result[0] });
            } else {
                // 用户取消，允许下次再问（或者你可以设为 true 就不再问了）
                hasAskedUser = false; 
            }
        }, 1000);
    }
    return cachedGameDir; // 返回缓存，可能为null
}

function findLCUAndConnect() {
    // 增加readyState检查，防止重复连接中
    if (isLcuConnected || (lcuWs && lcuWs.readyState === WebSocket.CONNECTING)) return;
    
    const dir = getGameDirectory();
    if (!dir) return;

    const lockfile = path.join(dir, 'lockfile');
    if (!fs.existsSync(lockfile)) return;

    try {
        const content = fs.readFileSync(lockfile, 'utf8');
        const parts = content.split(':');
        if (parts.length >= 5 && parts[0] === 'LeagueClient') {
            connectToLCU(parts[2], parts[3]);
        }
    } catch (e) {}
}

function connectToLCU(port, password) {
    // 双重检查
    if (isLcuConnected) return;

    const cert = Buffer.from(`riot:${password}`).toString('base64');
    // 使用 rejectUnauthorized: false 允许自签名证书
    lcuWs = new WebSocket(`wss://127.0.0.1:${port}`, { 
        headers: { 'Authorization': `Basic ${cert}` }, 
        rejectUnauthorized: false 
    });

    lcuWs.on('open', () => {
        isLcuConnected = true;
        // 订阅选人事件
        lcuWs.send(JSON.stringify([5, "OnJsonApiEvent", { uri: "/lol-champ-select/v1/session" }]));
        if (frontendWs) frontendWs.send(JSON.stringify({ type: 'STATUS', data: 'connected' }));
    });

    lcuWs.on('message', (data) => {
        try {
            // 数据可能为空或格式不对，加try-catch
            if (!data) return;
            const msg = JSON.parse(data);
            // LCU 事件格式: [opcode, eventName, payload]
            if (msg && msg[2] && msg[2].uri === "/lol-champ-select/v1/session") {
                lastGameData = msg[2].data;
                if (frontendWs && frontendWs.readyState === WebSocket.OPEN) {
                    frontendWs.send(JSON.stringify({ type: 'CHAMP_SELECT', data: lastGameData }));
                }
            }
        } catch (e) {}
    });

    lcuWs.on('close', () => { 
        isLcuConnected = false; 
        lastGameData = null; 
        lcuWs = null; 
        if (frontendWs && frontendWs.readyState === WebSocket.OPEN) {
            frontendWs.send(JSON.stringify({ type: 'STATUS', data: 'disconnected' }));
        }
    });

    lcuWs.on('error', (err) => { 
        isLcuConnected = false; 
        lcuWs = null;
    });
}