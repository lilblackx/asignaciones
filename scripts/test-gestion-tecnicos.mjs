// Prueba los reportes de gestión de técnicos (src/utils/gestionTecnicos.js): tiempo de atención, pendientes más antiguas, productividad
// y calidad (reincidencia, señal débil, devoluciones). No necesita el emulador. Uso: `npm run test:gestion`.
import {
  calidad, duracionAtencion, estadisticaDuraciones, formatoTiempo, inicioAtencion, pendientesMasAntiguas, porcentaje, productividad, tiempoDeAtencion, todasLasOrdenes,
} from '../src/utils/gestionTecnicos.js';
import { csvReporte } from '../src/utils/csvReporte.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const HORA = 3600000;
const DIA = 24 * HORA;
const caracas = (dia, h = 12, m = 0) => Date.parse(`${dia}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-04:00`);
const RANGO = { desde: '2026-10-13', hasta: '2026-10-19' };
const AHORA = caracas('2026-10-19', 15);
const orden = (id, extra) => ({ id, codigo: `AS${id}`, estado: 'FINALIZADO', tecnico: 'GERARDO', tipoTrabajo: 'AVERÍA', cedula: `1000${id}`, nombre: `Cliente ${id}`, createdAt: caracas('2026-10-15', 8), finalizadoEn: caracas('2026-10-15', 10), ...extra });

check('formato del tiempo', [formatoTiempo(35 * 60000), formatoTiempo(5 * HORA + 20 * 60000), formatoTiempo(3 * DIA + 4 * HORA)], ['35 min', '5 h 20 min', '3 d 4 h']);
check('porcentaje redondeado y sin total', [porcentaje(1, 3), porcentaje(0, 0)], [33, null]);

// --- Tiempo de atención ---
check('el tiempo corre desde que se creó', duracionAtencion(orden('1')), 2 * HORA);
check('si estaba programada para después, corre desde ese día', inicioAtencion(orden('1', { fechaProgramada: '2026-10-15', createdAt: caracas('2026-10-10', 9) })), caracas('2026-10-15', 0));
check('sin fecha de finalización no hay duración', [duracionAtencion(orden('1', { finalizadoEn: undefined })), duracionAtencion(orden('1', { estado: 'PENDIENTE' }))], [null, null]);
const est = estadisticaDuraciones([1 * HORA, 3 * HORA, 5 * HORA, 50 * HORA], 48 * HORA);
check('promedio, mediana, máximo y cumplimiento de la meta', [est.cantidad, est.promedio, est.mediana, est.maximo, est.dentroMeta, est.pctMeta], [4, 14.75 * HORA, 4 * HORA, 50 * HORA, 3, 75]);
const ordenes = [
  orden('1'), // 2 h, GERARDO, avería
  orden('2', { tecnico: 'REINEL', tipoTrabajo: 'INSTALACIÓN', finalizadoEn: caracas('2026-10-17', 8) }), // 2 d
  orden('3', { finalizadoEn: caracas('2026-10-01', 10) }), // fuera del rango
  orden('4', { estado: 'CANCELADO', finalizadoEn: undefined }),
  orden('5', { finalizadoEn: undefined }), // finalizada sin fecha
];
const atencion = tiempoDeAtencion(ordenes, RANGO, { metaMs: 48 * HORA });
check('cuenta solo las finalizadas del rango (las que no traen fecha de finalización no entran)', [atencion.finalizadas, atencion.total.cantidad, atencion.sinFecha], [2, 2, 0]);
check('por tipo de trabajo', atencion.porTipo.map((f) => [f.nombre, f.cantidad]), [['AVERÍA', 1], ['INSTALACIÓN', 1]]);
check('por técnico, con el cumplimiento de la meta de cada uno', atencion.porTecnico.map((f) => [f.nombre, f.cantidad, f.pctMeta]), [['GERARDO', 1, 100], ['REINEL', 1, 100]]);
check('el filtro de técnico recorta todo', tiempoDeAtencion(ordenes, RANGO, { tecnico: 'reinel', metaMs: 48 * HORA }).total.cantidad, 1);
check('una orden sin técnico agrupa como SIN ASIGNAR', tiempoDeAtencion([orden('9', { tecnico: '' })], RANGO, { metaMs: HORA }).porTecnico[0].nombre, 'SIN ASIGNAR');

