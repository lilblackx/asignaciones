import { useCallback, useEffect, useState } from 'react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { getDocs } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';

// Los movimientos más recientes que se leen para el reporte de activación: de sobra para varios meses de cambios.
const MAX_EVENTOS = 3000;

const SIN_LEER = { version: -1, eventos: [], error: false, truncado: false };

// Registro de activación de técnicos (technicianLog), leído al abrir el reporte y cada vez que se pide actualizar.
export function useLogTecnicos(firebaseUser, activo) {
  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState(SIN_LEER);

  useEffect(() => {
    if (!activo || !firebaseUser) return undefined;
    let vigente = true;
    getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'technicianLog'), orderBy('en', 'desc'), limit(MAX_EVENTOS)))
      .then((snap) => {
        if (vigente) setLectura({ version, eventos: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: false, truncado: snap.docs.length === MAX_EVENTOS });
      })
      .catch((e) => {
        console.error('No se pudo cargar el registro de técnicos:', e);
        if (vigente) setLectura({ ...SIN_LEER, version, error: true });
      });
    return () => { vigente = false; };
  }, [firebaseUser, activo, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { eventos: lectura.eventos, cargando: Boolean(activo && firebaseUser) && lectura.version !== version, error: lectura.error, truncado: lectura.truncado, recargar };
}
