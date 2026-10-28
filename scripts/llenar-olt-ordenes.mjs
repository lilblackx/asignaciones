// Llena UNA SOLA VEZ el campo `olt` de las órdenes que hoy ven Finanzas y la Revisión de órdenes (las activas y las archivadas en los reportes de cierre,
// desde el corte de Finanzas, más las de ORDENES_FUERA_DEL_CORTE), con la OLT que SmartOLT tiene para la cédula del cliente. Desde que se despliega la
// app, las órdenes nuevas la traen solas; esto es solo para las anteriores. No toca las que ya tienen `olt`.
//
// Por defecto NO escribe nada: cuenta y lista (cuántas son JM, cuántas no, las que SmartOLT no encontró y las dudosas). Con --aplicar escribe.
// Se puede repetir: lo ya llenado no cambia. Una consulta a SmartOLT por cédula distinta, con pausa entre una y otra.
//
// Uso (las llaves van en tu consola, nunca dentro del repo):
//   PowerShell:  $env:SMARTOLT_API_KEY="..."; node scripts/llenar-olt-ordenes.mjs C:\ruta\a\llave-firebase.json [--aplicar]
//   o con GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\a\llave-firebase.json en lugar de pasar la ruta.
// Opcionales: APP_ID (por defecto "default-app-id"), SMARTOLT_BASE_URL (por defecto el de la empresa), PAUSA_MS (por defecto 800).
// Con el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no hace falta llave de Firebase) y SMARTOLT_BASE_URL apuntando a un SmartOLT de mentira.
import { readFileSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buscarOnus } from '../cf-worker-tomodat/src/index.js';
import { itemsParaRevisar } from '../src/utils/revisionPagos.js';
import { claveOrden, rangoPagable } from '../src/utils/finanzas.js';
import { todasLasOrdenes } from '../src/utils/gestionTecnicos.js';
import { clasificarOlt, esOltJM } from '../src/utils/olt.js';
import { MIN_DIGITOS_CEDULA, soloDigitos } from '../src/utils/clienteSmartolt.js';

const aplicar = process.argv.includes('--aplicar');
const llave = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { SMARTOLT_API_KEY: process.env.SMARTOLT_API_KEY, SMARTOLT_BASE_URL: process.env.SMARTOLT_BASE_URL || 'https://networkspeed.smartolt.com' };
if (!env.SMARTOLT_API_KEY) { console.error('Falta la llave de SmartOLT: $env:SMARTOLT_API_KEY="..." (no se guarda en ningún archivo).'); process.exit(1); }
const PAUSA_MS = Number(process.env.PAUSA_MS) || 800;

initializeApp(process.env.FIRESTORE_EMULATOR_HOST
  ? { projectId: 'seguimientons-f2026' }
  : { credential: llave ? cert(JSON.parse(readFileSync(llave, 'utf8'))) : applicationDefault(), projectId: 'seguimientons-f2026' });
const db = getFirestore();
const base = `artifacts/${process.env.APP_ID || 'default-app-id'}/public/data`;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Las órdenes que ve la app: las activas y las de los reportes de cierre ---
const ticketsDocs = (await db.collection(`${base}/tickets`).get()).docs;
const reportesDocs = (await db.collection(`${base}/reports`).get()).docs;
const tickets = ticketsDocs.map((d) => ({ ...d.data(), id: d.id }));
const reportes = reportesDocs.map((d) => ({ id: d.id, ...d.data() }));
const ordenes = todasLasOrdenes(tickets, reportes);

// Las mismas que revisa Finanzas: lo pagable desde el corte y las de la excepción (el periodo elegido es "todo").
const TODO = { desde: '0000-01-01', hasta: '9999-12-31' };
const items = itemsParaRevisar({ ordenes, rango: rangoPagable(TODO), rangoElegido: TODO });
const deFinanzas = items.filter((i) => !i.registro);
const sinOlt = deFinanzas.filter((i) => !String(i.orden.olt || '').trim());
console.log(`Órdenes que ven Finanzas y la Revisión: ${deFinanzas.length}. Ya con OLT: ${deFinanzas.length - sinOlt.length}. Sin OLT: ${sinOlt.length}.`);

// --- Una consulta a SmartOLT por cédula distinta ---
const cedulaDe = (i) => soloDigitos(i.orden.cedula);
const sinCedula = sinOlt.filter((i) => cedulaDe(i).length < MIN_DIGITOS_CEDULA || cedulaDe(i).length > 12);
const cedulas = [...new Set(sinOlt.filter((i) => !sinCedula.includes(i)).map(cedulaDe))];
console.log(`Cédulas distintas a consultar en SmartOLT: ${cedulas.length} (pausa de ${PAUSA_MS} ms entre consultas).`);

