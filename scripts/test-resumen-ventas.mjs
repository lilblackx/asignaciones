// Prueba lo que usa ventas para seguir las órdenes: el filtro por fecha, la marca de atraso, el resumen por promotor y el orden.
// No necesita el emulador. Uso: `npm run test:ventas`.
import { readFileSync } from 'node:fs';
import { csvDeOrdenes, filasExportacion } from '../src/utils/exportarOrdenes.js';
import { PRIMER_MES_TOTALES, etiquetaMes, incrementosMensuales, mesDe, mesesDeTotales, mesesRecientes, totalesDelMes } from '../src/utils/totalesMes.js';
import { incrementosMensuales as incrementosWorker } from '../cf-worker/src/index.js';
import { formatearCedula } from '../src/utils/cedula.js';
import { FILTROS_FECHA, OPCIONES_ORDEN, ORDEN_POR_DEFECTO, atrasoOrden, enRangoFecha, estadoParaPromotora, fechaOrden, ordenarOrdenes, resumenPorPromotor } from '../src/utils/estadoInstalacion.js';

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
check('más recientes primero (las sin fecha al final)', ids(ordenarOrdenes([a, b, c, d], 'RECIENTES')), 'dbac');
check('más antiguas primero, y las sin fecha al final', ids(ordenarOrdenes([a, b, c, d], 'ANTIGUAS')), 'abdc');
check('por estado: sin técnico, luego asignada, luego instalada', ids(ordenarOrdenes([d, b, a], 'ESTADO')), 'abd');
check('el orden por defecto es lo más reciente primero, y la urgencia sigue como opción', [ORDEN_POR_DEFECTO, OPCIONES_ORDEN[0][0], OPCIONES_ORDEN.map(([c]) => c)], ['RECIENTES', 'RECIENTES', ['RECIENTES', 'URGENCIA', 'ANTIGUAS', 'ESTADO']]);
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
// El cierre automático (Worker) y el manual (app) deben contar igual: mismas órdenes, mismos totales.
const aFirestore = (t) => ({ fields: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v }])) });
for (const estado of ['FINALIZADO', 'CANCELADO']) check(`el cierre manual y el automático cuentan igual (${estado})`, incrementosMensuales(paraCerrar, estado, cierreFin), incrementosWorker(paraCerrar.map(aFirestore), estado, cierreFin));

// --- Costo de Firebase y límites ---
const hook = leer('../src/hooks/useHistorialInstalaciones.js');
check('actualizar el historial tiene una espera mínima y no lee si ya hay una lectura en curso',
  /ESPERA_ACTUALIZAR_MS = 2 \* 60 \* 1000/.test(hook) && /Date\.now\(\) - ultima\.current < ESPERA_ACTUALIZAR_MS\) return 'espera'/.test(hook) && /leyendo\.current\) return 'ocupado'/.test(hook), true);
check('la pantalla no lee nada de Firestore al filtrar u ordenar (todo se calcula con lo ya cargado)', /getDocs|onSnapshot|query\(/.test(leer('../src/components/PromotoraApp.jsx')), false);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
