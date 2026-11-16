// Prueba del candado de despliegues (scripts/hook-bloquear-despliegue.mjs): qué comandos de Bash rechaza fuera de main y cuáles deja pasar.
// Uso: node scripts/test-bloquear-despliegue.mjs   (no toca nada: solo ejecuta el hook con comandos de ejemplo)
import { spawnSync } from 'node:child_process';
import { ramaActual } from './bloquear-rama.mjs';

const BLOQUEAR = [
  'npx firebase deploy --only hosting',
  'firebase deploy',
  'cd cf-worker && npx wrangler deploy',
  'npm run deploy',
  'npx -y firebase-tools@latest deploy --only firestore:rules',
  "bash -c 'firebase deploy'",
  'FOO=1 firebase deploy',
  'npm run build && firebase deploy --only hosting',
];
const DEJAR_PASAR = [
  "git commit -m 'firebase deploy en el mensaje'",
  'git status',
  'npm run build',
  'npx wrangler dev',
  'firebase emulators:start',
  'echo "ya no se hace firebase deploy aqui"',
];

const rama = ramaActual(process.cwd());
if (rama === 'main') {
  console.log('Estás en main: el candado deja pasar todo; esta prueba solo tiene sentido en otra rama.');
  process.exit(0);
}
let fallos = 0;
const correr = (comando) => spawnSync('node', ['scripts/hook-bloquear-despliegue.mjs'], { input: JSON.stringify({ tool_input: { command: comando } }), env: { ...process.env, PERMITIR_DESPLIEGUE_FUERA_DE_MAIN: '' } }).status;
for (const c of BLOQUEAR) { const s = correr(c); if (s !== 2) { fallos++; console.log(`FALLA (debía bloquear, salió ${s}): ${c}`); } }
for (const c of DEJAR_PASAR) { const s = correr(c); if (s !== 0) { fallos++; console.log(`FALLA (debía dejar pasar, salió ${s}): ${c}`); } }
console.log(fallos ? `${fallos} fallas` : `OK: ${BLOQUEAR.length} bloqueados y ${DEJAR_PASAR.length} permitidos en la rama ${rama}`);
process.exit(fallos ? 1 : 0);
