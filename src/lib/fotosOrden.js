import { arrayUnion, collection, doc } from 'firebase/firestore';
import { updateDoc } from './medidorFirestore.js';
import { db, app, appId } from './firebase';
import { esperarConLimite } from '../utils/tiempoLimite';
import { BYTES_MAXIMOS_FOTO, CACHE_FOTO, CALIDAD_FOTO, LADO_MAXIMO_FOTO, armarDetalles, carpetaDeFotos, dimensionesReducidas, fotosDe, nombreDeFoto, rutasQuitadas, validarDetalles } from '../utils/detallesOrden';

// Las fotos de los "Detalles de la orden" (ver utils/detallesOrden y storage.rules): se reducen en el teléfono, se suben a Cloud Storage y la orden guarda solo sus rutas.
// Cloud Storage se carga aquí, cuando se necesita (no entra al paquete principal de la app).
const fechaCorta = () => new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });

let storageListo = null;
function cargarStorage() {
  if (!storageListo) {
    storageListo = import('firebase/storage').then((modulo) => {
      const storage = modulo.getStorage(app);
      // Con el emulador (VITE_USE_EMULATORS=true en .env.local) las fotos van al emulador de Storage, igual que Firestore y Auth.
      if (import.meta.env.VITE_USE_EMULATORS === 'true' && typeof window !== 'undefined') modulo.connectStorageEmulator(storage, window.location.hostname, 9199);
      return { modulo, storage };
    });
    // Si falla la carga, la próxima vez se intenta de nuevo.
    storageListo.catch(() => { storageListo = null; });
  }
  return storageListo;
}

function aBlob(canvas, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

// Reduce la foto a un JPEG de lado largo LADO_MAXIMO_FOTO (respeta la orientación con que se tomó) y, si aún pesa de más, baja la calidad. Lanza si el archivo no es una imagen que el teléfono pueda abrir.
export async function comprimirFoto(archivo) {
  let imagen;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No se pudo leer una de las fotos. Toma otra.');
  }
  try {
    const { ancho, alto } = dimensionesReducidas(imagen.width, imagen.height, LADO_MAXIMO_FOTO);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    lienzo.getContext('2d').drawImage(imagen, 0, 0, ancho, alto);
    let calidad = CALIDAD_FOTO;
    let blob = await aBlob(lienzo, calidad);
    while (blob && blob.size > BYTES_MAXIMOS_FOTO && calidad > 0.3) {
      calidad -= 0.1;
      blob = await aBlob(lienzo, calidad);
    }
    if (!blob || blob.size === 0 || blob.size > BYTES_MAXIMOS_FOTO) throw new Error('No se pudo reducir una de las fotos. Toma otra.');
    return blob;
  } finally {
    imagen.close?.();
  }
}

// Guarda los detalles de la orden: `fotos` es la lista final en orden, cada una { tipo: 'guardada', ruta, bytes } (ya está en el bucket) o { tipo: 'nueva', archivo } (se reduce y se sube). La orden guarda solo las rutas.
// Sirve para subirlos la primera vez y para corregirlos (quitar o cambiar fotos). `onProgreso(hechas, total)` avisa cada foto nueva subida.
// Devuelve { ok: true, detalles, enCola } o lanza el error. Con la orden ya guardada se borran del bucket las fotos que se quitaron; las que se subieron y no llegaron a la orden quedan huérfanas y el bucket las borra a los 60 días.
export async function subirDetallesDeOrden(ticket, fotos, { por, onProgreso = () => {} }) {
  const { modulo, storage } = await cargarStorage();
  const ahora = Date.now();
  const nuevas = fotos.filter((f) => f.tipo === 'nueva').length;
  const finales = [];
  let hechas = 0;
  for (let i = 0; i < fotos.length; i += 1) {
    const f = fotos[i];
    if (f.tipo !== 'nueva') { finales.push({ ruta: f.ruta, bytes: f.bytes }); continue; }
    const blob = await comprimirFoto(f.archivo);
    const ruta = `${carpetaDeFotos(ticket.id)}/${nombreDeFoto(i, ahora)}`;
    await modulo.uploadBytes(modulo.ref(storage, ruta), blob, { contentType: 'image/jpeg', cacheControl: CACHE_FOTO });
    finales.push({ ruta, bytes: blob.size });
    hechas += 1;
    onProgreso(hechas, nuevas);
  }
  const detalles = armarDetalles(finales, { por, ahora });
  const valido = validarDetalles(detalles, ticket.id);
  if (valido.error) throw new Error(valido.error);
  const quitadas = rutasQuitadas(ticket, finales);
  const correccion = fotosDe(ticket).length > 0;
  const referencia = doc(collection(db, 'artifacts', appId, 'public', 'data', 'tickets'), String(ticket.id));
  const resumen = `${finales.length} ${finales.length === 1 ? 'foto' : 'fotos'}${correccion ? ` (${nuevas} nuevas, ${quitadas.length} quitadas)` : ''}`;
  const entrada = { fecha: fechaCorta(), operador: por, tipo: 'detallesOrden', detalle: `${correccion ? 'Corrigió' : 'Subió'} los detalles de la orden: ${resumen}` };
  const aTiempo = await esperarConLimite(updateDoc(referencia, { detallesOrden: detalles, historialEdiciones: arrayUnion(entrada) }));
  // Solo con la orden ya guardada se borran las fotos que se quitaron (sin respuesta del servidor se dejan: el bucket las borra a los 60 días). Si no se pueden borrar no pasa nada.
  if (aTiempo) await Promise.all(quitadas.map((ruta) => modulo.deleteObject(modulo.ref(storage, ruta)).catch(() => {})));
  return { ok: true, detalles, enCola: !aTiempo };
}

// La dirección para mostrar una foto ya subida (la oficina y el técnico de la orden tienen permiso de lectura).
export async function urlDeFoto(ruta) {
  const { modulo, storage } = await cargarStorage();
  return modulo.getDownloadURL(modulo.ref(storage, ruta));
}
