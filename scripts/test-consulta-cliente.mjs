// Prueba la consulta pública del cliente (src/utils/consultaCliente.js y cf-worker/src/consulta-cliente.js) con Firestore simulado: la cédula en todas sus
// formas, el estado que ve el cliente, que NUNCA salga un dato privado, los 30 días, el tope por IP, Turnstile y los orígenes permitidos.
// No necesita emulador ni credenciales. Uso: `npm run test:consultacliente` (corre con --conditions=workerd, igual que test:materiales).
import { exportPKCS8, generateKeyPair } from '../cf-worker/node_modules/jose/dist/browser/index.js';
import worker from '../cf-worker/src/index.js';
import { CACHE_CONSULTA_MS, vaciarCacheConsulta } from '../cf-worker/src/consulta-cliente.js';
import { cedulaDeConsulta, solicitudParaCliente, solicitudesDeCliente, tipoParaCliente } from '../src/utils/consultaCliente.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

// --- La cédula ---
check('con puntos', cedulaDeConsulta('12.345.678'), { digitos: '12345678', variantes: ['12.345.678', '12345678'] });
check('sin puntos', cedulaDeConsulta('12345678')?.variantes, ['12.345.678', '12345678']);
check('con letra y guion', cedulaDeConsulta('V-12.345.678')?.digitos, '12345678');
check('con letra minúscula y espacio', cedulaDeConsulta('v 12345678')?.digitos, '12345678');
check('RIF con dígito verificador', cedulaDeConsulta('J-12345678-9')?.digitos, '12345678');
check('de 6 dígitos (sin puntos de miles que agregar... con uno)', cedulaDeConsulta('123456')?.variantes, ['123.456', '123456']);
check('muy corta', cedulaDeConsulta('12345'), null);
check('muy larga', cedulaDeConsulta('1234567890'), null);
check('con letras', cedulaDeConsulta('12a45678'), null);
check('vacía, nula o un objeto', [cedulaDeConsulta(''), cedulaDeConsulta(null), cedulaDeConsulta({ a: 1 })], [null, null, null]);
check('puntos mal puestos', cedulaDeConsulta('1.2345.678'), null);
check('con ceros a la izquierda (un teléfono)', cedulaDeConsulta('0412123456'), null);
check('un valor enorme no revienta', cedulaDeConsulta('9'.repeat(5000)), null);

