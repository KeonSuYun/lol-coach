const { app, BrowserWindow, screen, dialog, globalShortcut, ipcMain, shell, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// ================= 🔧 配置区域 =================
// 注意：这个 URL 仅在开发模式或者找不到本地文件时作为兜底使用
const DEFAULT_FRONTEND_URL = "http://localhost:5173"; 
const WSS_PORT = 29150;
const CONFIG_FILE = path.join(app.getPath('userData'), 'bridge-config.json');

// 默认快捷键配置
const DEFAULT_SHORTCUTS = {
    'tab_bp': 'Ctrl+Alt+1',       // 🟢 同步为 Ctrl+Alt
    'tab_personal': 'Ctrl+Alt+2',
    'tab_team': 'Ctrl+Alt+3',
    'nav_prev': 'Ctrl+Alt+Left', 
    'nav_next': 'Ctrl+Alt+Right',
    'refresh': 'Ctrl+Alt+R', 
    'toggle_visible': 'Alt+H',    // 这个通常保留 Alt+H
    'send_chat': 'Alt+Enter',
    'toggle_mouse': 'Ctrl+Alt+W'  // 🟢 确保这里也是 Ctrl+Alt+W
};

// ================= 🛑 单实例锁 (防止双开崩溃) =================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log("⚠️ 检测到另一个实例，自动退出...");
    app.quit();
    process.exit(0); // 强制终止
}

// ================= 全局变量 =================
let mainWindow = null;
let tray = null; // 托盘图标实例
let isQuitting = false; // 标记是否真的要退出

let frontendWs = null;
let lcuWs = null;
let isLcuConnected = false;
let lastGameData = null;
let cachedGameDir = null;
let currentShortcuts = { ...DEFAULT_SHORTCUTS };
let hasAskedUser = false; 

// ✨ 新增状态记录
let isMouseIgnored = true; // 默认为 true (游戏优先，鼠标穿透)
let jungleEngineProcess = null; // Python 引擎进程句柄

// 忽略 SSL 错误
app.commandLine.appendSwitch('ignore-certificate-errors');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// 设置 App ID
app.setAppUserModelId("com.hexcoach.client");

// ================= 1. 配置管理 (含窗口位置记忆) =================

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (data.path && fs.existsSync(data.path)) cachedGameDir = data.path;
            if (data.shortcuts) currentShortcuts = { ...DEFAULT_SHORTCUTS, ...data.shortcuts };
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

// ================= 2. 窗口与交互逻辑 =================

/**
 * ✨ 核心函数：切换鼠标穿透状态
 * @param {boolean} ignore true=鼠标穿透(打游戏) false=鼠标拦截(操作助手)
 */
function setOverlayIgnoreMouse(ignore) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    isMouseIgnored = ignore;
    
    // Electron API: true 表示忽略鼠标事件（穿透），false 表示捕获
    mainWindow.setIgnoreMouseEvents(ignore);
    
    // 通知前端改变 UI (显示/隐藏锁图标)
    mainWindow.webContents.send('mouse-ignore-status', ignore);
    
    console.log(`🖱️ 鼠标模式切换: ${ignore ? '🛡️ 游戏模式 (穿透)' : '👆 操作模式 (拦截)'}`);
}

function createTray() {
    const iconPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'icon.ico') // 生产环境
        : path.join(__dirname, 'icon.ico');            // 开发环境

    try {
        if (fs.existsSync(iconPath)) {
            tray = new Tray(iconPath);
            
            const contextMenu = Menu.buildFromTemplate([
                { label: '显示/隐藏悬浮窗', click: () => toggleWindowVisibility() },
                { label: '重启助手', click: () => { app.relaunch(); app.exit(); } },
                { type: 'separator' },
                { label: '退出', click: () => {
                    isQuitting = true;
                    app.quit();
                }}
            ]);
            
            tray.setToolTip('HexCoach 助手 (Alt+W 切换鼠标)');
            tray.setContextMenu(contextMenu);
            tray.on('double-click', () => mainWindow.show());
        } else {
            console.warn("⚠️ 未找到托盘图标:", iconPath);
        }
    } catch (e) {
        console.error("⚠️ 创建托盘失败:", e);
    }
}

function toggleWindowVisibility() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            // 显示时，恢复之前的鼠标状态
            mainWindow.setIgnoreMouseEvents(isMouseIgnored);
        }
    }
}

function createOverlayWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    const config = loadConfig();

    // 恢复上次窗口位置
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
        mainWindow.loadFile(path.join(__dirname, 'dist/index.html'), {
            hash: 'overlay=true'
        });
        console.log("🚀 [生产模式] 加载本地打包资源");
    } else {
        mainWindow.loadURL("http://localhost:5173?overlay=true");
        console.log("🚀 [开发模式] 加载本地服务器");
    }

    // 限制外链跳转
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('file:') || url.startsWith('http://localhost')) return { action: 'allow' };
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // ✨ 窗口加载完毕后，默认进入“穿透模式”，防止挡住游戏
    mainWindow.webContents.on('did-finish-load', () => {
        setOverlayIgnoreMouse(true);
    });

    registerGlobalShortcuts(mainWindow);

    // 拦截关闭事件 -> 最小化到托盘
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault(); // 阻止真正的关闭
            mainWindow.hide(); // 只是隐藏
        } else {
            try {
                const bounds = mainWindow.getBounds();
                saveConfig({ windowX: bounds.x, windowY: bounds.y });
            } catch(e) {}
        }
    });

    // 监听移动结束，保存位置
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
                // 1. 切换显示/隐藏
                if (action === 'toggle_visible') {
                    toggleWindowVisibility();
                    return;
                }
                // 2. ✨ 切换鼠标穿透 (Alt+W)
                if (action === 'toggle_mouse') {
                    setOverlayIgnoreMouse(!isMouseIgnored);
                    return;
                }

                // 3. 其他操作 (仅在窗口显示时生效)
                if (win && !win.isDestroyed() && win.isVisible()) {
                    if (win.isMinimized()) win.restore();
                    win.webContents.send('shortcut-triggered', action);
                }
            });
        } catch (e) {
            console.error(`注册快捷键失败 ${key}:`, e);
        }
    });
}

// ================= 🐍 Python 引擎管理 (JungleBrain) =================

function startJungleEngine(port, password) {
    if (jungleEngineProcess) return; // 防止重复启动

    console.log("🐍 正在启动 JungleBrain 引擎...", port);
    let cmd, args;

    if (app.isPackaged) {
        // 生产环境：调用打包好的 exe
        cmd = path.join(process.resourcesPath, 'engine', 'jungle_engine.exe');
        args = ['--port', port, '--password', password];
    } else {
        // 开发环境：调用 python 脚本
        const scriptPath = path.join(__dirname, '../backend/jungle_engine.py');
        cmd = 'python'; // 若需指定 python3 请修改此处
        args = [scriptPath, '--port', port, '--password', password];
    }

    // 启动子进程
    jungleEngineProcess = spawn(cmd, args);

    // 监听输出
    jungleEngineProcess.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.startsWith('JSON_OUT:')) {
                try {
                    const payload = JSON.parse(line.replace('JSON_OUT:', ''));
                    // 如果是日志，打印到 Electron 控制台
                    if (payload.type === 'LOG') {
                        console.log(`[🐍 PyEngine]: ${payload.msg}`);
                    } 
                    // 其他数据 (CV结果等) 转发给前端
                    else if (frontendWs && frontendWs.readyState === WebSocket.OPEN) {
                        frontendWs.send(JSON.stringify(payload));
                    }
                } catch (e) {
                    console.error("解析 Python 数据失败:", e);
                }
            }
        });
    });

    jungleEngineProcess.stderr.on('data', (data) => {
        console.error(`[🐍 PyError]: ${data}`);
    });

    jungleEngineProcess.on('close', (code) => {
        console.log(`🐍 JungleBrain 引擎已退出，代码: ${code}`);
        jungleEngineProcess = null;
    });
}

function stopJungleEngine() {
    if (jungleEngineProcess) {
        console.log("🛑 正在停止 Python 引擎...");
        jungleEngineProcess.kill();
        jungleEngineProcess = null;
    }
}

// ================= 3. App 生命周期 =================

