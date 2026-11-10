// Prueba utils/tablaAngosta.js: cuando una tabla no cabe en la hoja vertical sin partir palabras, las columnas que sobran pasan a una línea gris debajo de cada fila, sin perder datos;
// las tablas que ya caben no se tocan. No necesita el emulador. Uso: `node scripts/test-tabla-angosta.mjs`.
import { ajustarTabla } from '../src/utils/tablaAngosta.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const NB = String.fromCharCode(160);
// Un carácter mide 1; cada celda suma 2 de bordes; la hoja da 30.
const medida = { ancho: (palabra) => palabra.length, util: 30, relleno: 2 };

// --- Cabe: no se toca ---
const cabe = { titulo: 'Cabe', columnas: [{ titulo: 'Orden' }, { titulo: 'Cliente' }, { titulo: 'Monto', derecha: true }], filas: [['AO1', 'Pedro', '5,00 $'], ['AO2', 'Ana', '6,00 $']] };
check('una tabla que cabe se devuelve tal cual (el mismo objeto)', ajustarTabla(cabe, medida) === cabe, true);

// --- No cabe ---
// Mínimos (la palabra más larga de cada columna más 2): Orden 7, Cliente 22, Monto 7, Forma 15, Nota 8 → suma 59 > 30. Sale Cliente (37), después Forma (22): cabe.
const ancha = {
  titulo: 'Pagos', nota: 'una nota', vacio: 'nada',
  columnas: [{ titulo: 'Orden' }, { titulo: 'Cliente' }, { titulo: 'Monto', derecha: true }, { titulo: 'Forma' }, { titulo: 'Nota' }],
  filas: [
    ['AO1', 'Hernandezzzzzzzzzzzz', '5,00 $', 'Transferencia', 'Pago de hoy'],
    ['AO2', 'Ana', '6,00 $', '', '-'],
    ['AO3', 'Luis', '7,00 $', 'Efectivo', 'Semana 45'],
  ],
};
const copia = JSON.stringify(ancha);
const r = ajustarTabla(ancha, medida);
check('no cabe: salen primero las columnas de texto más anchas, hasta que cabe (aquí Cliente y Forma)', r.columnas.map((c) => c.titulo), ['Orden', 'Monto', 'Nota']);
check('la primera columna y las numéricas se quedan', [r.columnas[0].titulo, r.columnas.some((c) => c.derecha)], ['Orden', true]);
check('cada fila trae una celda por columna que quedó', r.filas.every((f) => f.length === r.columnas.length), true);
check('las filas conservan los datos de las columnas que quedaron', r.filas, [['AO1', '5,00 $', 'Pago de hoy'], ['AO2', '6,00 $', '-'], ['AO3', '7,00 $', 'Semana 45']]);
check('lo que salió va a la línea gris con su título, en el orden de las columnas, y sin datos vacíos', r.subfilas, ['Cliente: Hernandezzzzzzzzzzzz · Forma: Transferencia', 'Cliente: Ana', 'Cliente: Luis · Forma: Efectivo']);
check('no se pierde ningún dato: todo valor no vacío está en la tabla o en la línea gris', ancha.filas.every((f, i) => f.every((v) => !v || v === '-' || r.filas[i].includes(v) || r.subfilas[i].includes(v))), true);
check('conserva el título, la nota y el texto de vacío, y no modifica la tabla original', [r.titulo, r.nota, r.vacio, JSON.stringify(ancha) === copia], ['Pagos', 'una nota', 'nada', true]);
check('es determinista', JSON.stringify(ajustarTabla(ancha, medida)), JSON.stringify(r));

// Las líneas grises que la tabla ya traía se conservan, al principio.
const conSub = { ...ancha, subfilas: ['Periodo uno', 'Periodo dos', 'Periodo tres'] };
check('si la tabla ya traía líneas grises se conservan y se les suma lo que salió', ajustarTabla(conSub, medida).subfilas, ['Periodo uno · Cliente: Hernandezzzzzzzzzzzz · Forma: Transferencia', 'Periodo dos · Cliente: Ana', 'Periodo tres · Cliente: Luis · Forma: Efectivo']);

// Las numéricas solo salen si ya no queda ninguna de texto (la primera nunca).
const numerica = { titulo: 'N', columnas: [{ titulo: 'Técnico' }, { titulo: 'Total pagado', derecha: true }, { titulo: 'Descuentos', derecha: true }, { titulo: 'Neto pagado', derecha: true }], filas: [['JOSE', '1.234,56 $', '12,00 $', '1.222,56 $']] };
// Mínimos: Técnico 9, Total pagado 10, Descuentos 12, Neto pagado 10 → 41 > 25. Sale Descuentos (29), después Total pagado (19): cabe.
const rn = ajustarTabla(numerica, { ...medida, util: 25 });
check('si solo quedan columnas numéricas, salen las más anchas (nunca la primera)', [rn.columnas.map((c) => c.titulo), rn.subfilas[0]], [['Técnico', 'Neto pagado'], 'Total pagado: 1.234,56 $ · Descuentos: 12,00 $']);

// Siempre quedan al menos dos columnas.
const tope = ajustarTabla(ancha, { ...medida, util: 3 });
check('aunque no quepa ni así, quedan al menos dos columnas', tope.columnas.length, 2);

// --- El espacio sin salto une las palabras ("1.010.845,61 Bs" es una sola) ---
const montos = { titulo: 'M', columnas: [{ titulo: 'A' }, { titulo: 'En Bs', derecha: true }, { titulo: 'Texto' }], filas: [['x', `1.010.845,61${NB}Bs`, 'corto']] };
check('el espacio sin salto no separa palabras: la columna de montos mide "1.010.845,61 Bs" entera (15 + 2 > 12)', ajustarTabla(montos, { ancho: (p) => p.length, util: 24, relleno: 2 }).columnas.map((c) => c.titulo), ['A', 'En Bs']);
check('con un espacio común sí son dos palabras: la más larga mide 12 y cabe', ajustarTabla({ ...montos, filas: [['x', '1.010.845,61 Bs', 'corto']] }, { ancho: (p) => p.length, util: 24, relleno: 2 }).columnas.map((c) => c.titulo), ['A', 'En Bs', 'Texto']);

// --- El tope ---
const larga = { titulo: 'L', columnas: [{ titulo: 'A' }, { titulo: 'Referencia' }, { titulo: 'B' }], filas: [['1', 'x'.repeat(60), '2']] };
check('el tope limita lo que se le exige a una sola columna (una referencia larguísima no vacía las demás)', ajustarTabla(larga, { ancho: (p) => p.length, util: 30, relleno: 2, tope: 10 }) === larga, true);
check('sin tope esa misma tabla sí saca la columna', ajustarTabla(larga, { ancho: (p) => p.length, util: 30, relleno: 2 }).columnas.map((c) => c.titulo), ['A', 'B']);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
