import CampoFecha from './CampoFecha';
import { CAMPO_FECHA, ETIQUETA } from './estilos';

// El filtro "Rango" de un periodo: dos fechas, Desde y Hasta, con su etiqueta. Es el mismo en Finanzas, Revisión, Reportes e Infraestructura.
// En el celular son dos columnas con la etiqueta arriba; en pantallas anchas, la etiqueta a la izquierda de cada fecha.
//   `minimo` (opcional): la fecha más antigua que se puede elegir; `maximo`: la más nueva (por defecto, `hasta` para Desde y sin tope para Hasta).
//   `grande`: el calendario con letra grande (Finanzas y Revisión, que tienen su selector de tamaño).
export default function RangoFechas({ desde, hasta, onDesde, onHasta, minimo, maximo, grande = false }) {
  return (
    <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:items-center sm:gap-3">
      <div className="min-w-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className={ETIQUETA}>Desde</span>
        <CampoFecha ariaLabel="Desde" valor={desde} min={minimo} max={hasta} onChange={(v) => v && onDesde(v)} flotante grande={grande} clase={CAMPO_FECHA} ancho="w-full sm:w-40" />
      </div>
      <div className="min-w-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className={ETIQUETA}>Hasta</span>
        <CampoFecha ariaLabel="Hasta" valor={hasta} min={desde} max={maximo} onChange={(v) => v && onHasta(v)} flotante derecha grande={grande} clase={CAMPO_FECHA} ancho="w-full sm:w-40" />
      </div>
    </div>
  );
}
