// Prueba el borrador del formulario de Pre-finalizar (src/utils/borradorPrefinalizar.js): qué se guarda, cuándo se recupera y cuándo se borra. No necesita el emulador. Uso: `npm run test:borradorprefinalizar`.
import { VIGENCIA_BORRADOR_MS, camposCambiados, guardarBorrador, leerBorrador, limpiarBorradores, olvidarBorrador, olvidarBorradoresDe, ordenesConBorrador, valoresValidos, versionDeOrden } from '../src/utils/borradorPrefinalizar.js';

let failures = 0;
function check(name, actual, esperado) {
  const ok = JSON.stringify(actual) === JSON.stringify(esperado);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log('      esperado:', JSON.stringify(esperado), '\n      recibido:', JSON.stringify(actual));
}
const nuevoAlmacen = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

const ordenado = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const base = { nap: 'SN', puerto: '', serial: '', observacion: '', postes: [''], metrajeExiste: false };
const escrito = { ...base, serial: 'HWTC1A2B3C4D', observacion: 'Instalé el equipo', postes: ['P1', 'P2'], metrajeExiste: true };
const orden = { id: 'o1', estado: 'PENDIENTE', historialEdiciones: [{}, {}] };
const ahora = 1_000_000;

let a = nuevoAlmacen();
check('un formulario sin tocar no deja borrador', [guardarBorrador('jose', orden, base, base, { almacen: a, ahora }), a.length], [false, 0]);
check('lo escrito se guarda y se recupera, solo lo que cambió', [guardarBorrador('jose', orden, escrito, base, { almacen: a, ahora }), ordenado(leerBorrador('jose', 'o1', { almacen: a, ahora }).valores)], [true, ordenado({ serial: 'HWTC1A2B3C4D', observacion: 'Instalé el equipo', postes: ['P1', 'P2'], metrajeExiste: true })]);
check('lo que el técnico no tocó no se guarda: al recuperar toma lo más nuevo de la orden', Object.keys(leerBorrador('jose', 'o1', { almacen: a, ahora }).valores).includes('nap'), false);
check('un campo que vuelve a su valor original ya no cuenta como cambio', camposCambiados({ ...base, serial: 'X' }, { ...base, serial: 'X' }), {});
check('un campo vaciado a propósito sí cuenta', camposCambiados({ ...base, observacion: '' }, { ...base, observacion: 'Falta el serial' }), { observacion: '' });
check('guarda con qué versión de la orden se escribió', leerBorrador('jose', 'o1', { almacen: a, ahora }).version, versionDeOrden(orden));
check('es por técnico y por orden', [leerBorrador('reinel', 'o1', { almacen: a, ahora }), leerBorrador('jose', 'o2', { almacen: a, ahora })], [null, null]);
check('si el técnico deja el formulario como estaba, el borrador se borra', [guardarBorrador('jose', orden, base, base, { almacen: a, ahora }), leerBorrador('jose', 'o1', { almacen: a, ahora })], [false, null]);

a = nuevoAlmacen();
guardarBorrador('jose', orden, escrito, base, { almacen: a, ahora });
check('a los 7 días ya no vale y se borra', [leerBorrador('jose', 'o1', { almacen: a, ahora: ahora + VIGENCIA_BORRADOR_MS + 1 }), a.length], [null, 0]);
a = nuevoAlmacen(); a.setItem('asignaciones:borrador-prefinalizar:jose:o1', '{no es json');
check('un borrador dañado se ignora y se borra', [leerBorrador('jose', 'o1', { almacen: a, ahora }), a.length], [null, 0]);
check('solo se recuperan campos conocidos y con su tipo', valoresValidos({ serial: 'X', metrajeExiste: 'si', postes: [1], inventado: 'z', observacion: 'o' }), { serial: 'X', observacion: 'o' });
check('un texto enorme se recorta', valoresValidos({ observacion: 'x'.repeat(9000) }).observacion.length, 5000);
check('sin almacenamiento no falla', [guardarBorrador('jose', orden, escrito, base, { almacen: null, ahora }), leerBorrador('jose', 'o1', { almacen: null, ahora })], [false, null]);
const lleno = { ...nuevoAlmacen(), setItem: () => { throw new Error('QuotaExceededError'); } };
check('sin espacio no falla, solo no guarda', guardarBorrador('jose', orden, escrito, base, { almacen: lleno, ahora }), false);

// Marca en la lista y limpieza
a = nuevoAlmacen();
for (const id of ['o1', 'o2', 'o3']) guardarBorrador('jose', { id, historialEdiciones: [] }, escrito, base, { almacen: a, ahora });
guardarBorrador('reinel', { id: 'o1', historialEdiciones: [] }, escrito, base, { almacen: a, ahora });
check('las órdenes con borrador son las del técnico', [...ordenesConBorrador('jose', { almacen: a, ahora })].sort(), ['o1', 'o2', 'o3']);
const n = limpiarBorradores('jose', [{ id: 'o1', estado: 'PENDIENTE' }, { id: 'o2', estado: 'PRE-FINALIZADO' }], { almacen: a, ahora });
check('se borran los de órdenes que ya no están pendientes o no existen; los del otro técnico no se tocan', [n, [...ordenesConBorrador('jose', { almacen: a, ahora })], [...ordenesConBorrador('reinel', { almacen: a, ahora })]], [2, ['o1'], ['o1']]);
olvidarBorrador('jose', 'o1', { almacen: a });
check('olvidar uno', [...ordenesConBorrador('jose', { almacen: a, ahora })], []);
guardarBorrador('jose', { id: 'o9', historialEdiciones: [] }, escrito, base, { almacen: a, ahora });
olvidarBorradoresDe('jose', { almacen: a });
check('al cerrar sesión a mano se borran todos los suyos y los del otro técnico quedan', [[...ordenesConBorrador('jose', { almacen: a, ahora })], [...ordenesConBorrador('reinel', { almacen: a, ahora })]], [[], ['o1']]);

if (failures) { console.log(`\n${failures} pruebas fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
