import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, documentId, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { RETENCION_MS_HISTORIAL, RETENCION_MS_HISTORIAL_VENTAS } from '../utils/estadoInstalacion';

// Mientras la copia guardada en el equipo sea más nueva que esto no se vuelve a leer de Firestore: el historial solo
// cambia cuando se cierra el día, y abrir la app varias veces seguidas no debe costar lecturas cada vez.
export const VIGENCIA_COPIA_MS = 30 * 60 * 1000;
// Lo mínimo que debe pasar entre una lectura y la siguiente cuando el usuario toca "Actualizar" (la hora de la última lectura
// se guarda en el equipo, así que recargar la página tampoco la salta).
export const ESPERA_ACTUALIZAR_MS = 2 * 60 * 1000;
// Cada cuánto reintenta una actualización automática que todavía no podía hacerse (ver actualizarCuandoPueda).
const REINTENTO_AUTOMATICO_MS = 15 * 1000;
// Cuántas órdenes cerradas trae ventas por vez: las más recientes al abrir y otras tantas cada vez que pide "Cargar más". El historial de
// 30 días son cientos de documentos y cada uno es una lectura; así solo se pagan las que de verdad se miran.
export const TAMANO_PAGINA = 30;
// El número cambia cuando cambia lo que se guarda en la copia (aquí, que ventas ya no la trae completa), se corrigen datos ya guardados o
// cambian los días de historial (v4: de 15 a 30; una copia vieja no sabría que hay más días por leer).
const CLAVE_COPIA = 'asignaciones:historialInstalaciones:v4:';

// La copia guardada en el equipo, vencida o no (`soloVigente` false): la vencida sirve de base para leer solo lo nuevo.
function copiaGuardada(llave, soloVigente = true) {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_COPIA + llave));
    return c && (!soloVigente || Date.now() - c.t < VIGENCIA_COPIA_MS) && Array.isArray(c.lista) ? c : null;
  } catch {
    return null;
  }
}

function guardarCopia(llave, datos) {
  try { localStorage.setItem(CLAVE_COPIA + llave, JSON.stringify(datos)); } catch { /* sin almacenamiento: solo se pierde el ahorro */ }
}

const coleccion = () => collection(db, 'artifacts', appId, 'public', 'data', 'historialInstalaciones');
// Del más reciente al más viejo; con la misma hora de archivo (todas las de un cierre la comparten), por id: el mismo orden de Firestore.
const masRecienteAntes = (a, b) => (b.archivadoEn || 0) - (a.archivadoEn || 0) || (a.id < b.id ? 1 : -1);

// Suma lo leído a lo que ya se tenía (sin repetir), descarta lo que ya venció para esta pantalla y lo deja del más reciente al más viejo.
function unir(previas, snaps, desde) {
  const porId = new Map(previas.map((h) => [h.id, h]));
  for (const snap of snaps) for (const d of snap.docs) porId.set(d.id, { id: d.id, ...d.data() });
  return [...porId.values()].filter((h) => (h.archivadoEn || 0) >= desde).sort(masRecienteAntes);
}

const hastaDe = (lista) => lista.reduce((m, h) => Math.max(m, h.archivadoEn || 0), 0);

