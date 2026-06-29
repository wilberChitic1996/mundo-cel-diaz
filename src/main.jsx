import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import VerifyReceipt from './screens/VerifyReceipt.jsx'
import LegalPage from './screens/LegalPage.jsx'
import { initSentry } from './utils/sentry.js'
import './styles/global.css'

initSentry();

var _params = (function() {
  try { return new URLSearchParams(window.location.search); }
  catch (e) { return new URLSearchParams(''); }
})();

// Página pública de verificación: si la URL trae ?verify=<id> (el QR de la boleta),
// se muestra la verificación sin requerir sesión y se omite toda la app y el PWA.
var _verifyId = _params.get('verify');
// Páginas legales públicas (?legal=terms | privacy) — también standalone, sin sesión.
var _legal = _params.get('legal');
if (_verifyId) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <VerifyReceipt saleId={_verifyId} />
    </React.StrictMode>
  );
} else if (_legal) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <LegalPage doc={_legal} />
    </React.StrictMode>
  );
} else {

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

}
