// Datos de prueba COHERENTES para Finanzas en el emulador local (no toca producción). Deja, de los últimos 7 días:
//  - la tasa BCV y las formas de pago de la empresa (config/tasaBcv y config/formasPago), de donde salen los montos y los bancos;
//  - órdenes finalizadas de los dos técnicos con el cobro que corresponde a cada tipo: visita técnica (monto base × tasa, en Bs), otro monto en Bs o
//    en $, exoneradas (garantías, low signal, retiros), instalaciones (sin cobro), una sin cobro registrado y canceladas con su motivo;
//  - conciliaciones de la mayoría de los cobros de hace 2 días o más, con la forma de pago que cuadra con la moneda (Bs: pago móvil o transferencia;
//    $: Zelle) y su referencia;
//  - cuatro filas del registro de VN y TA (tres con técnico, que se pagan con su precio, y una sin técnico, que no se paga);
//  - las tarifas y un pago ya registrado para GERARDO de los días 4 a 6 (calculado con la misma lógica de la app, con la tasa BCV de hace 3 días); REINEL queda sin pagar.
// Requiere `npm run emulators` y, antes, `npm run seed:emulator` (usuarios y técnicos). Entra con finanzas / Finanzas1234.
// Uso: `node scripts/seed-finanzas-emulator.mjs [--limpiar]` (con --limpiar quita las finalizadas y canceladas de otros seeds). Se puede repetir: borra y vuelve a armar lo suyo (ids "fin-seed-*" y las colecciones de Finanzas).
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FORMAS_PAGO_INICIALES, TIPO_ZELLE } from '../src/utils/formasPago.js';
import { armarPago, ordenesPagables, resumenPagos, tarifasCompletas } from '../src/utils/finanzas.js';
import { diaDe } from '../src/utils/totalesMes.js';
import { aprobarPendientes, armarRevision, itemsParaRevisar, revisar } from '../src/utils/revisionPagos.js';

const db = getFirestore(initializeApp({ projectId: 'seguimientons-f2026' }));
const base = db.collection('artifacts').doc('default-app-id').collection('public').doc('data');

// SEED_PAUSA_MS: una pausa (en milisegundos) después de cada escritura, para no saturar el emulador ni la PC (por defecto, ninguna). Cada etapa avisa por consola.
const pausa = () => new Promise((resolve) => setTimeout(resolve, Number(process.env.SEED_PAUSA_MS) || 0));
const etapa = (texto) => console.log(`... ${texto}`);

const MIN = 60000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const ahora = Date.now();
const TECNICOS = ['GERARDO MOLERO', 'REINEL BRAVO'];

// --- Tasa y formas de pago: 10 € de base × 569,60 Bs = 5.696 Bs la visita técnica ---
const MONTO_BASE_EUR = 10;
const TASA = 569.6;
const VISITA_BS = (MONTO_BASE_EUR * TASA).toLocaleString('es-VE', { maximumFractionDigits: 0 });
const FORMAS = [...FORMAS_PAGO_INICIALES, { tipo: TIPO_ZELLE, correo: 'pagos@networkspeed.example', titular: 'Network Speed, C.A' }];
await base.collection('config').doc('tasaBcv').set({ montoBaseEUR: MONTO_BASE_EUR, tasa: TASA, fuente: 'manual', actualizadoEn: ahora, actualizadoPor: 'seed' });
await base.collection('config').doc('formasPago').set({ formas: FORMAS });

