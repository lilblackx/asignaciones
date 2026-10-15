// API de solo lectura con la información del módulo de Materiales, para otra aplicación.
//   GET /api/materiales?periodo=MES            (HOY, SEMANA, MES; por defecto MES)
//   GET /api/materiales?desde=2026-10-01&hasta=2026-10-15   (fechas de Venezuela, ambas incluidas)
//   &detalle=0   quita la lista de órdenes de cada técnico (queda solo el resumen)
// Autenticación: la llave del secreto MATERIALES_API_KEY, en "Authorization: Bearer <llave>" o "X-API-Key".
// Sin ese secreto configurado la API queda apagada (503), nunca abierta.
//
// Ahorro de lecturas de Firestore (cada documento leído se cobra):
//   - La respuesta de cada período se guarda CACHE_TTL_MS en memoria del Worker: las llamadas repetidas cuestan 0
//     lecturas (cabecera X-Cache: HIT). Las consultas simultáneas iguales comparten una sola lectura.
//   - Los técnicos casi nunca cambian: se guardan TECNICOS_TTL_MS.
//   - Solo se piden los campos que usa el cálculo (`select`), y las dos listas de órdenes van en una sola consulta.
//   - Los reportes de cierre se piden solo desde el inicio del período.
// La copia vive en cada instancia del Worker (no se comparte entre ellas); si algún día hace falta compartirla, el
// siguiente paso es KV, y el siguiente, un resumen diario precalculado (ver README, "Próximas actualizaciones").
//
// Los números salen de src/utils/consumoMateriales.js, el mismo cálculo de la pantalla de Materiales, así que
// las dos siempre coinciden: órdenes FINALIZADAS (las ya aprobadas) activas más las archivadas en los reportes
// de cierre; las PRE-FINALIZADAS se informan aparte en `porAprobar` y no se suman.
import { consumoPorTecnico } from '../../src/utils/consumoMateriales.js';

const ZONA_HORARIA = 'America/Caracas';
const DESFASE_MS = 4 * 60 * 60 * 1000; // Venezuela es UTC-4 todo el año
const DIA_MS = 24 * 60 * 60 * 1000;
// Cada reporte de cierre es un documento grande: un rango más largo que esto no cabe en memoria del Worker.
export const MAX_DIAS_RANGO = 93;
const PERIODOS_API = ['HOY', 'SEMANA', 'MES'];
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---------------------------------------------------------------------------
// Fechas (hora de Venezuela; el Worker corre en UTC)
// ---------------------------------------------------------------------------

// Medianoche (ms) de Venezuela del día `anio-mes-dia` (mes 0-11).
const medianoche = (anio, mes, dia) => Date.UTC(anio, mes, dia) + DESFASE_MS;

// Inicio del período en hora de Venezuela, igual que inicioPeriodo de consumoMateriales (que usa la hora del equipo).
export function inicioPeriodoCaracas(periodo, ahoraMs = Date.now()) {
  const hoy = new Date(ahoraMs - DESFASE_MS); // sus campos UTC son la fecha y hora de Venezuela
  const [a, m, d] = [hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()];
  if (periodo === 'HOY') return medianoche(a, m, d);
  if (periodo === 'SEMANA') return medianoche(a, m, d - 6);
  return medianoche(a, m, 1); // MES
}

// "2026-10-15" -> medianoche de Venezuela de ese día, o null si no es una fecha real.
function medianocheDe(texto) {
  const p = FECHA.exec(texto || '');
  if (!p) return null;
  const [anio, mes, dia] = [Number(p[1]), Number(p[2]) - 1, Number(p[3])];
  const real = new Date(Date.UTC(anio, mes, dia));
  if (real.getUTCMonth() !== mes || real.getUTCDate() !== dia) return null;
  return medianoche(anio, mes, dia);
}

const iso = (ms) => new Date(ms).toISOString();

// Del texto de la consulta al rango { id, desde, hasta } (ms) o { error }.
export function leerPeriodo(params, ahoraMs = Date.now()) {
  const desdeTxt = params.get('desde');
  const hastaTxt = params.get('hasta');
  if (desdeTxt || hastaTxt) {
    const desde = medianocheDe(desdeTxt);
    if (desde == null) return { error: 'El parámetro "desde" debe ser una fecha AAAA-MM-DD.' };
    // "hasta" incluye todo ese día; si no viene, es hasta ahora.
    const hasta = hastaTxt ? (medianocheDe(hastaTxt) ?? NaN) + DIA_MS - 1 : ahoraMs;
    if (!Number.isFinite(hasta)) return { error: 'El parámetro "hasta" debe ser una fecha AAAA-MM-DD.' };
    if (hasta < desde) return { error: '"hasta" no puede ser anterior a "desde".' };
    if (hasta - desde > MAX_DIAS_RANGO * DIA_MS) return { error: `El rango máximo es de ${MAX_DIAS_RANGO} días por consulta; pide el período en partes.` };
    return { id: 'PERSONALIZADO', desde, hasta };
  }
  const id = (params.get('periodo') || 'MES').toUpperCase();
  if (!PERIODOS_API.includes(id)) return { error: `"periodo" debe ser uno de: ${PERIODOS_API.join(', ')}.` };
  return { id, desde: inicioPeriodoCaracas(id, ahoraMs), hasta: ahoraMs };
}

