// Ubicación de un técnico en la calle. Se enciende o apaga en Configuración (`ubicacionActiva` de config/funciones, ver utils/funciones.js) y la ve el ADMIN en el módulo Ubicación del menú lateral.
// NO hay avisos: ni push ni mensaje en el teléfono del técnico. Hay dos maneras de saber dónde está, con documentos que llevan el nombre del técnico en mayúsculas como id:
//   1. A demanda: el ADMIN pide la ubicación y el teléfono del técnico la envía SOLO cuando abra la app (la abre seguido para ver sus órdenes), mientras la solicitud esté vigente (30 minutos).
//      solicitudesUbicacion/{TECNICO}  el ADMIN: { pedidaPor, pedidaEn, venceEn, detenidaEn, detenidaPor? }.
//      ubicaciones/{TECNICO}           el técnico: { lat, lng, precision, en, solicitudEn } o, si no pudo leerla, { problema, en, solicitudEn }.
//      Para cuidar el consumo el envío es espaciado: al abrir la app (o volver a ella) cada 30 segundos durante los primeros 2 minutos y después cada 2 minutos (ver intervaloDeEnvio). Solo se guarda la
//      última posición: al terminar la solicitud la app del técnico borra el documento, y el ADMIN borra las que se quedaron sin solicitud (posicionesHuerfanas).
//   2. Un punto en lo que el técnico ya hace: al marcar "En camino" y "Llegué" y al pre-finalizar, la app guarda una lectura (ultimaUbicacion/{TECNICO}: { lat, lng, precision, en, motivo, codigo? }).
//      La oficina la ve como "última ubicación conocida" mientras tenga menos de 24 horas; las más viejas el ADMIN las borra (ultimasViejas). No es seguimiento: es un solo punto por acción.
// Las reglas de Firestore piden lo mismo que este archivo (firestore.rules, "Ubicación de los técnicos").

export const DURACION_SOLICITUD_MS = 30 * 60 * 1000;
export const INTERVALO_RAPIDO_MS = 30 * 1000;
export const INTERVALO_LENTO_MS = 120 * 1000;
// Cuántos envíos van seguidos a ritmo rápido antes de pasar al lento (30 s x 4 = los primeros 2 minutos).
export const ENVIOS_RAPIDOS = 4;
// Una posición más vieja que esto (algo más que un envío lento perdido) ya no se muestra como "en vivo".
export const EN_VIVO_MS = 150 * 1000;
export const RETENCION_ULTIMA_MS = 24 * 3600 * 1000;
export const MAX_PRECISION_M = 100000;
export const PROBLEMAS = { DENEGADO: 'denegado', SIN_GPS: 'sin-gps' };
export const MOTIVOS_PUNTO = { camino: 'al salir hacia el cliente', llegada: 'al marcar que llegó', prefinalizar: 'al pre-finalizar' };
export const ESTADOS = { NINGUNA: 'ninguna', ESPERANDO: 'esperando', EN_VIVO: 'en-vivo', SIN_SENAL: 'sin-senal', DENEGADO: 'denegado', SIN_GPS: 'sin-gps', DETENIDA: 'detenida', VENCIDA: 'vencida' };

// Cuánto esperar antes del siguiente envío, según cuántos van en esta ráfaga (se reinicia al volver a la app): 30 s los primeros 4 y 2 min después.
export const intervaloDeEnvio = (enviados) => (enviados < ENVIOS_RAPIDOS ? INTERVALO_RAPIDO_MS : INTERVALO_LENTO_MS);

// El id de los documentos: el nombre del técnico en mayúsculas (así lo comparan las reglas con el perfil). null si no sirve como id de Firestore.
export function idDeTecnico(nombre) {
  const id = String(nombre ?? '').toUpperCase();
  if (!id.trim() || id.includes('/') || id === '.' || id === '..' || id.length > 150) return null;
  return id;
}

// La solicitud que escribe la oficina (reemplaza la anterior del mismo técnico).
export const nuevaSolicitud = (usuario, ahora = Date.now()) => ({
  pedidaPor: String(usuario || '').slice(0, 80),
  pedidaEn: ahora,
  venceEn: ahora + DURACION_SOLICITUD_MS,
  detenidaEn: 0,
});

// Lo que se escribe para detenerla (la oficina, o el sistema); `por`: 'OFICINA'.
export const detencion = (por = 'OFICINA', ahora = Date.now()) => ({ detenidaEn: ahora, detenidaPor: String(por).slice(0, 80) });

export const solicitudVigente = (s, ahora = Date.now()) => Boolean(s) && Number(s.pedidaEn) > 0 && Number(s.venceEn) > ahora && !(Number(s.detenidaEn) > 0);

