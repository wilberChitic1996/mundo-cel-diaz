// src/sw.js — Service Worker propio (estrategia injectManifest de vite-plugin-pwa).
// E6: además del precache/caché que antes hacía GenerateSW, ahora maneja los eventos
// 'push' y 'notificationclick' para que las notificaciones push del backend se muestren.
/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst } from 'workbox-strategies';

// Activación inmediata (equivalente a skipWaiting/clientsClaim que tenía GenerateSW).
self.skipWaiting();
clientsClaim();

// Precache de los assets del build (inyectados por vite-plugin-pwa) + limpieza de cachés viejas.
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// /api → siempre red (nunca cachear datos del negocio).
registerRoute(/\/api\//i, new NetworkOnly());

// Navegación → red primero, con caché de respaldo (timeout 5s).
registerRoute(
  function (opts) { return opts.request && opts.request.mode === 'navigate'; },
  new NetworkFirst({ cacheName: 'praxisgt-v2-navigate', networkTimeoutSeconds: 5 })
);

// ── Notificaciones push ───────────────────────────────────────────────────────
// El backend (utils/reminders.js → routes/push.js) envía JSON: { title, body, url }.
self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  var title = data.title || 'PraxisGT';
  var options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click en la notificación → enfocar una pestaña existente o abrir la URL.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(target) >= 0 && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
