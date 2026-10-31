import { useCallback, useEffect, useState } from 'react';
import { collection } from 'firebase/firestore';
import { getDocs } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';

const SIN_LEER = { version: -1, contadores: {}, error: false };

// Los totales de todos los meses (estadisticasMensuales: un documento por mes, "2026-10"), para la tendencia mensual. Son pocos documentos
// (uno por mes), así que se leen todos al abrir el reporte y cada vez que se pide actualizar.
export function useTotalesMensuales(firebaseUser, activo) {
  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState(SIN_LEER);

  useEffect(() => {
    if (!activo || !firebaseUser) return undefined;
    let vigente = true;
    getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'estadisticasMensuales'))
      .then((snap) => {
        if (vigente) setLectura({ version, contadores: Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])), error: false });
      })
      .catch((e) => {
        console.error('No se pudieron cargar los totales mensuales:', e);
        if (vigente) setLectura({ ...SIN_LEER, version, error: true });
      });
    return () => { vigente = false; };
  }, [firebaseUser, activo, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { contadores: lectura.contadores, cargando: Boolean(activo && firebaseUser) && lectura.version !== version, error: lectura.error, recargar };
}
