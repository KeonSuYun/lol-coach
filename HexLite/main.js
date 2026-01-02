const { app, BrowserWindow, screen, ipcMain, clipboard, dialog, globalShortcut, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const koffi = require('koffi');
const WebSocket = require('ws'); 
// 🔥 修复：合并引入
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

const WSS_PORT = 29150; 
const isDev = !app.isPackaged;

const PRODUCTION_URL = 'https://www.hexcoach.gg';
const WEB_APP_URL = isDev 
    ? 'http://localhost:5173?overlay=true' 
    : `${PRODUCTION_URL}?overlay=true`;

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

// ==========================================
// 🌐 1. WebSocket 服务 (已增强同步功能)
// ==========================================
function startWebSocketServer() {
    try {
        wssInstance = new WebSocket.Server({ port: WSS_PORT });
        
        wssInstance.on('connection', (ws) => {
            ws.send(JSON.stringify({ type: 'STATUS', data: 'connected' }));

            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'REQUEST_SYNC' }));
                }
            }, 1000);

            ws.on('message', async (message) => {
                try {
                    const rawMsg = message.toString();
                    const parsed = JSON.parse(rawMsg);

                    if (parsed.type === 'REQUEST_SYNC') {
                        broadcast(rawMsg); 
                    }
                    else if (parsed.type === 'SYNC_AI_RESULT' && parsed.data) {
                        if (overlayWindow && !overlayWindow.isDestroyed()) {
                            overlayWindow.webContents.send('sync-analysis', parsed.data);
                        }
                    }
                    // 🔥🔥🔥【新增】处理网页端的同步请求 🔥🔥🔥
                    else if (parsed.type === 'REQ_LCU_PROFILE') {
                        console.log("🌐 [WS] 收到网页端同步请求...");
                        const profileData = await getProfileData();
                        if (profileData) {
                            ws.send(JSON.stringify({ type: 'LCU_PROFILE_UPDATE', data: profileData }));
                            console.log("📤 [WS] 已发送个人档案给网页端");
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
// 🎮 2. 全键位映射表
// ==========================================
const VK_MAP = {
    'LBtn': 0x01, 'RBtn': 0x02, 'MBtn': 0x04,
    'Back': 0x08, 'Tab': 0x09, 'Enter': 0x0D, 'Shift': 0x10, 'Ctrl': 0x11, 'Alt': 0x12,
    'Esc': 0x1B, 'Space': 0x20, 'PgUp': 0x21, 'PgDn': 0x22, 'End': 0x23, 'Home': 0x24,
    'Left': 0x25, 'Up': 0x26, 'Right': 0x27, 'Down': 0x28,
    'Insert': 0x2D, 'Delete': 0x2E,
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
    refresh: 'D', modePrev: 'Z', modeNext: 'C',
    prevPage: 'LBtn', nextPage: 'RBtn',
    scrollUp: 'S', scrollDown: 'X'
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

        const altCode = VK_MAP['Alt'];
        if (altCode) {
            const altState = GetAsyncKeyState(altCode);
            const altPressed = (altState & 0x8000) !== 0;
            
            if (altPressed) {
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

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
            if (data.shortcuts) activeConfig = { ...activeConfig, ...data.shortcuts };
        }
    } catch (e) {}
}

function saveSettings(newShortcuts) {
    try {
        const data = { shortcuts: { ...activeConfig, ...newShortcuts } };
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
            { label: '退出', click: () => app.quit() }
        ]);
        tray.setToolTip('HexLite Client');
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => switchMouseMode());
    } catch (e) {}
}

function createWindows() {
    loadSettings();
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // 1. Dashboard 窗口 (后台运行)
    dashboardWindow = new BrowserWindow({
        width: 320, height: 480, 
        show: false, 
        frame: false, backgroundColor: '#010A13',
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false,
            webSecurity: false 
        }
    });

    dashboardWindow.loadURL(isDev ? 'http://localhost:5173' : PRODUCTION_URL);

    // 2. Overlay 窗口
    overlayWindow = new BrowserWindow({
        width: 350, height: 300, 
        x: width - 370, y: 120, 
        transparent: true, 
        frame: false,
        alwaysOnTop: true, 
        skipTaskbar: true, 
        hasShadow: false, 
        resizable: true, 
        focusable: false,
        minWidth: 200, minHeight: 40,
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false, 
            webSecurity: false 
        }
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.setResizable(false);

    overlayWindow.loadURL(isDev ? WEB_APP_URL : `${PRODUCTION_URL}?overlay=true`);

    overlayWindow.webContents.on('did-finish-load', () => {
        broadcast(JSON.stringify({ type: 'REQUEST_SYNC' }));
        if (lastLcuData) {
            overlayWindow.webContents.send('lcu-update', lastLcuData);
        }
    });

    // 3. LCU 连接
    let hasWarnedAdmin = false;

    connectToLCU((data) => {
        lastLcuData = data;
        const isConnected = data.myTeam && data.myTeam.length > 0;
        const statusMsg = isConnected ? 'connected' : 'waiting';
        
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
            dialog.showErrorBox(
                '权限不足提醒', 
                '检测到《英雄联盟》正在运行，但 HexLite 无法读取游戏数据。\n\n请【退出本软件】，右键选择【以管理员身份运行】再试。'
            );
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
    console.log("📥 收到个人信息同步请求...");
    const profileData = await getProfileData();
    if (profileData) {
        console.log("📤 同步成功，发送数据给前端");
        event.sender.send('lcu-profile-update', profileData);
    } else {
        console.log("❌ 同步失败：无法连接 LCU 或获取数据为空");
    }
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

ipcMain.on('fetch-lcu-data', (event) => {
    if (lastLcuData) {
        event.sender.send('lcu-update', lastLcuData);
    }
});

// 处理 Electron 内部的同步请求
ipcMain.on('req-lcu-profile', async (event) => {
    const profileData = await getProfileData();
    if (profileData) event.sender.send('lcu-profile-update', profileData);
});