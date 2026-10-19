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
  await base.collection('users').doc('almacen-uid').set({ role: 'ALMACEN', disabled: false });
  await base.collection('users').doc('cierra-uid').set({ role: 'USUARIO', disabled: false, puedeCerrar: true });
  await base.collection('users').doc('lfernandez-uid').set({ role: 'ADMIN', disabled: false, username: 'lfernandez' });
  await base.collection('telecomEnvios').doc('alerta-1').set({ ticketId: 'alerta-1', estado: 'SERIAL_NO_ENCONTRADO', codigo: 'IS10', serial: 'HWTC1A2B3C4D', intentos: 1 });
  await base.collection('telecomEnvios').doc('alerta-3').set({ ticketId: 'alerta-3', estado: 'EQUIPO_NO_ASIGNADO', codigo: 'IS13', serial: 'HWTC1A2B3C4D', intentos: 1 });
  await base.collection('telecomEnvios').doc('alerta-2').set({ ticketId: 'alerta-2', estado: 'ERROR', codigo: 'IS11', intentos: 4 });
  await base.collection('telecomEnvios').doc('enviado-1').set({ ticketId: 'enviado-1', estado: 'ENVIADO', codigo: 'IS12', intentos: 1 });
  await base.collection('users').doc('promotora-uid').set({ role: 'PROMOTORA', disabled: false, promotoraNombres: ['Sariana'], promotoraClaves: ['sariana'] });
  await base.collection('users').doc('promotora2-uid').set({ role: 'PROMOTORA', disabled: false, promotoraNombres: ['Alexis Añez', 'Alexis'], promotoraClaves: ['alexis anez', 'alexis'] });
  await base.collection('users').doc('promotora-sin-uid').set({ role: 'PROMOTORA', disabled: false, promotoraNombres: [], promotoraClaves: [] });
  await base.collection('users').doc('ventas-uid').set({ role: 'PROMOTORA', disabled: false, verTodasInstalaciones: true, promotoraNombres: [], promotoraClaves: [] });
  await base.collection('users').doc('promotora-off-uid').set({ role: 'PROMOTORA', disabled: true, promotoraNombres: ['Sariana'], promotoraClaves: ['sariana'] });
  await base.collection('tickets').doc('instalacion-1').set({ codigo: 'IO1', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', nombre: 'Cliente', cedula: '1', tecnico: '', promotora: 'Sariana', promotoraClave: 'sariana' });
  await base.collection('tickets').doc('instalacion-2').set({ codigo: 'IO2', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', nombre: 'Otro cliente', cedula: '2', tecnico: '', promotora: 'Alexis Añez', promotoraClave: 'alexis anez' });
  await base.collection('tickets').doc('instalacion-3').set({ codigo: 'IO3', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', nombre: 'Cliente del alias', cedula: '3', tecnico: '', promotora: 'Alexis', promotoraClave: 'alexis' });
  await base.collection('tickets').doc('averia-los').set({ codigo: 'AS7', tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'PENDIENTE', nombre: 'Cliente LOS', cedula: '7', tecnico: 'GERARDO MOLERO' });
  await base.collection('tickets').doc('averia-otra').set({ codigo: 'AS8', tipoTrabajo: 'AVERÍA', falla: 'Tensado de drop', estado: 'PENDIENTE', nombre: 'Cliente otra falla', cedula: '8', tecnico: 'GERARDO MOLERO' });
  await base.collection('tickets').doc('instalacion-4').set({ codigo: 'IO4', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', nombre: 'Orden vieja sin promotora', cedula: '4', tecnico: '' });
  await base.collection('tickets').doc('instalacion-5').set({ codigo: 'IO5', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', nombre: 'Otra promotora', cedula: '5', tecnico: '', promotora: 'Maria', promotoraClave: 'maria' });
  await base.collection('reports').doc('reporte-1').set({ total: 1, tipoReporte: 'CIERRE', createdAt: 1 });
  await base.collection('historialInstalaciones').doc('hist-1').set({ codigo: 'IO0', estado: 'FINALIZADO', archivadoEn: Date.now(), promotora: 'Sariana', promotoraClave: 'sariana' });
  await base.collection('historialInstalaciones').doc('hist-otra').set({ codigo: 'IO9', estado: 'FINALIZADO', archivadoEn: Date.now(), promotora: 'Maria', promotoraClave: 'maria' });

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

await check('TECNICO puede escribir su observación aparte de la de la oficina', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({ observacionTecnico: 'Drop partido, se requiere recablear' }));
});

await check('TECNICO puede consultar el cobro de un recableado, pero no responderlo', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({ consultaCobro: { metros: 250, pedidaEn: 1000, pedidaPor: 'GERARDO' } }));
  await assertFails(camposGerardo(asTecnico()).update({ respuestaCobro: { metros: 250, exonerado: true, monto: null, en: 2000 } }));
});

await check('ADMIN y USUARIO responden la consulta de cobro', async () => {
  const respuesta = { metros: 250, exonerado: false, valor: 5000, monto: '5.000', moneda: 'BS', por: 'LUIS', en: 2000 };
  await assertSucceeds(camposGerardo(asAdmin()).update({ respuestaCobro: respuesta }));
  await assertSucceeds(camposGerardo(asUsuario()).update({ respuestaCobro: { ...respuesta, valor: 6000, monto: '6.000' } }));
});

await check('TECNICO puede registrar un recableado (metros, conectores, señal 1490 y tipo de visita)', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({
    tipoVisita: 'RECABLEADO', metrosCable: 35, conectorExterno: 'VERDE', conectorInterno: 'AZUL', potencia1490Dbm: -23.19
  }));
});

await check('TECNICO puede registrar las cantidades de conectores de una visita de conector', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({
    tipoVisita: 'CONECTOR_INTERNO', conectorInterno: '', conectoresUsados: { verde: 2, azul: 1 }
  }));
});

await check('TECNICO NO puede escribir otros campos junto con las cantidades', async () => {
  await assertFails(camposGerardo(asTecnico()).update({ conectoresUsados: { verde: 1, azul: 0 }, tecnico: 'REINEL BRAVO' }));
});

await check('TECNICO puede registrar los datos de la instalación (serial, VLAN, posteadura, metraje, NAP, puerto y puertos disponibles)', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({
    instalacion: { serial: 'HWTC1A2B3C4D', vlan: '100', posteadura: ['DM SN N01B01', 'DM SN N01B02'], metraje: 120, nap: 'M05F11', puerto: '3', puertosDisponibles: '6' },
    nap: 'M05F11 - Puerto 3',
  }));
});

