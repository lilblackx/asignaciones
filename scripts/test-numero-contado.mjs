// Prueba cómo se leen los valores de las cifras de los reportes para contarlos desde 0 (src/utils/leerNumero.js): qué cuenta y qué se deja tal cual.
import { leerNumero } from '../src/utils/leerNumero.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const NBSP = String.fromCharCode(160);
check('un entero', [leerNumero(12), leerNumero('12')], [{ numero: 12, decimales: 0, sufijo: '' }, { numero: 12, decimales: 0, sufijo: '' }]);
check('con separador de miles', leerNumero('1.234'), { numero: 1234, decimales: 0, sufijo: '' });
check('dólares con espacio sin salto', leerNumero(`116,50${NBSP}$`), { numero: 116.5, decimales: 2, sufijo: `${NBSP}$` });
check('bolívares con miles y decimales', leerNumero(`113.980,00${NBSP}Bs`), { numero: 113980, decimales: 2, sufijo: `${NBSP}Bs` });
check('porcentaje, horas y minutos con unidad', [leerNumero('45%'), leerNumero('3 h'), leerNumero('4,5 min')], [{ numero: 45, decimales: 0, sufijo: '%' }, { numero: 3, decimales: 0, sufijo: ' h' }, { numero: 4.5, decimales: 1, sufijo: ' min' }]);
check('una hora, una fecha, un guion y un texto se dejan tal cual', ['4:51:00', '11/10', '—', 'Sin datos', '', null, undefined, '12-14', '2026-10-21'].map(leerNumero), [null, null, null, null, null, null, null, null, null]);
check('un número que no es finito no se anima', [leerNumero(NaN), leerNumero(Infinity)], [null, null]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
