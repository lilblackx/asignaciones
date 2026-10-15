// Prueba el envío al inventario del otro sistema (cf-worker/src/inventario.js y src/utils/envioInventario.js) con los dos
// Firebase simulados (el nuestro y el del otro sistema): qué se envía de cada tipo de orden, que un serial inexistente no
// envíe nada y deje alerta y aviso, que reenviar no duplique, los reintentos y los permisos. No toca ningún sistema real.
// Uso: `npm run test:inventario` (corre con --conditions=workerd, igual que test:notify).
import { SignJWT, exportJWK, exportPKCS8, generateKeyPair } from '../cf-worker/node_modules/jose/dist/browser/index.js';
import worker, { depsInventario } from '../cf-worker/src/index.js';
import { MAX_INTENTOS, fechaHoraCaracas, idRegistro, olvidarSesionInventario, reintentarPendientes } from '../cf-worker/src/inventario.js';
import { payloadEnvioInventario } from '../src/utils/envioInventario.js';
import { USUARIOS_INVENTARIO, veEnviosInventario } from '../src/utils/accesoInventario.js';
import { readFileSync } from 'node:fs';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Qué se envía de cada orden (la lógica que comparten la app y el Worker) ---
const FIN = Date.parse('2026-10-15T18:05:09Z'); // 14:05:09 en Venezuela
const base = { id: 'x', codigo: 'IS10', nombre: 'Ana Pérez', tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO', finalizadoEn: FIN };
const instalacion = { ...base, tipoTrabajo: 'INSTALACIÓN', instalacion: { serial: 'hwtc1a2b3c4d', metraje: 120, conectores: { externo: { verde: 1 }, interno: { verde: 1, azul: 1 } } } };
const cambio = { ...base, codigo: 'CE1', tipoTrabajo: 'VISITA', tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'ZTEG99887766' };
const recableado = { ...base, codigo: 'R1', tipoTrabajo: 'VISITA', tipoVisita: 'RECABLEADO', metrosCable: 40, conectorExterno: 'VERDE', conectorInterno: 'AZUL' };
const visitaInterna = { ...base, codigo: 'V1', tipoTrabajo: 'VISITA', tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 2, azul: 1 } };
const visitaExterna = { ...base, codigo: 'V2', tipoTrabajo: 'VISITA', tipoVisita: 'CONECTOR_EXTERNO', conectoresUsados: { verde: 1, azul: 0 } };

check('instalación: instalacion_nueva con el serial de la ONU, el metraje y los conectores (verde = APC, azul = UPC)', payloadEnvioInventario(instalacion),
  { codigo: 'IS10', tecnico: 'GERARDO MOLERO', cliente: 'Ana Pérez', finalizadoEn: FIN, accion: 'instalacion_nueva', serial: 'HWTC1A2B3C4D', apc: 2, upc: 1, dropMetros: 120, motivo: '' });
check('cambio de equipo: cambio_equipo con el serial nuevo y sin material', payloadEnvioInventario(cambio),
  { codigo: 'CE1', tecnico: 'GERARDO MOLERO', cliente: 'Ana Pérez', finalizadoEn: FIN, accion: 'cambio_equipo', serial: 'ZTEG99887766', apc: 0, upc: 0, dropMetros: 0, motivo: '' });
check('recableado: avería con el drop y los conectores, el motivo con el tipo de trabajo y la orden', payloadEnvioInventario(recableado),
  { codigo: 'R1', tecnico: 'GERARDO MOLERO', cliente: 'Ana Pérez', finalizadoEn: FIN, accion: 'averia', serial: '', apc: 1, upc: 1, dropMetros: 40, motivo: 'Recableado - Orden #R1' });
check('visita de conector: avería con las cantidades por color y su motivo', [payloadEnvioInventario(visitaInterna), payloadEnvioInventario(visitaExterna)].map((p) => [p.accion, p.apc, p.upc, p.dropMetros, p.motivo]),
  [['averia', 2, 1, 0, 'Visita de conector interno - Orden #V1'], ['averia', 1, 0, 0, 'Visita de conector externo - Orden #V2']]);