// --- El estado que ve el cliente ---
const HOY = Date.parse('2026-11-05T15:00:00Z'); // 11:00 del 5 de noviembre en Venezuela
const DIA = 86400000;
const orden = (campos) => ({ codigo: 'IO5', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', createdAt: HOY - 2 * DIA, ...campos });
const estado = (campos) => solicitudParaCliente(orden(campos), HOY);
check('pendiente sin técnico: recibida', estado({})?.estado, 'RECIBIDA');
check('pendiente sin técnico pero con fecha futura: programada', [estado({ fechaProgramada: '2026-11-08' })?.estado, estado({ fechaProgramada: '2026-11-08' })?.programadaPara], ['PROGRAMADA', '2026-11-08']);
check('con técnico: asignada, con su nombre bien escrito', [estado({ tecnico: 'GERARDO MOLERO' })?.estado, estado({ tecnico: 'GERARDO MOLERO' })?.tecnico], ['ASIGNADA', 'Gerardo Molero']);
check('con técnico y fecha futura: programada', estado({ tecnico: 'ANA', fechaProgramada: '2026-11-09' })?.estado, 'PROGRAMADA');
check('la fecha de hoy ya no es "futura"', estado({ tecnico: 'ANA', fechaProgramada: '2026-11-05' })?.estado, 'ASIGNADA');
check('la noche del 5 en Venezuela (ya es 6 en UTC) sigue siendo el 5: lo del 6 es futuro', solicitudParaCliente(orden({ tecnico: 'ANA', fechaProgramada: '2026-11-06' }), Date.parse('2026-11-06T02:00:00Z'))?.estado, 'PROGRAMADA');
check('en camino', estado({ tecnico: 'ANA', enCamino: { tecnico: 'ANA', desde: HOY - 600000 } })?.estado, 'EN_CAMINO');
check('en el sitio', estado({ tecnico: 'ANA', enCamino: { tecnico: 'ANA', desde: HOY - 1800000, llegoEn: HOY - 600000 } })?.estado, 'EN_SITIO');
check('un "en camino" vencido (4 h) ya no se muestra como en camino', estado({ tecnico: 'ANA', enCamino: { tecnico: 'ANA', desde: HOY - 5 * 3600000 } })?.estado, 'ASIGNADA');
check('pre-finalizada: en verificación', estado({ estado: 'PRE-FINALIZADO', tecnico: 'ANA' })?.estado, 'EN_REVISION');
const finalizada = estado({ estado: 'FINALIZADO', tecnico: 'ANA', finalizadoEn: HOY - DIA });
check('finalizada: completada, con el técnico y el día de cierre', [finalizada.estado, finalizada.tecnico, finalizada.cerradaEn], ['COMPLETADA', 'Ana', '2026-11-04']);
const cancelada = estado({ estado: 'CANCELADO', tecnico: 'ANA', canceladaEn: HOY - DIA, motivoCancelacion: 'cliente no estaba' });
check('cancelada: sin técnico y sin motivo', [cancelada.estado, cancelada.tecnico, JSON.stringify(cancelada).includes('motivo')], ['CANCELADA', '', false]);
check('un estado interno no se muestra', estado({ estado: 'ELIMINADO' }), null);
check('una validación de NAP es interna: no se muestra', estado({ tipoTrabajo: 'VALIDACION NAP' }), null);
check('tipos de trabajo para el cliente', ['AVERÍA', 'LOW SIGNAL', 'CAMBIO DE EQUIPO', 'VISITA', 'ALGO NUEVO'].map(tipoParaCliente), ['Avería', 'Revisión de señal', 'Cambio de equipo', 'Visita técnica', 'Servicio técnico']);
check('fecha de la solicitud en hora de Venezuela', estado({ createdAt: Date.parse('2026-11-03T02:00:00Z') })?.solicitadaEn, '2026-11-02');

// --- Privacidad: ningún dato privado llega, aunque la orden lo traiga ---
const conTodo = solicitudParaCliente(orden({
  nombre: 'María Pérez', cedula: '12.345.678', telefono: '0414-1234567', direccion: 'Calle 1', cobro: 25, observacion: 'interna', plantillaFinal: 'secreto', promotora: 'Ana',
  instalacion: { serial: 'ONU-1', metraje: 100 }, olt: 'JMTV', tecnico: 'ANA', estado: 'FINALIZADO', finalizadoEn: HOY - DIA,
}), HOY);
check('solo salen los campos previstos', Object.keys(conTodo).sort(), ['cerradaEn', 'codigo', 'estado', 'etiqueta', 'programadaPara', 'solicitadaEn', 'tecnico', 'tipo']);

// --- Varias órdenes: sin repetir, 30 días, abiertas primero ---
const lista = solicitudesDeCliente([
  { ...orden({ codigo: 'A1', estado: 'FINALIZADO', finalizadoEn: HOY - 10 * DIA }), id: 'a1' },
  { ...orden({ codigo: 'A2', tecnico: 'ANA' }), id: 'a2' },
  { ...orden({ codigo: 'A1', estado: 'FINALIZADO', finalizadoEn: HOY - 10 * DIA }), id: 'a1' }, // la misma, también en el historial
  { ...orden({ codigo: 'VIEJA', estado: 'FINALIZADO', finalizadoEn: HOY - 31 * DIA }), id: 'v' },
  { ...orden({ codigo: 'SINFECHA', estado: 'CANCELADO' }), id: 's', createdAt: 0 },
  { ...orden({ codigo: 'RECIENTE', estado: 'CANCELADO', canceladaEn: HOY - DIA }), id: 'r' },
  { ...orden({ codigo: 'LARGA', createdAt: HOY - 90 * DIA }), id: 'l' }, // una pendiente muy vieja sigue abierta: se muestra
], HOY);
check('abiertas primero (la más reciente antes), luego cerradas por fecha; sin repetidas, sin vencidas ni sin fecha', lista.map((s) => s.codigo), ['A2', 'LARGA', 'RECIENTE', 'A1']);
check('una cerrada justo a los 30 días todavía se ve', solicitudesDeCliente([orden({ estado: 'FINALIZADO', finalizadoEn: HOY - 30 * DIA + 1000 })], HOY).length, 1);

// --- El endpoint (Worker) con Firestore simulado ---
const PROJECT = 'proyecto-prueba';
const APP = 'app-prueba';
const serviceKeys = await generateKeyPair('RS256', { extractable: true });
const serviceAccount = { client_email: 'worker@proyecto-prueba.iam.gserviceaccount.com', private_key: await exportPKCS8(serviceKeys.privateKey) };
const WEB = 'https://networkspeed.com.ve';
const baseEnv = { FIREBASE_PROJECT_ID: PROJECT, APP_ID: APP, ALLOWED_ORIGINS: 'https://app.test', CONSULTA_ORIGINS: `${WEB},https://www.networkspeed.com.ve`, FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount) };
const BASE = `projects/${PROJECT}/databases/(default)/documents/artifacts/${APP}/public/data`;
const s = (v) => ({ stringValue: v });
const n = (v) => ({ integerValue: String(v) });
const doc = (col, id, campos) => ({ document: { name: `${BASE}/${col}/${id}`, fields: campos } });

// Las órdenes simuladas: la cédula está guardada con puntos (así la guarda la app).
const datos = {
  tickets: [
    doc('tickets', 'T1', { codigo: s('IO5'), estado: s('PENDIENTE'), tecnico: s('GERARDO MOLERO'), tipoTrabajo: s('INSTALACIÓN'), createdAt: n(HOY - DIA), cedula: s('12.345.678'), nombre: s('PRIVADO'), telefono: s('0414') }),
    doc('tickets', 'T2', { codigo: s('AO9'), estado: s('PENDIENTE'), tipoTrabajo: s('AVERÍA'), createdAt: n(HOY - 3600000), cedula: s('12345678') }), // guardada sin puntos
    doc('tickets', 'T3', { codigo: s('OTRO'), estado: s('PENDIENTE'), tipoTrabajo: s('AVERÍA'), createdAt: n(HOY), cedula: s('99.999.999') }),
  ],
  historialInstalaciones: [
    doc('historialInstalaciones', 'H1', { codigo: s('IO1'), estado: s('FINALIZADO'), tecnico: s('ANA'), tipoTrabajo: s('INSTALACIÓN'), creadaEn: n(HOY - 12 * DIA), finalizadoEn: n(HOY - 10 * DIA), cedula: s('12.345.678'), direccion: s('PRIVADA') }),
    doc('historialInstalaciones', 'H2', { codigo: s('IO0'), estado: s('FINALIZADO'), tecnico: s('ANA'), tipoTrabajo: s('INSTALACIÓN'), creadaEn: n(HOY - 50 * DIA), finalizadoEn: n(HOY - 45 * DIA), cedula: s('12.345.678') }), // pasó de 30 días
  ],
};
let consultas = [];
let verificaciones = [];
let contador = {}; // día -> cuántas consultas se han contado (el documento consultasCliente/<día>)
let contadorFalla = false;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('oauth2.googleapis.com/token')) return json({ access_token: 'AT', expires_in: 3600 });
  if (u.includes('turnstile/v0/siteverify')) { verificaciones.push(init.body.toString()); return json({ success: init.body.get('response') === 'prueba-buena' }); }
  if (u.includes(':commit')) {
    if (contadorFalla) return new Response('contador roto', { status: 500 });
    const w = JSON.parse(init.body).writes[0];
    const dia = w.update.name.split('/').pop();
    contador[dia] = (contador[dia] || 0) + Number(w.updateTransforms[0].increment.integerValue);
    check(`el contador es el documento del día en la colección consultasCliente (${dia})`, [w.update.name.includes('/public/data/consultasCliente/'), w.updateTransforms[0].fieldPath], [true, 'consultas']);
    return json({ writeResults: [{ transformResults: [{ integerValue: String(contador[dia]) }] }] });
  }
  if (u.includes(':runQuery')) {
    const q = JSON.parse(init.body).structuredQuery;
    consultas.push(q);
    const valores = q.where.fieldFilter.value.arrayValue.values.map((v) => v.stringValue);
    const col = q.from[0].collectionId;
    const campos = new Set(q.select.fields.map((f) => f.fieldPath));
    // Como Firestore con `select`: solo los campos pedidos (así se comprueba que no se pide nada privado).
    return json((datos[col] || []).filter((d) => valores.includes(d.document.fields.cedula?.stringValue)).map((d) => ({ document: { ...d.document, fields: Object.fromEntries(Object.entries(d.document.fields).filter(([k]) => campos.has(k))) } })));
  }
  throw new Error(`Llamada inesperada: ${u}`);
};

