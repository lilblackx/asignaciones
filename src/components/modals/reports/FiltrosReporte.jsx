import { RefreshCw } from 'lucide-react';
import { PERIODOS } from '../../../utils/periodoReporte';
import MenuExportar from './MenuExportar';
import CampoFecha from '../../CampoFecha';

const inputClase = 'bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 rounded-lg text-xs text-zinc-900 dark:text-white outline-none focus:border-red-600 [color-scheme:light] dark:[color-scheme:dark]';

// La barra de arriba, igual para todos los reportes: periodo, técnico y, a la derecha, actualizar y exportar si el reporte los tiene.
export default function FiltrosReporte({ soloAcciones = false, periodo, onPeriodo, personalizado, onPersonalizado, hoy, tecnico, onTecnico, tecnicos, cargando, onRecargar, formatosExportar = [], onExportar, exportando = null }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0 py-3 mb-4 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-end gap-x-4 gap-y-3">
      {!soloAcciones && <div role="group" aria-label="Periodo" className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
        {PERIODOS.map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            aria-pressed={periodo === id}
            onClick={() => onPeriodo(id)}
            className={`px-3 py-1.5 text-xs font-bold transition-colors ${periodo === id ? 'bg-red-600 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>}

      {!soloAcciones && periodo === 'RANGO' && (
        <>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-zinc-500">
            Desde
            <CampoFecha ariaLabel="Desde" valor={personalizado.desde} max={personalizado.hasta} onChange={(v) => v && onPersonalizado({ ...personalizado, desde: v })} flotante clase={inputClase} ancho="w-36" />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-zinc-500">
            Hasta
            <CampoFecha ariaLabel="Hasta" valor={personalizado.hasta} min={personalizado.desde} max={hoy} onChange={(v) => v && onPersonalizado({ ...personalizado, hasta: v })} flotante clase={inputClase} ancho="w-36" />
          </label>
        </>
      )}

      {!soloAcciones && (
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase text-zinc-500">
          Técnico
          <select value={tecnico} onChange={(e) => onTecnico(e.target.value)} className={inputClase}>
            <option value="">Todos</option>
            {tecnicos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      <div className="flex gap-2 ml-auto">
        {onRecargar && (
          <button onClick={onRecargar} disabled={cargando} aria-label="Actualizar" title="Actualizar" className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        )}
        {formatosExportar.length > 0 && <MenuExportar formatos={formatosExportar} onElegir={onExportar} ocupado={exportando} />}
      </div>
    </div>
  );
}
