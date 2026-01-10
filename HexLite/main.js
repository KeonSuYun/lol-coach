const { app, BrowserWindow, screen, ipcMain, clipboard, dialog, globalShortcut, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const koffi = require('koffi');
const WebSocket = require('ws'); 
const { connectToLCU, getProfileData } = require('./lcu'); 
const { pathToFileURL } = require('url');
const { autoUpdater } = require("electron-updater");
const log = require('electron-log');
const axios = require('axios');
log.transports.file.level = 'info';
// 让 autoUpdater 使用这个日志对象
autoUpdater.logger = log;
app.disableHardwareAcceleration();

// === 全局变量 ===
let dashboardWindow;
let overlayWindow;
let pollingInterval;
let wssInstance = null; 
let isMouseIgnored = true; 
let tray = null;
let lastLcuData = null;
let lastAiResult = null; 

// 🔥 [版本升级] 升级为 8 (强制重置键位配置)
const SETTINGS_VERSION = 8; 
autoUpdater.autoDownload = false;
const MODE_CLIENT = 'Client';
const MODE_GAME = 'Game';

let currentMode = MODE_CLIENT; 

let windowMemories = {
    [MODE_CLIENT]: null, 
    [MODE_GAME]: null
};

const WSS_PORT = 29150; 
const isDev = !app.isPackaged;

const PRODUCTION_URL = 'https://www.hexcoach.gg';
const WEB_APP_URL = isDev 
    ? 'http://localhost:5173?overlay=true' 
    : `${PRODUCTION_URL}?overlay=true`;

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

// ==========================================
// 🌐 1. WebSocket 服务 (修复闪断版)
// ==========================================
function startWebSocketServer() {
    try {
        wssInstance = new WebSocket.Server({ port: WSS_PORT });

        // 🔥 [新增] 安全发送函数，防止报错导致服务崩溃
        const safeSend = (ws, payload) => {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
                }
            } catch (e) { /* 忽略发送错误 */ }
        };

        wssInstance.on('connection', (ws) => {
            safeSend(ws, { type: 'STATUS', data: 'connected' }); // 连上立刻发状态
            
            ws.on('message', async (message) => {
                try {
                    const rawMsg = message.toString();
                    const parsed = JSON.parse(rawMsg);
                    
                    // 广播给所有客户端
                    if (wssInstance) {
                        wssInstance.clients.forEach(client => {
                            if (client !== ws && client.readyState === WebSocket.OPEN) {
                                safeSend(client, rawMsg);
                            }
                        });
                    }

                    if (parsed.type === 'REQ_LCU_PROFILE') {
                        const profileData = await getProfileData();
                        if (profileData) ws.send(JSON.stringify({ type: 'LCU_PROFILE_UPDATE', data: profileData }));
                        return; 
                    }

                    if (parsed.type === 'SYNC_AI_RESULT') {
                        lastAiResult = parsed.data; 
                    }

                    if (parsed.type === 'SYNC_CLEAR_RESULT' || parsed.type === 'RESET_ANALYSIS') {
                        lastAiResult = null;
                    }

                    const shouldBroadcast = 
                        parsed.type.startsWith('SYNC_') || 
                        parsed.type.startsWith('TRIGGER_') ||
                        parsed.type.startsWith('UPDATE_') || 
                        parsed.type === 'REQUEST_SYNC';

                    if (shouldBroadcast) {
                        broadcast(rawMsg);
                        // 同步给 Electron 窗口
                        if (overlayWindow && !overlayWindow.isDestroyed()) {
                            if (parsed.type === 'SYNC_AI_RESULT') overlayWindow.webContents.send('ai-result', parsed.data);
                            else overlayWindow.webContents.send('broadcast-sync', parsed);
                        }
                        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
                             if (parsed.type === 'SYNC_AI_RESULT') dashboardWindow.webContents.send('ai-result', parsed.data);
                            else dashboardWindow.webContents.send('broadcast-sync', parsed);
                        }
                    }

                } catch (e) {
                    console.error("WS Message Error:", e);
                }
            });
            ws.on('error', () => {});
        });
    } catch (e) {
        console.error("WS Server Error:", e);
    }
}

