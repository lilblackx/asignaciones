import { createRemoteJWKSet, jwtVerify } from 'jose';

// Busca las coordenadas de una NAP en Tomodat a partir de su código (ej. N10D14).
// El token de Tomodat vive solo aquí (secreto TOMODAT_TOKEN); la app nunca lo ve.
// Solo hace lecturas. Consultas:
//   POST /nap { codigo }     coordenadas de una caja NAP en Tomodat
//   POST /onu { cedula }     datos del cliente en SmartOLT (ver buscarOnus)
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
const CAMPOS_ONU = 'unique_external_id,name,address,zone_name,odb_name,latitude,longitude,contact';
const MAX_ONUS = 10;

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
    zona: textoONulo(o.zone_name),
    latitud: coordenadasUtiles ? lat : null,
    longitud: coordenadasUtiles ? lng : null,
  };
}

async function consultarOnus(env, filtro, valor) {
  const params = new URLSearchParams({ page: '1', page_size: '25', fields: CAMPOS_ONU, [filtro]: valor });
  const res = await fetch(`${env.SMARTOLT_BASE_URL}/api/onu/get_all_onus_details?${params}`, { headers: { 'X-Token': env.SMARTOLT_API_KEY } });
  if (res.status === 429) throw new Error(`SmartOLT limitó las consultas; reintenta en ${res.headers.get('Retry-After') || 'unos'} s`);
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
export async function buscarOnus(env, cedula) {
  const digitos = soloDigitos(cedula);
  const intentos = [
    ['name', conPuntosDeMiles(digitos), 'name'],
    ['name', digitos, 'name'],
    ['external_id', digitos, 'unique_external_id'],
  ];
  for (const [filtro, valor, campo] of intentos) {
    const exactas = (await consultarOnus(env, filtro, valor)).filter((o) => contieneDocumento(o[campo], digitos));
    if (exactas.length > 0) return exactas.slice(0, MAX_ONUS).map(mapearOnu);
  }
  return [];
}

async function handleOnu(request, env, headers) {
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
    return json({ resultados: await buscarOnus(env, digitos) }, 200, headers);
  } catch (err) {
    console.error(err);
    return new Response(`No se pudo consultar SmartOLT: ${err.message}`, { status: 502, headers });
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
      return handleOnu(request, env, headers);
    }
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
