// Prueba las reglas de Firestore de los pagos que los clientes hacen por las órdenes (pagosOrdenes, referenciasPago) y del rol ADMINISTRACION, contra el
// emulador local (`npm run emulators` en otra terminal). Los documentos se arman con las mismas funciones que usa la app (utils/pagoCliente), así se
// comprueba que lo que la app escribe es lo que las reglas aceptan. Uso: `node scripts/test-pagos-cliente-reglas.mjs`.
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { armarConciliacion, armarCorreccion, armarDevolucion, armarPagoPendiente, armarPagoRegistrado, armarSinCobrar, claveReferencia, parsePagoCliente } from '../src/utils/pagoCliente.js';

const APP_ID = 'default-app-id';
const testEnv = await initializeTestEnvironment({
  projectId: 'seguimientons-f2026-pagos-cliente-test',
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
const pagos = (ctx) => base(ctx).collection('pagosOrdenes');
const refs = (ctx) => base(ctx).collection('referenciasPago');

await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const b = base(ctx);
  await b.collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false, username: 'admin' });
  await b.collection('users').doc('usuario-uid').set({ role: 'USUARIO', disabled: false, username: 'usuario' });
  await b.collection('users').doc('gerardo-uid').set({ role: 'TECNICO', tecnicoAsociado: 'GERARDO MOLERO', disabled: false, username: 'gerardo' });
  await b.collection('users').doc('reinel-uid').set({ role: 'TECNICO', tecnicoAsociado: 'REINEL BRAVO', disabled: false, username: 'reinel' });
  await b.collection('users').doc('admon-uid').set({ role: 'ADMINISTRACION', disabled: false, username: 'admon' });
  await b.collection('users').doc('admon-off-uid').set({ role: 'ADMINISTRACION', disabled: true, username: 'admon-off' });
  await b.collection('users').doc('finanzas-uid').set({ role: 'FINANZAS', disabled: false, username: 'fina' });
  await b.collection('users').doc('almacen-uid').set({ role: 'ALMACEN', disabled: false, username: 'alma' });
  const orden = (id, extra) => b.collection('tickets').doc(id).set({ codigo: id.toUpperCase(), nombre: `Cliente ${id}`, cedula: '12345678', tipoTrabajo: 'AVERÍA', falla: 'LOS', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', ...extra });
  await orden('g1', { tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO' });
  await orden('g2', { tecnico: 'GERARDO MOLERO', estado: 'PRE-FINALIZADO' });
  await orden('g3', { tecnico: 'GERARDO MOLERO', estado: 'PENDIENTE' });
  await orden('g4', { tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO' });
  await orden('g5', { tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO' });
  await orden('g6', { tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO' });
  await orden('g7', { tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO' });
  await orden('g8', { tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO' });
  await orden('r1', { tecnico: 'REINEL BRAVO', estado: 'FINALIZADO' });
  await orden('r2', { tecnico: 'REINEL BRAVO', estado: 'FINALIZADO' });
  await b.collection('technicians').doc('tec-1').set({ name: 'GERARDO MOLERO', activo: true });
  await b.collection('reports').doc('rep-1').set({ tipoReporte: 'CIERRE', createdAt: 1, ticketsDetalle: [] });
  await b.collection('config').doc('formasPago').set({ formas: [] });
});

const AHORA = Date.now();
const valor = (extra = {}) => parsePagoCliente({ moneda: 'BS', forma: 'Pago móvil', monto: '5696', banco: 'Banesco', cuentaEmpresa: '', referencia: '123456', fecha: '2026-10-28', hora: '10:00', nota: '', ...extra }, { ahora: Date.parse('2026-10-28T15:00:00-04:00') }).valor;
const ordenDe = (id, tecnico = 'GERARDO MOLERO', estado = 'FINALIZADO') => ({ id, codigo: id.toUpperCase(), nombre: `Cliente ${id}`, cedula: '12345678', telefono: '0414-1234567', tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: '', tecnico, estado, cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' });
const registro = (id, { por = 'gerardo', tecnico = 'GERARDO MOLERO', extra, estado } = {}) => armarPagoRegistrado(ordenDe(id, tecnico, estado), valor(extra), { por, ahora: AHORA });
const pendiente = (id, { por = 'gerardo', tecnico = 'GERARDO MOLERO', nota = 'Paga el viernes', compartidoCon = null } = {}) => armarPagoPendiente(ordenDe(id, tecnico), { nota, compartidoCon }, { por, ahora: AHORA });
const reserva = (doc, por = 'gerardo') => ({ ticketId: doc.ticketId, codigo: doc.codigo, por, en: AHORA });
// El técnico registra: el pago y la reserva de su referencia, en un solo lote.
async function registrar(ctx, doc, { reservar = true, por } = {}) {
  const lote = ctx.firestore().batch();
  lote.set(pagos(ctx).doc(doc.ticketId), doc);
  if (reservar && doc.referenciaClave) lote.set(refs(ctx).doc(doc.referenciaClave), reserva(doc, por || doc.registradoPor));
  await lote.commit();
}

// --- El técnico registra el pago de su orden ---
await check('el técnico registra el pago de su orden finalizada: el pago y la reserva de su referencia en un solo lote', () => assertSucceeds(registrar(como('gerardo-uid'), registro('g1'))));
await check('también el de una orden pre-finalizada (conector interno: el cobro sale al pre-finalizar)', () => assertSucceeds(registrar(como('gerardo-uid'), registro('g2', { extra: { referencia: '222222' } }))));
await check('en efectivo no hay referencia ni reserva', () => assertSucceeds(registrar(como('gerardo-uid'), registro('g4', { extra: { forma: 'Efectivo', referencia: '', banco: '' } }))));
await check('sin reservar la referencia, no se guarda', () => assertFails(registrar(como('gerardo-uid'), registro('g5', { extra: { referencia: '555555' } }), { reservar: false })));
await check('otro técnico no puede repetir la misma referencia (misma forma y banco) en su orden', () => assertFails(registrar(como('reinel-uid'), registro('r1', { por: 'reinel', tecnico: 'REINEL BRAVO' }))));
await check('con otro banco el mismo número sí es otra referencia', () => assertSucceeds(registrar(como('reinel-uid'), registro('r1', { por: 'reinel', tecnico: 'REINEL BRAVO', extra: { banco: 'Mercantil' } }))));
await check('dos técnicos a la vez con la misma referencia: solo uno guarda (el segundo ya la encuentra reservada)', async () => {
  const a = registro('g6', { extra: { referencia: '999001' } });
  const b = registro('r2', { por: 'reinel', tecnico: 'REINEL BRAVO', extra: { referencia: '999001' } });
  await assertSucceeds(registrar(como('gerardo-uid'), a));
  await assertFails(registrar(como('reinel-uid'), b));
});
await check('no registra el pago de la orden de otro técnico', () => assertFails(registrar(como('gerardo-uid'), registro('r2', { por: 'gerardo', tecnico: 'GERARDO MOLERO', extra: { referencia: '777777' } }))));
await check('ni el de una orden que aún está pendiente', () => assertFails(registrar(como('gerardo-uid'), registro('g3', { extra: { referencia: '333333' } }))));
await check('ni a nombre de otro técnico', () => assertFails(registrar(como('gerardo-uid'), { ...registro('g7', { extra: { referencia: '888888' } }), tecnico: 'REINEL BRAVO' })));
await check('ni firmando como otro usuario', () => assertFails(registrar(como('gerardo-uid'), registro('g7', { por: 'reinel', extra: { referencia: '888888' } }))));
await check('no se crea ya conciliado ni con nota de Administración', async () => {
  const ctx = como('gerardo-uid');
  const doc = registro('g7', { extra: { referencia: '888888' } });
  await assertFails(registrar(ctx, { ...doc, estado: 'CONCILIADO' }));
  await assertFails(registrar(ctx, { ...doc, notaAdministracion: 'ya está' }));
  await assertFails(registrar(ctx, { ...doc, conciliadoPor: 'admon', conciliadoEn: AHORA }));
});
await check('el titular de Zelle se guarda en el pago, con tope de largo', async () => {
  const ctx = como('gerardo-uid');
  const doc = registro('g8', { extra: { moneda: 'USD', forma: 'Zelle', banco: 'Chase', titular: 'Juan Pérez', monto: '30', referencia: 'ZL-9001' } });
  await assertFails(registrar(ctx, { ...doc, pago: { ...doc.pago, titular: 'x'.repeat(81) } }));
  await assertSucceeds(registrar(ctx, doc));
});
await check('un monto cero, una forma inventada o un campo de más se rechazan', async () => {
  const ctx = como('gerardo-uid');
  const doc = registro('g7', { extra: { referencia: '888888' } });
  await assertFails(registrar(ctx, { ...doc, pago: { ...doc.pago, monto: 0 } }));
  await assertFails(registrar(ctx, { ...doc, pago: { ...doc.pago, forma: 'Cheque' } }));
  await assertFails(registrar(ctx, { ...doc, extra: 1 }));
});

// --- "El cliente paga después" ---
await check('el técnico dice que el cliente paga después: queda pendiente de cobro, con nota', () => assertSucceeds(registrar(como('gerardo-uid'), pendiente('g7'))));
await check('sin nota no se guarda', () => assertFails(registrar(como('reinel-uid'), pendiente('r2', { por: 'reinel', tecnico: 'REINEL BRAVO', nota: '' }))));
await check('"pagó junto con otra orden": pendiente con la otra orden, sin reserva', () => assertSucceeds(registrar(como('reinel-uid'), pendiente('r2', { por: 'reinel', tecnico: 'REINEL BRAVO', nota: 'Pagó junto con G1 (misma referencia 123456).', compartidoCon: { id: 'g1', codigo: 'G1' } }))));

// --- El técnico no edita ni borra lo registrado ---
await check('el técnico no edita su pago', () => assertFails(pagos(como('gerardo-uid')).doc('g1').update({ nota: 'cambio' })));
await check('ni lo borra', () => assertFails(pagos(como('gerardo-uid')).doc('g1').delete()));
await check('ni completa su pendiente después (ahora lo cobra Administración)', () => assertFails(pagos(como('gerardo-uid')).doc('g7').update({ estado: 'POR_CONCILIAR' })));
await check('lo vuelve a crear: es otro documento y las reglas lo tratan como edición, que no puede', () => assertFails(registrar(como('gerardo-uid'), registro('g1', { extra: { referencia: '111222' } }))));

// --- Quién lee ---
await check('el técnico lee solo lo suyo (consulta por su nombre)', async () => {
  await assertSucceeds(pagos(como('gerardo-uid')).where('tecnico', '==', 'GERARDO MOLERO').get());
  await assertFails(pagos(como('gerardo-uid')).where('tecnico', '==', 'REINEL BRAVO').get());
  await assertFails(pagos(como('gerardo-uid')).get());
});
await check('ADMINISTRACION, ADMIN y la oficina leen todos los pagos', async () => {
  await assertSucceeds(pagos(como('admon-uid')).get());
  await assertSucceeds(pagos(como('admin-uid')).get());
  await assertSucceeds(pagos(como('usuario-uid')).get());
});
await check('FINANZAS, ALMACEN, un ADMINISTRACION inactivo y quien no inició sesión no los leen', async () => {
  await assertFails(pagos(como('finanzas-uid')).get());
  await assertFails(pagos(como('almacen-uid')).get());
  await assertFails(pagos(como('admon-off-uid')).get());
  await assertFails(pagos(testEnv.unauthenticatedContext()).get());
});
await check('el técnico consulta una referencia por su id (para decir en qué orden está), nunca la lista', async () => {
  await assertSucceeds(refs(como('reinel-uid')).doc(registro('g1').referenciaClave).get());
  await assertFails(refs(como('reinel-uid')).get());
  await assertSucceeds(refs(como('admon-uid')).get());
});

// --- Administración concilia ---
const actual = async (id) => (await testEnv.withSecurityRulesDisabled(async (ctx) => { actual.ultimo = (await pagos(ctx).doc(id).get()).data(); }), actual.ultimo);
await check('ADMINISTRACION concilia un pago registrado: queda conciliado, con quién y cuándo', async () => {
  const antes = await actual('g1');
  const { cambios } = armarConciliacion(antes, {}, { por: 'admon', ahora: AHORA + 1 });
  await assertSucceeds(pagos(como('admon-uid')).doc('g1').update(cambios));
});
await check('ADMINISTRACION cobra un pendiente: registra los datos y queda conciliado (la referencia se reserva en el mismo lote)', async () => {
  const antes = await actual('g7');
  const { cambios } = armarConciliacion(antes, { valor: valor({ referencia: '424242' }) }, { por: 'admon', ahora: AHORA + 2 });
  const ctx = como('admon-uid');
  const lote = ctx.firestore().batch();
  lote.update(pagos(ctx).doc('g7'), cambios);
  lote.set(refs(ctx).doc(cambios.referenciaClave), { ticketId: 'g7', codigo: 'G7', por: 'admon', en: AHORA });
  await assertSucceeds(lote.commit());
});
await check('ADMINISTRACION puede repetir una referencia (con nota): un solo pago para dos órdenes', async () => {
  const antes = await actual('r2');
  const { cambios } = armarConciliacion(antes, { valor: valor({ referencia: '123456' }), nota: 'Un solo pago para G1 y R2', repiteReferencia: true }, { por: 'admon', ahora: AHORA + 3 });
  await assertSucceeds(pagos(como('admon-uid')).doc('r2').update(cambios));
});
await check('el ADMIN también concilia', async () => {
  const antes = await actual('g2');
  const { cambios } = armarConciliacion(antes, {}, { por: 'admin', ahora: AHORA + 4 });
  await assertSucceeds(pagos(como('admin-uid')).doc('g2').update(cambios));
});
await check('"sin cobrar" y corregir también se escriben, dejando el historial', async () => {
  const antes = await actual('g4');
  const sin = armarSinCobrar(antes, { nota: 'El cliente se mudó' }, { por: 'admon', ahora: AHORA + 5 });
  await assertSucceeds(pagos(como('admon-uid')).doc('g4').update(sin.cambios));
  const corr = armarCorreccion(await actual('g6'), { valor: valor({ referencia: '999002' }), nota: 'Estaba mal tecleada' }, { por: 'admon', ahora: AHORA + 6 });
  await assertSucceeds(pagos(como('admon-uid')).doc('g6').update(corr.cambios));
});
await check('ADMINISTRACION devuelve un pago conciliado a por conciliar, con nota', async () => {
  const antes = await actual('g2');
  const { cambios } = armarDevolucion(antes, { nota: 'Falta verificar la referencia' }, { por: 'admon', ahora: AHORA + 8 });
  await assertSucceeds(pagos(como('admon-uid')).doc('g2').update(cambios));
  await assertFails(pagos(como('gerardo-uid')).doc('g2').update(cambios));
});
await check('liberar una referencia (borrar su reserva) lo hace ADMINISTRACION, no el técnico', async () => {
  await assertFails(refs(como('gerardo-uid')).doc(registro('g1').referenciaClave).delete());
  await assertSucceeds(refs(como('admon-uid')).doc(registro('g1').referenciaClave).delete());
});
await check('ADMINISTRACION no cambia lo que no es suyo: el técnico, el código o el cobro del pago', async () => {
  const antes = await actual('g2');
  const { cambios } = armarConciliacion(antes, { nota: 'otra' }, { por: 'admon', ahora: AHORA + 7 });
  await assertFails(pagos(como('admon-uid')).doc('g2').update({ ...cambios, tecnico: 'REINEL BRAVO' }));
  await assertFails(pagos(como('admon-uid')).doc('g2').update({ ...cambios, codigo: 'X1' }));
  await assertFails(pagos(como('admon-uid')).doc('g2').update({ ...cambios, cobro: { monto: 1, moneda: 'BS' } }));
});
await check('un cambio sin dejar una línea más en el historial se rechaza', async () => {
  const antes = await actual('g2');
  const { cambios } = armarConciliacion(antes, { nota: 'otra' }, { por: 'admon', ahora: AHORA + 8 });
  await assertFails(pagos(como('admon-uid')).doc('g2').update({ ...cambios, historial: antes.historial }));
  await assertFails(pagos(como('admon-uid')).doc('g2').update({ ...cambios, historial: [cambios.historial.at(-1)] }));
});
await check('no se puede firmar la conciliación como otro usuario', async () => {
  const antes = await actual('g2');
  const { cambios } = armarConciliacion(antes, { nota: 'otra' }, { por: 'otro', ahora: AHORA + 9 });
  await assertFails(pagos(como('admon-uid')).doc('g2').update(cambios));
});
await check('la oficina, Finanzas, Almacén y los técnicos no concilian', async () => {
  const antes = await actual('g2');
  const { cambios } = armarConciliacion(antes, { nota: 'x' }, { por: 'usuario', ahora: AHORA + 10 });
  await assertFails(pagos(como('usuario-uid')).doc('g2').update(cambios));
  await assertFails(pagos(como('finanzas-uid')).doc('g2').update(cambios));
  await assertFails(pagos(como('almacen-uid')).doc('g2').update(cambios));
  await assertFails(pagos(como('gerardo-uid')).doc('g2').update(cambios));
  await assertFails(pagos(como('admon-off-uid')).doc('g2').update(cambios));
});
await check('nadie borra un pago, ni ADMINISTRACION ni el ADMIN', async () => {
  await assertFails(pagos(como('admon-uid')).doc('g2').delete());
  await assertFails(pagos(como('admin-uid')).doc('g2').delete());
});

// --- El rol ADMINISTRACION: lee las órdenes, los técnicos y los reportes; no escribe nada de eso ---
await check('ADMINISTRACION lee órdenes, técnicos, reportes y la configuración de formas de pago', async () => {
  await assertSucceeds(base(como('admon-uid')).collection('tickets').get());
  await assertSucceeds(base(como('admon-uid')).collection('technicians').get());
  await assertSucceeds(base(como('admon-uid')).collection('reports').get());
  await assertSucceeds(base(como('admon-uid')).collection('config').doc('formasPago').get());
});
await check('pero no escribe órdenes ni reportes', async () => {
  await assertFails(base(como('admon-uid')).collection('tickets').doc('g1').update({ nombre: 'x' }));
  await assertFails(base(como('admon-uid')).collection('reports').doc('rep-1').update({ total: 2 }));
  await assertFails(base(como('admon-uid')).collection('tickets').doc('nueva').set({ codigo: 'X', tecnico: 'GERARDO MOLERO' }));
});
await check('un ADMINISTRACION inactivo no lee las órdenes', () => assertFails(base(como('admon-off-uid')).collection('tickets').get()));
await check('la clave de una referencia solo admite letras minúsculas, números y guion bajo', async () => {
  const ctx = como('admon-uid');
  const doc = await actual('g2');
  const lote = ctx.firestore().batch();
  lote.update(pagos(ctx).doc('g2'), { referenciaClave: 'Ref con Espacios' });
  await assertFails(lote.commit());
  await assertFails(refs(ctx).doc('Mala Clave').set({ ticketId: 'g2', codigo: doc.codigo, por: 'admon', en: AHORA }));
});

// --- FINANZAS ve el pago de una instalación y de un cambio de equipo, en cualquier estado ---
const inst = (id, estado, tipoTrabajo = 'INSTALACIÓN', extra = {}) => {
  const doc = armarPagoRegistrado({ ...ordenDe(id), tipoTrabajo, ...extra }, valor({ referencia: `fin${id}` }, null), { por: 'gerardo', ahora: AHORA });
  return { ...doc, estado };
};
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await pagos(ctx).doc('fi-conciliada').set(inst('fi-conciliada', 'CONCILIADO'));
  await pagos(ctx).doc('fi-por-conciliar').set(inst('fi-por-conciliar', 'POR_CONCILIAR'));
  await pagos(ctx).doc('fi-cambio').set(inst('fi-cambio', 'POR_CONCILIAR', 'AVERÍA', { tipoVisita: 'CAMBIO_EQUIPO' }));
  await pagos(ctx).doc('fi-cambio-trabajo').set(inst('fi-cambio-trabajo', 'POR_CONCILIAR', 'CAMBIO DE EQUIPO'));
  await pagos(ctx).doc('fi-averia').set(inst('fi-averia', 'CONCILIADO', 'AVERÍA', { tipoVisita: 'CONECTOR_INTERNO' }));
});
await check('FINANZAS lee el pago de una instalación, completo, conciliado o no', async () => {
  const snap = await assertSucceeds(pagos(como('finanzas-uid')).doc('fi-conciliada').get());
  if (snap.data().pago.referencia !== 'finfi-conciliada') throw new Error('no trae los datos del pago');
  await assertSucceeds(pagos(como('finanzas-uid')).doc('fi-por-conciliar').get());
});
await check('y el de un cambio de equipo (por su tipo de visita o por el tipo de trabajo)', async () => {
  await assertSucceeds(pagos(como('finanzas-uid')).doc('fi-cambio').get());
  await assertSucceeds(pagos(como('finanzas-uid')).doc('fi-cambio-trabajo').get());
});
await check('pero no el de una avería u otra visita, aunque esté conciliado', () => assertFails(pagos(como('finanzas-uid')).doc('fi-averia').get()));
await check('FINANZAS lista los pagos de instalaciones y de cambios de equipo por su tipo y fecha (las consultas de la sección)', async () => {
  const ctx = como('finanzas-uid');
  const a = await assertSucceeds(pagos(ctx).where('tipoTrabajo', '==', 'INSTALACIÓN').where('creadoEn', '>=', 0).where('creadoEn', '<=', AHORA + 1000).get());
  if (!a.docs.some((d) => d.id === 'fi-por-conciliar') || a.docs.some((d) => d.id === 'fi-averia')) throw new Error('la consulta de instalaciones trae otra cosa');
  const b = await assertSucceeds(pagos(ctx).where('tipoVisita', '==', 'CAMBIO_EQUIPO').where('creadoEn', '>=', 0).where('creadoEn', '<=', AHORA + 1000).get());
  if (!b.docs.some((d) => d.id === 'fi-cambio')) throw new Error('la consulta de cambios de equipo no trae el pago');
  await assertSucceeds(pagos(ctx).where('tipoTrabajo', '==', 'CAMBIO DE EQUIPO').where('creadoEn', '>=', 0).get());
});
await check('pero no puede listar todo ni otros tipos de orden, y no escribe en los pagos', async () => {
  const ctx = como('finanzas-uid');
  await assertFails(pagos(ctx).get());
  await assertFails(pagos(ctx).where('estado', '==', 'CONCILIADO').get());
  await assertFails(pagos(ctx).where('tipoTrabajo', '==', 'AVERÍA').get());
  await assertFails(pagos(ctx).doc('fi-conciliada').update({ nota: 'x' }));
});
await check('ALMACEN sigue sin ver ese pago', () => assertFails(pagos(como('almacen-uid')).doc('fi-conciliada').get()));

await testEnv.cleanup();
if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
