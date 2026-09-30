import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isMobileUA = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Los pushes solo llegan con el teléfono bloqueado / la app cerrada si está
// instalada (Service Worker persistente). En iPhone es obligatorio para que
// el push funcione del todo; en Android/desktop es mejora, pero acá se exige
// igual en mobile para no depender de que cada quien lo haga por su cuenta.
export default function InstallGate({ children }) {
  const [standalone, setStandalone] = useState(isStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isMobileUA() || standalone) return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => setStandalone(true);
    const mq = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (e) => setStandalone(e.matches);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    mq.addEventListener('change', onDisplayModeChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener('change', onDisplayModeChange);
    };
  }, [standalone]);

  if (!isMobileUA() || standalone) return children;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstalling(false);
    if (outcome === 'accepted') setStandalone(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl shadow-xl max-w-md w-full border border-zinc-300 dark:border-zinc-800 text-center">
        <div className="flex justify-center mb-5">
          <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
            <Download className="w-10 h-10 text-red-600 dark:text-red-500" />
          </div>
        </div>
        <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Instala la app para continuar</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
          En el teléfono, las notificaciones de nuevas órdenes y cambios de estado solo llegan con la app instalada en la pantalla de inicio — así funcionan con la pantalla bloqueada.
        </p>

        {isIos() ? (
          <div className="text-left bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="flex items-center gap-2"><Share className="w-4 h-4 text-red-600 shrink-0" /> 1. Toca el botón <strong>Compartir</strong> de Safari.</p>
            <p className="flex items-center gap-2"><SquarePlus className="w-4 h-4 text-red-600 shrink-0" /> 2. Elige <strong>"Agregar a inicio"</strong>.</p>
            <p>3. Abre la app desde el ícono nuevo, no desde Safari.</p>
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className={`w-full text-white font-bold py-3 rounded-xl shadow-md transition-colors ${installing ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {installing ? 'Instalando...' : 'Instalar app'}
          </button>
        ) : (
          <div className="text-left bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-sm text-zinc-700 dark:text-zinc-300">
            Abre el menú del navegador y elige <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.
          </div>
        )}

        <button
          onClick={() => setStandalone(isStandalone())}
          className="mt-4 text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
        >
          Ya la instalé, continuar
        </button>
      </div>
    </div>
  );
}
