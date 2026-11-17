import Chip from './Chip';
import RangoFechas from './RangoFechas';

// La barra de filtros de los módulos con periodo (Revisión, Finanzas, Reportes...). Un solo diseño para todos:
//  - PC: periodos, rango (si se elige), selector y acciones en una fila que se envuelve.
//  - Celular: los periodos en UNA fila que se desliza, y debajo el selector con las acciones al lado (botones de ícono), para ocupar dos filas en vez de cuatro.
//   periodos: [[id, texto], ...]. periodo / onPeriodo: el elegido y cómo cambiarlo.
//   rango: { desde, hasta, onDesde, onHasta, maximo, grande } - se muestra cuando el periodo es 'RANGO'.
//   selector: el desplegable (por ejemplo el de técnico). acciones: botones que van junto al selector (en celular, de solo ícono).
//   accionesALaDerecha: en PC las acciones se pegan al borde derecho de la barra.
//   sinPeriodos: oculta periodos y rango (una vista que solo tiene acciones).
export default function BarraFiltros({ periodos = [], periodo, onPeriodo, rango, selector, acciones, accionesALaDerecha = false, sinPeriodos = false, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2.5 ${className}`}>
      {!sinPeriodos && (
        <div role="group" aria-label="Periodo" className="flex gap-2 max-sm:basis-full max-sm:min-w-0 max-sm:overflow-x-auto max-sm:pb-1 max-sm:[&>*]:shrink-0">
          {periodos.map(([id, texto]) => (
            <Chip activo={periodo === id} tamano="angosto" key={id} type="button" onClick={() => onPeriodo(id)}>{texto}</Chip>
          ))}
        </div>
      )}

      {!sinPeriodos && periodo === 'RANGO' && rango && (
        <RangoFechas desde={rango.desde} hasta={rango.hasta} onDesde={rango.onDesde} onHasta={rango.onHasta} maximo={rango.maximo} grande={rango.grande} />
      )}

      {(selector || acciones) && (
        <div className="max-sm:flex max-sm:basis-full max-sm:min-w-0 max-sm:items-center max-sm:gap-2 sm:contents">
          {selector && <div className="max-sm:flex-1 sm:w-60 min-w-0">{selector}</div>}
          {acciones && <div className={`flex items-center gap-2 ${accionesALaDerecha ? 'sm:ml-auto' : ''}`}>{acciones}</div>}
        </div>
      )}
    </div>
  );
}
