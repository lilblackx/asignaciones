// Prueba, contra el emulador de Firestore (nunca producción), las reglas de la marca de pago de la revisión (revisionPagos: `pendientePago` y `pagoId`):
//   - el ADMIN deja la marca coherente con el estado al revisar y no puede tocar el pago de una orden ya pagada ni borrarla;
//   - Finanzas (o el ADMIN) la cambia al pagar y al anular un pago, SOLO en el mismo lote que crea o anula ese pago, y solo esos dos campos de una orden aprobada;
//   - nadie más la cambia, y un pago con cientos de órdenes cabe en un lote (los accesos repetidos al mismo documento del pago no pasan el límite de 20 por lote).
// Requiere el emulador encendido (`npm run emulators`). Uso: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/test-rules-pendiente-pago.mjs`.
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { conSesionReciente } from './sesion-prueba.mjs';

const APP_ID = 'default-app-id';
const testEnv = await initializeTestEnvironment({
  projectId: 'seguimientons-f2026-rules-test-pendiente',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});
conSesionReciente(testEnv);

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log(`PASS  ${name}`); } catch (err) { failures++; console.log(`FAIL  ${name}\n      ${err.message.split('\n')[0]}`); }
}

const base = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data');
const col = (db, nombre) => base(db).collection(nombre);
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const asAdmin = () => como('admin-uid');
const asFinanzas = () => como('finanzas-uid');

const revision = (extra = {}) => {
  const r = { estado: 'APROBADA', motivo: '', firma: 'abc123', dia: '2026-10-27', codigo: 'IO1', tecnico: 'GERARDO MOLERO', concepto: 'INSTALACION', tecnicoCorregido: '', conceptoCorregido: '', por: 'admin', en: 10, historial: [{ estado: 'APROBADA', por: 'admin', en: 10 }], ...extra };
  return { pendientePago: r.estado === 'APROBADA' && !r.pagoId, ...r };
};
const pago = (extra = {}) => ({ tecnico: 'GERARDO MOLERO', desde: '2026-10-01', hasta: '2026-10-31', cantidades: { INSTALACION: 1 }, tarifas: { INSTALACION: 20 }, total: 20, cantidadOrdenes: 1, nota: '', por: 'fina', creadoEn: 1, anulado: false, ...extra });
const ordenPagada = (pagoId, extra = {}) => ({ pagoId, tecnico: 'GERARDO MOLERO', concepto: 'INSTALACION', monto: 20, dia: '2026-10-27', codigo: 'IO1', ...extra });

async function sembrar(documentos = {}) {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const b = base(db);
    await b.collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false, username: 'admin' });
    await b.collection('users').doc('finanzas-uid').set({ role: 'FINANZAS', disabled: false, username: 'fina' });
    await b.collection('users').doc('usuario-uid').set({ role: 'USUARIO', disabled: false, username: 'usuario' });
    await b.collection('users').doc('tecnico-uid').set({ role: 'TECNICO', tecnicoAsociado: 'GERARDO MOLERO', disabled: false });
    for (const [ruta, datos] of Object.entries(documentos)) { const [c, id] = ruta.split('/'); await b.collection(c).doc(id).set(datos); }
  });
}

const leer = async (coleccion, id) => { let datos; await testEnv.withSecurityRulesDisabled(async (ctx) => { datos = (await col(ctx.firestore(), coleccion).doc(id).get()).data(); }); return datos; };

