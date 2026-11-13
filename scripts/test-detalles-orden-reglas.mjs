// Prueba las reglas de los "Detalles de la orden" contra los emuladores locales (`npm run emulators` en otra terminal, con Firestore y Storage): las de Firestore (el técnico guarda `detallesOrden` en su orden finalizada) y las
// de Storage (quién sube y quién ve las fotos). Los datos se arman con las mismas funciones que usa la app (utils/detallesOrden), así se comprueba que lo que la app escribe es lo que las reglas aceptan.
// Uso: `node scripts/test-detalles-orden-reglas.mjs`.
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { conSesionReciente } from './sesion-prueba.mjs';
import { armarDetalles } from '../src/utils/detallesOrden.js';

const APP_ID = 'default-app-id';
const testEnv = await initializeTestEnvironment({
  // El emulador de Storage lee Firestore del proyecto con el que arrancó (el de firebase.json), así que la prueba usa ese mismo proyecto.
  projectId: 'seguimientons-f2026',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});
conSesionReciente(testEnv);

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message.split('\n')[0]}`);
  }
}

const base = (ctx) => ctx.firestore().collection('artifacts').doc(APP_ID).collection('public').doc('data');
const como = (uid, claims) => testEnv.authenticatedContext(uid, claims);
const orden = (ctx, id) => base(ctx).collection('tickets').doc(id);

await testEnv.clearFirestore();
await testEnv.clearStorage();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const b = base(ctx);
  await b.collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false, username: 'admin' });
  await b.collection('users').doc('usuario-uid').set({ role: 'USUARIO', disabled: false, username: 'usuario' });
  await b.collection('users').doc('gerardo-uid').set({ role: 'TECNICO', tecnicoAsociado: 'GERARDO MOLERO', disabled: false, username: 'gerardo' });
  await b.collection('users').doc('reinel-uid').set({ role: 'TECNICO', tecnicoAsociado: 'REINEL BRAVO', disabled: false, username: 'reinel' });
  await b.collection('users').doc('gerardo-off-uid').set({ role: 'TECNICO', tecnicoAsociado: 'GERARDO MOLERO', disabled: true, username: 'gerardo-off' });
  await b.collection('users').doc('finanzas-uid').set({ role: 'FINANZAS', disabled: false, username: 'fina' });
  await b.collection('users').doc('admon-uid').set({ role: 'ADMINISTRACION', disabled: false, username: 'admon' });
  await b.collection('users').doc('almacen-uid').set({ role: 'ALMACEN', disabled: false, username: 'alma' });
  await b.collection('users').doc('infra-hist-uid').set({ role: 'INFRAESTRUCTURA', disabled: false, username: 'infrahist', puedeVerHistorial: true });
  await b.collection('users').doc('infra-uid').set({ role: 'INFRAESTRUCTURA', disabled: false, username: 'infra' });
  // Lo que lee el Detalle de la orden del historial: la revisión, el cobro y el pago de una orden.
  await b.collection('revisionPagos').doc('g1').set({ estado: 'APROBADA', sinDetalles: 'motivo', por: 'admin', en: 1 });
  await b.collection('cobrosClientes').doc('g1').set({ ticketId: 'g1', estado: 'PENDIENTE' });
  await b.collection('pagosOrdenes').doc('g1').set({ ticketId: 'g1', tecnico: 'GERARDO MOLERO', tipoTrabajo: 'AVERÍA' });
  const ord = (id, tecnico, estado, extra = {}) => b.collection('tickets').doc(id).set({ codigo: id.toUpperCase(), nombre: `Cliente ${id}`, tipoTrabajo: 'AVERÍA', falla: 'LOS', tecnico, estado, historialEdiciones: [], ...extra });
  for (const id of ['g1', 'g2', 'g4', 'g5', 'g6', 'g7']) await ord(id, 'GERARDO MOLERO', 'FINALIZADO', { finalizadoEn: Date.now() });
  await ord('gp', 'GERARDO MOLERO', 'PRE-FINALIZADO');
  await ord('r1', 'REINEL BRAVO', 'FINALIZADO', { finalizadoEn: Date.now() });
  await ord('g3', 'GERARDO MOLERO', 'FINALIZADO', { finalizadoEn: Date.now(), detallesOrden: armarDetalles([{ ruta: 'ordenes/g3/01-a.jpg', bytes: 1000 }, { ruta: 'ordenes/g3/02-a.jpg', bytes: 1000 }], { por: 'gerardo' }) });
});

const AHORA = Date.now();
const fotosDe = (id, n = 3) => Array.from({ length: n }, (_, i) => ({ ruta: `ordenes/${id}/0${i + 1}-abc.jpg`, bytes: 250000 }));
const detalles = (id, { n = 3, por = 'gerardo', fotos } = {}) => armarDetalles(fotos || fotosDe(id, n), { por, ahora: AHORA });
const guardar = (ctx, id, d, extra = {}) => orden(ctx, id).update({ detallesOrden: d, ...extra });

// --- Firestore: el técnico guarda los detalles de su orden finalizada ---
await check('el técnico guarda los detalles de su orden finalizada (3 fotos)', () => assertSucceeds(guardar(como('gerardo-uid'), 'g1', detalles('g1'))));
await check('con el mínimo (2) y el máximo (7) de fotos', async () => {
  await assertSucceeds(guardar(como('gerardo-uid'), 'g2', detalles('g2', { n: 2 })));
  await assertSucceeds(guardar(como('gerardo-uid'), 'g4', detalles('g4', { n: 7 })));
});
await check('una sola foto o más de 7 se rechazan', async () => {
  await assertFails(guardar(como('gerardo-uid'), 'g5', detalles('g5', { n: 1 })));
  await assertFails(guardar(como('gerardo-uid'), 'g5', detalles('g5', { n: 8 })));
});
await check('el historial puede crecer con la entrada de los detalles', () => assertSucceeds(guardar(como('gerardo-uid'), 'g5', detalles('g5'), { historialEdiciones: [{ fecha: '12/11/26', operador: 'gerardo', tipo: 'detallesOrden', detalle: 'Subió los detalles de la orden: 3 fotos' }] })));
await check('no los guarda en una orden pre-finalizada (solo cuando la oficina la finaliza)', () => assertFails(guardar(como('gerardo-uid'), 'gp', detalles('gp'))));
await check('no los guarda en la orden de otro técnico', () => assertFails(guardar(como('gerardo-uid'), 'r1', detalles('r1'))));
await check('el técnico corrige los detalles ya guardados (quita o cambia fotos), siempre de 2 a 7', async () => {
  await assertSucceeds(guardar(como('gerardo-uid'), 'g3', detalles('g3', { n: 3 })));
  await assertSucceeds(guardar(como('gerardo-uid'), 'g3', detalles('g3', { n: 2 })));
  await assertFails(guardar(como('gerardo-uid'), 'g3', detalles('g3', { n: 1 })));
});
await check('otro técnico no corrige los detalles de la orden de Gerardo', () => assertFails(guardar(como('reinel-uid'), 'g3', detalles('g3', { por: 'reinel' }))));
await check('las fotos tienen que ser de la propia orden', async () => {
  await assertFails(guardar(como('gerardo-uid'), 'g6', detalles('g6', { fotos: [{ ruta: 'ordenes/r1/01-a.jpg', bytes: 1000 }, { ruta: 'ordenes/r1/02-a.jpg', bytes: 1000 }] })));
  await assertFails(guardar(como('gerardo-uid'), 'g6', detalles('g6', { fotos: [...fotosDe('g6', 2), { ruta: 'ordenes/g6/03-a.jpg', bytes: 1000 }, { ruta: 'ordenes/OTRA/04-a.jpg', bytes: 1000 }] })));
});
await check('una ruta que no es JPEG o que pesa más de 1 MB se rechaza', async () => {
  await assertFails(guardar(como('gerardo-uid'), 'g6', detalles('g6', { fotos: [{ ruta: 'ordenes/g6/01-a.png', bytes: 1000 }, { ruta: 'ordenes/g6/02-a.jpg', bytes: 1000 }] })));
  await assertFails(guardar(como('gerardo-uid'), 'g6', detalles('g6', { fotos: [{ ruta: 'ordenes/g6/01-a.jpg', bytes: 1048577 }, { ruta: 'ordenes/g6/02-a.jpg', bytes: 1000 }] })));
});
await check('tiene que ir a nombre de quien los sube y sin campos de más', async () => {
  await assertFails(guardar(como('gerardo-uid'), 'g6', detalles('g6', { por: 'reinel' })));
  await assertFails(guardar(como('gerardo-uid'), 'g6', { ...detalles('g6'), extra: 1 }));
});
await check('un técnico desactivado no los guarda', () => assertFails(guardar(como('gerardo-off-uid'), 'g7', detalles('g7'))));
await check('un técnico con la sesión vencida (más de 7 días) no los guarda', () => assertFails(guardar(como('gerardo-uid', { auth_time: Math.floor(Date.now() / 1000) - 8 * 24 * 3600 }), 'g7', detalles('g7'))));
await check('ni la oficina ni otros roles los escriben desde el técnico: la oficina sí puede corregir la orden', async () => {
  await assertSucceeds(orden(como('admin-uid'), 'g6').update({ observacion: 'nota de la oficina' }));
  await assertFails(guardar(como('almacen-uid'), 'g6', detalles('g6')));
});

// --- Storage: quién sube y quién ve las fotos ---
// Un archivo ya subido no se sobrescribe, así que cada corrida usa nombres propios.
const CORRIDA = Date.now().toString(36);
const archivo = (uid, ruta, { claims } = {}) => como(uid, claims).storage().ref(ruta);
const jpeg = (n) => new Uint8Array(n).fill(7);
const subir = (uid, ruta, { bytes = 200000, tipo = 'image/jpeg', claims } = {}) => archivo(uid, ruta, { claims }).put(jpeg(bytes), { contentType: tipo });

await check('Storage: el técnico sube un JPEG de su orden finalizada', () => assertSucceeds(subir('gerardo-uid', `ordenes/g1/01-${CORRIDA}.jpg`)));
await check('Storage: no sube a la orden de otro técnico', () => assertFails(subir('gerardo-uid', `ordenes/r1/01-${CORRIDA}.jpg`)));
await check('Storage: no sube a una orden pre-finalizada', () => assertFails(subir('gerardo-uid', `ordenes/gp/01-${CORRIDA}.jpg`)));
await check('Storage: solo JPEG (no PNG, ni un JPEG con otro tipo de contenido)', async () => {
  await assertFails(subir('gerardo-uid', `ordenes/g1/02-${CORRIDA}.png`));
  await assertFails(subir('gerardo-uid', `ordenes/g1/02-${CORRIDA}.jpg`, { tipo: 'text/html' }));
});
await check('Storage: hasta 1 MB y no vacío', async () => {
  await assertSucceeds(subir('gerardo-uid', `ordenes/g1/03-${CORRIDA}.jpg`, { bytes: 1024 * 1024 }));
  await assertFails(subir('gerardo-uid', `ordenes/g1/04-${CORRIDA}.jpg`, { bytes: 1024 * 1024 + 1 }));
  await assertFails(subir('gerardo-uid', `ordenes/g1/05-${CORRIDA}.jpg`, { bytes: 0 }));
});
await check('Storage: la oficina, Finanzas y Administración no suben fotos (las sube el técnico)', async () => {
  await assertFails(subir('admin-uid', `ordenes/g1/06-${CORRIDA}.jpg`));
  await assertFails(subir('finanzas-uid', `ordenes/g1/06-${CORRIDA}.jpg`));
  await assertFails(subir('admon-uid', `ordenes/g1/06-${CORRIDA}.jpg`));
});
await check('Storage: un técnico desactivado o con la sesión vencida no sube', async () => {
  await assertFails(subir('gerardo-off-uid', `ordenes/g1/07-${CORRIDA}.jpg`));
  await assertFails(subir('gerardo-uid', `ordenes/g1/07-${CORRIDA}.jpg`, { claims: { auth_time: Math.floor(Date.now() / 1000) - 8 * 24 * 3600 } }));
});
await check('Storage: sin sesión no sube ni ve nada', async () => {
  await assertFails(testEnv.unauthenticatedContext().storage().ref(`ordenes/g1/08-${CORRIDA}.jpg`).put(jpeg(1000), { contentType: 'image/jpeg' }));
  await assertFails(testEnv.unauthenticatedContext().storage().ref(`ordenes/g1/01-${CORRIDA}.jpg`).getDownloadURL());
});
await check('Storage: no sale de la carpeta de las órdenes', () => assertFails(subir('gerardo-uid', 'otra/g1/01-abc.jpg')));
await check('Storage: ven las fotos la oficina, Administración, Finanzas y el técnico de la orden', async () => {
  for (const uid of ['admin-uid', 'usuario-uid', 'admon-uid', 'finanzas-uid', 'gerardo-uid']) await assertSucceeds(archivo(uid, `ordenes/g1/01-${CORRIDA}.jpg`).getDownloadURL());
});
await check('Storage: no las ve otro técnico ni Almacén', async () => {
  await assertFails(archivo('reinel-uid', `ordenes/g1/01-${CORRIDA}.jpg`).getDownloadURL());
  await assertFails(archivo('almacen-uid', `ordenes/g1/01-${CORRIDA}.jpg`).getDownloadURL());
});
await check('Storage: ve las fotos Infraestructura con el permiso de historial, y no la que no lo tiene', async () => {
  await assertSucceeds(archivo('infra-hist-uid', `ordenes/g1/01-${CORRIDA}.jpg`).getDownloadURL());
  await assertFails(archivo('infra-uid', `ordenes/g1/01-${CORRIDA}.jpg`).getDownloadURL());
});
await check('Firestore: Infraestructura con permiso de historial lee la revisión, el cobro y el pago de una orden por su id (no las listas); sin el permiso no lee nada', async () => {
  for (const coleccion of ['revisionPagos', 'cobrosClientes', 'pagosOrdenes']) {
    await assertSucceeds(base(como('infra-hist-uid')).collection(coleccion).doc('g1').get());
    await assertFails(base(como('infra-hist-uid')).collection(coleccion).get());
    await assertFails(base(como('infra-uid')).collection(coleccion).doc('g1').get());
    await assertFails(base(como('infra-hist-uid')).collection(coleccion).doc('g1').set({ estado: 'APROBADA' }));
  }
});
await check('Storage: nadie sobrescribe una foto y solo el técnico de la orden la borra (para cambiarla se sube otra y se quita la anterior)', async () => {
  await assertFails(subir('gerardo-uid', `ordenes/g1/01-${CORRIDA}.jpg`));
  await assertFails(archivo('admin-uid', `ordenes/g1/01-${CORRIDA}.jpg`).delete());
  await assertFails(archivo('reinel-uid', `ordenes/g1/01-${CORRIDA}.jpg`).delete());
  await assertFails(archivo('finanzas-uid', `ordenes/g1/01-${CORRIDA}.jpg`).delete());
  await assertSucceeds(archivo('gerardo-uid', `ordenes/g1/01-${CORRIDA}.jpg`).delete());
});
await check('Storage: no borra la foto de una orden que ya no está finalizada', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await base(ctx).collection('tickets').doc('g2').update({ estado: 'CANCELADO' }); });
  await assertFails(archivo('gerardo-uid', `ordenes/g2/01-${CORRIDA}.jpg`).delete());
});

await testEnv.cleanup();
if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
