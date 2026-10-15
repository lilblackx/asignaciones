// Prueba la API de Materiales (cf-worker/src/materiales-api.js) con Firestore simulado: la llave de API,
// el período en hora de Venezuela, que los números coincidan con consumoPorTecnico (la pantalla) y que las
// órdenes archivadas en reportes de cierre se sumen. No necesita emulador ni credenciales.
// Uso: `npm run test:materiales` (corre con --conditions=workerd, igual que test:notify).
import { exportPKCS8, generateKeyPair } from '../cf-worker/node_modules/jose/dist/browser/index.js';
import worker from '../cf-worker/src/index.js';
import { CACHE_TTL_MS, TECNICOS_TTL_MS, inicioPeriodoCaracas, leerPeriodo, valorFirestore, vaciarCache } from '../cf-worker/src/materiales-api.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

const PROJECT = 'proyecto-prueba';
const APP = 'app-prueba';
const LLAVE = 'llave-de-prueba-123';
const serviceKeys = await generateKeyPair('RS256', { extractable: true });
const serviceAccount = { client_email: 'worker@proyecto-prueba.iam.gserviceaccount.com', private_key: await exportPKCS8(serviceKeys.privateKey) };
const env = { FIREBASE_PROJECT_ID: PROJECT, APP_ID: APP, ALLOWED_ORIGINS: 'https://x.test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount), MATERIALES_API_KEY: LLAVE };

// --- Fechas: el Worker corre en UTC, el módulo cuenta en hora de Venezuela (UTC-4) ---
// 15 de octubre de 2026, 22:00 en Venezuela = 16 de octubre 02:00 UTC: sigue siendo "hoy" el 15.
const AHORA = Date.parse('2026-10-16T02:00:00Z');
check('HOY empieza a medianoche de Venezuela, no de UTC', new Date(inicioPeriodoCaracas('HOY', AHORA)).toISOString(), '2026-10-15T04:00:00.000Z');
check('SEMANA son 7 días contando hoy', new Date(inicioPeriodoCaracas('SEMANA', AHORA)).toISOString(), '2026-10-09T04:00:00.000Z');
check('MES empieza el día 1 de Venezuela', new Date(inicioPeriodoCaracas('MES', AHORA)).toISOString(), '2026-10-01T04:00:00.000Z');
const rango = leerPeriodo(new URLSearchParams('desde=2026-10-01&hasta=2026-10-15'), AHORA);
check('desde/hasta: incluye todo el día "hasta"', [new Date(rango.desde).toISOString(), new Date(rango.hasta).toISOString()], ['2026-10-01T04:00:00.000Z', '2026-10-16T03:59:59.999Z']);
check('una fecha que no existe se rechaza', Boolean(leerPeriodo(new URLSearchParams('desde=2026-02-31'), AHORA).error), true);
check('un período desconocido se rechaza', Boolean(leerPeriodo(new URLSearchParams('periodo=TODO'), AHORA).error), true);
check('un rango de más de 93 días se rechaza', Boolean(leerPeriodo(new URLSearchParams('desde=2026-01-01&hasta=2026-10-01'), AHORA).error), true);
check('hasta antes de desde se rechaza', Boolean(leerPeriodo(new URLSearchParams('desde=2026-10-10&hasta=2026-10-01'), AHORA).error), true);

check('decodifica mapas, listas, enteros y nulos de Firestore', valorFirestore({ mapValue: { fields: { a: { integerValue: '5' }, b: { arrayValue: { values: [{ stringValue: 'x' }] } }, c: { nullValue: null } } } }), { a: 5, b: ['x'], c: null });

// --- Datos simulados ---
const BASE = `projects/${PROJECT}/databases/(default)/documents/artifacts/${APP}/public/data`;
const s = (v) => ({ stringValue: v });
const n = (v) => ({ integerValue: String(v) });
const doc = (col, id, campos) => ({ document: { name: `${BASE}/${col}/${id}`, fields: campos } });
const DIA = 86400000;
const HOY_MS = Date.parse('2026-10-15T15:00:00Z'); // 11:00 en Venezuela

const recableado = (id, tecnico, estado, metros, finalizadoEn) => doc('tickets', id, {
  codigo: s(id), nombre: s(`Cliente ${id}`), tecnico: s(tecnico), estado: s(estado), tipoTrabajo: s('VISITA'), tipoVisita: s('RECABLEADO'),
  metrosCable: n(metros), conectorExterno: s('VERDE'), conectorInterno: s(''), finalizadoEn: n(finalizadoEn), createdAt: n(finalizadoEn - 1000),
});
const instalacion = (id, tecnico, estado, metraje, finalizadoEn) => doc('tickets', id, {
  codigo: s(id), nombre: s(`Cliente ${id}`), tecnico: s(tecnico), estado: s(estado), tipoTrabajo: s('INSTALACIÓN'),
  instalacion: { mapValue: { fields: { metraje: s(String(metraje)), serial: s(`ONU-${id}`) } } }, finalizadoEn: n(finalizadoEn), createdAt: n(finalizadoEn - 1000),
});

const activas = {
  FINALIZADO: [
    recableado('R1', 'GERARDO MOLERO', 'FINALIZADO', 40, HOY_MS),
    instalacion('I1', 'GERARDO MOLERO', 'FINALIZADO', 120, HOY_MS - 2 * DIA),
    doc('tickets', 'V1', { codigo: s('V1'), nombre: s('Cliente V1'), tecnico: s('ANA'), estado: s('FINALIZADO'), tipoTrabajo: s('VISITA'), tipoVisita: s('CONECTOR_INTERNO'),
      conectoresUsados: { mapValue: { fields: { verde: n(2), azul: n(1) } } }, finalizadoEn: n(HOY_MS), createdAt: n(HOY_MS - 1000) }),
    recableado('VIEJO', 'ANA', 'FINALIZADO', 999, HOY_MS - 40 * DIA), // fuera del mes
    doc('tickets', 'E1', { codigo: s('E1'), nombre: s('Cliente E1'), tecnico: s('ANA'), estado: s('FINALIZADO'), tipoTrabajo: s('VISITA'), tipoVisita: s('CAMBIO_EQUIPO'),
      serialEquipo: s('HWTC1A2B3C4D'), finalizadoEn: n(HOY_MS - 1000), createdAt: n(HOY_MS - 5000) }),
  ],
  'PRE-FINALIZADO': [
    recableado('P1', 'ANA', 'PRE-FINALIZADO', 30, HOY_MS),
    doc('tickets', 'E2', { codigo: s('E2'), tecnico: s('ANA'), estado: s('PRE-FINALIZADO'), tipoTrabajo: s('VISITA'), tipoVisita: s('CAMBIO_EQUIPO'), serialEquipo: s('ZTEG0000AAAA'), createdAt: n(HOY_MS) }),
  ],
};
const reporteCierre = doc('reports', 'rep1', {
  tipoReporte: s('CIERRE'), createdAt: n(HOY_MS - DIA),
  ticketsDetalle: { arrayValue: { values: [
    { mapValue: { fields: { id: s('R9'), codigo: s('R9'), nombre: s('Cliente R9'), tecnico: s('ANA'), estado: s('FINALIZADO'), tipoVisita: s('RECABLEADO'), metrosCable: n(15), finalizadoEn: n(HOY_MS - DIA) } } },
    { mapValue: { fields: { id: s('R1'), codigo: s('R1'), tecnico: s('GERARDO MOLERO'), estado: s('FINALIZADO'), tipoVisita: s('RECABLEADO'), metrosCable: n(40), finalizadoEn: n(HOY_MS) } } }, // repetida: cuenta una vez
  ] } },
});
const reporteCancelados = doc('reports', 'rep2', {
  tipoReporte: s('CANCELADOS'), createdAt: n(HOY_MS),
  ticketsDetalle: { arrayValue: { values: [{ mapValue: { fields: { id: s('C1'), tecnico: s('ANA'), estado: s('FINALIZADO'), tipoVisita: s('RECABLEADO'), metrosCable: n(500), finalizadoEn: n(HOY_MS) } } }] } },
});

let consultas;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const respuesta = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('oauth2.googleapis.com/token')) return respuesta({ access_token: 'AT', expires_in: 3600 });
  if (u.includes(':runQuery')) {
    const q = JSON.parse(init.body).structuredQuery;
    consultas.push(q);
    const col = q.from[0].collectionId;
    if (col === 'tickets') return respuesta(q.where.fieldFilter.value.arrayValue.values.flatMap((v) => activas[v.stringValue]));
    if (col === 'reports') {
      const desde = Number(q.where.fieldFilter.value.integerValue);
      return respuesta([reporteCierre, reporteCancelados].filter((r) => Number(r.document.fields.createdAt.integerValue) >= desde));
    }
    if (col === 'technicians') return respuesta([doc('technicians', 't1', { name: s('GERARDO MOLERO') }), doc('technicians', 't2', { name: s('SIN USO') })]);
  }
  throw new Error(`Llamada inesperada: ${u}`);
};

