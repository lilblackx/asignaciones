// Prueba el Worker de notificaciones (cf-worker/src/index.js) con FCM y Firestore simulados:
// el mensaje que sale hacia FCM (datos, prioridad alta, tag, id de la orden), el reintento
// simple si FCM rechaza las opciones de prioridad, y la limpieza de tokens muertos.
// No necesita emulador ni credenciales. Uso: `npm run test:notify`
// (corre con --conditions=workerd para que jose use fetch, como en Cloudflare).
import { SignJWT, exportJWK, exportPKCS8, generateKeyPair } from '../cf-worker/node_modules/jose/dist/browser/index.js';
import worker, { incrementosMensuales } from '../cf-worker/src/index.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`); }
}

const PROJECT = 'proyecto-prueba';
const APP = 'app-prueba';
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
const USER_DOC = (uid) => `${DOCS}/artifacts/${APP}/public/data/users/${uid}`;

// Claves de prueba: una firma el token del usuario (como Firebase Auth), otra es la cuenta de servicio.
const firebaseKeys = await generateKeyPair('RS256', { extractable: true });
const jwk = { ...(await exportJWK(firebaseKeys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const serviceKeys = await generateKeyPair('RS256', { extractable: true });
const serviceAccount = { client_email: 'worker@proyecto-prueba.iam.gserviceaccount.com', private_key: await exportPKCS8(serviceKeys.privateKey) };

const idTokenDe = (uid) => new SignJWT({})
  .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
  .setIssuer(`https://securetoken.google.com/${PROJECT}`)
  .setAudience(PROJECT)
  .setSubject(uid)
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(firebaseKeys.privateKey);

const env = {
  FIREBASE_PROJECT_ID: PROJECT,
  APP_ID: APP,
  ALLOWED_ORIGINS: 'https://seguimientons-f2026.web.app',
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount),
};

// --- Servidores simulados ---
let roles; // uid -> rol del perfil
let conPermisoVentas; // uids con puedeCrearVentas
let busquedas; // filtros de las búsquedas de perfiles (runQuery)
let tokensDelTecnico; // fcmTokens del perfil del técnico destino
let comportamientoFcm; // token -> 'ok' | 'muerto' | 'rechaza-opciones'
let enviosFcm;
let commits;

const respuesta = (cuerpo, status = 200) => new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('oauth2.googleapis.com/token')) return respuesta({ access_token: 'AT', expires_in: 3600 });
  if (u.includes('securetoken@system.gserviceaccount.com')) return respuesta({ keys: [jwk] });
  if (u.includes('/users/')) {
    const uid = decodeURIComponent(u.split('/users/')[1]);
    if (!roles[uid]) return respuesta('no existe', 404);
    return respuesta({ fields: { role: { stringValue: roles[uid] }, disabled: { booleanValue: false }, puedeCrearVentas: { booleanValue: conPermisoVentas.has(uid) } } });
  }
  if (u.includes(':runQuery')) {
    busquedas.push(JSON.parse(init.body).structuredQuery.where?.fieldFilter);
    return respuesta([{ document: { name: USER_DOC('tecnico-uid'), fields: { fcmTokens: { arrayValue: { values: tokensDelTecnico.map((t) => ({ stringValue: t })) } } } } }]);
  }
  if (u.includes(':commit')) {
    commits.push(JSON.parse(init.body));
    return respuesta({});
  }
  if (u.includes('fcm.googleapis.com')) {
    const { message } = JSON.parse(init.body);
    enviosFcm.push(message);
    const comportamiento = comportamientoFcm[message.token] || 'ok';
    if (comportamiento === 'muerto') return respuesta({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }, 404);
    if (comportamiento === 'rechaza-opciones' && message.webpush) return respuesta({ error: { status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload' } }, 400);
    return respuesta({ name: 'ok' });
  }
  throw new Error(`Llamada inesperada: ${u}`);
};

async function enviar(uid, cuerpo) {
  const req = new Request('https://worker.test/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await idTokenDe(uid)}`, Origin: env.ALLOWED_ORIGINS, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const res = await worker.fetch(req, env);
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* respuesta de texto (errores) */ }
  return { status: res.status, json };
}

const aviso = {
  target: { type: 'tecnico', name: 'GERARDO MOLERO' },
  title: 'Nueva asignación',
  body: 'Te asignaron la orden AS9 - Cliente Nuevo.',
  tipo: 'nuevaAsignacion',
  ticketId: 'abc123',
};

function reiniciar() {
  busquedas = [];
  roles = { 'admin-uid': 'ADMIN', 'tecnico-uid': 'TECNICO' };
  conPermisoVentas = new Set();
  tokensDelTecnico = ['tok-bueno'];
  comportamientoFcm = {};
  enviosFcm = [];
  commits = [];
}

// 1) Mensaje normal: datos + prioridad alta + tag + id de la orden
reiniciar();
let r = await enviar('admin-uid', aviso);
check('responde 200 con 1 dispositivo enviado', [r.status, r.json], [200, { sent: 1, dispositivos: 1 }]);
check('un solo envío a FCM', enviosFcm.length, 1);
check('el mensaje lleva título, texto, tipo, id de la orden y tag', enviosFcm[0].data,
  { title: 'Nueva asignación', body: 'Te asignaron la orden AS9 - Cliente Nuevo.', tag: 'nuevaAsignacion:abc123', ticketId: 'abc123', tipo: 'nuevaAsignacion' });
check('prioridad alta para web y Android, con TTL corto',
  [enviosFcm[0].webpush, enviosFcm[0].android],
  [{ headers: { Urgency: 'high', TTL: '3600' } }, { priority: 'high', ttl: '3600s' }]);
check('es un mensaje solo de datos (sin "notification")', 'notification' in enviosFcm[0], false);

// 2) Un token muerto no cuenta como enviado y se borra del perfil
reiniciar();
tokensDelTecnico = ['tok-bueno', 'tok-muerto'];
comportamientoFcm = { 'tok-muerto': 'muerto' };
r = await enviar('admin-uid', aviso);
check('cuenta solo el dispositivo que sí recibió', [r.status, r.json], [200, { sent: 1, dispositivos: 2 }]);
check('se limpia el token muerto del perfil del técnico', commits.length, 1);
check('la limpieza quita solo ese token y no recrea un perfil borrado', commits[0]?.writes, [{
  transform: { document: USER_DOC('tecnico-uid'), fieldTransforms: [{ fieldPath: 'fcmTokens', removeAllFromArray: { values: [{ stringValue: 'tok-muerto' }] } }] },
  currentDocument: { exists: true },
}]);

// 3) Si FCM rechaza las opciones de prioridad, el aviso sale igual con el mensaje simple
reiniciar();
tokensDelTecnico = ['tok-raro'];
comportamientoFcm = { 'tok-raro': 'rechaza-opciones' };
r = await enviar('admin-uid', aviso);
check('el aviso sale igual tras el reintento simple', [r.status, r.json], [200, { sent: 1, dispositivos: 1 }]);
check('segundo intento sin opciones de prioridad', enviosFcm.map((m) => Boolean(m.webpush || m.android)), [true, false]);
check('un rechazo por opciones no borra el token', commits.length, 0);

// 4) Técnico sin dispositivos: lo informa (sent 0) para que quien asigna lo sepa
reiniciar();
tokensDelTecnico = [];
r = await enviar('admin-uid', aviso);
check('sin dispositivos responde sent 0', [r.status, r.json], [200, { sent: 0, dispositivos: 0 }]);

// 5) Permisos: un técnico no puede avisar a otro técnico, pero sí a los aprobadores
reiniciar();
r = await enviar('tecnico-uid', aviso);
check('un TECNICO no puede avisar a un técnico', r.status, 403);
check('y no se envió nada', enviosFcm.length, 0);


// 6) Consulta de cobro: el técnico avisa a la oficina (ADMIN y USUARIO), sin duplicar a nadie
reiniciar();
roles['usuario-uid'] = 'USUARIO';
r = await enviar('tecnico-uid', { target: { type: 'oficina' }, title: 'Consulta de cobro', body: 'GERARDO pregunta el cobro del recableado de AS9 (250 m).', tipo: 'consultaCobro', ticketId: 'abc123' });
check('un TECNICO puede avisar a la oficina', [r.status, r.json], [200, { sent: 1, dispositivos: 1 }]);
check('busca a los ADMIN y a los USUARIO', busquedas.map((f) => [f.field.fieldPath, f.value.stringValue]).sort(), [['role', 'ADMIN'], ['role', 'USUARIO']]);
check('un mismo perfil que sale en las dos búsquedas recibe un solo aviso', enviosFcm.length, 1);
check('el aviso lleva el tipo de la consulta', enviosFcm[0]?.data.tipo, 'consultaCobro');
reiniciar();
r = await enviar('tecnico-uid', aviso);
check('pero sigue sin poder avisar a un técnico', r.status, 403);

// 7) Nueva venta: una PROMOTORA con permiso avisa a la oficina, y solo a eso
reiniciar();
roles['usuario-uid'] = 'USUARIO';
roles['promotora-uid'] = 'PROMOTORA';
const avisoVenta = { target: { type: 'oficina' }, title: 'Nueva venta', body: '', tipo: 'nuevaVenta', ticketId: 'v1' };
r = await enviar('promotora-uid', avisoVenta);
check('una PROMOTORA sin permiso de crear ventas no avisa', r.status, 403);
conPermisoVentas.add('promotora-uid');
r = await enviar('promotora-uid', avisoVenta);
check('una PROMOTORA con permiso avisa a la oficina de la venta nueva', [r.status, r.json], [200, { sent: 1, dispositivos: 1 }]);
check('el aviso lleva el tipo y la orden', [enviosFcm[0]?.data.tipo, enviosFcm[0]?.data.ticketId], ['nuevaVenta', 'v1']);
reiniciar();
roles['promotora-uid'] = 'PROMOTORA';
conPermisoVentas.add('promotora-uid');
check('con permiso, no puede avisar a un técnico', (await enviar('promotora-uid', aviso)).status, 403);
check('ni a los aprobadores', (await enviar('promotora-uid', { ...avisoVenta, target: { type: 'aprobadores' } })).status, 403);
check('ni mandar otro tipo de aviso a la oficina', (await enviar('promotora-uid', { ...avisoVenta, tipo: 'consultaCobro' })).status, 403);

// 8) Pago y adelanto: FINANZAS le avisa a un técnico, y solo eso
reiniciar();
roles['finanzas-uid'] = 'FINANZAS';
const avisoPago = { target: { type: 'tecnico', name: 'GERARDO MOLERO' }, title: 'Pago recibido', body: 'Se te registró un pago de 54,00 $ por 3 órdenes.', tipo: 'pagoTecnico' };
r = await enviar('finanzas-uid', avisoPago);
check('FINANZAS avisa a un técnico de su pago', [r.status, r.json], [200, { sent: 1, dispositivos: 1 }]);
check('el aviso lleva el tipo del pago y no abre ninguna orden', [enviosFcm[0]?.data.tipo, enviosFcm[0]?.data.ticketId], ['pagoTecnico', undefined]);
reiniciar();
roles['finanzas-uid'] = 'FINANZAS';
check('FINANZAS avisa también de un adelanto', (await enviar('finanzas-uid', { ...avisoPago, title: 'Adelanto registrado', tipo: 'adelantoTecnico' })).status, 200);
check('FINANZAS avisa también de un descuento', (await enviar('finanzas-uid', { ...avisoPago, title: 'Descuento registrado', tipo: 'descuentoTecnico' })).status, 200);
check('pero no puede mandar el aviso de una asignación a un técnico', (await enviar('finanzas-uid', { ...avisoPago, tipo: 'nuevaAsignacion' })).status, 403);
check('ni avisar a la oficina ni a los aprobadores', [(await enviar('finanzas-uid', { ...avisoPago, target: { type: 'oficina' } })).status, (await enviar('finanzas-uid', { ...avisoPago, target: { type: 'aprobadores' } })).status], [403, 403]);
check('ni sin tipo', (await enviar('finanzas-uid', { ...avisoPago, tipo: undefined })).status, 403);
check('no se envió nada de lo rechazado', enviosFcm.length, 2);

// 9) Pago de un cliente: el técnico le avisa a ADMINISTRACION (y solo a ADMINISTRACION) que registró un pago o que el cliente paga después
reiniciar();
roles['admon-uid'] = 'ADMINISTRACION';
roles['finanzas-uid'] = 'FINANZAS';
const avisoPagoCliente = { target: { type: 'administracion' }, title: 'Pago registrado', body: 'AO7 · JOSE · 5.696 Bs', tipo: 'pagoCliente', ticketId: 't-pago' };
r = await enviar('tecnico-uid', avisoPagoCliente);
check('el técnico avisa a Administración de un pago de un cliente', [r.status, r.json], [200, { sent: 1, dispositivos: 1 }]);
check('la búsqueda de destinos es por el rol ADMINISTRACION (no por el ADMIN ni la oficina)', busquedas.at(-1), { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: 'ADMINISTRACION' } });
check('el aviso lleva su tipo y la orden', [enviosFcm[0]?.data.tipo, enviosFcm[0]?.data.ticketId], ['pagoCliente', 't-pago']);
check('el técnico no puede mandar otro tipo de aviso a Administración', (await enviar('tecnico-uid', { ...avisoPagoCliente, tipo: 'nuevaAsignacion' })).status, 403);
check('ni sin tipo', (await enviar('tecnico-uid', { ...avisoPagoCliente, tipo: undefined })).status, 403);
check('nadie más avisa a Administración: ni el ADMIN, ni Finanzas, ni la propia Administración', [(await enviar('admin-uid', avisoPagoCliente)).status, (await enviar('finanzas-uid', avisoPagoCliente)).status, (await enviar('admon-uid', avisoPagoCliente)).status], [403, 403, 403]);
check('no se envió nada de lo rechazado', enviosFcm.length, 1);

// --- Cierre automático: las instalaciones dejan un resumen liviano para la promotora ---
const fetchBase = globalThis.fetch;
const HOY = 'Tue Oct 13 2026';
const AHORA = Date.parse('2026-10-13T22:05:00-04:00'); // martes 10:05 pm en Caracas
const ticketDoc = (id, campos) => ({ name: `${DOCS}/artifacts/${APP}/public/data/tickets/${id}`, fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v }])) });
const FINALIZADAS = [
  ticketDoc('t-inst', { codigo: 'IO5', nombre: 'Ana Pérez', cedula: '12.345.678', tipoDocumento: 'V', direccion: 'Calle 1', tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO', tipoTrabajo: 'INSTALACIÓN', createdAt: 1000, finalizadoEn: 2000, serial: 'SECRETO123', cobroBs: '400', plantillaOriginal: '*Nap:*\n*Promotora:* alexis añez \n*Fuente:* x' }),
  ticketDoc('t-averia', { codigo: 'AS7', nombre: 'Luis', estado: 'FINALIZADO', tipoTrabajo: 'AVERÍA', createdAt: 1500 }),
];
const CANCELADAS = [ticketDoc('t-cancel', { codigo: 'IO6', nombre: 'ROSA DE LA CRUZ', direccion: 'CALLE 5 CASA 10b', estado: 'CANCELADO', tipoTrabajo: 'INSTALACIÓN', createdAt: 1200, promotora: 'Sariana', motivoCancelacion: '  El cliente | ya no  quiere el servicio ' })];
const VENCIDA = { name: `${DOCS}/artifacts/${APP}/public/data/historialInstalaciones/vieja`, fields: { archivadoEn: { integerValue: String(AHORA - 40 * 86400000) } } };
const consultas = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('/config/cierreAutomatico') && (init.method || 'GET') === 'GET') {
    return respuesta({ fields: { activo: { booleanValue: true }, hora: { stringValue: '22:00' }, dias: { arrayValue: { values: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ integerValue: String(d) })) } }, actualizadoEn: { integerValue: '1' } } });
  }
  if (u.includes('/config/cierreAutomatico')) return respuesta({});
  if (u.includes(':runQuery')) {
    const q = JSON.parse(init.body).structuredQuery;
    consultas.push(q);
    const col = q.from[0].collectionId;
    if (col === 'tickets') return respuesta((q.where.fieldFilter.value.stringValue === 'FINALIZADO' ? FINALIZADAS : CANCELADAS).map((document) => ({ document })));
    if (col === 'historialInstalaciones') return respuesta([{ document: VENCIDA }]);
    return respuesta([{}]); // aprobadores: nadie a quien avisar
  }
  return fetchBase(url, init);
};
reiniciar();
const { cierreAutomatico } = await import('../cf-worker/src/index.js');
const resultado = await cierreAutomatico(env, AHORA);
check('el cierre automático corre', [resultado.ejecutado, resultado.finalizadas, resultado.canceladas], [true, 2, 1]);
const escrituras = commits.flatMap((c) => c.writes || []);
const historial = escrituras.filter((w) => w.update?.name.includes('/historialInstalaciones/'));
check('guarda el historial solo de las instalaciones (finalizada y cancelada), no de las averías',
  historial.map((w) => w.update.name.split('/').pop()).sort(), ['t-cancel', 't-inst']);
