// Solo la configuración pública del proyecto, en un archivo aparte: el Service Worker la importa y, si la tomara de firebase.js,
// se llevaría Auth y Firestore dentro de sw.js (más de 500 KB que cada dispositivo baja en cada revisión de actualizaciones).
export const firebaseConfig = {
  apiKey: "AIzaSyAmmrgV6NUnNGW_PGvVfWdH16_x7ahXW4Y",
  authDomain: "seguimientons-f2026.firebaseapp.com",
  projectId: "seguimientons-f2026",
  storageBucket: "seguimientons-f2026.firebasestorage.app",
  messagingSenderId: "947672124619",
  appId: "1:947672124619:web:dfcb2c93ce29a774441f4e"
};