check('lo que no es de estos tipos, o no está aprobado, no envía nada', [
  { ...base, tipoTrabajo: 'VISITA', tipoVisita: 'DROP_ATENUADO' }, { ...instalacion, estado: 'PRE-FINALIZADO' }, { ...cambio, estado: 'PENDIENTE' }, { ...base, tipoTrabajo: 'AVERÍA' }, null,
].map(payloadEnvioInventario), [null, null, null, null, null]);
check('orden sin código: sale "S/C" en el motivo', payloadEnvioInventario({ ...recableado, codigo: '' }).motivo, 'Recableado - Orden #S/C');
check('instalación anterior (sin serial ni conectores): se envía con serial vacío y conectores en 0', (({ serial, apc, upc }) => [serial, apc, upc])(payloadEnvioInventario({ ...instalacion, instalacion: { metraje: 80 } })), ['', 0, 0]);

// --- Quién ve el módulo ---
check('solo lfernandez (sin importar mayúsculas ni espacios) ve el módulo', [veEnviosInventario('lfernandez'), veEnviosInventario(' LFernandez '), veEnviosInventario('admin'), veEnviosInventario(''), veEnviosInventario(null)], [true, true, false, false, false]);
const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
check('las reglas de Firestore permiten ver el módulo a los mismos usuarios que la app y el Worker', reglas.includes(`.get('username', '') in [${USUARIOS_INVENTARIO.map((u) => `'${u}'`).join(', ')}]`), true);

// --- Fecha, hora e id con el formato del otro sistema ---
check('fecha y hora de Venezuela de la orden (no de UTC)', fechaHoraCaracas(FIN), { fecha: '2026-10-15', fechaHora: '2026-10-15 14:05:09' });
check('pasada la medianoche de UTC sigue siendo el día de Venezuela', fechaHoraCaracas(Date.parse('2026-10-16T02:30:00Z')).fecha, '2026-10-15');
check('el id del registro es siempre el mismo para la misma orden y distinto entre órdenes', [idRegistro('abc', FIN) === idRegistro('abc', FIN), idRegistro('abc', FIN) !== idRegistro('abd', FIN)], [true, true]);
check('el id tiene la forma de su id: la hora de la orden con tres decimales', Math.floor(idRegistro('abc', FIN)) === FIN && idRegistro('abc', FIN) - FIN < 1, true);

// --- Servidores simulados ---
const PROJECT = 'proyecto-prueba';
const APP = 'app-prueba';
const TELECOM = 'almacen-prueba';
const TELECOM_APP = 'app-telecom';
const DOCS = `projects/${PROJECT}/databases/(default)/documents/artifacts/${APP}/public/data`;
const DOCS_TELECOM = `projects/${TELECOM}/databases/(default)/documents/artifacts/${TELECOM_APP}/public/data`;

const firebaseKeys = await generateKeyPair('RS256', { extractable: true });
const jwk = { ...(await exportJWK(firebaseKeys.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const serviceKeys = await generateKeyPair('RS256', { extractable: true });
const serviceAccount = { client_email: 'worker@proyecto-prueba.iam.gserviceaccount.com', private_key: await exportPKCS8(serviceKeys.privateKey) };
const idTokenDe = (uid) => new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(`https://securetoken.google.com/${PROJECT}`).setAudience(PROJECT).setSubject(uid).setIssuedAt().setExpirationTime('1h').sign(firebaseKeys.privateKey);

const env = {
  FIREBASE_PROJECT_ID: PROJECT, APP_ID: APP, ALLOWED_ORIGINS: 'https://x.test', FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount),
  TELECOM_PROJECT_ID: TELECOM, TELECOM_APP_ID: TELECOM_APP, TELECOM_API_KEY: 'api-key-telecom', TELECOM_EMAIL: 'api@tuempresa.com', TELECOM_PASSWORD: 'clave-de-prueba',
};

const s = (v) => ({ stringValue: v });
const n = (v) => ({ integerValue: String(v) });
const enc = (v) => (typeof v === 'string' ? s(v) : typeof v === 'number' ? n(v) : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : { nullValue: null });
const fieldsDe = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
const dec = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, 'stringValue' in v ? v.stringValue : 'integerValue' in v ? Number(v.integerValue) : 'doubleValue' in v ? v.doubleValue : v]));

