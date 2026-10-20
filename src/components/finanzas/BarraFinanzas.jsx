import { RefreshCw, UserRound } from 'lucide-react';
import { PERIODOS } from '../../utils/periodoReporte';
import SelectMenu from '../SelectMenu';
import MenuExportar from '../modals/reports/MenuExportar';

// La barra de filtros de Finanzas, con los mismos elementos de la pantalla de ventas y la oficina: chips con borde para el periodo, el desplegable propio
// de la app para el técnico y botones de borde grueso. Periodo y técnico valen para las tres secciones.
const ETIQUETA = 'text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';
// El desplegable del técnico, de la misma altura y trazo que los chips del periodo.
const SELECTOR = 'w-full h-10 bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg pl-3 pr-9 text-xs font-bold text-zinc-700 dark:text-zinc-200 focus:ring-0 outline-none transition-colors aria-expanded:border-red-600';
const FECHA = 'bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 h-10 px-2.5 rounded-lg text-xs text-zinc-900 dark:text-white outline-none focus:border-red-600 [color-scheme:light] dark:[color-scheme:dark]';

export default function BarraFinanzas({ periodo, onPeriodo, personalizado, onPersonalizado, hoy, tecnico, onTecnico, tecnicos, cargando, onRecargar, formatosExportar, onExportar, exportando }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <div role="group" aria-label="Periodo" className="flex flex-wrap gap-1.5">
        {PERIODOS.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-pressed={periodo === id}
            onClick={() => onPeriodo(id)}
            className={`h-10 px-3 rounded-lg text-xs font-bold border-2 transition-colors ${periodo === id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {periodo === 'RANGO' && (
        <>
          <label className="flex items-center gap-1.5">
            <span className={ETIQUETA}>Desde</span>
            <input type="date" value={personalizado.desde} max={personalizado.hasta} onChange={(e) => e.target.value && onPersonalizado({ ...personalizado, desde: e.target.value })} className={FECHA} />
          </label>
          <label className="flex items-center gap-1.5">
            <span className={ETIQUETA}>Hasta</span>
            <input type="date" value={personalizado.hasta} min={personalizado.desde} max={hoy} onChange={(e) => e.target.value && onPersonalizado({ ...personalizado, hasta: e.target.value })} className={FECHA} />
          </label>
        </>
      )}

      <div className="w-52 min-w-0">
        <SelectMenu id="finanzas-tecnico" ariaLabel="Técnico" icon={UserRound} className={SELECTOR} value={tecnico} onChange={onTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos.map((t) => ({ value: t, label: t }))]} />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRecargar}
          disabled={cargando}
          aria-label="Actualizar"
          title="Actualizar"
          className="h-10 px-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:border-red-600 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
        <MenuExportar formatos={formatosExportar} onElegir={onExportar} ocupado={exportando} alinear="izquierda" extra="h-10 border-2 border-red-600 hover:border-red-700" />
      </div>
    </div>
  );
}
