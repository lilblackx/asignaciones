import { useEffect, useRef } from 'react';

const MAX_PAGINAS_SEGUIDAS = 12;

// ¿Los reportes cargados llegan hasta el primer día de la ventana? Las órdenes de ese día están en el reporte de ese día o en uno posterior, así que basta con que
// el reporte cargado más antiguo sea de ese día o anterior. Sin reportes cargados no hay nada que comparar (false: se sigue cargando solo si el servidor tiene más).
export function ventanaCubierta(reportes, desdeDia) {
  if (!desdeDia) return true;
  const inicio = Date.parse(`${desdeDia}T00:00:00-04:00`);
  const masViejo = (reportes || []).reduce((m, r) => Math.min(m, Number(r.createdAt) || Infinity), Infinity);
  return masViejo <= inicio;
}

// Los reportes se cargan de 30 en 30 (los cierres más recientes). Con "Por pagar" y "Por revisar" (los últimos 35 días) pueden no alcanzar: una orden de hace tres semanas
// no saldría hasta pulsar "cargar más", y una orden sin revisar o sin pagar se podría quedar olvidada. Este hook carga páginas anteriores, de una en una, hasta cubrir el
// primer día de la ventana (o hasta que no haya más). Con un tope de páginas seguidas por si la lectura falla una y otra vez.
export function useCargarHastaCubrir({ activo, reportes, hayMas, cargando, onCargarMas, desdeDia }) {
  const intentos = useRef(0);
  useEffect(() => { intentos.current = 0; }, [desdeDia, activo]);
  useEffect(() => {
    if (!activo || !hayMas || cargando || !onCargarMas) return;
    if (ventanaCubierta(reportes, desdeDia) || intentos.current >= MAX_PAGINAS_SEGUIDAS) return;
    intentos.current += 1;
    onCargarMas();
  }, [activo, hayMas, cargando, onCargarMas, reportes, desdeDia]);
}
