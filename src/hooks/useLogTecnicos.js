import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { getDocs } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { ANTERIORES_AL_INICIO, lecturaSirve, primerDiaDeLectura } from '../utils/logTecnico';
import { diaDe } from '../utils/totalesMes';
import { useVentanaLectura } from './useVentanaLectura';

// Tope de seguridad de los movimientos de la ventana leída: a un ritmo normal no se alcanza.
const MAX_EVENTOS = 3000;

const SIN_LEER = { version: -1, eventos: [], error: false, truncado: false, desdeDia: '' };

// Registro de activación de técnicos (technicianLog), leído al abrir el reporte y cada vez que se pide actualizar. No se lee todo el historial (solo crece, y cada apertura costaría una lectura por
// movimiento): se lee desde el primer día que pide Reportes (`desdePedido`, "AAAA-MM-DD": el inicio del periodo elegido) más los movimientos justo anteriores, para saber cómo empezaba cada técnico. Con "7 días"
// son unas 80 lecturas en vez de unas 500. La ventana solo crece mientras Reportes está abierto (si se elige un periodo más largo se vuelve a leer, desde más atrás), nunca más atrás de lo que fija
// primerDiaDeLectura, y se olvida al cerrarlo. Sin `desdePedido` todavía no se lee nada.
// `desdeDia`: el primer día leído completo ("AAAA-MM-DD"); un rango que empieza antes no está completo.
export function useLogTecnicos(firebaseUser, activo, desdePedido = null) {
  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState(SIN_LEER);
  // Última lectura buena (de qué usuario, qué versión, cuándo y desde qué día): si sigue vigente (15 min) y cubre lo pedido no se vuelve a leer al reabrir el reporte; `recargar` sube la versión y la fuerza.
  const leida = useRef({ uid: '', version: -1, en: 0, desdeDia: '' });
  const pide = Boolean(activo && firebaseUser && desdePedido);
  const ventana = useVentanaLectura({ desde: pide ? primerDiaDeLectura(desdePedido) : '', hasta: '' }, pide);
  const desdeDia = ventana?.desde || '';

  useEffect(() => {
    if (!desdeDia || !firebaseUser) return undefined;
    if (lecturaSirve(leida.current, { uid: firebaseUser.uid, version, desdeDia })) return undefined;
    let vigente = true;
    const bitacora = collection(db, 'artifacts', appId, 'public', 'data', 'technicianLog');
    const desde = Date.parse(`${desdeDia}T00:00:00-04:00`);
    Promise.all([
      getDocs(query(bitacora, where('en', '>=', desde), orderBy('en', 'desc'), limit(MAX_EVENTOS))),
      getDocs(query(bitacora, where('en', '<', desde), orderBy('en', 'desc'), limit(ANTERIORES_AL_INICIO))),
    ])
      .then(([recientes, anteriores]) => {
        if (vigente) leida.current = { uid: firebaseUser.uid, version, en: Date.now(), desdeDia };
        if (vigente) setLectura({ version, eventos: [...recientes.docs, ...anteriores.docs].map((d) => ({ id: d.id, ...d.data() })), error: false, truncado: recientes.docs.length === MAX_EVENTOS, desdeDia: diaDe(desde) });
      })
      .catch((e) => {
        console.error('No se pudo cargar el registro de técnicos:', e);
        if (vigente) setLectura({ ...SIN_LEER, version, error: true });
      });
    return () => { vigente = false; };
  }, [firebaseUser, desdeDia, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  // Cargando: falta la lectura de esta versión o la que hay no llega tan atrás como lo pedido (y no falló).
  const cubierta = Boolean(lectura.desdeDia) && (!desdeDia || lectura.desdeDia <= desdeDia);
  const cargando = Boolean(activo && firebaseUser) && (lectura.version !== version || (!lectura.error && !cubierta));

  return { eventos: lectura.eventos, cargando, error: lectura.error, truncado: lectura.truncado, desdeDia: lectura.desdeDia, recargar };
}
