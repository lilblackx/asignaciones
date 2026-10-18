import { createRemoteJWKSet, jwtVerify } from 'jose';

// Busca las coordenadas de una NAP en Tomodat a partir de su código (ej. N10D14).
// El token de Tomodat vive solo aquí (secreto TOMODAT_TOKEN); la app nunca lo ve.
// Solo hace lecturas. Consultas:
//   POST /nap { codigo }     coordenadas de una caja NAP en Tomodat
//   POST /onu { cedula }     datos del cliente en SmartOLT (ver buscarOnus)
//   POST /onu/senal { ticketId }  potencia óptica de la ONU del cliente de esa orden
// El token de SmartOLT vive aquí también (secreto SMARTOLT_API_KEY).
//
// Descargar el catálogo completo de Tomodat es lento, así que las consultas
// nunca esperan esa descarga si hay una copia guardada:
//   - Un cron (ver wrangler.toml) la renueva cada pocos minutos y la guarda en KV
//     (binding CATALOGO), compartida por todas las instancias del Worker.
//   - Cada consulta lee de memoria o de KV. Si la copia está vencida, se responde
//     igual con ella y se renueva por detrás (stale-while-revalidate).
//   - Si Tomodat falla, se sigue sirviendo la última copia: las coordenadas de
//     una NAP casi nunca cambian.
//   - Solo la primera vez (sin ninguna copia) la consulta espera a Tomodat.
// Sin el binding CATALOGO funciona igual, pero la copia vive solo en memoria.

const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CATALOGO_TTL_MS = 15 * 60 * 1000; // pasado este tiempo la copia se renueva por detrás
const CATALOGO_KV_KEY = 'catalogo';
const CATALOGO_KV_EXPIRA_S = 7 * 24 * 60 * 60;
const REINTENTO_TRAS_FALLO_MS = 60 * 1000;
const MAX_RESULTADOS = 10;

let cachedFirebaseJwks = null;
let catalogo = null; // { puntos, actualizadoEn }
let catalogoEnCurso = null;
let proximoIntento = 0; // tras un fallo de Tomodat, no insistir en cada consulta