// { lista, hayMas }. Solo las de esta promotora (una consulta por nombre, como lo exigen las reglas). Lo vencido se descarta aquí: el
// cierre del día lo borra, pero puede quedar hasta entonces.
// Ventas (claves null) ve todo el historial, que son cientos de documentos: nunca se lee completo.
//  - Sin copia: solo la primera página (las TAMANO_PAGINA más recientes); `hayMas` dice si puede haber más viejas.
//  - Con copia (aunque esté vencida): solo lo archivado desde la última lectura, que se suma a lo que ya se tenía. Un resumen archivado
//    no cambia (solo se agrega lo nuevo al cerrar el día). Va con `>=` por si el cierre aún estaba escribiendo el último lote.
async function leerHistorial(claves, llave) {
  const ref = coleccion();
  if (claves !== null) {
    // Una promotora ve 7 días. Sin orden ni límite: combinarlos con su filtro pediría un índice nuevo, y lo suyo es poco.
    const desde = Date.now() - RETENCION_MS_HISTORIAL;
    const grupos = await Promise.all(claves.map((c) => getDocs(query(ref, where('promotoraClave', '==', c)))));
    const lista = unir([], grupos, desde);
    guardarCopia(llave, { t: Date.now(), hasta: hastaDe(lista), lista, hayMas: false });
    return { lista, hayMas: false };
  }
  const desde = Date.now() - RETENCION_MS_HISTORIAL_VENTAS;
  const previa = copiaGuardada(llave, false);
  const consulta = previa
    ? query(ref, where('archivadoEn', '>=', Math.max(desde, previa.hasta || 0)), orderBy('archivadoEn', 'desc'))
    : query(ref, where('archivadoEn', '>=', desde), orderBy('archivadoEn', 'desc'), limit(TAMANO_PAGINA));
  const snap = await getDocs(consulta);
  const lista = unir(previa?.lista || [], [snap], desde);
  const hayMas = previa ? previa.hayMas === true : snap.size === TAMANO_PAGINA;
  guardarCopia(llave, { t: Date.now(), hasta: hastaDe(lista), lista, hayMas });
  return { lista, hayMas };
}

// La página siguiente de ventas: las TAMANO_PAGINA que siguen a la más vieja que ya tiene. Se continúa desde (hora de archivo, id), no solo
// desde la hora, porque todas las de un cierre comparten la hora y una página puede cortar un cierre por la mitad.
async function leerMas(llave) {
  const previa = copiaGuardada(llave, false);
  const ultima = previa && previa.lista[previa.lista.length - 1];
  if (!ultima) return null;
  const desde = Date.now() - RETENCION_MS_HISTORIAL_VENTAS;
  const snap = await getDocs(query(coleccion(), where('archivadoEn', '>=', desde), orderBy('archivadoEn', 'desc'), orderBy(documentId(), 'desc'), startAfter(ultima.archivadoEn, ultima.id), limit(TAMANO_PAGINA)));
  const lista = unir(previa.lista, [snap], desde);
  const hayMas = snap.size === TAMANO_PAGINA;
  // Es lo más viejo, no más reciente: la hora de la última lectura (`t`) y el `hasta` no cambian.
  guardarCopia(llave, { ...previa, lista, hasta: hastaDe(lista), hayMas });
  return { lista, hayMas };
}

