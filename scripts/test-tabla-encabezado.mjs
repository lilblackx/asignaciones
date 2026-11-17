// Prueba que todos los títulos de la tabla de órdenes (src/components/TicketsTable.jsx) se ven iguales: sin ícono, sin cursor de botón y sin fondo al pasar el mouse (antes FALLA / TRABAJO se resaltaba y llevaba un ícono de orden;
// ordenar por tipo de trabajo se hace desde "Ordenar" en los filtros). No necesita el emulador.
// Uso: `npm run test:encabezado`.
import { readFileSync } from 'node:fs';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const tabla = readFileSync('src/components/TicketsTable.jsx', 'utf8');
const thead = tabla.slice(tabla.indexOf('<thead'), tabla.indexOf('</thead>'));
const titulos = [...thead.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/g)].map((m) => ({ atributos: m[1], contenido: m[2].trim() }));
check('los 8 títulos de la tabla', titulos.map((t) => t.contenido), ['CÓDIGO', 'NOMBRE', 'CÉDULA', 'DIRECCIÓN', 'FALLA / TRABAJO', 'TÉCNICO', 'ESTADO', 'ACCIONES']);
check('ningún título es clicable ni cambia al pasar el mouse (cursor, hover, grupo o clic)', titulos.every((t) => !/cursor-pointer|hover:|group|onClick|title=/.test(t.atributos)), true);
check('ningún título lleva ícono ni elementos dentro: solo el texto', titulos.every((t) => !/</.test(t.contenido)), true);
check('todos llevan el mismo borde, relleno y alineación', titulos.slice(0, 7).every((t) => /px-3 py-3 w-\[[^\]]+\](?: min-\[1440px\]:w-\[[^\]]+\])? align-middle text-center/.test(t.atributos)), true);
check('ordenar por tipo de trabajo sigue en el menú "Ordenar" de los filtros', readFileSync('src/components/FiltersBar.jsx', 'utf8').includes("{ value: 'TIPO_TRABAJO', label: 'Tipo de Trabajo (A-Z)' }"), true);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
