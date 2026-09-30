import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAmmrgV6NUnNGW_PGvVfWdH16_x7ahXW4Y",
  authDomain: "seguimientons-f2026.firebaseapp.com",
  projectId: "seguimientons-f2026",
  storageBucket: "seguimientons-f2026.firebasestorage.app",
  messagingSenderId: "947672124619",
  appId: "1:947672124619:web:dfcb2c93ce29a774441f4e"
};

export { firebaseConfig };
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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
  const emulatorHost = window.location.hostname;
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}
// Segmento fijo de la ruta en Firestore (artifacts/{appId}/public/data/...).
// No cambiar: es el valor con el que ya está guardada toda la data existente.
export const appId = 'default-app-id';
