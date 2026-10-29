// Prueba las reglas de Firestore del cobro de cada orden (cobrosClientes) contra el emulador local (`npm run emulators` en otra terminal). Los documentos se arman con las mismas funciones que
// usa la app (utils/cobrosClientes), así se comprueba que lo que la app escribe es lo que las reglas aceptan. Uso: `node scripts/test-cobros-clientes-reglas.mjs`.
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { armarCarga, armarCobro, armarConfirmacionCambio, armarDevolucionCobro, sincronizarCobro } from '../src/utils/cobrosClientes.js';

const APP_ID = 'default-app-id';
const testEnv = await initializeTestEnvironment({
  projectId: 'seguimientons-f2026-cobros-cliente-test',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

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
const como = (uid) => testEnv.authenticatedContext(uid);
const cobros = (ctx) => base(ctx).collection('cobrosClientes');

await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const b = base(ctx);
  await b.collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false, username: 'admin' });
  await b.collection('users').doc('usuario-uid').set({ role: 'USUARIO', disabled: false, username: 'usuario' });
  await b.collection('users').doc('cierra-uid').set({ role: 'TECNICO', puedeCerrar: true, tecnicoAsociado: 'GERARDO MOLERO', disabled: false, username: 'cierra' });
  await b.collection('users').doc('gerardo-uid').set({ role: 'TECNICO', tecnicoAsociado: 'GERARDO MOLERO', disabled: false, username: 'gerardo' });
  await b.collection('users').doc('admon-uid').set({ role: 'ADMINISTRACION', disabled: false, username: 'admon' });
  await b.collection('users').doc('admon-off-uid').set({ role: 'ADMINISTRACION', disabled: true, username: 'admon-off' });
  await b.collection('users').doc('finanzas-uid').set({ role: 'FINANZAS', disabled: false, username: 'fina' });
  await b.collection('users').doc('almacen-uid').set({ role: 'ALMACEN', disabled: false, username: 'alma' });
});

const AHORA = Date.now();
const orden = (id, extra = {}) => ({ id, codigo: id.toUpperCase(), nombre: `Cliente ${id}`, cedula: '12345678', telefono: '0414-1234567', tecnico: 'GERARDO MOLERO', tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO', estado: 'FINALIZADO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', ...extra });
const instalacion = (id) => orden(id, { tipoTrabajo: 'INSTALACIÓN', tipoVisita: '', cobroBs: '', cobroTipo: '' });
const emitir = (ctx, id, por = 'usuario', o = orden(id)) => cobros(ctx).doc(id).set(armarCobro(o, { por, ahora: AHORA }));
const leer = async (id) => { let d; await testEnv.withSecurityRulesDisabled(async (ctx) => { d = (await cobros(ctx).doc(id).get()).data(); }); return d; };

// --- Emitir ---
await check('la oficina (USUARIO, ADMIN o quien cierra) emite el cobro de una orden finalizada', async () => {
  await assertSucceeds(emitir(como('usuario-uid'), 'c1', 'usuario'));
  await assertSucceeds(emitir(como('admin-uid'), 'c2', 'admin'));
  await assertSucceeds(emitir(como('cierra-uid'), 'c3', 'cierra'));
});
await check('también una instalación, sin monto (lo escribe Administración al cargarlo)', () => assertSucceeds(emitir(como('usuario-uid'), 'i1', 'usuario', instalacion('i1'))));
await check('un técnico sin permiso de cierre, Finanzas, Almacén, quien no inició sesión y Administración no emiten', async () => {
  await assertFails(emitir(como('gerardo-uid'), 'x1', 'gerardo'));
  await assertFails(emitir(como('finanzas-uid'), 'x2', 'fina'));
  await assertFails(emitir(como('almacen-uid'), 'x3', 'alma'));
  await assertFails(emitir(testEnv.unauthenticatedContext(), 'x4', 'nadie'));
  await assertFails(emitir(como('admon-uid'), 'x5', 'admon'));
});
await check('el cobro sale a nombre de quien lo emite, pendiente, sin cargar y con el id de la orden', async () => {
  const ctx = como('usuario-uid');
  const doc = armarCobro(orden('c9'), { por: 'usuario', ahora: AHORA });
  await assertFails(cobros(ctx).doc('c9').set({ ...doc, creadoPor: 'otro' }));
  await assertFails(cobros(ctx).doc('c9').set({ ...doc, estado: 'CARGADO', cargadoPor: 'usuario', cargadoEn: AHORA }));
  await assertFails(cobros(ctx).doc('c9').set({ ...doc, anulado: true }));
  await assertFails(cobros(ctx).doc('otro-id').set(doc));
  await assertFails(cobros(ctx).doc('c9').set({ ...doc, extra: 1 }));
  await assertFails(cobros(ctx).doc('c9').set({ ...doc, monto: -5 }));
  await assertFails(cobros(ctx).doc('c9').set({ ...doc, monto: null, moneda: '' }));
  await assertFails(cobros(ctx).doc('c9').set({ ...doc, moneda: 'EUR' }));
  await assertFails(cobros(ctx).doc('c9').set({ ...doc, historial: [] }));
});

// --- Leer ---
await check('lo leen Administración, el ADMIN, la oficina y Finanzas; no el técnico, Almacén ni un Administración inactivo', async () => {
  await assertSucceeds(cobros(como('admon-uid')).doc('c1').get());
  await assertSucceeds(cobros(como('admin-uid')).get());
  await assertSucceeds(cobros(como('usuario-uid')).doc('c1').get());
  await assertSucceeds(cobros(como('finanzas-uid')).get());
  await assertFails(cobros(como('gerardo-uid')).doc('c1').get());
  await assertFails(cobros(como('almacen-uid')).doc('c1').get());
  await assertFails(cobros(como('admon-off-uid')).doc('c1').get());
  await assertFails(cobros(testEnv.unauthenticatedContext()).doc('c1').get());
});

// --- Administración ---
await check('Administración carga un cobro (quien lo cargó queda a su nombre) y lo devuelve a pendiente', async () => {
  const antes = await leer('c1');
  const { cambios } = armarCarga(antes, {}, { por: 'admon', ahora: AHORA + 1 });
  await assertSucceeds(cobros(como('admon-uid')).doc('c1').update(cambios));
  const { cambios: devuelto } = armarDevolucionCobro(await leer('c1'), { por: 'admon', ahora: AHORA + 2 });
  await assertSucceeds(cobros(como('admon-uid')).doc('c1').update(devuelto));
});
await check('el ADMIN también carga; una instalación se carga con el monto y la moneda que escribe Administración', async () => {
  await assertSucceeds(cobros(como('admin-uid')).doc('c2').update(armarCarga(await leer('c2'), {}, { por: 'admin', ahora: AHORA + 1 }).cambios));
  await assertSucceeds(cobros(como('admon-uid')).doc('i1').update(armarCarga(await leer('i1'), { monto: '45,50', moneda: 'USD' }, { por: 'admon', ahora: AHORA + 1 }).cambios));
});
await check('no firma la carga a nombre de otro, no cambia los datos de la orden y no borra el historial', async () => {
  const antes = await leer('c3');
  const { cambios } = armarCarga(antes, {}, { por: 'admon', ahora: AHORA + 1 });
  const ctx = como('admon-uid');
  await assertFails(cobros(ctx).doc('c3').update({ ...cambios, cargadoPor: 'otro' }));
  await assertFails(cobros(ctx).doc('c3').update({ ...cambios, nombre: 'Otro cliente' }));
  await assertFails(cobros(ctx).doc('c3').update({ ...cambios, tecnico: 'REINEL BRAVO' }));
  await assertFails(cobros(ctx).doc('c3').update({ ...cambios, historial: antes.historial }));
  await assertFails(cobros(ctx).doc('c3').update({ ...cambios, historial: [{ en: 1, por: 'x', detalle: 'otra cosa' }] }));
  await assertFails(cobros(ctx).doc('c3').delete());
});
await check('Administración no puede cargar sin monto un cobro que no lo trae', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => cobros(ctx).doc('i2').set(armarCobro(instalacion('i2'), { por: 'usuario', ahora: AHORA })));
  const { cambios } = armarCarga(await leer('i2'), { monto: '45', moneda: 'USD' }, { por: 'admon', ahora: AHORA + 1 });
  await assertFails(cobros(como('admon-uid')).doc('i2').update({ ...cambios, monto: null, moneda: '' }));
});