// ---------------------------------------------------------------------------
// Firestore (REST): valores -> JS y consultas
// ---------------------------------------------------------------------------

// Cualquier valor de Firestore (REST) a JS. Los números enteros llegan como texto.
export function valorFirestore(v) {
  if (!v || typeof v !== 'object') return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valorFirestore);
  if ('mapValue' in v) return camposAObjeto(v.mapValue.fields);
  return undefined;
}

export const camposAObjeto = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, valorFirestore(v)]));

const docAObjeto = (doc) => ({ ...camposAObjeto(doc.fields), id: doc.name.split('/').pop() });

// Documentos de `coleccion` (de artifacts/APP_ID/public/data) que cumplen todos los filtros [{ campo, op, valor }].
// `campos`: solo esos campos de cada documento (menos datos por la red; las lecturas se cobran igual por documento).
async function consultar(env, accessToken, coleccion, filtros = [], campos = null) {
  const campo = ({ campo: fieldPath, op, valor }) => ({ fieldFilter: { field: { fieldPath }, op, value: valor } });
  const where = filtros.length === 0 ? undefined : filtros.length === 1 ? campo(filtros[0]) : { compositeFilter: { op: 'AND', filters: filtros.map(campo) } };
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/artifacts/${env.APP_ID}/public/data:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: coleccion }],
      ...(where ? { where } : {}),
      ...(campos ? { select: { fields: campos.map((fieldPath) => ({ fieldPath })) } } : {}),
    } }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery falló: ${await res.text()}`);
  return (await res.json()).filter((r) => r.document).map((r) => r.document);
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

// Compara las llaves por su huella, de modo que el tiempo de respuesta no dependa de cuántos caracteres coinciden.
async function llaveValida(recibida, esperada) {
  const [a, b] = await Promise.all([recibida, esperada].map(async (t) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(t)))));
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i];
  return diferencia === 0;
}

function llaveDeLaPeticion(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (request.headers.get('X-API-Key') || '').trim();
}

// ---------------------------------------------------------------------------
// Respuesta
// ---------------------------------------------------------------------------

const respuestaJson = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  // Datos de la empresa: que ningún intermediario los guarde.
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});

const errorApi = (status, mensaje, extra) => respuestaJson({ error: mensaje }, status, extra);

const conectores = (verde, azul) => ({ verde, azul, total: verde + azul });

// Lo que devuelve consumoPorTecnico, con los nombres de la API (estables aunque la pantalla cambie los suyos).
export function armarRespuesta({ filas, totales, porAprobar }, periodo, ahoraMs = Date.now()) {
  return {
    version: 1,
    generadoEn: iso(ahoraMs),
    periodo: { id: periodo.id, desde: iso(periodo.desde), hasta: iso(periodo.hasta), zonaHoraria: ZONA_HORARIA },
    totales: {
      metros: totales.metros,
      recableados: totales.ordenes,
      instalaciones: totales.instalaciones,
      visitasConector: totales.visitas,
      cambiosEquipo: totales.cambiosEquipo,
      conectores: conectores(totales.verde, totales.azul),
    },
    porAprobar: {
      recableados: porAprobar.ordenes,
      instalaciones: porAprobar.instalaciones,
      visitasConector: porAprobar.visitas,
      cambiosEquipo: porAprobar.cambiosEquipo,
      metros: porAprobar.metros,
    },
    tecnicos: filas.map((f) => ({
      tecnico: f.tecnico,
      metros: f.metros,
      recableados: f.ordenes,
      instalaciones: f.instalaciones,
      visitasConector: f.visitas,
      cambiosEquipo: f.cambiosEquipo,
      conectores: conectores(f.verde, f.azul),
      ordenes: f.detalle.map((o) => ({
        id: o.id,
        codigo: o.codigo,
        cliente: o.nombre,
        fecha: iso(o.fecha),
        clase: o.clase, // RECABLEADO, INSTALACION, CAMBIO_EQUIPO o VISITA (de conector)
        tipoVisita: o.tipo || null,
        serial: o.serial || null, // ONU de la instalación o equipo nuevo del cambio de equipo
        metros: o.metros,
        conectores: conectores(o.verde, o.azul),
      })),
    })),
  };
}

// La misma respuesta sin la lista de órdenes de cada técnico (?detalle=0).
const sinDetalle = (r) => ({ ...r, tecnicos: r.tecnicos.map(({ ordenes: _ordenes, ...resumen }) => resumen) });

// Copias en memoria con vencimiento: clave -> { hasta, promesa }. Se guarda la promesa para que las consultas
// simultáneas iguales compartan una sola lectura; si falla, no se queda guardada (la siguiente llamada reintenta).
export const CACHE_TTL_MS = 5 * 60 * 1000;
export const TECNICOS_TTL_MS = 30 * 60 * 1000;
const MAX_ENTRADAS_CACHE = 20;
const copias = new Map();

export const vaciarCache = () => copias.clear();

// Devuelve { valor, acierto }: la copia vigente de `clave` o, si no hay, lo que calcule `calcular`.
async function recordar(clave, ttl, ahoraMs, calcular) {
  const copia = copias.get(clave);
  if (copia && copia.hasta > ahoraMs) return { valor: await copia.promesa, acierto: true };
  const promesa = calcular();
  copias.delete(clave);
  copias.set(clave, { hasta: ahoraMs + ttl, promesa });
  // Tope de entradas: primero se descarta lo ya vencido y, si hace falta, lo más antiguo.
  for (const [k, c] of copias) if (copias.size > MAX_ENTRADAS_CACHE && c.hasta <= ahoraMs) copias.delete(k);
  while (copias.size > MAX_ENTRADAS_CACHE) copias.delete(copias.keys().next().value);
  try {
    return { valor: await promesa, acierto: false };
  } catch (err) {
    if (copias.get(clave)?.promesa === promesa) copias.delete(clave);
    throw err;
  }
}

// Campos de una orden que usa el cálculo de Materiales (consumoPorTecnico): nada más se descarga.
const CAMPOS_ORDEN = ['estado', 'tecnico', 'codigo', 'nombre', 'tipoTrabajo', 'tipoVisita', 'metrosCable', 'conectorExterno', 'conectorInterno',
  'conectoresUsados', 'instalacion.metraje', 'instalacion.serial', 'instalacion.conectores', 'serialEquipo', 'finalizadoEn', 'createdAt'];

// Lee de Firestore lo que usa Materiales: las órdenes FINALIZADO y PRE-FINALIZADO (una sola consulta), los reportes
// de cierre del rango y los técnicos registrados (salen siempre, aunque no hayan usado material).
async function leerDatos(env, accessToken, desde, ahoraMs) {
  const estados = { arrayValue: { values: [{ stringValue: 'FINALIZADO' }, { stringValue: 'PRE-FINALIZADO' }] } };
  const [ordenesActivas, reportes, tecnicos] = await Promise.all([
    consultar(env, accessToken, 'tickets', [{ campo: 'estado', op: 'IN', valor: estados }], CAMPOS_ORDEN),
    // Una orden se archiva después de finalizarse: si su reporte es anterior a `desde`, la orden también lo es.
    // Solo se filtra por fecha (índice de un campo) y se descartan aquí los reportes de CANCELADOS.
    consultar(env, accessToken, 'reports', [{ campo: 'createdAt', op: 'GREATER_THAN_OR_EQUAL', valor: { integerValue: String(desde) } }], ['tipoReporte', 'createdAt', 'ticketsDetalle']),
    // Los técnicos casi nunca cambian: se comparten entre todos los períodos.
    recordar('tecnicos', TECNICOS_TTL_MS, ahoraMs, async () => (await consultar(env, accessToken, 'technicians', [], ['name'])).map(docAObjeto).map((t) => t.name).filter(Boolean)),
  ]);
  const archivadas = reportes.map(docAObjeto).filter((r) => r.tipoReporte === 'CIERRE').flatMap((r) => r.ticketsDetalle || []);
  return { ordenes: ordenesActivas.map(docAObjeto).concat(archivadas), tecnicos: tecnicos.valor };
}

// `obtenerToken`: devuelve el token de Google del Worker (se pasa desde index.js para no repetir esa lógica).
export async function manejarApiMateriales(request, env, obtenerToken, ahoraMs = Date.now()) {
  if (request.method !== 'GET') return errorApi(405, 'Método no permitido: usa GET.', { Allow: 'GET' });
  if (!env.MATERIALES_API_KEY) return errorApi(503, 'La API de materiales no está habilitada.');

  const llave = llaveDeLaPeticion(request);
  if (!llave || !(await llaveValida(llave, env.MATERIALES_API_KEY))) {
    return errorApi(401, 'Llave de API inválida o ausente.', { 'WWW-Authenticate': 'Bearer' });
  }

  const params = new URL(request.url).searchParams;
  const periodo = leerPeriodo(params, ahoraMs);
  if (periodo.error) return errorApi(400, periodo.error);
  const detalle = params.get('detalle') !== '0';

  // HOY/SEMANA/MES se identifican por su inicio (así cambian solos al pasar el día); un rango pedido, por sus dos fechas.
  const clave = `materiales|${periodo.id}|${periodo.desde}|${periodo.id === 'PERSONALIZADO' ? periodo.hasta : ''}`;
  try {
    const { valor, acierto } = await recordar(clave, CACHE_TTL_MS, ahoraMs, async () => {
      const { ordenes, tecnicos } = await leerDatos(env, await obtenerToken(env), periodo.desde, ahoraMs);
      return armarRespuesta(consumoPorTecnico(ordenes, { desde: periodo.desde, hasta: periodo.hasta, tecnicos }), periodo, ahoraMs);
    });
    return respuestaJson(detalle ? valor : sinDetalle(valor), 200, { 'X-Cache': acierto ? 'HIT' : 'MISS' });
  } catch (err) {
    console.error('API de materiales falló:', err);
    return errorApi(500, 'No se pudo leer la información de materiales.');
  }
}
