const { app, BrowserWindow, screen, ipcMain, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const koffi = require('koffi'); // 必须依赖
const { connectToLCU } = require('./lcu');

// === 全局变量 ===
let dashboardWindow;
let overlayWindow;
let isOverlayIgnored = true;
let pollingInterval;

const WEB_APP_URL = 'http://localhost:5173?overlay=true'; 
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

// ==========================================
// 🎮 1. 键位配置 (支持多键监听)
// ==========================================
// 虚拟键码表
const VK_CODES = {
    'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74, 'F6': 0x75,
    'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B,
    'Insert': 0x2D, 'Home': 0x24, 'End': 0x23, 'Delete': 0x2E, 
    'PageUp': 0x21, 'PageDown': 0x22, 'Right': 0x27
};

// 默认配置
let shortcuts = {
    toggle: 0x71, // F2 (主开关)
    prev: 0x72,   // F3 (上一页)
    next: 0x73,   // F4 (下一页)
    refresh: 0x74 // F5 (刷新)
};
let currentToggleName = 'F2';

// ==========================================
// 🛡️ 2. 底层轮询系统 (多键并发)
// ==========================================
let user32;
let GetAsyncKeyState;

try {
    user32 = koffi.load('user32.dll');
    GetAsyncKeyState = user32.func('GetAsyncKeyState', 'short', ['int']);
} catch (e) {
    console.error('Koffi 加载失败:', e);
}

function startKeyboardPolling() {
    if (!GetAsyncKeyState) return;
    let keyStates = {}; 

    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(() => {
        const keysToCheck = [
            { code: shortcuts.toggle, action: 'toggle' },
            // 🔥 修改点：这里把 action 改为 useGameCore.js 里监听的事件名
            { code: shortcuts.prev,   action: 'nav_prev' }, 
            { code: shortcuts.next,   action: 'nav_next' },
            { code: shortcuts.refresh, action: 'refresh' }
        ];

        keysToCheck.forEach(({ code, action }) => {
            if (!code) return;
            const state = GetAsyncKeyState(code);
            const isPressed = (state & 0x8000) !== 0;
            const wasPressed = keyStates[code] || false;

            if (isPressed && !wasPressed) {
                handleAction(action);
            }
            keyStates[code] = isPressed;
        });
    }, 50);
}

function handleAction(action) {
    if (action === 'toggle') {
        toggleOverlay();
    } else {
        // 🔥 发送 'shortcut-triggered' 事件，配合前端 useGameCore.js
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('shortcut-triggered', action);
        }
        // 可选：如果需要在控制台也响应按键
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('shortcut-triggered', action);
        }
    }
}

// ==========================================
// 💾 3. 设置读写
// ==========================================
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
            if (data.shortcuts && data.shortcuts.toggle && VK_CODES[data.shortcuts.toggle]) {
                currentToggleName = data.shortcuts.toggle;
                shortcuts.toggle = VK_CODES[currentToggleName];
            }
        }
    } catch (e) { console.error('读取设置失败', e); }
}

function saveSettings(keyName) {
    try {
        const data = { shortcuts: { toggle: keyName } };
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
    } catch (e) { console.error('保存设置失败', e); }
}

// ==========================================
// 🪟 4. 窗口管理 (透明配置)
// ==========================================
function createWindows() {
    loadSettings();
    try { require('child_process').execSync('net session', { stdio: 'ignore' }); } catch (e) { 
        setTimeout(() => dialog.showErrorBox('权限警告', '请右键以【管理员身份运行】！'), 1000); 
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // 1. 控制台 (后台)
    dashboardWindow = new BrowserWindow({
        width: 320, height: 450, show: true, frame: false, backgroundColor: '#010A13',
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false,
            // 建议使用 preload，但为了兼容你现有的代码，暂时保持 nodeIntegration: true
        }
    });
    dashboardWindow.loadFile('dashboard.html');

    // 2. 悬浮窗
    overlayWindow = new BrowserWindow({
        width: width, height: height,
        transparent: true, frame: false,
        alwaysOnTop: true, skipTaskbar: true,
        hasShadow: false, resizable: false,
        focusable: false,
        backgroundColor: '#00000000',
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        }
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.loadURL(WEB_APP_URL);

    // 🔥 LCU 连接逻辑：数据转发给两个窗口
    connectToLCU((data) => {
        console.log('LCU Data Update:', data ? 'Has Data' : 'Empty');
        
        // 发送给 dashboard 显示状态
        if (!dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('lcu-status', data.myTeam && data.myTeam.length > 0 ? 'connected' : 'waiting');
        }
        
        // 🔥 关键：发送给网页端 (Overlay) 进行显示和分析
        if (!overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('lcu-update', data); 
        }
    });
}

function toggleOverlay() {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayWindow.isVisible()) {
        overlayWindow.hide();
    } else {
        overlayWindow.show();
        // 重新确立穿透和置顶
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }
}

app.whenReady().then(() => {
    createWindows();
    startKeyboardPolling();
});

// IPC 接口
ipcMain.handle('get-shortcuts', () => ({ toggle: currentToggleName }));
ipcMain.on('update-shortcuts', (event, newShortcuts) => {
    const newKey = newShortcuts.toggle;
    if (VK_CODES[newKey]) {
        currentToggleName = newKey;
        shortcuts.toggle = VK_CODES[newKey];
        saveSettings(newKey);
        if (overlayWindow) overlayWindow.webContents.send('shortcuts-updated', { toggle: newKey });
    }
});
ipcMain.on('copy-and-lock', (event, text) => clipboard.writeText(text));
ipcMain.on('minimize-app', () => dashboardWindow.minimize());

app.on('will-quit', () => { if (pollingInterval) clearInterval(pollingInterval); });