// --- Si la orden cambia ---
await check('la oficina actualiza el monto de un cobro pendiente cuando la orden cambia (sin tocar su estado)', async () => {
  const { cambios } = sincronizarCobro(await leer('c1'), orden('c1', { cobroBs: '8.000' }), { por: 'usuario', ahora: AHORA + 3 });
  await assertSucceeds(cobros(como('usuario-uid')).doc('c1').update(cambios));
  await assertFails(cobros(como('usuario-uid')).doc('c1').update({ ...cambios, estado: 'CARGADO' }));
});
await check('si ya estaba cargado, la oficina deja la alerta de cambio de monto y Administración la confirma', async () => {
  await assertSucceeds(cobros(como('admon-uid')).doc('c1').update(armarCarga(await leer('c1'), {}, { por: 'admon', ahora: AHORA + 4 }).cambios));
  const { cambios } = sincronizarCobro(await leer('c1'), orden('c1', { cobroBs: '9.000' }), { por: 'usuario', ahora: AHORA + 5 });
  await assertSucceeds(cobros(como('usuario-uid')).doc('c1').update(cambios));
  await assertSucceeds(cobros(como('admon-uid')).doc('c1').update(armarConfirmacionCambio(await leer('c1'), { por: 'admon', ahora: AHORA + 6 }).cambios));
});
await check('la oficina retira un cobro pendiente si la orden se cancela; un técnico no toca nada', async () => {
  const { cambios } = sincronizarCobro(await leer('c3'), orden('c3', { estado: 'CANCELADO' }), { por: 'usuario', ahora: AHORA + 3 });
  await assertFails(cobros(como('gerardo-uid')).doc('c3').update(cambios));
  await assertSucceeds(cobros(como('usuario-uid')).doc('c3').update(cambios));
});
await check('Finanzas y Almacén no escriben ningún cobro', async () => {
  const { cambios } = armarCarga(await leer('i2'), { monto: '45', moneda: 'USD' }, { por: 'fina', ahora: AHORA + 1 });
  await assertFails(cobros(como('finanzas-uid')).doc('i2').update(cambios));
  await assertFails(cobros(como('almacen-uid')).doc('i2').update(cambios));
});

await testEnv.cleanup();
if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
