const { app, BrowserWindow, screen, ipcMain, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const koffi = require('koffi'); // 必须依赖
const { connectToLCU } = require('./lcu');

// === 全局变量 ===
let dashboardWindow;
let overlayWindow;
let pollingInterval;

// 你的网页端地址 (开发时用 localhost, 生产环境可以用 file:// 或部署的 URL)
const WEB_APP_URL = 'http://localhost:5173?overlay=true'; 
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

// ==========================================
// 🎮 1. 键位配置
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
    toggle: 0x71, // F2 (主开关 - 本地处理)
    prev: 0x72,   // F3 (上一页 - 发送给网页)
    next: 0x73,   // F4 (下一页 - 发送给网页)
    refresh: 0x74 // F5 (刷新 - 发送给网页)
};
let currentToggleName = 'F2';

// ==========================================
// 🛡️ 2. 底层轮询系统 (Koffi / User32)
// ==========================================
let user32;
let GetAsyncKeyState;

try {
    user32 = koffi.load('user32.dll');
    GetAsyncKeyState = user32.func('GetAsyncKeyState', 'short', ['int']);
} catch (e) {
    console.error('Koffi 加载失败 (非 Windows 环境?):', e);
}

function startKeyboardPolling() {
    if (!GetAsyncKeyState) return;

    // 状态记录，防止连发 { code: boolean }
    let keyStates = {}; 

    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(() => {
        // 定义要监听的按键及其对应的动作指令
        const keysToCheck = [
            { code: shortcuts.toggle,  action: 'toggle' },      // 本地动作
            { code: shortcuts.prev,    action: 'nav_prev' },    // 发送给 React: 上一页
            { code: shortcuts.next,    action: 'nav_next' },    // 发送给 React: 下一页
            { code: shortcuts.refresh, action: 'refresh' }      // 发送给 React: 刷新/重新分析
        ];

        keysToCheck.forEach(({ code, action }) => {
            if (!code) return;

            const state = GetAsyncKeyState(code);
            // 0x8000 位表示按键当前是否按下
            const isPressed = (state & 0x8000) !== 0;
            const wasPressed = keyStates[code] || false;

            // 上升沿触发 (按下瞬间)
            if (isPressed && !wasPressed) {
                console.log(`>>> 按键触发: ${action}`);
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
        // 将动作转发给网页端 (useGameCore.js 会监听 'shortcut-triggered')
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('shortcut-triggered', action);
        }
        
        // 也可以发给 Dashboard (如果需要在控制台显示反馈)
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('shortcut-log', action);
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
// 🪟 4. 窗口管理
// ==========================================
function createWindows() {
    loadSettings();
    
    // 简单的权限检查提示
    try { require('child_process').execSync('net session', { stdio: 'ignore' }); } catch (e) { 
        setTimeout(() => dialog.showErrorBox('权限警告', '建议右键以【管理员身份运行】，否则可能无法读取游戏数据！'), 1000); 
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // --- 1. 控制台窗口 (Dashboard) ---
    dashboardWindow = new BrowserWindow({
        width: 320, height: 450, // 稍微加大一点尺寸以容纳更多按钮
        show: true, 
        frame: false,            // 无边框
        backgroundColor: '#010A13',
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        }
    });
    dashboardWindow.loadFile('dashboard.html');

    // --- 2. 游戏悬浮窗 (Overlay) ---
    overlayWindow = new BrowserWindow({
        width: width, height: height,
        transparent: true, 
        frame: false,
        alwaysOnTop: true, 
        skipTaskbar: true,       // 不在任务栏显示
        hasShadow: false, 
        resizable: false,
        focusable: false,        // 🔥 关键：不可聚焦，保证不抢游戏操作
        backgroundColor: '#00000000', // 完全透明
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        }
    });

    overlayWindow.setAlwaysOnTop(true, 'screen-saver'); // 极高层级
    overlayWindow.setVisibleOnAllWorkspaces(true);
    overlayWindow.setIgnoreMouseEvents(true, { forward: true }); // 鼠标穿透

    overlayWindow.loadURL(WEB_APP_URL);

    // --- 3. 启动 LCU 连接 ---
    connectToLCU((data) => {
        // 当 LCU 数据更新时...
        
        const isConnected = data.myTeam && data.myTeam.length > 0;
        
        // 1. 通知 Dashboard 更新状态灯
        if (!dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('lcu-status', isConnected ? 'connected' : 'waiting');
        }

        // 2. 🔥 核心：将数据转发给网页端进行分析
        if (!overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('lcu-update', data);
        }
    });
}

function toggleOverlay() {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;

    if (overlayWindow.isVisible()) {
        overlayWindow.hide(); // 隐藏
        console.log('[Overlay] Hidden');
    } else {
        overlayWindow.show(); // 显示
        // 重新确保穿透和置顶属性，防止被游戏覆盖
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        console.log('[Overlay] Shown');
    }
}

// ==========================================
// 🚀 5. App 生命周期
// ==========================================
app.whenReady().then(() => {
    createWindows();
    startKeyboardPolling();
});

app.on('will-quit', () => { 
    if (pollingInterval) clearInterval(pollingInterval); 
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ==========================================
// 📡 6. IPC 接口 (前后端通信)
// ==========================================

// 获取快捷键设置
ipcMain.handle('get-shortcuts', () => ({ toggle: currentToggleName }));

// 更新快捷键设置
ipcMain.on('update-shortcuts', (event, newShortcuts) => {
    const newKey = newShortcuts.toggle;
    if (VK_CODES[newKey]) {
        currentToggleName = newKey;
        shortcuts.toggle = VK_CODES[newKey];
        saveSettings(newKey);
        // 通知 Overlay 更新（如果需要显示提示）
        if (overlayWindow) overlayWindow.webContents.send('shortcuts-updated', { toggle: newKey });
    }
});

// 基础窗口控制
ipcMain.on('minimize-app', () => dashboardWindow.minimize());

// 🔥 新增：彻底关闭应用
ipcMain.on('close-app', () => {
    app.quit();
});

// 其他辅助
ipcMain.on('copy-and-lock', (event, text) => clipboard.writeText(text));

// 🔥 新增：接收网页端的分析结果，转发给 Dashboard (可选)
ipcMain.on('analysis-result', (event, result) => {
    console.log('[IPC] 收到分析结果');
    if(dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('sync-analysis', result);
    }
});