const dePrueba = historial.find((w) => w.update.name.endsWith('/t-inst'))?.update.fields;
check('el resumen lleva lo que ve la promotora', [dePrueba?.codigo, dePrueba?.nombre, dePrueba?.cedula, dePrueba?.direccion, dePrueba?.tecnico, dePrueba?.estado],
  [{ stringValue: 'IO5' }, { stringValue: 'Ana Pérez' }, { stringValue: '12.345.678' }, { stringValue: 'Calle 1' }, { stringValue: 'GERARDO MOLERO' }, { stringValue: 'FINALIZADO' }]);
check('y las fechas: creada, finalizada y archivada', [dePrueba?.creadaEn, dePrueba?.finalizadoEn, dePrueba?.archivadoEn],
  [{ integerValue: '1000' }, { integerValue: '2000' }, { integerValue: String(AHORA) }]);
check('el resumen NO lleva datos técnicos ni de cobro', Object.keys(dePrueba || {}).sort(),
  ['archivadoEn', 'canceladaEn', 'cedula', 'codigo', 'creadaEn', 'direccion', 'estado', 'falla', 'finalizadoEn', 'motivoCancelacion', 'nombre', 'plantillaFinal', 'promotora', 'promotoraClave', 'tecnico', 'tipoDocumento', 'tipoTrabajo']);
