// Escribe en el historial de auditoría del inventario (auditLogs) las órdenes que ya se habían enviado antes de que el envío
// escribiera esa línea. Las toma de telecomEnvios (las ENVIADO) y escribe la misma línea que escribiría el envío: con el mismo id
// por orden, así que correrlo dos veces, o sobre una orden que ya la tiene, no duplica nada.
//
// Por defecto NO escribe nada, solo cuenta y lista. Para aplicar los cambios, agrega --aplicar.
// Uso (la llave de una cuenta de servicio de Asignaciones, nunca dentro del repo, y los datos de acceso al inventario del otro sistema):
//   set TELECOM_EMAIL=...&& set TELECOM_PASSWORD=...&& set TELECOM_API_KEY=...&& set TELECOM_PROJECT_ID=almaceninventario&& set TELECOM_APP_ID=app-telecom
//   node scripts/completar-auditoria.mjs C:\ruta\a\llave.json [--aplicar] [--desde=2026-10-01]
// Opcional: APP_ID (por defecto "default-app-id"). --desde limita a las órdenes finalizadas desde esa fecha (AAAA-MM-DD).
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { escrituraAuditoria, fechaHoraCaracas } from '../cf-worker/src/inventario.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
const desdeTexto = process.argv.find((a) => a.startsWith('--desde='))?.split('=')[1];
const desdeMs = desdeTexto ? Date.parse(`${desdeTexto}T00:00:00-04:00`) : 0;
if (desdeTexto && Number.isNaN(desdeMs)) { console.error('--desde debe ser AAAA-MM-DD.'); process.exit(1); }

const env = Object.fromEntries(['TELECOM_EMAIL', 'TELECOM_PASSWORD', 'TELECOM_API_KEY', 'TELECOM_PROJECT_ID', 'TELECOM_APP_ID'].map((k) => [k, process.env[k]]));
// El proyecto y la ruta bastan para listar; el usuario y la clave solo hacen falta al escribir.
const faltan = Object.entries(env).filter(([k, v]) => !v && (aplicar || k === 'TELECOM_PROJECT_ID' || k === 'TELECOM_APP_ID')).map(([k]) => k);
if (faltan.length) { console.error(`Faltan estas variables: ${faltan.join(', ')}.`); process.exit(1); }

initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;

const enviados = (await getFirestore().collection(`${base}/telecomEnvios`).where('estado', '==', 'ENVIADO').get()).docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((e) => e.accion && (e.finalizadoEn || 0) >= desdeMs)
  .sort((a, b) => (a.finalizadoEn || 0) - (b.finalizadoEn || 0));
console.log(`Órdenes enviadas${desdeTexto ? ` desde ${desdeTexto}` : ''}: ${enviados.length}.`);
if (!enviados.length) process.exit(0);

const lineas = enviados.map((e) => escrituraAuditoria(env, e.id, e, fechaHoraCaracas(e.finalizadoEn).fechaHora));
for (const [i, e] of enviados.entries()) console.log(`  ${aplicar ? 'escribe' : 'escribiría'}: ${e.codigo || e.id} — ${lineas[i].update.fields.accion.stringValue} (${lineas[i].update.fields.fechaHora.stringValue})`);

if (!aplicar) {
  console.log('\nNo se escribió nada. Corre de nuevo con --aplicar para guardar.');
  process.exit(0);
}

const sesion = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.TELECOM_API_KEY)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.TELECOM_EMAIL, password: env.TELECOM_PASSWORD, returnSecureToken: true }),
})).json();
if (!sesion.idToken) { console.error(`No se pudo iniciar sesión en el inventario (${sesion.error?.message || 'sin detalle'}).`); process.exit(1); }

// Una por una y sin pisar las que ya existen: así se ve qué pasó con cada orden (si sus reglas solo dejan crear, una que ya
// existía no debe tumbar a las demás).
let escritas = 0;
let yaExistian = 0;
let sinPermiso = 0;
for (const [i, linea] of lineas.entries()) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.TELECOM_PROJECT_ID}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.idToken}` },
    body: JSON.stringify({ writes: [{ ...linea, currentDocument: { exists: false } }] }),
  });
  const codigo = enviados[i].codigo || enviados[i].id;
  if (res.ok) { escritas++; continue; }
  const estado = (await res.json().catch(() => ({})))?.error?.status;
  if (estado === 'ALREADY_EXISTS') { yaExistian++; console.log(`  ${codigo}: ya tenía su línea.`); continue; }
  if (estado === 'PERMISSION_DENIED') { sinPermiso++; console.log(`  ${codigo}: sin permiso para escribir en auditLogs.`); continue; }
  console.error(`  ${codigo}: el inventario respondió ${res.status} (${estado || 'sin detalle'}).`);
}
console.log(`
Escritas: ${escritas}. Ya existían: ${yaExistian}. Sin permiso: ${sinPermiso}. Total: ${lineas.length}.`);
