// SOLO LECTURA. Cuenta las instalaciones activas según su promotor, para saber cuáles verá cada Promotor cuando un
// ADMIN abra la app (useCompletarPromotoras les saca el nombre de la plantilla) y cuáles quedarán sin promotor.
//
// Uso (con la llave de una cuenta de servicio con permiso de lectura en Firestore, nunca dentro del repo):
//   node scripts/revisar-promotores.mjs C:\ruta\a\llave.json
//   o: set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave.json && node scripts/revisar-promotores.mjs
// Opcional: APP_ID (por defecto "default-app-id").
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { claveNombre } from '../src/utils/promotora.js';
import { promotoraDeOrden } from '../src/utils/whatsapp.js';

const llave = process.argv[2];
initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});

const appId = process.env.APP_ID || 'default-app-id';
const CERRADAS = ['FINALIZADO', 'CANCELADO'];
const snap = await getFirestore().collection(`artifacts/${appId}/public/data/tickets`).where('tipoTrabajo', '==', 'INSTALACIÓN').get();

const porPromotor = new Map();
const sinPromotor = [];
let activas = 0;
let yaGuardadas = 0;
let sePodranCompletar = 0;
for (const d of snap.docs) {
  const t = { id: d.id, ...d.data() };
  if (CERRADAS.includes(t.estado)) continue;
  activas++;
  const nombre = t.promotoraClave !== undefined ? (t.promotora || '') : promotoraDeOrden(t);
  const clave = t.promotoraClave !== undefined ? t.promotoraClave : claveNombre(nombre);
  if (t.promotoraClave !== undefined) yaGuardadas++; else sePodranCompletar++;
  if (!clave) { sinPromotor.push(`${t.codigo || t.id} — ${t.nombre || 'sin nombre'} (${t.estado})`); continue; }
  const previo = porPromotor.get(clave) || { nombre, cuantas: 0 };
  previo.cuantas++;
  porPromotor.set(clave, previo);
}

console.log(`Instalaciones activas: ${activas}`);
console.log(`  con el promotor ya guardado en la orden: ${yaGuardadas}`);
console.log(`  sin guardar aún (las completa un ADMIN al abrir la app): ${sePodranCompletar}`);
console.log(`\nPor promotor (clave -> cuántas):`);
for (const [clave, { nombre, cuantas }] of [...porPromotor].sort((a, b) => b[1].cuantas - a[1].cuantas)) console.log(`  ${clave}  ("${nombre}")  ${cuantas}`);
console.log(`\nSin promotor (nadie las verá hasta escribirlo en Editar): ${sinPromotor.length}`);
for (const linea of sinPromotor) console.log(`  ${linea}`);