// Un pago con sus órdenes, y la marca de cada revisión, en un solo lote (lo que hace la app).
const pagar = (db, pagoId, ids, { revisiones = true, datosPago = pago({ cantidadOrdenes: ids.length }) } = {}) => {
  const lote = db.batch();
  lote.set(col(db, 'pagosTecnicos').doc(pagoId), datosPago);
  for (const id of ids) {
    lote.set(col(db, 'ordenesPagadas').doc(id), ordenPagada(pagoId, { codigo: id }));
    if (revisiones) lote.update(col(db, 'revisionPagos').doc(id), { pendientePago: false, pagoId });
  }
  return lote.commit();
};
// Anular: el pago queda anulado, las órdenes se borran y cada revisión vuelve a pendiente, en un solo lote.
const anular = (db, pagoId, ids, { revisiones = true, anulaElPago = true } = {}) => {
  const lote = db.batch();
  if (anulaElPago) lote.update(col(db, 'pagosTecnicos').doc(pagoId), { anulado: true, anuladoPor: 'fina', anuladoEn: 9 });
  for (const id of ids) {
    lote.delete(col(db, 'ordenesPagadas').doc(id));
    if (revisiones) lote.update(col(db, 'revisionPagos').doc(id), { pendientePago: true, pagoId: '' });
  }
  return lote.commit();
};

// ---------- ADMIN: la marca va con el estado ----------
await sembrar({ 'revisionPagos/pagada': revision({ pendientePago: false, pagoId: 'pago-x' }), 'pagosTecnicos/pago-x': pago(), 'revisionPagos/suelta': revision() });
await check('ADMIN crea una aprobada con pendientePago true; con false, sin la marca, o con otra marca incoherente, no', async () => {
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('nueva-1').set(revision()));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('nueva-2').set(revision({ pendientePago: false })));
  const sinMarca = revision(); delete sinMarca.pendientePago;
  await assertFails(col(asAdmin(), 'revisionPagos').doc('nueva-3').set(sinMarca));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('nueva-4').set(revision({ estado: 'RETENIDA', motivo: 'x', pendientePago: true })));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('nueva-5').set(revision({ pendientePago: 'si' })));
});
await check('ADMIN crea retenida, excluida o pendiente con pendientePago false', async () => {
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('ret').set(revision({ estado: 'RETENIDA', motivo: 'falta el cobro' })));
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('exc').set(revision({ estado: 'EXCLUIDA', motivo: 'prueba' })));
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('pen').set(revision({ estado: 'PENDIENTE', tecnicoCorregido: 'REINEL BRAVO' })));
});
await check('ADMIN no crea una revisión con pagoId (nace sin pagar)', async () => {
  await assertFails(col(asAdmin(), 'revisionPagos').doc('con-pago').set(revision({ pagoId: 'pago-x', pendientePago: false })));
});
await check('ADMIN cambia una sin pagar de aprobada a retenida (y de vuelta) dejando la marca coherente, y no incoherente', async () => {
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('suelta').set(revision({ estado: 'RETENIDA', motivo: 'falta el cobro' })));
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('suelta').set(revision()));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('suelta').set(revision({ estado: 'RETENIDA', motivo: 'x', pendientePago: true })));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('suelta').set(revision({ pendientePago: false })));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('suelta').update({ pendientePago: false }));
});
await check('ADMIN no le inventa un pago a una sin pagar (aunque la marque pagada)', async () => {
  await assertFails(col(asAdmin(), 'revisionPagos').doc('suelta').set(revision({ pagoId: 'pago-x', pendientePago: false })));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('suelta').update({ pagoId: 'pago-x', pendientePago: false }));
});

