import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { getDocs } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { useVentanaLectura } from './useVentanaLectura';

const coleccion = () => collection(db, 'artifacts', appId, 'public', 'data', 'pagosOrdenes');

// Finanzas: el historial de los pagos que los técnicos registraron (antes de que el cobro pasara a Administración) de instalaciones y de cambios de equipo, creados en el rango (días de Caracas
// "AAAA-MM-DD"). Se lee al abrir, al ampliar el rango y con "recargar" (sin listener, como el resto de sus datos). Son tres consultas porque las reglas solo dejan leer lo que se pide con esos valores
// exactos (tipoTrabajo de instalación o de cambio de equipo, o el tipo de visita CAMBIO_EQUIPO); piden los índices (tipoTrabajo + creadoEn) y (tipoVisita + creadoEn) de pagosOrdenes.
export function usePagosFinanzas(firebaseUser, rango) {
  const [estado, setEstado] = useState({ clave: '', pagos: [], error: false });
  const [version, setVersion] = useState(0);
  // Se lee de una ventana que solo crece mientras la sección está abierta (ver useVentanaLectura): pasar a un periodo más corto o volver a uno ya visto no lee nada; abajo se filtra el periodo elegido.
  const ventana = useVentanaLectura(rango, Boolean(rango.desde && rango.hasta));
  const desde = ventana ? Date.parse(`${ventana.desde}T00:00:00-04:00`) : NaN;
  const hasta = ventana ? Date.parse(`${ventana.hasta}T23:59:59.999-04:00`) : NaN;
  const clave = `${desde}|${hasta}|${version}`;
  const inicioPeriodo = Date.parse(`${rango.desde}T00:00:00-04:00`);
  const finPeriodo = Date.parse(`${rango.hasta}T23:59:59.999-04:00`);
  const pagos = useMemo(() => estado.pagos.filter((p) => Number(p.creadoEn) >= inicioPeriodo && Number(p.creadoEn) <= finPeriodo), [estado.pagos, inicioPeriodo, finPeriodo]);

  useEffect(() => {
    if (!firebaseUser || !Number.isFinite(desde) || !Number.isFinite(hasta)) return undefined;
    let vigente = true;
    const fechas = [where('creadoEn', '>=', desde), where('creadoEn', '<=', hasta)];
    Promise.all([
      getDocs(query(coleccion(), where('tipoTrabajo', '==', 'INSTALACIÓN'), ...fechas)),
      getDocs(query(coleccion(), where('tipoTrabajo', '==', 'CAMBIO DE EQUIPO'), ...fechas)),
      getDocs(query(coleccion(), where('tipoVisita', '==', 'CAMBIO_EQUIPO'), ...fechas)),
    ]).then((resultados) => {
      if (!vigente) return;
      const porId = new Map();
      for (const snap of resultados) for (const d of snap.docs) porId.set(d.id, { id: d.id, ...d.data() });
      setEstado({ clave, pagos: [...porId.values()], error: false });
    }).catch((error) => {
      console.error('No se pudieron leer los pagos de clientes:', error);
      if (vigente) setEstado({ clave, pagos: [], error: true });
    });
    return () => { vigente = false; };
  }, [firebaseUser, desde, hasta, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { pagos, cargado: estado.clave === clave, error: estado.error, recargar };
}
