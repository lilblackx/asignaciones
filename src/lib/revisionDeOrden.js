import { doc } from 'firebase/firestore';
import { getDoc } from './medidorFirestore.js';
import { db, appId } from './firebase';

// La revisión de una orden en Revisión (colección revisionPagos, ver utils/revisionPagos): una lectura, o null si no tiene. La leen el ADMIN y FINANZAS (ver las reglas).
// `clave`: la clave de la orden (claveOrden, utils/finanzas).
export async function leerRevisionDeOrden(clave) {
  const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'revisionPagos', String(clave)));
  return snap.exists() ? snap.data() : null;
}
