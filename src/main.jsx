import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import InstallGate from './components/InstallGate.jsx'
import { registerSW } from 'virtual:pwa-register'
import { setSwRegistration } from './lib/swRegistration'
import { setUpdateAvailable } from './lib/updateAvailable'
import UpdatePrompt from './components/UpdatePrompt.jsx'

// Registro del Service Worker para habilitar la PWA. Chequea cada 15 min si hay
// una versión nueva (no solo al abrir la app). Al detectarla muestra el aviso
// "Actualización disponible" (UpdatePrompt) y el usuario decide cuándo recargar,
// así no se interrumpe a alguien a mitad de cargar un ticket. Si la pestaña ya
// estaba en segundo plano cuando se detectó, se aplica ahí mismo sin preguntar.
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

const updateSW = registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setSwRegistration(registration);
    setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
    // Además del intervalo, revisa al volver a la pestaña: así el aviso aparece
    // en cuanto el usuario regresa, sin esperar hasta 15 min.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
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