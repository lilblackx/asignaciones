// Hook de Claude Code (PreToolUse, herramienta Bash): rechaza los comandos de despliegue (firebase deploy, wrangler deploy, npm run deploy) cuando la rama
// actual no es main (ver scripts/bloquear-rama.mjs). Sale con 2 para bloquear; el mensaje de stderr le llega a Claude.
import { readFileSync } from 'node:fs';
import { ramaActual, motivoDeBloqueo } from './bloquear-rama.mjs';

// Solo cuenta el comando cuando empieza una instrucción (al inicio, tras ; & | o salto de línea, con o sin npx o sh -c delante): así el texto de un
// mensaje de commit o de un archivo que nombre "firebase deploy" no lo dispara.
const INICIO = String.raw`(?:^|[;&|\n(])\s*(?:[A-Za-z_]\w*=\S*\s+)*(?:(?:npx|pnpx|bunx|yarn|pnpm(?:\s+dlx)?|npm\s+exec|cmd(?:\.exe)?\s+/c|(?:ba)?sh\s+-c\s+["'])\s*(?:--?\w[\w-]*\s+)*)?`;
const DESPLIEGUE = new RegExp(`${INICIO}(?:(?:firebase(?:\\.cmd)?|firebase-tools|wrangler)(?:@\\S+)?\\b[^|;&\\n]*\\bdeploy\\b|npm\\s+(?:run\\s+)?deploy\\b)`, 'i');

let comando = '';
try {
  comando = JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command || '';
} catch {
  process.exit(0);
}
if (!DESPLIEGUE.test(comando)) process.exit(0);
const motivo = motivoDeBloqueo(ramaActual(process.env.CLAUDE_PROJECT_DIR || process.cwd()));
if (motivo) {
  console.error(motivo);
  process.exit(2);
}
