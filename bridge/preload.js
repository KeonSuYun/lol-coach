// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 把一个叫 electronAPI 的对象暴露给网页
contextBridge.exposeInMainWorld('electronAPI', {
    // 网页可以通过这个函数监听 'update-suggestion' 事件
    onUpdateSuggestion: (callback) => ipcRenderer.on('update-suggestion', callback)
});