check('el motivo de la cancelación pasa limpio al historial de ventas; el de una finalizada va vacío', [historial.find((w) => w.update.name.endsWith('/t-cancel'))?.update.fields.motivoCancelacion, dePrueba?.motivoCancelacion], [{ stringValue: 'El cliente / ya no quiere el servicio' }, { stringValue: '' }]);
check('la promotora sale de la plantilla si la orden no la guardó', [dePrueba?.promotora, dePrueba?.promotoraClave], [{ stringValue: 'Alexis Añez' }, { stringValue: 'alexis anez' }]);
const canceladaDoc = historial.find((w) => w.update.name.endsWith('/t-cancel'))?.update.fields;
check('y se usa la que la orden ya trae', [canceladaDoc?.promotora, canceladaDoc?.promotoraClave], [{ stringValue: 'Sariana' }, { stringValue: 'sariana' }]);
check('el nombre y la dirección entran al historial normalizados (el cierre automático los arregla al archivar)', [canceladaDoc?.nombre, canceladaDoc?.direccion], [{ stringValue: 'Rosa de la Cruz' }, { stringValue: 'Calle 5 Casa 10B' }]);
check('una instalación sin fecha de finalizado guarda null', historial.find((w) => w.update.name.endsWith('/t-cancel'))?.update.fields.finalizadoEn, { nullValue: null });
check('borra del historial lo de más de 30 días', escrituras.filter((w) => w.delete?.includes('/historialInstalaciones/')).map((w) => w.delete.split('/').pop()), ['vieja']);
const corte = consultas.find((q) => q.from[0].collectionId === 'historialInstalaciones')?.where.fieldFilter;
check('la limpieza pide lo anterior a hoy menos 30 días', [corte?.field.fieldPath, corte?.op, corte?.value.integerValue], ['archivadoEn', 'LESS_THAN', String(AHORA - 30 * 86400000)]);
const reportes = escrituras.filter((w) => w.update?.name.includes('/reports/'));
check('el cierre guarda UN solo reporte con todo (finalizadas, canceladas y también la avería)', [reportes.length, reportes[0]?.update.fields.tipoReporte, reportes[0]?.update.fields.ticketsDetalle.arrayValue.values.length], [1, { stringValue: 'CIERRE' }, 3]);
check('el reporte lleva el total y cuántas finalizadas y canceladas', [reportes[0]?.update.fields.total, reportes[0]?.update.fields.finalizadas, reportes[0]?.update.fields.canceladas], [{ integerValue: '3' }, { integerValue: '2' }, { integerValue: '1' }]);
const totales = escrituras.filter((w) => w.update?.name.includes('/estadisticasMensuales/'));
check('suma los totales del mes: una instalación finalizada y una cancelada, en el mes del cierre (la avería que no es LOS no cuenta)',
  totales.map((w) => [w.update.name.split('/').pop(), w.updateTransforms.map((t) => [t.fieldPath, t.increment.integerValue])]),
  [['2026-10', [['instalacionesFinalizadas', '1'], ['instalacionesCanceladas', '1']]]]);