// ---------- ADMIN: una orden ya pagada ----------
await check('ADMIN no cambia ni quita el pago de una ya pagada, ni la vuelve a pendiente de pago, ni la borra', async () => {
  await assertFails(col(asAdmin(), 'revisionPagos').doc('pagada').set(revision({ pendientePago: true })));
  const sinPago = revision({ pendientePago: false }); delete sinPago.pagoId;
  await assertFails(col(asAdmin(), 'revisionPagos').doc('pagada').set(sinPago));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('pagada').set(revision({ pagoId: 'otro-pago', pendientePago: false })));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('pagada').update({ pendientePago: true, pagoId: '' }));
  await assertFails(col(asAdmin(), 'revisionPagos').doc('pagada').delete());
});
await check('ADMIN sí puede volver a guardar una ya pagada conservando su pago (y con pendientePago false)', async () => {
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('pagada').set(revision({ estado: 'PENDIENTE', pagoId: 'pago-x', pendientePago: false })));
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('pagada').set(revision({ pagoId: 'pago-x', pendientePago: false })));
});
await check('ADMIN borra una sin pagar (deshacer la revisión)', async () => {
  await assertSucceeds(col(asAdmin(), 'revisionPagos').doc('suelta').delete());
});
await check('Finanzas no borra ni crea revisiones; nadie más las escribe', async () => {
  await assertFails(col(asFinanzas(), 'revisionPagos').doc('nueva-f').set(revision({ por: 'fina' })));
  await assertFails(col(asFinanzas(), 'revisionPagos').doc('pagada').delete());
  await assertFails(col(como('usuario-uid'), 'revisionPagos').doc('nueva-u').set(revision()));
  await assertFails(col(como('tecnico-uid'), 'revisionPagos').doc('nueva-t').set(revision()));
});

// ---------- Pagar: Finanzas marca la revisión en el mismo lote que crea el pago ----------
await sembrar({ 'revisionPagos/a': revision({ codigo: 'a' }), 'revisionPagos/b': revision({ codigo: 'b' }), 'revisionPagos/ret': revision({ estado: 'RETENIDA', motivo: 'x' }) });
await check('Pagar: Finanzas crea el pago, sus órdenes y marca las revisiones en un solo lote', async () => {
  await assertSucceeds(pagar(asFinanzas(), 'pago-1', ['a', 'b']));
  const r = await leer('revisionPagos', 'a');
  if (r.pendientePago !== false || r.pagoId !== 'pago-1') throw new Error(`la marca quedó ${JSON.stringify([r.pendientePago, r.pagoId])}`);
});
await sembrar({ 'revisionPagos/a': revision({ codigo: 'a' }), 'revisionPagos/ret': revision({ estado: 'RETENIDA', motivo: 'x' }), 'revisionPagos/ya': revision({ codigo: 'ya', pendientePago: false, pagoId: 'pago-viejo' }), 'pagosTecnicos/pago-viejo': pago(), 'pagosTecnicos/pago-ya': pago() });
await check('Pagar: sin crear el pago en ese lote no se puede marcar la revisión', async () => {
  await assertFails(col(asFinanzas(), 'revisionPagos').doc('a').update({ pendientePago: false, pagoId: 'pago-inventado' }));
  await assertFails(col(asFinanzas(), 'revisionPagos').doc('a').update({ pendientePago: false, pagoId: 'pago-ya' }));
  await assertFails(pagar(asFinanzas(), 'pago-2', ['a'], { revisiones: false }).then(() => col(asFinanzas(), 'revisionPagos').doc('a').update({ pendientePago: false, pagoId: 'pago-2' })));
});
await sembrar({ 'revisionPagos/a': revision({ codigo: 'a' }), 'revisionPagos/ret': revision({ estado: 'RETENIDA', motivo: 'x' }), 'revisionPagos/ya': revision({ codigo: 'ya', pendientePago: false, pagoId: 'pago-viejo' }), 'pagosTecnicos/pago-viejo': pago() });
await check('Pagar: una retenida, una ya pagada o una sin marca no se marcan; tampoco se cambia nada más', async () => {
  await assertFails(pagar(asFinanzas(), 'pago-3', ['ret']));
  await assertFails(pagar(asFinanzas(), 'pago-4', ['ya']));
  const intento = (pagoId, cambio) => {
    const db = asFinanzas();
    const lote = db.batch();
    lote.set(col(db, 'pagosTecnicos').doc(pagoId), pago());
    lote.set(col(db, 'ordenesPagadas').doc('a'), ordenPagada(pagoId));
    lote.update(col(db, 'revisionPagos').doc('a'), cambio);
    return lote.commit();
  };
  await assertFails(intento('pago-5', { pendientePago: false, pagoId: 'pago-5', estado: 'EXCLUIDA', motivo: 'x' }));
  await assertFails(intento('pago-6', { pendientePago: false, pagoId: '' }));
  await assertFails(intento('pago-7', { pendientePago: true, pagoId: 'pago-7' }));
  await assertSucceeds(intento('pago-ok', { pendientePago: false, pagoId: 'pago-ok' }));
});
await sembrar({ 'revisionPagos/a': revision({ codigo: 'a' }) });
await check('Pagar: nadie más (usuario, técnico) marca revisiones; el ADMIN sí, como Finanzas', async () => {
  await assertFails(pagar(como('usuario-uid'), 'pago-8', ['a']));
  await assertFails(pagar(como('tecnico-uid'), 'pago-9', ['a']));
  await assertSucceeds(pagar(asAdmin(), 'pago-10', ['a'], { datosPago: pago({ por: 'admin' }) }));
});

