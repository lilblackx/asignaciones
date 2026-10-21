// SOLO LECTURA. Lista las órdenes (vivas y archivadas en los cierres) que usan una NAP, con su código, estado, tipo y fecha: para saber a cuáles corregir o
// cancelar cuando una NAP era de prueba. No escribe nada.
//
// Uso (con la llave de una cuenta de servicio con permiso de lectura en Firestore, nunca dentro del repo):
//   node scripts/buscar-por-nap.mjs asdkjhfg125 C:\ruta\a\llave.json
//   o: set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave.json && node scripts/buscar-por-nap.mjs asdkjhfg125
// Opcional: APP_ID (por defecto "default-app-id"). La NAP se compara sin mayúsculas ni espacios de más.
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const [buscada, llave] = process.argv.slice(2);
if (!buscada) { console.log('Escribe la NAP: node scripts/buscar-por-nap.mjs <NAP> [llave.json]'); process.exit(1); }
initializeApp({
  credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(),
  projectId: 'seguimientons-f2026',
});

const appId = process.env.APP_ID || 'default-app-id';
const clave = (nap) => String(nap || '').replace(/\s+/g, ' ').trim().toUpperCase();
const objetivo = clave(buscada);
const base = getFirestore().doc(`artifacts/${appId}/public/data`);
const dia = (ms) => (ms ? new Date(Number(ms)).toLocaleDateString('es-VE') : 'sin fecha');
const linea = (t, donde) => `${String(t.codigo || 'S/C').padEnd(10)} ${String(t.estado || '').padEnd(14)} ${String(t.tipoTrabajo || '').padEnd(16)} ${dia(t.createdAt).padEnd(11)} ${donde} · ${t.nombre || 'sin nombre'}${t.tecnico ? ` · ${t.tecnico}` : ''}`;

const encontradas = [];
for (const d of (await base.collection('tickets').get()).docs) {
  const t = d.data();
  if (clave(t.nap) === objetivo) encontradas.push(linea(t, 'viva'));
}
for (const d of (await base.collection('reports').get()).docs) {
  const r = d.data();
  for (const t of r.ticketsDetalle || []) {
    if (clave(t.nap) === objetivo) encontradas.push(linea(t, `cierre ${r.fechaCierre || dia(r.createdAt)} (${d.id})`));
  }
}

console.log(`NAP "${buscada}": ${encontradas.length} ${encontradas.length === 1 ? 'orden' : 'órdenes'}`);
encontradas.forEach((l) => console.log(`  ${l}`));
process.exit(0);
