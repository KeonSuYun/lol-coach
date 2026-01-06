const { app, BrowserWindow, screen, ipcMain, clipboard, dialog, globalShortcut, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const koffi = require('koffi');
const WebSocket = require('ws'); 
const { connectToLCU, getProfileData } = require('./lcu'); 
const { pathToFileURL } = require('url');

app.disableHardwareAcceleration();

// === 全局变量 ===
let dashboardWindow;
let overlayWindow;
let pollingInterval;
let wssInstance = null; 
let isMouseIgnored = true; 
let tray = null;
let lastLcuData = null;

// 🔥 [版本升级] 升级为 5，强制修正默认位置
const SETTINGS_VERSION = 5; 

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
// 🌐 1. WebSocket 服务
// ==========================================
function startWebSocketServer() {
    try {
        wssInstance = new WebSocket.Server({ 
            port: WSS_PORT,
            verifyClient: (info) => {
                const origin = info.origin;
                if (!origin || origin === 'null') return true;
                const ALLOWED_ORIGINS = [
                    "https://www.hexcoach.gg", 
                    "https://www.haxcoach.com",
                    "https://haxcoach.com",
                    "https://hexcoach.gg",
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "file://"
                ];
                return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
            }
        });
        wssInstance.on('connection', (ws) => {
            ws.send(JSON.stringify({ type: 'STATUS', data: 'connected' }));
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'REQUEST_SYNC' }));
            }, 1000);
            ws.on('message', async (message) => {
                try {
                    const rawMsg = message.toString();
                    const parsed = JSON.parse(rawMsg);

                    // 🔥 [新增] 调试日志：看看收到了什么指令
                    if (parsed.type === 'SYNC_AI_RESULT') {
                        console.log("📨 [Main] 收到前端发来的 AI 分析结果，准备转发...");
                    }

                    if (parsed.type === 'REQUEST_SYNC') broadcast(rawMsg); 
                    else if (parsed.type === 'SYNC_AI_RESULT' && parsed.data) {
                        // 保存一份缓存（为了解决刚才说的初始化问题）
                        lastAiResult = parsed.data; 
                        
                        // 转发给 Overlay
                        if (overlayWindow && !overlayWindow.isDestroyed()) {
                            console.log("🚀 [Main] 正在推送到 Overlay...");
                            overlayWindow.webContents.send('sync-analysis', parsed.data);
                        } else {
                            console.log("⚠️ [Main] Overlay 窗口不存在或已销毁，无法推送");
                        }
                    }
                } catch (e) {}
            });
        });
    } catch (e) {}
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
// 🎮 2. 快捷键 & 设置逻辑
// ==========================================
const VK_MAP = {
    'LBtn': 0x01, 'RBtn': 0x02, 'MBtn': 0x04,
    'Back': 0x08, 'Tab': 0x09, 'Enter': 0x0D, 'Shift': 0x10, 'Ctrl': 0x11, 'Alt': 0x12,
    'Esc': 0x1B, 'Space': 0x20, 'PgUp': 0x21, 'PgDn': 0x22, 'End': 0x23, 'Home': 0x24,
    'Left': 0x25, 'Up': 0x26, 'Right': 0x27, 'Down': 0x28, 'Insert': 0x2D, 'Delete': 0x2E,
    '0': 0x30, '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34, '5': 0x35, '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39,
    'A': 0x41, 'B': 0x42, 'C': 0x43, 'D': 0x44, 'E': 0x45, 'F': 0x46, 'G': 0x47, 'H': 0x48, 'I': 0x49, 'J': 0x4A,
    'K': 0x4B, 'L': 0x4C, 'M': 0x4D, 'N': 0x4E, 'O': 0x4F, 'P': 0x50, 'Q': 0x51, 'R': 0x52, 'S': 0x53, 'T': 0x54,
    'U': 0x55, 'V': 0x56, 'W': 0x57, 'X': 0x58, 'Y': 0x59, 'Z': 0x5A,
    'Tilde': 0xC0, 'Minus': 0xBD, 'Plus': 0xBB,
    'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74, 'F6': 0x75,
    'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B
};

let activeConfig = {
    toggle: 'Home', mouseMode: 'Tilde',
    refresh: 'F',           
    modePrev: 'Z',          
    modeNext: 'C',          
    prevPage: 'A',          
    nextPage: 'D',          
    scrollUp: 'S',          
    scrollDown: 'X'         
};

let user32, GetAsyncKeyState;
try {
    user32 = koffi.load('user32.dll');
    GetAsyncKeyState = user32.func('GetAsyncKeyState', 'short', ['int']);
} catch (e) { }

