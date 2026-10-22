// Prueba el respaldo y la restauración de Firestore contra el emulador: respaldar, borrar y cambiar datos, y restaurar (primero solo lo que falta, luego todo).
// Uso: npx firebase emulators:exec --only firestore "node scripts/test-respaldo.mjs"
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initializeApp } from 'firebase-admin/app';
import { Timestamp, GeoPoint, getFirestore } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('Corre esto con el emulador (FIRESTORE_EMULATOR_HOST).'); process.exit(1); }
initializeApp({ projectId: 'seguimientons-f2026' });
const db = getFirestore();
const APP_ID = 'test-respaldo';
const base = `artifacts/${APP_ID}/public/data`;
const env = { ...process.env, APP_ID };
const tmp = mkdtempSync(join(tmpdir(), 'respaldo-'));

let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'OK ' : 'FALLA'} ${msg}`); if (!cond) fallos++; };
const correr = (script, ...args) => execFileSync('node', [script, ...args], { env, encoding: 'utf8' });
const leer = async (ruta) => (await db.doc(`${base}/${ruta}`).get());

const fecha = Timestamp.fromDate(new Date('2026-10-20T15:30:00Z'));
await db.doc(`${base}/tickets/t1`).set({ codigo: 'AS1', estado: 'PENDIENTE', creado: fecha, ubicacion: new GeoPoint(10.5, -66.9), otro: db.doc(`${base}/tickets/t2`), lista: [{ monto: 5, hora: fecha }] });
await db.doc(`${base}/tickets/t2`).set({ codigo: 'AS2', estado: 'FINALIZADO' });
await db.doc(`${base}/pagosTecnicos/p1`).set({ total: 12.5, tecnico: 'GERARDO' });

// 1. Respaldo
const salida = correr('scripts/respaldar-firestore.mjs', tmp);
ok(/3 documentos de 2 colecciones/.test(salida), 'el respaldo cuenta 3 documentos de 2 colecciones');
const carpeta = join(tmp, salida.trim().split('\n').pop().split(' guardados en ')[1].replace(`${tmp}\\`, '').replace(`${tmp}/`, ''));
ok(JSON.parse(readFileSync(join(carpeta, 'resumen.json'), 'utf8')).totalDocumentos === 3, 'resumen.json tiene el total');

// 2. Se borra t1, se cambia t2 y se agrega un documento nuevo
await db.doc(`${base}/tickets/t1`).delete();
await db.doc(`${base}/tickets/t2`).update({ estado: 'CANCELADO' });
await db.doc(`${base}/tickets/nuevo`).set({ codigo: 'NUEVO' });

// 3. Sin --aplicar no escribe
correr('scripts/restaurar-firestore.mjs', carpeta);
ok(!(await leer('tickets/t1')).exists, 'sin --aplicar no se restauró nada');

// 4. Solo faltantes: vuelve t1, t2 queda con su cambio
correr('scripts/restaurar-firestore.mjs', carpeta, '--solo-faltantes', '--aplicar');
const t1 = (await leer('tickets/t1')).data();
ok(!!t1 && t1.codigo === 'AS1', '--solo-faltantes devolvió el documento borrado');
ok((await leer('tickets/t2')).data().estado === 'CANCELADO', '--solo-faltantes no pisó el documento que sigue existiendo');
ok(t1.creado instanceof Timestamp && t1.creado.isEqual(fecha), 'la fecha volvió como Timestamp igual');
ok(t1.ubicacion instanceof GeoPoint && t1.ubicacion.latitude === 10.5, 'la coordenada volvió como GeoPoint');
ok(t1.otro?.path === `${base}/tickets/t2`, 'la referencia volvió como referencia');
ok(t1.lista[0].hora.isEqual(fecha) && t1.lista[0].monto === 5, 'las fechas dentro de listas volvieron bien');

// 5. Completa: t2 vuelve a como estaba; el documento nuevo no se borra
correr('scripts/restaurar-firestore.mjs', carpeta, '--aplicar');
ok((await leer('tickets/t2')).data().estado === 'FINALIZADO', 'la restauración completa devolvió t2 a su versión del respaldo');
ok((await leer('tickets/nuevo')).exists, 'la restauración no borra lo que no estaba en el respaldo');

// 6. --solo limita las colecciones
await db.doc(`${base}/pagosTecnicos/p1`).delete();
await db.doc(`${base}/tickets/t2`).update({ estado: 'OTRO' });
correr('scripts/restaurar-firestore.mjs', carpeta, '--solo=pagosTecnicos', '--aplicar');
ok((await leer('pagosTecnicos/p1')).exists, '--solo restauró la colección pedida');
ok((await leer('tickets/t2')).data().estado === 'OTRO', '--solo no tocó las demás colecciones');

rmSync(tmp, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
