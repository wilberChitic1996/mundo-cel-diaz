// src/utils/db.js
// Capa de datos unificada — detecta el entorno automaticamente:
//   Online (API backend)   → datos en PostgreSQL/Supabase (nube)
//   Electron (local)       → datos en electron-store
//   Browser dev            → datos en localStorage

const IS_ELECTRON = typeof window !== 'undefined' && window.electronAPI?.isElectron === true;

// Detectar si el backend esta disponible
let API_AVAILABLE = false;
let api_checked   = false;

async function checkBackend() {
  if (api_checked) return API_AVAILABLE;
  try {
    const res = await fetch('http://localhost:4000/health', { signal: AbortSignal.timeout(2000) });
    API_AVAILABLE = res.ok;
  } catch { API_AVAILABLE = false; }
  api_checked = true;
  return API_AVAILABLE;
}

// Resetear el check cada 30 segundos para reconectar automaticamente
setInterval(function() { api_checked = false; }, 30000);

export const db = {
  // ── Leer datos ──────────────────────────────────────
  load: async function(key, fallback) {
    // Si hay backend disponible, los datos vienen del API (no de aqui)
    // Este metodo se usa solo para datos locales (session, config)
    if (IS_ELECTRON) {
      return window.electronAPI.getValue(key, fallback);
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },

  // ── Guardar datos ───────────────────────────────────
  save: async function(key, value) {
    if (IS_ELECTRON) {
      return window.electronAPI.setValue(key, value);
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },

  // ── Verificar si el backend esta disponible ─────────
  isOnline: checkBackend,
};