let roles, ordenes, envios, inventario, comportamientoTelecom, llamadasTelecom, commitsTelecom, loginsTelecom, pushes, consultasNuestras;
const respuesta = (cuerpo, status = 200) => new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  let cuerpo = null;
  try { cuerpo = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch { /* formulario (token de Google) */ }
  if (u.includes('oauth2.googleapis.com/token')) return respuesta({ access_token: 'AT', expires_in: 3600 });
  if (u.includes('securetoken@system.gserviceaccount.com')) return respuesta({ keys: [jwk] });
  // --- el otro sistema ---
  if (u.includes('identitytoolkit.googleapis.com') && u.includes('signInWithPassword')) {
    loginsTelecom.push(cuerpo);
    if (comportamientoTelecom === 'clave-mala') return respuesta({ error: { message: 'INVALID_PASSWORD' } }, 400);
    return respuesta({ idToken: `TOKEN-${loginsTelecom.length}`, expiresIn: '3600' });
  }
  if (u.includes(`projects/${TELECOM}/`)) {
    llamadasTelecom.push({ url: u, auth: init.headers?.Authorization, cuerpo });
    if (comportamientoTelecom === 'caido') return respuesta('caído', 503);
    if (comportamientoTelecom === 'vencida' && init.headers?.Authorization === 'Bearer TOKEN-1') return respuesta('vencida', 401);
    if (u.endsWith(':runQuery')) {
      const serial = cuerpo.structuredQuery.where.fieldFilter.value.stringValue;
      const item = inventario[serial];
      return respuesta(item ? [{ document: { name: `${DOCS_TELECOM}/inventory/${item.id}`, fields: fieldsDe(item.campos) } }] : [{}]);
    }
    if (u.endsWith(':commit')) { commitsTelecom.push(cuerpo.writes); return respuesta({}); }
  }
  // --- nuestro Firestore ---
  if (u.includes('/users/')) {
    const uid = decodeURIComponent(u.split('/users/')[1]);
    if (!roles[uid]) return respuesta('no existe', 404);
    return respuesta({ fields: { role: s(roles[uid].rol), username: s(roles[uid].username || uid), disabled: { booleanValue: false }, puedeCerrar: { booleanValue: roles[uid].puedeCerrar === true } } });
  }
  if (u.includes('/tickets/')) {
    const id = decodeURIComponent(u.split('/tickets/')[1]);
    return ordenes[id] ? respuesta({ name: `${DOCS}/tickets/${id}`, fields: ordenes[id] }) : respuesta('no existe', 404);
  }
  if (u.includes('/telecomEnvios/') && (!init.method || init.method === 'GET')) {
    const id = decodeURIComponent(u.split('/telecomEnvios/')[1]);
    return envios[id] ? respuesta({ name: `${DOCS}/telecomEnvios/${id}`, fields: envios[id] }) : respuesta('no existe', 404);
  }
  if (u.includes(`projects/${PROJECT}/`) && u.endsWith(':commit')) {
    for (const w of cuerpo.writes) {
      if (w.update?.name.includes('/telecomEnvios/')) envios[w.update.name.split('/').pop()] = w.update.fields;
      if (w.delete?.includes('/telecomEnvios/')) delete envios[w.delete.split('/').pop()];
    }
    return respuesta({});
  }
  if (u.includes(`projects/${PROJECT}/`) && u.endsWith(':runQuery')) {
    const q = cuerpo.structuredQuery;
    consultasNuestras.push(q);
    const col = q.from[0].collectionId;
    if (col === 'telecomEnvios') {
      const estado = q.where.fieldFilter.value.stringValue;
      return respuesta(Object.entries(envios).filter(([, f]) => f.estado.stringValue === estado).map(([id, f]) => ({ document: { name: `${DOCS}/telecomEnvios/${id}`, fields: f } })));
    }
    if (col === 'users') {
      // Los avisos se buscan por nombre de usuario; solo lfernandez tiene un dispositivo registrado.
      const esDeInventario = q.where.fieldFilter.field.fieldPath === 'username' && q.where.fieldFilter.value.stringValue === 'lfernandez';
      return respuesta(esDeInventario ? [{ document: { name: `${DOCS}/users/lf-uid`, fields: { fcmTokens: { arrayValue: { values: [s('tok-lf')] } } } } }] : [{}]);
    }
  }
  if (u.includes('fcm.googleapis.com')) { pushes.push(cuerpo.message); return respuesta({ name: 'ok' }); }
  throw new Error(`Llamada inesperada: ${u}`);
};