function broadcast(message) {
    if (!wssInstance) return;
    wssInstance.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            const payload = typeof message === 'string' ? message : JSON.stringify(message);
            client.send(payload);
        }
    });
}

// ==========================================
// 🎮 2. 快捷键逻辑 (Windows Only)
// ==========================================
let activeConfig = {
    toggle: 'Home', mouseMode: 'Tilde', refresh: 'Ctrl+F',            
    toggleView: 'Ctrl+E', modePrev: 'Ctrl+Z', modeNext: 'Ctrl+C',           
    prevPage: 'Ctrl+A', nextPage: 'Ctrl+D', scrollUp: 'Ctrl+S',           
    scrollDown: 'Ctrl+X', playAudio: 'Ctrl+Space'
};

const VK_MAP = {
    'LBtn': 0x01, 'RBtn': 0x02, 'MBtn': 0x04,
    'Back': 0x08, 'Tab': 0x09, 'Enter': 0x0D, 'Shift': 0x10, 'Ctrl': 0x11, 'Alt': 0x12,
    'Pause': 0x13, 'CapsLock': 0x14, 'Esc': 0x1B, 'Space': 0x20, 
    'PgUp': 0x21, 'PgDn': 0x22, 'End': 0x23, 'Home': 0x24,
    'Left': 0x25, 'Up': 0x26, 'Right': 0x27, 'Down': 0x28, 
    'PrintScreen': 0x2C, 'Insert': 0x2D, 'Delete': 0x2E,
    '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34, '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,
    'A': 0x41, 'B': 0x42, 'C': 0x43, 'D': 0x44, 'E': 0x45, 'F': 0x46, 'G': 0x47, 'H': 0x48, 'I': 0x49, 'J': 0x4A,
    'K': 0x4B, 'L': 0x4C, 'M': 0x4D, 'N': 0x4E, 'O': 0x4F, 'P': 0x50, 'Q': 0x51, 'R': 0x52, 'S': 0x53, 'T': 0x54,
    'U': 0x55, 'V': 0x56, 'W': 0x57, 'X': 0x58, 'Y': 0x59, 'Z': 0x5A,
    'LWin': 0x5B, 'RWin': 0x5C, 'Apps': 0x5D,
    'Num0': 0x60, 'Num1': 0x61, 'Num2': 0x62, 'Num3': 0x63, 'Num4': 0x64, 
    'Num5': 0x65, 'Num6': 0x66, 'Num7': 0x67, 'Num8': 0x68, 'Num9': 0x69,
    'Multiply': 0x6A, 'Add': 0x6B, 'Separator': 0x6C, 'Subtract': 0x6D, 'Decimal': 0x6E, 'Divide': 0x6F,
    'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74, 'F6': 0x75,
    'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B,
    'F13': 0x7C, 'F14': 0x7D, 'F15': 0x7E, 'F16': 0x7F, 
    'NumLock': 0x90, 'ScrollLock': 0x91,
    'Tilde': 0xC0, 'Minus': 0xBD, 'Plus': 0xBB, 'LBracket': 0xDB, 'RBracket': 0xDD, 
    'Backslash': 0xDC, 'Semicolon': 0xBA, 'Quote': 0xDE, 'Comma': 0xBC, 'Period': 0xBE, 'Slash': 0xBF 
};

let user32, GetAsyncKeyState;
try {
    if (process.platform === 'win32') {
        user32 = koffi.load('user32.dll');
        GetAsyncKeyState = user32.func('__stdcall', 'GetAsyncKeyState', 'short', ['int']);
    }
} catch (e) { 
    console.error("DLL Error:", e);
}

