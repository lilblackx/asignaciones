// Descuentos para probar en el emulador local (no toca producción): a GERARDO MOLERO y a REINEL BRAVO les deja descuentos que ya cuentan, programados de un solo pago y programados en cuotas.
// Sirve junto con `node scripts/seed-finanzas-emulator.mjs` (que deja órdenes aprobadas por pagar). Entra con finanzas / Finanzas1234 y mira Técnicos.
// Uso: `node scripts/seed-descuentos-programados-emulator.mjs`. Se puede repetir: borra todos los descuentos con motivo del emulador y los vuelve a crear.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { armarPlanDescuentos } from '../src/utils/descuentos.js';
import { diaDe } from '../src/utils/totalesMes.js';

const db = getFirestore(initializeApp({ projectId: 'seguimientons-f2026' }));
const coleccion = db.collection('artifacts').doc('default-app-id').collection('public').doc('data').collection('descuentosTecnicos');

const ahora = Date.now();
const hoy = diaDe(ahora);
const enDias = (n) => diaDe(ahora + n * 24 * 60 * 60 * 1000);

for (const d of (await coleccion.get()).docs) await d.ref.delete();

const planes = [
  // GERARDO: uno que ya cuenta, uno programado de un solo pago y un plan de 3 cuotas semanales que empieza en dos días.
  ['GERARDO MOLERO', { monto: 10, motivo: 'Equipo perdido' }, { desde: hoy, cuotas: 1, frecuencia: '' }],
  ['GERARDO MOLERO', { monto: 15, motivo: 'Multa por llegar tarde' }, { desde: enDias(7), cuotas: 1, frecuencia: '' }],
  ['GERARDO MOLERO', { monto: 60, motivo: 'Pérdida de una ONU' }, { desde: enDias(2), cuotas: 3, frecuencia: 'SEMANA' }],
  // REINEL: uno que ya cuenta, uno programado y un plan de 2 cuotas cada 15 días que empieza hoy (la primera cuota ya cuenta).
  ['REINEL BRAVO', { monto: 8, motivo: 'Material sin devolver' }, { desde: hoy, cuotas: 1, frecuencia: '' }],
  ['REINEL BRAVO', { monto: 40, motivo: 'Daño a un equipo del cliente' }, { desde: enDias(4), cuotas: 1, frecuencia: '' }],
  ['REINEL BRAVO', { monto: 50, motivo: 'Herramienta extraviada' }, { desde: hoy, cuotas: 2, frecuencia: 'QUINCENA' }],
];

let n = 0;
for (const [tecnico, datos, programacion] of planes) {
  const lista = armarPlanDescuentos(tecnico, datos, programacion, { por: 'finanzas', ahora, notificar: false, hoy });
  for (const d of lista) { await coleccion.add(d); n++; }
}
// Uno que ya se descontó en un pago de hace días (para ver el grupo "Descontados") y uno anulado.
await coleccion.add({ ...armarPlanDescuentos('GERARDO MOLERO', { monto: 5, motivo: 'Cargador no devuelto' }, { desde: hoy, cuotas: 1, frecuencia: '' }, { por: 'finanzas', ahora: ahora - 5 * 24 * 60 * 60 * 1000, hoy })[0], aplicado: 5, pagoId: 'seed' });
await coleccion.add({ ...armarPlanDescuentos('REINEL BRAVO', { monto: 12, motivo: 'Registrado por error' }, { desde: hoy, cuotas: 1, frecuencia: '' }, { por: 'finanzas', ahora: ahora - 2 * 24 * 60 * 60 * 1000, hoy })[0], anulado: true, anuladoPor: 'finanzas', anuladoEn: ahora - 24 * 60 * 60 * 1000 });
n += 2;
console.log(`OK  ${n} descuentos (${planes.length} planes) para GERARDO MOLERO y REINEL BRAVO; hoy es ${hoy}`);
console.log('    finanzas / Finanzas1234 -> Técnicos: cada uno tiene lo que se le puede pagar y descuentos que ya cuentan; los demás salen en "Descuentos programados"');
process.exit(0);