// `conCopia: false` empieza sin copias guardadas (cada prueba sale de Firestore); true reutiliza las anteriores.
const pedir = async (ruta, { llave = LLAVE, metodo = 'GET', cabecera = 'Authorization', e = env, conCopia = false } = {}) => {
  if (!conCopia) vaciarCache();
  const headers = llave ? { [cabecera]: cabecera === 'Authorization' ? `Bearer ${llave}` : llave } : {};
  const res = await worker.fetch(new Request(`https://api.test${ruta}`, { method: metodo, headers }), e);
  return { status: res.status, json: await res.json().catch(() => null), cache: res.headers.get('Cache-Control'), xCache: res.headers.get('X-Cache') };
};

// --- Autenticación ---
consultas = [];
let r = await pedir('/api/materiales', { llave: '' });
check('sin llave: 401', r.status, 401);
r = await pedir('/api/materiales', { llave: 'otra' });
check('llave equivocada: 401', r.status, 401);
r = await pedir('/api/materiales', { metodo: 'POST' });
check('POST: 405', r.status, 405);
r = await pedir('/api/materiales', { e: { ...env, MATERIALES_API_KEY: undefined } });
check('sin secreto configurado la API está apagada (503), no abierta', r.status, 503);
check('ninguna de esas consultas llegó a Firestore', consultas.length, 0);
r = await pedir('/api/materiales', { cabecera: 'X-API-Key' });
check('también acepta X-API-Key', r.status, 200);

