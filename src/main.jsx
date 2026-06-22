import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

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
