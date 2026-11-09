// Prueba que todos los campos de la app (cajas de texto, áreas de texto, selectores y calendarios) salen de UN solo lugar: src/components/estilos.js.
// Así llevan el mismo radio (rounded-xl), borde, fondo y alturas fijas (36 px los compactos, 44 px los de formulario). Falla si:
//   1. un <input>, <textarea> o <select> pone sus clases a mano en vez de usar una constante o función de estilos.js (claseCampo, CAMPO, CAMPO_ORDEN, CAMPO_FORMULARIO, AREA_TEXTO, SELECTOR...);
//   2. un texto de clases con pinta de campo (borde gris de campo y outline-none) está fuera de estilos.js;
//   3. un campo de estilos.js trae otro radio que rounded-xl.
// Las casillas, los botones de opción, los archivos y los controles ocultos no cuentan. Para un campo nuevo, importa de estilos.js.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const archivos = [];
(function recorrer(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (/\.(jsx|js)$/.test(f)) archivos.push(p);
  }
})(raiz);

const rel = (a) => relative(join(raiz, '..'), a);
const esEstilos = (a) => a.endsWith(`components${sep}estilos.js`);
// Un campo con pinta de campo: borde gris de campo + (outline-none o foco rojo).
const esCampo = (t) => /border-zinc-[345]00/.test(t) && /((?<![:\w])outline-none|focus:border-red-[56]00?)/.test(t) && /\b(px-|pl-|py-|p-2|h-\d+)/.test(t);
const radios = (t) => [...t.matchAll(/(?<![\w:-])rounded(-[a-z0-9]+)?(?![\w-])/g)].map((m) => m[0]);

let fallas = 0;
const falla = (a, linea, texto) => { fallas++; console.log(`FAIL  ${rel(a)}:${linea}  ${texto}`); };
let controles = 0;

for (const archivo of archivos) {
  const texto = readFileSync(archivo, 'utf8');
  // 1) Cada etiqueta <input>/<textarea>/<select> (completa, aunque ocupe varias líneas).
  if (archivo.endsWith('.jsx')) {
    const re = /<(input|textarea|select|SelectMenu|CampoFecha|TelefonosField|PromotorField)\b/g;
    let m;
    while ((m = re.exec(texto))) {
      let depth = 0;
      let j = m.index;
      for (; j < texto.length; j++) {
        const c = texto[j];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0 && texto[j - 1] !== '=') break;
      }
      const etiqueta = texto.slice(m.index, j + 1);
      if (/type="(checkbox|radio|hidden|file|range)"/.test(etiqueta)) continue;
      if (/claseRol\(/.test(etiqueta)) continue; // el selector de rol de la tabla de usuarios es una insignia de color propia, no un campo de formulario
      controles++;
      // Las clases a mano son los textos sueltos dentro de className con aspecto de campo (fondo, borde, radio o foco); el ancho, la alineación y la letra sí pueden ir sueltos.
      // Cada atributo de clases (className, clase, inputClassName), con sus llaves balanceadas aunque lleve plantillas anidadas.
      const textos = [];
      for (const at of etiqueta.matchAll(/(?:className|clase|inputClassName)=/g)) {
        let i = at.index + at[0].length;
        let fin = i;
        if (etiqueta[i] === '"') fin = etiqueta.indexOf('"', i + 1) + 1;
        else if (etiqueta[i] === '{') { let d = 0; for (; fin < etiqueta.length; fin++) { if (etiqueta[fin] === '{') d++; else if (etiqueta[fin] === '}' && --d === 0) { fin++; break; } } }
        for (const x of etiqueta.slice(i, fin).matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) textos.push(x[1] ?? x[2] ?? x[3] ?? '');
      }
      if (textos.some((t) => /(bg-white|dark:bg-|(?<![:\w])border(?![\w-])|rounded|focus:)/.test(t.replace(/\$\{[^}]*\}/g, '')))) falla(archivo, texto.slice(0, m.index).split('\n').length, `<${m[1]}> con clases de aspecto a mano: usa una constante de estilos.js`);
    }
  }
  // 2) y 3) Textos de clases con pinta de campo.
  texto.split('\n').forEach((linea, i) => {
    for (const m of linea.matchAll(/'([^'\n]{40,})'|"([^"\n]{40,})"|`([^`\n]{40,})`/g)) {
      const t = m[1] || m[2] || m[3];
      if (!esCampo(t)) continue;
      if (!esEstilos(archivo)) { falla(archivo, i + 1, `clases de campo escritas fuera de estilos.js: ${t.slice(0, 70)}...`); continue; }
      const malos = radios(t).filter((r) => r !== 'rounded-xl');
      if (malos.length || radios(t).length === 0) falla(archivo, i + 1, `radio ${malos.join(', ') || '(ninguno)'}: ${t.slice(0, 70)}...`);
    }
  });
}

console.log(`\n${controles} campos revisados`);
if (fallas) { console.log(`${fallas} problema(s)`); process.exit(1); }
console.log('Todos los campos salen de estilos.js con rounded-xl');
