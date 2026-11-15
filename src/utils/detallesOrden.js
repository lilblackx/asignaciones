import { diaDe } from './totalesMes.js';
import { faltaElPago } from './pagoCliente.js';

// "Detalles de la orden": las fotos que el técnico sube de su trabajo cuando la oficina finaliza la orden. Se guardan en Cloud Storage (ruta `ordenes/{id de la orden}/...`) y la orden solo lleva sus rutas:
//   detallesOrden: { fotos: [{ ruta, bytes }], subidoPor, subidoEn }
// Es un paso aparte del pago del cliente: la orden sigue en la lista del técnico, y Revisión no la aprueba, hasta que tenga las dos cosas. Un bucket borra las fotos a los 60 días (regla de ciclo de vida).

export const MIN_FOTOS = 2;
export const MAX_FOTOS = 7;
// Lado más largo de la foto ya comprimida, su calidad JPEG y el tope de peso: unos 300 KB por foto, 2 MB por orden con las 7.
export const LADO_MAXIMO_FOTO = 1600;
export const CALIDAD_FOTO = 0.7;
export const BYTES_MAXIMOS_FOTO = 1024 * 1024;
// Las fotos nunca se sobrescriben (cada subida lleva un nombre propio y las reglas de Storage no dejan modificarlas), así que el navegador puede guardarlas 60 días: volver a abrir una orden no las descarga otra vez.
// `private`: solo en el navegador de quien las vio (llevan la sesión). Una foto que el técnico quita al corregir sigue visible en los navegadores que ya la guardaron hasta que se cumpla ese plazo.
export const CACHE_FOTO = 'private, max-age=5184000, immutable';
// Solo las órdenes finalizadas desde este día piden los detalles (las anteriores no se tocan).
export const FECHA_INICIO_DETALLES = import.meta.env?.VITE_DETALLES_DESDE ?? '2026-11-13';

const RUTA_FOTO = /^ordenes\/[^/]{1,200}\/[A-Za-z0-9._-]{1,80}\.jpg$/;

export const carpetaDeFotos = (ticketId) => `ordenes/${String(ticketId)}`;

// El nombre del archivo: el orden en que se tomó y la hora, así volver a intentar no pisa un archivo anterior.
export const nombreDeFoto = (indice, ahora = Date.now()) => `${String(indice + 1).padStart(2, '0')}-${ahora.toString(36)}.jpg`;

// Cuánto se reduce una foto para que su lado más largo sea `maximo` (nunca se agranda).
export function dimensionesReducidas(ancho, alto, maximo = LADO_MAXIMO_FOTO) {
  const w = Number(ancho) || 0;
  const h = Number(alto) || 0;
  if (w <= 0 || h <= 0) return { ancho: 0, alto: 0 };
  const escala = Math.min(1, maximo / Math.max(w, h));
  return { ancho: Math.round(w * escala), alto: Math.round(h * escala) };
}

export const fotosDe = (ticket) => (Array.isArray(ticket?.detallesOrden?.fotos) ? ticket.detallesOrden.fotos.filter((f) => f && typeof f.ruta === 'string' && f.ruta) : []);
export const tieneDetalles = (ticket) => fotosDe(ticket).length >= MIN_FOTOS;

// Las rutas de las fotos que la orden tenía y ya no están en la lista final (se quitaron o se cambiaron): se borran del bucket cuando la orden ya guardó la lista nueva.
export const rutasQuitadas = (ticket, finales) => {
  const quedan = new Set(finales.map((f) => f.ruta));
  return fotosDe(ticket).map((f) => f.ruta).filter((ruta) => !quedan.has(ruta));
};

// ¿El técnico puede corregir las fotos? Mientras la orden siga finalizada en su lista (el cierre del día la archiva) y ya tenga detalles.
export const puedeCorregirDetalles = (ticket) => Boolean(ticket) && ticket.estado === 'FINALIZADO' && tieneDetalles(ticket);

// ¿Esta orden pide los detalles? Finalizada, con técnico y desde FECHA_INICIO_DETALLES.
export function debePedirDetalles(ticket, { desde = FECHA_INICIO_DETALLES } = {}) {
  if (!ticket || ticket.estado !== 'FINALIZADO' || !ticket.tecnico) return false;
  const finalizada = Number(ticket.finalizadoEn) || 0;
  return finalizada > 0 && diaDe(finalizada) >= desde;
}

// ¿A esta orden le faltan los detalles? Es lo que la deja en la lista del técnico y frena la aprobación en Revisión.
export const faltanDetalles = (ticket, opciones) => debePedirDetalles(ticket, opciones) && !tieneDetalles(ticket);

// Lo que se guarda en la orden: solo las rutas (nunca las fotos) y quién y cuándo las subió.
export function armarDetalles(fotos, { por, ahora = Date.now() }) {
  return {
    fotos: fotos.map((f) => ({ ruta: String(f.ruta), bytes: Number(f.bytes) || 0 })),
    subidoPor: String(por || ''),
    subidoEn: ahora,
  };
}

// { error } si lo que se va a guardar no sirve; { ok: true } si sí. La misma forma que exigen las reglas de Firestore.
export function validarDetalles(detalles, ticketId) {
  const fotos = detalles?.fotos;
  if (!Array.isArray(fotos) || fotos.length < MIN_FOTOS) return { error: `Sube al menos ${MIN_FOTOS} fotos.` };
  if (fotos.length > MAX_FOTOS) return { error: `Son ${MAX_FOTOS} fotos como máximo.` };
  const carpeta = `${carpetaDeFotos(ticketId)}/`;
  const rutas = new Set();
  for (const f of fotos) {
    if (!f || typeof f.ruta !== 'string' || !RUTA_FOTO.test(f.ruta) || !f.ruta.startsWith(carpeta)) return { error: 'Una de las fotos no es de esta orden.' };
    if (!(Number(f.bytes) > 0) || f.bytes > BYTES_MAXIMOS_FOTO) return { error: 'Una de las fotos pesa demasiado.' };
    rutas.add(f.ruta);
  }
  if (rutas.size !== fotos.length) return { error: 'Hay una foto repetida.' };
  return { ok: true };
}

