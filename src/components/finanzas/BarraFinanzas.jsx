import { RefreshCw, UserRound } from 'lucide-react';
import { PERIODOS } from '../../utils/periodoReporte';
import SelectMenu from '../SelectMenu';
import CampoFecha from '../CampoFecha';
import MenuExportar from '../modals/reports/MenuExportar';
import { CAMPO_FECHA, ETIQUETA, SELECTOR } from './estilos';

// Los filtros de Finanzas, con letra grande y controles de 48 px: chips con borde para el periodo, el desplegable propio de la app para el técnico y botones de borde grueso.
// Periodo y técnico valen para las tres secciones.
export default function BarraFinanzas({ periodo, onPeriodo, personalizado, onPersonalizado, hoy, tecnico, onTecnico, tecnicos, cargando, onRecargar, formatosExportar, onExportar, exportando }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <div role="group" aria-label="Periodo" className="grid grid-cols-4 gap-2 w-full sm:flex sm:w-auto">
        {PERIODOS.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            aria-pressed={periodo === id}
            onClick={() => onPeriodo(id)}
            className={`h-9 px-1 sm:px-4 whitespace-nowrap rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${periodo === id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-400 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {periodo === 'RANGO' && (
        <>
          <div className="flex items-center gap-2">
            <span className={ETIQUETA}>Desde</span>
            <CampoFecha ariaLabel="Desde" valor={personalizado.desde} max={personalizado.hasta} onChange={(v) => v && onPersonalizado({ ...personalizado, desde: v })} flotante grande clase={CAMPO_FECHA} ancho="w-48" />
          </div>
          <div className="flex items-center gap-2">
            <span className={ETIQUETA}>Hasta</span>
            <CampoFecha ariaLabel="Hasta" valor={personalizado.hasta} min={personalizado.desde} max={hoy} onChange={(v) => v && onPersonalizado({ ...personalizado, hasta: v })} flotante grande clase={CAMPO_FECHA} ancho="w-48" />
          </div>
        </>
      )}

      <div className="w-full sm:w-60 min-w-0">
        <SelectMenu id="finanzas-tecnico" ariaLabel="Técnico" icon={UserRound} className={SELECTOR} value={tecnico} onChange={onTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos.map((t) => ({ value: t, label: t }))]} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRecargar}
          disabled={cargando}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:border-red-600 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" /> {cargando ? 'Actualizando...' : 'Actualizar'}
        </button>
        <MenuExportar formatos={formatosExportar} onElegir={onExportar} ocupado={exportando} alinear="izquierda" extra="h-9! px-4! text-sm!" />
      </div>
    </div>
  );
}
