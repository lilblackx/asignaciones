// Prueba las hojas del mes (src/utils/reporteMensual.js): a qué hoja y a qué TIPO va cada orden y la estadística de visitas, con las
// mismas fórmulas de la hoja de cálculo del departamento. No necesita el emulador.
// Uso: `npm run test:mensual`.
import { documentoRegistroEstadisticas } from '../src/utils/modelosReporte.js';
import { csvDeDocumento } from '../src/utils/csvReporte.js';
import {
  armarHoja, columnasVisitas, culminadaEn, equipoDe, estadisticaAverias, estadisticaInstalaciones, filasEstadisticaAverias, estadisticaVisitas, filaInstalacion, filaVisita, filasEstadisticaVisitas, hojaDe,
  horasMinSeg, observacionDeAveria, ordenesDeHoja, planDe, procesoDeInstalacion, tipoDeAveria, tipoDeVisita,
} from '../src/utils/reporteMensual.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// 2 de octubre de 2026, mediodía en Caracas (UTC-4).
const DIA = Date.UTC(2026, 9, 2, 16, 0, 0);
const HORA = 3600000;
let n = 0;
const orden = (extra) => ({ id: `o${++n}`, codigo: `VO${n}`, nombre: `Cliente ${n}`, cedula: '12345678', tipoDocumento: 'V', tecnico: 'EDGAR', tipoTrabajo: 'MUDANZA', estado: 'FINALIZADO', createdAt: DIA, finalizadoEn: DIA + 3 * HORA + 51 * 60000, ...extra });
const exonerada = (extra) => orden({ cobroTipo: 'EXONERADO', ...extra });
const cobrada = (extra) => orden({ cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', ...extra });
const cancelada = (extra) => orden({ estado: 'CANCELADO', finalizadoEn: undefined, ...extra });
const escalada = (extra) => orden({ cobroTipo: null, infraestructura: { activa: false, resultado: 'CERRADA', motivo: 'Falta un poste', por: 'ana', origen: 'OFICINA', en: DIA + HORA, tecnico: 'EDGAR' }, ...extra });

// --- A qué hoja y a qué TIPO va cada orden ---
check('una mudanza es de la hoja de visitas', hojaDe(orden()), 'VISITAS');
check('una garantía es de la hoja de visitas; una validación de NAP, de la hoja manual de VN y TA (no entra en las otras)', [hojaDe(orden({ tipoTrabajo: 'GARANTIA' })), hojaDe(orden({ tipoTrabajo: 'VALIDACION NAP' }))], ['VISITAS', 'VNTA']);
check('una avería es de la hoja de averías', hojaDe(orden({ tipoTrabajo: 'AVERÍA' })), 'AVERIAS');
check('un cambio de equipo y un low signal son de averías', [hojaDe(orden({ tipoTrabajo: 'CAMBIO DE EQUIPO' })), hojaDe(orden({ tipoTrabajo: 'LOW SIGNAL' }))], ['AVERIAS', 'AVERIAS']);
check('una instalación es de la hoja de instalaciones', hojaDe(orden({ tipoTrabajo: 'INSTALACIÓN' })), 'INSTALACIONES');
check('una avería escalada a infraestructura tampoco entra en las hojas que se arman solas', hojaDe(escalada({ tipoTrabajo: 'AVERÍA' })), 'VNTA');
check('TIPO: exonerada = EX, cobrada = AC, cancelada = NR', [tipoDeVisita(exonerada()), tipoDeVisita(cobrada()), tipoDeVisita(cancelada())], ['EX', 'AC', 'NR']);
check('TIPO de visita: garantía = GA aunque esté exonerada', tipoDeVisita(exonerada({ tipoTrabajo: 'GARANTIA' })), 'GA');
check('TIPO: finalizada sin cobro registrado = SC (fuera de la hoja)', tipoDeVisita(orden()), 'SC');

// --- Estadística con los números de la hoja de octubre: 5 EX, 3 AC, 2 NR -> total 10, pagadas 8 ---
const octubre = [...Array(5)].map(() => exonerada()).concat([...Array(3)].map(() => cobrada()), [...Array(2)].map(() => cancelada()));
const e1 = estadisticaVisitas(octubre);
check('EX 5, AC 3, NR 2', [e1.ex, e1.ac, e1.nr], [5, 3, 2]);
check('TOTAL VISITAS = 10', e1.totalVisitas, 10);
check('PAGADAS A TÉCNICO = 8 (y TOTAL ATENDIDO lo mismo)', [e1.pagadas, filasEstadisticaVisitas(e1).at(-1)[2]], [8, '8']);

// --- La garantía es solo informativa: se cuenta en GA y no suma ni resta en EX, en el total ni en las pagadas ---
const e2 = estadisticaVisitas([...octubre, exonerada({ tipoTrabajo: 'GARANTIA' })]);
check('una garantía: GA 1 y EX sigue en 5', [e2.ex, e2.ga], [5, 1]);
check('una garantía no cambia el total de visitas', e2.totalVisitas, 10);
check('una garantía no cambia las pagadas', e2.pagadas, 8);
check('una garantía no entra en AC ni en NR', [e2.ac, e2.nr], [3, 2]);

// --- VN y TA no son visitas: no están en la hoja de visitas ni cuentan en sus resultados ---
const conVnTa = [...octubre, orden({ tipoTrabajo: 'VALIDACION NAP' }), escalada()];
const eVisitasSolas = estadisticaVisitas(ordenesDeHoja(conVnTa, 'VISITAS', { desde: '2026-10-02', hasta: '2026-10-02' }));
check('las órdenes de VN y TA no entran a la lista de visitas', ordenesDeHoja(conVnTa, 'VISITAS', { desde: '2026-10-02', hasta: '2026-10-02' }).length, 10);
check('los resultados de visitas siguen siendo los de siempre (total 10, pagadas 8)', [eVisitasSolas.totalVisitas, eVisitasSolas.pagadas], [10, 8]);
check('las órdenes de VN y TA no se arman en ninguna hoja automática', ['VISITAS', 'AVERIAS', 'INSTALACIONES'].map((h) => ordenesDeHoja(conVnTa, h, { desde: '2026-10-02', hasta: '2026-10-02' }).filter((t) => t.tipoTrabajo === 'VALIDACION NAP' || t.infraestructura).length), [0, 0, 0]);
check('el cuadro de visitas ya no tiene filas de VN ni de TA', filasEstadisticaVisitas(eVisitasSolas).map((f) => f[0]).filter(Boolean), ['EX', 'AC', 'NR', 'GA']);
check('una visita sin cobro registrado se cuenta aparte y no entra en las cuentas', [estadisticaVisitas([...octubre, orden()]).sc, estadisticaVisitas([...octubre, orden()]).totalVisitas], [1, 10]);

// --- Materiales: solo lo finalizado y no escalado ---
const e4 = estadisticaVisitas([
  cobrada({ tipoTrabajo: 'CAMBIO DE EQUIPO', falla: 'MTV' }),
  cobrada({ tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 2, azul: 1 } }),
  cobrada({ tipoVisita: 'RECABLEADO', metrosCable: 40, conectorExterno: 'VERDE' }),
  escalada({ tipoVisita: 'RECABLEADO', metrosCable: 99 }),
]);
check('equipo, conectores por color y drop', e4.materiales, { SM: 0, MTV: 1, MR: 0, MRTV: 0, azul: 1, verde: 3, drop: 40 });
check('el equipo sale de la falla', [equipoDe({ falla: 'mrtv' }), equipoDe({ falla: 'LOS' })], ['MRTV', '']);

// --- El periodo y el técnico ---
const rango = { desde: '2026-10-02', hasta: '2026-10-02' };
const mezcla = [orden(), orden({ tecnico: 'REINEL' }), cancelada(), orden({ estado: 'PENDIENTE', finalizadoEn: undefined }), orden({ createdAt: DIA + 40 * 24 * HORA, finalizadoEn: DIA + 40 * 24 * HORA })];
check('solo cuenta lo finalizado o cancelado del periodo, sin pendientes ni de otro mes', ordenesDeHoja(mezcla, 'VISITAS', rango).length, 3);
check('filtra por técnico', ordenesDeHoja(mezcla, 'VISITAS', rango, { tecnico: 'reinel' }).length, 1);
check('no repite una orden que viene dos veces', ordenesDeHoja([mezcla[0], mezcla[0]], 'VISITAS', rango).length, 1);

// --- La fila de la lista ---
const fila = filaVisita(cobrada({ codigo: 'VO7', tipoTrabajo: 'CAMBIO DE EQUIPO', falla: 'MTV' }), 4);
check('la fila trae tantas celdas como columnas', fila.length, columnasVisitas().length);
check('la fila: N°, ODT, cédula y tipo (la hoja no lleva la columna Entrega)', [fila[0], fila[1], fila[3], fila[11]], ['4', 'VO7', 'V-12345678', 'AC']);
check('la fila: tiempo de respuesta 3:51:00', fila[9], '3:51:00');
check('la fila: el equipo MTV en su columna', fila.slice(12, 16), ['', '1', '', '']);
const filaNr = filaVisita(cancelada(), 5);
check('una NR no tiene horas ni tiempo', [filaNr[5], filaNr[6], filaNr[8], filaNr[9]], ['', '', '', '']);
check('horas, minutos y segundos', [horasMinSeg(4 * HORA + 51 * 60000), horasMinSeg(29 * 60000), horasMinSeg(31 * HORA + 16 * 60000)], ['4:51:00', '0:29:00', '31:16:00']);

// --- Hora culminada: la del técnico (pre-finalizó) y, si no está, la de la oficina (aprobó) ---
const aprobadaTarde = cobrada({ prefinalizadoEn: DIA + 2 * HORA, finalizadoEn: DIA + 30 * HORA });
check('la hora culminada es la del técnico cuando existe', culminadaEn(aprobadaTarde), DIA + 2 * HORA);
check('sin hora del técnico (orden anterior) es la de aprobación', culminadaEn(cobrada({ finalizadoEn: DIA + 5 * HORA })), DIA + 5 * HORA);
check('si la hora del técnico es posterior a la aprobación (dato raro), manda la aprobación', culminadaEn(cobrada({ prefinalizadoEn: DIA + 9 * HORA, finalizadoEn: DIA + 5 * HORA })), DIA + 5 * HORA);
check('una orden no finalizada no tiene hora culminada', culminadaEn(cancelada({ prefinalizadoEn: DIA + HORA })), 0);
const filaTarde = filaVisita(aprobadaTarde, 1);
check('el tiempo de respuesta usa la hora del técnico (2:00:00) y no la de aprobación (30:00:00)', filaTarde[9], '2:00:00');
check('la fecha final también sale de la hora del técnico', filaTarde[8], filaVisita(cobrada({ finalizadoEn: DIA + 2 * HORA }), 1)[8]);
const cruzaMes = cobrada({ prefinalizadoEn: Date.UTC(2026, 9, 31, 20), finalizadoEn: Date.UTC(2026, 10, 1, 14), createdAt: Date.UTC(2026, 9, 31, 12) });
check('una visita que el técnico terminó el 31 y la oficina aprobó el 1 cuenta en octubre', [ordenesDeHoja([cruzaMes], 'VISITAS', { desde: '2026-10-01', hasta: '2026-10-31' }).length, ordenesDeHoja([cruzaMes], 'VISITAS', { desde: '2026-11-01', hasta: '2026-11-30' }).length], [1, 0]);

// --- Hoja de averías ---
const averia = (extra) => orden({ tipoTrabajo: 'AVERÍA', falla: 'LOS', ...extra });
check('TIPO de avería: exonerada = EX, cobrada = AC, cancelada = NR, sin cobro = SC', [tipoDeAveria(averia({ cobroTipo: 'EXONERADO' })), tipoDeAveria(averia({ cobroBs: '5.696' })), tipoDeAveria(averia({ estado: 'CANCELADO' })), tipoDeAveria(averia())], ['EX', 'AC', 'NR', 'SC']);
check('observaciones de una avería: falla y tipo de visita', [observacionDeAveria(averia({ tipoVisita: 'CONECTOR_EXTERNO' })), observacionDeAveria(averia({ tipoVisita: 'RECABLEADO' })), observacionDeAveria(averia({ falla: 'Verificación de servicio' }))], ['LOS / Conector externo', 'LOS / Recableado', 'Verificación de servicio']);
check('observaciones de una reconexión y de un cambio de equipo', [observacionDeAveria(orden({ tipoTrabajo: 'RECONEXIÓN', falla: '' })), observacionDeAveria(orden({ tipoTrabajo: 'CAMBIO DE EQUIPO', falla: 'SM' }))], ['RECONEXIÓN', 'CAMBIO DE EQUIPO / SM']);
const listaAverias = [
  averia({ cobroTipo: 'EXONERADO', tipoVisita: 'CONECTOR_EXTERNO', conectoresUsados: { verde: 1, azul: 0 } }),
  averia({ cobroTipo: 'EXONERADO' }),
  averia({ cobroBs: '5.696', tipoVisita: 'RECABLEADO', metrosCable: 250, conectorExterno: 'VERDE', conectorInterno: 'AZUL' }),
  averia({ cobroBs: '5.696' }),
  orden({ tipoTrabajo: 'CAMBIO DE EQUIPO', falla: 'SM', cobroBs: '30', tipoVisita: 'CAMBIO_EQUIPO' }),
  orden({ tipoTrabajo: 'LOW SIGNAL', falla: '', cobroTipo: 'EXONERADO' }),
  averia({ estado: 'CANCELADO', motivoCancelacion: 'El cliente canceló la visita' }),
];
const eA = estadisticaAverias(listaAverias);
check('averías: EX 3, AC 3, NR 1, total 7, pagadas 6, low signal 1', [eA.ex, eA.ac, eA.nr, eA.totalAverias, eA.pagadas, eA.lowSignal], [3, 3, 1, 7, 6, 1]);
check('averías: materiales (SM, conectores por color y drop)', eA.materiales, { SM: 1, MTV: 0, MR: 0, MRTV: 0, azul: 1, verde: 2, drop: 250 });
check('una avería escalada a infraestructura no cuenta aquí (va a visitas como TA)', ordenesDeHoja([averia({ infraestructura: { activa: false, en: DIA + HORA, motivo: 'x' } })], 'AVERIAS', rango).length, 0);

// La garantía en averías también es solo informativa: no entra en EX, AC, NR, pagadas ni total.
const eAGa = estadisticaAverias([...listaAverias, averia({ falla: 'Garantía', cobroTipo: 'EXONERADO' }), orden({ tipoTrabajo: 'AVERÍA', falla: 'Garantía de equipo', cobroBs: '5.696' })]);
check('averías: dos garantías se cuentan en GA y no cambian EX, AC, NR, pagadas ni total', [eAGa.ga, eAGa.ex, eAGa.ac, eAGa.nr, eAGa.pagadas, eAGa.totalAverias], [2, 3, 3, 1, 6, 7]);
check('averías: el cuadro tiene la fila GA informativa', filasEstadisticaAverias(eAGa).find((f) => f[0] === 'GA'), ['GA', 'Garantía (informativo)', '2']);

// Low signal: siempre cuenta como exonerada (EX) y entra en pagadas a técnico, tenga o no cobro; cancelada es NR.
const lowSignal = (extra) => orden({ tipoTrabajo: 'LOW SIGNAL', falla: '', ...extra });
check('low signal: sin cobro, con cobro y exonerada son EX; cancelada es NR', [tipoDeAveria(lowSignal()), tipoDeAveria(lowSignal({ cobroBs: '5.696' })), tipoDeAveria(lowSignal({ cobroTipo: 'EXONERADO' })), tipoDeAveria(lowSignal({ estado: 'CANCELADO' }))], ['EX', 'EX', 'EX', 'NR']);
const eLs = estadisticaAverias([lowSignal(), lowSignal({ cobroBs: '5.696' }), lowSignal({ cobroTipo: 'EXONERADO' }), averia({ cobroBs: '5.696' }), lowSignal({ estado: 'CANCELADO' })]);
check('low signal: 3 exoneradas, 1 cobrada, 1 no realizada; pagadas 4 y total 5', [eLs.lowSignal, eLs.ex, eLs.ac, eLs.nr, eLs.pagadas, eLs.totalAverias, eLs.sc], [4, 3, 1, 1, 4, 5, 0]);

// --- Hoja de instalaciones ---
const plantilla = (plan) => `*Cliente:* x\n*Plan a contratar:* ${plan}`;
const instalacion = (extra) => orden({ tipoTrabajo: 'INSTALACIÓN', falla: 'MR', plantillaOriginal: plantilla('200 Mbps'), instalacion: { metraje: 120, conectores: { externo: { verde: 1 }, interno: { verde: 1, azul: 1 } } }, ...extra });
check('el plan sale de la plantilla de la promotora', [planDe(instalacion()), planDe(instalacion({ plantillaOriginal: plantilla('PLAN 1GB') })), planDe(instalacion({ plantillaOriginal: plantilla('400 mbps') })), planDe(instalacion({ plantillaOriginal: '' }))], ['200 Mbps', '1 GB', '400 Mbps', '']);
check('PROCESO: F si se finalizó, NR si se canceló', [procesoDeInstalacion(instalacion()), procesoDeInstalacion(instalacion({ estado: 'CANCELADO' })), procesoDeInstalacion(instalacion({ estado: 'PRE-FINALIZADO' }))], ['F', 'NR', '']);
const listaInst = [instalacion(), instalacion({ falla: 'SM' }), instalacion({ plantillaOriginal: plantilla('1 GB'), falla: 'MTV' }), instalacion({ plantillaOriginal: '' }), instalacion({ estado: 'CANCELADO', motivoCancelacion: 'No hay cobertura' })];
const eI = estadisticaInstalaciones(listaInst);
check('instalaciones: 4 finalizadas, 1 no realizada, total 5', [eI.f, eI.nr, eI.total], [4, 1, 5]);
check('instalaciones: planes (el sin plan va aparte, para que cuadre)', eI.planes, { '200 Mbps': 2, '1 GB': 1, '400 Mbps': 0, '100 Mbps': 0, otros: 1 });
check('instalaciones: equipos, drop y conectores solo de lo finalizado', eI.materiales, { SM: 1, MTV: 1, MR: 2, MRTV: 0, azul: 4, verde: 8, drop: 480 });
const filaI = filaInstalacion(instalacion({ codigo: 'IO9' }), 3);
check('la fila de una instalación: ODT, proceso, equipo, plan y drop', [filaI[1], filaI[10], filaI[14], filaI[16], filaI[17]], ['IO9', 'F', '1', '200 Mbps', '120']);
check('la fila de una instalación cancelada lleva el motivo y no el plan', (({ 10: proceso, 11: obs, 16: plan }) => [proceso, obs, plan])(filaInstalacion(instalacion({ estado: 'CANCELADO', motivoCancelacion: 'No hay cobertura' }), 1)), ['NR', 'Cancelada: No hay cobertura', '']);
check('las filas de las hojas traen una celda por columna', ['VISITAS', 'AVERIAS', 'INSTALACIONES'].every((h) => { const x = armarHoja(h, [...octubre, ...listaAverias, ...listaInst], rango); return x.lista.every((t, i) => x.filaLista(t, i + 1).length === x.columnasLista.length && x.filaCompacta(t).length === x.columnasCompacta.length); }), true);

// --- El documento del reporte (pantalla, CSV, PDF y Word) ---
const registrosVnTa = [
  { id: 'r1', codigo: 'VAN01', trabajo: 'VN', tecnico: '', fecha: '2026-10-02', observacion: 'Puertos liberados', operador: 'Renny Cova' },
  { id: 'r2', codigo: 'TA01', trabajo: 'TA', tecnico: 'EDGAR', fecha: '2026-10-02', observacion: 'Apoyo en reparar NAP', operador: 'Cesar Chirino' },
  { id: 'r3', codigo: 'VAN02', trabajo: 'VN', tecnico: 'JOSE', fecha: '2026-10-03', observacion: '', operador: 'Renny Cova' },
];
const ctx = { ordenes: [...octubre, orden({ tipoTrabajo: 'GARANTIA', cobroTipo: 'EXONERADO' }), escalada(), orden(), ...listaAverias, ...listaInst], registrosVnTa, rango, tecnico: '', ahora: DIA, generadoPor: 'ana' };
const doc = documentoRegistroEstadisticas(ctx);
check('el documento se llama "Registro de estadísticas"', doc.titulo, 'Registro de estadísticas');
check('lleva las cuatro hojas, cada una con su sección (la de VN y TA, con lo que se registró a mano)', doc.bloques.filter((b) => b.tipo === 'seccion').map((b) => b.titulo), ['Visitas técnicas', 'Averías', 'Instalaciones', 'VN y TA']);
check('visitas: cuatro cifras (total, pagadas, cobradas y no realizadas)', doc.bloques.find((b) => b.tipo === 'cifras').items.map((i) => i.valor), [10, 8, 3, 2]);
const tablas = doc.bloques.filter((b) => b.tipo === 'tabla');
check('cada fila de cada tabla tiene una celda por columna y son textos', tablas.every((t) => t.filas.every((f) => f.length === t.columnas.length && f.every((c) => typeof c === 'string'))), true);
const completas = tablas.filter((t) => t.soloCsv);
const compactas = tablas.filter((t) => t.noCsv);
check('la hoja completa de cada una: columnas y filas', completas.map((t) => [t.columnas.length, t.filas.length]), [[19, 12], [19, 7], [20, 5]]);
check('la lista resumida (PDF y Word) trae menos columnas y las mismas órdenes', compactas.map((t) => [t.columnas.length < 10, t.filas.length]), [[true, 12], [true, 7], [true, 5]]);
const csv = csvDeDocumento(doc);
check('el CSV lleva las hojas completas y no las resumidas', [csv.includes('Hoja de las visitas'), csv.includes('Hoja de las averías'), csv.includes('Hoja de las instalaciones'), csv.includes('Hoja de VN y TA (3)'), csv.includes('del periodo')], [true, true, true, true, false]);
check('el CSV lleva las filas de VN y TA como se escribieron: ODT, trabajo, técnico, fecha, observación y operador', [csv.includes('VAN01;VALIDACION DE NAP;;02/10/2026;Puertos liberados;Renny Cova'), csv.includes('TA01;TRABAJO ADICIONAL;EDGAR;02/10/2026;Apoyo en reparar NAP;Cesar Chirino')], [true, true]);
check('VN y TA: dos validaciones de NAP y un trabajo adicional, total 3', csv.includes('Validación de NAP;2') && csv.includes('Trabajos adicionales (infra);1') && csv.includes('TOTAL VN + TA;3'), true);
check('VN y TA respeta el técnico elegido arriba', ((t) => [t.length, t[0][0]])(documentoRegistroEstadisticas({ ...ctx, tecnico: 'edgar' }).bloques.find((b) => b.tipo === 'tabla' && b.titulo.startsWith('Hoja de VN y TA')).filas), [1, 'TA01']);
const bloqueVisitas = csv.slice(csv.indexOf('Estadística de visitas técnicas'), csv.indexOf('Materiales de las visitas'));
check('el CSV no repite VN ni TA dentro de la estadística de visitas', [bloqueVisitas.includes('Validación de NAP'), bloqueVisitas.includes('Trabajos adicionales')], [false, false]);
check('el CSV lleva la estadística de pagadas a técnico, sin mostrar la fórmula', [csv.includes('PAGADAS A TÉCNICO;8'), /EX \+ AC/.test(csv)], [true, false]);
check('y un resumen por hoja', ['Resumen de las visitas', 'Resumen de las averías', 'Resumen de las instalaciones'].every((t) => csv.includes(t)), true);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
