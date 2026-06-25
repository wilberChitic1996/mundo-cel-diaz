import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './styles/global.css'

// ── Service Worker (PWA) — actualización automática y forzada ──────
// Registro explícito e inmediato. Con registerType:'autoUpdate' el SW
// nuevo toma control solo; aquí además forzamos una recarga cuando
// entra una versión nueva, para que NUNCA se quede sirviendo el bundle
// viejo desde caché (causa del "no toma el cambio" en producción).
var _reloading = false;
var _updateSW = registerSW({
  immediate: true,
  onRegisteredSW: function(swUrl, reg) {
    // Revisar si hay versión nueva cada vez que la app vuelve a foco
    // y periódicamente (cada 60s) mientras esté abierta.
    if (reg) {
      setInterval(function(){ reg.update(); }, 60 * 1000);
      window.addEventListener('focus', function(){ reg.update(); });
    }
  },
  onNeedRefresh: function() { if (_updateSW) _updateSW(true); },
});
// Si el SW que controla la página cambia (nuevo build activo), recargar 1 vez.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (_reloading) return;
    _reloading = true;
    window.location.reload();
  });
}

// Capturar el evento de instalación PWA para mostrarlo desde la app
window.__pwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-install-ready'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
