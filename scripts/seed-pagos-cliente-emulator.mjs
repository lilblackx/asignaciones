// Datos de prueba de los pagos que los clientes hacen por las órdenes (módulo de Administración y pantalla de cobro del técnico), solo en el emulador local.
// Requiere `npm run emulators` y haber corrido `npm run seed:emulator` (los usuarios). No toca el proyecto real. Se puede repetir: reemplaza lo que creó antes.
//   - Órdenes de GERARDO MOLERO (tecnico1) para probar: dos averías ya finalizadas con cobro (piden el pago al abrir la app) y una instalación pendiente (pide el pago al pre-finalizar).
//   - Pagos de varios técnicos en cada estado para el módulo de Administración, con la referencia reservada de los registrados.
//   - Las cuentas de la empresa (formas de pago) para elegir dónde llegó el pago.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { armarConciliacion, armarPagoPendiente, armarPagoRegistrado, armarSinCobrar, parsePagoCliente } from '../src/utils/pagoCliente.js';
import { FORMAS_PAGO_INICIALES } from '../src/utils/formasPago.js';

initializeApp({ projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = db.collection('artifacts').doc('default-app-id').collection('public').doc('data');
const AHORA = Date.now();
const HORA = 3600 * 1000;
const DIA = 24 * HORA;

// Lo anterior de esta prueba.
for (const c of ['pagosOrdenes', 'referenciasPago']) for (const d of (await base.collection(c).get()).docs) await d.ref.delete();
for (const id of ['pc-visita', 'pc-visita2', 'pc-inst']) await base.collection('tickets').doc(id).delete();

await base.collection('config').doc('formasPago').set({ formas: FORMAS_PAGO_INICIALES, actualizadoEn: AHORA, actualizadoPor: 'seed' });
await base.collection('config').doc('tasaBcv').set({ montoBaseEUR: 10, tasa: 569.6, fecha: new Date(AHORA).toISOString().slice(0, 10) }, { merge: true });

const orden = (extra) => ({
  tecnico: 'GERARDO MOLERO', tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO', estado: 'FINALIZADO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', cobroMoneda: 'BS',
  creado: 'admin', createdAt: AHORA - 5 * HORA, finalizadoEn: AHORA - HORA, isAsignado: true, fecha: new Date(AHORA).toLocaleDateString('es-VE'), historialEdiciones: [], ...extra,
});
await base.collection('tickets').doc('pc-visita').set(orden({ codigo: 'AO501', nombre: 'Ana Pérez', cedula: '20214277', direccion: 'Calle 1 casa 5', telefono: '0414-1234567' }));
await base.collection('tickets').doc('pc-visita2').set(orden({ codigo: 'AO502', nombre: 'Ana Pérez', cedula: '20214277', direccion: 'Calle 1 casa 5', telefono: '0414-1234567', falla: 'Tensado de drop', tipoVisita: 'DROP_ATENUADO', finalizadoEn: AHORA - 2 * HORA }));
await base.collection('tickets').doc('pc-inst').set({
  codigo: 'IO501', nombre: 'Luis Gómez', cedula: '18222333', tipoDocumento: 'V', direccion: 'Av 3 casa 10', telefono: '0412-5550101', tecnico: 'GERARDO MOLERO', tipoTrabajo: 'INSTALACIÓN', falla: 'SM', estado: 'PENDIENTE',
  creado: 'admin', createdAt: AHORA - 6 * HORA, isAsignado: true, fecha: new Date(AHORA).toLocaleDateString('es-VE'), historialEdiciones: [], nap: '', promotora: 'Sariana', promotoraClave: 'sariana',
});

const valor = (extra = {}, cobro = { monto: 5696, moneda: 'BS' }) => parsePagoCliente({ moneda: 'BS', forma: 'Pago móvil', monto: '5696', banco: 'Banesco', cuentaEmpresa: 'Pago Móvil · Banco Nacional de Crédito (BNC) · 0412-1009927', referencia: '100001', fecha: new Date(AHORA - HORA).toISOString().slice(0, 10), hora: '09:30', nota: '', ...extra }, { cobro, cuentas: [], ahora: AHORA + HORA }).valor;
const ficha = (id, codigo, nombre, tecnico, tipoTrabajo = 'AVERÍA') => ({ id, codigo, nombre, cedula: '12345678', telefono: '0414-5550142 / 0424-5550199', tecnico, tipoTrabajo, falla: tipoTrabajo === 'AVERÍA' ? 'LOS' : 'SM', tipoVisita: '', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' });
const guardar = async (doc, tardanza) => {
  const ajustado = { ...doc, creadoEn: AHORA - tardanza, registradoEn: AHORA - tardanza, actualizadoEn: AHORA - tardanza };
  await base.collection('pagosOrdenes').doc(doc.ticketId).set(ajustado);
  if (doc.referenciaClave) await base.collection('referenciasPago').doc(doc.referenciaClave).set({ ticketId: doc.ticketId, codigo: doc.codigo, por: 'x', en: AHORA - tardanza });
  return ajustado;
};

// Pendientes de cobro (el técnico dijo que el cliente paga después)
await guardar(armarPagoPendiente(ficha('pd-1', 'AO410', 'Carlos Rojas', 'REINEL BRAVO'), { nota: 'Paga el viernes por pago móvil' }, { por: 'tecnico2', ahora: AHORA - 6 * DIA }), 6 * DIA);
await guardar(armarPagoPendiente(ficha('pd-2', 'AO415', 'María Salas', 'GERARDO MOLERO'), { nota: 'No tenía efectivo en la casa' }, { por: 'tecnico1', ahora: AHORA - 2 * DIA }), 2 * DIA);
await guardar(armarPagoPendiente(ficha('pd-3', 'AO418', 'José Ríos', 'REINEL BRAVO'), { nota: 'Pagó junto con AO410 (misma referencia 884422).', compartidoCon: { id: 'pd-1', codigo: 'AO410' } }, { por: 'tecnico2', ahora: AHORA - 5 * HORA }), 5 * HORA);

// Registrados por el técnico (por conciliar)
await guardar(armarPagoRegistrado(ficha('pr-1', 'AO420', 'Ana Torres', 'GERARDO MOLERO'), valor({ referencia: '200001' }), { por: 'tecnico1', ahora: AHORA - 3 * HORA }), 3 * HORA);
await guardar(armarPagoRegistrado(ficha('pr-2', 'AO421', 'Pedro Díaz', 'REINEL BRAVO'), valor({ moneda: 'USD', forma: 'Zelle', monto: '10', banco: 'Chase', titular: 'Juan Pérez', cuentaEmpresa: '', referencia: 'ZL-5521' }), { por: 'tecnico2', ahora: AHORA - 4 * HORA }), 4 * HORA);
await guardar(armarPagoRegistrado(ficha('pr-3', 'IO410', 'Sofía Peña', 'GERARDO MOLERO', 'INSTALACIÓN'), valor({ monto: '40000', referencia: '200003', nota: '' }, null), { por: 'tecnico1', ahora: AHORA - DIA }), DIA);
await guardar(armarPagoRegistrado(ficha('pr-4', 'AO422', 'Raúl León', 'REINEL BRAVO'), valor({ monto: '5000', referencia: '200004', nota: 'Pagó menos, descuento del técnico' }), { por: 'tecnico2', ahora: AHORA - 8 * HORA }), 8 * HORA);

// Conciliados y sin cobrar
const conciliado = armarPagoRegistrado(ficha('cn-1', 'AO400', 'Elena Mora', 'GERARDO MOLERO'), valor({ referencia: '300001' }), { por: 'tecnico1', ahora: AHORA - 3 * DIA });
await guardar({ ...conciliado, ...armarConciliacion(conciliado, { nota: 'Verificado en el banco' }, { por: 'administracion', ahora: AHORA - 2 * DIA }).cambios }, 3 * DIA);
const sinCobrar = armarPagoPendiente(ficha('sc-1', 'AO395', 'Iván Soto', 'REINEL BRAVO'), { nota: 'Paga el lunes' }, { por: 'tecnico2', ahora: AHORA - 9 * DIA });
await guardar({ ...sinCobrar, ...armarSinCobrar(sinCobrar, { nota: 'El cliente se mudó y no responde' }, { por: 'administracion', ahora: AHORA - 4 * DIA }).cambios }, 9 * DIA);

console.log('OK  órdenes AO501 y AO502 (averías con cobro, piden el pago), IO501 (instalación pendiente), formas de pago de la empresa y 9 pagos en todos los estados');
console.log('    tecnico1 / Tecnico1234 -> al entrar, la pantalla pide el pago de AO501 y AO502; IO501 pide el pago al pre-finalizar');
console.log('    administracion / Administracion1234 -> ve los pagos y los concilia (el módulo también está en el menú del ADMIN)');
process.exit(0);