const RELOJ = Date.now;
const consolaErrorOriginal = console.error;
Date.now = () => HOY;
const pedir = async ({ metodo = 'POST', cuerpo, origen = WEB, e = baseEnv, ip = '1.2.3.4', conCopia = false } = {}) => {
  if (!conCopia) vaciarCacheConsulta(); // cada caso sale de Firestore, salvo los que prueban la copia
  const res = await worker.fetch(new Request('https://api.test/consulta/estado', {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(origen ? { Origin: origen } : {}), 'CF-Connecting-IP': ip },
    ...(metodo === 'POST' ? { body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } : {}),
  }), e);
  return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
};

let r = await pedir({ cuerpo: { cedula: 'V-12.345.678' } });
check('200 sin guardar copias, sin pedir usuario de Firebase', [r.status, r.headers.get('Cache-Control')], [200, 'no-store']);
check('las tres solicitudes de esa cédula: abiertas primero (la más reciente antes), la cerrada de hace 10 días, y no la de 45 días ni la de otra persona',
  r.json.solicitudes.map((x) => [x.codigo, x.estado]), [['AO9', 'RECIBIDA'], ['IO5', 'ASIGNADA'], ['IO1', 'COMPLETADA']]);
check('trae el técnico por su nombre', r.json.solicitudes.find((x) => x.codigo === 'IO5').tecnico, 'Gerardo Molero');
check('en la respuesta no hay nada privado', ['PRIVADO', 'PRIVADA', '0414', '12.345.678', '12345678'].filter((t) => JSON.stringify(r.json).includes(t)), []);
check('busca la cédula con puntos y sin ellos, en las órdenes y en el historial', consultas.map((q) => [q.from[0].collectionId, q.where.fieldFilter.op, q.where.fieldFilter.value.arrayValue.values.map((v) => v.stringValue)]),
  [['tickets', 'IN', ['12.345.678', '12345678']], ['historialInstalaciones', 'IN', ['12.345.678', '12345678']]]);
