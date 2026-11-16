import { collection, doc, query, where } from 'firebase/firestore';
import { getDoc, onSnapshot, setDoc, updateDoc } from './medidorFirestore.js';
import { db, appId } from './firebase';
import { armarAviso } from '../utils/avisoOrdenPagada';

const datos = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);

// La oficina, al cancelar una orden o cambiarle el tipo: deja el aviso para Finanzas (ver utils/avisoOrdenPagada). Va en segundo plano y nunca frena ni ensucia el guardado.
export function avisarCambioDeOrden(original, nueva, { por, ahora = Date.now() }) {
  const aviso = armarAviso(original, nueva, { por, ahora });
  if (!aviso) return Promise.resolve(null);
  return setDoc(doc(datos('avisosOrdenPagada'), `${aviso.clave}_${ahora}`), aviso)
    .then(() => aviso)
    .catch((error) => { console.warn('No se pudo dejar el aviso para Finanzas:', error?.code || error); return null; });
}

// Finanzas: los avisos sin resolver, en vivo. `alCambiar(lista)`; devuelve la función para dejar de escuchar.
export const escucharAvisos = (alCambiar, alFallar) => onSnapshot(
  query(datos('avisosOrdenPagada'), where('resuelto', '==', false)),
  (snap) => alCambiar(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  alFallar,
);

// ¿La orden está pagada ahora? Su revisión guarda el pago vigente (`pagoId`); '' si no.
export async function pagoVigenteDe(clave) {
  const snap = await getDoc(doc(datos('revisionPagos'), clave));
  return snap.exists() ? String(snap.data().pagoId || '') : '';
}

export const marcarAvisoResuelto = (id, { por, ahora = Date.now() }) => updateDoc(doc(datos('avisosOrdenPagada'), id), { resuelto: true, resueltoPor: String(por || ''), resueltoEn: ahora });