// --- Contenido (el mes en curso a las 11:00 del 15 de octubre, hora de Venezuela) ---
const RELOJ = Date.now;
Date.now = () => HOY_MS + 3600000;
r = await pedir('/api/materiales?periodo=MES');
Date.now = RELOJ;
check('responde 200 sin guardar copias', [r.status, r.cache], [200, 'no-store']);
const j = r.json;
check('período MES en hora de Venezuela', [j.periodo.id, j.periodo.desde, j.periodo.zonaHoraria], ['MES', '2026-10-01T04:00:00.000Z', 'America/Caracas']);
check('totales: 40 + 120 + 15 m de cable (R1 repetida cuenta una vez; el viejo y los cancelados no)', j.totales.metros, 175);
check('totales: 2 recableados (R1, R9), 1 instalación y 1 visita de conector', [j.totales.recableados, j.totales.instalaciones, j.totales.visitasConector], [2, 1, 1]);
check('conectores: R1 (1 verde) + R9 (ninguno) + visita (2 verdes y 1 azul)', j.totales.conectores, { verde: 3, azul: 1, total: 4 });
check('lo pre-finalizado se informa aparte y no se suma', j.porAprobar, { recableados: 1, instalaciones: 0, visitasConector: 0, cambiosEquipo: 1, metros: 30 });
check('los cambios de equipo se cuentan en los totales y por técnico (no gastan cable)', [j.totales.cambiosEquipo, j.tecnicos.find((t) => t.tecnico === 'ANA').cambiosEquipo, j.totales.metros], [1, 1, 175]);
const ordenesAna = j.tecnicos.find((t) => t.tecnico === 'ANA').ordenes;
check('el cambio de equipo trae el serial del equipo nuevo, sin metros', ordenesAna.filter((o) => o.clase === 'CAMBIO_EQUIPO').map((o) => [o.codigo, o.tipoVisita, o.serial, o.metros]), [['E1', 'CAMBIO_EQUIPO', 'HWTC1A2B3C4D', null]]);
check('técnicos de más a menos metros, con los registrados sin uso', j.tecnicos.map((t) => [t.tecnico, t.metros]), [['GERARDO MOLERO', 160], ['ANA', 15], ['SIN USO', 0]]);
const gerardo = j.tecnicos[0];
check('resumen del técnico', [gerardo.recableados, gerardo.instalaciones, gerardo.visitasConector, gerardo.conectores], [1, 1, 0, { verde: 1, azul: 0, total: 1 }]);
check('detalle de órdenes del técnico', gerardo.ordenes.map((o) => [o.codigo, o.clase, o.metros, o.cliente]), [['R1', 'RECABLEADO', 40, 'Cliente R1'], ['I1', 'INSTALACION', 120, 'Cliente I1']]);
check('la instalación trae el serial de la ONU y el recableado no tiene serial', gerardo.ordenes.map((o) => [o.codigo, o.serial]), [['R1', null], ['I1', 'ONU-I1']]);
check('el período MES pide a Firestore solo los reportes desde el 1', consultas.find((q) => q.from[0].collectionId === 'reports').where.fieldFilter.value.integerValue, String(Date.parse('2026-10-01T04:00:00Z')));

