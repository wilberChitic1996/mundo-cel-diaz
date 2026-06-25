import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './styles/global.css'

var _reloading = false;
var _updateSW = registerSW({
  immediate: true,
  onRegisteredSW: function(swUrl, reg) {
    if (reg) {
      setInterval(function(){ reg.update(); }, 60 * 1000);
      window.addEventListener('focus', function(){ reg.update(); });
    }
  },
  onNeedRefresh: function() { if (_updateSW) _updateSW(true); },
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (_reloading) return;
    _reloading = true;
    window.location.reload();
  });
}

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
