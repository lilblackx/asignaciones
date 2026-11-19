import { RefreshCw, UserRound } from 'lucide-react';
import { PERIODOS } from '../../../utils/periodoReporte';
import MenuExportar from './MenuExportar';
import Boton from '../../Boton';
import SelectMenu from '../../SelectMenu';
import { SELECTOR } from '../../estilos';
import BarraFiltros from '../../BarraFiltros';

// La barra de arriba, igual para todos los reportes (diseño común en BarraFiltros): periodo, técnico y, a la derecha, actualizar y exportar si el reporte los tiene.
export default function FiltrosReporte({ soloAcciones = false, periodo, onPeriodo, personalizado, onPersonalizado, hoy, tecnico, onTecnico, tecnicos, cargando, onRecargar, formatosExportar = [], onExportar, exportando = null }) {
  return (
    <div className="sticky [@media(max-height:600px)]:static top-0 z-10 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-0 py-3 mb-4 bg-background border-b border-border">
      <BarraFiltros
        sinPeriodos={soloAcciones}
        periodos={PERIODOS}
        periodo={periodo}
        onPeriodo={onPeriodo}
        rango={{ desde: personalizado.desde, hasta: personalizado.hasta, onDesde: (v) => onPersonalizado({ ...personalizado, desde: v }), onHasta: (v) => onPersonalizado({ ...personalizado, hasta: v }), maximo: hoy }}
        selector={soloAcciones ? null : <SelectMenu id="reporte-tecnico" ariaLabel="Técnico" icon={UserRound} className={SELECTOR} value={tecnico} onChange={onTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos.map((t) => ({ value: t, label: t }))]} />}
        accionesALaDerecha
        acciones={(
          <>
            {onRecargar && (
              <Boton variante="secundario" tamano="normal" icono={RefreshCw} girando={cargando} className="w-9 !px-0" onClick={onRecargar} disabled={cargando} aria-label="Actualizar" title="Actualizar" />
            )}
            {formatosExportar.length > 0 && <MenuExportar formatos={formatosExportar} onElegir={onExportar} ocupado={exportando} soloIconoEnMovil />}
          </>
        )}
      />
    </div>
  );
}