// --- Los trabajos de un día (cada técnico hace 4, rotando) y cómo se cobra cada uno ---
const visita = (tipoVisita) => ({ tipoVisita, cobroTipo: 'VISITA_TECNICA', cobroBs: VISITA_BS });
const otroUsd = (monto, tipoVisita) => ({ ...(tipoVisita && { tipoVisita }), cobroTipo: 'OTRO_MONTO', cobroBs: String(monto), cobroMoneda: 'USD' });
const exonerado = (tipoVisita = '') => ({ ...(tipoVisita && { tipoVisita }), cobroTipo: 'EXONERADO', cobroBs: null });
const TRABAJOS = [
  { tipoTrabajo: 'AVERÍA', falla: 'Sin señal', ...visita('CONECTOR_INTERNO') },
  { tipoTrabajo: 'INSTALACIÓN', falla: 'SM' },
  { tipoTrabajo: 'AVERÍA', falla: 'Tensado de drop', ...visita('RECABLEADO') },
  { tipoTrabajo: 'CAMBIO DE EQUIPO', falla: 'SM', ...otroUsd(30, 'CAMBIO_EQUIPO') },
  { tipoTrabajo: 'LOW SIGNAL', falla: 'Señal baja', ...exonerado() },
  { tipoTrabajo: 'INSTALACIÓN', falla: 'MTV' },
  { tipoTrabajo: 'MUDANZA', falla: 'Interna', ...otroUsd(25) },
  { tipoTrabajo: 'MUDANZA', falla: 'Externa', ...otroUsd(25) },
  { tipoTrabajo: 'AVERÍA', falla: 'Sin señal', ...visita('CONECTOR_EXTERNO') },
  { tipoTrabajo: 'GARANTIA', falla: '', ...exonerado() },
  { tipoTrabajo: 'AVERÍA', falla: 'Sin señal', ...exonerado('CONECTOR_INTERNO') },
  { tipoTrabajo: 'RETIRO EQUIPO', falla: '', ...exonerado() },
  { tipoTrabajo: 'CAMBIO DE EQUIPO', falla: 'MTV', ...otroUsd(45, 'CAMBIO_EQUIPO') },
  { tipoTrabajo: 'INSTALACIÓN', falla: 'MR' },
  { tipoTrabajo: 'AVERÍA', falla: 'Verificación de equipos' }, // finalizada sin cobro registrado: no entra en el pago ni en el cobro
];

// Limpia lo de corridas anteriores (órdenes de este seed y las colecciones de Finanzas).
for (const nombre of ['conciliacionCobros', 'tarifasPago', 'pagosTecnicos', 'ordenesPagadas', 'ajustesTecnicos']) {
  for (const d of (await base.collection(nombre).get()).docs) { await d.ref.delete(); await pausa(); }
}
// Con --limpiar también se quitan las órdenes FINALIZADAS o CANCELADAS de otros seeds del emulador (esperas, ventas...), que traen montos y monedas
// sueltos que no cuadran con esta tasa ni con estas formas de pago. Las pendientes y los usuarios no se tocan.
const limpiarOtras = process.argv.includes('--limpiar');
for (const d of (await base.collection('tickets').get()).docs) {
  if (d.id.startsWith('fin-seed-') || (limpiarOtras && ['FINALIZADO', 'CANCELADO'].includes(d.data().estado))) { await d.ref.delete(); await pausa(); }
}

