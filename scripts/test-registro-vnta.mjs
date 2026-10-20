// Prueba el registro manual de VN y TA (src/utils/registroVnTa.js): validación de lo que se escribe, códigos y contadores por mes, orden y estadística.
// No necesita el emulador. Uso: `npm run test:vnta`.
import {
  codigoDe, estadisticaRegistros, esFechaValida, fechaLegible, filaVnTa, idContador, mesDeFecha, ordenarRegistros, parseRegistro,
} from '../src/utils/registroVnTa.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Lo que se escribe ---
check('una validación de NAP sin técnico ni observación vale (así va en la hoja)', parseRegistro({ trabajo: 'VN', fecha: '2026-10-11' }).valor, { trabajo: 'VN', tecnico: '', fecha: '2026-10-11', observacion: '' });
check('el tipo es obligatorio', parseRegistro({ trabajo: 'X', fecha: '2026-10-11' }).campo, 'trabajo');
check('la fecha es obligatoria y debe existir', [parseRegistro({ trabajo: 'TA' }).campo, parseRegistro({ trabajo: 'TA', fecha: '2026-02-30' }).campo, parseRegistro({ trabajo: 'TA', fecha: '11/10/2026' }).campo], ['fecha', 'fecha', 'fecha']);
check('se limpian los espacios del técnico y de la observación, conservando los saltos de línea', parseRegistro({ trabajo: 'TA', tecnico: '  Edgar   M ', fecha: '2026-10-15', observacion: '  Apoyo  en NAP \n\n  L04C14 ' }).valor, { trabajo: 'TA', tecnico: 'Edgar M', fecha: '2026-10-15', observacion: 'Apoyo en NAP\nL04C14' });
check('una observación larguísima se rechaza', parseRegistro({ trabajo: 'TA', fecha: '2026-10-15', observacion: 'x'.repeat(501) }).campo, 'observacion');
check('fechas: válidas e inválidas', [esFechaValida('2026-10-11'), esFechaValida('2026-13-01'), esFechaValida(''), esFechaValida(undefined)], [true, false, false, false]);

// --- Códigos y contadores ---
check('el código: VAN01, TA07 y, pasando de 99, VAN100', [codigoDe('VN', 1), codigoDe('TA', 7), codigoDe('VN', 100)], ['VAN01', 'TA07', 'VAN100']);
check('el contador es por tipo y por mes (la cuenta vuelve a 01 cada mes)', [idContador('VN', '2026-10-11'), idContador('TA', '2026-10-31'), idContador('VN', '2026-11-01')], ['VNTA_VAN_2026-10', 'VNTA_TA_2026-10', 'VNTA_VAN_2026-11']);
check('el mes de una fecha', mesDeFecha('2026-10-11'), '2026-10');

// --- La hoja ---
const filas = [
  { codigo: 'TA02', trabajo: 'TA', fecha: '2026-10-07', tecnico: 'Reinel', observacion: 'Apoyo troncal', operador: 'Cesar Chirino' },
  { codigo: 'VAN10', trabajo: 'VN', fecha: '2026-10-05', tecnico: '', observacion: '', operador: 'Renny Cova' },
  { codigo: 'TA01', trabajo: 'TA', fecha: '2026-10-11', tecnico: 'Jose', observacion: 'Apoyo en NAP', operador: 'Cesar Chirino' },
  { codigo: 'VAN02', trabajo: 'VN', fecha: '2026-10-05', tecnico: '', observacion: '', operador: 'Renny Cova' },
];
check('el orden de la hoja: validaciones de NAP primero y luego trabajos adicionales, cada grupo por fecha y número', ordenarRegistros(filas).map((r) => r.codigo), ['VAN02', 'VAN10', 'TA02', 'TA01']);
check('la estadística: 2 VN, 2 TA, total 4', estadisticaRegistros(filas), { vn: 2, ta: 2, total: 4 });
check('la fila: ODT, trabajo realizado, técnico, fecha, observación y operador', filaVnTa(filas[2]), ['TA01', 'TRABAJO ADICIONAL', 'Jose', '11/10/2026', 'Apoyo en NAP', 'Cesar Chirino']);
check('la fecha legible', fechaLegible('2026-10-11'), '11/10/2026');

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