app.whenReady().then(() => {
    loadConfig();
    startWebSocketServer();
    createOverlayWindow();
    createTray();
    
    // 定时器检查连接
    setInterval(findLCUAndConnect, 3000);
    findLCUAndConnect();

    // IPC 通信监听
    ipcMain.on('update-shortcuts', (event, newShortcuts) => {
        currentShortcuts = newShortcuts;
        saveConfig({ shortcuts: newShortcuts });
        if (mainWindow) registerGlobalShortcuts(mainWindow);
    });
    
    ipcMain.handle('get-shortcuts', () => currentShortcuts);
    
    // 获取当前鼠标状态 (前端初始化用)
    ipcMain.handle('get-mouse-status', () => isMouseIgnored);

    // 一键发送聊天逻辑
    ipcMain.on('perform-send-chat', (event, text) => {
        if (!isLcuConnected || !lcuWs) {
            console.log("LCU 未连接，无法发送聊天");
            return;
        }
        
        console.log("准备发送聊天:", text);
        const reqId = "GetChat_" + Date.now();
        lcuWs.send(JSON.stringify([2, reqId, "GET", "/lol-chat/v1/conversations", null]));

        const chatHandler = (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg[0] === 3 && msg[1] === reqId) { 
                    const conversations = msg[2];
                    const champSelectChat = conversations.find(c => c.type === "championSelect");
                    
                    if (champSelectChat) {
                        const chatId = champSelectChat.id;
                        lcuWs.send(JSON.stringify([
                            2, 
                            "PostMsg_" + Date.now(), 
                            "POST", 
                            `/lol-chat/v1/conversations/${chatId}/messages`, 
                            { "body": text, "type": "chat" }
                        ]));
                        console.log("✅ 消息已发送到选人房间:", chatId);
                    }
                    lcuWs.removeListener('message', chatHandler);
                }
            } catch (e) {}
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

app.on('will-quit', () => { 
    globalShortcut.unregisterAll(); 
    stopJungleEngine(); // 确保退出时清理 Python 进程
});

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
    console.log("🔍 [Debug] 开始搜寻游戏路径...");

    // 1. 先检查缓存
    if (cachedGameDir) {
        const lock = path.join(cachedGameDir, 'lockfile');
        if (fs.existsSync(lock)) {
            console.log(`✅ [Debug] 缓存路径有效: ${cachedGameDir}`);
            return cachedGameDir;
        } else {
            console.log(`❌ [Debug] 缓存路径失效 (文件不存在): ${cachedGameDir}`);
        }
    }

    // 2. 定义搜索列表 (已包含你的 F 盘路径)
    const defPaths = [
        'F:\\WeGameApps\\英雄联盟\\LeagueClient',  // 最可能的路径
        'F:\\WeGameApps\\英雄联盟',               // 备选路径
        'C:\\WeGameApps\\英雄联盟\\LeagueClient',
        'D:\\WeGameApps\\英雄联盟\\LeagueClient',
        'E:\\WeGameApps\\英雄联盟\\LeagueClient',
        'C:\\Riot Games\\League of Legends',
        'D:\\Riot Games\\League of Legends'
    ];

    for (const p of defPaths) {
        const lockPath = path.join(p, 'lockfile');
        const exists = fs.existsSync(lockPath);
        
        // 打印检查过程
        if (!exists) {
            console.log(`❌ [Debug] 未找到文件: ${lockPath}`);
            continue;
        }

        console.log(`🔎 [Debug] 发现文件! 正在校验: ${lockPath}`);

        try {
            // A. 读取内容
            const content = fs.readFileSync(lockPath, 'utf8').trim(); // 加个 trim() 去掉首尾空格
            console.log(`📄 [Debug] 捕获到 lockfile 内容: "${content}"`); // 把内容打印出来看看

            // B. 宽松校验：只要能按冒号分割出至少 5 部分，我们就认为是对的
            // 标准格式: LeagueClient:PID:Port:Password:Protocol
            const parts = content.split(':');
            
            if (parts.length < 5) {
                console.log(`⚠️ [Debug] 格式错误 (分割后不足5项): ${parts.length}`);
                continue;
            }
            
            // 只要格式对，不管开头是不是 LeagueClient，都试着连一下
            console.log(`✅ [Debug] 格式校验通过！锁定路径: ${p}`);
            cachedGameDir = p;
            return p;

        } catch (e) {
            console.log(`⚠️ [Debug] 读取出错: ${e.message}`);
        }
    }
    
    console.log("🚫 [Debug] 所有路径均未找到有效 lockfile");

    // 3. 强制弹窗询问 (如果自动搜索失败)
    if (mainWindow && !mainWindow.isDestroyed() && !cachedGameDir && !hasAskedUser) {
        console.log("❓ [Debug] 尝试弹出手动选择框...");
        hasAskedUser = true;
        setTimeout(() => {
            const result = dialog.showOpenDialogSync(mainWindow, { 
                title: '请手动找到 lockfile 文件所在的文件夹', 
                properties: ['openDirectory'] 
            });
            if (result && result.length > 0) {
                console.log(`✅ [Debug] 用户手动选择: ${result[0]}`);
                cachedGameDir = result[0];
                saveConfig({ path: result[0] });
            } else {
                console.log("❌ [Debug] 用户取消了选择");
                hasAskedUser = false; 
            }
        }, 1000);
    }
    return cachedGameDir;
}

function findLCUAndConnect() {
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
    if (isLcuConnected) return;

    const cert = Buffer.from(`riot:${password}`).toString('base64');
    lcuWs = new WebSocket(`wss://127.0.0.1:${port}`, { 
        headers: { 'Authorization': `Basic ${cert}` }, 
        rejectUnauthorized: false 
    });

    lcuWs.on('open', () => {
        isLcuConnected = true;
        
        // ✨✨✨ LCU 连接成功，启动 Python 引擎
        startJungleEngine(port, password);

        // 订阅选人事件
        lcuWs.send(JSON.stringify([5, "OnJsonApiEvent", { uri: "/lol-champ-select/v1/session" }]));
        if (frontendWs) frontendWs.send(JSON.stringify({ type: 'STATUS', data: 'connected' }));
    });

    lcuWs.on('message', (data) => {
        try {
            if (!data) return;
            const msg = JSON.parse(data);
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
        
        // ✨✨✨ LCU 断开，停止 Python 引擎
        stopJungleEngine();

        if (frontendWs && frontendWs.readyState === WebSocket.OPEN) {
            frontendWs.send(JSON.stringify({ type: 'STATUS', data: 'disconnected' }));
        }
    });

    lcuWs.on('error', (err) => { 
        isLcuConnected = false; 
        lcuWs = null;
    });
}