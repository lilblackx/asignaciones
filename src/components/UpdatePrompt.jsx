import { useState, useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import { aplicarActualizacion, hayActualizacion, suscribirActualizacion } from '../lib/updateAvailable';

export default function UpdatePrompt() {
  const disponible = useSyncExternalStore(suscribirActualizacion, hayActualizacion);
  const [aplicando, setAplicando] = useState(false);

  if (!disponible) return null;

  const handleClick = () => {
    setAplicando(true);
    aplicarActualizacion();
  };

  return (
    <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm flex items-center gap-3 bg-black text-white border border-red-600/60 rounded-xl shadow-2xl px-4 py-3">
      <RefreshCw className="w-5 h-5 shrink-0 text-red-500" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">Actualización disponible</p>
        <p className="text-[11px] text-zinc-400 leading-tight">Recarga para ver los últimos cambios.</p>
      </div>
      <button type="button" onClick={handleClick} disabled={aplicando} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-xs font-bold transition-colors">
        {aplicando ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
  );
}