function startKeyboardPolling() {
    if (!GetAsyncKeyState) return;
    let keyLocks = {}; 
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        const actions = [
            { id: 'toggle', action: () => toggleOverlay() },
            { id: 'mouseMode', action: () => switchMouseMode() },
            { id: 'refresh', action: () => sendToOverlay('shortcut-triggered', 'refresh') },
            { id: 'toggleView', action: () => sendToOverlay('shortcut-triggered', 'toggle_view') }, 
            { id: 'modePrev', action: () => sendToOverlay('shortcut-triggered', 'mode_prev') },
            { id: 'modeNext', action: () => sendToOverlay('shortcut-triggered', 'mode_next') },
            { id: 'prevPage', action: () => sendToOverlay('shortcut-triggered', 'nav_prev') },
            { id: 'nextPage', action: () => sendToOverlay('shortcut-triggered', 'nav_next') },
            { id: 'scrollUp', action: () => sendToOverlay('scroll-action', 'up') },
            { id: 'scrollDown', action: () => sendToOverlay('scroll-action', 'down') },
            { id: 'playAudio', action: () => sendToOverlay('shortcut-triggered', 'playAudio') }
        ];
        actions.forEach(({ id, action }) => {
            const configStr = activeConfig[id]; 
            if (!configStr) return;
            if (checkCombo(configStr)) {
                if (!keyLocks[id]) { action(); keyLocks[id] = true; }
            } else { keyLocks[id] = false; }
        });
    }, 100); 

    function checkCombo(comboStr) {
        if (!comboStr) return false;
        const keys = comboStr.split('+').map(k => k.trim());
        return keys.every(keyName => {
            if (keyName === 'Cmd' || keyName === 'Command') keyName = 'Ctrl';
            if (keyName === 'Option') keyName = 'Alt';
            return isKeyPressed(keyName);
        });
    }

    function isKeyPressed(keyName) {
        const code = VK_MAP[keyName];
        if (!code) return false; 
        try { return (GetAsyncKeyState(code) & 0x8000) !== 0; } catch (err) { return false; }
    }
}

function switchMouseMode() {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    isMouseIgnored = !isMouseIgnored;
    if (isMouseIgnored) {
        overlayWindow.setResizable(false);
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        overlayWindow.setFocusable(false);
        overlayWindow.webContents.send('mouse-ignore-status', true);
    } else {
        overlayWindow.setFocusable(true);
        overlayWindow.setIgnoreMouseEvents(false);
        overlayWindow.setResizable(true);
        overlayWindow.focus();
        setTimeout(() => { if(overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.focus(); }, 50);
        overlayWindow.webContents.send('mouse-ignore-status', false);
    }
}

function sendToOverlay(channel, data) {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send(channel, data);
    }
}

function loadSettings(workArea) {
    const clientW = 400; const clientH = 600;
    const clientX = workArea.width - clientW - 50; 
    const clientY = (workArea.height - clientH) / 2; 
    const defaultClient = { width: clientW, height: clientH, x: clientX, y: clientY };
    
    const gameW = 350; const gameH = 300;
    const gameX = workArea.width - gameW - 10; 
    const gameY = workArea.height - gameH - 440; 
    const defaultGame = { width: gameW, height: gameH, x: gameX, y: gameY };

    windowMemories[MODE_CLIENT] = defaultClient;
    windowMemories[MODE_GAME] = defaultGame;

    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
            if (data.version === SETTINGS_VERSION) {
                if (data.shortcuts) activeConfig = { ...activeConfig, ...data.shortcuts };
                if (data.windowMemories) {
                    if(data.windowMemories[MODE_CLIENT]) windowMemories[MODE_CLIENT] = { ...defaultClient, ...data.windowMemories[MODE_CLIENT] };
                    if(data.windowMemories[MODE_GAME]) windowMemories[MODE_GAME] = { ...defaultGame, ...data.windowMemories[MODE_GAME] };
                }
            } else { saveSettings(); }
        }
    } catch (e) {}
}

function saveSettings(newShortcuts = null) {
    try {
        const shortcutsToSave = newShortcuts ? { ...activeConfig, ...newShortcuts } : activeConfig;
        const data = { version: SETTINGS_VERSION, shortcuts: shortcutsToSave, windowMemories: windowMemories };
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
    } catch (e) {}
}

