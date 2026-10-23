import { CircleDollarSign, RefreshCw } from 'lucide-react';
import { fechaHoraLegible } from '../../utils/formatoFecha';

// La tasa BCV del dólar con que se muestran los bolívares, y cuándo la actualizó el BCV. Sin conexión a la API avisa, y si ya tenía una tasa la conserva.
export default function TasaBcv({ tasa, fecha, cargando, error, onActualizar }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-2 font-bold text-zinc-800 dark:text-zinc-100">
        <CircleDollarSign className="w-5 h-5 text-red-600" aria-hidden="true" />
        {tasa ? (
          <>Tasa BCV: <span className="tabular-nums text-sm font-bold text-zinc-900 dark:text-white">{tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> Bs por dólar</>
        ) : cargando ? 'Consultando la tasa BCV...' : 'Sin tasa BCV'}
      </span>
      {tasa && fecha && <span className="text-zinc-600 dark:text-zinc-300">actualizada {fechaHoraLegible(fecha)}</span>}
      {error && <span role="alert" className="font-bold text-amber-800 dark:text-amber-300">{tasa ? 'No se pudo actualizar la tasa.' : 'No se pudo consultar la tasa: los bolívares no se muestran.'}</span>}
      <button type="button" onClick={onActualizar} disabled={cargando} aria-label="Actualizar la tasa BCV" title="Actualizar la tasa BCV" className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-red-600 disabled:opacity-50 transition-colors">
        <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}
