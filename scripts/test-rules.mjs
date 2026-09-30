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

  await base.collection('technicians').doc('GERARDO-MOLERO').set({ name: 'GERARDO MOLERO', color: 'bg-fuchsia-500 text-white', activo: true });
  await base.collection('technicians').doc('REINEL-BRAVO').set({ name: 'REINEL BRAVO', color: 'bg-green-500 text-white', activo: true });

  await base.collection('config').doc('turnoInstalaciones').set({ orden: ['GERARDO MOLERO', 'REINEL BRAVO'], turnoActualIndex: 0 });
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

await testEnv.cleanup();

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
} else {
  console.log('\nTodas las pruebas de reglas pasaron.');
}