await check('TECNICO puede registrar el color del conector de una visita de conector', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({ tipoVisita: 'CONECTOR_INTERNO', metrosCable: null, conectorExterno: '', conectorInterno: 'AZUL' }));
  await assertSucceeds(camposGerardo(asTecnico()).update({ tipoVisita: 'CONECTOR_EXTERNO', metrosCable: null, conectorExterno: 'VERDE', conectorInterno: '' }));
});

await check('TECNICO puede registrar un cambio de equipo con el serial del equipo nuevo', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({ tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'HWTC1A2B3C4D' }));
  await assertSucceeds(camposGerardo(asTecnico()).update({ tipoVisita: 'DROP_ATENUADO', serialEquipo: '' }));
});

await check('TECNICO puede marcar "en camino", "llegué" y cancelarlo en su orden', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({ enCamino: { tecnico: 'GERARDO MOLERO', desde: 1 } }));
  await assertSucceeds(camposGerardo(asTecnico()).update({ enCamino: { tecnico: 'GERARDO MOLERO', desde: 1, llegoEn: 2 } }));
  await assertSucceeds(camposGerardo(asTecnico()).update({ enCamino: null }));
});

await check('TECNICO NO puede marcar "en camino" a nombre de otro técnico', async () => {
  await assertFails(camposGerardo(asTecnico()).update({ enCamino: { tecnico: 'REINEL', desde: 1 } }));
});