function startKeyboardPolling() {
    if (!GetAsyncKeyState) return;
    let keyLocks = {}; 
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        checkSingleKey(activeConfig.toggle, () => toggleOverlay());
        checkSingleKey(activeConfig.mouseMode, () => switchMouseMode());
        
        const modCode = VK_MAP['Ctrl'];
        if (modCode) {
            const modState = GetAsyncKeyState(modCode);
            const modPressed = (modState & 0x8000) !== 0;
            
            if (modPressed) {
                checkSingleKey(activeConfig.refresh, () => sendToOverlay('shortcut-triggered', 'refresh'), true);
                checkSingleKey(activeConfig.modePrev, () => sendToOverlay('shortcut-triggered', 'mode_prev'), true);
                checkSingleKey(activeConfig.modeNext, () => sendToOverlay('shortcut-triggered', 'mode_next'), true);
                checkSingleKey(activeConfig.prevPage, () => sendToOverlay('shortcut-triggered', 'nav_prev'), true);
                checkSingleKey(activeConfig.nextPage, () => sendToOverlay('shortcut-triggered', 'nav_next'), true);
                checkSingleKey(activeConfig.scrollUp, () => sendToOverlay('scroll-action', 'up'), true);
                checkSingleKey(activeConfig.scrollDown, () => sendToOverlay('scroll-action', 'down'), true);
            }
        }
    }, 100);

    function checkSingleKey(keyName, callback, isCombo = false) {
        const code = VK_MAP[keyName];
        if (!code) return;
        const state = GetAsyncKeyState(code);
        const isPressed = (state & 0x8000) !== 0;
        const lockId = isCombo ? `combo_${keyName}` : `single_${keyName}`;
        if (isPressed) {
            if (!keyLocks[lockId]) {
                callback();
                keyLocks[lockId] = true;
            }
        } else {
            keyLocks[lockId] = false;
        }
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
        overlayWindow.setResizable(true); 
        overlayWindow.setIgnoreMouseEvents(false);
        overlayWindow.setFocusable(true);
        overlayWindow.focus();
        overlayWindow.webContents.send('mouse-ignore-status', false);
    }
}

function sendToOverlay(channel, data) {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send(channel, data);
    }
}

function loadSettings(workArea) {
    // 🔥 [修复] 游戏外（Client Mode）默认位置：屏幕右侧
    // 之前是 undefined (导致居中)，现在改为右侧悬浮，不挡中间的客户端
    const clientW = 400;
    const clientH = 600;
    const clientX = workArea.width - clientW - 50; // 距离右边 50px
    const clientY = (workArea.height - clientH) / 2; // 垂直居中
    
    const defaultClient = { width: clientW, height: clientH, x: clientX, y: clientY };
    
    // 游戏内（Game Mode）：小地图上方
    const gameW = 350;
    const gameH = 300;
    const gameX = workArea.width - gameW - 10; 
    const gameY = workArea.height - gameH - 380; 
    
    const defaultGame = { width: gameW, height: gameH, x: gameX, y: gameY };

    // 默认应用计算出的值
    windowMemories[MODE_CLIENT] = defaultClient;
    windowMemories[MODE_GAME] = defaultGame;

    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
            
            // 检查版本号，如果不匹配则重置
            if (data.version === SETTINGS_VERSION) {
                if (data.shortcuts) activeConfig = { ...activeConfig, ...data.shortcuts };
                if (data.windowMemories) {
                    if(data.windowMemories[MODE_CLIENT]) windowMemories[MODE_CLIENT] = { ...defaultClient, ...data.windowMemories[MODE_CLIENT] };
                    if(data.windowMemories[MODE_GAME]) windowMemories[MODE_GAME] = { ...defaultGame, ...data.windowMemories[MODE_GAME] };
                }
            } else {
                console.log("♻️ 配置升级 (v5)，修正默认窗口位置到右侧...");
                saveSettings(); // 覆写新配置
            }
        }
    } catch (e) {}
}

