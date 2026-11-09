import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { getDocs } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { ANTERIORES_AL_INICIO, inicioDeLectura } from '../utils/logTecnico';
import { diaDe } from '../utils/totalesMes';
import { lecturaVigente } from '../utils/lecturaVigente';

// Tope de seguridad de los movimientos de la ventana (los últimos DIAS_DE_LECTURA días, ver utils/logTecnico.js): a un ritmo normal no se alcanza.
const MAX_EVENTOS = 3000;

const SIN_LEER = { version: -1, eventos: [], error: false, truncado: false, desdeDia: '' };

// Registro de activación de técnicos (technicianLog), leído al abrir el reporte y cada vez que se pide actualizar. No se lee todo el historial (solo crece,
// y cada apertura costaría una lectura por movimiento): los últimos días más los movimientos justo anteriores, para saber cómo empezaba cada técnico.
// `desdeDia`: el primer día leído completo ("AAAA-MM-DD"); un rango que empieza antes no está completo.
export function useLogTecnicos(firebaseUser, activo) {
  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState(SIN_LEER);
  // Última lectura buena (de qué usuario, qué versión y cuándo): si sigue vigente (15 min) no se vuelve a leer al reabrir el reporte; `recargar` sube la versión y la fuerza.
  const leida = useRef({ uid: '', version: -1, en: 0 });

  useEffect(() => {
    if (!activo || !firebaseUser) return undefined;
    if (leida.current.uid === firebaseUser.uid && leida.current.version === version && lecturaVigente(leida.current.en)) return undefined;
    let vigente = true;
    const bitacora = collection(db, 'artifacts', appId, 'public', 'data', 'technicianLog');
    const desde = inicioDeLectura();
    Promise.all([
      getDocs(query(bitacora, where('en', '>=', desde), orderBy('en', 'desc'), limit(MAX_EVENTOS))),
      getDocs(query(bitacora, where('en', '<', desde), orderBy('en', 'desc'), limit(ANTERIORES_AL_INICIO))),
    ])
      .then(([recientes, anteriores]) => {
        if (vigente) leida.current = { uid: firebaseUser.uid, version, en: Date.now() };
        if (vigente) setLectura({ version, eventos: [...recientes.docs, ...anteriores.docs].map((d) => ({ id: d.id, ...d.data() })), error: false, truncado: recientes.docs.length === MAX_EVENTOS, desdeDia: diaDe(desde) });
      })
      .catch((e) => {
        console.error('No se pudo cargar el registro de técnicos:', e);
        if (vigente) setLectura({ ...SIN_LEER, version, error: true });
      });
    return () => { vigente = false; };
  }, [firebaseUser, activo, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { eventos: lectura.eventos, cargando: Boolean(activo && firebaseUser) && lectura.version !== version, error: lectura.error, truncado: lectura.truncado, desdeDia: lectura.desdeDia, recargar };
}