const porCedula = new Map(); // cédula -> { estado, olt?, nombres? } o { estado: 'error', mensaje }
for (const [n, cedula] of cedulas.entries()) {
  try {
    porCedula.set(cedula, clasificarOlt(await buscarOnus(env, cedula)));
  } catch (error) {
    porCedula.set(cedula, { estado: 'error', mensaje: error.message });
  }
  if ((n + 1) % 25 === 0) console.log(`  ...${n + 1} de ${cedulas.length}`);
  await pausa(PAUSA_MS);
}

// --- Resultado ---
const rotulo = (i) => `${i.orden.codigo || 'S/C'} (${i.orden.nombre || 'sin nombre'}, ${i.orden.cedula || 'sin cédula'}, técnico ${i.tecnico})`;
const grupos = { jm: [], otra: [], varias: [], sinOlt: [], noEncontrada: [], error: [], sinCedula };
const paraEscribir = new Map(); // clave de la orden -> olt
for (const i of sinOlt) {
  if (sinCedula.includes(i)) continue;
  const r = porCedula.get(cedulaDe(i));
  if (r.estado === 'ok') { paraEscribir.set(i.clave, r.olt); (esOltJM(r.olt) ? grupos.jm : grupos.otra).push(i); }
  else if (r.estado === 'varias') grupos.varias.push({ i, nombres: r.nombres });
  else if (r.estado === 'sin_olt') grupos.sinOlt.push(i);
  else if (r.estado === 'no_encontrada') grupos.noEncontrada.push(i);
  else grupos.error.push({ i, mensaje: r.mensaje });
}
console.log(`\nResultado:\n  JM (JMTV CONEXIONES): ${grupos.jm.length}\n  Otra OLT: ${grupos.otra.length}\n  Varias ONU en OLT distintas (no se llenan): ${grupos.varias.length}\n  SmartOLT no dice la OLT: ${grupos.sinOlt.length}\n  Cédula no encontrada en SmartOLT: ${grupos.noEncontrada.length}\n  Cédula inválida o vacía en la orden: ${grupos.sinCedula.length}\n  Error al consultar: ${grupos.error.length}`);
const mostrar = (titulo, lista, f) => { if (lista.length) { console.log(`\n${titulo}`); lista.forEach((x) => console.log(`  - ${f(x)}`)); } };
mostrar('JM:', grupos.jm, rotulo);
mostrar('Otra OLT (nombre):', grupos.otra, (i) => `${rotulo(i)} -> ${paraEscribir.get(i.clave)}`);
mostrar('Varias ONU en OLT distintas (decide tú):', grupos.varias, ({ i, nombres }) => `${rotulo(i)} -> ${nombres.join(' / ')}`);
mostrar('SmartOLT no dice la OLT:', grupos.sinOlt, rotulo);
mostrar('Cédula no encontrada en SmartOLT:', grupos.noEncontrada, rotulo);
mostrar('Cédula inválida o vacía:', grupos.sinCedula, rotulo);
mostrar('Error al consultar (se puede repetir el script):', grupos.error, ({ i, mensaje }) => `${rotulo(i)} -> ${mensaje}`);

if (!aplicar) {
  console.log(`\nNo se escribió nada. Se llenarían ${paraEscribir.size} órdenes. Agrega --aplicar para escribir.`);
  process.exit(0);
}

// --- Escribir: en las órdenes activas y en las copias de los reportes de cierre, solo donde `olt` está vacío ---
let escritas = 0;
let lote = db.batch();
let enLote = 0;
for (const d of ticketsDocs) {
  const olt = paraEscribir.get(claveOrden({ ...d.data(), id: d.id }));
  if (!olt || String(d.data().olt || '').trim()) continue;
  lote.update(d.ref, { olt });
  escritas++;
  if (++enLote === 450) { await lote.commit(); lote = db.batch(); enLote = 0; }
}
if (enLote > 0) await lote.commit();

let enReportes = 0;
for (const r of reportesDocs) {
  await db.runTransaction(async (tx) => {
    const actual = await tx.get(r.ref);
    const detalle = actual.data().ticketsDetalle || [];
    let cambio = false;
    const nuevo = detalle.map((t) => {
      const olt = paraEscribir.get(claveOrden(t));
      if (!olt || String(t.olt || '').trim()) return t;
      cambio = true; enReportes++;
      return { ...t, olt };
    });
    if (cambio) tx.update(r.ref, { ticketsDetalle: nuevo });
  });
}
console.log(`\nListo. Órdenes activas llenadas: ${escritas}. Copias en reportes de cierre llenadas: ${enReportes}.`);
process.exit(0);
