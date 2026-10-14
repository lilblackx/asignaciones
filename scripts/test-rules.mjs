// Prueba las reglas de Firestore contra el emulador local, sin tocar producción.
// Requiere que el emulador esté corriendo: `npm run emulators` en otra terminal
// (o se levanta uno efímero automáticamente vía initializeTestEnvironment si ya
// hay un host de firestore configurado en firebase.json).
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

const APP_ID = 'default-app-id';

const testEnv = await initializeTestEnvironment({
  projectId: 'seguimientons-f2026-rules-test',
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080
  }
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

// --- Seed de datos de prueba, con reglas desactivadas (contexto admin del test) ---
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const base = db.collection('artifacts').doc(APP_ID).collection('public').doc('data');

  await base.collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false });
  await base.collection('users').doc('usuario-uid').set({ role: 'USUARIO', disabled: false });
  await base.collection('users').doc('tecnico-uid').set({ role: 'TECNICO', tecnicoAsociado: 'GERARDO MOLERO', disabled: false });
  await base.collection('users').doc('otro-tecnico-uid').set({ role: 'TECNICO', tecnicoAsociado: 'REINEL BRAVO', disabled: false });

  await base.collection('tickets').doc('ticket-de-gerardo').set({
    tecnico: 'GERARDO MOLERO', codigo: 'AS1', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'PENDIENTE'
  });
  await base.collection('tickets').doc('ticket-de-reinel').set({
    tecnico: 'REINEL BRAVO', codigo: 'AS2', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'PENDIENTE'
  });

  await base.collection('tickets').doc('gerardo-campos').set({
    tecnico: 'GERARDO MOLERO', codigo: 'AS3', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'PENDIENTE',
    nombre: 'CLIENTE', direccion: 'CALLE 1', nap: '', observacion: '', historialEdiciones: [{ detalle: 'creada' }]
  });
  await base.collection('tickets').doc('gerardo-finalizado').set({
    tecnico: 'GERARDO MOLERO', codigo: 'AS4', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'FINALIZADO'
  });
  await base.collection('counters').doc('A_O_2026').set({ ultimo: 5, actualizadoEn: 0 });

  await base.collection('technicians').doc('GERARDO-MOLERO').set({ name: 'GERARDO MOLERO', color: 'bg-fuchsia-500 text-white', activo: true });
  await base.collection('technicians').doc('REINEL-BRAVO').set({ name: 'REINEL BRAVO', color: 'bg-green-500 text-white', activo: true });

  await base.collection('config').doc('turnoInstalaciones').set({ orden: ['GERARDO MOLERO', 'REINEL BRAVO'], turnoActualIndex: 0 });
  await base.collection('config').doc('formasPago').set({ formas: [{ tipo: 'PAGO_MOVIL', banco: 'BNC', telefono: '0412-0000000', rif: 'J-000000000' }] });
});

const asAdmin = () => testEnv.authenticatedContext('admin-uid').firestore();
const asUsuario = () => testEnv.authenticatedContext('usuario-uid').firestore();
const asTecnico = () => testEnv.authenticatedContext('tecnico-uid').firestore();
const asOtroTecnico = () => testEnv.authenticatedContext('otro-tecnico-uid').firestore();
const ticketPath = (db, id) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('tickets').doc(id);

await check('ADMIN lee cualquier ticket', async () => {
  await assertSucceeds(ticketPath(asAdmin(), 'ticket-de-reinel').get());
});

await check('TECNICO lee su propio ticket (con where)', async () => {
  const db = asTecnico();
  const q = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('tickets').where('tecnico', '==', 'GERARDO MOLERO');
  await assertSucceeds(q.get());
});

await check('TECNICO NO puede listar todos los tickets (sin where)', async () => {
  const db = asTecnico();
  const q = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('tickets');
  await assertFails(q.get());
});

await check('TECNICO NO puede leer directo el ticket de otro técnico', async () => {
  await assertFails(ticketPath(asTecnico(), 'ticket-de-reinel').get());
});

await check('TECNICO puede marcar su ticket PRE-FINALIZADO', async () => {
  await assertSucceeds(ticketPath(asTecnico(), 'ticket-de-gerardo').set({
    tecnico: 'GERARDO MOLERO', codigo: 'AS1', tipoTrabajo: 'AVERÍA', creado: 'usuario',
    estado: 'PRE-FINALIZADO', nap: '', observacion: ''
  }));
});

await check('TECNICO NO puede poner su ticket en FINALIZADO', async () => {
  await assertFails(ticketPath(asTecnico(), 'ticket-de-gerardo').set({
    tecnico: 'GERARDO MOLERO', codigo: 'AS1', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'FINALIZADO'
  }));
});