const redondear = (n, decimales) => Math.round(n * 10 ** decimales) / 10 ** decimales;

// La lectura del GPS (`coords` de Geolocation) -> documento de ubicación, o null si no trae un punto válido.
export function armarPosicion(coords, solicitudEn, ahora = Date.now()) {
  const lat = Number(coords?.latitude);
  const lng = Number(coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const precision = Number(coords?.accuracy);
  return {
    lat: redondear(lat, 6),
    lng: redondear(lng, 6),
    precision: Number.isFinite(precision) && precision >= 0 ? Math.min(Math.round(precision), MAX_PRECISION_M) : 0,
    en: ahora,
    solicitudEn,
  };
}

// Cuando no se pudo leer el GPS (permiso negado o sin señal): lo único que la oficina necesita saber.
export const armarProblema = (problema, solicitudEn, ahora = Date.now()) => ({ problema: problema === PROBLEMAS.DENEGADO ? PROBLEMAS.DENEGADO : PROBLEMAS.SIN_GPS, en: ahora, solicitudEn });

// Las posiciones que ya no sirven: no hay solicitud vigente a la que respondan (la app del técnico se cerró, o perdió la conexión, antes de borrarla). El ADMIN las borra al abrir el módulo, para que
// la última ubicación de un técnico no se quede guardada. -> [id]
export function posicionesHuerfanas(solicitudes, ubicaciones, ahora = Date.now()) {
  return Object.entries(ubicaciones || {})
    .filter(([id, u]) => { const s = solicitudes?.[id]; return !solicitudVigente(s, ahora) || Number(u?.solicitudEn) !== Number(s.pedidaEn); })
    .map(([id]) => id);
}

// Lo que dice la pantalla de la oficina de un técnico, a partir de su solicitud y de su ubicación (cualquiera puede faltar). Solo cuenta la ubicación que pertenece a esa solicitud.
export function estadoUbicacion(solicitud, ubicacion, ahora = Date.now()) {
  if (!solicitud || !(Number(solicitud.pedidaEn) > 0)) return ESTADOS.NINGUNA;
  if (!solicitudVigente(solicitud, ahora)) return Number(solicitud.detenidaEn) > 0 ? ESTADOS.DETENIDA : ESTADOS.VENCIDA;
  const mia = ubicacion && Number(ubicacion.solicitudEn) === Number(solicitud.pedidaEn) ? ubicacion : null;
  if (!mia) return ESTADOS.ESPERANDO;
  if (mia.problema) return mia.problema === PROBLEMAS.DENEGADO ? ESTADOS.DENEGADO : ESTADOS.SIN_GPS;
  return ahora - Number(mia.en) <= EN_VIVO_MS ? ESTADOS.EN_VIVO : ESTADOS.SIN_SENAL;
}

// "hace 12 s", "hace 3 min", "hace 1 h".
export function haceCuanto(ms, ahora = Date.now()) {
  const s = Math.max(0, Math.round((ahora - Number(ms)) / 1000));
  if (s < 5) return 'ahora mismo';
  if (s < 60) return `hace ${s} s`;
  const min = Math.floor(s / 60);
  return min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h`;
}

// Cuánto falta para que termine la solicitud: "9:41".
export function tiempoRestante(solicitud, ahora = Date.now()) {
  const s = Math.max(0, Math.ceil((Number(solicitud?.venceEn) - ahora) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const enlaceGoogleMaps = ({ lat, lng }) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

// El punto de una acción (En camino, Llegué, pre-finalizar) -> documento de última ubicación, o null si la lectura no trae un punto válido. `codigo`: la orden (opcional).
export function armarPunto(coords, motivo, codigo = '', ahora = Date.now()) {
  const posicion = armarPosicion(coords, 0, ahora);
  if (!posicion || !MOTIVOS_PUNTO[motivo]) return null;
  const { lat, lng, precision, en } = posicion;
  const orden = String(codigo || '').slice(0, 40);
  return { lat, lng, precision, en, motivo, ...(orden ? { codigo: orden } : {}) };
}

export const ultimaVigente = (u, ahora = Date.now()) => Boolean(u) && Number.isFinite(u.lat) && Number.isFinite(u.lng) && ahora - Number(u.en) < RETENCION_ULTIMA_MS;

// Las últimas ubicaciones con más de 24 horas: el ADMIN las borra al abrir el módulo. -> [id]
export const ultimasViejas = (ultimas, ahora = Date.now()) => Object.entries(ultimas || {}).filter(([, u]) => !ultimaVigente(u, ahora)).map(([id]) => id);