const pedidos = new Set(consultas.flatMap((q) => q.select.fields.map((f) => f.fieldPath)));
check('solo se piden campos que no son privados', ['nombre', 'telefono', 'direccion', 'cedula', 'cobro', 'plantillaOriginal', 'instalacion'].filter((c) => pedidos.has(c)), []);
check('el origen permitido recibe su CORS', r.headers.get('Access-Control-Allow-Origin'), WEB);

r = await pedir({ cuerpo: { cedula: '30.000.001' } });
check('una cédula sin solicitudes: lista vacía (igual que si no existiera)', [r.status, r.json.solicitudes], [200, []]);
r = await pedir({ cuerpo: { cedula: 'abc' } });
check('una cédula inválida: 400, sin consultar Firestore', [r.status, consultas.length], [400, 4]);
consultas = [];
r = await pedir({ cuerpo: '{no es json' });
check('un cuerpo que no es JSON: 400', r.status, 400);
r = await pedir({ cuerpo: {} });
check('sin cédula: 400', r.status, 400);
r = await pedir({ metodo: 'GET' });
check('GET: 405', r.status, 405);
consultas = [];
r = await pedir({ metodo: 'OPTIONS' });
check('la consulta previa (OPTIONS) del navegador: 204 con CORS', [r.status, r.headers.get('Access-Control-Allow-Origin'), r.headers.get('Access-Control-Allow-Methods')], [204, WEB, 'POST, OPTIONS']);
r = await pedir({ cuerpo: { cedula: '12345678' }, origen: 'https://malo.test' });
check('otro sitio no recibe su origen en el CORS (el navegador lo bloquea)', r.headers.get('Access-Control-Allow-Origin'), WEB);
check('los orígenes de la app no valen para esta consulta', (await pedir({ metodo: 'OPTIONS', origen: 'https://app.test' })).headers.get('Access-Control-Allow-Origin'), WEB);

