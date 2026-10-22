import { RefreshCw, UserRound } from 'lucide-react';
import { PERIODOS } from '../../../utils/periodoReporte';
import MenuExportar from './MenuExportar';
import Chip from '../../Chip';
import Boton from '../../Boton';
import SelectMenu from '../../SelectMenu';
import { SELECTOR } from '../../estilos';
import RangoFechas from '../../RangoFechas';

// La barra de arriba, igual para todos los reportes: periodo, técnico y, a la derecha, actualizar y exportar si el reporte los tiene.
export default function FiltrosReporte({ soloAcciones = false, periodo, onPeriodo, personalizado, onPersonalizado, hoy, tecnico, onTecnico, tecnicos, cargando, onRecargar, formatosExportar = [], onExportar, exportando = null }) {
  return (
    <div className="sticky [@media(max-height:600px)]:static top-0 z-10 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0 py-3 mb-4 bg-zinc-200 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-end gap-x-4 gap-y-3">
      {!soloAcciones && <div role="group" aria-label="Periodo" className="grid grid-cols-4 gap-2 w-full sm:flex sm:w-auto">
        {PERIODOS.map(([id, etiqueta]) => (
          <Chip activo={periodo === id} tamano="angosto" key={id} type="button" onClick={() => onPeriodo(id)}>
            {etiqueta}
          </Chip>
        ))}
      </div>}

      {!soloAcciones && periodo === 'RANGO' && (
        <RangoFechas desde={personalizado.desde} hasta={personalizado.hasta} onDesde={(v) => onPersonalizado({ ...personalizado, desde: v })} onHasta={(v) => onPersonalizado({ ...personalizado, hasta: v })} maximo={hoy} />
      )}

      {!soloAcciones && (
        <div className="w-full sm:w-60 min-w-0">
          <SelectMenu id="reporte-tecnico" ariaLabel="Técnico" icon={UserRound} className={SELECTOR} value={tecnico} onChange={onTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos.map((t) => ({ value: t, label: t }))]} />
        </div>
      )}

      <div className="flex gap-2 ml-auto">
        {onRecargar && (
          <Boton variante="secundario" tamano="normal" icono={RefreshCw} girando={cargando} className="w-9 !px-0" onClick={onRecargar} disabled={cargando} aria-label="Actualizar" title="Actualizar">
          </Boton>
        )}
        {formatosExportar.length > 0 && <MenuExportar formatos={formatosExportar} onElegir={onExportar} ocupado={exportando} />}
      </div>
    </div>
  );
}
