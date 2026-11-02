// Consulta pública del estado de una solicitud: el cliente escribe su cédula en la web de la empresa y ve sus solicitudes.
//   POST /consulta/estado    cuerpo { cedula, turnstile? }   ->   { solicitudes: [ { codigo, tipo, estado, etiqueta, tecnico, solicitadaEn, programadaPara, cerradaEn } ] }
// No lleva usuario de Firebase (el cliente no tiene cuenta): lo protegen tres cosas. 1) Lo que sale lo decide src/utils/consultaCliente.js (solo estado,
// tipo, código, técnico y fechas: nada del cobro, la dirección, el teléfono ni el nombre del cliente). 2) Un tope de consultas por IP (binding
// LIMITADOR_CONSULTA de wrangler.toml). 3) Opcional: Cloudflare Turnstile (secreto TURNSTILE_SECRET): si está configurado, cada consulta exige su prueba.
// Una cédula sin solicitudes responde lo mismo que una que no existe (lista vacía): no se puede saber si alguien es cliente.
//
// Lecturas de Firestore: una consulta a `tickets` (las activas) y una a `historialInstalaciones` (las ya cerradas por el cierre del día, 30 días) por cédula;
// cada documento leído se cobra, y una consulta sin resultados cobra una lectura. Para que nadie pueda gastar la cuota diaria (que comparte la app del personal):
//   - La respuesta de cada cédula se guarda CACHE_CONSULTA_MS en memoria del Worker: repetirla cuesta 0 lecturas (y no cuenta para el tope de abajo).
//   - Un tope global por día (CONSULTA_LIMITE_DIARIO, 500 por defecto): se cuenta cada consulta que sí lee Firestore en un contador atómico
//     (colección consultasCliente, un documento por día de Venezuela); pasado el tope responde 503 hasta el día siguiente. Cada consulta cuesta ~2 lecturas
//     y 1 escritura, así que el tope máximo gasta ~1.000 de las 50.000 lecturas diarias (2 %).
import { cedulaDeConsulta, solicitudesDeCliente, diaCaracas, DIAS_DE_CONSULTA } from '../../src/utils/consultaCliente.js';
import { camposAObjeto } from './materiales-api.js';

export const RUTA_CONSULTA = '/consulta/estado';
const VERIFICACION_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const CACHE_CONSULTA_MS = 5 * 60 * 1000;
export const LIMITE_DIARIO_POR_DEFECTO = 500;
const MAX_ENTRADAS_CACHE = 200;

// Copias en memoria con vencimiento: cédula -> { hasta, promesa }. Se guarda la promesa para que las consultas simultáneas de la misma cédula compartan una sola
// lectura; si falla, no se queda guardada. Vive en cada instancia del Worker (no se comparte entre ellas), por eso el tope diario no depende de ella.
const copias = new Map();
export const vaciarCacheConsulta = () => copias.clear();

// Solo lo que arma la respuesta: nada más se descarga.
const CAMPOS_ORDEN = ['codigo', 'estado', 'tecnico', 'tipoTrabajo', 'fechaProgramada', 'enCamino', 'createdAt', 'finalizadoEn', 'canceladaEn'];
const CAMPOS_HISTORIAL = ['codigo', 'estado', 'tecnico', 'tipoTrabajo', 'creadaEn', 'finalizadoEn', 'canceladaEn'];

export function corsConsulta(env, origin) {
  const permitidos = (env.CONSULTA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': permitidos.includes(origin) ? origin : permitidos[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const respuesta = (cuerpo, status, headers, extra = {}) => new Response(JSON.stringify(cuerpo), {
  status,
  // Datos de un cliente: que ningún intermediario los guarde.
  headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});

async function ordenesConCedula(env, accessToken, coleccion, variantes, campos) {
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: coleccion }],
      where: { fieldFilter: { field: { fieldPath: 'cedula' }, op: 'IN', value: { arrayValue: { values: variantes.map((stringValue) => ({ stringValue })) } } } },
      select: { fields: campos.map((fieldPath) => ({ fieldPath })) },
    } }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery falló: ${await res.text()}`);
  return (await res.json()).filter((r) => r.document).map((r) => ({ ...camposAObjeto(r.document.fields), id: r.document.name.split('/').pop() }));
}

// Suma 1 al contador del día (hora de Venezuela) y devuelve cuántas consultas lleva ya. Una sola escritura atómica: sin lectura previa y sin carreras entre instancias.
async function contarConsultaDelDia(env, accessToken, ahoraMs) {
  const dia = diaCaracas(ahoraMs);
  const nombre = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data/consultasCliente/${dia}`;
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ writes: [{
      update: { name: nombre, fields: { dia: { stringValue: dia } } },
      updateMask: { fieldPaths: ['dia'] },
      updateTransforms: [{ fieldPath: 'consultas', increment: { integerValue: '1' } }],
    }] }),
  });
  if (!res.ok) throw new Error(`No se pudo contar la consulta: ${await res.text()}`);
  return Number((await res.json()).writeResults?.[0]?.transformResults?.[0]?.integerValue);
}

