import { createRemoteJWKSet, jwtVerify } from 'jose';

// Busca las coordenadas de una NAP en Tomodat a partir de su código (ej. N10D14).
// El token de Tomodat vive solo aquí (secreto TOMODAT_TOKEN); la app nunca lo ve.
// Solo hace lecturas: expone una única consulta, POST /nap { codigo }.
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

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers });

    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return new Response('Falta Authorization Bearer', { status: 401, headers });
    try {
      await verifyIdToken(idToken, env.FIREBASE_PROJECT_ID);
    } catch (err) {
      return new Response(`Token inválido: ${err.message}`, { status: 401, headers });
    }

    const { pathname } = new URL(request.url);
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
