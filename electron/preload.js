const { contextBridge, ipcRenderer } = require('electron');

// Puente seguro entre React (renderer) y Node.js (main)
// contextIsolation: true — el renderer NO tiene acceso directo a Node.js
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Lee un valor de SQLite (equivalente a localStorage.getItem)
  getValue: (key, fallback) =>
    ipcRenderer.invoke('db:getValue', key, fallback),

  // Guarda un valor en SQLite (equivalente a localStorage.setItem)
  setValue: (key, value) =>
    ipcRenderer.invoke('db:setValue', key, value),

  // Lista todas las claves guardadas
  getAllKeys: () =>
    ipcRenderer.invoke('db:getAllKeys'),
});
