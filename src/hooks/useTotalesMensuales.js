import { useCallback, useEffect, useRef, useState } from 'react';
import { collection } from 'firebase/firestore';
import { getDocs } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { lecturaVigente } from '../utils/lecturaVigente';

const SIN_LEER = { version: -1, contadores: {}, error: false };

// Los totales de todos los meses (estadisticasMensuales: un documento por mes, "2026-10"), para la tendencia mensual. Son pocos documentos
// (uno por mes), así que se leen todos al abrir el reporte y cada vez que se pide actualizar.
export function useTotalesMensuales(firebaseUser, activo) {
  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState(SIN_LEER);
  // Última lectura buena: si sigue vigente (15 min) no se vuelve a leer al reabrir el reporte; `recargar` sube la versión y la fuerza.
  const leida = useRef({ uid: '', version: -1, en: 0 });

  useEffect(() => {
    if (!activo || !firebaseUser) return undefined;
    if (leida.current.uid === firebaseUser.uid && leida.current.version === version && lecturaVigente(leida.current.en)) return undefined;
    let vigente = true;
    getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'estadisticasMensuales'))
      .then((snap) => {
        if (vigente) leida.current = { uid: firebaseUser.uid, version, en: Date.now() };
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
