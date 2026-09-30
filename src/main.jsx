import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import InstallGate from './components/InstallGate.jsx'
import { registerSW } from 'virtual:pwa-register'
import { setSwRegistration } from './lib/swRegistration'

// Registro del Service Worker para habilitar la PWA. Chequea cada 15 min si hay
// una versión nueva (no solo al abrir la app), y la aplica sola sin preguntar.
// Para no interrumpir a alguien a mitad de cargar un ticket, no recarga de una:
// espera a que la pestaña vuelva a estar visible (foco perdido y recuperado) o,
// si ya estaba en segundo plano cuando se detectó, la aplica ahí mismo.
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
let updateReady = false;

const updateSW = registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setSwRegistration(registration);
    setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
  },
  onNeedRefresh() {
    updateReady = true;
    if (document.visibilityState === 'hidden') {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('La aplicación está lista para funcionar sin conexión.')
  },
})

document.addEventListener('visibilitychange', () => {
  if (updateReady && document.visibilityState === 'visible') {
    updateSW(true);
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InstallGate>
      <App />
    </InstallGate>
  </StrictMode>,
)