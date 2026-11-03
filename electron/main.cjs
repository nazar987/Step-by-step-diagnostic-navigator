const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const devUrl = !app.isPackaged && process.env.NAVIGATOR_DEV_URL;
const entry = path.join(__dirname, '..', 'dist', 'index.html');
const allowedUrl = devUrl || pathToFileURL(entry).href;
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 980, minWidth: 380, minHeight: 600,
    title: 'ДЦ Навигатор', backgroundColor: '#f5f5ef', autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== allowedUrl) event.preventDefault(); });
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  if (devUrl) win.loadURL(devUrl); else win.loadFile(entry);
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
