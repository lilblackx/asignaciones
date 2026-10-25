import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.jsx'
import InstallGate from './components/InstallGate.jsx'
import { registerSW } from 'virtual:pwa-register'
import { setSwRegistration } from './lib/swRegistration'
import { setUpdateAvailable } from './lib/updateAvailable'
import UpdatePrompt from './components/UpdatePrompt.jsx'

// Registro del Service Worker para habilitar la PWA. El navegador no se entera solo
// de un despliegue: hay que preguntarle. Se revisa si hay una versión nueva al abrir la
// app, cada minuto, al volver a la pestaña y al volver a la ventana. La revisión NO pide
// el Service Worker (pesa más de 100 KB y Firebase Hosting no contesta 304 a ese archivo:
// cada revisión lo bajaba entero, y con la app abierta todo el día eran cientos de MB por
// dispositivo al mes). Pide /version.json, de unos 30 bytes, y solo si la versión cambió
// le pide al navegador el Service Worker nuevo. Al detectar una versión nueva se muestra el
// aviso "Actualización disponible" (UpdatePrompt) y el usuario decide cuándo recargar,
// así no se interrumpe a alguien a mitad de cargar un ticket. El aviso se muestra
// siempre, también si la app estaba en segundo plano: no se actualiza sola.
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

const updateSW = registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setSwRegistration(registration);
    // Última versión por la que ya se pidió el Service Worker: mientras el usuario no recarga, la app sigue siendo la vieja y
    // la versión publicada difiere de ella; sin esto se volvería a bajar el Service Worker en cada revisión.
    let versionPedida = null;
    const buscarActualizacion = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const { v } = await res.json();
        if (typeof v !== 'string' || v === __APP_BUILD__ || v === versionPedida) return;
        await registration.update();
        versionPedida = v;
      } catch { /* sin conexión o sin version.json (desarrollo): se vuelve a intentar en la próxima revisión */ }
    };
    // Al abrir: tras una recarga forzada (Ctrl+F5) la página sale nueva pero sin Service Worker (no hay `controller`), así que la
    // versión publicada ya coincide con la de la página y la revisión de arriba no pediría el SW nuevo: se pide aquí.
    if (!navigator.serviceWorker.controller) registration.update().catch(() => {});
    buscarActualizacion();
    setInterval(buscarActualizacion, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') buscarActualizacion();
    });
    window.addEventListener('focus', buscarActualizacion);
  },
  onNeedRefresh() {
    setUpdateAvailable(() => updateSW(true));
  },
  onOfflineReady() {
    console.log('La aplicación está lista para funcionar sin conexión.')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InstallGate>
      <Root />
    </InstallGate>
    <UpdatePrompt />
  </StrictMode>,
)