function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function verifyIdToken(idToken, projectId) {
  if (!cachedFirebaseJwks) cachedFirebaseJwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  const { payload } = await jwtVerify(idToken, cachedFirebaseJwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (!payload.sub) throw new Error('Token sin sub');
  return payload;
}

// Un token válido de Firebase no basta: cualquiera puede crear una cuenta de Auth
// con la apiKey pública. Solo cuenta quien tiene perfil en "users" y no está
// deshabilitado. El perfil se lee con el propio token del usuario (las reglas le
// dejan leer el suyo), así este Worker no necesita una cuenta de servicio.
// Devuelve el rol, o null si no es un usuario activo de la app.
const PERFIL_CACHE_MS = 60 * 1000;
const perfiles = new Map(); // uid -> { rol, hasta }

async function rolActivo(env, uid, idToken) {
  const enCache = perfiles.get(uid);
  if (enCache && enCache.hasta > Date.now()) return enCache.rol;
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data/users/${encodeURIComponent(uid)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok && res.status !== 403 && res.status !== 404) throw new Error(`Firestore respondió ${res.status}`);
  const perfil = res.ok ? await res.json() : null;
  const rol = perfil && perfil.fields?.disabled?.booleanValue !== true ? perfil.fields?.role?.stringValue || null : null;
  perfiles.set(uid, { rol, hasta: Date.now() + PERFIL_CACHE_MS });
  return rol;
}

// Mayúsculas y solo letras/dígitos: "NAP O07D05-2" -> "NAPO07D052".
const normalizar = (texto) => String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function descargarCatalogo(env) {
  const [lat, lng] = (env.TOMODAT_CENTRO || '').split(',').map((s) => s.trim());
  const url = `${env.TOMODAT_BASE_URL}/access_points/${lat}/${lng}/${env.TOMODAT_RADIO}`;
  const res = await fetch(url, { headers: { Authorization: env.TOMODAT_TOKEN } });
  if (!res.ok) throw new Error(`Tomodat respondió ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Tomodat: ${data?.message || 'respuesta inesperada'}`);
  const tipos = (env.TOMODAT_TIPOS || '3,8').split(',').map((s) => Number(s.trim()));
  return data
    .filter((p) => tipos.includes(Number(p.access_point_type_id)) && p.dot)
    .map((p) => ({
      nombre: String(p.name || ''),
      clave: normalizar(p.name),
      tipo: Number(p.access_point_type_id),
      lat: Number(p.dot.lat),
      lng: Number(p.dot.lng),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

// Una sola descarga a la vez: las consultas simultáneas comparten la misma.
// Guarda el resultado en memoria y en KV.
function refrescarCatalogo(env) {
  if (!catalogoEnCurso) {
    catalogoEnCurso = descargarCatalogo(env)
      .then(async (puntos) => {
        catalogo = { puntos, actualizadoEn: Date.now() };
        if (env.CATALOGO) {
          await env.CATALOGO.put(CATALOGO_KV_KEY, JSON.stringify(catalogo), { expirationTtl: CATALOGO_KV_EXPIRA_S })
            .catch((err) => console.error('No se pudo guardar el catálogo en KV:', err));
        }
        return puntos;
      })
      .catch((err) => { proximoIntento = Date.now() + REINTENTO_TRAS_FALLO_MS; throw err; })
      .finally(() => { catalogoEnCurso = null; });
  }
  return catalogoEnCurso;
}

async function leerCatalogoKv(env) {
  if (!env.CATALOGO) return null;
  try {
    const guardado = await env.CATALOGO.get(CATALOGO_KV_KEY, { type: 'json', cacheTtl: 60 });
    return Array.isArray(guardado?.puntos) ? guardado : null;
  } catch (err) {
    console.error('No se pudo leer el catálogo de KV:', err);
    return null;
  }
}

async function getCatalogo(env, ctx) {
  const ahora = Date.now();
  const copia = catalogo || await leerCatalogoKv(env);
  if (copia) {
    catalogo = copia;
    if (ahora - copia.actualizadoEn > CATALOGO_TTL_MS && ahora >= proximoIntento) {
      const renovacion = refrescarCatalogo(env).catch((err) => console.error('No se pudo renovar el catálogo:', err));
      ctx?.waitUntil?.(renovacion);
    }
    return copia.puntos;
  }
  return refrescarCatalogo(env);
}

// Primero coincidencia exacta ("N10D14" o "NAP N10D14"; el "-2" cuenta como parte
// del nombre). Si no hay ninguna, nombres que contengan el código ("MDT ALTOS
// III (O02B29)"). Dentro de cada grupo, las cajas tipo 3 (NAP) van primero.
function buscar(puntos, codigo) {
  const q = normalizar(codigo);
  const exactos = puntos.filter((p) => p.clave === q || p.clave === `NAP${q}`);
  const lista = exactos.length > 0 ? exactos : puntos.filter((p) => p.clave.includes(q));
  return lista
    .sort((a, b) => (a.tipo === 3 ? 0 : 1) - (b.tipo === 3 ? 0 : 1))
    .slice(0, MAX_RESULTADOS)
    .map(({ nombre, tipo, lat, lng }) => ({ nombre, tipo, lat, lng }));
}

// ---------------------------------------------------------------------------
// SmartOLT: datos del cliente a partir de su cédula, para autocompletar la
// orden al crearla. Usa get_all_onus_details paginado y filtrado por nombre
// (coincidencia parcial): cuenta contra el presupuesto general de la API, no
// contra el export completo (15/hora). Cada búsqueda son 1 o 2 llamadas.
// ---------------------------------------------------------------------------

// Solo lo que necesita una orden nueva (nada de estado, señal ni datos de red).
const CAMPOS_ONU = 'unique_external_id,name,address,zone_name,odb_name,odb_port,latitude,longitude,contact';
// Para consultar la potencia: el mismo cliente más los valores de señal (dBm) y su calidad.
const CAMPOS_SENAL = 'unique_external_id,name,address,zone_name,status,signal,signal_1310,signal_1490';
const MAX_ONUS = 10;
const SMARTOLT_TIMEOUT_MS = 20000;

// SmartOLT a veces tarda muchos segundos. Si la app corta la espera y reintenta, la
// segunda consulta se une a la que sigue en curso (o usa su resultado, guardado un
// momento) en vez de empezar de cero. Solo se guardan resultados exitosos.
const ONUS_CACHE_MS = 2 * 60 * 1000;
const onusPorCedula = new Map(); // dígitos -> { promesa, hasta }

function buscarOnusCompartido(env, digitos, ctx) {
  const ahora = Date.now();
  const previo = onusPorCedula.get(digitos);
  if (previo && previo.hasta > ahora) return previo.promesa;
  const entrada = { promesa: null, hasta: ahora + SMARTOLT_TIMEOUT_MS * 3 };
  entrada.promesa = buscarOnus(env, digitos).then(
    (resultados) => { entrada.hasta = Date.now() + ONUS_CACHE_MS; return resultados; },
    (err) => { if (onusPorCedula.get(digitos) === entrada) onusPorCedula.delete(digitos); throw err; },
  );
  onusPorCedula.set(digitos, entrada);
  if (onusPorCedula.size > 200) {
    for (const [clave, e] of onusPorCedula) if (e.hasta <= ahora) onusPorCedula.delete(clave);
  }
  ctx?.waitUntil?.(entrada.promesa.catch(() => {}));
  return entrada.promesa;
}

const soloDigitos = (texto) => String(texto || '').replace(/\D/g, '');

// ¿El texto contiene ese documento completo (no como parte de un número más largo)?
// Tolera los puntos de miles: "V-12.345.678" contiene 12345678.
export function contieneDocumento(texto, digitos) {
  if (!digitos) return false;
  const plano = String(texto || '').replace(/(?<=\d)\.(?=\d{3}(\D|$))/g, '');
  return new RegExp(`(?<!\\d)${digitos}(?!\\d)`).test(plano);
}

const textoONulo = (v) => {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
};

// Puerto de la caja NAP (splitter) donde está el cliente, como número ("3"); null si SmartOLT no lo tiene
// o no trae un número mayor a 0.
export function puertoDeOdb(valor) {
  const m = String(valor ?? '').match(/\d{1,3}/);
  return m && Number(m[0]) > 0 ? String(Number(m[0])) : null;
}

// Respuesta de SmartOLT -> los datos para crear la orden. `zona` e `idExterno` solo
// sirven para distinguir entre varias ONU del mismo cliente.
export function mapearOnu(o) {
  const lat = o.latitude === null || o.latitude === '' ? NaN : Number(o.latitude);
  const lng = o.longitude === null || o.longitude === '' ? NaN : Number(o.longitude);
  const coordenadasUtiles = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  return {
    idExterno: textoONulo(o.unique_external_id),
    nombre: textoONulo(o.name),
    direccion: textoONulo(o.address),
    telefono: textoONulo(o.contact),
    nap: textoONulo(o.odb_name),
    puerto: puertoDeOdb(o.odb_port),
    zona: textoONulo(o.zone_name),
    latitud: coordenadasUtiles ? lat : null,
    longitud: coordenadasUtiles ? lng : null,
  };
}

// Respuesta de SmartOLT -> potencia de la ONU. `senal1310` y `senal1490` son los dBm
// tal como los guarda SmartOLT (texto, ej. "-19.45"); `calidad` es su clasificación
// ("Very good", "Warning", "Critical"...). La señal de SmartOLT es la última que midió
// la OLT, no una medición en este instante: con la ONU fuera de línea SmartOLT sigue
// devolviendo el último valor guardado, aunque su pantalla muestre "-". Por eso se envía
// también `estado` ("Online", "Offline", "Power fail", "LOS"...).
export function mapearSenal(o) {
  return {
    idExterno: textoONulo(o.unique_external_id),
    nombre: textoONulo(o.name),
    direccion: textoONulo(o.address),
    zona: textoONulo(o.zone_name),
    estado: textoONulo(o.status),
    senal1310: textoONulo(o.signal_1310),
    senal1490: textoONulo(o.signal_1490),
    calidad: textoONulo(o.signal),
  };
}

// El listado de SmartOLT guarda cada señal por separado y a veces falta una (en ~1 % de las ONU en línea falta
// la de 1490 nm). Su consulta de señal en vivo (la que usa su pantalla de detalle) sí trae las dos, aunque de vez
// en cuando responde "-" en ambas. Solo se usa cuando al listado le falta algo y la ONU está en línea.
const tieneNumero = (v) => /\d/.test(String(v ?? ''));
const estaEnLinea = (estado) => !String(estado ?? '').trim() || /^online$/i.test(String(estado).trim());
const numeroDeSenal = (v) => String(v ?? '').match(/-?\d+(?:[.,]\d+)?/)?.[0] ?? null; // "-33.01 dBm" -> "-33.01"; "-" -> null
const REINTENTOS_SENAL_EN_VIVO = 3;
const PAUSA_REINTENTO_MS = 700;

async function senalEnVivo(env, idExterno) {
  const res = await fetch(`${env.SMARTOLT_BASE_URL}/api/onu/get_onu_signal/${encodeURIComponent(idExterno)}`, {
    headers: { 'X-Token': env.SMARTOLT_API_KEY },
    signal: AbortSignal.timeout(SMARTOLT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`SmartOLT respondió ${res.status}`);
  const d = await res.json();
  if (d?.status === false) throw new Error(`SmartOLT: ${d?.error || 'respuesta inesperada'}`);
  return { senal1310: numeroDeSenal(d.onu_signal_1310), senal1490: numeroDeSenal(d.onu_signal_1490) };
}

// Completa la señal que le falte a una ONU en línea. Lo que trajo el listado no se cambia; si la consulta en vivo
// falla o no trae el dato, se devuelve la ONU como estaba (la app avisa de lo que falte).
export async function completarSenal(env, onu, { pausa = PAUSA_REINTENTO_MS } = {}) {
  if (!onu.idExterno || !estaEnLinea(onu.estado)) return onu;
  let actual = onu;
  for (let intento = 0; intento < REINTENTOS_SENAL_EN_VIVO && !(tieneNumero(actual.senal1310) && tieneNumero(actual.senal1490)); intento++) {
    if (intento > 0 && pausa) await new Promise((r) => setTimeout(r, pausa));
    try {
      const vivo = await senalEnVivo(env, onu.idExterno);
      actual = {
        ...actual,
        senal1310: tieneNumero(actual.senal1310) ? actual.senal1310 : (vivo.senal1310 ?? actual.senal1310),
        senal1490: tieneNumero(actual.senal1490) ? actual.senal1490 : (vivo.senal1490 ?? actual.senal1490),
      };
    } catch (err) {
      console.error('No se pudo leer la señal en vivo de SmartOLT:', err.message);
    }
  }
  return actual;
}

// Si SmartOLT limita las consultas (429), espera lo que pide y reintenta una vez: crear órdenes seguidas
// (o varias personas buscando a la vez) puede topar con el límite por unos segundos.
const ESPERA_MAX_429_MS = 6000;
const ESPERA_429_POR_DEFECTO_MS = 2000;
// Los fallos de pasarela que llegan al instante (502, 503, 504) suelen ser un tropiezo de un momento: se reintenta una vez. El 522 y el 524
// (SmartOLT no contestó en ~20 s) no se reintentan: cada intento tardaría otro tanto y el técnico esperaría el doble.
const FALLOS_RAPIDOS = [502, 503, 504];
const PAUSA_FALLO_RAPIDO_MS = 1000;

// Un problema de SmartOLT ya explicado en palabras claras: se muestra tal cual, sin el prefijo "No se pudo consultar SmartOLT:".
export class ErrorSmartOlt extends Error {}
const mensajeParaApp = (err) => (err instanceof ErrorSmartOlt ? err.message
  : `No se pudo consultar SmartOLT: ${err.name === 'TimeoutError' ? 'SmartOLT tardó demasiado en responder' : err.message}`);

async function pedirOnus(env, params) {
  return fetch(`${env.SMARTOLT_BASE_URL}/api/onu/get_all_onus_details?${params}`, {
    headers: { 'X-Token': env.SMARTOLT_API_KEY },
    signal: AbortSignal.timeout(SMARTOLT_TIMEOUT_MS),
  });
}

async function consultarOnus(env, filtro, valor, campos = CAMPOS_ONU) {
  const params = new URLSearchParams({ page: '1', page_size: '25', fields: campos, [filtro]: valor });
  let res = await pedirOnus(env, params);
  if (res.status === 429) {
    const segundos = Number(res.headers.get('Retry-After'));
    const espera = Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : ESPERA_429_POR_DEFECTO_MS;
    if (espera <= ESPERA_MAX_429_MS) {
      await new Promise((r) => setTimeout(r, espera));
      res = await pedirOnus(env, params);
    }
  }
  if (FALLOS_RAPIDOS.includes(res.status)) {
    await new Promise((r) => setTimeout(r, PAUSA_FALLO_RAPIDO_MS));
    res = await pedirOnus(env, params);
  }
  if (res.status === 429) throw new ErrorSmartOlt(`SmartOLT limitó las consultas; reintenta en ${res.headers.get('Retry-After') || 'unos'} s.`);
  if (res.status >= 500) throw new ErrorSmartOlt(`SmartOLT no está respondiendo en este momento (error ${res.status}). Intenta en unos minutos.`);
  if (!res.ok) throw new Error(`SmartOLT respondió ${res.status}`);
  const data = await res.json();
  if (data?.status === false || !Array.isArray(data?.onus)) throw new Error(`SmartOLT: ${data?.error || 'respuesta inesperada'}`);
  return data.onus;
}

// 12345678 -> "12.345.678": así guarda SmartOLT la cédula al final del nombre.
export const conPuntosDeMiles = (digitos) => String(digitos).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Busca por nombre (con puntos de miles, como lo guardan; luego sin ellos) y, si no
// hay coincidencia, por ID externo. Solo se devuelven las ONU que de verdad traen
// esa cédula (la búsqueda de SmartOLT es parcial y "1234567" también aparece dentro
// de "91234567"). Normalmente es una sola llamada.
export async function buscarOnus(env, cedula, campos = CAMPOS_ONU, mapear = mapearOnu) {
  const digitos = soloDigitos(cedula);
  const intentos = [
    ['name', conPuntosDeMiles(digitos), 'name'],
    ['name', digitos, 'name'],
    ['external_id', digitos, 'unique_external_id'],
  ];
  for (const [filtro, valor, campo] of intentos) {
    const exactas = (await consultarOnus(env, filtro, valor, campos)).filter((o) => contieneDocumento(o[campo], digitos));
    if (exactas.length > 0) return exactas.slice(0, MAX_ONUS).map(mapear);
  }
  return [];
}

async function handleOnu(request, env, headers, ctx) {
  if (!env.SMARTOLT_API_KEY || !env.SMARTOLT_BASE_URL) {
    return new Response('SmartOLT no está configurado en el Worker.', { status: 503, headers });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('JSON inválido', { status: 400, headers });
  }
  const digitos = soloDigitos(body?.cedula);
  if (digitos.length < 6 || digitos.length > 12) {
    return new Response('cedula debe tener entre 6 y 12 dígitos.', { status: 400, headers });
  }
  try {
    return json({ resultados: await buscarOnusCompartido(env, digitos, ctx) }, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response(mensajeParaApp(err), { status: 502, headers });
  }
}

// Cédula de la orden, leída con el propio token del usuario: las reglas de Firestore
// dejan a cada técnico leer solo sus órdenes, así que no puede consultar la señal de
// clientes ajenos. Devuelve null si no puede leerla.
async function cedulaDeOrden(env, ticketId, idToken) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(ticketId || ''))) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data/tickets/${ticketId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore respondió ${res.status}`);
  const doc = await res.json();
  return soloDigitos(doc.fields?.cedula?.stringValue);
}

async function handleSenal(request, env, headers, idToken) {
  if (!env.SMARTOLT_API_KEY || !env.SMARTOLT_BASE_URL) {
    return new Response('SmartOLT no está configurado en el Worker.', { status: 503, headers });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('JSON inválido', { status: 400, headers });
  }
  try {
    const digitos = await cedulaDeOrden(env, body?.ticketId, idToken);
    if (digitos === null) return new Response('No tienes acceso a esa orden.', { status: 403, headers });
    if (digitos.length < 6 || digitos.length > 12) {
      return new Response('La orden no tiene una cédula válida para consultar.', { status: 400, headers });
    }
    const onus = await buscarOnus(env, digitos, CAMPOS_SENAL, mapearSenal);
    return json({ resultados: await Promise.all(onus.map((o) => completarSenal(env, o))) }, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response(mensajeParaApp(err), { status: 502, headers });
  }
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers });

    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return new Response('Falta Authorization Bearer', { status: 401, headers });
    let payload;
    try {
      payload = await verifyIdToken(idToken, env.FIREBASE_PROJECT_ID);
    } catch (err) {
      return new Response(`Token inválido: ${err.message}`, { status: 401, headers });
    }

    let rol;
    try {
      rol = await rolActivo(env, payload.sub, idToken);
    } catch (err) {
      console.error('No se pudo verificar el perfil:', err);
      return new Response('No se pudo verificar el usuario.', { status: 502, headers });
    }
    if (!rol) return new Response('Usuario sin acceso a la app.', { status: 403, headers });

    const { pathname } = new URL(request.url);
    // Los datos del cliente (SmartOLT) solo los usa quien crea órdenes.
    if (pathname === '/onu') {
      if (rol !== 'ADMIN' && rol !== 'USUARIO') return new Response('Sin permiso para consultar clientes.', { status: 403, headers });
      return handleOnu(request, env, headers, ctx);
    }
    // La potencia la consulta el técnico de su propia orden (ver cedulaDeOrden).
    if (pathname === '/onu/senal') return handleSenal(request, env, headers, idToken);
    if (pathname !== '/nap') return new Response('Not Found', { status: 404, headers });

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('JSON inválido', { status: 400, headers });
    }
    const codigo = normalizar(body?.codigo);
    // Un código corto coincidiría con demasiadas cajas.
    if (codigo.length < 5 || codigo.length > 20) {
      return new Response('codigo debe tener entre 5 y 20 caracteres (ej. N10D14).', { status: 400, headers });
    }

    try {
      const puntos = await getCatalogo(env, ctx);
      return json({ resultados: buscar(puntos, codigo) }, 200, headers);
    } catch (err) {
      console.error(err);
      return new Response(`No se pudo consultar Tomodat: ${err.message}`, { status: 502, headers });
    }
  },

  // Cron: mantiene el catálogo fresco para que ninguna consulta espere a Tomodat.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refrescarCatalogo(env).catch((err) => console.error('Cron: no se pudo renovar el catálogo:', err)));
  },
};

export { buscar, normalizar, getCatalogo };