check('los totales solo suman: máscara vacía (no pisan lo ya contado) y sin campos propios', totales.every((w) => w.updateMask.fieldPaths.length === 0 && Object.keys(w.update.fields).length === 0), true);
const primerCommit = commits.find((c) => c.writes?.some((w) => w.update?.name.includes('/reports/')))?.writes || [];
check('los totales van en el mismo commit que el reporte y los borrados (todo o nada)', [primerCommit.some((w) => w.update?.name.includes('/estadisticasMensuales/')), primerCommit.some((w) => w.delete)], [true, true]);
const campoInt = (n) => ({ integerValue: String(n) });
const OCT_31 = Date.parse('2026-10-31T23:30:00-04:00'); // a las 23:30 en Caracas (ya es 1 de noviembre en UTC)
const CIERRE_1_NOV = Date.parse('2026-11-01T22:00:00-04:00');
const conFin = (finalizadoEn, extra = {}) => ({ fields: { tipoTrabajo: { stringValue: 'INSTALACIÓN' }, ...(finalizadoEn ? { finalizadoEn: campoInt(finalizadoEn) } : {}), ...extra } });
check('cada orden cuenta en el mes en que se finalizó, en hora de Caracas (aunque se archive al mes siguiente)', incrementosMensuales([conFin(OCT_31), conFin(CIERRE_1_NOV - 3600000)], 'FINALIZADO', CIERRE_1_NOV),
  { '2026-10': { instalacionesFinalizadas: 1 }, '2026-11': { instalacionesFinalizadas: 1 } });
