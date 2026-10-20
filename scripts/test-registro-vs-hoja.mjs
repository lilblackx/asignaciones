// Comprueba que el Registro de estadísticas da EXACTAMENTE las cifras de la hoja de cálculo del departamento (octubre 2026): se arman órdenes que
// reproducen cada total de la hoja y se exige que el cálculo de la app dé el mismo número. Si una fórmula cambia, esta prueba falla.
//   Visitas:       EX 5, AC 3, NR 2, GA 0, VN 0, TA 0; total 10; pagadas a técnico 8; total atendido 8; azul 3, verde 5, drop 435.
//   Averías:       EX 72, AC 92, NR 22, GA 0, low signal 0; pagadas 164; total 186; SM 20, MTV 5, MR 3, MRTV 0; azul 29, verde 105, drop 5865.
//   Instalaciones: F 77, NR 6, total 83; plan 200 Mbps 68, 1 GB 3, 400 Mbps 0, 100 Mbps 0; SM 48, MTV 2, MR 25, MRTV 2; drop 11599.
// Uso: `npm run test:hoja`.
import {
  MATERIALES, armarHoja, cantidadDeMaterial, columnasDetalleMaterial, columnasNoRealizadas, filaDetalleMaterial, filaNoRealizada, ordenesConMaterial, ordenesDeCifra, ordenesNoRealizadas, columnasDetalleOrdenes, filaDetalleOrden,
} from '../src/utils/reporteMensual.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const HORA = 3600000;
const DIA = Date.UTC(2026, 9, 15, 16, 0, 0); // 15 de octubre de 2026, mediodía en Caracas
const RANGO = { desde: '2026-10-01', hasta: '2026-10-31' };
let n = 0;
const orden = (extra) => { n += 1; return { id: `o${n}`, codigo: `X${n}`, nombre: `Cliente ${n}`, cedula: `1000${n}`, tipoDocumento: 'V', tecnico: 'EDGAR', estado: 'FINALIZADO', createdAt: DIA, finalizadoEn: DIA + 3 * HORA, ...extra }; };
const exonerada = (extra) => orden({ cobroTipo: 'EXONERADO', ...extra });
const cobrada = (extra) => orden({ cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', ...extra });
const cancelada = (extra) => orden({ estado: 'CANCELADO', finalizadoEn: undefined, motivoCancelacion: 'Cliente cancela', canceladaEn: DIA + HORA, ...extra });
const veces = (cantidad, fabrica) => Array.from({ length: cantidad }, (_, i) => fabrica(i));

// ================= VISITAS =================
// 5 exoneradas, 3 cobradas (con el material de la hoja: azul 3, verde 5, drop 435) y 2 no realizadas.
const visitas = [
  ...veces(5, () => exonerada({ tipoTrabajo: 'MUDANZA', falla: 'Mudanza' })),
  cobrada({ tipoTrabajo: 'MUDANZA', tipoVisita: 'RECABLEADO', metrosCable: 250, conectorExterno: 'VERDE', conectorInterno: 'AZUL' }),
  cobrada({ tipoTrabajo: 'RETIRO EQUIPO', tipoVisita: 'RECABLEADO', metrosCable: 185, conectorExterno: 'VERDE', conectorInterno: 'AZUL' }),
  cobrada({ tipoTrabajo: 'MUDANZA', tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 3, azul: 1 } }),
  ...veces(2, () => cancelada({ tipoTrabajo: 'RETIRO EQUIPO' })),
];
const hojaVisitas = armarHoja('VISITAS', visitas, RANGO);
const eV = hojaVisitas.estadistica;
check('VISITAS: EX 5, AC 3, NR 2, GA 0', [eV.ex, eV.ac, eV.nr, eV.ga], [5, 3, 2, 0]);
check('VISITAS: total visitas 10', eV.totalVisitas, 10);
check('VISITAS: pagadas a técnico 8', eV.pagadas, 8);
check('VISITAS: total atendido 8 (igual que pagadas)', hojaVisitas.filasEstadistica.at(-1), ['', 'TOTAL ATENDIDO', '8']);
check('VISITAS: equipos 0; azul 3, verde 5, drop 435', eV.materiales, { SM: 0, MTV: 0, MR: 0, MRTV: 0, azul: 3, verde: 5, drop: 435 });
check('VISITAS: el cuadro no trae VN ni TA', hojaVisitas.filasEstadistica.map((f) => f[0]).filter(Boolean), ['EX', 'AC', 'NR', 'GA']);
check('VISITAS: la lista trae las 10 órdenes', hojaVisitas.lista.length, 10);

// ================= AVERÍAS =================
// 72 exoneradas + 92 cobradas + 22 no realizadas = 186. Dentro de las cobradas y exoneradas va todo el material de la hoja:
//   20 cambios de equipo SM, 5 MTV, 3 MR; 15 recableados de 391 m (verde+azul: 15 y 15); 14 visitas de conector azul; 30 visitas de conector de 3 verdes.
const averia = (extra) => ({ tipoTrabajo: 'AVERÍA', falla: 'LOS', ...extra });
const cambio = (equipo) => cobrada({ tipoTrabajo: 'CAMBIO DE EQUIPO', falla: equipo, tipoVisita: 'CAMBIO_EQUIPO' });
const materialAverias = [
  ...veces(20, () => cambio('SM')), ...veces(5, () => cambio('MTV')), ...veces(3, () => cambio('MR')),
  ...veces(15, () => cobrada(averia({ tipoVisita: 'RECABLEADO', metrosCable: 391, conectorExterno: 'VERDE', conectorInterno: 'AZUL' }))),
  ...veces(14, () => cobrada(averia({ tipoVisita: 'CONECTOR_INTERNO', conectoresUsados: { verde: 0, azul: 1 } }))),
  ...veces(30, () => exonerada(averia({ tipoVisita: 'CONECTOR_EXTERNO', conectoresUsados: { verde: 3, azul: 0 } }))),
];
// Cobradas con material: 20 + 5 + 3 + 15 + 14 = 57; exoneradas con material: 30. Completan: 92 − 57 = 35 cobradas y 72 − 30 = 42 exoneradas.
const averias = [
  ...materialAverias,
  ...veces(35, () => cobrada(averia({ falla: 'Verificación de servicio' }))),
  ...veces(42, () => exonerada(averia({ falla: 'Verificación de servicio' }))),
  ...veces(22, () => cancelada(averia())),
];
const hojaAverias = armarHoja('AVERIAS', averias, RANGO);
const eA = hojaAverias.estadistica;
check('AVERÍAS: EX 72, AC 92, NR 22', [eA.ex, eA.ac, eA.nr], [72, 92, 22]);
check('AVERÍAS: garantía 0 y low signal 0', [eA.ga, eA.lowSignal], [0, 0]);
check('AVERÍAS: pagadas a técnico 164', eA.pagadas, 164);
check('AVERÍAS: total averías 186', eA.totalAverias, 186);
check('AVERÍAS: SM 20, MTV 5, MR 3, MRTV 0; azul 29, verde 105, drop 5865', eA.materiales, { SM: 20, MTV: 5, MR: 3, MRTV: 0, azul: 29, verde: 105, drop: 5865 });
check('AVERÍAS: la lista trae las 186 órdenes', hojaAverias.lista.length, 186);
check('AVERÍAS: un low signal cuenta aparte pero ya está dentro de EX/AC/NR (no suma al total)', (() => {
  const e = armarHoja('AVERIAS', [...averias, exonerada({ tipoTrabajo: 'LOW SIGNAL', falla: '' })], RANGO).estadistica;
  return [e.lowSignal, e.totalAverias, e.ex];
})(), [1, 187, 73]);

// ================= INSTALACIONES =================
// 77 finalizadas (68 de 200 Mbps, 3 de 1 GB y 6 sin plan reconocido; 48 SM, 2 MTV, 25 MR, 2 MRTV; 11599 m de drop) y 6 no realizadas.
const plantilla = (plan) => (plan ? `*Cliente:* x\n*Plan a contratar:* ${plan}` : '');
const planes = [...veces(68, () => '200 Mbps'), ...veces(3, () => '1 GB'), ...veces(6, () => '')];
const equipos = [...veces(48, () => 'SM'), ...veces(2, () => 'MTV'), ...veces(25, () => 'MR'), ...veces(2, () => 'MRTV')];
const instalaciones = [
  ...planes.map((plan, i) => orden({ tipoTrabajo: 'INSTALACIÓN', falla: equipos[i], plantillaOriginal: plantilla(plan), instalacion: { metraje: i === 0 ? 199 : 150, conectores: { externo: { verde: 1 }, interno: { verde: 0, azul: 0 } } } })),
  ...veces(6, () => cancelada({ tipoTrabajo: 'INSTALACIÓN', falla: 'MR' })),
];
const hojaInst = armarHoja('INSTALACIONES', instalaciones, RANGO);
const eI = hojaInst.estadistica;
check('INSTALACIONES: F 77, NR 6, total 83', [eI.f, eI.nr, eI.total], [77, 6, 83]);
check('INSTALACIONES: plan 200 Mbps 68, 1 GB 3, 400 Mbps 0, 100 Mbps 0', [eI.planes['200 Mbps'], eI.planes['1 GB'], eI.planes['400 Mbps'], eI.planes['100 Mbps']], [68, 3, 0, 0]);
check('INSTALACIONES: SM 48, MTV 2, MR 25, MRTV 2', [eI.materiales.SM, eI.materiales.MTV, eI.materiales.MR, eI.materiales.MRTV], [48, 2, 25, 2]);
check('INSTALACIONES: drop 11599', eI.materiales.drop, 11599);
check('INSTALACIONES: la lista trae las 83 órdenes', hojaInst.lista.length, 83);

// ================= Cada orden cuenta en UNA sola hoja =================
const todas = [...visitas, ...averias, ...instalaciones];
const enHojas = ['VISITAS', 'AVERIAS', 'INSTALACIONES'].map((h) => armarHoja(h, todas, RANGO).lista.length);
check('las órdenes se reparten sin repetirse ni perderse entre las hojas (10 + 186 + 83)', [enHojas, enHojas.reduce((a, b) => a + b, 0), todas.length], [[10, 186, 83], 279, 279]);

// ================= El detalle suma lo mismo que las tablas =================
// Al pulsar una cifra o un material se abre el detalle de las órdenes: tiene que cuadrar exacto con el número que se pulsó.
for (const [nombre, hoja] of [['VISITAS', hojaVisitas], ['AVERÍAS', hojaAverias], ['INSTALACIONES', hojaInst]]) {
  const porMaterial = Object.fromEntries(MATERIALES.map(({ id }) => [id, hoja.lista.reduce((suma, t) => suma + cantidadDeMaterial(t, id), 0)]));
  check(`${nombre}: la suma del detalle de cada material es la cantidad de la tabla`, porMaterial, hoja.estadistica.materiales);
  check(`${nombre}: cada fila del detalle de material trae una celda por columna`, MATERIALES.every(({ id }) => ordenesConMaterial(hoja.lista, id).every((t) => filaDetalleMaterial(t, id).length === columnasDetalleMaterial(id).length)), true);
  check(`${nombre}: el detalle de no realizadas tiene tantas órdenes como la cifra NR`, [ordenesNoRealizadas(hoja.lista).length, ordenesNoRealizadas(hoja.lista).every((t) => filaNoRealizada(t).length === columnasNoRealizadas().length)], [hoja.estadistica.nr, true]);
}
for (const [nombre, hoja] of [['VISITAS', hojaVisitas], ['AVERÍAS', hojaAverias], ['INSTALACIONES', hojaInst]]) {
  const conId = hoja.cifras.filter((c) => c.id && c.id !== 'DROP');
  check(`${nombre}: al pulsar cada cifra (${conId.map((c) => c.id).join(', ')}) el detalle trae tantas órdenes como el número`, conId.map((c) => [c.id, ordenesDeCifra(hoja.hoja, c.id, hoja.lista).length === c.valor]), conId.map((c) => [c.id, true]));
  check(`${nombre}: cada fila del detalle de una cifra trae una celda por columna`, hoja.lista.every((t) => filaDetalleOrden(t, hoja.hoja).length === columnasDetalleOrdenes().length), true);
}
check('INSTALACIONES: pulsar Drop trae las órdenes que tienen metraje', ordenesDeCifra('INSTALACIONES', 'DROP', hojaInst.lista).length, 77);
check('VISITAS: el detalle de "Total visitas" no incluye garantías ni las sin cobro registrado', (() => {
  const lista = [...visitas, exonerada({ tipoTrabajo: 'GARANTIA' }), orden({ tipoTrabajo: 'MUDANZA' })];
  return ordenesDeCifra('VISITAS', 'TOTAL', lista).length;
})(), 10);
check('AVERÍAS: el detalle de SM trae las 20 órdenes de cambio de equipo SM, con su serial', (() => {
  const ordenes = ordenesConMaterial(hojaAverias.lista, 'SM');
  return [ordenes.length, filaDetalleMaterial({ ...ordenes[0], serialEquipo: 'HWTC1A2B3C4D' }, 'SM').at(-1)];
})(), [20, 'HWTC1A2B3C4D']);
check('AVERÍAS: el detalle de drop trae las 15 órdenes con 391 m', (() => {
  const ordenes = ordenesConMaterial(hojaAverias.lista, 'drop');
  return [ordenes.length, filaDetalleMaterial(ordenes[0], 'drop').at(-1)];
})(), [15, '391 m']);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron: el Registro de estadísticas da las mismas cifras que la hoja de octubre.');
