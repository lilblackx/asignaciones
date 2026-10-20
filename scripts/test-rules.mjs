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
// Empieza de cero: lo que dejó una corrida anterior (órdenes creadas por las pruebas) haría fallar las que crean documentos.
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const base = db.collection('artifacts').doc(APP_ID).collection('public').doc('data');

  await base.collection('users').doc('admin-uid').set({ role: 'ADMIN', disabled: false, username: 'admin' });
  await base.collection('users').doc('usuario-uid').set({ role: 'USUARIO', disabled: false, username: 'usuario' });
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
  await base.collection('users').doc('creadora-uid').set({ role: 'PROMOTORA', disabled: false, username: 'sariana', puedeCrearVentas: true, promotoraNombres: ['Sariana'], promotoraClaves: ['sariana'] });
  await base.collection('users').doc('ventas-crea-uid').set({ role: 'PROMOTORA', disabled: false, username: 'ventas', puedeCrearVentas: true, verTodasInstalaciones: true, promotoraNombres: [], promotoraClaves: [] });
  await base.collection('users').doc('finanzas-uid').set({ role: 'FINANZAS', disabled: false, username: 'fina' });
  await base.collection('users').doc('finanzas-off-uid').set({ role: 'FINANZAS', disabled: true, username: 'fina-off' });
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
    tecnico: 'GERARDO MOLERO', codigo: 'AS4', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'FINALIZADO',
    finalizadoEn: 1000, cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', observacion: ''
  });
  // Avisos de "alguien está revisando": uno vigente de otra persona y uno ya vencido.
  await base.collection('bloqueosOrden').doc('ticket-de-reinel__usuario').set({ ticketId: 'ticket-de-reinel', por: 'usuario', nombre: 'Usuario Demo', desde: Date.now(), venceEn: Date.now() + 5 * 60000 });
  await base.collection('bloqueosOrden').doc('ticket-de-gerardo__usuario').set({ ticketId: 'ticket-de-gerardo', por: 'usuario', nombre: 'Usuario Demo', desde: 1, venceEn: 2 });
  // Escalar a infraestructura: una orden pendiente sin escalar y otra que ya espera a infraestructura.
  await base.collection('tickets').doc('gerardo-infra').set({ tecnico: 'GERARDO MOLERO', codigo: 'AS5', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'PENDIENTE', historialEdiciones: [{ detalle: 'creada' }] });
  await base.collection('tickets').doc('gerardo-infra-activa').set({
    tecnico: 'GERARDO MOLERO', codigo: 'AS6', tipoTrabajo: 'AVERÍA', creado: 'usuario', estado: 'PENDIENTE', historialEdiciones: [{ detalle: 'creada' }],
    infraestructura: { activa: true, motivo: 'Falta un poste', por: 'gerardo', origen: 'TECNICO', en: 1000, tecnico: 'GERARDO MOLERO' }
  });
  await base.collection('counters').doc('A_O_2026').set({ ultimo: 5, actualizadoEn: 0 });

  await base.collection('technicians').doc('GERARDO-MOLERO').set({ name: 'GERARDO MOLERO', color: 'bg-fuchsia-500 text-white', activo: true });
  await base.collection('technicians').doc('REINEL-BRAVO').set({ name: 'REINEL BRAVO', color: 'bg-green-500 text-white', activo: true });
  // Como los crea la app: el id es el nombre en mayúsculas (la regla de las ventas de la promotora lo usa para comprobar que el técnico existe).
  await base.collection('technicians').doc('EDGAR MONTERO').set({ name: 'EDGAR MONTERO', color: 'bg-green-500 text-white', activo: true });

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

await check('TECNICO puede guardar las horas del ciclo (salida, llegada, pre-finalización) como números o null', async () => {
  await assertSucceeds(camposGerardo(asTecnico()).update({ salioEn: 1000, llegoEn: 2000 }));
  await assertSucceeds(camposGerardo(asTecnico()).update({ llegoEn: null }));
  await assertSucceeds(camposGerardo(asTecnico()).update({ salioEn: null, prefinalizadoEn: 3000 }));
});

