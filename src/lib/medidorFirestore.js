// Lo que hace esta sesión con Firestore, para el registro de estaciones (hooks/useEstacion): cuánto lee y escribe por colección, qué le rechaza
// el servidor y por qué, cuántos escuchadores tiene abiertos y cuántas veces se suscribe. Envuelve las funciones de lectura y escritura de
// Firestore sin cambiar lo que hacen: toda la app las importa de aquí y no de 'firebase/firestore' (lo comprueba scripts/test-estaciones.mjs).
// Las lecturas son una aproximación de lo que se factura: cada documento que llega del servidor cuenta uno (lo que sale de la caché del
// navegador no se cobra y no se cuenta); una consulta vacía cuenta uno, como la cobra Firestore. Medir nunca rompe nada: un error al contar se
// ignora, y los errores de Firestore siguen llegando a quien llamó igual que antes.
import {
  addDoc as addDocFirestore, deleteDoc as deleteDocFirestore, getDoc as getDocFirestore, getDocs as getDocsFirestore, onSnapshot as onSnapshotFirestore,
  runTransaction as runTransactionFirestore, setDoc as setDocFirestore, updateDoc as updateDocFirestore, writeBatch as writeBatchFirestore,
} from 'firebase/firestore';
import { crearMedidor } from '../utils/estaciones.js';

export const medidor = crearMedidor();

// El nombre de la colección de una referencia, consulta o documento (para agrupar).
function coleccionDe(ref) {
  try {
    if (ref?.type === 'collection') return ref.id;
    if (ref?.type === 'document') return ref.parent?.id || 'documento';
    const segmentos = ref?._query?.path?.segments;
    if (Array.isArray(segmentos) && segmentos.length) return segmentos[segmentos.length - 1];
    if (ref?._query?.collectionGroup) return ref._query.collectionGroup;
  } catch { /* se agrupa como consulta */ }
  return 'consulta';
}

const seguro = (fn) => { try { fn(); } catch { /* medir nunca rompe nada */ } };
const lecturas = (coleccion, n) => seguro(() => medidor.sumar(coleccion, n, Date.now()));
const escrituras = (coleccion, n) => seguro(() => medidor.escritura(coleccion, n, Date.now()));
const rechazo = (error) => seguro(() => medidor.rechazo(error?.code, Date.now()));
const errorLectura = (error) => seguro(() => medidor.errorLectura(error?.code, Date.now()));

// Una escritura: se cuenta al pedirla y, si el servidor la rechaza, se cuenta el rechazo; el error sigue igual hacia quien la pidió.
const medirEscritura = (coleccion, n, promesa) => {
  escrituras(coleccion, n);
  return promesa.catch((error) => { rechazo(error); throw error; });
};

// --- Lecturas ---

export function onSnapshot(ref, ...args) {
  const coleccion = coleccionDe(ref);
  let primera = true;
  const medir = (snap) => seguro(() => {
    if (snap?.metadata?.fromCache) return;
    const n = typeof snap?.docChanges === 'function' ? snap.docChanges().length : 1;
    lecturas(coleccion, n || (primera ? 1 : 0));
    primera = false;
  });
  const i = args.findIndex((a) => typeof a === 'function' || (a && typeof a === 'object' && typeof a.next === 'function'));
  if (i >= 0) {
    const original = args[i];
    if (typeof original === 'function') {
      args[i] = (snap) => { medir(snap); return original(snap); };
      // El callback de error va justo después; si no hay uno, Firestore lo anota en la consola: se cuenta y se anota igual.
      const alFallar = typeof args[i + 1] === 'function' ? args[i + 1] : (error) => console.error(`Error en el escuchador de ${coleccion}:`, error);
      args[i + 1] = (error) => { errorLectura(error); return alFallar(error); };
    } else {
      args[i] = { ...original, next: (snap) => { medir(snap); return original.next(snap); }, error: (error) => { errorLectura(error); return original.error ? original.error(error) : console.error(`Error en el escuchador de ${coleccion}:`, error); } };
    }
  }
  seguro(() => medidor.suscrito(Date.now()));
  const cancelar = onSnapshotFirestore(ref, ...args);
  let cancelado = false;
  return () => {
    if (!cancelado) { cancelado = true; seguro(() => medidor.desuscrito()); }
    return cancelar();
  };
}

export async function getDocs(consulta) {
  try {
    const snap = await getDocsFirestore(consulta);
    if (!snap.metadata?.fromCache) lecturas(coleccionDe(consulta), Math.max(1, snap.size));
    return snap;
  } catch (error) { errorLectura(error); throw error; }
}

export async function getDoc(ref) {
  try {
    const snap = await getDocFirestore(ref);
    if (!snap.metadata?.fromCache) lecturas(coleccionDe(ref), 1);
    return snap;
  } catch (error) { errorLectura(error); throw error; }
}

// --- Escrituras ---

export const setDoc = (ref, ...args) => medirEscritura(coleccionDe(ref), 1, setDocFirestore(ref, ...args));
export const updateDoc = (ref, ...args) => medirEscritura(coleccionDe(ref), 1, updateDocFirestore(ref, ...args));
export const deleteDoc = (ref) => medirEscritura(coleccionDe(ref), 1, deleteDocFirestore(ref));
export const addDoc = (ref, datos) => medirEscritura(coleccionDe(ref), 1, addDocFirestore(ref, datos));

// Un lote cuenta cada operación al confirmarlo (commit), por la colección de cada una.
export function writeBatch(db) {
  const lote = writeBatchFirestore(db);
  const porColeccion = {};
  const anotar = (ref) => seguro(() => { const c = coleccionDe(ref); porColeccion[c] = (porColeccion[c] || 0) + 1; });
  for (const metodo of ['set', 'update', 'delete']) {
    const original = lote[metodo].bind(lote);
    lote[metodo] = (ref, ...args) => { anotar(ref); original(ref, ...args); return lote; };
  }
  const commit = lote.commit.bind(lote);
  lote.commit = () => {
    seguro(() => Object.entries(porColeccion).forEach(([c, n]) => escrituras(c, n)));
    return commit().catch((error) => { rechazo(error); throw error; });
  };
  return lote;
}

// Una transacción: si el servidor la rechaza, se cuenta el rechazo (las escrituras de adentro son pocas y se cuentan como una).
export function runTransaction(db, fn, opciones) {
  return medirEscritura('transaccion', 1, runTransactionFirestore(db, fn, opciones));
}
