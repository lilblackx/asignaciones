// Corre todas las pruebas de scripts/test-*.mjs, una tras otra, y dice cuáles pasaron. Termina con error si alguna falla.
//   npm test                       todas (las que usan el emulador se omiten, avisando, si el emulador no está encendido)
//   npm test -- --sin-emulador     solo las que no necesitan el emulador
//   npm test -- reglas worker      solo las que tengan alguna de esas palabras en el nombre del archivo
// Las que usan el emulador (reglas, correlativo, asignar técnico y respaldo) lo necesitan encendido: `npm run emulators` en otra terminal.
// OJO: esas pruebas borran y reescriben los datos del emulador. Si tenías datos de prueba cargados (npm run seed:emulator), vuelve a cargarlos después.
import { readdirSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const carpeta = dirname(fileURLToPath(import.meta.url));
const HOST_EMULADOR = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const LIMITE_MS = 5 * 60 * 1000;
const PROYECTO = 'seguimientons-f2026';

const args = process.argv.slice(2);
const sinEmulador = args.includes('--sin-emulador');
const palabras = args.filter((a) => !a.startsWith('--'));

const archivos = readdirSync(carpeta).filter((f) => /^test-.*\.mjs$/.test(f)).sort()
  .filter((f) => palabras.length === 0 || palabras.some((p) => f.includes(p)));

const lee = (f) => readFileSync(join(carpeta, f), 'utf8');
const usaEmulador = (f) => /EMULATOR_HOST|rules-unit-testing|initializeTestEnvironment/.test(lee(f));
// Las pruebas que cargan el Worker necesitan la condición `workerd` para resolver sus dependencias.
const usaWorker = (f) => lee(f).includes('cf-worker');

function emuladorEncendido() {
  const [host, puerto] = HOST_EMULADOR.split(':');
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: Number(puerto) }, () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false); });
  });
}

// Cada prueba del emulador arranca con la base vacía: así no dependen del orden ni de lo que dejó la anterior (el respaldo, por ejemplo, copia todo lo que haya).
async function vaciarEmulador() {
  try { await fetch(`http://${HOST_EMULADOR}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: 'DELETE' }); } catch { /* si no responde, la prueba lo dirá */ }
}

function correr(archivo) {
  return new Promise((resolve) => {
    const nodeArgs = [...(usaWorker(archivo) ? ['--conditions=workerd'] : []), join(carpeta, archivo)];
    const proceso = spawn(process.execPath, nodeArgs, { env: { ...process.env, FIRESTORE_EMULATOR_HOST: HOST_EMULADOR }, cwd: join(carpeta, '..') });
    let salida = '';
    proceso.stdout.on('data', (d) => { salida += d; });
    proceso.stderr.on('data', (d) => { salida += d; });
    const reloj = setTimeout(() => { salida += '\n(se cortó: pasó el límite de tiempo)'; proceso.kill(); }, LIMITE_MS);
    proceso.on('close', (codigo) => { clearTimeout(reloj); resolve({ codigo, salida }); });
  });
}

const hayEmulador = sinEmulador ? false : await emuladorEncendido();
if (!sinEmulador && !hayEmulador) console.log(`El emulador de Firestore no responde en ${HOST_EMULADOR}: se omiten las pruebas que lo usan.\n`);

const pasaron = [];
const fallaron = [];
const omitidas = [];
const inicio = Date.now();

for (const archivo of archivos) {
  const nombre = archivo.replace(/^test-|\.mjs$/g, '');
  if (usaEmulador(archivo) && !hayEmulador) { omitidas.push(nombre); console.log(`OMITIDA  ${nombre} (necesita el emulador)`); continue; }
  if (usaEmulador(archivo)) await vaciarEmulador();
  const t0 = Date.now();
  let { codigo, salida } = await correr(archivo);
  // El emulador a veces cancela el borrado inicial de la base ("call already cancelled", código 499) sin que la prueba tenga nada que ver: se repite una vez y se avisa.
  if (codigo !== 0 && usaEmulador(archivo) && salida.includes('call already cancelled')) {
    console.log(`REPITE   ${nombre} (el emulador canceló la llamada: se intenta una vez más)`);
    await vaciarEmulador();
    ({ codigo, salida } = await correr(archivo));
  }
  const segundos = ((Date.now() - t0) / 1000).toFixed(1);
  const casos = (salida.match(/^(PASS|OK)\b/gm) || []).length;
  const malos = (salida.match(/^(FAIL|FALLÓ)\b/gm) || []).length;
  if (codigo === 0 && malos === 0) { pasaron.push(nombre); console.log(`PASÓ     ${nombre} (${casos} casos, ${segundos}s)`); }
  else {
    fallaron.push(nombre);
    console.log(`FALLÓ    ${nombre} (código ${codigo}, ${segundos}s)`);
    const lineas = salida.split('\n');
    const relevantes = lineas.filter((l, i) => /^(FAIL|FALLÓ)\b/.test(l) || /^\s+(esperado|llegó)\b/.test(l) || (i > 0 && /^(FAIL|FALLÓ)\b/.test(lineas[i - 1])));
    console.log((relevantes.length ? relevantes : lineas.slice(-12)).map((l) => `         ${l}`).join('\n'));
  }
}

console.log(`\n${pasaron.length} pasaron, ${fallaron.length} fallaron, ${omitidas.length} omitidas, de ${archivos.length} (${((Date.now() - inicio) / 1000).toFixed(0)}s).`);
if (omitidas.length) console.log(`Omitidas: ${omitidas.join(', ')}`);
if (fallaron.length) { console.log(`Fallaron: ${fallaron.join(', ')}`); process.exit(1); }
