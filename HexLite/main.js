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

    // 状态记录，防止连发 { code: boolean }
    let keyStates = {}; 

    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(() => {
        // 我们要监听的所有按键
        const keysToCheck = [
            { code: shortcuts.toggle, action: 'toggle' },
            { code: shortcuts.prev,   action: 'trigger-prev-tab' },
            { code: shortcuts.next,   action: 'trigger-next-tab' },
            { code: shortcuts.refresh, action: 'trigger-regenerate' }
        ];

        keysToCheck.forEach(({ code, action }) => {
            if (!code) return;

            const state = GetAsyncKeyState(code);
            const isPressed = (state & 0x8000) !== 0;
            const wasPressed = keyStates[code] || false;

            // 上升沿触发 (按下瞬间)
            if (isPressed && !wasPressed) {
                console.log(`>>> 触发按键动作: ${action}`);
                handleAction(action);
            }

            // 更新状态
            keyStates[code] = isPressed;
        });
    }, 50); // 50ms 轮询间隔
}

// 统一动作分发
function handleAction(action) {
    if (action === 'toggle') {
        toggleOverlay();
    } else {
        // 其他动作直接发给前端 (翻页、刷新)
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('keyboard-action', action);
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
        width: 300, height: 400, show: true, frame: false, backgroundColor: '#010A13',
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    dashboardWindow.loadFile('dashboard.html');

    // 2. 悬浮窗 (全屏透明)
    overlayWindow = new BrowserWindow({
        width: width, height: height,
        transparent: true, frame: false,
        alwaysOnTop: true, skipTaskbar: true,
        hasShadow: false, resizable: false,
        focusable: false, // 🔥 关键：不可聚焦，保证不抢游戏操作
        backgroundColor: '#00000000', // 完全透明
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true);
    // 初始状态：完全穿透 (只听键盘)
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    overlayWindow.loadURL(WEB_APP_URL);

    connectToLCU((data) => {
        if (!dashboardWindow.isDestroyed()) dashboardWindow.webContents.send('lcu-status', 'connected');
        if (!overlayWindow.isDestroyed()) overlayWindow.webContents.send('lcu-update', data);
    });
}

function toggleOverlay() {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;

    // 逻辑变更：F2 只是用来 显示/隐藏 界面
    // 因为现在是“纯键盘模式”，不需要切换鼠标穿透状态
    if (overlayWindow.isVisible()) {
        overlayWindow.hide(); // 彻底隐藏
        console.log('Overlay Hidden');
    } else {
        overlayWindow.show(); // 显示
        overlayWindow.setIgnoreMouseEvents(true, { forward: true }); // 确保显示后也是穿透的
        console.log('Overlay Shown');
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