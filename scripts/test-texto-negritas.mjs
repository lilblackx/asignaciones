// Prueba cómo se parte un texto con fragmentos en negrita (src/utils/textoEnriquecido.js), que usan el PDF y el Word de los reportes. No necesita el emulador.
// Uso: `node scripts/test-texto-negritas.mjs`.
import { partirNegritas } from '../src/utils/textoEnriquecido.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

check('sin fragmentos todo el texto va normal', partirNegritas('Hola mundo'), [{ texto: 'Hola mundo', negrita: false }]);
check('un fragmento en medio parte el texto en tres', partirNegritas('a NETWORK b', ['NETWORK']), [{ texto: 'a ', negrita: false }, { texto: 'NETWORK', negrita: true }, { texto: ' b', negrita: false }]);
check('un fragmento al principio o al final no deja partes vacías', [partirNegritas('NETWORK b', ['NETWORK']).length, partirNegritas('a NETWORK', ['NETWORK']).length], [2, 2]);
check('el fragmento pegado a la puntuación se separa bien', partirNegritas('a NETWORK, C.A.', ['NETWORK, C.A']), [{ texto: 'a ', negrita: false }, { texto: 'NETWORK, C.A', negrita: true }, { texto: '.', negrita: false }]);
check('si el fragmento se repite, todas las veces van en negrita', partirNegritas('X y X', ['X']).filter((p) => p.negrita).length, 2);
check('varios fragmentos: cada uno en su sitio, en el orden del texto', partirNegritas('uno dos tres', ['tres', 'uno']).map((p) => [p.negrita, p.texto]), [[true, 'uno'], [false, ' dos '], [true, 'tres']]);
check('si empiezan igual gana el más largo', partirNegritas('NETWORK SPEED', ['NETWORK', 'NETWORK SPEED']).map((p) => [p.negrita, p.texto]), [[true, 'NETWORK SPEED']]);
check('un fragmento que no está se ignora (y no distingue por tildes ni mayúsculas: se busca tal cual)', [partirNegritas('Hola', ['adiós']).map((p) => p.negrita), partirNegritas('network', ['NETWORK']).map((p) => p.negrita)], [[false], [false]]);
check('vacíos, nulos y listas raras no fallan', [partirNegritas('', ['x']), partirNegritas(null, ['x']), partirNegritas('a', null), partirNegritas('a', ['', null])].map((r) => r.map((p) => p.texto).join('|')), ['', '', 'a', 'a']);
check('lo que se parte vuelve a dar el mismo texto', partirNegritas('Este recibo a NETWORK SPEED, C.A producto', ['NETWORK SPEED, C.A']).map((p) => p.texto).join(''), 'Este recibo a NETWORK SPEED, C.A producto');

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
