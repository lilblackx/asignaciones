import { RefreshCw, UserRound } from 'lucide-react';
import Boton from '../Boton';
import { PERIODOS } from '../../utils/periodoReporte';
import SelectMenu from '../SelectMenu';
import MenuExportar from '../modals/reports/MenuExportar';
import { SELECTOR } from './estilos';
import BarraFiltros from '../BarraFiltros';

// Los filtros de Finanzas (diseño común en BarraFiltros): periodo, técnico y, en pantallas angostas, Actualizar y Exportar.
// Periodo y técnico valen para las tres secciones.
export default function BarraFinanzas({ periodo, onPeriodo, conPorPagar = false, personalizado, onPersonalizado, hoy, tecnico, onTecnico, tecnicos, cargando, onRecargar, formatosExportar, gruposExportar, onExportar, exportando }) {
  return (
    <BarraFiltros
      periodos={conPorPagar ? [['POR_PAGAR', 'Por pagar'], ...PERIODOS] : PERIODOS}
      periodo={periodo}
      onPeriodo={onPeriodo}
      rango={{ desde: personalizado.desde, hasta: personalizado.hasta, onDesde: (v) => onPersonalizado({ ...personalizado, desde: v }), onHasta: (v) => onPersonalizado({ ...personalizado, hasta: v }), maximo: hoy, grande: true }}
      selector={<SelectMenu id="finanzas-tecnico" ariaLabel="Técnico" icon={UserRound} className={SELECTOR} value={tecnico} onChange={onTecnico} items={[{ value: '', label: 'Todos los técnicos' }, ...tecnicos.map((t) => ({ value: t, label: t }))]} />}
      acciones={(
        // En PC Actualizar y Exportar están en el encabezado (ver FinanzasApp); aquí quedan en pantallas angostas.
        <div className="flex items-center gap-2 lg:hidden">
          <Boton icono={RefreshCw} girando={cargando} onClick={onRecargar} disabled={cargando} aria-label="Actualizar" title="Actualizar" className="whitespace-nowrap max-sm:!px-0 max-sm:w-11">
            <span className="max-sm:hidden">{cargando ? 'Actualizando...' : 'Actualizar'}</span>
          </Boton>
          <MenuExportar formatos={formatosExportar} grupos={gruposExportar} onElegir={onExportar} ocupado={exportando} alinear="derecha" soloIconoEnMovil />
        </div>
      )}
    />
  );
}