// Tope por IP
let llamadas = [];
const limitador = { limit: async ({ key }) => { llamadas.push(key); return { success: key !== 'ip-abusiva' }; } };
r = await pedir({ cuerpo: { cedula: '12345678' }, ip: 'ip-abusiva', e: { ...baseEnv, LIMITADOR_CONSULTA: limitador } });
check('pasado el tope por IP: 429 con Retry-After, sin leer Firestore', [r.status, r.headers.get('Retry-After'), llamadas], [429, '60', ['ip-abusiva']]);
consultas = [];
r = await pedir({ cuerpo: { cedula: '12345678' }, ip: 'ip-normal', e: { ...baseEnv, LIMITADOR_CONSULTA: limitador } });
check('otra IP sigue pudiendo consultar', [r.status, llamadas.at(-1)], [200, 'ip-normal']);

// Turnstile
const conTurnstile = { ...baseEnv, TURNSTILE_SECRET: 'secreto' };
consultas = [];
r = await pedir({ cuerpo: { cedula: '12345678' }, e: conTurnstile });
check('con Turnstile configurado y sin prueba: 403, sin leer Firestore', [r.status, consultas.length], [403, 0]);
r = await pedir({ cuerpo: { cedula: '12345678', turnstile: 'prueba-mala' }, e: conTurnstile });
check('con una prueba falsa: 403', r.status, 403);
r = await pedir({ cuerpo: { cedula: '12345678', turnstile: 'prueba-buena' }, e: conTurnstile });
check('con una prueba buena: 200 y se verificó con el secreto y la IP', [r.status, verificaciones.at(-1)], [200, 'secret=secreto&response=prueba-buena&remoteip=1.2.3.4']);

