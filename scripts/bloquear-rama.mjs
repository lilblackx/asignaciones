// Candado de despliegues: solo se despliega desde la rama `main`. Cualquier otra (por ejemplo `rediseno`, donde se prueba el rediseño de la app) se rechaza.
// Se usa en tres sitios: el `predeploy` del hosting (firebase.json), el script `deploy` de los Workers (package.json) y el hook de Claude Code
// (scripts/hook-bloquear-despliegue.mjs). Si no se puede saber la rama, también se rechaza (mejor un falso bloqueo que un despliegue por error).
// Saltarlo a propósito, una sola vez: PERMITIR_DESPLIEGUE_FUERA_DE_MAIN=1 (por ejemplo en un canal de prueba de hosting).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const RAMAS_QUE_DESPLIEGAN = ['main'];

export function ramaActual(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

// null si se puede desplegar; si no, el motivo.
export function motivoDeBloqueo(rama, env = process.env) {
  if (env.PERMITIR_DESPLIEGUE_FUERA_DE_MAIN === '1') return null;
  if (rama && RAMAS_QUE_DESPLIEGAN.includes(rama)) return null;
  return rama
    ? `DESPLIEGUE BLOQUEADO: estás en la rama "${rama}" y solo se despliega desde ${RAMAS_QUE_DESPLIEGAN.join(' o ')}. Pasa tus cambios a main primero.`
    : 'DESPLIEGUE BLOQUEADO: no se pudo saber en qué rama estás (¿git no está disponible?).';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const motivo = motivoDeBloqueo(ramaActual());
  if (motivo) {
    console.error(`\n${motivo}\n(Para saltarlo a propósito: PERMITIR_DESPLIEGUE_FUERA_DE_MAIN=1)\n`);
    process.exit(1);
  }
}