await check('TECNICO NO puede marcar "en camino" en la orden de otro técnico', async () => {
  await assertFails(ticketPath(asTecnico(), 'ticket-de-reinel').update({ enCamino: { tecnico: 'GERARDO MOLERO', desde: 1 } }));
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

// --- ALMACEN y PROMOTORA: solo leen, y solo lo que necesitan ---
const asAlmacen = () => testEnv.authenticatedContext('almacen-uid').firestore();
const asPromotora = () => testEnv.authenticatedContext('promotora-uid').firestore();
const asPromotoraOff = () => testEnv.authenticatedContext('promotora-off-uid').firestore();
const datos = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data');
const ticketsInst = (db) => datos(db).collection('tickets').where('tipoTrabajo', '==', 'INSTALACIÓN');

await check('ALMACEN lee todas las órdenes (para contar el material)', async () => {
  await assertSucceeds(datos(asAlmacen()).collection('tickets').get());
});
await check('ALMACEN lee los reportes de cierre y los técnicos', async () => {
  await assertSucceeds(datos(asAlmacen()).collection('reports').get());
  await assertSucceeds(datos(asAlmacen()).collection('technicians').get());
});
await check('ALMACEN NO puede escribir órdenes, reportes ni técnicos', async () => {
  await assertFails(ticketPath(asAlmacen(), 'instalacion-1').update({ observacion: 'x' }));
  await assertFails(datos(asAlmacen()).collection('tickets').doc('nueva').set({ codigo: 'X', tipoTrabajo: 'AVERÍA' }));
  await assertFails(datos(asAlmacen()).collection('reports').doc('reporte-1').update({ total: 9 }));
  await assertFails(datos(asAlmacen()).collection('technicians').doc('GERARDO-MOLERO').update({ activo: false }));
  await assertFails(ticketPath(asAlmacen(), 'instalacion-1').delete());
});
await check('ALMACEN NO lee usuarios ni el historial de instalaciones', async () => {
  await assertFails(datos(asAlmacen()).collection('users').get());
  await assertFails(datos(asAlmacen()).collection('historialInstalaciones').get());
});

const asPromotora2 = () => testEnv.authenticatedContext('promotora2-uid').firestore();
const asPromotoraSin = () => testEnv.authenticatedContext('promotora-sin-uid').firestore();
const susInstalaciones = (db, clave) => ticketsInst(db).where('promotoraClave', '==', clave);
const suHistorial = (db, clave) => datos(db).collection('historialInstalaciones').where('promotoraClave', '==', clave);

await check('PROMOTORA lee sus instalaciones (las de su promotora)', async () => {
  await assertSucceeds(susInstalaciones(asPromotora(), 'sariana').get());
  await assertSucceeds(ticketPath(asPromotora(), 'instalacion-1').get());
});
await check('PROMOTORA solo recibe las suyas en la consulta', async () => {
  const snap = await susInstalaciones(asPromotora(), 'sariana').get();
  if (snap.docs.map((d) => d.id).join() !== 'instalacion-1') throw new Error(`recibió ${snap.docs.map((d) => d.id)}`);
});
await check('PROMOTORA NO lee las instalaciones de otra promotora', async () => {
  await assertFails(ticketPath(asPromotora(), 'instalacion-2').get());
  await assertFails(ticketPath(asPromotora(), 'instalacion-5').get());
  await assertFails(susInstalaciones(asPromotora(), 'alexis anez').get());
  await assertFails(susInstalaciones(asPromotora(), 'maria').get());
});
await check('PROMOTORA NO lee las instalaciones sin promotora (órdenes viejas sin completar)', async () => {
  await assertFails(ticketPath(asPromotora(), 'instalacion-4').get());
  await assertFails(susInstalaciones(asPromotora(), '').get());
});
await check('PROMOTORA NO lee todas las instalaciones ni todas las órdenes', async () => {
  await assertFails(ticketsInst(asPromotora()).get());
  await assertFails(datos(asPromotora()).collection('tickets').get());
});
await check('PROMOTORA NO lee averías', async () => {
  await assertFails(ticketPath(asPromotora(), 'ticket-de-gerardo').get());
});
await check('PROMOTORA con varios nombres lee las de cada uno', async () => {
  await assertSucceeds(susInstalaciones(asPromotora2(), 'alexis anez').get());
  await assertSucceeds(susInstalaciones(asPromotora2(), 'alexis').get());
  await assertSucceeds(ticketPath(asPromotora2(), 'instalacion-3').get());
  await assertFails(susInstalaciones(asPromotora2(), 'sariana').get());
});
await check('PROMOTORA sin nombre asignado no lee nada', async () => {
  await assertFails(susInstalaciones(asPromotoraSin(), 'sariana').get());
  await assertFails(susInstalaciones(asPromotoraSin(), '').get());
  await assertFails(ticketPath(asPromotoraSin(), 'instalacion-1').get());
  await assertFails(suHistorial(asPromotoraSin(), 'sariana').get());
});
await check('PROMOTORA lee el historial de su promotora y no el de otra', async () => {
  await assertSucceeds(suHistorial(asPromotora(), 'sariana').get());
  await assertFails(suHistorial(asPromotora(), 'maria').get());
  await assertFails(datos(asPromotora()).collection('historialInstalaciones').get());
  await assertFails(datos(asPromotora()).collection('historialInstalaciones').doc('hist-otra').get());
});
const asVentas = () => testEnv.authenticatedContext('ventas-uid').firestore();
await check('PROMOTORA de ventas (ve todas) lee las instalaciones de todas las promotoras, sin nombre asignado', async () => {
  const snap = await ticketsInst(asVentas()).get();
  const ids = snap.docs.map((d) => d.id);
  for (const id of ['instalacion-1', 'instalacion-2', 'instalacion-3', 'instalacion-4']) if (!ids.includes(id)) throw new Error(`falta ${id}: recibió ${ids}`);
  await assertSucceeds(ticketPath(asVentas(), 'instalacion-2').get());
  await assertSucceeds(susInstalaciones(asVentas(), 'alexis anez').get());
});
const losDeVentas = (db) => datos(db).collection('tickets').where('tipoTrabajo', '==', 'AVERÍA').where('falla', '==', 'LOS');
await check('PROMOTORA de ventas lee también las averías LOS (y solo esas)', async () => {
  const snap = await losDeVentas(asVentas()).get();
  if (snap.docs.map((d) => d.id).join() !== 'averia-los') throw new Error(`recibió ${snap.docs.map((d) => d.id)}`);
  await assertSucceeds(ticketPath(asVentas(), 'averia-los').get());
  await assertFails(ticketPath(asVentas(), 'averia-otra').get());
  await assertFails(datos(asVentas()).collection('tickets').where('tipoTrabajo', '==', 'AVERÍA').get());
});
await check('Una PROMOTORA normal NO lee averías LOS', async () => {
  await assertFails(losDeVentas(asPromotora()).get());
  await assertFails(ticketPath(asPromotora(), 'averia-los').get());
});
await check('PROMOTORA de ventas lee todo el historial de instalaciones', async () => {
  await assertSucceeds(datos(asVentas()).collection('historialInstalaciones').get());
  await assertSucceeds(datos(asVentas()).collection('historialInstalaciones').doc('hist-otra').get());
});
await check('PROMOTORA de ventas SOLO ve instalaciones y LOS: ni otras averías ni todas las órdenes, reportes, técnicos ni usuarios', async () => {
  await assertFails(ticketPath(asVentas(), 'ticket-de-gerardo').get());
  await assertFails(datos(asVentas()).collection('tickets').get());
  await assertFails(datos(asVentas()).collection('reports').get());
  await assertFails(datos(asVentas()).collection('technicians').get());
  await assertFails(datos(asVentas()).collection('users').get());
});
await check('PROMOTORA de ventas NO puede escribir nada (solo lectura)', async () => {
  await assertFails(ticketPath(asVentas(), 'instalacion-1').update({ observacion: 'x' }));
  await assertFails(datos(asVentas()).collection('tickets').doc('nueva').set({ codigo: 'X', tipoTrabajo: 'INSTALACIÓN' }));
  await assertFails(datos(asVentas()).collection('historialInstalaciones').doc('hist-1').update({ estado: 'CANCELADO' }));
});
await check('El "ve todas" no se lo puede dar nadie a sí mismo ni cambiarse el rol', async () => {
  await assertFails(datos(asPromotora()).collection('users').doc('promotora-uid').update({ verTodasInstalaciones: true }));
  await assertFails(datos(asVentas()).collection('users').doc('ventas-uid').update({ role: 'ADMIN' }));
});
await check('PROMOTORA NO lee reportes, técnicos ni usuarios', async () => {
  await assertFails(datos(asPromotora()).collection('reports').get());
  await assertFails(datos(asPromotora()).collection('technicians').get());
  await assertFails(datos(asPromotora()).collection('users').get());
});
await check('PROMOTORA NO puede escribir nada', async () => {
  await assertFails(ticketPath(asPromotora(), 'instalacion-1').update({ observacion: 'x' }));
  await assertFails(datos(asPromotora()).collection('tickets').doc('nueva').set({ codigo: 'X', tipoTrabajo: 'INSTALACIÓN' }));
  await assertFails(datos(asPromotora()).collection('historialInstalaciones').doc('hist-1').update({ estado: 'CANCELADO' }));
  await assertFails(datos(asPromotora()).collection('historialInstalaciones').doc('nuevo').set({ codigo: 'X' }));
  await assertFails(datos(asPromotora()).collection('counters').doc('A_O_2026').update({ ultimo: 7, actualizadoEn: 1 }));
});
await check('Una PROMOTORA deshabilitada no lee nada', async () => {
  await assertFails(susInstalaciones(asPromotoraOff(), 'sariana').get());
  await assertFails(suHistorial(asPromotoraOff(), 'sariana').get());
});
await check('ADMIN y USUARIO con permiso de cierre escriben el historial; USUARIO sin permiso no', async () => {
  await assertSucceeds(datos(asAdmin()).collection('historialInstalaciones').doc('hist-2').set({ codigo: 'IO2', estado: 'CANCELADO', archivadoEn: Date.now() }));
  await assertFails(datos(asUsuario()).collection('historialInstalaciones').doc('hist-3').set({ codigo: 'IO3' }));
});
await check('Los roles de siempre siguen leyendo igual (TECNICO solo lo suyo)', async () => {
  await assertSucceeds(datos(asUsuario()).collection('tickets').get());
  await assertFails(datos(asTecnico()).collection('tickets').get());
  await assertFails(datos(asTecnico()).collection('reports').get());
});

// --- Envío al inventario del otro sistema: telecomEnvios (el módulo es solo de lfernandez) ---
const envios = (db) => datos(db).collection('telecomEnvios');
const asCierra = () => testEnv.authenticatedContext('cierra-uid').firestore();
const asLf = () => testEnv.authenticatedContext('lfernandez-uid').firestore();
const asAlmacenInv = () => testEnv.authenticatedContext('almacen-uid').firestore();
const marcaOk = (id) => ({ ticketId: id, estado: 'PENDIENTE', intentos: 0 });
await check('ADMIN y USUARIO pueden dejar la marca mínima "pendiente" al aprobar una orden', async () => {
  await assertSucceeds(envios(asAdmin()).doc('orden-a').set(marcaOk('orden-a')));
  await assertSucceeds(envios(asUsuario()).doc('orden-b').set(marcaOk('orden-b')));
  await assertSucceeds(envios(asLf()).doc('orden-k').set(marcaOk('orden-k')));
});
await check('La marca no puede llevar datos de la orden, otro estado, otro id ni intentos distintos de cero', async () => {
  await assertFails(envios(asAdmin()).doc('orden-c').set({ ...marcaOk('orden-c'), accion: 'instalacion_nueva', serial: 'HWTC1A2B3C4D', apc: 9 }));
  await assertFails(envios(asAdmin()).doc('orden-d').set({ ...marcaOk('orden-d'), estado: 'ENVIADO' }));
  await assertFails(envios(asAdmin()).doc('orden-e').set({ ...marcaOk('orden-e'), intentos: 3 }));
  await assertFails(envios(asAdmin()).doc('orden-f').set(marcaOk('otra-orden')));
  await assertFails(envios(asAdmin()).doc('orden-g').set({ ticketId: 'orden-g', estado: 'PENDIENTE' }));
});
await check('Una marca ya creada no se puede reescribir para marcarla como enviada', async () => {
  await assertFails(envios(asAdmin()).doc('orden-a').update({ estado: 'ENVIADO' }));
  await assertFails(envios(asLf()).doc('alerta-1').update({ estado: 'ENVIADO' }));
  await assertFails(envios(asUsuario()).doc('orden-b').set(marcaOk('orden-b')));
});
await check('TECNICO, ALMACEN y PROMOTORA no crean marcas', async () => {
  await assertFails(envios(asTecnico()).doc('orden-h').set(marcaOk('orden-h')));
  await assertFails(envios(asAlmacenInv()).doc('orden-i').set(marcaOk('orden-i')));
  await assertFails(envios(asPromotora()).doc('orden-j').set(marcaOk('orden-j')));
});
await check('Solo lfernandez ve el módulo: ni otro ADMIN, ni quien cierra, ni nadie más', async () => {
  await assertSucceeds(envios(asLf()).where('estado', 'in', ['SERIAL_NO_ENCONTRADO', 'SERIAL_YA_INSTALADO', 'SIN_SERIAL', 'ERROR']).get());
  await assertSucceeds(envios(asLf()).orderBy('actualizadoEn', 'desc').limit(30).get());
  await assertSucceeds(envios(asLf()).doc('alerta-1').get());
  await assertFails(envios(asAdmin()).doc('alerta-1').get());
  await assertFails(envios(asAdmin()).where('estado', 'in', ['ERROR']).get());
  await assertFails(envios(asAdmin()).orderBy('actualizadoEn', 'desc').limit(30).get());
  await assertFails(envios(asCierra()).doc('alerta-1').get());
  await assertFails(envios(asUsuario()).doc('alerta-1').get());
  await assertFails(envios(asUsuario()).get());
  await assertFails(envios(asTecnico()).doc('alerta-1').get());
  await assertFails(envios(asAlmacenInv()).doc('alerta-1').get());
  await assertFails(envios(asPromotora()).doc('alerta-1').get());
});
await check('lfernandez descarta una alerta (queda como DESCARTADO, con quién y cuándo); nadie más puede', async () => {
  const descartar = { estado: 'DESCARTADO', actualizadoEn: 1700000000000, descartadoPor: 'lfernandez' };
  await assertFails(envios(asAdmin()).doc('alerta-2').update(descartar));
  await assertFails(envios(asCierra()).doc('alerta-2').update(descartar));
  await assertFails(envios(asTecnico()).doc('alerta-2').update(descartar));
  await assertSucceeds(envios(asLf()).doc('alerta-2').update(descartar));
  await assertSucceeds(envios(asLf()).doc('alerta-3').update(descartar));
});
await check('Descartar solo cambia el estado: no se puede tocar otro dato, poner otro estado ni descartar lo enviado', async () => {
  await assertFails(envios(asLf()).doc('alerta-1').update({ estado: 'DESCARTADO', serial: 'OTRO' }));
  await assertFails(envios(asLf()).doc('alerta-1').update({ estado: 'ENVIADO' }));
  await assertFails(envios(asLf()).doc('alerta-1').update({ estado: 'PENDIENTE' }));
  await assertFails(envios(asLf()).doc('enviado-1').update({ estado: 'DESCARTADO', actualizadoEn: 1 }));
});
await check('Nadie borra un registro de envío (tampoco lfernandez): queda el historial', async () => {
  await assertFails(envios(asLf()).doc('alerta-1').delete());
  await assertFails(envios(asAdmin()).doc('alerta-1').delete());
});

await check('El nombre del técnico en el inventario solo lo elige lfernandez: ningún otro ADMIN, USUARIO ni técnico lo pone o lo cambia', async () => {
  await assertSucceeds(techPathGerardo(asLf()).update({ tecnicoInventario: 'GERARDO MOLERO' }));
  await assertSucceeds(techPathGerardo(asLf()).update({ tecnicoInventario: 'OTRO NOMBRE' }));
  await assertFails(techPathGerardo(asAdmin()).update({ tecnicoInventario: 'GERARDO' }));
  await assertFails(techPathGerardo(asAdmin()).update({ color: 'bg-red-500 text-white', tecnicoInventario: 'GERARDO' }));
  await assertFails(techPathGerardo(asUsuario()).update({ tecnicoInventario: 'OTRO' }));
  await assertFails(techPathGerardo(asCierra()).update({ tecnicoInventario: 'OTRO' }));
  await assertFails(techPathGerardo(asTecnico()).update({ tecnicoInventario: 'OTRO' }));
  await assertFails(techsCol(asAdmin()).doc('NUEVO-1').set({ name: 'NUEVO 1', color: 'bg-red-500 text-white', activo: true, tecnicoInventario: 'X' }));
  await assertSucceeds(techsCol(asLf()).doc('NUEVO-2').set({ name: 'NUEVO 2', color: 'bg-red-500 text-white', activo: true, tecnicoInventario: 'X' }));
  // Lo demás del técnico sigue siendo de cualquier ADMIN, con o sin el campo elegido.
  await assertSucceeds(techPathGerardo(asAdmin()).update({ color: 'bg-red-500 text-white' }));
  await assertSucceeds(techsCol(asAdmin()).doc('NUEVO-3').set({ name: 'NUEVO 3', color: 'bg-red-500 text-white', activo: true }));
});

// --- El cierre manual marca el día en config/cierreAutomatico (cierreManualFecha) para que el automático de ese día no corra ---
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await ctx.firestore().collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('config').doc('cierreAutomatico').set({ activo: true, hora: '22:00', dias: [1, 2] });
});
const cierreCfg = (db) => datos(db).collection('config').doc('cierreAutomatico');
await check('Quien cierra marca el cierre manual del día (solo ese campo); la configuración sigue siendo de ADMIN', async () => {
  await assertSucceeds(cierreCfg(asCierra()).set({ cierreManualFecha: '2026-10-19' }, { merge: true }));
  await assertSucceeds(cierreCfg(asAdmin()).set({ cierreManualFecha: '2026-10-19' }, { merge: true }));
  await assertFails(cierreCfg(asCierra()).set({ activo: false }, { merge: true }));
  await assertFails(cierreCfg(asCierra()).set({ cierreManualFecha: '2026-10-19', hora: '01:00' }, { merge: true }));
  await assertFails(cierreCfg(asUsuario()).set({ cierreManualFecha: '2026-10-19' }, { merge: true }));
  await assertFails(cierreCfg(asTecnico()).set({ cierreManualFecha: '2026-10-19' }, { merge: true }));
  await assertSucceeds(cierreCfg(asAdmin()).set({ hora: '21:00' }, { merge: true }));
});

