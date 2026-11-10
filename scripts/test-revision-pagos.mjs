// Prueba la barrera de revisión de pagos (src/utils/revisionPagos.js): qué se revisa, la firma que invalida una aprobación cuando la orden cambia, las acciones del administrador
// (aprobar, retener, excluir, corregir), qué pasa a Finanzas y los resúmenes. No necesita el emulador. Uso: `node scripts/test-revision-pagos.mjs`.
import { SIN_TECNICO, agruparOrdenes, claveOrden, ordenesFueraDelCorte, rangoDeLectura, rangoPagable, rangoPorRevisar, tarifasCompletas } from '../src/utils/finanzas.js';
import { ensancharRango, rangoDe } from '../src/utils/periodoReporte.js';
import { planDeLectura } from '../src/utils/ventanaLectura.js';
import { idsPagadas, marcadorDeInicio, marcadorDeLectura, mensajeDePagadas, pagadasCoinciden } from '../src/utils/pagadasRevision.js';
import {
  aprobarPendientes, armarRevision, filtrarPorBusqueda, firmaDeItem, marcasDeRevision, itemsParaRevisar, motivoNoAprobable, motivoSinPago, paraFinanzas, parseMotivoRevision, resumenRevision, revisar, textoEscaladaRevision,
} from '../src/utils/revisionPagos.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const DIA = (n) => Date.UTC(2026, 9, n, 16, 0, 0);
const rango = { desde: '2026-10-26', hasta: '2026-10-31' };
let n = 0;
const orden = (extra) => ({ id: `o${++n}`, codigo: `IO${n}`, nombre: `Cliente ${n}`, estado: 'FINALIZADO', tecnico: 'GERARDO', createdAt: DIA(25), finalizadoEn: DIA(27), tipoTrabajo: 'INSTALACIÓN', ...extra });
const averia = (extra) => orden({ tipoTrabajo: 'AVERÍA', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', ...extra });
const inst = orden({});
const ave = averia({});
const sinTecnico = orden({ tecnico: '' });
const mudanzaSinTipo = averia({ tipoTrabajo: 'MUDANZA', falla: '' });
const registro = { id: 'r1', codigo: 'VAN01', trabajo: 'VN', tecnico: 'LUIS', fecha: '2026-10-28', observacion: '' };
const items = itemsParaRevisar({ ordenes: [inst, ave, sinTecnico, mudanzaSinTipo], rango, registros: [registro] });
const por = (codigo) => items.find((i) => i.orden.codigo === codigo);

check('se revisa todo lo pagable, las órdenes sin técnico (para corregirlas), las filas de VN y TA y las mudanzas sin tipo', items.map((i) => [i.orden.codigo, i.concepto]).sort((a, b) => a[0].localeCompare(b[0])),
  [['IO2', 'AVERIA'], ['IO1', 'INSTALACION'], ['IO3', 'INSTALACION'], ['IO4', null], ['VAN01', 'VALIDACION_NAP']].sort((a, b) => a[0].localeCompare(b[0])));

// --- Estado de revisión y firma ---
const sinRevisar = revisar(items, {});
check('todo arranca pendiente de revisión', sinRevisar.map((i) => i.estadoRevision), sinRevisar.map(() => 'PENDIENTE'));
const firmaInst = firmaDeItem(por('IO1'));
check('la firma es estable y distinta entre órdenes', [firmaDeItem(por('IO1')) === firmaInst, firmaDeItem(por('IO2')) === firmaInst], [true, false]);
check('la firma cambia si cambia el técnico, el cobro o el tipo de trabajo', [
  firmaDeItem({ ...por('IO1'), orden: { ...inst, tecnico: 'OTRO' } }) !== firmaInst,
  firmaDeItem({ ...por('IO2'), orden: { ...ave, cobroBs: '9.999' } }) !== firmaDeItem(por('IO2')),
  firmaDeItem({ ...por('IO1'), orden: { ...inst, tipoTrabajo: 'AVERÍA' } }) !== firmaInst,
], [true, true, true]);

// --- Acciones ---
const revisadas = (docs) => revisar(items, Object.fromEntries(docs.map((d) => [d.id, d.datos])));
const aprobarInst = armarRevision(revisar(items)[items.indexOf(por('IO1'))], 'APROBAR', { por: 'admin', ahora: 100 });
check('aprobar guarda estado, quién, cuándo, la firma, el día y el historial', [aprobarInst.id, aprobarInst.datos.estado, aprobarInst.datos.por, aprobarInst.datos.en, aprobarInst.datos.firma === firmaInst, aprobarInst.datos.dia, aprobarInst.datos.codigo, aprobarInst.datos.historial.length], [claveOrden(inst), 'APROBADA', 'admin', 100, true, '2026-10-27', 'IO1', 1]);
const conAprobada = revisadas([aprobarInst]);
check('lo aprobado queda aprobado y pasa a Finanzas; lo demás no', [conAprobada.map((i) => i.estadoRevision).filter((e) => e === 'APROBADA').length, paraFinanzas(conAprobada).map((i) => i.orden.codigo)], [1, ['IO1']]);

const revisadoDe = (codigo, docs = []) => revisadas(docs).find((i) => i.orden.codigo === codigo);
check('retener y excluir piden motivo', [armarRevision(revisadoDe('IO2'), 'RETENER', { por: 'admin', ahora: 1 }).error, armarRevision(revisadoDe('IO2'), 'EXCLUIR', { por: 'admin', ahora: 1, motivo: '  ' }).error], ['Escribe el motivo.', 'Escribe el motivo.']);
const retener = armarRevision(revisadoDe('IO2'), 'RETENER', { por: 'admin', ahora: 5, motivo: 'Falta  confirmar | el cobro' });
check('retener guarda el motivo limpio y no pasa a Finanzas', [retener.datos.estado, retener.datos.motivo, paraFinanzas(revisadas([retener])).length], ['RETENIDA', 'Falta confirmar / el cobro', 0]);
const excluir = armarRevision(revisadoDe('IO3'), 'EXCLUIR', { por: 'admin', ahora: 6, motivo: 'Orden de prueba' });
check('excluir deja la orden fuera con su motivo', [excluir.datos.estado, revisadas([excluir]).find((i) => i.orden.codigo === 'IO3').estadoRevision, paraFinanzas(revisadas([excluir])).length], ['EXCLUIDA', 'EXCLUIDA', 0]);
check('el motivo largo se rechaza', parseMotivoRevision('x'.repeat(301)).error !== undefined, true);

// --- Lo que no se puede aprobar todavía ---
check('una orden sin técnico no se aprueba hasta corregirla', [motivoNoAprobable(revisadoDe('IO3')), armarRevision(revisadoDe('IO3'), 'APROBAR', { por: 'admin', ahora: 1 }).error], ['La orden no tiene técnico: corrígelo antes de aprobarla.', 'La orden no tiene técnico: corrígelo antes de aprobarla.']);
check('una mudanza sin tipo no se aprueba hasta elegirle el concepto', armarRevision(revisadoDe('IO4'), 'APROBAR', { por: 'admin', ahora: 1 }).error, 'Elige el concepto con que se paga (Corregir).');

// --- Correcciones ---
const corregirTecnico = armarRevision(revisadoDe('IO3'), 'PENDIENTE', { por: 'admin', ahora: 7, correccion: { tecnico: 'REINEL', concepto: '' } });
const conTecnicoCorregido = revisadas([corregirTecnico]).find((i) => i.orden.codigo === 'IO3');
check('corregir el técnico lo cambia para Finanzas y se puede aprobar', [conTecnicoCorregido.tecnico, conTecnicoCorregido.tecnicoOriginal, conTecnicoCorregido.corregida, motivoNoAprobable(conTecnicoCorregido)], ['REINEL', SIN_TECNICO, true, '']);
const aprobarCorregida = armarRevision(conTecnicoCorregido, 'APROBAR', { por: 'admin', ahora: 8 });
const corregidaAprobada = revisadas([aprobarCorregida]).find((i) => i.orden.codigo === 'IO3');
check('aprobada con la corrección: Finanzas la ve con el técnico corregido y conserva la corrección', [paraFinanzas([corregidaAprobada]).map((i) => [i.orden.codigo, i.tecnico]), aprobarCorregida.datos.tecnicoCorregido, aprobarCorregida.datos.historial.length], [[['IO3', 'REINEL']], 'REINEL', 2]);
const corregirMudanza = armarRevision(revisadoDe('IO4'), 'PENDIENTE', { por: 'admin', ahora: 9, correccion: { tecnico: '', concepto: 'MUDANZA_EXTERNA' } });
const mudanzaCorregida = revisadas([corregirMudanza]).find((i) => i.orden.codigo === 'IO4');
const aprobarMudanza = armarRevision(mudanzaCorregida, 'APROBAR', { por: 'admin', ahora: 10 });
check('a una mudanza sin tipo el administrador le elige el concepto y entonces se aprueba', [mudanzaCorregida.concepto, aprobarMudanza.error, paraFinanzas(revisadas([corregirMudanza, aprobarMudanza]).filter((i) => i.orden.codigo === 'IO4')).map((i) => i.concepto)], ['MUDANZA_EXTERNA', undefined, ['MUDANZA_EXTERNA']]);
check('un concepto que no existe se rechaza', armarRevision(revisadoDe('IO4'), 'PENDIENTE', { por: 'admin', ahora: 1, correccion: { concepto: 'REGALO' } }).error, 'Ese concepto no existe.');

// --- La marca de pago: pendientePago y pagoId ---
const docDe = (accion, item, extra = {}) => armarRevision(item, accion, { por: 'admin', ahora: 50, motivo: 'por una razón', ...extra }).datos;
check('aprobar deja la orden pendiente de pago, sin pagoId', [docDe('APROBAR', revisadoDe('IO1')).pendientePago, 'pagoId' in docDe('APROBAR', revisadoDe('IO1'))], [true, false]);
check('retener, excluir y corregir (pendiente) no la dejan pendiente de pago', ['RETENER', 'EXCLUIR', 'PENDIENTE'].map((a) => docDe(a, revisadoDe('IO1')).pendientePago), [false, false, false]);
const aprobadaIO1 = { ...revisadoDe('IO1'), revision: { ...docDe('APROBAR', revisadoDe('IO1')), firma: revisadoDe('IO1').firma }, estadoRevision: 'APROBADA' };
check('al volver a guardar una aprobada sin pagar sigue pendiente de pago', docDe('APROBAR', aprobadaIO1).pendientePago, true);
const pagadaIO1 = { ...aprobadaIO1, revision: { ...aprobadaIO1.revision, pendientePago: false, pagoId: 'pago-1' } };
check('una orden ya pagada conserva su pagoId y nunca vuelve a pendiente de pago, aunque se apruebe o se corrija otra vez', ['APROBAR', 'PENDIENTE', 'RETENER'].map((a) => { const d = docDe(a, pagadaIO1); return [d.pendientePago, d.pagoId]; }), [[false, 'pago-1'], [false, 'pago-1'], [false, 'pago-1']]);
const pagadaCambio = { ...pagadaIO1, revision: null, revisionAnterior: pagadaIO1.revision, estadoRevision: 'PENDIENTE', cambioDespues: true };
check('aunque la orden haya cambiado después de pagarla (la firma ya no vale) se conserva el pagoId', [docDe('APROBAR', pagadaCambio).pendientePago, docDe('APROBAR', pagadaCambio).pagoId], [false, 'pago-1']);
check('aprobar de golpe deja cada documento pendiente de pago', aprobarPendientes(revisar(items), { por: 'admin', ahora: 60 }).documentos.map((d) => d.datos.pendientePago).every(Boolean), true);
const quitarCorreccion = armarRevision(conTecnicoCorregido, 'PENDIENTE', { por: 'admin', ahora: 11, correccion: { tecnico: '', concepto: '' } });
check('quitar la corrección devuelve el técnico original', [quitarCorreccion.datos.tecnicoCorregido, revisadas([quitarCorreccion]).find((i) => i.orden.codigo === 'IO3').tecnico], ['', SIN_TECNICO]);

// --- Si la orden cambia después, vuelve a revisión ---
const aprobada = revisadas([aprobarInst]);
const cambiada = itemsParaRevisar({ ordenes: [{ ...inst, tecnico: 'OTRO' }, ave, sinTecnico, mudanzaSinTipo], rango, registros: [registro] });
const alCambiar = revisar(cambiada, Object.fromEntries([aprobarInst].map((d) => [d.id, d.datos]))).find((i) => i.orden.codigo === 'IO1');
check('si la orden aprobada cambia, pierde la aprobación, avisa que cambió y ya no pasa a Finanzas', [aprobada.find((i) => i.orden.codigo === 'IO1').estadoRevision, alCambiar.estadoRevision, alCambiar.cambioDespues, paraFinanzas([alCambiar]).length], ['APROBADA', 'PENDIENTE', true, 0]);

// --- Las ya pagadas y aprobar varias ---
check('lo ya pagado sigue a la vista de Finanzas aunque no se haya revisado, con sus datos originales', paraFinanzas(sinRevisar, new Set([claveOrden(inst)])).map((i) => [i.orden.codigo, i.tecnico, i.concepto]), [['IO1', 'GERARDO', 'INSTALACION']]);
const lote = aprobarPendientes(sinRevisar, { por: 'admin', ahora: 20 });
check('aprobar las pendientes aprueba las que se pueden y avisa de las que no (sin técnico, sin concepto)', [lote.documentos.map((d) => d.datos.codigo).sort(), lote.omitidas.map((o) => o.item.orden.codigo).sort()], [['IO1', 'IO2', 'VAN01'], ['IO3', 'IO4']]);
check('no vuelve a aprobar lo que ya está revisado', aprobarPendientes(revisadas([aprobarInst, retener]), { por: 'admin', ahora: 21 }).documentos.map((d) => d.datos.codigo).sort(), ['VAN01']);

// --- Resumen ---
const tarifas = tarifasCompletas({ INSTALACION: 25, AVERIA: 4, VALIDACION_NAP: 2 });
const resumen = resumenRevision(revisadas([aprobarInst, retener]), (i) => tarifas[i.concepto] || 0);
check('el resumen cuenta y suma por estado', [resumen.APROBADA, resumen.RETENIDA, resumen.PENDIENTE.cantidad, resumen.EXCLUIDA.cantidad], [{ cantidad: 1, total: 25 }, { cantidad: 1, total: 4 }, 3, 0]);
check('lo ya pagado no cuenta en el resumen', resumenRevision(sinRevisar, (i) => tarifas[i.concepto] || 0, new Set([claveOrden(inst)])).PENDIENTE.cantidad, sinRevisar.length - 1);

// --- Órdenes de antes del corte que se ofrecen por esta vez (ORDENES_FUERA_DEL_CORTE) ---
const vieja = (codigo, extra) => averia({ codigo, tecnico: 'JOSE', createdAt: Date.UTC(2026, 9, 22, 15), finalizadoEn: Date.UTC(2026, 9, 22, 18), ...extra });
const ao268 = vieja('AO268', { tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO' });
const otraVieja = vieja('AO999', { tipoTrabajo: 'AVERÍA' });
const deOtro = vieja('AO270', { tecnico: 'GERARDO', tipoTrabajo: 'AVERÍA' });
const periodo = (desde, hasta) => ({ desde, hasta });
const conExcepcion = (r) => itemsParaRevisar({ ordenes: [ao268, otraVieja, deOtro, inst], rango: rangoPagable(r), rangoElegido: r }).map((i) => i.orden.codigo).sort();
check('con el periodo que incluye el 22/10 entra la orden de la lista, solo esa y solo del técnico indicado', conExcepcion(periodo('2026-10-20', '2026-10-31')), ['AO268', inst.codigo].sort());
check('con un periodo desde el corte no entra: la revisión y los pagos de ese día no se leerían', conExcepcion(periodo('2026-10-26', '2026-10-31')), [inst.codigo]);
check('sin periodo elegido no entra ninguna', itemsParaRevisar({ ordenes: [ao268], rango: rangoPagable(periodo('2026-10-20', '2026-10-31')) }).length, 0);
check('el concepto y el día son los de siempre', ordenesFueraDelCorte([ao268], periodo('2026-10-20', '2026-10-31')).map((i) => [i.concepto, i.dia, i.tecnico]), [['AVERIA', '2026-10-22', 'JOSE']]);
check('una orden de la lista que ya es posterior al corte no se duplica', ordenesFueraDelCorte([vieja('AO268', { finalizadoEn: DIA(27), createdAt: DIA(27), tipoTrabajo: 'AVERÍA' })], periodo('2026-10-20', '2026-10-31')).length, 0);
check('una vez revisada y aprobada pasa a Finanzas como cualquier otra', (() => {
  const elegido = periodo('2026-10-20', '2026-10-31');
  const [item] = itemsParaRevisar({ ordenes: [ao268], rango: rangoPagable(elegido), rangoElegido: elegido });
  const doc = armarRevision(revisar([item])[0], 'APROBAR', { por: 'admin', ahora: 1 });
  const aprobada = revisar([item], { [doc.id]: doc.datos });
  return paraFinanzas(aprobada).map((i) => i.orden.codigo);
})(), ['AO268']);

// --- Poner la marca a las revisiones que ya existían ---
const revs = [
  { id: 'a', estado: 'APROBADA' }, // aprobada, sin pagar, sin marca
  { id: 'b', estado: 'APROBADA' }, // aprobada y pagada, sin marca
  { id: 'c', estado: 'RETENIDA' }, // retenida
  { id: 'd', estado: 'APROBADA', pendientePago: true }, // aprobada sin pagar, ya marcada
  { id: 'e', estado: 'APROBADA', pendientePago: false, pagoId: 'p1' }, // pagada, ya marcada
  { id: 'f', estado: 'APROBADA', pendientePago: true }, // marcada pendiente, pero ya está pagada (la marcó un cliente viejo)
  { id: 'g', estado: 'APROBADA', pendientePago: false, pagoId: 'p-anulado' }, // marcada pagada, pero su pago se anuló (ya no hay orden pagada)
  { id: 'h', estado: 'PENDIENTE' },
];
const m = marcasDeRevision(revs, [{ id: 'b', pagoId: 'p1' }, { id: 'e', pagoId: 'p1' }, { id: 'f', pagoId: 'p2' }, { id: 'huerfana', pagoId: 'p3' }]);
check('marca cada revisión según su estado y si tiene orden pagada (y no toca las que ya están bien)', m.actualizar, [
  { id: 'a', datos: { pendientePago: true, pagoId: '' } },
  { id: 'b', datos: { pendientePago: false, pagoId: 'p1' } },
  { id: 'c', datos: { pendientePago: false, pagoId: '' } },
  { id: 'f', datos: { pendientePago: false, pagoId: 'p2' } },
  { id: 'g', datos: { pendientePago: true, pagoId: '' } },
  { id: 'h', datos: { pendientePago: false, pagoId: '' } },
]);
check('cuenta las que quedan pendientes de pago y las pagadas, y avisa de una orden pagada sin revisión', [m.pendientes, m.pagadas, m.sinRevision], [3, 3, ['huerfana']]);
check('con todo ya marcado no hay nada que escribir (se puede correr de nuevo)', marcasDeRevision([{ id: 'x', estado: 'APROBADA', pendientePago: true }, { id: 'y', estado: 'EXCLUIDA', pendientePago: false }], []).actualizar, []);

// --- Buscador y orden de la lista ---
const itemB = (codigo, nombre, extra = {}, tecnico = 'GERARDO', dia = '2026-10-27') => ({ clave: codigo, dia, concepto: 'INSTALACION', tecnico, tecnicoOriginal: tecnico, orden: { codigo, nombre, ...extra } });
const lista = [
  itemB('IO101', 'María Pérez', { cedula: 'V-12.345.678', telefono: '0414-1112233' }),
  itemB('IO99', 'José Núñez', { cedula: '9876543' }, 'LUIS'),
  { ...itemB('AO7', 'Ana Gil'), tecnico: 'REINEL', tecnicoOriginal: 'LUIS' },
];
const codigosDe = (t) => filtrarPorBusqueda(lista, t).map((i) => i.orden.codigo);
check('buscar sin texto devuelve todo', codigosDe('   '), ['IO101', 'IO99', 'AO7']);
check('busca por código, sin importar mayúsculas', codigosDe('io10'), ['IO101']);
check('busca por cliente sin tildes', codigosDe('maria perez'), ['IO101']);
check('busca por técnico, el de ahora y el que traía la orden', [codigosDe('reinel'), codigosDe('luis')], [['AO7'], ['IO99', 'AO7']]);
check('busca por cédula con o sin puntos y por teléfono, pero solo con 3 dígitos o más', [codigosDe('12345678'), codigosDe('v-12.345'), codigosDe('1112233'), codigosDe('12')], [['IO101'], ['IO101'], ['IO101'], []]);
check('nada que coincida devuelve una lista vacía', codigosDe('zzz'), []);

const ordenado = agruparOrdenes([itemB('IO9', 'a', {}, 'G', '2026-10-25'), itemB('IO10', 'b', {}, 'G', '2026-10-27'), itemB('IO100', 'c', {}, 'G', '2026-10-27'), itemB('IO8', 'd', {}, 'G', '2026-10-26')], { masNuevasPrimero: true });
check('con masNuevasPrimero cada grupo va del día más nuevo al más antiguo y, el mismo día, el código mayor primero', ordenado[0].items.map((i) => i.orden.codigo), ['IO100', 'IO10', 'IO8', 'IO9']);
check('sin la opción el orden sigue siendo del más antiguo al más nuevo (Finanzas no cambia)', agruparOrdenes([itemB('IO9', 'a', {}, 'G', '2026-10-25'), itemB('IO10', 'b', {}, 'G', '2026-10-27')])[0].items.map((i) => i.orden.codigo), ['IO9', 'IO10']);

// --- Validación de NAP y lo escalado a infraestructura: cuentan en la revisión, lo escalado con una alerta ---
const vnOrden = orden({ tipoTrabajo: 'VALIDACION NAP', cobroTipo: 'EXONERADO', tecnico: 'REINEL' });
const marcaInfra = (extra) => ({ activa: false, motivo: 'Falta un splitter en el poste.', por: 'rcova', origen: 'OFICINA', en: DIA(27), tecnico: 'GERARDO', ...extra });
const escCerrada = averia({ tecnico: '', infraestructura: marcaInfra({ resultado: 'CERRADA', nota: 'Se instaló el splitter.' }) });
const escEsperando = averia({ estado: 'PENDIENTE', finalizadoEn: null, infraestructura: marcaInfra({ activa: true }) });
const escCancelada = averia({ estado: 'CANCELADO', canceladaEn: DIA(27), finalizadoEn: null, infraestructura: marcaInfra({ resultado: 'DEVUELTA' }) });
const avisos = revisar(itemsParaRevisar({ ordenes: [vnOrden, escCerrada, escEsperando, escCancelada, ave], rango }), {});
const avisoDe = (codigo) => avisos.find((i) => i.orden.codigo === codigo);
check('la validación de NAP y lo escalado (terminado o no) entran a la revisión; lo cancelado no', avisos.map((i) => [i.orden.codigo, i.concepto, i.tecnico, Boolean(i.escalada)]).sort(),
  [[vnOrden.codigo, 'VALIDACION_NAP', 'REINEL', false], [escCerrada.codigo, 'TRABAJO_ADICIONAL', SIN_TECNICO, true], [escEsperando.codigo, null, 'GERARDO', true], [ave.codigo, 'AVERIA', 'GERARDO', false]].sort());
check('lo escalado sin terminar no se aprueba hasta elegirle el concepto; el que no tiene técnico, hasta corregirlo', [motivoNoAprobable(avisoDe(escEsperando.codigo)), motivoNoAprobable(avisoDe(escCerrada.codigo))],
  ['Elige el concepto con que se paga (Corregir).', 'La orden no tiene técnico: corrígelo antes de aprobarla.']);
const loteInfra = aprobarPendientes(avisos, { por: 'admin', ahora: 1 });
check('aprobar todas las pendientes deja fuera lo escalado (se aprueba una por una) y aprueba lo demás', [loteInfra.documentos.map((d) => d.id).sort(), loteInfra.omitidas.filter((o) => o.escalada).map((o) => o.item.orden.codigo).sort()],
  [[vnOrden, ave].map((o) => claveOrden(o)).sort(), [escCerrada.codigo, escEsperando.codigo].sort()]);
const esperaConcepto = armarRevision(avisoDe(escEsperando.codigo), 'PENDIENTE', { por: 'admin', ahora: 2, correccion: { tecnico: '', concepto: 'AVERIA' } });
const esperaCorregida = revisar(itemsParaRevisar({ ordenes: [escEsperando], rango }), { [esperaConcepto.id]: esperaConcepto.datos })[0];
check('el administrador le elige el concepto a lo escalado y entonces se puede aprobar, ya con su alerta', [esperaCorregida.concepto, motivoNoAprobable(esperaCorregida), armarRevision(esperaCorregida, 'APROBAR', { por: 'admin', ahora: 3 }).error, Boolean(esperaCorregida.escalada)], ['AVERIA', '', undefined, true]);
const aprobadaVn = armarRevision(avisoDe(vnOrden.codigo), 'APROBAR', { por: 'admin', ahora: 4 });
check('una validación de NAP aprobada llega a Finanzas con su concepto', paraFinanzas(revisar(itemsParaRevisar({ ordenes: [vnOrden], rango }), { [aprobadaVn.id]: aprobadaVn.datos })).map((i) => [i.orden.codigo, i.concepto]), [[vnOrden.codigo, 'VALIDACION_NAP']]);

const itemEsc = avisoDe(escCerrada.codigo);
check('la firma de lo escalado cambia si cambia su estado en infraestructura; la de una orden normal no lleva nada extra', [
  firmaDeItem({ ...itemEsc, escalada: { ...itemEsc.escalada, resultado: 'DEVUELTA' } }) !== firmaDeItem(itemEsc),
  firmaDeItem({ ...itemEsc, escalada: null }) === firmaDeItem({ ...itemEsc, escalada: undefined }),
], [true, true]);
check('el texto de la alerta dice cuándo, quién, cómo va y el motivo', textoEscaladaRevision(itemEsc), 'Escalada a infraestructura el 27/10 por rcova. Se cerró como trabajo adicional (TA). Motivo: Falta un splitter en el poste. Nota: Se instaló el splitter.');
check('la alerta de una escalada sin terminar avisa que sigue esperando; una orden normal no tiene alerta', [textoEscaladaRevision(avisoDe(escEsperando.codigo)), textoEscaladaRevision(avisoDe(ave.codigo))],
  ['Escalada a infraestructura el 27/10 por rcova. Sigue esperando a infraestructura: todavía no está terminada. Motivo: Falta un splitter en el poste.', null]);


// --- Lo que Revisión lee de Firestore: cambiar de periodo no debe cambiarlo (cada cambio cobra de nuevo todos los documentos de la ventana) ---
const AHORA_LECTURA = Date.parse('2026-11-09T12:00:00-04:00');
const ventanaPendientes = rangoPorRevisar(AHORA_LECTURA);
check('la ventana de Pendientes son los últimos 35 días', ventanaPendientes, { desde: '2026-10-06', hasta: '2026-11-09' });
check('Pendientes, Hoy, 7 días y Este mes leen exactamente lo mismo (pasar de uno a otro no vuelve a leer)',
  [ventanaPendientes, rangoDe('HOY', null, AHORA_LECTURA), rangoDe('7_DIAS', null, AHORA_LECTURA), rangoDe('MES', null, AHORA_LECTURA)].map((r) => rangoDeLectura(r, AHORA_LECTURA)),
  [ventanaPendientes, ventanaPendientes, ventanaPendientes, ventanaPendientes]);
check('un Rango dentro de los 35 días tampoco cambia lo que se lee', rangoDeLectura({ desde: '2026-10-20', hasta: '2026-10-25' }, AHORA_LECTURA), ventanaPendientes);
check('un Rango que empieza antes amplía la lectura solo por ese lado', rangoDeLectura({ desde: '2026-09-20', hasta: '2026-10-02' }, AHORA_LECTURA), { desde: '2026-09-20', hasta: '2026-11-09' });
check('un Rango que empieza antes y llega a hoy amplía solo el inicio', rangoDeLectura({ desde: '2026-10-01', hasta: '2026-11-09' }, AHORA_LECTURA), { desde: '2026-10-01', hasta: '2026-11-09' });


// --- Revisión se queda leyendo mientras la sesión siga abierta: entrar de nuevo a Revisión, o cambiar de periodo, no debe volver a leer lo que ya se lee ---
const dia35 = { desde: '2026-10-06', hasta: '2026-11-09' };
const leyendo = { uid: 'u1', dia: '2026-11-09', ventana: dia35 };
check('ensancharRango: sin ventana previa es el periodo pedido; con ventana, la unión sin huecos', [ensancharRango(null, { desde: '2026-11-01', hasta: '2026-11-09' }), ensancharRango(dia35, { desde: '2026-11-09', hasta: '2026-11-09' }), ensancharRango(dia35, { desde: '2026-09-20', hasta: '2026-10-02' })],
  [{ desde: '2026-11-01', hasta: '2026-11-09' }, dia35, { desde: '2026-09-20', hasta: '2026-11-09' }]);
check('la primera vez hay que empezar a leer lo pedido', planDeLectura(null, { uid: 'u1', hoy: '2026-11-09', rango: dia35 }), { cambiar: true, ventana: dia35, conservarDatos: false });
check('volver a entrar con la misma ventana no cambia nada', planDeLectura(leyendo, { uid: 'u1', hoy: '2026-11-09', rango: dia35 }).cambiar, false);
check('pedir un periodo más corto, dentro de lo que ya se lee, tampoco cambia nada (y no encoge la ventana)', planDeLectura(leyendo, { uid: 'u1', hoy: '2026-11-09', rango: { desde: '2026-11-09', hasta: '2026-11-09' } }), { cambiar: false, ventana: dia35, conservarDatos: true });
check('pedir algo fuera de lo que se lee amplía la ventana y conserva lo leído mientras llega lo nuevo', planDeLectura(leyendo, { uid: 'u1', hoy: '2026-11-09', rango: { desde: '2026-09-20', hasta: '2026-10-02' } }), { cambiar: true, ventana: { desde: '2026-09-20', hasta: '2026-11-09' }, conservarDatos: true });
check('otro usuario empieza de cero: no hereda la ventana ni los datos', planDeLectura(leyendo, { uid: 'u2', hoy: '2026-11-09', rango: { desde: '2026-11-01', hasta: '2026-11-09' } }), { cambiar: true, ventana: { desde: '2026-11-01', hasta: '2026-11-09' }, conservarDatos: false });
check('al cambiar el día la ventana vuelve a ser la pedida (no se ensancha para siempre), conservando los datos mientras tanto', planDeLectura(leyendo, { uid: 'u1', hoy: '2026-11-10', rango: { desde: '2026-10-07', hasta: '2026-11-10' } }), { cambiar: true, ventana: { desde: '2026-10-07', hasta: '2026-11-10' }, conservarDatos: true });
check('tras un error (ventana en null) se vuelve a leer', planDeLectura({ ...leyendo, ventana: null }, { uid: 'u1', hoy: '2026-11-09', rango: dia35 }).cambiar, true);


// --- Cómo sabe Revisión qué está pagado sin leerlo todo cada vez: el pagoId lleva la hora, la caché aporta lo conocido y el servidor confirma con un conteo ---
const INICIO = marcadorDeInicio('2026-10-06');
check('el inicio de la ventana es la hora en que empieza ese día en Caracas, en ms', [INICIO, Number(INICIO) === Date.parse('2026-10-06T04:00:00Z'), marcadorDeInicio('basura')], ['1791259200000', true, '']);
check('los pagoId de pagos hechos después del inicio ordenan después del marcador (texto de 13 dígitos)', ['1793652152321-EDGAR' >= INICIO, '1791259199999-EDGAR' >= INICIO], [true, false]);
const conocidas = new Map([['a', '1793652152321-EDGAR'], ['b', '1794264175401-EDGAR'], ['c', '1793700000000-LUIS']]);
check('sin nada conocido se pide desde el inicio de la ventana', marcadorDeLectura(new Map(), INICIO), INICIO);
check('con lo conocido se pide desde el pago más reciente (se vuelve a pedir ese mismo)', marcadorDeLectura(conocidas, INICIO), '1794264175401-EDGAR');
check('un pago conocido más viejo que la ventana no mueve el marcador', marcadorDeLectura(new Map([['x', '1700000000000-EDGAR']]), INICIO), INICIO);
check('pagadas = lo conocido más lo que llega en vivo, sin repetir', idsPagadas(new Map([['a', 'p1'], ['b', 'p2']]), new Map([['b', 'p2'], ['c', 'p3']]), new Map(), []).sort(), ['a', 'b', 'c']);
check('una orden con el pago anulado (otra vez aprobada sin pagar) deja de figurar pagada aunque la caché la recuerde', idsPagadas(new Map([['a', 'p1'], ['b', 'p2']]), new Map(), new Map(), ['a']), ['b']);
check('una revisión retenida o excluida que conserva su pago cuenta como pagada si es de la ventana', idsPagadas(new Map(), new Map(), new Map([['r', '1793700000000-LUIS'], ['vieja', '1700000000000-LUIS']]), [], INICIO), ['r']);
check('el conteo del servidor coincide solo si no falta ni sobra ninguna', [pagadasCoinciden(118, 118), pagadasCoinciden(118, 117), pagadasCoinciden(118, 119), pagadasCoinciden('118', 118)], [true, false, false, true]);
check('el aviso de órdenes ya pagadas dice cuáles', [mensajeDePagadas(['AO268']), mensajeDePagadas(['AO268', 'AO270', 'IO101', 'AN1', 'AN2'])], [
  'La orden AO268 ya está pagada: no se puede cambiar. Se actualizó la lista.',
  '5 de esas órdenes ya estaban pagadas (AO268, AO270, IO101, AN1...): no se pueden cambiar. Se actualizó la lista.',
]);

// --- Barrera del pago del cliente: no se aprueba hasta que el técnico (o la oficina por él) registre el pago ---
const NOV = (d) => Date.UTC(2026, 10, d, 16, 0, 0);
const rangoNov = { desde: '2026-11-10', hasta: '2026-11-20' };
const finNov = (extra) => orden({ createdAt: NOV(11), finalizadoEn: NOV(12), ...extra });
const instNov = finNov({ codigo: 'IN1' });
const instConPago = finNov({ codigo: 'IN2', pagoCliente: { tipo: 'PAGO', pago: { moneda: 'BS', forma: 'Efectivo', monto: 10, banco: '', cuentaEmpresa: '', referencia: '', pagadoEn: NOV(12) }, nota: '', compartidoCon: null, monedaDistinta: false, diferencia: false, registradoPor: 'tecnico1', registradoEn: NOV(12) } });
const aveNov = finNov({ codigo: 'AV1', tipoTrabajo: 'AVERÍA', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' });
const aveExonerada = finNov({ codigo: 'AV2', tipoTrabajo: 'AVERÍA', cobroBs: null, cobroTipo: 'EXONERADO' });
const aveSinCobro = finNov({ codigo: 'AV3', tipoTrabajo: 'AVERÍA' });
const itemsNov = revisar(itemsParaRevisar({ ordenes: [instNov, instConPago, aveNov, aveExonerada, aveSinCobro, inst], rango: rangoNov }), {});
const deNov = (codigo) => itemsNov.find((i) => i.orden.codigo === codigo);
check('la barrera frena a la instalación y a la orden con cobro sin pago; no a las que ya traen el pago, exoneradas, sin cobro ni anteriores a la fecha', ['IN1', 'IN2', 'AV1', 'AV2'].map((c) => Boolean(motivoSinPago(deNov(c)))).concat(Boolean(motivoSinPago({ orden: aveSinCobro }))), [true, false, true, false, false]);
check('el motivo dice quién debe registrarlo', motivoSinPago(deNov('IN1')), 'Falta el pago del cliente: lo registra el técnico (GERARDO). Si no puede, regístralo tú.');
check('una orden anterior a la fecha de inicio del pago no se frena', motivoSinPago({ orden: { ...inst, finalizadoEn: DIA(27) } }), '');
check('aprobar una orden sin pago da el error y no guarda nada', armarRevision(deNov('IN1'), 'APROBAR', { por: 'admin', ahora: 5 }).error, 'Falta el pago del cliente: lo registra el técnico (GERARDO). Si no puede, regístralo tú.');
check('con el pago registrado se aprueba', armarRevision(deNov('IN2'), 'APROBAR', { por: 'admin', ahora: 5 }).datos?.estado, 'APROBADA');
check('retener y excluir no necesitan el pago', ['RETENER', 'EXCLUIR'].map((a) => armarRevision(deNov('IN1'), a, { por: 'admin', ahora: 5, motivo: 'Prueba' }).datos?.estado), ['RETENIDA', 'EXCLUIDA']);
const loteNov = aprobarPendientes(itemsNov, { por: 'admin', ahora: 6 });
check('aprobar de golpe deja fuera las que esperan el pago y dice por qué', [loteNov.documentos.map((d) => d.datos.codigo).sort(), loteNov.omitidas.filter((o) => o.sinPago).map((o) => o.item.orden.codigo).sort()], [['AV2', 'AV3', 'IN2', 'IO1'].filter((c) => loteNov.documentos.some((d) => d.datos.codigo === c)).sort(), ['AV1', 'IN1']]);
const aprobadaSinPago = { ...deNov('IN1'), estadoRevision: 'APROBADA', concepto: 'INSTALACION' };
check('lo que ya estaba aprobado sigue llegando a Finanzas aunque la orden no traiga el pago (la barrera es solo para aprobar)', paraFinanzas([aprobadaSinPago]).length, 1);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
