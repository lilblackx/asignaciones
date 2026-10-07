import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseConfig } from './lib/firebase';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// main.jsx llama updateSW(true), que manda SKIP_WAITING al SW nuevo. Sin este
// listener el SW nuevo quedaba en espera hasta cerrar todas las pestañas/PWA.
// clientsClaim hace que tome el control de las páginas abiertas de inmediato.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
clientsClaim();

initializeApp(firebaseConfig);
const messaging = getMessaging();

// Push mientras la app está cerrada/en segundo plano: el navegador despierta este
// Service Worker sin abrir ninguna pestaña. Mostramos la notificación del sistema.
onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Asignaciones';
  const body = payload.notification?.body || payload.data?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data || {},
  });
  // Con la app cerrada no se sabe cuántas hay: insignia sin número en el icono
  // instalado; al abrir la app se reemplaza por el contador real.
  self.navigator.setAppBadge?.()?.catch(() => {});
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      const existing = clientsList.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});
