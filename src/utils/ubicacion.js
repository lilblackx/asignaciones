// Ubicación de una orden: enlace de Google Maps (como lo mandan las promotoras)
// o coordenadas "lat, lng". Se normaliza a una URL https de Google Maps y solo
// se aceptan esos dominios: el valor termina en un href, así que nunca debe
// aceptar otros esquemas (javascript:, data:) ni sitios cualquiera.

const COORDENADAS = /^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/;
// Google mete apóstrofes literales en la URL (coordenadas en grados: 38'07.1"),
// así que "'" no puede cortar el enlace; sí las comillas dobles y los espacios.
const URL_EN_TEXTO = /https?:\/\/[^\s<>"]+/gi;

function urlDeGoogleMaps(candidata) {
  let url;
  try {
    url = new URL(candidata.replace(/[.,;)\]']+$/, ''));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const esMapsGoogle = /^maps\.google\.[a-z.]+$/.test(host);
  const esGoogleConRutaMaps = /^(www\.)?google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps');
  const esCorto = host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps'));
  if (!esMapsGoogle && !esGoogleConRutaMaps && !esCorto) return null;
  url.protocol = 'https:';
  // Si trae coordenadas se guarda un enlace corto y limpio; los enlaces cortos
  // de Google (maps.app.goo.gl) no las traen y se guardan tal cual.
  const coords = coordenadasDeUrl(url);
  return coords ? enlaceDeCoordenadas(coords.lat, coords.lng) : url.href;
}

const enlaceDeCoordenadas = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

const coordenadasValidas = (lat, lng) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// En un enlace largo de Google Maps hay hasta tres pares de coordenadas. En orden
// de fiabilidad: el pin exacto (!3d..!4d), el parámetro q/query/ll, y por último
// "@lat,lng", que es solo el centro de la vista del mapa (puede no ser el pin).
function coordenadasDeUrl(url) {
  const par = (re, texto) => {
    const m = texto.match(re);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    return coordenadasValidas(lat, lng) ? { lat, lng } : null;
  };
  const numero = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const desdePin = par(new RegExp(`!3d${numero}!4d${numero}`), url.pathname + url.search);
  if (desdePin) return desdePin;
  for (const clave of ['q', 'query', 'll', 'destination']) {
    const valor = url.searchParams.get(clave);
    const desdeParam = valor && par(new RegExp(`^${numero}\\s*,\\s*${numero}$`), valor.trim());
    if (desdeParam) return desdeParam;
  }
  return par(new RegExp(`@${numero},${numero}`), url.pathname);
}

// Enlace para "Cómo llegar": con coordenadas inicia la navegación hacia el
// punto desde donde esté el técnico; sin ellas abre el enlace guardado.
export function getEnlaceNavegacion(ubicacion) {
  const url = getUbicacionUrl(ubicacion);
  if (!url) return null;
  const m = url.match(/^https:\/\/www\.google\.com\/maps\?q=(-?[\d.]+),(-?[\d.]+)$/);
  return m ? `https://www.google.com/maps/dir/?api=1&destination=${m[1]},${m[2]}` : url;
}

// { vacio: true } | { error } | { valor: 'https://...' }
export function normalizarUbicacion(raw) {
  const texto = String(raw ?? '').trim();
  if (texto === '') return { vacio: true };

  const coords = texto.match(COORDENADAS);
  if (coords) {
    const lat = parseFloat(coords[1]);
    const lng = parseFloat(coords[2]);
    if (coordenadasValidas(lat, lng)) return { valor: enlaceDeCoordenadas(lat, lng) };
    return { error: 'Coordenadas fuera de rango.' };
  }

  for (const candidata of texto.match(URL_EN_TEXTO) || []) {
    const url = urlDeGoogleMaps(candidata);
    if (url) return { valor: url };
  }
  return { error: 'Usa un enlace de Google Maps o coordenadas (ej. 10.4806, -66.9036).' };
}

// Coordenadas de la NAP. Se copian con texto alrededor ("Lat: 10.66 / Lng: -71.70")
// y se guardan solo como "lat, lng". Exige exactamente dos números.
// { vacio: true } | { error } | { valor: 'lat, lng', enlace: 'https://...' }
export function normalizarCoordenadasNap(raw) {
  const texto = String(raw ?? '').trim();
  if (texto === '') return { vacio: true };
  const numeros = texto.match(/-?\d+(?:\.\d+)?/g) || [];
  if (numeros.length !== 2) return { error: 'Pega las coordenadas, ej. Lat: 10.6616 / Lng: -71.7061' };
  const [lat, lng] = numeros;
  if (!coordenadasValidas(parseFloat(lat), parseFloat(lng))) return { error: 'Coordenadas fuera de rango.' };
  return { valor: `${lat}, ${lng}`, enlace: enlaceDeCoordenadas(lat, lng) };
}

// "Cómo llegar" a la NAP: inicia la navegación hacia sus coordenadas.
export function getEnlaceNavegacionNap(napCoordenadas) {
  const { valor } = normalizarCoordenadasNap(napCoordenadas);
  return valor ? `https://www.google.com/maps/dir/?api=1&destination=${valor.replace(/\s/g, '')}` : null;
}

// Primer enlace de Google Maps dentro de un texto largo (la plantilla de la
// promotora). null si no hay ninguno.
export function extraerUbicacionDeTexto(texto) {
  for (const candidata of String(texto || '').match(URL_EN_TEXTO) || []) {
    const url = urlDeGoogleMaps(candidata);
    if (url) return url;
  }
  return null;
}

// Instalación aún abierta a la que le falta la ubicación (la promotora la manda
// aparte de la plantilla, así que suele llegar después).
export const instalacionSinUbicacion = (ticket) =>
  String(ticket?.tipoTrabajo || '').toUpperCase().includes('INSTAL')
  && ['PENDIENTE', 'PRE-FINALIZADO', 'PRE-FINALIZADA'].includes(ticket.estado)
  && !ticket.ubicacion;

// Para renderizar: href seguro o null (también revalida datos ya guardados).
export function getUbicacionUrl(ubicacion) {
  return normalizarUbicacion(ubicacion).valor || null;
}
