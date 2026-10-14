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
  const data = payload.data || {};
  const title = payload.notification?.title || data.title || 'Asignaciones';
  const body = payload.notification?.body || data.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data,
    // Mismo evento = mismo aviso: un teléfono con dos tokens no muestra la orden duplicada.
    // renotify hace que, si el aviso anterior seguía en la bandeja, vuelva a sonar.
    ...(data.tag ? { tag: data.tag, renotify: true } : {}),
  });
  // Con la app cerrada no se sabe cuántas hay: insignia sin número en el icono
  // instalado; al abrir la app se reemplaza por el contador real.
  self.navigator.setAppBadge?.()?.catch(() => {});
});

// Al tocar el aviso se abre la orden indicada: con la app ya abierta se le manda un mensaje;
// con la app cerrada se abre con ?orden=...&tipo=... y App.jsx lo lee al cargar.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { ticketId, tipo } = event.notification.data || {};
  const url = new URL('/', self.location.origin);
  if (ticketId) url.searchParams.set('orden', ticketId);
  if (tipo) url.searchParams.set('tipo', tipo);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      const existing = clientsList.find((c) => 'focus' in c);
      if (existing) {
        existing.postMessage({ type: 'ABRIR_NOTIFICACION', ticketId, tipo });
        return existing.focus();
      }
      return self.clients.openWindow(url.href);
    })
  );
});