await check('TECNICO NO puede guardar las horas como texto ni escribir las de asignación', async () => {
  await assertFails(camposGerardo(asTecnico()).update({ salioEn: '1000' }));
  await assertFails(camposGerardo(asTecnico()).update({ asignadoEn: 1000 }));
  await assertFails(camposGerardo(asTecnico()).update({ primerAsignadoEn: 1000 }));
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

// Escalar a infraestructura: el técnico deja su orden esperando (a su nombre y con motivo); resolverla es de la oficina.
const escalada = (extra = {}) => ({ activa: true, motivo: 'Falta un poste frente a la casa', por: 'gerardo', origen: 'TECNICO', en: 5000, tecnico: 'GERARDO MOLERO', ...extra });
const ordenInfra = (db) => ticketPath(db, 'gerardo-infra');

await check('TECNICO NO puede escribir infraestructura a nombre de otro técnico, como oficina, sin motivo o con campos de más', async () => {
  await assertFails(ordenInfra(asTecnico()).update({ infraestructura: escalada({ tecnico: 'REINEL BRAVO' }) }));
  await assertFails(ordenInfra(asTecnico()).update({ infraestructura: escalada({ origen: 'OFICINA' }) }));
  await assertFails(ordenInfra(asTecnico()).update({ infraestructura: escalada({ motivo: '' }) }));
  await assertFails(ordenInfra(asTecnico()).update({ infraestructura: escalada({ motivo: 'x'.repeat(301) }) }));
  await assertFails(ordenInfra(asTecnico()).update({ infraestructura: escalada({ resultado: 'CERRADA' }) }));
  await assertFails(ordenInfra(asTecnico()).update({ infraestructura: escalada({ activa: false }) }));
  await assertFails(ordenInfra(asTecnico()).update({ infraestructura: escalada({ en: '5000' }) }));
});

await check('TECNICO NO puede escalar una orden ya finalizada ni la de otro técnico', async () => {
  await assertFails(ticketPath(asTecnico(), 'gerardo-finalizado').update({ infraestructura: escalada() }));
  await assertFails(ticketPath(asTecnico(), 'ticket-de-reinel').update({ infraestructura: escalada({ tecnico: 'REINEL BRAVO' }) }));
});

// Por ahora solo la oficina escala: el técnico no puede, ni siquiera con un pedido bien armado. (Para reactivarlo, ver firestore.rules.)
await check('TECNICO NO puede escalar su orden a infraestructura (por ahora solo la oficina)', async () => {
  await assertFails(ordenInfra(asTecnico()).update({
    infraestructura: escalada(), enCamino: null, salioEn: null, llegoEn: null,
    historialEdiciones: [{ detalle: 'creada' }, { tipo: 'infraestructura', detalle: 'Escalada a infraestructura | Motivo: Falta un poste frente a la casa' }]
  }));
});

await check('TECNICO NO puede resolver ni volver a escalar una orden que ya espera a infraestructura', async () => {
  const activa = ticketPath(asTecnico(), 'gerardo-infra-activa');
  await assertFails(activa.update({ infraestructura: { ...escalada(), activa: false, resultado: 'DEVUELTA', resueltaPor: 'gerardo', resueltaEn: 6000 } }));
  await assertFails(activa.update({ infraestructura: escalada({ en: 7000 }) }));
});

await check('ADMIN y USUARIO escalan una orden a infraestructura', async () => {
  const delaOficina = escalada({ origen: 'OFICINA', por: 'ana', tecnico: 'GERARDO MOLERO' });
  await assertSucceeds(ordenInfra(asAdmin()).update({ infraestructura: delaOficina }));
  await assertSucceeds(ticketPath(asUsuario(), 'gerardo-campos').update({ infraestructura: delaOficina }));
});

await check('ADMIN y USUARIO resuelven la escalada: la devuelven al técnico o la cierran como TA', async () => {
  const resuelta = { ...escalada({ tecnico: 'GERARDO MOLERO' }), activa: false, resultado: 'DEVUELTA', resueltaPor: 'ana', resueltaEn: 6000, nota: 'Poste puesto' };
  await assertSucceeds(ticketPath(asAdmin(), 'gerardo-infra-activa').update({ infraestructura: resuelta }));
  await assertSucceeds(ticketPath(asUsuario(), 'gerardo-infra-activa').update({ infraestructura: { ...resuelta, resultado: 'CERRADA' }, estado: 'FINALIZADO', finalizadoEn: 7000 }));
});

// Dos personas finalizando la misma orden: una orden ya FINALIZADA no cambia su cierre (hora de finalización ni cobro).
const cerrada = (db) => ticketPath(db, 'gerardo-finalizado');
await check('una orden ya finalizada NO deja cambiar su hora de finalización ni su cobro (ADMIN ni USUARIO)', async () => {
  for (const db of [asAdmin(), asUsuario()]) {
    await assertFails(cerrada(db).update({ finalizadoEn: 2000 }));
    await assertFails(cerrada(db).update({ cobroBs: '9.999' }));
    await assertFails(cerrada(db).update({ cobroTipo: 'EXONERADO', cobroBs: null }));
    await assertFails(cerrada(db).update({ estado: 'FINALIZADO', finalizadoEn: 3000, cobroBs: '1' }));
  }
});

await check('una orden ya finalizada sí deja corregir lo demás (observación, datos del técnico)', async () => {
  await assertSucceeds(cerrada(asAdmin()).update({ observacion: 'corregida' }));
  await assertSucceeds(cerrada(asUsuario()).update({ finalizadoEn: 1000, cobroBs: '5.696', observacion: 'otra vez' }));
});

await check('finalizar una orden pendiente sigue funcionando (pasa a FINALIZADO con su hora y su cobro)', async () => {
  await assertSucceeds(ticketPath(asAdmin(), 'gerardo-infra').update({ estado: 'FINALIZADO', finalizadoEn: 5000, cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' }));
});

await check('...y la segunda persona que intenta finalizarla ya no puede cambiar el cierre', async () => {
  await assertFails(ticketPath(asUsuario(), 'gerardo-infra').update({ estado: 'FINALIZADO', finalizadoEn: 5001, cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' }));
});

// Avisos de "alguien está revisando esta orden"
const aviso = (db, id) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('bloqueosOrden').doc(id);
const avisoDe = (por, extra = {}) => ({ ticketId: 'gerardo-campos', por, nombre: 'Demo', desde: Date.now(), venceEn: Date.now() + 3 * 60000, ...extra });
await check('la oficina crea y renueva su aviso, a su nombre', async () => {
  await assertSucceeds(aviso(asAdmin(), 'gerardo-campos__admin').set(avisoDe('admin')));
  await assertSucceeds(aviso(asAdmin(), 'gerardo-campos__admin').set(avisoDe('admin', { venceEn: Date.now() + 4 * 60000 })));
  await assertSucceeds(aviso(asUsuario(), 'gerardo-campos__usuario').set(avisoDe('usuario')));
});
await check('no se puede avisar a nombre de otro, con otro id, con campos de más ni con un vencimiento de más de 10 minutos', async () => {
  await assertFails(aviso(asAdmin(), 'gerardo-campos__usuario').set(avisoDe('usuario')));
  await assertFails(aviso(asAdmin(), 'gerardo-campos__otro').set(avisoDe('admin')));
  await assertFails(aviso(asAdmin(), 'gerardo-campos__admin').set(avisoDe('admin', { extra: 1 })));
  await assertFails(aviso(asAdmin(), 'gerardo-campos__admin').set(avisoDe('admin', { venceEn: Date.now() + 11 * 60000 })));
  await assertFails(aviso(asAdmin(), 'gerardo-campos__admin').set(avisoDe('admin', { venceEn: 'mañana' })));
});
await check('el TECNICO no lee ni escribe avisos de revisión', async () => {
  await assertFails(aviso(asTecnico(), 'ticket-de-reinel__usuario').get());
  await assertFails(aviso(asTecnico(), 'gerardo-campos__tecnico').set(avisoDe('tecnico')));
});
await check('la oficina lee los avisos de las demás', async () => {
  await assertSucceeds(aviso(asAdmin(), 'ticket-de-reinel__usuario').get());
  await assertSucceeds(aviso(asUsuario(), 'ticket-de-reinel__usuario').get());
});
await check('cada quien borra el suyo; el vigente de otro no se borra, el vencido sí', async () => {
  await assertSucceeds(aviso(asAdmin(), 'gerardo-campos__admin').delete());
  await assertFails(aviso(asAdmin(), 'ticket-de-reinel__usuario').delete());
  await assertSucceeds(aviso(asAdmin(), 'ticket-de-gerardo__usuario').delete());
  await assertSucceeds(aviso(asUsuario(), 'gerardo-campos__usuario').delete());
});

// Registro de VN y TA (se llena a mano)
const filaVnTa = (db, id) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('registroVnTa').doc(id);
const filaDe = (por, extra = {}) => ({ codigo: 'VAN01', trabajo: 'VN', tecnico: '', fecha: '2026-10-11', observacion: 'Puertos liberados', operador: 'Renny Cova', creadoPor: por, creadoEn: 1000, actualizadoEn: 1000, ...extra });
await check('la oficina crea filas del registro de VN y TA a su nombre', async () => {
  await assertSucceeds(filaVnTa(asAdmin(), 'VAN01-a').set(filaDe('admin')));
  await assertSucceeds(filaVnTa(asUsuario(), 'TA01-a').set(filaDe('usuario', { codigo: 'TA01', trabajo: 'TA', tecnico: 'Edgar', observacion: 'Apoyo en reparar NAP' })));
});
await check('no se puede registrar a nombre de otro, con un código que no corresponde, con campos de más ni con datos mal formados', async () => {
  await assertFails(filaVnTa(asAdmin(), 'x1').set(filaDe('usuario')));
  await assertFails(filaVnTa(asAdmin(), 'x2').set(filaDe('admin', { codigo: 'TA01' })));
  await assertFails(filaVnTa(asAdmin(), 'x3').set(filaDe('admin', { trabajo: 'TA' })));
  await assertFails(filaVnTa(asAdmin(), 'x4').set(filaDe('admin', { extra: 1 })));
  await assertFails(filaVnTa(asAdmin(), 'x5').set(filaDe('admin', { fecha: '11/10/2026' })));
  await assertFails(filaVnTa(asAdmin(), 'x6').set(filaDe('admin', { trabajo: 'OTRO' })));
  await assertFails(filaVnTa(asAdmin(), 'x7').set(filaDe('admin', { observacion: 'x'.repeat(501) })));
  await assertFails(filaVnTa(asAdmin(), 'x8').set(filaDe('admin', { operador: '' })));
});
await check('el TECNICO y las demás cuentas no leen ni escriben el registro de VN y TA', async () => {
  await assertFails(filaVnTa(asTecnico(), 'VAN01-a').get());
  await assertFails(filaVnTa(asTecnico(), 'x9').set(filaDe('tecnico')));
  await assertFails(filaVnTa(testEnv.authenticatedContext('almacen-uid').firestore(), 'VAN01-a').get());
});
await check('la oficina lee las filas y corrige técnico, fecha y observación, pero no el código, el tipo ni quién lo creó', async () => {
  await assertSucceeds(filaVnTa(asUsuario(), 'VAN01-a').get());
  await assertSucceeds(filaVnTa(asUsuario(), 'VAN01-a').set(filaDe('admin', { tecnico: 'Jose', observacion: 'corregida', actualizadoEn: 2000 })));
  await assertFails(filaVnTa(asUsuario(), 'VAN01-a').set(filaDe('admin', { codigo: 'VAN09' })));
  await assertFails(filaVnTa(asUsuario(), 'VAN01-a').set(filaDe('usuario')));
  await assertFails(filaVnTa(asUsuario(), 'VAN01-a').set(filaDe('admin', { creadoEn: 5 })));
});
await check('borrar una fila: el ADMIN siempre; el USUARIO solo la que él registró', async () => {
  await assertFails(filaVnTa(asUsuario(), 'VAN01-a').delete());
  await assertSucceeds(filaVnTa(asUsuario(), 'TA01-a').delete());
  await assertSucceeds(filaVnTa(asAdmin(), 'VAN01-a').delete());
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
// --- PROMOTORA con permiso de crear ventas: solo instalaciones pendientes, sin técnico y a nombre de su promotor ---
const asCreadora = () => testEnv.authenticatedContext('creadora-uid').firestore();
const asVentasCrea = () => testEnv.authenticatedContext('ventas-crea-uid').firestore();
const ventaValida = (extra = {}) => ({
  fecha: '19/10/2026', fechaProgramada: '', codigo: 'IO', nombre: 'Ana Pérez', cedula: '12.345.678', tipoDocumento: 'V', direccion: 'Av. 5',
  telefono: '0414-1234567', nap: '', napCoordenadas: '', ubicacion: '', tipoTrabajo: 'INSTALACIÓN', falla: 'MRTV', tecnico: '', observacion: '',
  observacionInterna: false, estado: 'PENDIENTE', plantillaOriginal: 'texto', promotora: 'Sariana', promotoraClave: 'sariana', creado: 'sariana',
  creadoNombre: 'Sariana', createdAt: 1, historialEdiciones: [], isAsignado: false, ventaPromotora: true, ...extra,
});
const nuevaVenta = (db, id = 'venta-nueva') => datos(db).collection('tickets').doc(id);

await check('PROMOTORA con permiso crea una venta a nombre de su promotor y la puede leer', async () => {
  await assertSucceeds(nuevaVenta(asCreadora()).set(ventaValida()));
  await assertSucceeds(susInstalaciones(asCreadora(), 'sariana').get());
});
await check('PROMOTORA con permiso NO crea ventas de otro promotor, ni a nombre de otro usuario', async () => {
  await assertFails(nuevaVenta(asCreadora(), 'v2').set(ventaValida({ promotora: 'Maria', promotoraClave: 'maria' })));
  await assertFails(nuevaVenta(asCreadora(), 'v3').set(ventaValida({ creado: 'otra' })));
  await assertFails(nuevaVenta(asCreadora(), 'v4').set(ventaValida({ promotoraClave: '' })));
});
await check('PROMOTORA con permiso solo crea instalaciones pendientes, sin técnico y sin campos de más', async () => {
  await assertFails(nuevaVenta(asCreadora(), 'v5').set(ventaValida({ tipoTrabajo: 'AVERÍA', falla: 'LOS' })));
  await assertFails(nuevaVenta(asCreadora(), 'v6').set(ventaValida({ estado: 'FINALIZADO' })));
  await assertFails(nuevaVenta(asCreadora(), 'v7').set(ventaValida({ tecnico: 'GERARDO MOLERO', ventaTecnico: 'GERARDO MOLERO', ventaTecnicoId: 'NO-EXISTE' })));
  await assertFails(nuevaVenta(asCreadora(), 'v8').set(ventaValida({ cobroBs: 100 })));
  await assertFails(nuevaVenta(asCreadora(), 'v9').set(ventaValida({ instalacion: { serial: 'X' } })));
  await assertFails(nuevaVenta(asCreadora(), 'v10').set(ventaValida({ codigo: 'IO15' })));
  await assertFails(nuevaVenta(asCreadora(), 'v11').set(ventaValida({ isAsignado: true })));
  // Toda venta de una promotora lleva su marca (con ella la oficina recibe el aviso de nueva venta).
  await assertFails(nuevaVenta(asCreadora(), 'v12').set(ventaValida({ ventaPromotora: false })));
});
await check('PROMOTORA con permiso crea la venta con el técnico de la plantilla, marcada como venta suya', async () => {
  await assertSucceeds(nuevaVenta(asCreadora(), 'venta-con-tecnico').set(ventaValida({ tecnico: 'EDGAR MONTERO', ventaTecnico: 'EDGAR MONTERO', ventaTecnicoId: 'EDGAR MONTERO' })));
  // No depende de cómo se llame el documento del técnico (ids con guion de datos viejos o de pruebas).
  await assertSucceeds(nuevaVenta(asCreadora(), 'venta-con-tecnico-2').set(ventaValida({ tecnico: 'GERARDO MOLERO', ventaTecnico: 'GERARDO MOLERO', ventaTecnicoId: 'GERARDO-MOLERO' })));
});
await check('PROMOTORA con permiso NO asigna un técnico que no es el de la plantilla (inexistente, sin marca de venta o marca distinta)', async () => {
  await assertFails(nuevaVenta(asCreadora(), 'vt1').set(ventaValida({ tecnico: 'NADIE', ventaTecnico: 'NADIE', ventaTecnicoId: 'NADIE' })));
  await assertFails(nuevaVenta(asCreadora(), 'vt2').set(ventaValida({ tecnico: 'EDGAR MONTERO' })));
  await assertFails(nuevaVenta(asCreadora(), 'vt3').set(ventaValida({ tecnico: 'EDGAR MONTERO', ventaTecnico: 'REINEL BRAVO', ventaTecnicoId: 'EDGAR MONTERO' })));
  await assertFails(nuevaVenta(asCreadora(), 'vt4').set(ventaValida({ ventaTecnico: 'EDGAR MONTERO', ventaTecnicoId: 'EDGAR MONTERO' })));
  // El documento tiene que ser el de ese técnico: el id de otro con el nombre de este no vale.
  await assertFails(nuevaVenta(asCreadora(), 'vt5').set(ventaValida({ tecnico: 'EDGAR MONTERO', ventaTecnico: 'EDGAR MONTERO', ventaTecnicoId: 'REINEL-BRAVO' })));
});
await check('PROMOTORA con permiso lee los técnicos (para emparejar la plantilla); sin permiso no', async () => {
  await assertSucceeds(datos(asCreadora()).collection('technicians').get());
  await assertFails(datos(asPromotora()).collection('technicians').get());
  await assertFails(datos(asVentas()).collection('technicians').get());
});
await check('PROMOTORA con permiso NO edita ni borra órdenes, ni toca los contadores', async () => {
  await assertFails(ticketPath(asCreadora(), 'venta-nueva').update({ observacion: 'x' }));
  await assertFails(ticketPath(asCreadora(), 'venta-nueva').delete());
  await assertFails(datos(asCreadora()).collection('counters').doc('I_O_2026').set({ ultimo: 1, actualizadoEn: 1 }));
});
await check('PROMOTORA de ventas con permiso crea ventas de cualquier promotor', async () => {
  await assertSucceeds(nuevaVenta(asVentasCrea(), 'venta-de-maria').set(ventaValida({ promotora: 'Maria', promotoraClave: 'maria', creado: 'ventas' })));
  await assertFails(nuevaVenta(asVentasCrea(), 'venta-ajena').set(ventaValida({ promotora: 'Maria', promotoraClave: 'maria', creado: 'otra' })));
});
await check('PROMOTORA sin el permiso (aunque vea todas) NO crea ventas', async () => {
  await assertFails(nuevaVenta(asPromotora(), 'sin-permiso').set(ventaValida()));
  await assertFails(nuevaVenta(asVentas(), 'sin-permiso-2').set(ventaValida({ creado: '' })));
});
await check('El permiso de crear ventas no se lo puede dar nadie a sí mismo', async () => {
  await assertFails(datos(asPromotora()).collection('users').doc('promotora-uid').update({ puedeCrearVentas: true }));
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

// --- Registro de activación de técnicos: la oficina y cada técnico (el suyo) agregan; nadie edita ni borra ---
const logCol = (db) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('technicianLog');
const evento = (tecnico, rol, extra = {}) => ({ tecnicoId: tecnico, tecnico, activo: true, en: Date.now(), dia: '2026-10-19', por: 'x', rol, ...extra });
await check('Registro de técnicos: ADMIN y USUARIO agregan y leen', async () => {
  await assertSucceeds(logCol(asAdmin()).doc('l-admin').set(evento('GERARDO MOLERO', 'ADMIN')));
  await assertSucceeds(logCol(asUsuario()).doc('l-usuario').set(evento('REINEL BRAVO', 'USUARIO', { activo: false })));
  await assertSucceeds(logCol(asUsuario()).get());
  await assertSucceeds(logCol(asAdmin()).get());
});
await check('Registro de técnicos: el TECNICO agrega solo el suyo, y no lee', async () => {
  await assertSucceeds(logCol(asTecnico()).doc('l-tecnico').set(evento('GERARDO MOLERO', 'TECNICO')));
  await assertFails(logCol(asTecnico()).doc('l-ajeno').set(evento('REINEL BRAVO', 'TECNICO')));
  await assertFails(logCol(asTecnico()).get());
});
await check('Registro de técnicos: no se puede mentir en el rol, ni agregar campos ni dejar valores mal formados', async () => {
  await assertFails(logCol(asUsuario()).doc('l-1').set(evento('GERARDO MOLERO', 'ADMIN')));
  await assertFails(logCol(asUsuario()).doc('l-2').set(evento('GERARDO MOLERO', 'USUARIO', { otro: 1 })));
  await assertFails(logCol(asUsuario()).doc('l-3').set(evento('GERARDO MOLERO', 'USUARIO', { activo: 'si' })));
  await assertFails(logCol(asUsuario()).doc('l-4').set(evento('GERARDO MOLERO', 'USUARIO', { en: 'ayer' })));
  await assertFails(logCol(asUsuario()).doc('l-5').set(evento('', 'USUARIO')));
});
await check('Registro de técnicos: ALMACEN y PROMOTORA no leen ni escriben; nadie edita ni borra', async () => {
  await assertFails(logCol(testEnv.authenticatedContext('almacen-uid').firestore()).get());
  await assertFails(logCol(testEnv.authenticatedContext('promotora-uid').firestore()).get());
  await assertFails(logCol(testEnv.authenticatedContext('almacen-uid').firestore()).doc('l-6').set(evento('GERARDO MOLERO', 'ALMACEN')));
  await assertFails(logCol(asAdmin()).doc('l-admin').update({ activo: false }));
  await assertFails(logCol(asAdmin()).doc('l-admin').delete());
});

// --- FINANZAS: lee órdenes y reportes, no las toca, y lleva tarifas y pagos ---
const asFinanzas = () => testEnv.authenticatedContext('finanzas-uid').firestore();
const asFinanzasOff = () => testEnv.authenticatedContext('finanzas-off-uid').firestore();
const fin = (db, nombre) => datos(db).collection(nombre);
const tarifas = (extra = {}) => ({ INSTALACION: 20, VISITA: 5, AVERIA: 3.5, RECABLEADO: 8, por: 'fina', en: 1, ...extra });
const pagoDe = (extra = {}) => ({ tecnico: 'GERARDO MOLERO', desde: '2026-10-01', hasta: '2026-10-15', cantidades: { INSTALACION: 1, VISITA: 0, AVERIA: 1 }, tarifas: { INSTALACION: 20, VISITA: 5, AVERIA: 3.5 }, total: 23.5, cantidadOrdenes: 2, nota: '', por: 'fina', creadoEn: 1, anulado: false, ...extra });
const ordenPagada = (pagoId, extra = {}) => ({ pagoId, tecnico: 'GERARDO MOLERO', concepto: 'AVERIA', monto: 3.5, dia: '2026-10-14', codigo: 'AS1', ...extra });
// Un pago con sus órdenes en un solo lote, como lo guarda la app.
const guardarPago = (db, pagoId, pago, ordenes) => {
  const lote = db.batch();
  lote.set(fin(db, 'pagosTecnicos').doc(pagoId), pago);
  for (const [id, datosOrden] of ordenes) lote.set(fin(db, 'ordenesPagadas').doc(id), datosOrden);
  return lote.commit();
};

await check('FINANZAS lee las órdenes, los técnicos y los reportes', async () => {
  await assertSucceeds(fin(asFinanzas(), 'tickets').get());
  await assertSucceeds(fin(asFinanzas(), 'technicians').get());
  await assertSucceeds(fin(asFinanzas(), 'reports').get());
});
await check('FINANZAS NO puede escribir órdenes, reportes ni técnicos', async () => {
  await assertFails(ticketPath(asFinanzas(), 'instalacion-1').update({ observacion: 'x' }));
  await assertFails(fin(asFinanzas(), 'tickets').doc('nueva-fin').set({ codigo: 'X', tipoTrabajo: 'AVERÍA' }));
  await assertFails(ticketPath(asFinanzas(), 'instalacion-1').delete());
  await assertFails(fin(asFinanzas(), 'reports').doc('reporte-1').update({ total: 9 }));
  await assertFails(fin(asFinanzas(), 'technicians').doc('GERARDO-MOLERO').update({ activo: false }));
});
await check('FINANZAS NO lee usuarios ni el historial de instalaciones', async () => {
  await assertFails(fin(asFinanzas(), 'users').get());
  await assertFails(fin(asFinanzas(), 'historialInstalaciones').get());
});
await check('FINANZAS NO lee ni escribe el registro de VN y TA', async () => {
  const fila = { codigo: 'VAN01', trabajo: 'VN', tecnico: '', fecha: '2026-10-14', observacion: '', operador: 'Fina', creadoPor: 'fina', creadoEn: 1, actualizadoEn: 1 };
  await assertFails(fin(asFinanzas(), 'registroVnTa').get());
  await assertFails(fin(asFinanzas(), 'registroVnTa').doc('fila-fin').set(fila));
  await assertFails(fin(asFinanzas(), 'counters').doc('VNTA_VAN_2026-10').set({ ultimo: 1, actualizadoEn: 1 }));
});
await check('Un FINANZAS deshabilitado no lee nada', async () => {
  await assertFails(fin(asFinanzasOff(), 'tickets').get());
  await assertFails(fin(asFinanzasOff(), 'tarifasPago').get());
});
await check('Las colecciones de Finanzas son solo de FINANZAS y el ADMIN: USUARIO, TECNICO, ALMACEN y PROMOTORA no las leen ni escriben', async () => {
  for (const contexto of [asUsuario(), asTecnico(), asAlmacen(), asPromotora()]) {
    for (const nombre of ['tarifasPago', 'pagosTecnicos', 'ordenesPagadas']) await assertFails(fin(contexto, nombre).get());
    await assertFails(fin(contexto, 'tarifasPago').doc('actual').set(tarifas()));
  }
});

await check('Tarifas: FINANZAS y ADMIN las fijan en el documento "actual"', async () => {
  await assertSucceeds(fin(asFinanzas(), 'tarifasPago').doc('actual').set(tarifas()));
  await assertSucceeds(fin(asFinanzas(), 'tarifasPago').doc('actual').get());
  await assertSucceeds(fin(asAdmin(), 'tarifasPago').doc('actual').set(tarifas({ por: 'admin', AVERIA: 4 })));
  // Un cliente que todavía no manda el recableado (la versión anterior de la app) sigue pudiendo guardar.
  const { RECABLEADO, ...sinRecableado } = tarifas();
  await assertSucceeds(fin(asFinanzas(), 'tarifasPago').doc('actual').set(sinRecableado));
  await assertSucceeds(fin(asFinanzas(), 'tarifasPago').doc('actual').set(tarifas()));
});
await check('Tarifas: sin números negativos, sin campos de más, sin otro documento y siempre a su nombre', async () => {
  await assertFails(fin(asFinanzas(), 'tarifasPago').doc('actual').set(tarifas({ AVERIA: -1 })));
  await assertFails(fin(asFinanzas(), 'tarifasPago').doc('actual').set(tarifas({ AVERIA: 'cinco' })));
  await assertFails(fin(asFinanzas(), 'tarifasPago').doc('actual').set(tarifas({ RECABLEADO: -2 })));
  await assertFails(fin(asFinanzas(), 'tarifasPago').doc('actual').set(tarifas({ RECABLEADO: 'ocho' })));
  await assertFails(fin(asFinanzas(), 'tarifasPago').doc('actual').set(tarifas({ extra: 1 })));
  await assertFails(fin(asFinanzas(), 'tarifasPago').doc('otro').set(tarifas()));
  await assertFails(fin(asFinanzas(), 'tarifasPago').doc('actual').set(tarifas({ por: 'otro' })));
  await assertFails(fin(asFinanzas(), 'tarifasPago').doc('actual').delete());
});

await check('Pagar: el pago y sus órdenes se guardan en un solo lote', async () => {
  await assertSucceeds(guardarPago(asFinanzas(), 'p-1', pagoDe(), [['orden-a', ordenPagada('p-1', { concepto: 'INSTALACION', monto: 20 })], ['orden-b', ordenPagada('p-1')]]));
});
await check('Pagar: una orden ya pagada no se paga dos veces (ni por otra persona)', async () => {
  await assertFails(guardarPago(asFinanzas(), 'p-2', pagoDe(), [['orden-a', ordenPagada('p-2')], ['orden-c', ordenPagada('p-2')]]));
  await assertFails(guardarPago(asAdmin(), 'p-3', pagoDe({ por: 'admin' }), [['orden-b', ordenPagada('p-3')]]));
});
await check('Pagar: una orden suelta, sin su pago en el lote, no se guarda', async () => {
  await assertFails(fin(asFinanzas(), 'ordenesPagadas').doc('orden-d').set(ordenPagada('p-inexistente')));
});
await check('Pagar: el pago va a nombre de quien lo hace y con datos válidos', async () => {
  await assertFails(guardarPago(asFinanzas(), 'p-4', pagoDe({ por: 'otro' }), [['orden-e', ordenPagada('p-4')]]));
  await assertFails(guardarPago(asFinanzas(), 'p-4', pagoDe({ total: 0 }), [['orden-e', ordenPagada('p-4')]]));
  await assertFails(guardarPago(asFinanzas(), 'p-4', pagoDe({ anulado: true }), [['orden-e', ordenPagada('p-4')]]));
  await assertFails(guardarPago(asFinanzas(), 'p-4', pagoDe({ extra: 1 }), [['orden-e', ordenPagada('p-4')]]));
  await assertFails(guardarPago(asFinanzas(), 'p-4', pagoDe(), [['orden-e', ordenPagada('p-4', { concepto: 'OTRO' })]]));
});
await check('Pagar: un recableado se guarda con su concepto', async () => {
  await assertSucceeds(guardarPago(asFinanzas(), 'p-rec', pagoDe({ cantidadOrdenes: 1, total: 8 }), [['orden-recableado', ordenPagada('p-rec', { concepto: 'RECABLEADO', monto: 8 })]]));
});
await check('Pagar: un pago grande (400 órdenes) cabe en un solo lote', async () => {
  const ordenes = Array.from({ length: 400 }, (_, i) => [`masiva-${i}`, ordenPagada('p-grande')]);
  await assertSucceeds(guardarPago(asFinanzas(), 'p-grande', pagoDe({ cantidadOrdenes: 400, total: 1400 }), ordenes));
});
await check('Anular: queda el pago marcado y las órdenes vuelven a estar por pagar', async () => {
  const db = asFinanzas();
  const lote = db.batch();
  lote.update(fin(db, 'pagosTecnicos').doc('p-1'), { anulado: true, anuladoPor: 'fina', anuladoEn: 5 });
  lote.delete(fin(db, 'ordenesPagadas').doc('orden-a'));
  lote.delete(fin(db, 'ordenesPagadas').doc('orden-b'));
  await assertSucceeds(lote.commit());
  await assertSucceeds(guardarPago(asFinanzas(), 'p-5', pagoDe(), [['orden-a', ordenPagada('p-5', { concepto: 'INSTALACION', monto: 20 })]]));
});
await check('Anular: no se anula dos veces, no se cambia otro campo del pago ni se borra el pago', async () => {
  await assertFails(fin(asFinanzas(), 'pagosTecnicos').doc('p-1').update({ anulado: true, anuladoPor: 'fina', anuladoEn: 6 }));
  await assertFails(fin(asFinanzas(), 'pagosTecnicos').doc('p-5').update({ total: 1 }));
  await assertFails(fin(asFinanzas(), 'pagosTecnicos').doc('p-5').update({ anulado: true, anuladoPor: 'otro', anuladoEn: 6 }));
  await assertFails(fin(asFinanzas(), 'pagosTecnicos').doc('p-5').delete());
  await assertFails(fin(asFinanzas(), 'ordenesPagadas').doc('orden-a').update({ monto: 1 }));
});

await testEnv.cleanup();

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
} else {
  console.log('\nTodas las pruebas de reglas pasaron.');
}
