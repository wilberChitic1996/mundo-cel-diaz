const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({ name: 'mundoceldiaz-data' });

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 820,
    minWidth: 1100,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'MUNDO CEL DIAZ — Sistema de Gestión',
    show: false,
  });

  // Detectar si existe el servidor de Vite en localhost:3000
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Modo desarrollo: cargar desde Vite
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      // Si Vite no está corriendo, cargar desde dist
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
    mainWindow.webContents.openDevTools();
  } else {
    // Modo producción: cargar desde dist/
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });
}

app.whenReady().then(() => {
  console.log('Datos guardados en:', app.getPath('userData'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('db:getValue', (_, key, fallback) => {
  try {
    const value = store.get(key);
    return value !== undefined ? value : fallback;
  } catch (err) {
    return fallback;
  }
});

ipcMain.handle('db:setValue', (_, key, value) => {
  try {
    store.set(key, value);
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('db:getAllKeys', () => {
  try {
    return Object.keys(store.store);
  } catch (err) {
    return [];
  }
});