await check('TECNICO NO puede reasignar el ticket a otro técnico', async () => {
  await assertFails(ticketPath(asTecnico(), 'ticket-de-gerardo').set({
    tecnico: 'REINEL BRAVO', codigo: 'AS1', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'PENDIENTE'
  }));
});

await check('TECNICO NO puede escribir el ticket de otro técnico', async () => {
  await assertFails(ticketPath(asTecnico(), 'ticket-de-reinel').set({
    tecnico: 'REINEL BRAVO', codigo: 'AS2', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'PRE-FINALIZADO'
  }));
});

await check('USUARIO puede aprobar (poner FINALIZADO) un ticket ajeno', async () => {
  await assertSucceeds(ticketPath(asUsuario(), 'ticket-de-reinel').set({
    tecnico: 'REINEL BRAVO', codigo: 'AS2', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'FINALIZADO'
  }));
});

await check('TECNICO NO puede crear tickets', async () => {
  const db = asTecnico();
  await assertFails(db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('tickets').doc('nuevo').set({
    tecnico: 'GERARDO MOLERO', codigo: 'AS3', tipoTrabajo: 'AVERÍA', creado: 'tecnico', estado: 'PENDIENTE'
  }));
});

const techPathGerardo = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('technicians').doc('GERARDO-MOLERO');
const techPathReinel = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('technicians').doc('REINEL-BRAVO');
const techsCol = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('technicians');

await check('USUARIO puede togglear "activo" de un técnico', async () => {
  await assertSucceeds(techPathGerardo(asUsuario()).update({ activo: false, activoUpdatedBy: 'usuario', activoUpdatedByRole: 'USUARIO', activoUpdatedAt: Date.now() }));
});

await check('USUARIO NO puede cambiar el color de un técnico', async () => {
  await assertFails(techPathGerardo(asUsuario()).update({ color: 'bg-red-500 text-white' }));
});

await check('TECNICO lee su propio técnico (con where)', async () => {
  await assertSucceeds(techsCol(asTecnico()).where('name', '==', 'GERARDO MOLERO').get());
});

await check('TECNICO NO puede listar todos los técnicos (sin where)', async () => {
  await assertFails(techsCol(asTecnico()).get());
});

await check('TECNICO NO puede leer directo el técnico de otro', async () => {
  await assertFails(techPathReinel(asTecnico()).get());
});

await check('TECNICO puede togglear "activo" de SU PROPIO técnico', async () => {
  await assertSucceeds(techPathGerardo(asTecnico()).update({ activo: false, activoUpdatedBy: 'tecnico1', activoUpdatedByRole: 'TECNICO', activoUpdatedAt: Date.now() }));
});

await check('TECNICO NO puede togglear "activo" del técnico de otro', async () => {
  await assertFails(techPathReinel(asTecnico()).update({ activo: false, activoUpdatedBy: 'tecnico1', activoUpdatedByRole: 'TECNICO', activoUpdatedAt: Date.now() }));
});

await check('TECNICO NO puede cambiar el color aunque sea su propio técnico', async () => {
  await assertFails(techPathGerardo(asTecnico()).update({ color: 'bg-red-500 text-white' }));
});

await check('ADMIN puede cambiar cualquier campo de un técnico', async () => {
  await assertSucceeds(techPathGerardo(asAdmin()).update({ activo: true, color: 'bg-blue-500 text-white' }));
});

const turnoPath = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('config').doc('turnoInstalaciones');

await check('USUARIO puede avanzar el puntero del turno', async () => {
  await assertSucceeds(turnoPath(asUsuario()).update({ turnoActualIndex: 1 }));
});

await check('USUARIO NO puede cambiar el orden del turno', async () => {
  await assertFails(turnoPath(asUsuario()).update({ orden: ['REINEL BRAVO', 'GERARDO MOLERO'] }));
});

await check('TECNICO NO puede tocar el turno de instalaciones', async () => {
  await assertFails(turnoPath(asTecnico()).update({ turnoActualIndex: 1 }));
});

await check('ADMIN puede reordenar el turno de instalaciones', async () => {
  await assertSucceeds(turnoPath(asAdmin()).set({ orden: ['REINEL BRAVO', 'GERARDO MOLERO'], turnoActualIndex: 0, actualizadoPor: 'admin', actualizadoEn: Date.now() }));
});

// --- Formas de pago: todos las leen (el técnico las copia), solo ADMIN las cambia ---
const formasPagoPath = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('config').doc('formasPago');
const formasNuevas = { formas: [{ tipo: 'CUENTA', banco: 'Banesco', numero: '0134-0000-00-0000000000', titular: 'Empresa', rif: 'J-000000000' }], actualizadoEn: 1, actualizadoPor: 'admin' };

