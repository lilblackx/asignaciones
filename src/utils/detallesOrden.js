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

// Lo que le falta al técnico en una orden finalizada: 'PAGO' (el pago del cliente), 'DETALLES' (las fotos) o '' (nada). Primero el pago.
export const PENDIENTE_PAGO = 'PAGO';
export const PENDIENTE_DETALLES = 'DETALLES';
export function pendienteDelTecnico(ticket, opciones) {
  if (faltaElPago(ticket, opciones)) return PENDIENTE_PAGO;
  return faltanDetalles(ticket, opciones) ? PENDIENTE_DETALLES : '';
}