const abiertas = [
  orden('10', { estado: 'PENDIENTE', createdAt: caracas('2026-10-10', 9), finalizadoEn: undefined }),
  orden('11', { estado: 'PRE-FINALIZADO', createdAt: caracas('2026-10-17', 9), finalizadoEn: undefined }),
  orden('12', { estado: 'PENDIENTE', createdAt: caracas('2026-10-05', 9), fechaProgramada: '2026-10-25', finalizadoEn: undefined }), // programada a futuro
  orden('13', { estado: 'PENDIENTE', createdAt: caracas('2026-10-05', 9), fechaProgramada: '2026-10-18', finalizadoEn: undefined }),
];
check('pendientes más antiguas: la más vieja primero, sin las programadas a futuro, contando desde la fecha programada',
  pendientesMasAntiguas(abiertas, AHORA).map((p) => [p.orden.id, Math.floor(p.esperaMs / DIA)]), [['10', 9], ['11', 2], ['13', 1]]);
check('el límite recorta la lista', pendientesMasAntiguas(abiertas, AHORA, { limite: 1 }).length, 1);

// --- Productividad ---
const log = [
  { tecnico: 'GERARDO', activo: true, en: caracas('2026-10-15', 8) }, { tecnico: 'GERARDO', activo: false, en: caracas('2026-10-15', 12) },
  { tecnico: 'JOSE', activo: true, en: caracas('2026-10-15', 8) }, { tecnico: 'JOSE', activo: false, en: caracas('2026-10-15', 8, 10) },
];
const prod = productividad([orden('1'), orden('6', { finalizadoEn: caracas('2026-10-15', 11) }), orden('2', { tecnico: 'REINEL' })], log, RANGO, AHORA);
check('por técnico: finalizadas, tiempo activo y órdenes por hora', prod.map((p) => [p.tecnico, p.finalizadas, p.activoMs / HORA, p.porHora]), [['GERARDO', 2, 4, 0.5], ['REINEL', 1, 0, null], ['JOSE', 0, 10 / 60, null]]);
check('el tiempo medio de atención sale de las órdenes del técnico', prod[0].atencionMedia, 2.5 * HORA);
check('con muy poco tiempo activo no se calcula órdenes por hora', prod.find((p) => p.tecnico === 'JOSE').porHora, null);

// --- Calidad ---
const FIN = caracas('2026-10-15', 10);
const hist = [
  orden('20', { cedula: '12.345.678', potenciaDbm: -30, finalizadoEn: FIN, historialEdiciones: [{ tipo: 'devuelto', motivo: 'falta foto' }] }),
  orden('21', { cedula: '12345678', estado: 'PENDIENTE', createdAt: FIN + 5 * DIA, finalizadoEn: undefined }), // misma cédula, avería a los 5 días
  orden('22', { cedula: '99999', potenciaDbm: -20 }),
  orden('23', { cedula: '88888', estado: 'PENDIENTE', createdAt: FIN + 40 * DIA, finalizadoEn: undefined }),
  orden('24', { cedula: '88888', finalizadoEn: FIN }), // la avería de 88888 llega a los 40 días: fuera de la ventana
];
const cal = calidad(hist, RANGO);
const g = cal.filas[0];
check('calidad por técnico', [g.tecnico, g.finalizadas, g.reincidieron, g.pctReincidencia, g.conPotencia, g.debiles, g.pctDebil, g.devueltas, g.pctDevueltas], ['GERARDO', 3, 1, 33, 2, 1, 50, 1, 33]);
check('la reincidencia dice quién, cuál orden y a los cuántos días', cal.reincidencias.map((r) => [r.tecnico, r.codigo, r.siguiente, r.dias]), [['GERARDO', 'AS20', 'AS21', 5]]);
check('una avería después de la ventana de 30 días no cuenta', cal.reincidencias.some((r) => r.codigo === 'AS24'), false);
check('el total de calidad', cal.total, { finalizadas: 3, pctReincidencia: 33, pctDebil: 50, pctDevueltas: 33 });
check('una orden sin cédula válida no genera reincidencias', calidad([orden('30', { cedula: '12' }), orden('31', { cedula: '12', estado: 'PENDIENTE', createdAt: FIN + DIA, finalizadoEn: undefined })], RANGO).reincidencias, []);

check('juntar vivas y archivadas no repite órdenes', todasLasOrdenes([orden('1'), orden('2')], [{ ticketsDetalle: [orden('2'), orden('3')] }]).map((t) => t.id), ['1', '2', '3']);
const csv = csvReporte(['Reporte'], [{ titulo: 'Tabla', cabecera: ['A', 'B'], filas: [['=x', 'a;b']] }]);
check('el CSV protege las fórmulas y los separadores, y lleva BOM', [csv.charCodeAt(0), csv.includes('\'=x;"a;b"')], [0xFEFF, true]);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas de gestión de técnicos pasaron.');
