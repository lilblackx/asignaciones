// Prueba lo que usa ventas para seguir las órdenes: el filtro por fecha, la marca de atraso, el resumen por promotor y el orden.
// No necesita el emulador. Uso: `npm run test:ventas`.
import { readFileSync } from 'node:fs';
import { csvDeOrdenes, filasExportacion } from '../src/utils/exportarOrdenes.js';
import { PRIMER_MES_TOTALES, etiquetaMes, incrementosDeCierre, incrementosMensuales, mesDe, mesesDeTotales, mesesRecientes, totalesDelMes } from '../src/utils/totalesMes.js';
import { incrementosMensuales as incrementosWorker } from '../cf-worker/src/index.js';
import { formatearCedula } from '../src/utils/cedula.js';
import { FILTROS_FECHA, OPCIONES_ORDEN_DIRECCION, DIRECCION_POR_DEFECTO, claveFiltroFecha, ORDEN_POR_DEFECTO, atrasoOrden, enRangoFecha, estadoParaPromotora, fechaOrden, ordenarOrdenes, resumenPorPromotor, algunaOrdenSalio } from '../src/utils/estadoInstalacion.js';

let failures = 0;
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const DIA = 86400000;
const AHORA = new Date(2026, 9, 14, 15, 0, 0).getTime(); // miércoles 14/10/2026, 3 pm hora local
const inicioHoy = new Date(2026, 9, 14).getTime();
const orden = (t) => {
  const o = { id: 'x', codigo: 'IO1', nombre: 'Ana', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', tecnico: '', createdAt: AHORA, ...t };
  return { ...o, vista: estadoParaPromotora(o, AHORA) };
};

// --- Fecha de la orden y filtro por fecha ---
check('una orden abierta se fecha por cuando se creó; una cerrada, por cuando se cerró', [
  fechaOrden({ estado: 'PENDIENTE', createdAt: 5, finalizadoEn: 9 }),
  fechaOrden({ estado: 'FINALIZADO', createdAt: 5, finalizadoEn: 9 }),
  fechaOrden({ origen: 'historial', estado: 'FINALIZADO', archivadoEn: 7 }),
], [5, 9, 7]);
check('hoy: desde la medianoche', [enRangoFecha(inicioHoy, 'HOY', AHORA), enRangoFecha(inicioHoy - 1, 'HOY', AHORA)], [true, false]);
check('ayer: solo el día anterior', [enRangoFecha(inicioHoy - 1, 'AYER', AHORA), enRangoFecha(inicioHoy - DIA, 'AYER', AHORA), enRangoFecha(inicioHoy, 'AYER', AHORA), enRangoFecha(inicioHoy - DIA - 1, 'AYER', AHORA)], [true, true, false, false]);
check('últimos 7 días: hoy y los 6 anteriores', [enRangoFecha(inicioHoy - 6 * DIA, '7_DIAS', AHORA), enRangoFecha(inicioHoy - 6 * DIA - 1, '7_DIAS', AHORA)], [true, false]);
check('sin fecha solo entra en "todas las fechas"', [enRangoFecha(0, 'TODAS', AHORA), enRangoFecha(0, 'HOY', AHORA)], [true, false]);
check('las opciones de fecha empiezan por "todas"', FILTROS_FECHA[0][0], 'TODAS');

// --- Atraso ---
const atraso = (t) => { const a = atrasoOrden(orden(t), AHORA); return a && [a.nivel, a.texto]; };
check('sin técnico de menos de un día no está atrasada', atraso({ createdAt: AHORA - 20 * 3600000 }), null);
check('sin técnico desde hace un día: aviso', atraso({ createdAt: AHORA - 25 * 3600000 }), ['aviso', 'Sin técnico hace 1 día']);
check('sin técnico desde hace dos días: urgente', atraso({ createdAt: AHORA - 2 * DIA - 3600000 }), ['urgente', 'Sin técnico hace 2 días']);
check('asignada tarda más en marcarse (2 días aviso, 4 urgente)', [
  atraso({ tecnico: 'JOSE', createdAt: AHORA - DIA - 3600000 }),
  atraso({ tecnico: 'JOSE', createdAt: AHORA - 3 * DIA }),
  atraso({ tecnico: 'JOSE', createdAt: AHORA - 4 * DIA - 1000 }),
], [null, ['aviso', 'Sin instalar hace 3 días'], ['urgente', 'Sin instalar hace 4 días']]);
check('una avería LOS asignada dice "sin resolver"', atraso({ tipoTrabajo: 'AVERÍA', falla: 'LOS', tecnico: 'JOSE', createdAt: AHORA - 3 * DIA }), ['aviso', 'Sin resolver hace 3 días']);
check('una programada a futuro nunca está atrasada', atraso({ tecnico: 'JOSE', createdAt: AHORA - 10 * DIA, fechaProgramada: '2026-10-20' }), null);
check('una programada se cuenta desde su fecha, no desde que se creó', atraso({ tecnico: 'JOSE', createdAt: AHORA - 10 * DIA, fechaProgramada: '2026-10-13' }), null);
check('y se marca cuando su fecha ya pasó hace días', atraso({ tecnico: 'JOSE', createdAt: AHORA - 10 * DIA, fechaProgramada: '2026-10-09' }), ['urgente', 'Sin instalar hace 5 días']);
check('en revisión, instalada o cancelada no se marcan', [
  atraso({ estado: 'PRE-FINALIZADO', tecnico: 'JOSE', createdAt: AHORA - 9 * DIA }),
  atraso({ estado: 'FINALIZADO', tecnico: 'JOSE', createdAt: AHORA - 9 * DIA }),
  atraso({ estado: 'CANCELADO', createdAt: AHORA - 9 * DIA }),
], [null, null, null]);

// --- Resumen por promotor ---
const lista = [
  orden({ estado: 'FINALIZADO', promotora: 'Alexis Añez', tecnico: 'A' }),
  orden({ estado: 'FINALIZADO', promotora: 'alexis anez', tecnico: 'A' }),
  orden({ estado: 'PRE-FINALIZADO', promotora: 'Alexis Añez', tecnico: 'A' }),
  orden({ estado: 'PENDIENTE', promotora: 'Alexis Añez' }),
  orden({ estado: 'CANCELADO', promotora: 'Sariana' }),
  orden({ estado: 'FINALIZADO', promotora: 'Sariana', tecnico: 'B' }),
  orden({ estado: 'PENDIENTE', tecnico: 'B' }),
];
const filas = resumenPorPromotor(lista);
check('agrupa a la misma persona aunque cambien mayúsculas o tildes, y ordena por instaladas', filas.map((f) => [f.nombre, f.instaladas, f.enRevision, f.enCurso, f.canceladas, f.total]),
  [['Alexis Añez', 2, 1, 1, 0, 4], ['Sariana', 1, 0, 0, 1, 2], ['Sin promotor', 0, 0, 1, 0, 1]]);
check('las órdenes sin promotor van juntas, con clave vacía', filas.find((f) => f.nombre === 'Sin promotor')?.clave, '');
check('el total del resumen es el de la lista', filas.reduce((n, f) => n + f.total, 0), lista.length);

// --- Orden ---
const a = orden({ id: 'a', createdAt: AHORA - 3 * DIA });
const b = orden({ id: 'b', createdAt: AHORA - DIA, tecnico: 'J' });
const c = orden({ id: 'c', createdAt: 0 });
const d = orden({ id: 'd', estado: 'FINALIZADO', createdAt: AHORA - 5 * DIA, finalizadoEn: AHORA - 2 * 3600000, tecnico: 'J' });
const ids = (l) => l.map((o) => o.id).join('');
const ids2 = (l) => l.map((o) => o.codigo).join(' ');
check('más recientes primero (las sin fecha al final)', ids(ordenarOrdenes([a, b, c, d], 'RECIENTES')), 'dbac');
check('más antiguas primero, y las sin fecha al final', ids(ordenarOrdenes([a, b, c, d], 'ANTIGUAS')), 'abdc');
check('por estado: sin técnico, luego asignada, luego instalada', ids(ordenarOrdenes([d, b, a], 'ESTADO')), 'abd');
check('el orden por defecto es fecha descendente (lo más reciente primero); la urgencia y el estado siguen como opciones', [ORDEN_POR_DEFECTO, DIRECCION_POR_DEFECTO, OPCIONES_ORDEN_DIRECCION.map(([c]) => c)], ['FECHA', 'DESC', ['FECHA:DESC', 'FECHA:ASC', 'CODIGO:ASC', 'CODIGO:DESC', 'URGENCIA:DESC', 'URGENCIA:ASC', 'ESTADO:DESC', 'ESTADO:ASC']]);
check('fecha descendente y ascendente (las sin fecha, al final de las dos)', [ids(ordenarOrdenes([a, b, c, d], 'FECHA', AHORA, 'DESC')), ids(ordenarOrdenes([a, b, c, d], 'FECHA', AHORA, 'ASC'))], ['dbac', 'abdc']);
check('estado ascendente es el orden al revés del descendente', ids(ordenarOrdenes([d, b, a], 'ESTADO', AHORA, 'ASC')), ids(ordenarOrdenes([d, b, a], 'ESTADO', AHORA, 'DESC')).split('').reverse().join(''));
check('urgencia ascendente pone lo menos urgente primero', ids(ordenarOrdenes([d, b, a], 'URGENCIA', AHORA, 'ASC')), ids(ordenarOrdenes([d, b, a], 'URGENCIA', AHORA, 'DESC')).split('').reverse().join(''));
// Un día en concreto del calendario
const diaElegido = new Date(2026, 9, 14, 15, 0).getTime();
const mediaNoche = new Date(2026, 9, 14).getTime();
check('día elegido: entra todo ese día (de la medianoche a la siguiente)', [enRangoFecha(diaElegido, 'DIA:2026-10-14', AHORA), enRangoFecha(mediaNoche, 'DIA:2026-10-14', AHORA), enRangoFecha(mediaNoche + DIA - 1, 'DIA:2026-10-14', AHORA)], [true, true, true]);
check('día elegido: no entran el anterior ni el siguiente, ni las sin fecha', [enRangoFecha(mediaNoche - 1, 'DIA:2026-10-14', AHORA), enRangoFecha(mediaNoche + DIA, 'DIA:2026-10-14', AHORA), enRangoFecha(0, 'DIA:2026-10-14', AHORA)], [false, false, false]);
check('"Elegir un día" sin fecha elegida no filtra; con fecha, filtra ese día; las demás opciones quedan igual', [claveFiltroFecha('DIA', ''), claveFiltroFecha('DIA', '2026-10-14'), claveFiltroFecha('HOY', '2026-10-14')], ['TODAS', 'DIA:2026-10-14', 'HOY']);
// Urgencia: atrasadas (más días primero), sin técnico, asignada, en revisión, instalada y cancelada; dentro de cada grupo la creada antes primero.
const u = (id, t) => orden({ id, ...t });
const surtido = [
  u('cancelada', { estado: 'CANCELADO', createdAt: AHORA - 9 * DIA }),
  u('instalada', { estado: 'FINALIZADO', tecnico: 'J', finalizadoEn: AHORA - 3600000, createdAt: AHORA - 8 * DIA }),
  u('revision', { estado: 'PRE-FINALIZADO', tecnico: 'J', createdAt: AHORA - 3 * DIA }),
  u('asignada-nueva', { tecnico: 'J', createdAt: AHORA - 3600000 }),
  u('asignada-vieja', { tecnico: 'J', createdAt: AHORA - 20 * 3600000 }),
  u('sin-tecnico-nueva', { createdAt: AHORA - 2 * 3600000 }),
  u('sin-tecnico-vieja', { createdAt: AHORA - 20 * 3600000 }),
  u('atrasada-2-dias', { createdAt: AHORA - 2 * DIA - 3600000 }),
  u('atrasada-6-dias', { tecnico: 'J', createdAt: AHORA - 6 * DIA }),
  u('atrasada-3-dias', { createdAt: AHORA - 3 * DIA - 3600000 }),
];
check('urgencia: primero las atrasadas (más días antes), luego sin técnico, asignada, en revisión, instalada y cancelada', ordenarOrdenes(surtido, 'URGENCIA', AHORA).map((o) => o.id),
  ['atrasada-6-dias', 'atrasada-3-dias', 'atrasada-2-dias', 'sin-tecnico-vieja', 'sin-tecnico-nueva', 'asignada-vieja', 'asignada-nueva', 'revision', 'instalada', 'cancelada']);
check('urgencia: en camino, en sitio y programada van justo después de asignada', ordenarOrdenes([
  u('revision', { estado: 'PRE-FINALIZADO', tecnico: 'J' }),
  u('programada', { tecnico: 'J', fechaProgramada: '2026-10-20' }),
  u('en-sitio', { tecnico: 'J', enCamino: { tecnico: 'J', desde: AHORA - 600000, llegoEn: AHORA - 60000 } }),
  u('asignada', { tecnico: 'J' }),
], 'URGENCIA', AHORA).map((o) => o.id), ['asignada', 'en-sitio', 'programada', 'revision']);
check('urgencia: las de historial se ordenan por su fecha de creación y las sin fecha van al final', ordenarOrdenes([
  orden({ id: 'sin-fecha', estado: 'FINALIZADO', createdAt: 0 }),
  { ...orden({ id: 'nueva', estado: 'FINALIZADO' }), createdAt: 0, creadaEn: AHORA - DIA, origen: 'historial' },
  { ...orden({ id: 'vieja', estado: 'FINALIZADO' }), createdAt: 0, creadaEn: AHORA - 5 * DIA, origen: 'historial' },
], 'URGENCIA', AHORA).map((o) => o.id), ['vieja', 'nueva', 'sin-fecha']);
check('el atraso de la tarjeta, el chip "Atrasadas" y el orden salen de la misma función (atrasoOrden)',
  [/atrasoOrden\(orden, ahora\)/.test(leer('../src/components/TarjetaInstalacion.jsx')), /atrasoOrden\(o, ahora\)/.test(leer('../src/components/PromotoraApp.jsx')), /atrasoOrden\(o, ahora\)/.test(leer('../src/utils/estadoInstalacion.js'))], [true, true, true]);
// La prioridad alta (solo en órdenes pendientes) va siempre primero; luego rige el criterio.
const pVieja = orden({ id: 'P', createdAt: AHORA - 9 * DIA, prioridadAlta: true, tecnico: 'J' });
const pNueva = orden({ id: 'Q', createdAt: AHORA - 2 * DIA, prioridadAlta: true });
const cerradaConMarca = orden({ id: 'X', estado: 'FINALIZADO', createdAt: AHORA - 40 * DIA, finalizadoEn: AHORA - 30 * DIA, prioridadAlta: true, tecnico: 'J' });
check('la prioridad alta va primero y, dentro de ella, lo más reciente', ids(ordenarOrdenes([a, pVieja, b, pNueva], 'RECIENTES')), 'QPba');
check('también con "más antiguas" (la prioridad no depende del criterio)', ids(ordenarOrdenes([b, a, pNueva, pVieja], 'ANTIGUAS')), 'PQab');
check('y con urgencia', ids(ordenarOrdenes([a, pNueva, b], 'URGENCIA', AHORA)).startsWith('Q'), true);
check('una orden ya cerrada con la marca de prioridad no sube', ids(ordenarOrdenes([a, cerradaConMarca, b], 'RECIENTES')), 'baX');
check('sin prioridad no cambia nada', ids(ordenarOrdenes([a, b, c, d], 'RECIENTES')), 'dbac');
check('ordenar no modifica la lista original', (() => { const l = [a, b]; ordenarOrdenes(l, 'RECIENTES'); return ids(l); })(), 'ab');

// --- Cédula con prefijo (ventas) ---
check('la cédula lleva su prefijo, el de su tipo de documento o V si no hay', [formatearCedula('12345678', 'V'), formatearCedula('12345678'), formatearCedula('403369895', 'J'), formatearCedula('', 'V'), formatearCedula(null)], ['V-12345678', 'V-12345678', 'J-403369895', '', '']);
check('si el valor ya trae el prefijo no se duplica (V-V-22222222)', [formatearCedula('V-22222222', 'V'), formatearCedula('v-22222222'), formatearCedula('E-81234567', 'V'), formatearCedula('J-403369895', 'J'), formatearCedula(' G-20000000 ')], ['V-22222222', 'V-22222222', 'E-81234567', 'J-403369895', 'G-20000000']);
check('el RIF y los demás documentos van sin puntos de miles; la cédula V los conserva', [formatearCedula('407.162.578', 'J'), formatearCedula('J-407.162.578', 'J'), formatearCedula('81.234.567', 'E'), formatearCedula('20.000.000', 'G'), formatearCedula('12.345.678', 'V'), formatearCedula('12.345.678'), formatearCedula('V-12.345.678')],
  ['J-407162578', 'J-407162578', 'E-81234567', 'G-20000000', 'V-12.345.678', 'V-12.345.678', 'V-12.345.678']);
check('la tarjeta y la exportación usan esa misma función', [/formatearCedula\(orden\.cedula, orden\.tipoDocumento\)/.test(leer('../src/components/TarjetaInstalacion.jsx')), /formatearCedula\(o\.cedula, o\.tipoDocumento\)/.test(leer('../src/utils/exportarOrdenes.js'))], [true, true]);
check('la tarjeta usa la etiqueta de tipo de la tabla de la oficina, el estado sólido y la franja de atraso con la misma función (atrasoOrden)', [/getTipoTrabajoEstilo\(esLos \? 'AVERÍA' : 'INSTALACIÓN'\)/.test(leer('../src/components/TarjetaInstalacion.jsx')), /ESTILO_ESTADO_PROMOTORA_SOLIDO\[vista\.clave\]/.test(leer('../src/components/TarjetaInstalacion.jsx')), /atraso\.que/.test(leer('../src/components/TarjetaInstalacion.jsx'))], [true, true, true]);

// --- Exportar a Excel ---
const exportables = [
  orden({ id: 'e1', codigo: 'IO9', nombre: 'Ana Pérez', cedula: '12345678', tipoDocumento: 'V', direccion: 'Calle 1; casa 2', tecnico: 'JOSE', promotora: 'Alexis Añez', estado: 'FINALIZADO', finalizadoEn: new Date(2026, 9, 13, 9, 5).getTime() }),
  orden({ id: 'e2', codigo: 'AS2', nombre: '=HIPERVINCULO("x")', tipoTrabajo: 'AVERÍA', falla: 'LOS', createdAt: AHORA - 3 * DIA, tecnico: 'JOSE' }),
];
const csv = csvDeOrdenes(exportables, AHORA);
const lineasCsv = csv.split(String.fromCharCode(13, 10));
check('el CSV empieza con la marca UTF-8 y los encabezados, separados por punto y coma', [csv.charCodeAt(0), lineasCsv[0].slice(1)], [0xFEFF, 'Código;Tipo;Cliente;Cédula;Dirección;Promotor;Técnico;Estado;Fecha;Atraso']);
check('una fila por orden, con el tipo, la cédula con su prefijo, el promotor, el estado y la fecha', lineasCsv[1], 'IO9;Instalación;Ana Pérez;V-12345678;"Calle 1; casa 2";Alexis Añez;JOSE;Instalada;13/10/2026 09:05;');
check('un nombre que empieza con = no se ejecuta como fórmula en Excel, y el atraso se exporta', [lineasCsv[2].startsWith('AS2;LOS;"\'=HIPERVINCULO(""x"")";'), lineasCsv[2].endsWith(';Sin resolver hace 3 días')], [true, true]);
check('el CSV no lleva plantillas, cobros ni contacto', filasExportacion(exportables, AHORA)[0].length, 10);
const prefs = leer('../src/hooks/usePreferencia.js');
check('las preferencias se guardan solo en el navegador (sin Firebase) y toleran que no haya almacenamiento', /localStorage/.test(prefs) && !/from 'firebase/.test(prefs) && (prefs.match(/catch/g) || []).length >= 2, true);

// --- Totales del mes ---
const OCTUBRE = '2026-10';
check('el mes se cuenta en hora de Caracas (a las 23:30 del 31 todavía es octubre aunque en UTC ya sea noviembre)', [mesDe(Date.parse('2026-10-31T23:30:00-04:00')), mesDe(Date.parse('2026-11-01T00:30:00-04:00'))], ['2026-10', '2026-11']);
check('los meses recientes: el actual primero, y cruzan el año', [mesesRecientes(Date.parse('2026-01-15T12:00:00-04:00'), 3), etiquetaMes('2026-10')], [['2026-01', '2025-12', '2025-11'], 'octubre 2026']);
check('los totales empiezan en octubre de 2026: no se ofrecen meses anteriores', [PRIMER_MES_TOTALES, mesesDeTotales(Date.parse('2026-10-20T12:00:00-04:00')), mesesDeTotales(Date.parse('2026-12-05T12:00:00-04:00'))], ['2026-10', ['2026-10'], ['2026-12', '2026-11', '2026-10']]);
check('con muchos meses por delante no pasa del tope de seis', mesesDeTotales(Date.parse('2027-08-05T12:00:00-04:00')).length, 6);
const enVivo = [
  orden({ id: '1', estado: 'PENDIENTE' }),
  orden({ id: '2', estado: 'PENDIENTE', tecnico: 'J' }),
  orden({ id: '3', estado: 'PRE-FINALIZADO', tecnico: 'J' }),
  orden({ id: '4', estado: 'FINALIZADO', tecnico: 'J', finalizadoEn: AHORA - 3600000 }),
  orden({ id: '5', estado: 'CANCELADO' }),
  orden({ id: '6', tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'PENDIENTE' }),
  orden({ id: '7', tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'FINALIZADO', tecnico: 'J', finalizadoEn: AHORA - 3600000 }),
  orden({ id: '8', tipoTrabajo: 'AVERÍA', falla: 'Sin señal', estado: 'PENDIENTE' }),
  orden({ id: '9', estado: 'FINALIZADO', tecnico: 'J', finalizadoEn: new Date(2026, 8, 30, 20).getTime() }),
];
const contadorOct = { instalacionesFinalizadas: 10, instalacionesCanceladas: 2, losResueltas: 4 };
const totalesOct = totalesDelMes(contadorOct, enVivo, OCTUBRE, AHORA);
check('instalaciones: lo cerrado del mes más lo de hoy que aún no se cierra; en proceso son las pendientes y en revisión', totalesOct.instalaciones, { enProceso: 3, finalizadas: 11, canceladas: 3 });
check('averías LOS: aparte, y otras averías no cuentan', totalesOct.los, { enProceso: 1, finalizadas: 5, canceladas: 0 });
const totalesSep = totalesDelMes({ instalacionesFinalizadas: 30 }, enVivo, '2026-09', AHORA);
check('un mes pasado no muestra "en proceso" y solo suma lo que se finalizó en ese mes', [totalesSep.instalaciones, totalesSep.los], [{ enProceso: null, finalizadas: 31, canceladas: 0 }, { enProceso: null, finalizadas: 0, canceladas: 0 }]);
check('sin documento del mes (todavía no se cerró nada) los cerrados son cero y se muestran las de hoy', totalesDelMes(null, enVivo, OCTUBRE, AHORA).instalaciones, { enProceso: 3, finalizadas: 1, canceladas: 1 });
const cierreFin = Date.parse('2026-11-01T22:00:00-04:00');
const tFin = (extra) => ({ tipoTrabajo: 'INSTALACIÓN', ...extra });
const paraCerrar = [tFin({ finalizadoEn: Date.parse('2026-10-31T23:30:00-04:00') }), tFin({ finalizadoEn: cierreFin - 3600000 }), tFin({}), { tipoTrabajo: 'AVERÍA', falla: 'LOS', finalizadoEn: 5 }, { tipoTrabajo: 'AVERÍA', falla: 'Sin señal' }];
check('el cierre manual de la app suma por mes y tipo, sin contar otras averías', incrementosMensuales(paraCerrar, 'FINALIZADO', cierreFin), { '2026-10': { instalacionesFinalizadas: 1 }, '2026-11': { instalacionesFinalizadas: 2, losResueltas: 1 } });
const mezcla = [tFin({ estado: 'FINALIZADO', finalizadoEn: cierreFin - 3600000 }), tFin({ estado: 'CANCELADO' }), { tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'CANCELADO' }, { tipoTrabajo: 'AVERÍA', falla: 'Sin señal', estado: 'FINALIZADO' }];
check('un cierre con finalizadas y canceladas en un solo reporte suma cada una en su contador', incrementosDeCierre(mezcla, cierreFin), { '2026-11': { instalacionesFinalizadas: 1, instalacionesCanceladas: 1, losCanceladas: 1 } });
// El cierre automático (Worker) y el manual (app) deben contar igual: mismas órdenes, mismos totales.
const aFirestore = (t) => ({ fields: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v }])) });
for (const estado of ['FINALIZADO', 'CANCELADO']) check(`el cierre manual y el automático cuentan igual (${estado})`, incrementosMensuales(paraCerrar, estado, cierreFin), incrementosWorker(paraCerrar.map(aFirestore), estado, cierreFin));