check('sin fecha de finalización creíble (ausente, muy vieja o futura) cuenta en el mes del cierre', incrementosMensuales([conFin(0), conFin(2000), conFin(CIERRE_1_NOV + 86400000)], 'FINALIZADO', CIERRE_1_NOV), { '2026-11': { instalacionesFinalizadas: 3 } });
check('las averías LOS y las canceladas tienen su propio contador, y otras averías no cuentan', [
  incrementosMensuales([{ fields: { tipoTrabajo: { stringValue: 'AVERÍA' }, falla: { stringValue: 'LOS' } } }, { fields: { tipoTrabajo: { stringValue: 'AVERÍA' }, falla: { stringValue: 'Sin señal' } } }], 'FINALIZADO', CIERRE_1_NOV),
  incrementosMensuales([{ fields: { tipoTrabajo: { stringValue: 'AVERÍA' }, falla: { stringValue: 'LOS' } }, }, conFin(0)], 'CANCELADO', CIERRE_1_NOV),
], [{ '2026-11': { losResueltas: 1 } }, { '2026-11': { losCanceladas: 1, instalacionesCanceladas: 1 } }]);

// --- Cron: lo que no debe costar nada ---
const peticiones = [];
globalThis.fetch = async (url, init = {}) => { peticiones.push(String(url)); return globalThis.fetchDelCierre(url, init); };
globalThis.fetchDelCierre = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('/config/cierreAutomatico')) return respuesta({ fields: { activo: { booleanValue: true }, hora: { stringValue: '22:00' }, dias: { arrayValue: { values: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ integerValue: String(d) })) } }, actualizadoEn: { integerValue: '1' } } });
  return fetchBase(url, init);
};
const { actualizarTasaBcv: tasaDelDia, cierreAutomatico: cierreFresco } = await import('../cf-worker/src/index.js?fresco');
const MANANA_TEMPRANO = Date.parse('2026-10-14T06:00:00-04:00');
check('antes de la hora de la tasa no hace ninguna petición (ni token ni lectura)', [(await tasaDelDia(env, MANANA_TEMPRANO)).actualizada, peticiones.length], [false, 0]);
const MEDIODIA = Date.parse('2026-10-14T12:00:00-04:00');
await Promise.all([cierreFresco(env, MEDIODIA), cierreFresco(env, MEDIODIA), cierreFresco(env, MEDIODIA)]);
check('tareas que arrancan juntas comparten un solo token de Google', peticiones.filter((u) => u.includes('oauth2.googleapis.com/token')).length, 1);
// Si hoy ya se hizo el cierre manual (cierreManualFecha), el automático de hoy no corre; mañana sí.
{
  const { debeEjecutar } = await import('../cf-worker/src/index.js');
  const config = { activo: true, hora: '22:00', dias: [0, 1, 2, 3, 4, 5, 6], actualizadoEn: 1 };
  check('sin cierre manual hoy, el automático toca a su hora', debeEjecutar(config, AHORA)?.fecha, '2026-10-13');
  check('con el cierre manual de hoy hecho, el automático de hoy no corre', debeEjecutar({ ...config, cierreManualFecha: '2026-10-13' }, AHORA), null);
  check('un cierre manual de otro día no lo frena', debeEjecutar({ ...config, cierreManualFecha: '2026-10-12' }, AHORA)?.fecha, '2026-10-13');
  check('y al día siguiente vuelve a tocar aunque ayer se cerrara a mano', debeEjecutar({ ...config, cierreManualFecha: '2026-10-13' }, AHORA + 86400000)?.fecha, '2026-10-14');
}
delete globalThis.fetchDelCierre;
globalThis.fetch = fetchBase;

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
