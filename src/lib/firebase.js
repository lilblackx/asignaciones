import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { clearIndexedDbPersistence, connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, terminate } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import { olvidarReportesLocales } from './reportesLocales';

export { firebaseConfig };
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Caché de Firestore en el dispositivo (IndexedDB): al reabrir la app solo se descargan los cambios y no toda la colección
// de órdenes otra vez (menos lecturas de Firestore). Sin `window` (fuera de una página) se queda con el getFirestore de siempre.
// Al llegar al tope Firestore borra los documentos que menos se usan; reportesLocales.js detecta esos huecos y vuelve a leer.
const TOPE_CACHE_BYTES = 100 * 1024 * 1024;
const crearDb = () => {
  if (typeof window === 'undefined') return getFirestore(app);
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: TOPE_CACHE_BYTES }) });
  } catch (error) {
    console.error('No se pudo activar la caché local de Firestore:', error);
    return getFirestore(app);
  }
};
export const db = crearDb();

// Al cerrar sesión se borra la caché del dispositivo, para que quien use el equipo después no tenga datos de la cuenta anterior.
// Deja Firestore apagado: la página se recarga después.
export const borrarCacheLocal = async () => {
  olvidarReportesLocales();
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (error) {
    console.error('No se pudo borrar la caché local de Firestore:', error);
  }
};

// Clave pública del Web Push certificate (Firebase Console > Project Settings >
// Cloud Messaging > Web configuration > Generate key pair). No es secreta —
// viaja igual al navegador — pero hay que generarla en la consola primero.
export const FCM_VAPID_KEY = 'BCpE2BZ_Tp-Y4La2jIuuWN4l3Qb28HGHmDKIPvWccI-4LglD2UQw9ewlWK3o_x6xxMxwf8Z649gpXQ4lQUf0-KE';

// URL del Cloudflare Worker que manda los pushes (ver /cf-worker). No es
// necesaria si se despliega en /notify; ajustar tras el primer `wrangler deploy`.
export const NOTIFY_WORKER_URL = 'https://asignaciones-notify.soportenetworkspeed.workers.dev';

// URL del Cloudflare Worker que consulta las coordenadas de las NAP en Tomodat
// (ver /cf-worker-tomodat). Ajustar si el `wrangler deploy` imprime otra URL.
export const TOMODAT_WORKER_URL = 'https://asignaciones-tomodat.soportenetworkspeed.workers.dev';

// Solo se activa con VITE_USE_EMULATORS=true en .env.local (gitignored). Sin esa
// variable, dev/build siguen apuntando al proyecto real como siempre.
// Usa el hostname con el que se abrió la página (no un 127.0.0.1 fijo) para que
// funcione igual accediendo por localhost o por la IP LAN desde otro equipo.
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  // El Service Worker también importa este archivo y no tiene `window`.
  const emulatorHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}
// Segmento fijo de la ruta en Firestore (artifacts/{appId}/public/data/...).
// No cambiar: es el valor con el que ya está guardada toda la data existente.
export const appId = 'default-app-id';