// --- Costo de Firebase y límites ---
const hook = leer('../src/hooks/useHistorialInstalaciones.js');
check('actualizar el historial tiene una espera mínima y no lee si ya hay una lectura en curso',
  /ESPERA_ACTUALIZAR_MS = 2 \* 60 \* 1000/.test(hook) && /Date\.now\(\) - ultima\.current < ESPERA_ACTUALIZAR_MS\) return 'espera'/.test(hook) && /leyendo\.current\) return 'ocupado'/.test(hook), true);
// El historial de cerradas ya no tiene botón: se vuelve a leer solo cuando una orden sale de la lista en vivo (el cierre del día la pasó al historial).
check('detecta que una orden salió de la lista en vivo', [algunaOrdenSalio(null, [{ id: 'a' }]), algunaOrdenSalio(new Set(['a', 'b']), [{ id: 'a' }, { id: 'b' }]), algunaOrdenSalio(new Set(['a', 'b']), [{ id: 'a' }]), algunaOrdenSalio(new Set(['a']), [{ id: 'a' }, { id: 'c' }])], [false, false, true, false]);
check('la pantalla ya no tiene el botón Actualizar y pide la actualización sola', [/Volver a leer las órdenes cerradas|ActualizarHistorial/.test(leer('../src/components/PromotoraApp.jsx')), /algunaOrdenSalio\(idsEnVivo\.current, tickets\)\) actualizarHistorial\(\)/.test(leer('../src/components/PromotoraApp.jsx'))], [false, true]);
check('la actualización automática reintenta si todavía no toca la espera mínima', /r === 'espera' \|\| r === 'ocupado'\) reintento\.current = setTimeout/.test(hook), true);
check('la pantalla no lee nada de Firestore al filtrar u ordenar (todo se calcula con lo ya cargado)', /getDocs|onSnapshot|query\(/.test(leer('../src/components/PromotoraApp.jsx')), false);

// Dentro del mismo día se ordena por número de código, no por la hora exacta del cierre.
const MISMO_DIA = new Date(2026, 9, 18, 10, 0).getTime();
const cerrada = (codigo, hora) => orden({ id: codigo, codigo, estado: 'FINALIZADO', tecnico: 'J', finalizadoEn: MISMO_DIA + hora * 60000, createdAt: MISMO_DIA });
const mismoDia = [cerrada('IO83', 1), cerrada('IO82', 5), cerrada('IO87', 2), cerrada('IO84', 9), cerrada('IO86', 3)];
check('fecha ascendente, mismo día: IO82, IO83, IO84, IO86, IO87 (no por la hora de cierre)', ids2(ordenarOrdenes(mismoDia, 'FECHA', AHORA, 'ASC')), 'IO82 IO83 IO84 IO86 IO87');
check('fecha descendente, mismo día: del código mayor al menor', ids2(ordenarOrdenes(mismoDia, 'FECHA', AHORA, 'DESC')), 'IO87 IO86 IO84 IO83 IO82');
check('el número se compara como número (IO100 después de IO82) y un código sin número va al final', ids2(ordenarOrdenes([cerrada('IO100', 1), cerrada('IS', 2), cerrada('IO82', 3)], 'FECHA', AHORA, 'ASC')), 'IO82 IO100 IS');
check('el día manda antes que el código: un día anterior va primero al ascender', ids2(ordenarOrdenes([cerrada('IO90', 1), { ...cerrada('IO99', 1), finalizadoEn: MISMO_DIA - DIA }], 'FECHA', AHORA, 'ASC')), 'IO99 IO90');

// Por código: solo el número, sin importar el día.
const dia = (n) => new Date(2026, 9, n, 12, 0).getTime();
const deOtroDia = (codigo, n) => orden({ id: codigo, codigo, estado: 'FINALIZADO', tecnico: 'J', finalizadoEn: dia(n), createdAt: dia(n) });
const variosDias = [deOtroDia('IO77', 15), deOtroDia('IO73', 16), deOtroDia('IO76', 15), deOtroDia('IO100', 14), deOtroDia('IO79', 17)];
check('código ascendente: IO73, IO76, IO77, IO79, IO100 aunque sean de días distintos', ids2(ordenarOrdenes(variosDias, 'CODIGO', AHORA, 'ASC')), 'IO73 IO76 IO77 IO79 IO100');
check('código descendente: del mayor al menor', ids2(ordenarOrdenes(variosDias, 'CODIGO', AHORA, 'DESC')), 'IO100 IO79 IO77 IO76 IO73');
check('sin código, al final en las dos direcciones', [ids2(ordenarOrdenes([orden({ id: 'x', codigo: '' }), deOtroDia('IO5', 15)], 'CODIGO', AHORA, 'ASC')), ids2(ordenarOrdenes([orden({ id: 'x', codigo: '' }), deOtroDia('IO5', 15)], 'CODIGO', AHORA, 'DESC'))], ['IO5 ', 'IO5 ']);

// --- Calendario de los filtros ---
const cal = await import('../src/utils/calendario.js');
const octubre = cal.casillasDelMes(2026, 10);
check('octubre 2026 empieza en jueves (3 huecos con la semana desde el lunes) y tiene 31 días', [octubre.slice(0, 3), octubre[3], octubre.length - 3], [[null, null, null], '2026-10-01', 31]);
check('febrero de un año bisiesto tiene 29 días y marzo de 2026 empieza en domingo (6 huecos)', [cal.casillasDelMes(2028, 2).filter(Boolean).length, cal.casillasDelMes(2026, 3).findIndex(Boolean)], [29, 6]);
check('mover de mes cruza el año', [cal.mover(2026, 1, -1), cal.mover(2026, 12, 1), cal.mover(2026, 10, 1)], [{ anio: 2025, mes: 12 }, { anio: 2027, mes: 1 }, { anio: 2026, mes: 11 }]);
check('fecha ISO y corta', [cal.fechaISO(new Date(2026, 9, 5, 23, 59)), cal.fechaCorta('2026-10-05'), cal.fechaCorta('2026-02-30'), cal.fechaCorta('')], ['2026-10-05', '05/10/2026', '', '']);
check('el calendario no deja pasar de hoy y es el de la app (no el del navegador)', /iso > tope/.test(leer('../src/components/Calendario.jsx')) && !/type="date"/.test(leer('../src/components/PromotoraApp.jsx')), true);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