function saveSettings(newShortcuts = null) {
    try {
        const shortcutsToSave = newShortcuts ? { ...activeConfig, ...newShortcuts } : activeConfig;
        const data = { 
            version: SETTINGS_VERSION, 
            shortcuts: shortcutsToSave,
            windowMemories: windowMemories 
        };
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function createTray() {
    const iconPath = path.join(__dirname, 'resources', 'icon.ico'); 
    try {
        tray = new Tray(iconPath); 
        const contextMenu = Menu.buildFromTemplate([
            { label: 'HexLite 运行中', enabled: false },
            { type: 'separator' },
            { label: '显示/隐藏 Overlay (Home)', click: () => toggleOverlay() },
            { 
                label: '设置快捷键', 
                click: () => {
                    if (overlayWindow && !overlayWindow.isDestroyed()) {
                        if (!overlayWindow.isVisible()) {
                            overlayWindow.show();
                            if (isMouseIgnored) overlayWindow.setIgnoreMouseEvents(true, { forward: true });
                        }
                        overlayWindow.webContents.send('open-settings');
                        overlayWindow.moveTop();
                    }
                } 
            },
            { type: 'separator' },
            { label: '退出', click: () => app.quit() }
        ]);
        tray.setToolTip('HexLite Client');
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => switchMouseMode());
    } catch (e) {}
}

function createWindows() {
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    loadSettings(workArea); 

    dashboardWindow = new BrowserWindow({
        width: 320, height: 480, show: false, frame: false, backgroundColor: '#010A13',
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }
    });
    dashboardWindow.loadURL(isDev ? 'http://localhost:5173' : PRODUCTION_URL);

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

    overlayWindow.loadURL(isDev ? WEB_APP_URL : `${PRODUCTION_URL}?overlay=true`);

    overlayWindow.webContents.on('did-finish-load', () => {
        broadcast(JSON.stringify({ type: 'REQUEST_SYNC' }));
        if (lastLcuData) overlayWindow.webContents.send('lcu-update', lastLcuData);
    });

    const saveCurrentBounds = () => {
        if (!overlayWindow || overlayWindow.isDestroyed()) return;
        const bounds = overlayWindow.getBounds();
        windowMemories[currentMode] = bounds;
        saveSettings();
    };
    overlayWindow.on('resize', saveCurrentBounds);
    overlayWindow.on('move', saveCurrentBounds);

    let hasWarnedAdmin = false;

    connectToLCU((data) => {
        lastLcuData = data;
        const statusMsg = (data.myTeam && data.myTeam.length > 0) ? 'connected' : 'waiting';
        
        if (data.gamePhase) {
            let targetMode = MODE_CLIENT;
            if (data.gamePhase === 'InProgress') targetMode = MODE_GAME;
            
            if (targetMode !== currentMode) {
                console.log(`🔀 [Main] 模式切换: ${currentMode} -> ${targetMode}`);
                
                if (overlayWindow && !overlayWindow.isDestroyed()) {
                    windowMemories[currentMode] = overlayWindow.getBounds();
                }
                
                currentMode = targetMode;
                
                const targetBounds = windowMemories[targetMode];
                if (targetBounds && overlayWindow && !overlayWindow.isDestroyed()) {
                    const safeBounds = {};
                    if (Number.isInteger(targetBounds.x)) safeBounds.x = targetBounds.x;
                    if (Number.isInteger(targetBounds.y)) safeBounds.y = targetBounds.y;
                    if (Number.isInteger(targetBounds.width) && targetBounds.width > 0) safeBounds.width = targetBounds.width;
                    if (Number.isInteger(targetBounds.height) && targetBounds.height > 0) safeBounds.height = targetBounds.height;
                    
                    if (Object.keys(safeBounds).length > 0) {
                        try { overlayWindow.setBounds(safeBounds); } catch (err) {}
                    }
                }
            }
            
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send('game-phase', data.gamePhase);
            }
        }

        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('lcu-status', statusMsg);
            dashboardWindow.webContents.send('lcu-update', data);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('lcu-update', data);
        }
        broadcast({ type: 'CHAMP_SELECT', data: data });
        broadcast({ type: 'STATUS', data: statusMsg });

    }, (warningType) => { 
        if (warningType === 'permission-denied' && !hasWarnedAdmin) {
            hasWarnedAdmin = true;
            dialog.showErrorBox('权限不足', '请以管理员身份运行本软件。');
        }
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

app.whenReady().then(() => {
    startWebSocketServer();
    createWindows();
    startKeyboardPolling();
    createTray();
});

app.on('will-quit', () => { 
    if (pollingInterval) clearInterval(pollingInterval); 
    globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => app.quit());
ipcMain.on('req-lcu-profile', async (event) => {
    const profileData = await getProfileData();
    if (profileData) event.sender.send('lcu-profile-update', profileData);
});
ipcMain.handle('get-shortcuts', () => activeConfig);
ipcMain.on('update-shortcuts', (event, newShortcuts) => {
    let validUpdates = {};
    Object.keys(newShortcuts).forEach(key => {
        if (VK_MAP[newShortcuts[key]]) validUpdates[key] = newShortcuts[key];
    });
    if (Object.keys(validUpdates).length > 0) {
        activeConfig = { ...activeConfig, ...validUpdates };
        saveSettings(validUpdates);
        if (overlayWindow) overlayWindow.webContents.send('shortcuts-updated', activeConfig);
    }
});
ipcMain.handle('get-mouse-status', () => isMouseIgnored);
ipcMain.on('minimize-app', () => dashboardWindow?.minimize());
ipcMain.on('close-app', () => app.quit());
ipcMain.on('copy-and-lock', (e, t) => clipboard.writeText(t));
ipcMain.on('fetch-lcu-data', (event) => { if (lastLcuData) event.sender.send('lcu-update', lastLcuData); });