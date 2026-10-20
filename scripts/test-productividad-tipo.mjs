// Prueba la productividad por técnico separada en instalaciones y averías (Reportes > Estadísticas). No necesita el emulador.
// Uso: `npm run test:productividad`.
import { readFileSync } from 'node:fs';
import { estadisticasOperativas } from '../src/utils/estadisticasOperativas.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const DIA = new Date(2026, 9, 15, 12, 0).getTime();
const rango = { desde: '2026-10-01', hasta: '2026-10-31' };
const o = (tecnico, tipoTrabajo, extra = {}) => ({ tecnico, tipoTrabajo, estado: 'FINALIZADO', finalizadoEn: DIA, createdAt: DIA, ...extra });
const ordenes = [
  o('JOSE', 'INSTALACIÓN'), o('JOSE', 'INSTALACIÓN'), o('JOSE', 'AVERÍA'),
  o('EDGAR', 'AVERÍA'), o('EDGAR', 'AVERÍA'), o('EDGAR', 'AVERIA'), o('EDGAR', 'RECONEXIÓN'),
  o('REINEL', 'INSTALACIÓN'),
  o('JOSE', 'AVERÍA', { estado: 'PENDIENTE' }),
  o('JOSE', 'INSTALACIÓN', { estado: 'CANCELADO' }),
  o('', 'AVERÍA'),
];
const est = estadisticasOperativas(ordenes, rango, '');
const filas = (l) => l.map((x) => `${x.name}:${x.count}`);

check('todo: cuenta todas las finalizadas con técnico (incluida la reconexión)', filas(est.porTecnicoTipo.TODO), ['EDGAR:4', 'JOSE:3', 'REINEL:1']);
check('el total de antes sigue igual (porTecnico es el de "todo")', filas(est.porTecnico), filas(est.porTecnicoTipo.TODO));
check('instalaciones: solo las INSTALACIÓN finalizadas', filas(est.porTecnicoTipo.INSTALACION), ['JOSE:2', 'REINEL:1']);
check('averías: las AVERÍA (con o sin tilde) y la reconexión, que es del grupo de averías', filas(est.porTecnicoTipo.AVERIA), ['EDGAR:4', 'JOSE:1']);
check('no cuenta las pendientes, las canceladas ni las sin técnico', est.porTecnicoTipo.TODO.reduce((n, x) => n + x.count, 0), 8);
check('el total finalizado de las cifras no cambia', est.finalizadas, 8);
check('el filtro de técnico también aplica a cada tipo', filas(estadisticasOperativas(ordenes, rango, 'jose').porTecnicoTipo.AVERIA), ['JOSE:1']);
check('el rango de fechas aplica a cada tipo', estadisticasOperativas(ordenes, { desde: '2026-09-01', hasta: '2026-09-30' }, '').porTecnicoTipo.INSTALACION, []);

// --- Lo que se vio en producción: Instalaciones + Averías no sumaban Todo ---
// Los grupos suman SIEMPRE el total, en general y por cada técnico, con todos los tipos de trabajo (y uno desconocido).
const TIPOS = ['INSTALACIÓN', 'AVERÍA', 'RECONEXIÓN', 'LOW SIGNAL', 'CAMBIO DE EQUIPO', 'MUDANZA', 'RETIRO EQUIPO', 'GARANTIA', 'VALIDACION NAP', 'OTRA COSA'];
const variadas = ['JOSE', 'ABRAHAM', 'EDGAR', 'REINEL'].flatMap((tec, i) => TIPOS.flatMap((tipo, j) => Array.from({ length: (i + j) % 4 + 1 }, () => o(tec, tipo))));
const todas = estadisticasOperativas(variadas, rango, '');
const total = (lista) => lista.reduce((n, x) => n + x.count, 0);
check('los grupos (instalaciones + averías + visitas + otros) suman el total', ['INSTALACION', 'AVERIA', 'VISITA', 'OTRO'].reduce((n, k) => n + total(todas.porTecnicoTipo[k]), 0), total(todas.porTecnicoTipo.TODO));
check('y lo mismo por cada técnico', todas.porTecnicoTipo.TODO.every(({ name, count }) => ['INSTALACION', 'AVERIA', 'VISITA', 'OTRO'].reduce((n, k) => n + (todas.porTecnicoTipo[k].find((f) => f.name === name)?.count || 0), 0) === count), true);
check('los totales por tipo cuadran con las listas', Object.entries(todas.totalesPorTipo).every(([k, n]) => n === total(todas.porTecnicoTipo[k])), true);
check('un tipo que no está en ningún grupo cae en "otros" y no se pierde', todas.totalesPorTipo.OTRO > 0 && todas.totalesPorTipo.OTRO === variadas.filter((x) => x.tipoTrabajo === 'OTRA COSA').length, true);
const caso = estadisticasOperativas([...Array(8)].map(() => o('JOSE', 'INSTALACIÓN')).concat([...Array(15)].map(() => o('JOSE', 'AVERÍA')), [...Array(4)].map(() => o('JOSE', 'MUDANZA'))), rango, '');
check('el caso de Jose: 8 instalaciones + 15 averías + 4 visitas = 27', [caso.totalesPorTipo.INSTALACION, caso.totalesPorTipo.AVERIA, caso.totalesPorTipo.VISITA, caso.totalesPorTipo.TODO], [8, 15, 4, 27]);
const vista = readFileSync(new URL('../src/components/modals/reports/AnalyticsView.jsx', import.meta.url), 'utf8');
check('la tarjeta ofrece Todo, Instalaciones, Averías y Visitas', /\['TODO', 'Todo'\], \['INSTALACION', 'Instalaciones'\], \['AVERIA', 'Averías'\], \['VISITA', 'Visitas'\]/.test(vista), true);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
