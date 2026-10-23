// Prueba la barrera de revisión de pagos (src/utils/revisionPagos.js): qué se revisa, la firma que invalida una aprobación cuando la orden cambia, las acciones del administrador
// (aprobar, retener, excluir, corregir), qué pasa a Finanzas y los resúmenes. No necesita el emulador. Uso: `node scripts/test-revision-pagos.mjs`.
import { SIN_TECNICO, claveOrden, tarifasCompletas } from '../src/utils/finanzas.js';
import {
  aprobarPendientes, armarRevision, firmaDeItem, itemsParaRevisar, motivoNoAprobable, paraFinanzas, parseMotivoRevision, resumenRevision, revisar,
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

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
