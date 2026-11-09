// Prueba que los conectores (verde y azul) se dibujan en toda la app con UNA sola insignia (src/components/InsigniaConector.jsx):
// ningún otro archivo define sus propios colores de conector (fondo verde o azul con letra blanca, ni un punto de color aparte).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const archivos = [];
(function recorrer(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (/\.(jsx|js)$/.test(f)) archivos.push(p);
  }
})(raiz);

let fallas = 0;
const falla = (archivo, linea, texto) => { fallas++; console.log(`FAIL  ${relative(join(raiz, '..'), archivo)}:${linea}  ${texto}`); };
const PROPIO = /InsigniaConector\.jsx$/;

for (const archivo of archivos) {
  if (PROPIO.test(archivo)) continue;
  readFileSync(archivo, 'utf8').split('\n').forEach((linea, i) => {
    if (/\bESTILO_COLOR\b|\bPUNTO\s*=\s*\{/.test(linea)) falla(archivo, i + 1, 'define colores de conector propios');
    if (/bg-emerald-700 text-white|bg-blue-600 text-white/.test(linea) && /VERDE|AZUL|verde|azul/.test(linea)) falla(archivo, i + 1, 'pinta un conector sin InsigniaConector');
  });
}

const insignia = readFileSync(join(raiz, 'components', 'InsigniaConector.jsx'), 'utf8');
if (!/VERDE:\s*'bg-emerald-700 text-white'/.test(insignia) || !/AZUL:\s*'bg-blue-600 text-white'/.test(insignia)) falla(PROPIO.test('x') ? '' : join(raiz, 'components', 'InsigniaConector.jsx'), 0, 'la insignia ya no define el verde y el azul');

if (fallas) { console.log(`\n${fallas} problema(s)`); process.exit(1); }
console.log('PASS  los conectores se dibujan solo con InsigniaConector');
