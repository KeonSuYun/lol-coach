// bridge/main.js (完整升级版)
const { app, BrowserWindow, globalShortcut, screen, ipcMain, tray, Menu } = require('electron');
const path = require('path');
const { connectToLCU } = require('./lcu'); // 你之前的 LCU 模块

let mainWindow;
let overlayWindow;
let isOverlayIgnored = true; // 默认：悬浮窗鼠标穿透（不可点击）

// ✅ 1. 创建主控制台窗口 (类似 TGP/WeGame 主界面)
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        frame: true, // 有边框
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // 为了方便演示，生产环境建议开启 isolation 并用 preload
        }
    });

    // 加载你的 React 网页 (开发环境用 localhost，打包用 file://)
    const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
    mainWindow.loadURL(startUrl);

    mainWindow.on('closed', () => mainWindow = null);
}

// ✅ 2. 创建透明悬浮窗 (游戏内 Overlay)
function createOverlayWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    overlayWindow = new BrowserWindow({
        width: width,
        height: height,
        transparent: true, // ✨ 透明背景
        frame: false,      // ✨ 无边框
        alwaysOnTop: true, // ✨ 永远置顶 (覆盖在游戏上)
        skipTaskbar: true, // 不显示在任务栏
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    // 加载 React 页面，带上 ?overlay=true 参数
    const overlayUrl = (process.env.ELECTRON_START_URL || 'http://localhost:5173') + '?overlay=true';
    overlayWindow.loadURL(overlayUrl);

    // ✨ 核心黑科技：设置鼠标穿透
    // 初始状态：完全忽略鼠标事件，直接透传给游戏
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });

    // 防止窗口关闭
    overlayWindow.on('closed', () => overlayWindow = null);
}

// ✅ 3. 鼠标穿透切换逻辑
function toggleMouseIgnore() {
    if (!overlayWindow) return;

    isOverlayIgnored = !isOverlayIgnored;
    
    if (isOverlayIgnored) {
        // 锁定模式：鼠标穿透，操作游戏
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        // 通知前端显示“锁定图标”
        overlayWindow.webContents.send('mouse-ignore-status', true);
    } else {
        // 解锁模式：鼠标可点击悬浮窗，操作分析器
        overlayWindow.setIgnoreMouseEvents(false);
        overlayWindow.focus(); // 夺取焦点
        // 通知前端显示“解锁图标”
        overlayWindow.webContents.send('mouse-ignore-status', false);
    }
}

app.whenReady().then(() => {
    createMainWindow();
    createOverlayWindow();

    // ⌨️ 注册全局快捷键 (Alt+W 切换操作模式)
    globalShortcut.register('Alt+W', () => {
        toggleMouseIgnore();
    });

    // 🔌 启动 LCU 桥接 (复用你之前的代码)
    connectToLCU((data) => {
        // 收到数据，同时发给两个窗口
        if (mainWindow) mainWindow.webContents.send('lcu-update', data);
        if (overlayWindow) overlayWindow.webContents.send('lcu-update', data);
    });
});

// IPC 监听：前端请求切换状态
ipcMain.handle('get-mouse-status', () => isOverlayIgnored);

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});