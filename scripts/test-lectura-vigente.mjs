// Prueba la vigencia de 15 minutos de las lecturas de Reportes (src/utils/lecturaVigente.js).
import { VIGENCIA_LECTURA_MS, lecturaVigente } from '../src/utils/lecturaVigente.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const ahora = 1_800_000_000_000;
check('la vigencia es de 15 minutos', VIGENCIA_LECTURA_MS, 15 * 60 * 1000);
check('una lectura de hace 1 minuto sigue vigente', lecturaVigente(ahora - 60_000, ahora), true);
check('una de hace 14 min 59 s sigue vigente', lecturaVigente(ahora - (VIGENCIA_LECTURA_MS - 1000), ahora), true);
check('una de hace exactamente 15 minutos ya venció', lecturaVigente(ahora - VIGENCIA_LECTURA_MS, ahora), false);
check('sin lectura (0, null, undefined) no hay vigencia', [lecturaVigente(0, ahora), lecturaVigente(null, ahora), lecturaVigente(undefined, ahora)], [false, false, false]);
check('un reloj que retrocedió (lectura en el futuro) cuenta como vencida', lecturaVigente(ahora + 5000, ahora), false);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
