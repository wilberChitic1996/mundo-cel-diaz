import { useState, useEffect } from 'react';
import { pushAPI } from '../utils/api.js';

var PUSH_KEY = 'mnpos-push-dismissed';

export default function usePushNotifications(session) {
  var _s = useState('idle'); // idle | requesting | granted | denied | unsupported
  var status = _s[0]; var setStatus = _s[1];

  useEffect(function() {
    if (!session) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    var perm = Notification.permission;
    if (perm === 'granted') {
      setStatus('granted');
      registerSubscription();
    } else if (perm === 'denied') {
      setStatus('denied');
    } else {
      // 'default' — mostrar prompt solo si no fue descartado antes
      if (!localStorage.getItem(PUSH_KEY)) setStatus('idle');
    }
  }, [session && session.userId]);

  async function registerSubscription() {
    try {
      var reg = await navigator.serviceWorker.ready;
      var keyRes = await pushAPI.vapidKey();
      var vapidKey = keyRes && keyRes.key;
      if (!vapidKey) return;

      var sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await pushAPI.subscribe(sub.toJSON());
    } catch (e) {
      // Permiso negado o error de red — ignorar silenciosamente
    }
  }

  async function requestPermission() {
    setStatus('requesting');
    try {
      var result = await Notification.requestPermission();
      if (result === 'granted') {
        setStatus('granted');
        await registerSubscription();
      } else {
        setStatus('denied');
        localStorage.setItem(PUSH_KEY, '1');
      }
    } catch (e) {
      setStatus('denied');
    }
  }

  function dismiss() {
    localStorage.setItem(PUSH_KEY, '1');
    setStatus('denied');
  }

  return { status, requestPermission, dismiss };
}

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw = window.atob(base64);
  var arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