// ---------- Anular ----------
await sembrar({ 'revisionPagos/a': revision({ codigo: 'a' }), 'revisionPagos/b': revision({ codigo: 'b' }), 'revisionPagos/sin-pagar': revision({ codigo: 'c' }) });
await pagar(asFinanzas(), 'pago-1', ['a', 'b']);
await check('Anular: sin anular el pago en ese lote, las revisiones no vuelven a pendiente', async () => {
  await assertFails(anular(asFinanzas(), 'pago-1', ['a', 'b'], { anulaElPago: false }));
  await assertFails(col(asFinanzas(), 'revisionPagos').doc('a').update({ pendientePago: true, pagoId: '' }));
});
await check('Anular: una sin pagar no se "anula", y no se cambia otro campo', async () => {
  const intento = (id, cambio) => {
    const db = asFinanzas();
    const lote = db.batch();
    lote.update(col(db, 'pagosTecnicos').doc('pago-1'), { anulado: true, anuladoPor: 'fina', anuladoEn: 9 });
    lote.update(col(db, 'revisionPagos').doc(id), cambio);
    return lote.commit();
  };
  await assertFails(intento('sin-pagar', { pendientePago: true, pagoId: '' }));
  await assertFails(intento('a', { pendientePago: true, pagoId: '', estado: 'EXCLUIDA', motivo: 'x' }));
});
await check('Anular: Finanzas anula el pago, borra las órdenes y vuelve a pendiente cada revisión en un solo lote', async () => {
  await assertSucceeds(anular(asFinanzas(), 'pago-1', ['a', 'b']));
  const r = await leer('revisionPagos', 'a');
  if (r.pendientePago !== true || r.pagoId !== '') throw new Error(`la marca quedó ${JSON.stringify([r.pendientePago, r.pagoId])}`);
});
await check('Anular: con el pago ya anulado no se puede volver a mover la marca; y la orden vuelve a poder pagarse con otro pago', async () => {
  await assertFails(col(asFinanzas(), 'revisionPagos').doc('a').update({ pendientePago: false, pagoId: 'pago-1' }));
  await assertSucceeds(pagar(asFinanzas(), 'pago-nuevo', ['a', 'b']));
});

// ---------- Un pago grande cabe en un lote ----------
const N = 220;
const ids = Array.from({ length: N }, (_, i) => `masiva-${i}`);
await sembrar(Object.fromEntries(ids.map((id) => [`revisionPagos/${id}`, revision({ codigo: id })])));
await check(`Un pago de ${N} órdenes (${1 + 2 * N} escrituras) cabe en un lote: ni los accesos al pago pasan el límite de reglas`, async () => {
  await assertSucceeds(pagar(asFinanzas(), 'pago-grande', ids, { datosPago: pago({ cantidadOrdenes: N, cantidades: { INSTALACION: N }, total: 20 * N }) }));
});
await check(`Y anularlo (${N} órdenes borradas y ${N} revisiones que vuelven a pendiente) también`, async () => {
  await assertSucceeds(anular(asFinanzas(), 'pago-grande', ids));
});

await testEnv.cleanup();
if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas de la marca de pago pasaron.');
