// src/utils/db.js
// Capa de acceso a datos — funciona en AMBOS entornos:
//   Electron (SQLite via IPC)  →  datos persistentes en archivo .db
//   Navegador (localStorage)   →  para desarrollo con npm run dev

const IS_ELECTRON =
  typeof window !== 'undefined' &&
  window.electronAPI?.isElectron === true;

export const db = {
  // ── Leer datos ────────────────────────────────────────────────────
  load: async (key, fallback) => {
    if (IS_ELECTRON) {
      return window.electronAPI.getValue(key, fallback);
    }
    // Fallback: localStorage para desarrollo en navegador
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  // ── Guardar datos ─────────────────────────────────────────────────
  save: async (key, value) => {
    if (IS_ELECTRON) {
      return window.electronAPI.setValue(key, value);
    }
    // Fallback: localStorage para desarrollo en navegador
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};