const reiniciar = () => {
  olvidarSesionInventario();
  roles = { 'lf-uid': { rol: 'ADMIN', username: 'lfernandez' }, 'admin-uid': { rol: 'ADMIN' }, 'usuario-uid': { rol: 'USUARIO' }, 'cierra-uid': { rol: 'TECNICO', puedeCerrar: true }, 'tecnico-uid': { rol: 'TECNICO' } };
  ordenes = {
    inst1: fieldsDe({ ...instalacion, estado: 'FINALIZADO', tipoTrabajo: 'INSTALACIÓN' }),
    cambio1: fieldsDe(cambio),
    rec1: fieldsDe(recableado),
    visita1: fieldsDe(visitaInterna),
    pre1: fieldsDe({ ...instalacion, estado: 'PRE-FINALIZADO' }),
    otra1: fieldsDe({ ...base, tipoTrabajo: 'AVERÍA' }),
  };
  envios = {};
  inventario = {
    HWTC1A2B3C4D: { id: 'inv-1', campos: { serial: 'HWTC1A2B3C4D', estado: 'Con Técnico', modelo: 'HG8145' } },
    ZTEG99887766: { id: 'inv-2', campos: { serial: 'ZTEG99887766', estado: 'Con Técnico' } },
  };
  comportamientoTelecom = 'ok';
  llamadasTelecom = []; commitsTelecom = []; loginsTelecom = []; pushes = []; consultasNuestras = [];
};

