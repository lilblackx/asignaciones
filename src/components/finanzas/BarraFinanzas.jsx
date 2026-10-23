import { RefreshCw, UserRound } from 'lucide-react';
import Boton from '../Boton';
import { PERIODOS } from '../../utils/periodoReporte';
import SelectMenu from '../SelectMenu';
import MenuExportar from '../modals/reports/MenuExportar';
import { SELECTOR } from './estilos';
import Chip from '../Chip';
import RangoFechas from '../RangoFechas';

// Los filtros de Finanzas, con letra grande y controles de 48 px: chips con borde para el periodo, el desplegable propio de la app para el técnico y botones de borde grueso.
// Periodo y técnico valen para las tres secciones.
export default function BarraFinanzas({ periodo, onPeriodo, personalizado, onPersonalizado, hoy, tecnico, onTecnico, tecnicos, cargando, onRecargar, formatosExportar, onExportar, exportando }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <div role="group" aria-label="Periodo" className="grid grid-cols-4 gap-2 w-full sm:flex sm:w-auto">
        {PERIODOS.map(([id, texto]) => (
          <Chip activo={periodo === id} tamano="angosto" key={id} type="button" onClick={() => onPeriodo(id)}>
            {texto}
          </Chip>
        ))}
      </div>

      {periodo === 'RANGO' && (
        <RangoFechas desde={personalizado.desde} hasta={personalizado.hasta} onDesde={(v) => onPersonalizado({ ...personalizado, desde: v })} onHasta={(v) => onPersonalizado({ ...personalizado, hasta: v })} maximo={hoy} grande />
      )}

      <div className="w-full sm:w-60 min-w-0">
        <SelectMenu id="finanzas-tecnico" ariaLabel="Técnico" icon={UserRound} className={SELECTOR} value={tecnico} onChange={onTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos.map((t) => ({ value: t, label: t }))]} />
      </div>

      {/* En PC Actualizar y Exportar están en el encabezado (ver FinanzasApp); aquí quedan en pantallas angostas. */}
      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <Boton icono={RefreshCw} girando={cargando} onClick={onRecargar} disabled={cargando} className="whitespace-nowrap">
          {cargando ? 'Actualizando...' : 'Actualizar'}
        </Boton>
        <MenuExportar formatos={formatosExportar} onElegir={onExportar} ocupado={exportando} alinear="izquierda" />
      </div>
    </div>
  );
}
