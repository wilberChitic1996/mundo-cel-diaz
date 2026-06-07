const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({ name: 'mundoceldiaz-data' });
let mainWindow;
let splashWindow;

// ── Splash Screen ────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: { nodeIntegration: false },
    backgroundColor: '#1a2535',
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.show();
}

// ── Ventana Principal ────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 820,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    icon: path.join(__dirname, '../assets/icon.ico'),
    title: 'MUNDO CEL DIAZ — Sistema de Gestión',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#eceae4',
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Cuando la ventana principal esté lista, cerrar splash y mostrar app
  mainWindow.once('ready-to-show', () => {
    // Esperar mínimo 2 segundos para que se vea la splash
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      mainWindow.show();
      mainWindow.maximize();
    }, 2000);
  });
}

app.whenReady().then(() => {
  console.log('Datos en:', app.getPath('userData'));
  createSplash();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC — electron-store ─────────────────────────────────────────────
ipcMain.handle('db:getValue', (_, key, fallback) => {
  try {
    const val = store.get(key);
    return val !== undefined ? val : fallback;
  } catch { return fallback; }
});

ipcMain.handle('db:setValue', (_, key, value) => {
  try { store.set(key, value); return true; }
  catch { return false; }
});

ipcMain.handle('db:getAllKeys', () => {
  try { return Object.keys(store.store); }
  catch { return []; }
});