// 托盘
function createTray() {
    const iconPath = path.join(__dirname, 'resources', 'icon.ico'); 
    try {
        tray = new Tray(iconPath); 
        const contextMenu = Menu.buildFromTemplate([
            { label: `HexLite v${app.getVersion()}`, enabled: false },
            { type: 'separator' },
            { label: 'HexLite 运行中', enabled: false },
            { type: 'separator' },
            { label: '🛠️ 开发者工具', click: () => {
                if (dashboardWindow) dashboardWindow.webContents.openDevTools({ mode: 'detach' });
                if (overlayWindow) overlayWindow.webContents.openDevTools({ mode: 'detach' });
            }},
            { label: '显示/隐藏 (Home)', click: () => toggleOverlay() },
            { type: 'separator' },
            { label: '退出', click: () => app.quit() }
        ]);
        tray.setToolTip(`HexLite Client v${app.getVersion()}`);
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => switchMouseMode());
    } catch (e) {}
}
async function getAppBaseUrl() {
    if (isDev) return 'http://localhost:5173';
    try {
        // 尝试探测本地前端
        await axios.get('http://localhost:5173', { timeout: 300 });
        console.log("✅ 调试模式：加载本地前端 (localhost:5173)");
        return 'http://localhost:5173';
    } catch (e) {
        return PRODUCTION_URL;
    }
}
async function createWindows() {
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    loadSettings(workArea); 

    // 🔥 [新增] 动态获取 URL
    const BASE_URL = await getAppBaseUrl(); 
    const APP_URL = `${BASE_URL}?overlay=true`;

    console.log(`🚀 窗口正在加载 URL: ${BASE_URL}`);

    dashboardWindow = new BrowserWindow({
        width: 320, height: 480, show: false, frame: false, backgroundColor: '#010A13',
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }
    });
    // 🔥 [修改] 使用动态 URL
    dashboardWindow.loadURL(BASE_URL);

    const initBounds = windowMemories[MODE_CLIENT];

    overlayWindow = new BrowserWindow({
        width: initBounds.width, height: initBounds.height, 
        x: Number.isInteger(initBounds.x) ? initBounds.x : undefined, 
        y: Number.isInteger(initBounds.y) ? initBounds.y : undefined, 
        transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, 
        resizable: true, focusable: false, minWidth: 200, minHeight: 40,
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }
    });
    
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    if (isMouseIgnored) overlayWindow.setResizable(false);

    // 🔥 [修改] 使用动态 URL
    overlayWindow.loadURL(APP_URL);


    overlayWindow.webContents.on('did-finish-load', () => {
        broadcast(JSON.stringify({ type: 'REQUEST_SYNC' }));
        if (lastLcuData) overlayWindow.webContents.send('lcu-update', lastLcuData);
        // 🔥 主动推送版本号
        overlayWindow.webContents.send('version-info', app.getVersion());
    });
    
    dashboardWindow.webContents.on('did-finish-load', () => {
        // 🔥 主动推送版本号给主窗口
        dashboardWindow.webContents.send('version-info', app.getVersion());
    });

    const saveCurrentBounds = () => {
        if (!overlayWindow || overlayWindow.isDestroyed()) return;
        windowMemories[currentMode] = overlayWindow.getBounds();
        saveSettings();
    };
    overlayWindow.on('resize', saveCurrentBounds);
    overlayWindow.on('move', saveCurrentBounds);

    let hasWarnedAdmin = false;
    connectToLCU((data) => {
        lastLcuData = data;
        const statusMsg = (data.myTeam && data.myTeam.length > 0) ? 'connected' : 'waiting';
        if (data.gamePhase) {
            let targetMode = data.gamePhase === 'InProgress' ? MODE_GAME : MODE_CLIENT;
            if (targetMode !== currentMode) {
                if (overlayWindow && !overlayWindow.isDestroyed()) windowMemories[currentMode] = overlayWindow.getBounds();
                currentMode = targetMode;
                const targetBounds = windowMemories[targetMode];
                if (targetBounds && overlayWindow) overlayWindow.setBounds(targetBounds);
            }
            if (overlayWindow) overlayWindow.webContents.send('game-phase', data.gamePhase);
            
        }
        if (dashboardWindow) {
            dashboardWindow.webContents.send('lcu-status', statusMsg);
            dashboardWindow.webContents.send('lcu-update', data);
        }
        if (overlayWindow) overlayWindow.webContents.send('lcu-update', data);
        broadcast({ type: 'CHAMP_SELECT', data: data });
        broadcast({ type: 'STATUS', data: statusMsg });
    }, (warningType) => { 
        if (warningType === 'permission-denied' && !hasWarnedAdmin) {
            hasWarnedAdmin = true;
            dialog.showErrorBox(
                '权限不足', 
                '无法读取客户端参数。\n\n请关闭软件，右键选择【以管理员身份运行】。'
            );
        }
    });
}