const ordenes = [];
let n = 0;
for (let haceDias = 0; haceDias < 7; haceDias++) {
  TECNICOS.forEach((tecnico, t) => {
    for (let k = 0; k < 4; k++) {
      const trabajo = TRABAJOS[(haceDias * 3 + t * 5 + k * 2) % TRABAJOS.length];
      const finalizadoEn = ahora - haceDias * DIA - (t * 4 + k + 1) * 25 * MIN;
      n++;
      ordenes.push({
        id: `fin-seed-${n}`, codigo: `${trabajo.tipoTrabajo === 'INSTALACIÓN' ? 'IO' : 'AS'}${300 + n}`, nombre: `Cliente ${300 + n}`, cedula: `V-${21000000 + n}`,
        direccion: 'Dirección de prueba', telefono: '04140000001', tecnico, estado: 'FINALIZADO', creado: 'usuario', isAsignado: true,
        createdAt: finalizadoEn - 4 * HORA, prefinalizadoEn: finalizadoEn - 20 * MIN, finalizadoEn, historialEdiciones: [],
        ...trabajo,
      });
    }
  });
  // Una cancelada cada dos días, con su motivo.
  if (haceDias % 2 === 1) {
    n++;
    const canceladaEn = ahora - haceDias * DIA - 5 * HORA;
    ordenes.push({
      id: `fin-seed-${n}`, codigo: `AS${300 + n}`, nombre: `Cliente ${300 + n}`, cedula: `V-${21000000 + n}`, direccion: 'Dirección de prueba', telefono: '04140000001',
      tecnico: TECNICOS[haceDias % 2], tipoTrabajo: 'AVERÍA', falla: 'Sin señal', estado: 'CANCELADO', creado: 'usuario', isAsignado: true, createdAt: canceladaEn - 2 * HORA,
      canceladaEn, canceladaPor: 'usuario', motivoCancelacion: 'El cliente ya no estaba en la dirección', historialEdiciones: [],
    });
  }
}
// Una instalación finalizada que quedó sin técnico en su ficha: Finanzas avisa que no se puede pagar.
n++;
ordenes.push({ id: `fin-seed-${n}`, codigo: `IO${300 + n}`, nombre: `Cliente ${300 + n}`, cedula: `V-${21000000 + n}`, direccion: 'Dirección de prueba', telefono: '04140000001', tecnico: '', tipoTrabajo: 'INSTALACIÓN', falla: 'MR', estado: 'FINALIZADO', creado: 'usuario', isAsignado: false, createdAt: ahora - 5 * HORA, prefinalizadoEn: ahora - 2 * HORA, finalizadoEn: ahora - HORA, historialEdiciones: [] });
// Una garantía de otro técnico: la instalación de GERARDO falló y REINEL fue a repararla. La garantía lleva el check con su orden original: en Revisión de órdenes espera la decisión
// (descontar de la instalación original o no) y no se puede aprobar hasta tomarla.
{
  const instaladaEn = ahora - 5 * DIA;
  const reparadaEn = ahora - 1 * DIA;
  const cliente = { nombre: 'Cliente Garantía', cedula: 'V-21999999', direccion: 'Dirección de prueba', telefono: '04140000001', creado: 'usuario', isAsignado: true, historialEdiciones: [] };
  ordenes.push({ id: 'fin-seed-garantia-original', codigo: 'IO399', ...cliente, tecnico: TECNICOS[0], tipoTrabajo: 'INSTALACIÓN', falla: 'MR', estado: 'FINALIZADO', createdAt: instaladaEn - 4 * HORA, prefinalizadoEn: instaladaEn - 20 * MIN, finalizadoEn: instaladaEn });
  ordenes.push({
    id: 'fin-seed-garantia', codigo: 'AS499', ...cliente, tecnico: TECNICOS[1], tipoTrabajo: 'AVERÍA', falla: 'Sin señal', ...visita('CONECTOR_INTERNO'), estado: 'FINALIZADO',
    createdAt: reparadaEn - 3 * HORA, prefinalizadoEn: reparadaEn - 20 * MIN, finalizadoEn: reparadaEn,
    garantiaDe: { id: 'fin-seed-garantia-original', codigo: 'IO399', tecnico: TECNICOS[0], cliente: cliente.nombre },
  });
}
etapa(`escribiendo ${ordenes.length} órdenes`);
for (const { id, ...datos } of ordenes) { await base.collection('tickets').doc(id).set(datos); await pausa(); }

// Filas del registro de VN y TA: con técnico se le pagan (cada tipo con su precio); la que no lo tiene la hizo infraestructura sola y no se paga a nadie.
for (const d of (await base.collection('registroVnTa').get()).docs) if (d.id.startsWith('fin-seed-')) { await d.ref.delete(); await pausa(); }
const filasVnTa = [
  { trabajo: 'VN', codigo: 'VAN91', tecnico: TECNICOS[0], haceDias: 1, observacion: 'Puertos liberados' },
  { trabajo: 'VN', codigo: 'VAN92', tecnico: TECNICOS[1], haceDias: 2, observacion: '' },
  { trabajo: 'TA', codigo: 'TA91', tecnico: TECNICOS[0], haceDias: 2, observacion: 'Apoyo en reparar NAP' },
  { trabajo: 'TA', codigo: 'TA92', tecnico: '', haceDias: 3, observacion: 'Lo hizo infraestructura sola' },
];
for (const [i, { haceDias, ...fila }] of filasVnTa.entries()) {
  await base.collection('registroVnTa').doc(`fin-seed-vnta-${i + 1}`).set({ ...fila, fecha: diaDe(ahora - haceDias * DIA), operador: 'Prueba', creadoPor: 'usuario', creadoEn: ahora, actualizadoEn: ahora });
  await pausa();
}

// Un adelanto en dólares para REINEL BRAVO (por descontar en su próximo pago) y otro ya anulado.
etapa('VN y TA, adelantos, tarifas y el pago ya hecho');
for (const d of (await base.collection('adelantosTecnicos').get()).docs) { await d.ref.delete(); await pausa(); }
const hace = (dias, horas) => ahora - dias * DIA - horas * HORA;
await base.collection('adelantosTecnicos').doc('fin-seed-adelanto-1').set({ tecnico: TECNICOS[1], monto: 30, aplicado: 0, forma: 'Zelle', referencia: 'ZL-5521', pagadoEn: hace(1, 3), nota: 'Para gasolina', por: 'finanzas', creadoEn: hace(1, 3), anulado: false, notificado: true });
await base.collection('adelantosTecnicos').doc('fin-seed-adelanto-2').set({ tecnico: TECNICOS[1], monto: 10, aplicado: 0, forma: 'Efectivo', referencia: '', pagadoEn: hace(2, 1), nota: '', por: 'finanzas', creadoEn: hace(2, 1), anulado: true, anuladoPor: 'finanzas', anuladoEn: hace(2, 0), notificado: false });