// --- Totales del mes (estadisticasMensuales): los ve ventas y quien cierra; solo quien cierra suma, y nunca resta ---
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  await ctx.firestore().collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('estadisticasMensuales').doc('2026-10').set({ instalacionesFinalizadas: 5, losResueltas: 2 });
});
const mensual = (db, mes = '2026-10') => datos(db).collection('estadisticasMensuales').doc(mes);
await check('Totales del mes: los leen ventas, quien cierra y el admin; no los leen otras promotoras, técnicos ni almacén', async () => {
  await assertSucceeds(mensual(asVentas()).get());
  await assertSucceeds(mensual(asCierra()).get());
  await assertSucceeds(mensual(asAdmin()).get());
  await assertFails(mensual(asPromotora()).get());
  await assertFails(mensual(asTecnico()).get());
  await assertFails(mensual(asAlmacen()).get());
});
await check('Totales del mes: quien cierra puede sumar (crear el mes o subir los contadores)', async () => {
  await assertSucceeds(mensual(asCierra(), '2026-11').set({ instalacionesFinalizadas: 1 }, { merge: true }));
  await assertSucceeds(mensual(asCierra()).set({ instalacionesFinalizadas: 6, instalacionesCanceladas: 1 }, { merge: true }));
  await assertSucceeds(mensual(asAdmin()).set({ losResueltas: 3 }, { merge: true }));
});
await check('Totales del mes: no se puede restar, ni poner un valor que no sea entero, ni un campo ajeno, ni un mes mal escrito', async () => {
  await assertFails(mensual(asCierra()).set({ instalacionesFinalizadas: 2 }, { merge: true }));
  await assertFails(mensual(asCierra()).set({ instalacionesFinalizadas: '9' }, { merge: true }));
  await assertFails(mensual(asCierra()).set({ otraCosa: 1 }, { merge: true }));
  await assertFails(mensual(asCierra(), 'octubre').set({ instalacionesFinalizadas: 1 }));
  await assertFails(mensual(asCierra(), '2026-13').set({ instalacionesFinalizadas: 1 }));
});
await check('Totales del mes: ventas, las promotoras y los técnicos no escriben, y nadie borra', async () => {
  await assertFails(mensual(asVentas()).set({ instalacionesFinalizadas: 99 }, { merge: true }));
  await assertFails(mensual(asPromotora()).set({ instalacionesFinalizadas: 99 }, { merge: true }));
  await assertFails(mensual(asTecnico()).set({ instalacionesFinalizadas: 99 }, { merge: true }));
  await assertFails(mensual(asCierra()).delete());
  await assertFails(mensual(asAdmin()).delete());
});

await testEnv.cleanup();

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
} else {
  console.log('\nTodas las pruebas de reglas pasaron.');
}
