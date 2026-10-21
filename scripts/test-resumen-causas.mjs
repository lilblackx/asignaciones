// Prueba las causas de avería (src/utils/causasAveria.js) y el resumen ejecutivo con sus alertas (src/utils/resumenEjecutivo.js).
// No necesita el emulador. Uso: `npm run test:resumen`.
import { causasDeAveria, nombreDeFalla, napDeOrden } from '../src/utils/causasAveria.js';
import { UMBRALES, hallazgos, resumenEjecutivo } from '../src/utils/resumenEjecutivo.js';

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
const AHORA = caracas('2026-10-19', 15);
const RANGO = { desde: '2026-10-13', hasta: '2026-10-19' };
const averia = (id, extra) => ({ id, codigo: `AS${id}`, tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'FINALIZADO', tecnico: 'GERARDO', cedula: `1000${id}`, nombre: `Cliente ${id}`, nap: 'N10D14', createdAt: caracas('2026-10-15', 8), finalizadoEn: caracas('2026-10-15', 11), ...extra });

// --- Causas de avería ---
check('la falla se normaliza y sin falla (o con el tipo guardado como falla) es SIN ESPECIFICAR', [nombreDeFalla({ falla: ' los ' }), nombreDeFalla({ falla: '' }), nombreDeFalla({ falla: 'AVERÍA' })], ['LOS', 'SIN ESPECIFICAR', 'SIN ESPECIFICAR']);
check('la misma NAP con distintos puertos cuenta como una sola, y sin código se quita el puerto y el "NAP" de adelante', [napDeOrden({ nap: 'NAP O02D10 - Puerto 3' }), napDeOrden({ nap: 'NAP O02D10 - Puerto 7' }), napDeOrden({ nap: 'O02D10' }), napDeOrden({ nap: 'NAP EDIF MIRANDA - Puerto 2' }), napDeOrden({ nap: 'EDIF MIRANDA' }), napDeOrden({ nap: 'asdkjhfg125 - Puerto 4' }), napDeOrden({ nap: 'Puerto 4' })], ['O02D10', 'O02D10', 'O02D10', 'EDIF MIRANDA', 'EDIF MIRANDA', 'ASDKJHFG125', 'PUERTO 4']);
check('la NAP se normaliza al código, o al texto escrito, o es null', [napDeOrden({ nap: 'nap n10d14 - puerto 2' }), napDeOrden({ nap: 'caja rara' }), napDeOrden({ nap: '  ' })], ['N10D14', 'CAJA RARA', null]);

const ordenes = [
  averia('1'), averia('2'), averia('3'), // tres averías LOS en la misma NAP, de tres clientes
  averia('4', { falla: 'Sin señal', nap: 'O07D05', estado: 'PENDIENTE', finalizadoEn: undefined }),
  averia('5', { falla: 'Sin señal', nap: 'O07D05', cedula: '10001', estado: 'CANCELADO', createdAt: caracas('2026-10-16', 9), finalizadoEn: undefined }), // mismo cliente que la 1, al día siguiente de finalizarla
  averia('6', { tipoTrabajo: 'INSTALACIÓN', falla: '' }), // no es avería
  averia('8', { createdAt: caracas('2026-09-10', 9), finalizadoEn: caracas('2026-09-10', 12) }), // fuera del periodo
];
const c = causasDeAveria(ordenes, RANGO);
check('cuenta solo averías del periodo, sin otros tipos', [c.total, c.resueltas], [5, 3]);
check('por falla: total, porcentaje, resueltas, canceladas y tiempo medio de resolución', c.porFalla.map((f) => [f.nombre, f.total, f.pct, f.resueltas, f.canceladas, f.resolucionMedia]), [['LOS', 3, 60, 3, 0, 3 * HORA], ['SIN SEÑAL', 2, 40, 0, 1, null]]);
check('tiempo medio de resolución total y NAPs afectadas', [c.resolucionMedia, c.napsAfectadas], [3 * HORA, 2]);
check('por NAP: averías, clientes distintos y fallas principales', c.porNap.map((n) => [n.nap, n.total, n.clientes, n.principales, n.sospechosa]), [['N10D14', 3, 3, ['LOS'], true], ['O07D05', 2, 2, ['SIN SEÑAL'], false]]);
check('las NAPs con averías de 3 o más clientes se marcan sospechosas', c.napsSospechosas.map((n) => n.nap), ['N10D14']);
check('la evolución trae las fallas principales y los meses con averías', [c.evolucion.fallas, c.evolucion.filas.map((f) => [f.mes, f.valores, f.total])], [['LOS', 'SIN SEÑAL'], [['2026-09', [1, 0], 1], ['2026-10', [3, 2], 5]]]);
check('el filtro de técnico recorta todo', causasDeAveria(ordenes, RANGO, { tecnico: 'otro' }).total, 0);
check('sin averías todo queda vacío y no falla', (({ total, porFalla, porNap, resolucionMedia }) => [total, porFalla, porNap, resolucionMedia])(causasDeAveria([], RANGO)), [0, [], [], null]);

