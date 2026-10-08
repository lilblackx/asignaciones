import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import InstallGate from './components/InstallGate.jsx'
import { registerSW } from 'virtual:pwa-register'
import { setSwRegistration } from './lib/swRegistration'
import { setUpdateAvailable } from './lib/updateAvailable'
import UpdatePrompt from './components/UpdatePrompt.jsx'

// Registro del Service Worker para habilitar la PWA. El navegador no se entera solo
// de un despliegue: hay que preguntarle. Se revisa si hay una versión nueva al abrir la
// app, cada minuto, al volver a la pestaña y al volver a la ventana. La revisión es una
// petición condicional (If-None-Match): si no hubo cambios el servidor responde 304 sin
// cuerpo, así que pesa unos cientos de bytes. Al detectar una versión nueva se muestra el
// aviso "Actualización disponible" (UpdatePrompt) y el usuario decide cuándo recargar,
// así no se interrumpe a alguien a mitad de cargar un ticket. Si la pestaña ya estaba en
// segundo plano cuando se detectó, se aplica ahí mismo sin preguntar.
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

const updateSW = registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setSwRegistration(registration);
    const buscarActualizacion = () => { registration.update().catch(() => {}); };
    // Al abrir: tras una recarga forzada (Ctrl+F5) el navegador no revisa por su cuenta
    // y el SW viejo se quedaría hasta la próxima revisión.
    buscarActualizacion();
    setInterval(buscarActualizacion, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') buscarActualizacion();
    });
    window.addEventListener('focus', buscarActualizacion);
  },
  onNeedRefresh() {
    if (document.visibilityState === 'hidden') {
      updateSW(true);
      return;
    }
    setUpdateAvailable(() => updateSW(true));
  },
  onOfflineReady() {
    console.log('La aplicación está lista para funcionar sin conexión.')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InstallGate>
      <App />
    </InstallGate>
    <UpdatePrompt />
  </StrictMode>,
)