export const textoFaltanDetalles = (tecnico) => `Faltan los detalles de la orden (fotos): los sube el técnico${tecnico ? ` (${tecnico})` : ''}.`;

// --- Elegir y subir las fotos desde el teléfono (galería, otra app o la cámara) ---
// Lo que se sabe de un archivo elegido sin abrirlo: un tipo que no es imagen (un PDF, un video) se rechaza al elegirlo; un tipo vacío o genérico ("octet-stream": algunas apps entregan así la foto) se intenta abrir. El HEIC (algunos iPhone y Samsung)
// no lo abre el navegador de Android: se avisa con qué hacer.
export const noEsImagen = (archivo) => Boolean(archivo?.type) && !/^image\//i.test(archivo.type) && !/octet-stream$/i.test(archivo.type);
export const esFormatoHeic = (archivo) => /image\/hei[cf]/i.test(archivo?.type || '') || /\.hei[cf]$/i.test(archivo?.name || '');
export const textoFotoIlegible = (archivo) => (esFormatoHeic(archivo)
  ? 'No se pudo abrir: está en formato HEIC. En la cámara elige el formato "Más compatible" (JPG) o toma otra.'
  : 'No se pudo leer esta foto. Quítala y toma otra.');

// Cada foto se sube con hasta INTENTOS_POR_FOTO intentos (con otro nombre, porque Storage no deja sobrescribir) y se da por trabada si pasa ESPERA_SIN_AVANCE_MS sin que avance ni un byte.
export const INTENTOS_POR_FOTO = 2;
export const ESPERA_SIN_AVANCE_MS = 45000;
// Los errores que reintentar no arregla (sin permiso, sin sesión, sin cupo, sin bucket) se muestran de una vez.
const SIN_REINTENTO = ['storage/unauthorized', 'storage/unauthenticated', 'storage/quota-exceeded', 'storage/bucket-not-found', 'storage/project-not-found', 'storage/invalid-argument', 'storage/invalid-checksum', 'storage/canceled'];
export const sePuedeReintentar = (codigo) => !SIN_REINTENTO.includes(codigo);
// Qué se le dice al técnico según el error de Cloud Storage. Siempre empieza con "No se pudo" (es lo que la app deja pasar tal cual, ver ErrorDeFotos).
// Todos terminan con el código del error entre paréntesis: así, si algo falla en el teléfono de un técnico, quien lo ve puede decir cuál fue (y no se confunde un permiso con la señal).
const conCodigo = (texto, codigo) => `${texto} (código: ${codigo || 'desconocido'})`;
export function textoErrorDeSubida(codigo) {
  switch (codigo) {
    case 'storage/unauthorized':
    case 'storage/unauthenticated':
      return conCodigo('No se pudo subir: no hay permiso para guardar fotos en esta orden. Cierra sesión, entra de nuevo e inténtalo otra vez; si sigue igual, avisa a la oficina.', codigo);
    case 'storage/quota-exceeded':
      return conCodigo('No se pudo subir: el almacenamiento está lleno. Avisa a la oficina.', codigo);
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
      return conCodigo('No se pudo subir: el almacenamiento de fotos no está disponible. Avisa a la oficina.', codigo);
    case 'subida/sin-avance':
      return conCodigo('No se pudo subir: la subida no avanza, la señal es muy débil. Busca mejor señal e inténtalo de nuevo (las fotos se conservan).', codigo);
    case 'storage/retry-limit-exceeded':
      return conCodigo('No se pudo subir: no hay buena conexión. Busca mejor señal e inténtalo de nuevo (las fotos se conservan).', codigo);
    default:
      return conCodigo('No se pudo subir las fotos. Inténtalo de nuevo; si sigue igual, avisa a la oficina con este código (las fotos se conservan).', codigo);
  }
}
// Lo mismo con el error de Firestore al guardar la orden con sus fotos ya subidas.
export function textoErrorDeGuardado(codigo) {
  switch (codigo) {
    case 'permission-denied':
      return conCodigo('No se pudo guardar la orden: no hay permiso (la orden cambió o ya no está a tu nombre). Avisa a la oficina.', `firestore/${codigo}`);
    case 'unavailable':
    case 'deadline-exceeded':
      return conCodigo('No se pudo guardar la orden: no hay buena conexión. Busca mejor señal e inténtalo de nuevo (las fotos se conservan).', `firestore/${codigo}`);
    default:
      return conCodigo('No se pudo guardar la orden con sus fotos. Inténtalo de nuevo; si sigue igual, avisa a la oficina con este código (las fotos se conservan).', codigo ? `firestore/${codigo}` : '');
  }
}

// Lo que le falta al técnico en una orden finalizada: 'PAGO' (el pago del cliente), 'DETALLES' (las fotos) o '' (nada). Primero el pago.
export const PENDIENTE_PAGO = 'PAGO';
export const PENDIENTE_DETALLES = 'DETALLES';
export function pendienteDelTecnico(ticket, opciones) {
  if (faltaElPago(ticket, opciones)) return PENDIENTE_PAGO;
  return faltanDetalles(ticket, opciones) ? PENDIENTE_DETALLES : '';
}