class TopeDiario extends Error {}

async function solicitudesDeLaCedula(env, obtenerToken, cedula, ahoraMs) {
  const accessToken = await obtenerToken(env);
  const limite = Number(env.CONSULTA_LIMITE_DIARIO) || LIMITE_DIARIO_POR_DEFECTO;
  // Si el contador falla no se lee nada: sin él no hay tope, y el tope es lo que protege la cuota.
  if (!((await contarConsultaDelDia(env, accessToken, ahoraMs)) <= limite)) throw new TopeDiario();
  const [activas, historial] = await Promise.all([
    ordenesConCedula(env, accessToken, 'tickets', cedula.variantes, CAMPOS_ORDEN),
    ordenesConCedula(env, accessToken, 'historialInstalaciones', cedula.variantes, CAMPOS_HISTORIAL),
  ]);
  return solicitudesDeCliente([...activas, ...historial], ahoraMs);
}

async function recordarSolicitudes(env, obtenerToken, cedula, ahoraMs) {
  const copia = copias.get(cedula.digitos);
  if (copia && copia.hasta > ahoraMs) return copia.promesa;
  const promesa = solicitudesDeLaCedula(env, obtenerToken, cedula, ahoraMs);
  copias.delete(cedula.digitos);
  copias.set(cedula.digitos, { hasta: ahoraMs + CACHE_CONSULTA_MS, promesa });
  // Tope de entradas: primero se descarta lo vencido y, si hace falta, lo más antiguo.
  for (const [k, c] of copias) if (copias.size > MAX_ENTRADAS_CACHE && c.hasta <= ahoraMs) copias.delete(k);
  while (copias.size > MAX_ENTRADAS_CACHE) copias.delete(copias.keys().next().value);
  try {
    return await promesa;
  } catch (err) {
    // Un fallo o el tope no se guardan: la siguiente consulta lo vuelve a intentar.
    if (copias.get(cedula.digitos)?.promesa === promesa) copias.delete(cedula.digitos);
    throw err;
  }
}

async function turnstileValido(env, token, ip) {
  if (!token) return false;
  const res = await fetch(VERIFICACION_TURNSTILE, { method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(token).slice(0, 2048), ...(ip ? { remoteip: ip } : {}) }) });
  return res.ok && (await res.json()).success === true;
}

// `obtenerToken`: devuelve el token de Google del Worker (se pasa desde index.js para no repetir esa lógica).
export async function manejarConsultaCliente(request, env, obtenerToken, ahoraMs = Date.now()) {
  const headers = corsConsulta(env, request.headers.get('Origin') || '');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respuesta({ error: 'Método no permitido.' }, 405, headers, { Allow: 'POST, OPTIONS' });

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (env.LIMITADOR_CONSULTA) {
    const { success } = await env.LIMITADOR_CONSULTA.limit({ key: ip || 'sin-ip' });
    if (!success) return respuesta({ error: 'Demasiadas consultas. Espera un minuto e intenta de nuevo.' }, 429, headers, { 'Retry-After': '60' });
  }

  let cuerpo;
  try { cuerpo = await request.json(); } catch { return respuesta({ error: 'Solicitud inválida.' }, 400, headers); }

  if (env.TURNSTILE_SECRET && !(await turnstileValido(env, cuerpo?.turnstile, ip).catch(() => false))) {
    return respuesta({ error: 'No se pudo verificar que eres una persona. Recarga la página e intenta de nuevo.' }, 403, headers);
  }

  const cedula = cedulaDeConsulta(cuerpo?.cedula);
  if (!cedula) return respuesta({ error: 'Escribe tu cédula (solo números, de 6 a 9 dígitos).' }, 400, headers);

  try {
    const solicitudes = await recordarSolicitudes(env, obtenerToken, cedula, ahoraMs);
    return respuesta({ solicitudes, diasDeConsulta: DIAS_DE_CONSULTA }, 200, headers);
  } catch (err) {
    if (err instanceof TopeDiario) {
      console.error('Consulta de cliente: se alcanzó el tope diario.');
      return respuesta({ error: 'La consulta está muy solicitada hoy. Intenta de nuevo mañana o escríbenos por WhatsApp.' }, 503, headers, { 'Retry-After': '3600' });
    }
    console.error('Consulta de cliente falló:', err);
    return respuesta({ error: 'No pudimos consultar en este momento. Intenta de nuevo en unos minutos.' }, 500, headers);
  }
}
