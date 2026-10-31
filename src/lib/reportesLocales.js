import { getDocFromCache, getDocsFromCache, where } from 'firebase/firestore';
import { getDocs } from './medidorFirestore';

// Los reportes de cierre pesan (cada uno trae las órdenes completas del día) y no cambian una vez escritos. Con la caché local
// de Firestore (ver firebase.js) basta pedirle al servidor los que salieron después del último que ya se tiene.
// Por cada lista se anota en el dispositivo hasta dónde se tiene todo: { desde, hasta } = los reportes con createdAt entre
// `desde` (0 si no hay más antiguos) y `hasta` están completos en la caché; `ids` = los que se leyeron la última vez y `completoEn` = cuándo
// se leyó todo por última vez. Se lee todo otra vez si: falta la nota, la caché está vacía, a la caché le falta alguno de `ids` (Firestore borra
// documentos viejos cuando la caché llega a su tope) o pasó una semana (un reporte borrado a mano en la consola no se enteraría de otra forma).
const PREFIJO = 'reportes:';
const REVISION_COMPLETA_MS = 7 * 24 * 60 * 60 * 1000;

const clave = (uid, nombre) => `${PREFIJO}${uid}:${nombre}`;
const leerNota = (k) => {
  try {
    const nota = JSON.parse(localStorage.getItem(k));
    return Number.isFinite(nota?.desde) && Number.isFinite(nota?.hasta) && Number.isFinite(nota?.completoEn) && Array.isArray(nota?.ids) ? nota : null;
  } catch { return null; }
};
const guardarNota = (k, nota) => { try { localStorage.setItem(k, JSON.stringify(nota)); } catch { /* sin almacenamiento: la próxima vez se lee todo */ } };
const creadoEn = (d) => Number(d.data().createdAt) || 0;

// Se llama al cerrar sesión junto con el borrado de la caché de Firestore.
export const olvidarReportesLocales = () => {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => localStorage.removeItem(k));
  } catch { /* nada que borrar */ }
};

// `consulta(condiciones)`: la consulta de reportes (con su orden y su límite) más esas condiciones extra, para leerla de la caché.
// `referencia(id)`: la referencia del reporte con ese id, para comprobar que sigue en la caché.
// `leerServidor(condiciones)`: la misma lectura del servidor ({ docs }); por defecto getDocs(consulta(condiciones)).
// `desde`: solo los reportes con createdAt desde ahí (ventana de días). `limite`: solo los N más nuevos. Uno de los dos, o ninguno.
// Devuelve los documentos del más nuevo al más viejo.
export async function leerReportesIncremental({ uid, nombre, consulta, referencia, leerServidor = (condiciones) => getDocs(consulta(condiciones)), desde = 0, limite = 0 }) {
  const k = clave(uid, nombre);
  const condBase = desde ? [where('createdAt', '>=', desde)] : [];

  const leerTodo = async () => {
    const { docs } = await leerServidor(condBase);
    const cubreHasta = limite && docs.length >= limite ? creadoEn(docs[docs.length - 1]) : desde;
    guardarNota(k, { desde: cubreHasta, hasta: docs.reduce((m, d) => Math.max(m, creadoEn(d)), desde), ids: docs.map((d) => d.id), completoEn: Date.now() });
    return docs;
  };

  const nota = leerNota(k);
  if (!nota || (desde && nota.desde > desde) || Date.now() - nota.completoEn > REVISION_COMPLETA_MS) return leerTodo();
  let guardados;
  try {
    guardados = await getDocsFromCache(consulta(condBase));
  } catch {
    return leerTodo();
  }
  if (guardados.empty) return leerTodo();
  // Si la caché perdió alguno de los que se leyeron la última vez, tiene huecos: se lee todo.
  const completa = await Promise.all(nota.ids.map((id) => getDocFromCache(referencia(id)).then(() => true, () => false)));
  if (completa.includes(false)) return leerTodo();

  const nuevos = await leerServidor([where('createdAt', '>', nota.hasta)]);
  const porId = new Map();
  [...nuevos.docs, ...guardados.docs].forEach((d) => porId.set(d.id, d));
  let docs = [...porId.values()].sort((a, b) => creadoEn(b) - creadoEn(a));
  if (limite) {
    // Con menos de los pedidos y más reportes antiguos en el servidor, la caché no alcanza: se lee todo.
    if (docs.length < limite && nota.desde > 0) return leerTodo();
    docs = docs.slice(0, limite);
  }
  guardarNota(k, { ...nota, hasta: nuevos.docs.reduce((m, d) => Math.max(m, creadoEn(d)), nota.hasta), ids: docs.map((d) => d.id) });
  return docs;
}