// ==========================================
// 🚀 自动更新逻辑
// ==========================================
function initAutoUpdater() {
    // 1. 发送消息给前端的辅助函数
    function sendUpdateMessage(type, text, info = null) {
        const payload = { 
            message: text, 
            type: type, 
            info: info 
        };
        console.log(`[AutoUpdater] Sending: ${type} - ${text}`); // 🔥 后端日志
        
        // 广播给所有窗口
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('update-message', payload);
        }
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('update-message', payload);
        }
    }

    // 2. 监听各种更新事件
    autoUpdater.on('checking-for-update', () => {
        sendUpdateMessage('checking', '正在检查更新...');
    });

    autoUpdater.on('update-available', (info) => {
        // 🔥 关键：通知前端显示“发现新版本”弹窗
        sendUpdateMessage('available', '发现新版本', info);
    });

    autoUpdater.on('update-not-available', (info) => {
        sendUpdateMessage('not-available', '当前已是最新版本');
    });

    autoUpdater.on('error', (err) => {
        sendUpdateMessage('error', '更新检查失败: ' + err);
        console.error("[AutoUpdater] Error:", err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "下载速度: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - 已下载 ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        sendUpdateMessage('downloading', '正在下载...', { percent: progressObj.percent });
    });

    autoUpdater.on('update-downloaded', (info) => {
        // 🔥 关键：通知前端显示“立即重启”按钮
        sendUpdateMessage('downloaded', '下载完成，准备重启', info);
    });
}

function toggleOverlay() {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayWindow.isVisible()) overlayWindow.hide();
    else {
        overlayWindow.show();
        if (isMouseIgnored) overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }
}

app.whenReady().then(async () => {
    startWebSocketServer();
    await createWindows();
    startKeyboardPolling();
    createTray();
    initAutoUpdater();
    
    // 🔥 [修复] 强制延时检查更新，确保窗口就绪
    if (!isDev) {
        setTimeout(() => autoUpdater.checkForUpdates(), 5000);
        setInterval(() => autoUpdater.checkForUpdates(), 3600000);
    }
});

ipcMain.on('start-download', () => autoUpdater.downloadUpdate());
ipcMain.on('restart-app', () => {
    console.log("🔄 [Main] 接收到重启指令，正在执行强制安装...");
    
    autoUpdater.quitAndInstall(false, true); 
});
app.on('will-quit', () => { if (pollingInterval) clearInterval(pollingInterval); globalShortcut.unregisterAll(); });
ipcMain.on('update-visuals', (event, visualConfig) => {
    if (overlayWindow) overlayWindow.webContents.send('update-visuals', visualConfig);
    if (dashboardWindow) dashboardWindow.webContents.send('update-visuals', visualConfig);
});
app.on('window-all-closed', () => app.quit());
ipcMain.on('req-lcu-profile', async (event) => {
    const profileData = await getProfileData();
    if (profileData) event.sender.send('lcu-profile-update', profileData);
});
ipcMain.handle('get-shortcuts', () => activeConfig);
ipcMain.on('update-shortcuts', (event, newShortcuts) => {
    activeConfig = { ...activeConfig, ...newShortcuts };
    saveSettings(newShortcuts);
    if (overlayWindow) overlayWindow.webContents.send('shortcuts-updated', activeConfig);
});
ipcMain.handle('get-mouse-status', () => isMouseIgnored);
ipcMain.on('minimize-app', () => dashboardWindow?.minimize());
ipcMain.on('close-app', () => app.quit());
ipcMain.on('copy-and-lock', (e, t) => clipboard.writeText(t));
ipcMain.on('fetch-lcu-data', (event) => { if (lastLcuData) event.sender.send('lcu-update', lastLcuData); });
ipcMain.handle('get-app-version', () => app.getVersion());