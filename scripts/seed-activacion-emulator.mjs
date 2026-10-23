// Datos de prueba para el reporte "Activación de técnicos" en los emuladores locales: movimientos de activar y desactivar de tres técnicos en los
// últimos 7 días (varios tramos por día, uno que cruza la medianoche, uno que sigue activo y un técnico con un solo día). Antes corre
// `npm run seed:emulator` (usuarios y técnicos).
// NUNCA toca el proyecto real: firebase-admin, al ver estas env vars, escribe solo contra los emuladores.
// Requiere que `npm run emulators` ya esté corriendo. Uso: `npm run seed:activacion` (se puede repetir: borra y vuelve a crear lo suyo).
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'seguimientons-f2026' });
const db = getFirestore(app);
const log = db.collection('artifacts').doc('default-app-id').collection('public').doc('data').collection('technicianLog');

const diaDe = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const DIA = 24 * 60 * 60 * 1000;
// Hora de Caracas (UTC-4) de hace `dias` días: "07:30" → ms.
const a = (dias, hhmm) => Date.parse(`${diaDe(Date.now() - dias * DIA)}T${hhmm}:00-04:00`);

const GERARDO = { tecnicoId: 'seed-gerardo', tecnico: 'GERARDO MOLERO' };
const REINEL = { tecnicoId: 'seed-reinel', tecnico: 'REINEL BRAVO' };
const JOSE = { tecnicoId: 'seed-jose', tecnico: 'JOSE' };

// [técnico, activo, momento, quién lo hizo]
const MOVIMIENTOS = [
  // GERARDO: jornada larga cada día, con un descanso al mediodía; el de hace 2 días termina pasada la medianoche.
  [GERARDO, true, a(5, '07:30')], [GERARDO, false, a(5, '12:00')], [GERARDO, true, a(5, '13:00')], [GERARDO, false, a(5, '17:45')],
  [GERARDO, true, a(4, '07:15')], [GERARDO, false, a(4, '16:30')],
  [GERARDO, true, a(3, '08:00')], [GERARDO, false, a(3, '11:30')], [GERARDO, true, a(3, '12:30')], [GERARDO, false, a(3, '18:00')],
  [GERARDO, true, a(2, '14:00')], [GERARDO, false, a(1, '02:20')],
  [GERARDO, true, a(1, '07:45')], [GERARDO, false, a(1, '19:10')],
  [GERARDO, true, a(0, '07:20')],
  // REINEL: tramos cortos y varios por día.
  [REINEL, true, a(4, '09:00')], [REINEL, false, a(4, '10:15')], [REINEL, true, a(4, '15:00')], [REINEL, false, a(4, '16:40')],
  [REINEL, true, a(2, '08:30')], [REINEL, false, a(2, '09:00')], [REINEL, true, a(2, '10:00')], [REINEL, false, a(2, '13:30')], [REINEL, true, a(2, '14:30')], [REINEL, false, a(2, '17:00')],
  [REINEL, true, a(0, '08:10')], [REINEL, false, a(0, '08:40')],
  // JOSE: un solo día, un solo tramo (no hay nada anterior y lo que sigue no se conoce).
  [JOSE, true, a(6, '10:00')], [JOSE, false, a(6, '14:20')],
];

// Los marcados con `por`: la mayoría los activa el propio técnico; algunos los hace el administrador.
const POR = (i, t) => (i % 5 === 4 ? { por: 'admin', rol: 'ADMIN' } : { por: t.tecnico, rol: 'TECNICO' });

const previos = await log.get();
const borrar = previos.docs.filter((d) => d.id.startsWith('activacion-'));
await Promise.all(borrar.map((d) => d.ref.delete()));

let i = 0;
for (const [t, activo, en] of MOVIMIENTOS) {
  if (en > Date.now()) continue;
  i += 1;
  await log.doc(`activacion-${String(i).padStart(2, '0')}`).set({ ...t, activo, en, dia: diaDe(en), ...POR(i, t) });
}
console.log(`Listo: ${i} movimientos de activación (${borrar.length} anteriores borrados). Abre Reportes → Activación de técnicos.`);
