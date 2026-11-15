import { arrayUnion, collection, doc } from 'firebase/firestore';
import { updateDoc } from './medidorFirestore.js';
import { db, app, appId } from './firebase';
import { esperarConLimite } from '../utils/tiempoLimite';
import { BYTES_MAXIMOS_FOTO, CACHE_FOTO, CALIDAD_FOTO, ESPERA_SIN_AVANCE_MS, INTENTOS_POR_FOTO, LADO_MAXIMO_FOTO, armarDetalles, carpetaDeFotos, dimensionesReducidas, fotosDe, nombreDeFoto, rutasQuitadas, sePuedeReintentar, textoErrorDeGuardado, textoErrorDeSubida, textoFotoIlegible, validarDetalles } from '../utils/detallesOrden';

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

// Un error con un texto ya listo para el técnico (siempre empieza con "No se pudo"): la app lo muestra tal cual; cualquier otro error se muestra con un texto genérico.
export class ErrorDeFotos extends Error {}

const conLimite = (promesa, ms, mensaje) => {
  let temporizador;
  const limite = new Promise((_, rechazar) => { temporizador = setTimeout(() => rechazar(new ErrorDeFotos(mensaje)), ms); });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
};

// Abre la foto como sea que el teléfono la entregue (galería, otra app, cámara): primero createImageBitmap respetando la orientación con que se tomó; si el navegador no lo admite (Safari viejo, otros formatos),
// sin esa opción; y como último recurso una etiqueta <img> (el navegador del iPhone abre así el HEIC). Devuelve { fuente, ancho, alto, cerrar }.
async function abrirImagen(archivo) {
  if (typeof createImageBitmap === 'function') {
    for (const opciones of [{ imageOrientation: 'from-image' }, undefined]) {
      try {
        const bitmap = opciones ? await createImageBitmap(archivo, opciones) : await createImageBitmap(archivo);
        if (bitmap.width > 0 && bitmap.height > 0) return { fuente: bitmap, ancho: bitmap.width, alto: bitmap.height, cerrar: () => bitmap.close?.() };
        bitmap.close?.();
      } catch { /* se prueba el siguiente modo */ }
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    imagen.src = url;
    await imagen.decode();
    if (!(imagen.naturalWidth > 0 && imagen.naturalHeight > 0)) throw new Error('imagen vacía');
    return { fuente: imagen, ancho: imagen.naturalWidth, alto: imagen.naturalHeight, cerrar: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ErrorDeFotos(textoFotoIlegible(archivo));
  }
}

// Reduce la foto a un JPEG de lado largo LADO_MAXIMO_FOTO (respeta la orientación con que se tomó) y, si aún pesa de más, baja la calidad. Sirve para cualquier imagen que el teléfono pueda abrir (JPG, PNG, WebP...; el fondo
// de un PNG con transparencia queda blanco). Lanza un ErrorDeFotos, con el texto para el técnico, si el archivo está vacío, no es una imagen que el teléfono pueda abrir o no se pudo reducir.
export async function comprimirFoto(archivo) {
  if (!archivo || archivo.size === 0) throw new ErrorDeFotos('No se pudo leer esta foto: el archivo está vacío. Quítala y toma otra.');
  const imagen = await conLimite(abrirImagen(archivo), 30000, 'No se pudo abrir esta foto: tardó demasiado. Quítala y toma otra.');
  try {
    const { ancho, alto } = dimensionesReducidas(imagen.ancho, imagen.alto, LADO_MAXIMO_FOTO);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext('2d');
    if (!contexto) throw new ErrorDeFotos('No se pudo reducir esta foto. Quítala y toma otra.');
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, ancho, alto);
    contexto.drawImage(imagen.fuente, 0, 0, ancho, alto);
    let calidad = CALIDAD_FOTO;
    let blob = await aBlob(lienzo, calidad);
    while (blob && blob.size > BYTES_MAXIMOS_FOTO && calidad > 0.3) {
      calidad -= 0.1;
      blob = await aBlob(lienzo, calidad);
    }
    if (!blob || blob.size === 0 || blob.size > BYTES_MAXIMOS_FOTO) throw new ErrorDeFotos('No se pudo reducir esta foto. Quítala y toma otra.');
    return blob;
  } finally {
    imagen.cerrar();
  }
}

// Sube una foto ya reducida (un JPEG) y espera a que termine. Si pasa ESPERA_SIN_AVANCE_MS sin que avance ni un byte la cancela (sin señal, la subida se quedaba esperando sin decir nada). Rechaza con el error de Storage
// (con su `code`) o con code 'subida/sin-avance'.
function subirUnaFoto(modulo, storage, ruta, blob) {
  return new Promise((resolve, reject) => {
    const tarea = modulo.uploadBytesResumable(modulo.ref(storage, ruta), blob, { contentType: 'image/jpeg', cacheControl: CACHE_FOTO });
    let vigilante;
    let ultimo = -1;
    const armar = () => {
      clearTimeout(vigilante);
      vigilante = setTimeout(() => { reject(Object.assign(new Error('La subida no avanza.'), { code: 'subida/sin-avance' })); tarea.cancel(); }, ESPERA_SIN_AVANCE_MS);
    };
    armar();
    tarea.on(
      'state_changed',
      (estado) => { if (estado.bytesTransferred !== ultimo) { ultimo = estado.bytesTransferred; armar(); } },
      (error) => { clearTimeout(vigilante); reject(error); },
      () => { clearTimeout(vigilante); resolve(); },
    );
  });
}

// Con reintento: cada intento va con otro nombre (Storage no deja sobrescribir un archivo) y los errores que reintentar no arregla se muestran de una vez.
async function subirConReintento(modulo, storage, ticketId, indice, ahora, blob) {
  let ultimoError;
  for (let intento = 0; intento < INTENTOS_POR_FOTO; intento += 1) {
    const ruta = `${carpetaDeFotos(ticketId)}/${nombreDeFoto(indice, ahora + intento)}`;
    try {
      await subirUnaFoto(modulo, storage, ruta, blob);
      return ruta;
    } catch (error) {
      ultimoError = error;
      console.error(`No se pudo subir la foto (intento ${intento + 1} de ${INTENTOS_POR_FOTO}):`, error?.code || error);
      if (!sePuedeReintentar(error?.code)) break;
    }
  }
  throw new ErrorDeFotos(textoErrorDeSubida(ultimoError?.code));
}

// Guarda los detalles de la orden: `fotos` es la lista final en orden, cada una { tipo: 'guardada', ruta, bytes } (ya está en el bucket) o { tipo: 'nueva', archivo } (se reduce y se sube). La orden guarda solo las rutas.
// Sirve para subirlos la primera vez y para corregirlos (quitar o cambiar fotos). `onProgreso(hechas, total)` avisa cada foto nueva subida.
// Devuelve { ok: true, detalles, enCola } o lanza el error. Con la orden ya guardada se borran del bucket las fotos que se quitaron; las que se subieron y no llegaron a la orden quedan huérfanas y el bucket las borra a los 60 días.
export async function subirDetallesDeOrden(ticket, fotos, { por, onProgreso = () => {} }) {
  // Sin conexión no hay nada que intentar: se dice de una vez en lugar de esperar a que se agoten los intentos.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ErrorDeFotos('No se pudo subir: no tienes conexión a internet. Conéctate e inténtalo de nuevo (las fotos se conservan).');
  let almacenamiento;
  try {
    almacenamiento = await cargarStorage();
  } catch (error) {
    console.error('No se pudo cargar Cloud Storage:', error);
    throw new ErrorDeFotos('No se pudo preparar la subida: revisa tu conexión e inténtalo de nuevo.');
  }
  const { modulo, storage } = almacenamiento;
  const ahora = Date.now();
  const nuevas = fotos.filter((f) => f.tipo === 'nueva').length;
  const finales = [];
  let hechas = 0;
  for (let i = 0; i < fotos.length; i += 1) {
    const f = fotos[i];
    if (f.tipo !== 'nueva') { finales.push({ ruta: f.ruta, bytes: f.bytes }); continue; }
    // La foto ya viene reducida (se prepara al elegirla); si no, se reduce aquí.
    const blob = f.blob || await comprimirFoto(f.archivo);
    const ruta = await subirConReintento(modulo, storage, ticket.id, i, ahora, blob);
    finales.push({ ruta, bytes: blob.size });
    hechas += 1;
    onProgreso(hechas, nuevas);
  }
  const detalles = armarDetalles(finales, { por, ahora });
  const valido = validarDetalles(detalles, ticket.id);
  if (valido.error) throw new ErrorDeFotos(`No se pudo subir: ${valido.error} (código: validación). Avisa a la oficina.`);
  const quitadas = rutasQuitadas(ticket, finales);
  const correccion = fotosDe(ticket).length > 0;
  const referencia = doc(collection(db, 'artifacts', appId, 'public', 'data', 'tickets'), String(ticket.id));
  const resumen = `${finales.length} ${finales.length === 1 ? 'foto' : 'fotos'}${correccion ? ` (${nuevas} nuevas, ${quitadas.length} quitadas)` : ''}`;
  const entrada = { fecha: fechaCorta(), operador: por, tipo: 'detallesOrden', detalle: `${correccion ? 'Corrigió' : 'Subió'} los detalles de la orden: ${resumen}` };
  let aTiempo;
  try {
    aTiempo = await esperarConLimite(updateDoc(referencia, { detallesOrden: detalles, historialEdiciones: arrayUnion(entrada) }));
  } catch (error) {
    console.error('No se pudo guardar la orden con sus fotos:', error?.code || error);
    throw new ErrorDeFotos(textoErrorDeGuardado(error?.code));
  }
  // Solo con la orden ya guardada se borran las fotos que se quitaron (sin respuesta del servidor se dejan: el bucket las borra a los 60 días). Si no se pueden borrar no pasa nada.
  if (aTiempo) await Promise.all(quitadas.map((ruta) => modulo.deleteObject(modulo.ref(storage, ruta)).catch(() => {})));
  return { ok: true, detalles, enCola: !aTiempo };
}

// La dirección para mostrar una foto ya subida (la oficina y el técnico de la orden tienen permiso de lectura).
export async function urlDeFoto(ruta) {
  const { modulo, storage } = await cargarStorage();
  return modulo.getDownloadURL(modulo.ref(storage, ruta));
}