// --- Tarifas y un pago ya hecho (con la misma lógica de la app) ---
const POR = 'finanzas';
const tarifas = tarifasCompletas({ INSTALACION: 25, AVERIA: 4, MUDANZA_INTERNA: 5, MUDANZA_EXTERNA: 8, VALIDACION_NAP: 2, TRABAJO_ADICIONAL: 6, RECABLEADO: 8, LOW_SIGNAL: 3, CAMBIO_EQUIPO: 10 });
await base.collection('tarifasPago').doc('actual').set({ ...tarifas, por: POR, en: ahora - 7 * DIA });
const rangoPagado = { desde: diaDe(ahora - 6 * DIA), hasta: diaDe(ahora - 4 * DIA) };
const filaPagada = resumenPagos(ordenesPagables(ordenes, rangoPagado, { tecnico: TECNICOS[0] }), tarifas, new Set()).find((f) => f.tecnico === TECNICOS[0]);
const pago = armarPago(filaPagada, rangoPagado, tarifas, { por: POR, ahora: ahora - 3 * DIA, nota: 'Pago de la semana anterior', tasa: 566.8 });
const lote = db.batch();
lote.set(base.collection('pagosTecnicos').doc(pago.pagoId), pago.pago);
for (const { id, datos } of pago.ordenes) lote.set(base.collection('ordenesPagadas').doc(id), datos);
await lote.commit();

// Revisión de pagos (la barrera antes de Finanzas): todo arranca pendiente; se aprueba lo de GERARDO y la mitad de lo de REINEL, y se deja una orden retenida y otra excluida.
etapa('revisión de órdenes');
for (const d of (await base.collection('revisionPagos').get()).docs) { await d.ref.delete(); await pausa(); }
const registrosSeed = filasVnTa.map(({ haceDias, ...fila }, i) => ({ id: `fin-seed-vnta-${i + 1}`, ...fila, fecha: diaDe(ahora - haceDias * DIA) }));
const rangoRevision = { desde: diaDe(ahora - 6 * DIA), hasta: diaDe(ahora) };
const revisados = revisar(itemsParaRevisar({ ordenes, rango: rangoRevision, registros: registrosSeed }), {});
const sinPagar = revisados.filter((i) => !pago.ordenes.some((o) => o.id === i.clave));
const aprobarGerardo = aprobarPendientes(sinPagar.filter((i) => i.tecnico === TECNICOS[0]), { por: 'admin', ahora: ahora - HORA });
const reinel = sinPagar.filter((i) => i.tecnico === TECNICOS[1]);
const aprobarReinel = aprobarPendientes(reinel.slice(0, Math.ceil(reinel.length / 2)), { por: 'admin', ahora: ahora - HORA });
const retenida = reinel.length > 2 ? armarRevision(reinel[reinel.length - 1], 'RETENER', { por: 'admin', ahora: ahora - 2 * HORA, motivo: 'Falta confirmar el cobro con el cliente' }) : null;
const excluida = reinel.length > 3 ? armarRevision(reinel[reinel.length - 2], 'EXCLUIR', { por: 'admin', ahora: ahora - 2 * HORA, motivo: 'Orden de prueba' }) : null;
for (const { id, datos } of [...aprobarGerardo.documentos, ...aprobarReinel.documentos, retenida, excluida].filter(Boolean)) { await base.collection('revisionPagos').doc(id).set(datos); await pausa(); }
console.log(`OK  revisión de pagos: ${aprobarGerardo.documentos.length + aprobarReinel.documentos.length} aprobadas, ${retenida ? 1 : 0} retenida, ${excluida ? 1 : 0} excluida; el resto queda pendiente`);
console.log(`OK  tasa ${TASA} × ${MONTO_BASE_EUR} € = ${VISITA_BS} Bs por visita; ${FORMAS.length} formas de pago`);
console.log(`OK  ${ordenes.length} órdenes (finalizadas y canceladas) de los últimos 7 días, con una garantía de otro técnico (AS499, de la IO399) esperando decisión`);
console.log(`OK  tarifas ${JSON.stringify(tarifas)} y un pago de ${pago.pago.total} $ a ${TECNICOS[0]} (${pago.pago.cantidadOrdenes} órdenes, ${rangoPagado.desde} a ${rangoPagado.hasta})`);
process.exit(0);
