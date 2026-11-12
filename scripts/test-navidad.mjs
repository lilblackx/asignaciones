// Prueba el logo de Navidad: se ve hasta el 1 de enero de 2027 (hora de Venezuela) y desde el 2 de enero vuelve el normal. No necesita el emulador.
// Uso: `npm run test:navidad`.
import { existsSync } from 'node:fs';
import { esNavidad, logoDeTemporada } from '../src/utils/navidad.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const caracas = (y, m, d, h = 0, min = 0) => Date.UTC(y, m - 1, d, h + 4, min); // hora de Venezuela (UTC-4)

check('hoy (12 nov 2026) ya es Navidad', esNavidad(caracas(2026, 11, 12, 12)), true);
check('25 de diciembre', esNavidad(caracas(2026, 12, 25, 8)), true);
check('1 de enero a las 23:59 todavía está', esNavidad(caracas(2027, 1, 1, 23, 59)), true);
check('2 de enero a las 00:00 ya no', esNavidad(caracas(2027, 1, 2, 0, 0)), false);
check('después, tampoco', esNavidad(caracas(2027, 3, 1)), false);
check('elige el de Navidad mientras dura', logoDeTemporada('/normal.png', '/navidad.png', caracas(2026, 12, 20)), '/navidad.png');
check('y el normal al terminar', logoDeTemporada('/normal.png', '/navidad.png', caracas(2027, 1, 2, 0, 1)), '/normal.png');
check('las tres imágenes existen en public/navidad', ['login-192.png', 'login-512.png', 'logo-menu.png'].map((f) => existsSync(new URL(`../public/navidad/${f}`, import.meta.url))), [true, true, true]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodo bien.');