// Instalaciones ya cerradas (finalizadas o canceladas) de los últimos días, de esta promotora. El cierre del día las saca
// de la lista de órdenes; aquí queda un resumen liviano (historialInstalaciones) para que vea cómo terminaron. Se lee
// una vez, sin listener (un listener costaría una lectura por cada cambio y estos documentos casi no cambian), y
// se guarda una copia en el equipo por unos minutos.
// Devuelve { historial, leidoEn, actualizar, hayMas, cargarMas, cargandoMas }:
//  - `leidoEn`: cuándo se leyó por última vez (para mostrarlo).
//  - `actualizar`: fuerza una lectura de lo nuevo, pero no antes de ESPERA_ACTUALIZAR_MS desde la anterior: devuelve 'ok', 'espera'
//    (todavía no toca), 'ocupado' (ya hay una lectura en curso) o 'error'.
//  - `actualizarCuandoPueda`: lo mismo sin botón y sin respuesta; reintenta hasta lograrlo (lo usa la pantalla cuando una orden sale de la lista).
//  - `hayMas` / `cargarMas` / `cargandoMas`: solo ventas, que trae el historial por páginas (ver TAMANO_PAGINA).
export function useHistorialInstalaciones(firebaseUser, claves, verTodas = false) {
  const llave = verTodas ? '*' : claves.join('|');
  const [historial, setHistorial] = useState(() => copiaGuardada(llave)?.lista || []);
  const [hayMas, setHayMas] = useState(() => copiaGuardada(llave)?.hayMas === true);
  const [leidoEn, setLeidoEn] = useState(() => copiaGuardada(llave)?.t || 0);
  const [cargandoMas, setCargandoMas] = useState(false);
  const ultima = useRef(leidoEn);
  const leyendo = useRef(false);

  const aplicar = useCallback(({ lista, hayMas: quedan }) => {
    setHistorial(lista);
    setHayMas(quedan);
    ultima.current = Date.now();
    setLeidoEn(ultima.current);
  }, []);

  // Al abrir: si hay una copia reciente se usa; si no, se lee.
  useEffect(() => {
    if (!firebaseUser || !llave || ultima.current) return;
    let cancelado = false;
    leyendo.current = true;
    leerHistorial(llave === '*' ? null : llave.split('|'), llave)
      .then((r) => { if (!cancelado) aplicar(r); })
      .catch((err) => console.error('No se pudo cargar el historial de instalaciones:', err))
      .finally(() => { leyendo.current = false; });
    return () => { cancelado = true; };
  }, [firebaseUser, llave, aplicar]);

  // Al volver a la pestaña después de un rato.
  useEffect(() => {
    if (!firebaseUser || !llave) return;
    const alVolver = () => {
      if (document.visibilityState !== 'visible' || !ultima.current || Date.now() - ultima.current <= VIGENCIA_COPIA_MS || leyendo.current) return;
      leyendo.current = true;
      leerHistorial(llave === '*' ? null : llave.split('|'), llave)
        .then(aplicar)
        .catch((err) => console.error('No se pudo actualizar el historial de instalaciones:', err))
        .finally(() => { leyendo.current = false; });
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [firebaseUser, llave, aplicar]);

  const actualizar = useCallback(async () => {
    if (!firebaseUser || !llave || leyendo.current) return 'ocupado';
    if (Date.now() - ultima.current < ESPERA_ACTUALIZAR_MS) return 'espera';
    leyendo.current = true;
    try {
      aplicar(await leerHistorial(llave === '*' ? null : llave.split('|'), llave));
      return 'ok';
    } catch (err) {
      console.error('No se pudo actualizar el historial de instalaciones:', err);
      return 'error';
    } finally {
      leyendo.current = false;
    }
  }, [firebaseUser, llave, aplicar]);

  // Pide una actualización por su cuenta (sin botón): si todavía no toca (espera mínima) o hay otra lectura en curso, reintenta cada rato
  // hasta lograrla. Solo se usa cuando una orden sale de la lista en vivo, que es cuando el historial de verdad cambió.
  const pendiente = useRef(false);
  const reintento = useRef(null);
  const actualizarCuandoPueda = useCallback(() => {
    if (pendiente.current) return;
    pendiente.current = true;
    const intentar = async () => {
      const r = await actualizar();
      if (r === 'espera' || r === 'ocupado') reintento.current = setTimeout(intentar, REINTENTO_AUTOMATICO_MS);
      else pendiente.current = false;
    };
    intentar();
  }, [actualizar]);
  useEffect(() => () => clearTimeout(reintento.current), []);

  // Trae la página siguiente (solo ventas). No cuenta como actualización: lo que trae es más viejo, no más reciente.
  const cargarMas = useCallback(async () => {
    if (!firebaseUser || !verTodas || leyendo.current || !hayMas) return;
    leyendo.current = true;
    setCargandoMas(true);
    try {
      const r = await leerMas(llave);
      if (r) { setHistorial(r.lista); setHayMas(r.hayMas); }
    } catch (err) {
      console.error('No se pudo cargar más del historial de instalaciones:', err);
    } finally {
      leyendo.current = false;
      setCargandoMas(false);
    }
  }, [firebaseUser, verTodas, llave, hayMas]);

  return { historial, leidoEn, actualizar, actualizarCuandoPueda, hayMas, cargarMas, cargandoMas };
}
