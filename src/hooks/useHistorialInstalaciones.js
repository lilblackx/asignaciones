import { useEffect, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { RETENCION_MS_HISTORIAL, RETENCION_MS_HISTORIAL_VENTAS } from '../utils/estadoInstalacion';

// Mientras la copia guardada en el equipo sea más nueva que esto no se vuelve a leer de Firestore: el historial solo
// cambia cuando se cierra el día, y abrir la app varias veces seguidas no debe costar lecturas cada vez.
export const VIGENCIA_COPIA_MS = 30 * 60 * 1000;
// El número cambia cuando se corrigen datos ya guardados (relleno de plantillas): descarta las copias anteriores.
const CLAVE_COPIA = 'asignaciones:historialInstalaciones:v2:';

// La copia guardada en el equipo, vencida o no (`soloVigente` false): la vencida sirve de base para leer solo lo nuevo.
function copiaGuardada(llave, soloVigente = true) {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_COPIA + llave));
    return c && (!soloVigente || Date.now() - c.t < VIGENCIA_COPIA_MS) && Array.isArray(c.lista) ? c : null;
  } catch {
    return null;
  }
}

// Solo las de esta promotora (una consulta por nombre, como lo exigen las reglas). Lo vencido se descarta aquí: el
// cierre del día lo borra, pero puede quedar hasta entonces.
// Ventas (claves null) ve todo el historial, que son cientos de documentos: no se vuelve a leer completo cada vez que vence la copia.
// Un resumen archivado no cambia (solo lo nuevo se agrega al cerrar el día), así que se pide lo archivado desde la última
// lectura (con `>=`, por si el cierre aún estaba escribiendo el último lote) y se suma a lo que ya se tenía.
async function leerHistorial(claves, llave) {
  const ref = collection(db, 'artifacts', appId, 'public', 'data', 'historialInstalaciones');
  // Ventas (claves null: todo el historial) ve 15 días; una promotora, 7. Lo anterior se guarda pero no se muestra.
  const desde = Date.now() - (claves === null ? RETENCION_MS_HISTORIAL_VENTAS : RETENCION_MS_HISTORIAL);
  const previa = claves === null ? copiaGuardada(llave, false) : null;
  const lecturaDesde = previa ? Math.max(desde, previa.hasta || 0) : desde;
  const grupos = await Promise.all((claves ?? [null]).map((c) => getDocs(c === null ? query(ref, where('archivadoEn', '>=', lecturaDesde)) : query(ref, where('promotoraClave', '==', c)))));
  const porId = new Map((previa?.lista || []).map((h) => [h.id, h]));
  for (const snap of grupos) for (const d of snap.docs) porId.set(d.id, { id: d.id, ...d.data() });
  const lista = [...porId.values()].filter((h) => (h.archivadoEn || 0) >= desde);
  const hasta = lista.reduce((m, h) => Math.max(m, h.archivadoEn || 0), 0);
  try { localStorage.setItem(CLAVE_COPIA + llave, JSON.stringify({ t: Date.now(), hasta, lista })); } catch { /* sin almacenamiento: solo se pierde el ahorro */ }
  return lista;
}

// Instalaciones ya cerradas (finalizadas o canceladas) de los últimos días, de esta promotora. El cierre del día las saca
// de la lista de órdenes; aquí queda un resumen liviano (historialInstalaciones) para que vea cómo terminaron. Se lee
// una vez, sin listener (un listener costaría una lectura por cada cambio y estos documentos casi no cambian), y
// se guarda una copia en el equipo por unos minutos.
export function useHistorialInstalaciones(firebaseUser, claves, verTodas = false) {
  const llave = verTodas ? '*' : claves.join('|');
  const [historial, setHistorial] = useState(() => copiaGuardada(llave)?.lista || []);
  const ultima = useRef(copiaGuardada(llave)?.t || 0);

  // Al abrir: si hay una copia reciente se usa; si no, se lee.
  useEffect(() => {
    if (!firebaseUser || !llave || ultima.current) return;
    let cancelado = false;
    leerHistorial(llave === '*' ? null : llave.split('|'), llave)
      .then((lista) => { if (!cancelado) { setHistorial(lista); ultima.current = Date.now(); } })
      .catch((err) => console.error('No se pudo cargar el historial de instalaciones:', err));
    return () => { cancelado = true; };
  }, [firebaseUser, llave]);

  // Al volver a la pestaña después de un rato.
  useEffect(() => {
    if (!firebaseUser || !llave) return;
    const alVolver = () => {
      if (document.visibilityState !== 'visible' || !ultima.current || Date.now() - ultima.current <= VIGENCIA_COPIA_MS) return;
      leerHistorial(llave === '*' ? null : llave.split('|'), llave)
        .then((lista) => { setHistorial(lista); ultima.current = Date.now(); })
        .catch((err) => console.error('No se pudo actualizar el historial de instalaciones:', err));
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [firebaseUser, llave]);

  return historial;
}