async function llamar(ruta, uid, cuerpo, e = env) {
  const res = await worker.fetch(new Request(`https://worker.test${ruta}`, {
    method: 'POST', headers: { Authorization: `Bearer ${await idTokenDe(uid)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  }), e);
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* texto de error */ }
  return { status: res.status, json };
}
const enviar = (ticketId, uid = 'admin-uid', e = env) => llamar('/inventario/enviar', uid, { ticketId }, e);
const reintentar = (ticketId, uid = 'lf-uid') => llamar('/inventario/reintentar', uid, { ticketId });
const envio = (id) => (envios[id] ? dec(envios[id]) : null);
const escrituraDe = (writes, coleccion) => writes.find((w) => w.update.name.includes(`/${coleccion}/`));

// 1) Instalación con el serial en el inventario
reiniciar();
let r = await enviar('inst1');
check('instalación: se envía', [r.status, r.json.estado], [200, 'ENVIADO']);
check('una sola escritura atómica al otro sistema: el equipo y el registro de material', commitsTelecom.length === 1 && commitsTelecom[0].length === 2, true);
const equipoEscrito = escrituraDe(commitsTelecom[0], 'inventory');
check('el equipo pasa a "Instalado" con el cliente y la fecha, tocando solo esos campos y sin crearlo', [dec(equipoEscrito.update.fields), equipoEscrito.updateMask.fieldPaths, equipoEscrito.currentDocument],
  [{ estado: 'Instalado', cliente: 'Ana Pérez', fechaInstalacion: '2026-10-15', fechaHoraInstalacion: '2026-10-15 14:05:09' }, ['estado', 'cliente', 'fechaInstalacion', 'fechaHoraInstalacion'], { exists: true }]);
const registro = escrituraDe(commitsTelecom[0], 'materialLogs');
const idEsperado = idRegistro('inst1', FIN);
check('el registro de material va en negativo (el drop en km), con el serial y la hora de la orden', [registro.update.name.endsWith(`/materialLogs/${idEsperado}`), registro.update.fields.id, dec(registro.update.fields)],
  [true, { doubleValue: idEsperado }, { id: idEsperado, fecha: '2026-10-15', fechaHora: '2026-10-15 14:05:09', tecnico: 'GERARDO MOLERO', apc: -2, upc: -1, drop: -0.12, grapas: 'Instalación Nueva', equipoSerial: 'HWTC1A2B3C4D', cliente: 'Ana Pérez' }]);
check('entra con su usuario y clave y escribe con esa sesión', [loginsTelecom[0], llamadasTelecom.every((l) => l.auth === 'Bearer TOKEN-1')],
  [{ email: 'api@tuempresa.com', password: 'clave-de-prueba', returnSecureToken: true }, true]);
check('queda guardado como ENVIADO en nuestra base, con lo que se envió', (({ estado, intentos, accion, serial, apc, upc, dropMetros, codigo }) => ({ estado, intentos, accion, serial, apc, upc, dropMetros, codigo }))(envio('inst1')),
  { estado: 'ENVIADO', intentos: 1, accion: 'instalacion_nueva', serial: 'HWTC1A2B3C4D', apc: 2, upc: 1, dropMetros: 120, codigo: 'IS10' });
check('un envío correcto no avisa a nadie', pushes.length, 0);

// 2) Reenviar no duplica
llamadasTelecom = [];
r = await enviar('inst1');
check('reenviar la misma orden no vuelve a escribir en el otro sistema', [r.json.estado, r.json.repetido, llamadasTelecom.length], ['ENVIADO', true, 0]);

// 3) Serial inexistente: no se envía nada, alerta y aviso
reiniciar();
inventario = {};
r = await enviar('inst1');
check('serial inexistente: no se envía nada de la orden (ni el material)', [r.json.estado, commitsTelecom.length], ['SERIAL_NO_ENCONTRADO', 0]);
check('queda la alerta guardada con lo necesario para revisarla', (({ estado, codigo, serial, cliente, tecnico }) => ({ estado, codigo, serial, cliente, tecnico }))(envio('inst1')),
  { estado: 'SERIAL_NO_ENCONTRADO', codigo: 'IS10', serial: 'HWTC1A2B3C4D', cliente: 'Ana Pérez', tecnico: 'GERARDO MOLERO' });
check('se avisa por push solo al usuario del módulo (lfernandez), de tipo inventario y con el serial', [pushes.length, pushes[0].token, pushes[0].data.title, pushes[0].data.tipo, pushes[0].data.body.includes('IS10') && pushes[0].data.body.includes('HWTC1A2B3C4D')], [1, 'tok-lf', 'Orden no enviada al inventario', 'inventario', true]);
await enviar('inst1');
check('repetir sin que cambie nada no vuelve a avisar', pushes.length, 1);

// 3b) Reintentar cuando ya lo dieron de alta en el inventario
inventario = { HWTC1A2B3C4D: { id: 'inv-1', campos: { serial: 'HWTC1A2B3C4D', estado: 'Con Técnico' } } };
r = await reintentar('inst1');
check('reintentar tras ingresar el serial al almacén lo envía', [r.json.estado, commitsTelecom.length, envio('inst1').estado], ['ENVIADO', 1, 'ENVIADO']);
check('reintentar es solo del usuario del módulo: ni un USUARIO, ni quien cierra, ni otro ADMIN pueden', [(await reintentar('inst1', 'usuario-uid')).status, (await reintentar('inst1', 'cierra-uid')).status, (await reintentar('inst1', 'admin-uid')).status], [403, 403, 403]);

// 4) Equipo ya instalado a otro cliente
reiniciar();
inventario.HWTC1A2B3C4D.campos = { serial: 'HWTC1A2B3C4D', estado: 'Instalado', cliente: 'Otro Cliente' };
r = await enviar('inst1');
check('equipo ya instalado a otro cliente: no se toca y queda alerta', [r.json.estado, commitsTelecom.length, pushes.length], ['SERIAL_YA_INSTALADO', 0, 1]);
reiniciar();
inventario.HWTC1A2B3C4D.campos = { serial: 'HWTC1A2B3C4D', estado: 'Instalado', cliente: 'Ana Pérez' };
r = await enviar('inst1');
check('equipo instalado a este mismo cliente (un reenvío parcial anterior): se completa', [r.json.estado, commitsTelecom.length], ['ENVIADO', 1]);

// 4b) Solo se descuenta el equipo que figura "Con Técnico"
reiniciar();
inventario.HWTC1A2B3C4D.campos = { serial: 'HWTC1A2B3C4D', estado: 'En Almacén' };
r = await enviar('inst1');
check('equipo que sigue "En Almacén": no se toca nada de la orden y queda alerta con el motivo', [r.json.estado, commitsTelecom.length, envio('inst1').mensaje.includes('En Almacén')], ['EQUIPO_NO_ASIGNADO', 0, true]);
check('y se avisa por push solo una vez', [pushes.length, pushes[0].token, (await enviar('inst1'), pushes.length)], [1, 'tok-lf', 1]);
inventario.HWTC1A2B3C4D.campos = { serial: 'HWTC1A2B3C4D', estado: 'Con Técnico' };
r = await reintentar('inst1');
check('cuando el almacén lo asigna al técnico, reintentar lo envía', [r.json.estado, commitsTelecom.length], ['ENVIADO', 1]);
reiniciar();
inventario.HWTC1A2B3C4D.campos = { serial: 'HWTC1A2B3C4D', estado: 'Dañado' };
check('cualquier otro estado tampoco se toca', [(await enviar('inst1')).json.estado, commitsTelecom.length], ['EQUIPO_NO_ASIGNADO', 0]);
reiniciar();
inventario.HWTC1A2B3C4D.campos = { serial: 'HWTC1A2B3C4D', estado: 'CON TECNICO' };
check('"Con Técnico" se reconoce sin importar mayúsculas ni tildes', [(await enviar('inst1')).json.estado, commitsTelecom.length], ['ENVIADO', 1]);
reiniciar();
inventario.ZTEG99887766.campos = { serial: 'ZTEG99887766', estado: 'En Almacén' };
check('un cambio de equipo con el equipo nuevo en almacén tampoco se envía', [(await enviar('cambio1')).json.estado, commitsTelecom.length], ['EQUIPO_NO_ASIGNADO', 0]);

reiniciar();
inventario.HWTC1A2B3C4D.campos = { serial: 'HWTC1A2B3C4D', estado: 'Instalado', cliente: '  ANA   PEREZ ' };
r = await enviar('inst1');
check('el mismo cliente escrito distinto en su inventario (mayúsculas, sin tilde, espacios) no es "otro cliente"', [r.json.estado, commitsTelecom.length], ['ENVIADO', 1]);

// 5) Cambio de equipo: solo el equipo, sin registro de material
reiniciar();
r = await enviar('cambio1');
check('cambio de equipo: solo se marca el equipo nuevo como instalado, sin registro de material', [r.json.estado, commitsTelecom[0].length, commitsTelecom[0][0].update.name.includes('/inventory/inv-2')], ['ENVIADO', 1, true]);

// 6) Recableado y visita: solo el material, como avería
reiniciar();
r = await enviar('rec1');
const averia = escrituraDe(commitsTelecom[0], 'materialLogs').update.fields;
check('recableado: solo el registro de material, sin buscar equipo', [r.json.estado, commitsTelecom[0].length, llamadasTelecom.some((l) => l.url.endsWith(':runQuery'))], ['ENVIADO', 1, false]);
check('recableado: avería con el motivo pegado al nombre del cliente, sin serial', [dec(averia).grapas, dec(averia).cliente, dec(averia).apc, dec(averia).upc, dec(averia).drop, 'equipoSerial' in averia], ['Avería', 'Ana Pérez (Incidente: Recableado - Orden #R1)', -1, -1, -0.04, false]);
r = await enviar('visita1');
check('visita de conector: avería con sus conectores y sin drop', (({ cliente, apc, upc, drop }) => [cliente, apc, upc, drop])(dec(escrituraDe(commitsTelecom[1], 'materialLogs').update.fields)), ['Ana Pérez (Incidente: Visita de conector interno - Orden #V1)', -2, -1, 0]);
check('la sesión del otro sistema se reutiliza entre órdenes (un solo inicio de sesión)', loginsTelecom.length, 1);

// 7) Lo que no corresponde
reiniciar();
check('una orden que aún no está aprobada no envía nada', (await enviar('pre1')).json.estado, 'OMITIDO');
check('una orden de otro tipo no envía nada', (await enviar('otra1')).json.estado, 'OMITIDO');
check('una orden que no existe: 404', (await enviar('nadie')).status, 404);
check('quien no aprueba ni finaliza (un técnico) no puede enviar', (await enviar('inst1', 'tecnico-uid')).status, 403);
check('quien cierra sin ser ADMIN sí puede', (await enviar('inst1', 'cierra-uid')).json.estado, 'ENVIADO');
check('un USUARIO (que finaliza órdenes) sí puede', (await enviar('rec1', 'usuario-uid')).json.estado, 'ENVIADO');
check('ticketId inválido: 400', (await enviar('../x')).status, 400);
check('nada se escribió en el otro sistema por las que no correspondían', commitsTelecom.length, 2);

// 8) Sin la configuración el envío está apagado
reiniciar();
llamadasTelecom = [];
r = await enviar('inst1', 'admin-uid', { ...env, TELECOM_PASSWORD: undefined });
check('sin los secretos el envío está apagado: no escribe, no guarda estado ni avisa', [r.json.estado, llamadasTelecom.length, envio('inst1'), pushes.length], ['DESHABILITADO', 0, null, 0]);

// 9) Falla de red del otro sistema: queda PENDIENTE y el cron lo reintenta; tras varios fallos pide ayuda
reiniciar();
comportamientoTelecom = 'caido';
r = await enviar('inst1');
check('si el otro sistema no responde queda PENDIENTE, sin alerta ni aviso', [r.json.estado, envio('inst1').intentos, pushes.length], ['PENDIENTE', 1, 0]);
const T0 = Date.parse('2026-10-15T18:00:00Z'); // minuto 0: toca reintentar
check('el cron no reintenta fuera de los cuartos de hora', (await reintentarPendientes(env, depsInventario, Date.parse('2026-10-15T18:05:00Z'))).reintentados, 0);
comportamientoTelecom = 'ok';
check('cuando vuelve, el cron lo envía', [(await reintentarPendientes(env, depsInventario, T0)).reintentados, envio('inst1').estado, envio('inst1').intentos, commitsTelecom.length], [1, 'ENVIADO', 2, 1]);
check('lo ENVIADO ya no se reintenta', (await reintentarPendientes(env, depsInventario, T0)).reintentados, 0);

reiniciar();
comportamientoTelecom = 'caido';
await enviar('inst1');
for (let i = 1; i < MAX_INTENTOS; i++) await reintentarPendientes(env, depsInventario, T0 + i * 900000);
check(`tras ${MAX_INTENTOS} intentos fallidos pasa a ERROR y avisa una vez`, [envio('inst1').estado, envio('inst1').intentos, pushes.length], ['ERROR', MAX_INTENTOS, 1]);
check('lo que está en ERROR no se reintenta solo', (await reintentarPendientes(env, depsInventario, T0 + 10 * 900000)).reintentados, 0);
comportamientoTelecom = 'ok';
r = await reintentar('inst1');
check('desde la alerta se puede reintentar a mano (con los intentos de cero)', [r.json.estado, envio('inst1').intentos], ['ENVIADO', 1]);

// 9b) La marca que deja la app al aprobar (sin datos de la orden): si la app no alcanzó a llamar, la recoge el cron
reiniciar();
const marca = (id) => { envios[id] = fieldsDe({ ticketId: id, estado: 'PENDIENTE', intentos: 0 }); };
marca('inst1');
check('una marca sin datos la recoge el cron y envía lo que dice la propia orden', [(await reintentarPendientes(env, depsInventario, T0)).reintentados, envio('inst1').estado, envio('inst1').serial, escrituraDe(commitsTelecom[0], 'materialLogs') ? 'con material' : 'sin material'],
  [1, 'ENVIADO', 'HWTC1A2B3C4D', 'con material']);
reiniciar();
marca('inst1');
r = await enviar('inst1');
check('si la app sí llama, la marca se envía al momento y queda ENVIADO', [r.json.estado, envio('inst1').estado, commitsTelecom.length], ['ENVIADO', 'ENVIADO', 1]);
reiniciar();
marca('fantasma');
await reintentarPendientes(env, depsInventario, T0);
check('una marca de una orden que ya no existe (archivada antes de enviarse) pasa a ERROR y avisa', [envio('fantasma').estado, envio('fantasma').mensaje.includes('archivó'), pushes.length, commitsTelecom.length], ['ERROR', true, 1, 0]);
reiniciar();
marca('otra1');
await reintentarPendientes(env, depsInventario, T0);
check('una marca de una orden que no corresponde enviar se borra, sin avisar', [envio('otra1'), pushes.length, commitsTelecom.length], [null, 0, 0]);
reiniciar();
marca('pre1');
r = await enviar('pre1');
check('una marca de una orden aún no aprobada se borra al llamar a enviar', [r.json.estado, envio('pre1')], ['OMITIDO', null]);
reiniciar();
marca('inst1'); marca('cambio1'); marca('rec1'); marca('visita1'); marca('otra1'); marca('pre1'); marca('fantasma');
check('el cron procesa de a pocos por vez (el plan gratuito limita las llamadas externas)', (await reintentarPendientes(env, depsInventario, T0)).reintentados <= 5, true);

// 10) Credenciales rechazadas y sesión vencida
reiniciar();
comportamientoTelecom = 'clave-mala';
r = await enviar('inst1');
check('si rechazan la clave queda PENDIENTE con el motivo (no se pierde la orden)', [r.json.estado, envio('inst1').mensaje.includes('INVALID_PASSWORD'), commitsTelecom.length], ['PENDIENTE', true, 0]);
reiniciar();
comportamientoTelecom = 'vencida';
r = await enviar('inst1');
check('si la sesión venció a mitad de camino se renueva y se envía', [r.json.estado, loginsTelecom.length, commitsTelecom.length], ['ENVIADO', 2, 1]);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