// --- Resumen ejecutivo ---
const contadores = { '2026-08': { instalacionesFinalizadas: 30, losResueltas: 10 }, '2026-09': { instalacionesFinalizadas: 20, instalacionesCanceladas: 2, losResueltas: 5 }, '2026-10': { instalacionesFinalizadas: 3, instalacionesCanceladas: 3 } };
const eventos = [{ tecnico: 'GERARDO', activo: true, en: caracas('2026-10-15', 8) }, { tecnico: 'GERARDO', activo: false, en: caracas('2026-10-15', 12) }];
const vieja = averia('90', { estado: 'PENDIENTE', createdAt: AHORA - 5 * DIA, finalizadoEn: undefined });
const r = resumenEjecutivo({ ordenes: [...ordenes, vieja], eventos, contadores, tickets: [vieja], rango: RANGO, tecnico: '', ahora: AHORA });
check('dos filas de cuatro cifras', [r.cifras.length, r.cifrasMes.length], [4, 4]);
check('órdenes finalizadas (la instalación también cuenta) y tiempo activo de las cifras', [r.cifras[0].valor, r.cifras[3].valor], [4, '4 h 00 min']);
check('la tendencia trae los meses con datos y marca el mes en curso', r.filasMes.map((f) => [f.mes, f.enCurso]), [['2026-08', false], ['2026-09', false], ['2026-10', true]]);
check('el comparativo por técnico junta productividad y calidad', r.tecnicos.map((t) => [t.tecnico, t.finalizadas, t.pctReincidencia]), [['GERARDO', 4, 25]]);
const textos = r.hallazgos.map((h) => h.texto);
check('alerta de la NAP con averías de varios clientes', textos.some((t) => t.includes('NAP N10D14') && t.includes('4 clientes')), true);
check('alerta de las pendientes de más de 3 días con la más antigua', textos.some((t) => t.includes('2 órdenes pendientes llevan') && t.includes('AS90')), true);
check('alerta de reincidencia alta (25% > umbral)', textos.some((t) => t.includes('reincidió')), true);
check('alerta de caída de finalizadas entre los dos últimos meses completos (40 → 25)', textos.some((t) => t.includes('bajaron de 40 a 25')), true);
check('las alertas van primero y los avisos ok al final', r.hallazgos.findIndex((h) => h.nivel === 'ok') === -1 || r.hallazgos.findIndex((h) => h.nivel === 'ok') > r.hallazgos.findLastIndex((h) => h.nivel === 'aviso'), true);

const sinProblemas = hallazgos({
  atencion: { total: { cantidad: 10, pctMeta: 95 } },
  cal: { total: { pctReincidencia: 2, pctDebil: 5, pctDevueltas: 3 }, filas: [] },
  pendientesViejas: [], filasMes: [], causas: { napsSospechosas: [] },
});
check('sin nada fuera de lo esperado queda un aviso que lo dice', sinProblemas.map((h) => h.nivel).includes('aviso') ? 'con alertas' : sinProblemas.at(-1).texto, 'Sin alertas: los indicadores están dentro de lo esperado.');
check('el umbral de meta cumplida es 80%', UMBRALES.metaCumplida, 80);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas de causas y resumen pasaron.');