// Copia por cédula y tope diario
vaciarCacheConsulta();
consultas = [];
contador = {};
r = await pedir({ cuerpo: { cedula: '12.345.678' }, conCopia: true });
const lecturasPrimera = consultas.length;
r = await pedir({ cuerpo: { cedula: 'V-12345678' }, conCopia: true }); // la misma cédula escrita de otra forma
check('la misma cédula (escrita distinto) dentro de la vigencia sale de la copia: 0 consultas más a Firestore ni al contador', [lecturasPrimera, consultas.length, contador['2026-11-05'], r.json.solicitudes.length], [2, 2, 1, 3]);
const AHORA_ANTES = Date.now;
Date.now = () => HOY + CACHE_CONSULTA_MS + 1;
r = await pedir({ cuerpo: { cedula: '12345678' }, conCopia: true });
Date.now = AHORA_ANTES;
check('pasada la vigencia de la copia se vuelve a leer (y a contar)', [consultas.length, contador['2026-11-05']], [4, 2]);
vaciarCacheConsulta();
consultas = [];
r = await pedir({ cuerpo: { cedula: '30.000.001' }, conCopia: true });
r = await pedir({ cuerpo: { cedula: '30.000.001' }, conCopia: true });
check('una cédula sin solicitudes también se guarda en la copia', [consultas.length, r.json.solicitudes], [2, []]);
// Simultáneas de la misma cédula comparten una sola lectura
vaciarCacheConsulta();
consultas = [];
contador = {};
await Promise.all([1, 2, 3, 4, 5].map(() => pedir({ cuerpo: { cedula: '12345678' }, conCopia: true })));
check('cinco consultas simultáneas de una cédula hacen una sola lectura y cuentan una vez', [consultas.length, contador['2026-11-05']], [2, 1]);

// El tope diario: CONSULTA_LIMITE_DIARIO consultas que llegan a Firestore por día de Venezuela
const conTope = { ...baseEnv, CONSULTA_LIMITE_DIARIO: '3' };
contador = {};
consultas = [];
const cedulas = ['10.000.001', '10.000.002', '10.000.003', '10.000.004'];
const estados = [];
for (const c of cedulas) estados.push((await pedir({ cuerpo: { cedula: c }, e: conTope, conCopia: true })).status);
check('las 3 primeras consultas distintas pasan y la 4.ª recibe 503', estados, [200, 200, 200, 503]);
check('la que pasó el tope no leyó Firestore (solo 3 × 2 consultas)', consultas.length, 6);
r = await pedir({ cuerpo: { cedula: cedulas[3] }, e: conTope, conCopia: true });
check('el 503 trae un mensaje amable y Retry-After', [r.status, typeof r.json.error, r.headers.get('Retry-After')], [503, 'string', '3600']);
r = await pedir({ cuerpo: { cedula: cedulas[0] }, e: conTope, conCopia: true });
check('con el tope alcanzado, una cédula ya guardada en la copia se sigue respondiendo', r.status, 200);
Date.now = () => HOY + DIA; // el día siguiente en Venezuela
r = await pedir({ cuerpo: { cedula: cedulas[3] }, e: conTope, conCopia: true });
Date.now = AHORA_ANTES;
check('al día siguiente el contador empieza de nuevo', [r.status, contador['2026-11-06']], [200, 1]);
vaciarCacheConsulta();
contadorFalla = true;
consultas = [];
console.error = () => {};
r = await pedir({ cuerpo: { cedula: '12345678' } });
console.error = consolaErrorOriginal;
contadorFalla = false;
check('si el contador falla no se lee nada de Firestore (sin contador no hay tope): 500', [r.status, consultas.length], [500, 0]);
r = await pedir({ cuerpo: { cedula: '12345678' }, e: baseEnv });
check('y al volver el contador la consulta funciona (el fallo no se guardó en la copia)', r.status, 200);

// Fallo de Firestore
const fetchAnterior = globalThis.fetch;
globalThis.fetch = async (url, init) => (String(url).includes(':runQuery') ? new Response('boom', { status: 500 }) : fetchAnterior(url, init));
console.error = () => {};
r = await pedir({ cuerpo: { cedula: '12345678' } });
console.error = consolaErrorOriginal;
check('si Firestore falla: 500 con un mensaje amable, sin detalles internos', [r.status, JSON.stringify(r.json).includes('boom')], [500, false]);
globalThis.fetch = fetchAnterior;

Date.now = RELOJ;
if (failures > 0) { console.log(`\n${failures} fallaron.`); process.exit(1); }
console.log('\nTodo bien.');
