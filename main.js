// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// ======================================
// ⚠️ 1. 配置您要监听的房间ID
// ======================================
const YOUR_ROOM_ID = 23771189; // <-- ‼️ 请替换为您自己的真实房间ID
const WINDOW_WIDTH = 400; 
const WINDOW_HEIGHT = 600; 
// ======================================

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      // ----------------------------------------------------
      // 关键：使用此配置来修复 "require is not defined"
      // ----------------------------------------------------
      nodeIntegration: true,   // 必须为 true
      contextIsolation: false, // 必须为 false
    }
  });

  const display = require('electron').screen.getPrimaryDisplay();
  const x = display.bounds.width - WINDOW_WIDTH - 20;
  const y = 50; 
  mainWindow.setPosition(x, y);

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // 强制打开 DevTools
  mainWindow.webContents.openDevTools({ mode: 'detach' }); 

  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`[Main] 正在发送房间ID: ${YOUR_ROOM_ID}`);
  });
  
  ipcMain.on('close-app', () => {
      console.log("[Main] 收到退出指令，正在关闭...");
      app.quit();
  });

  // 接收渲染进程的请求，返回房间ID
  ipcMain.on('get-room-id', (event) => {
    event.returnValue = YOUR_ROOM_ID;
  });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});