await check('TECNICO puede leer las formas de pago', async () => {
  await assertSucceeds(formasPagoPath(asTecnico()).get());
});

await check('TECNICO NO puede modificar las formas de pago', async () => {
  await assertFails(formasPagoPath(asTecnico()).set(formasNuevas));
});

await check('USUARIO NO puede modificar las formas de pago', async () => {
  await assertFails(formasPagoPath(asUsuario()).set(formasNuevas));
});

await check('ADMIN puede guardar las formas de pago', async () => {
  await assertSucceeds(formasPagoPath(asAdmin()).set(formasNuevas));
});

// --- Campos que el TECNICO puede tocar en su propia orden ---
const camposGerardo = (db) => ticketPath(db, 'gerardo-campos');

await check('TECNICO puede pre-finalizar con NAP, potencia, observación e historial', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({
    estado: 'PRE-FINALIZADO', nap: 'N10D14', potenciaDbm: -19.5, observacion: 'listo', observacionInterna: false,
    napCoordenadas: '10.1,-71.1', historialEdiciones: [{ detalle: 'creada' }, { detalle: 'prefinalizado' }]
  }));
});

await check('TECNICO puede registrar un recableado (metros, conectores, señal 1490 y tipo de visita)', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({
    tipoVisita: 'RECABLEADO', metrosCable: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL', potencia1490Dbm: -23.19
  }));
});

await check('TECNICO puede registrar los datos de la instalación (serial, VLAN, posteadura, NAP, puerto y puertos disponibles)', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({
    instalacion: { serial: 'HWTC1A2B3C4D', vlan: '100', posteadura: ['DM SN N01B01', 'DM SN N01B02'], nap: 'M05F11', puerto: '3', puertosDisponibles: '6' },
    nap: 'M05F11 - Puerto 3',
  }));
});

await check('TECNICO puede registrar el color del conector de una visita de conector', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({ tipoVisita: 'CONECTOR_INTERNO', metrosCable: null, conectorExterno: '', conectorInterno: 'AZUL' }));
  await assertSucceeds(camposGerardo(asTecnico()).update({ tipoVisita: 'CONECTOR_EXTERNO', metrosCable: null, conectorExterno: 'VERDE', conectorInterno: '' }));
});

await check('TECNICO NO puede escribir el cobro ni la fecha de finalización', async () => {
  await assertFails(camposGerardo(asTecnico()).update({ cobroBs: '5.696' }));
  await assertFails(camposGerardo(asTecnico()).update({ finalizadoEn: 1 }));
});

await check('ADMIN y USUARIO pueden marcar la prioridad alta de una orden; el TECNICO no', async () => {
  await assertSucceeds(camposGerardo(asAdmin()).update({ prioridadAlta: true }));
  await assertSucceeds(camposGerardo(asUsuario()).update({ prioridadAlta: false }));
  await assertFails(camposGerardo(asTecnico()).update({ prioridadAlta: true }));
});

await check('TECNICO NO puede cambiar nombre/dirección del cliente', async () => {
  await assertFails(camposGerardo(asTecnico()).update({ nombre: 'OTRO' }));
  await assertFails(camposGerardo(asTecnico()).update({ direccion: 'OTRA' }));
});

await check('TECNICO NO puede borrar entradas del historial', async () => {
  await assertFails(camposGerardo(asTecnico()).update({ historialEdiciones: [{ detalle: 'inventada' }] }));
});

await check('TECNICO NO puede devolver una orden PRE-FINALIZADO a PENDIENTE', async () => {
  await assertFails(camposGerardo(asTecnico()).update({ estado: 'PENDIENTE' }));
});

await check('TECNICO NO puede reabrir una orden FINALIZADO', async () => {
  await assertFails(ticketPath(asTecnico(), 'gerardo-finalizado').update({ estado: 'PENDIENTE' }));
});

await check('TECNICO NO puede inventar un estado', async () => {
  await assertFails(ticketPath(asTecnico(), 'gerardo-finalizado').update({ estado: 'LO-QUE-SEA' }));
});

// --- Contadores del correlativo ---
const counterPath = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('counters').doc('A_O_2026');

await check('USUARIO puede avanzar un contador', async () => {
  await assertSucceeds(counterPath(asUsuario()).update({ ultimo: 6, actualizadoEn: 1 }));
});

await check('TECNICO NO puede tocar los contadores', async () => {
  await assertFails(counterPath(asTecnico()).update({ ultimo: 999999, actualizadoEn: 1 }));
});

await check('Nadie puede hacer retroceder un contador', async () => {
  await assertFails(counterPath(asAdmin()).update({ ultimo: 1, actualizadoEn: 1 }));
});

await testEnv.cleanup();

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
} else {
  console.log('\nTodas las pruebas de reglas pasaron.');
}
