// Prueba el reporte "Cobros y exoneraciones" (src/utils/cobrosReporte.js): cómo se clasifica el cobro de cada orden, los porcentajes,
// el desglose por concepto y por técnico, y los montos por moneda. No necesita el emulador.
// Uso: `npm run test:cobros`.
import { montoDe, resultadoCobro, resumenCobros } from '../src/utils/cobrosReporte.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

check('exonerada', resultadoCobro({ cobroTipo: 'EXONERADO' }), 'exonerada');
check('visita técnica', resultadoCobro({ cobroTipo: 'VISITA_TECNICA', cobroBs: '5.696' }), 'visita');
check('otro monto', resultadoCobro({ cobroTipo: 'OTRO_MONTO', cobroBs: '30', cobroMoneda: 'USD' }), 'otro');
check('un monto sin tipo es de visita técnica', resultadoCobro({ cobroBs: '5.696' }), 'visita');
check('sin monto ni exoneración: sin cobro registrado', resultadoCobro({}), 'sinCobro');
check('montos con puntos de miles y coma decimal', [montoDe('5.696'), montoDe('5.000,5'), montoDe('30'), montoDe(null)], [5696, 5000.5, 30, 0]);

const dia = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(ms));
const T = Date.now();
const rango = { desde: dia(T - 86400000), hasta: dia(T + 86400000) };
const base = { estado: 'FINALIZADO', finalizadoEn: T, tipoTrabajo: 'AVERÍA', tecnico: 'GERARDO' };
const ordenes = [
  { ...base, cobroTipo: 'VISITA_TECNICA', cobroBs: '5.696', tipoVisita: 'RECABLEADO' },
  { ...base, cobroTipo: 'VISITA_TECNICA', cobroBs: '5.696' },
  { ...base, cobroTipo: 'OTRO_MONTO', cobroBs: '30', cobroMoneda: 'USD', tecnico: 'REINEL', tipoVisita: 'CAMBIO_EQUIPO' },
  { ...base, cobroTipo: 'EXONERADO', tecnico: 'REINEL', tipoVisita: 'RECABLEADO' },
  { ...base },
  { ...base, tipoTrabajo: 'INSTALACIÓN' },
  { ...base, estado: 'PENDIENTE', finalizadoEn: undefined },
];
const r = resumenCobros(ordenes, rango, {});
check('las instalaciones y las abiertas no cuentan', [r.finalizadas, r.instalaciones, r.total.total], [6, 1, 5]);
check('cobradas, exoneradas y sin cobro', [r.total.cobradas, r.total.exoneradas, r.total.sinCobro], [3, 1, 1]);
check('porcentajes', [r.total.pctCobradas, r.total.pctExoneradas, r.total.pctSinCobro], [60, 20, 20]);
check('visita técnica y otro monto', [r.total.visita, r.total.otro], [2, 1]);
check('montos por moneda', r.montos, { bs: 11392, usd: 30, ordenesBs: 2, ordenesUsd: 1 });
check('por concepto', r.porConcepto.map((f) => [f.nombre, f.total, f.cobradas, f.exoneradas]), [['Avería', 2, 1, 0], ['Recableado', 2, 1, 1], ['Cambio de equipo', 1, 1, 0]]);
check('por técnico', r.porTecnico.map((f) => [f.nombre, f.total, f.pctExoneradas]), [['GERARDO', 3, 0], ['REINEL', 2, 50]]);
check('el filtro por técnico', resumenCobros(ordenes, rango, { tecnico: 'reinel' }).total.total, 2);
check('sin órdenes no hay porcentajes', resumenCobros([], rango, {}).total.pctCobradas, null);

if (failures) { console.log(`\n${failures} falló/fallaron.`); process.exit(1); }
console.log('\nTodo bien.');