// --- Parámetros ---
Date.now = () => HOY_MS + 3600000;
r = await pedir('/api/materiales?periodo=HOY&detalle=0');
check('HOY solo suma lo de hoy', [r.json.totales.metros, r.json.totales.recableados, r.json.totales.instalaciones], [40, 1, 0]);
check('detalle=0 quita la lista de órdenes', r.json.tecnicos.some((t) => 'ordenes' in t), false);
r = await pedir('/api/materiales?desde=2026-10-14&hasta=2026-10-14');
Date.now = RELOJ;
check('un día suelto (el 14): solo R9', [r.status, r.json.totales.metros, r.json.totales.recableados], [200, 15, 1]);
r = await pedir('/api/materiales?periodo=TODO');
check('un período inválido: 400', [r.status, typeof r.json.error], [400, 'string']);

// --- Ahorro de lecturas ---
const del = (col) => consultas.filter((q) => q.from[0].collectionId === col);
Date.now = () => HOY_MS + 3600000;
consultas = [];
r = await pedir('/api/materiales?periodo=MES');
check('primera consulta: MISS, con una sola consulta de órdenes (FINALIZADO y PRE-FINALIZADO juntos)', [r.xCache, del('tickets').length, del('reports').length, del('technicians').length], ['MISS', 1, 1, 1]);
const primera = r.json;
const camposOrden = del('tickets')[0].select.fields.map((f) => f.fieldPath);
check('las órdenes se piden solo con los campos que usa el cálculo (incluye los seriales)', ['instalacion.metraje', 'instalacion.serial', 'serialEquipo'].every((c) => camposOrden.includes(c)) && !camposOrden.some((f) => /plantilla|telefono|direccion|cedula/i.test(f)), true);
check('los reportes, solo con tipo, fecha y órdenes; los técnicos, solo el nombre', [del('reports')[0].select.fields.map((f) => f.fieldPath), del('technicians')[0].select.fields.map((f) => f.fieldPath)], [['tipoReporte', 'createdAt', 'ticketsDetalle'], ['name']]);
consultas = [];
r = await pedir('/api/materiales?periodo=MES', { conCopia: true });
check('misma consulta otra vez: HIT, 0 lecturas y la misma respuesta', [r.xCache, consultas.length, JSON.stringify(r.json) === JSON.stringify(primera)], ['HIT', 0, true]);
r = await pedir('/api/materiales?periodo=MES&detalle=0', { conCopia: true });
check('detalle=0 se arma de la misma copia (0 lecturas, sin órdenes)', [r.xCache, consultas.length, r.json.tecnicos.some((t) => 'ordenes' in t)], ['HIT', 0, false]);
const sinOrdenes = r.json;
r = await pedir('/api/materiales?periodo=MES', { conCopia: true });
check('y la copia guardada conserva el detalle', r.json.tecnicos.some((t) => 'ordenes' in t), true);
check('el resumen es el mismo con o sin detalle', JSON.stringify(sinOrdenes.totales), JSON.stringify(r.json.totales));
r = await pedir('/api/materiales?periodo=HOY', { conCopia: true });
check('otro período no usa la copia, pero reutiliza los técnicos (no los vuelve a leer)', [r.xCache, del('tickets').length, del('technicians').length], ['MISS', 1, 0]);
consultas = [];
Date.now = () => HOY_MS + 3600000 + CACHE_TTL_MS + 1;
r = await pedir('/api/materiales?periodo=MES', { conCopia: true });
check('pasado el vencimiento se vuelve a leer (y los técnicos siguen en copia)', [r.xCache, del('tickets').length, del('technicians').length], ['MISS', 1, 0]);
consultas = [];
Date.now = () => HOY_MS + 3600000 + TECNICOS_TTL_MS + 1;
r = await pedir('/api/materiales?periodo=MES', { conCopia: true });
check('la lista de técnicos vence más tarde y entonces también se renueva', del('technicians').length, 1);
Date.now = () => HOY_MS + 3600000;
consultas = [];
const [a, b] = await Promise.all([pedir('/api/materiales?periodo=SEMANA'), pedir('/api/materiales?periodo=SEMANA', { conCopia: true })]);
check('dos consultas iguales a la vez comparten una sola lectura', [a.status, b.status, consultas.length], [200, 200, 3]);
// Un fallo de Firestore no se guarda: la siguiente llamada reintenta.
const fetchBueno = globalThis.fetch;
globalThis.fetch = async (url, init) => (String(url).includes(':runQuery') ? new Response('caído', { status: 503 }) : fetchBueno(url, init));
r = await pedir('/api/materiales?periodo=MES');
check('si Firestore falla responde 500', r.status, 500);
globalThis.fetch = fetchBueno;
r = await pedir('/api/materiales?periodo=MES', { conCopia: true });
check('y el error no queda guardado: la siguiente llamada se recupera', [r.status, r.xCache], [200, 'MISS']);
Date.now = RELOJ;

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
