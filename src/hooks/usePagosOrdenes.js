import { useCallback, useEffect, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { getDocs } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';

const coleccion = () => collection(db, 'artifacts', appId, 'public', 'data', 'pagosOrdenes');

// Finanzas: el historial de los pagos que los técnicos registraron (antes de que el cobro pasara a Administración) de instalaciones y de cambios de equipo, creados en el rango (días de Caracas
// "AAAA-MM-DD"). Se lee al abrir, al cambiar el rango y con "recargar" (sin listener, como el resto de sus datos). Son tres consultas porque las reglas solo dejan leer lo que se pide con esos valores
// exactos (tipoTrabajo de instalación o de cambio de equipo, o el tipo de visita CAMBIO_EQUIPO); piden los índices (tipoTrabajo + creadoEn) y (tipoVisita + creadoEn) de pagosOrdenes.
export function usePagosFinanzas(firebaseUser, rango) {
  const [estado, setEstado] = useState({ clave: '', pagos: [], error: false });
  const [version, setVersion] = useState(0);
  const desde = Date.parse(`${rango.desde}T00:00:00-04:00`);
  const hasta = Date.parse(`${rango.hasta}T23:59:59.999-04:00`);
  const clave = `${desde}|${hasta}|${version}`;

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
  return { pagos: estado.pagos, cargado: estado.clave === clave, error: estado.error, recargar };
}
