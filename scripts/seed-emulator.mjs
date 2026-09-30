// Crea usuarios y datos de prueba en los emuladores locales (Auth + Firestore).
// NUNCA toca el proyecto real: firebase-admin, al ver estas env vars, escribe
// solo contra los emuladores. Requiere que `npm run emulators` ya esté corriendo.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'seguimientons-f2026';
const APP_ID = 'default-app-id';
const AUTH_EMAIL_DOMAIN = 'usuarios.seguimientons-f2026.internal';

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);
const base = db.collection('artifacts').doc(APP_ID).collection('public').doc('data');

const usernameToEmail = (u) => `${u}@${AUTH_EMAIL_DOMAIN}`;

async function upsertUser({ username, password, nombre, role, tecnicoAsociado, puedeCerrar }) {
  const email = usernameToEmail(username);
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password });
  } catch {
    const created = await auth.createUser({ email, password, emailVerified: true });
    uid = created.uid;
  }
  await base.collection('users').doc(uid).set({
    username, nombre, role,
    tecnicoAsociado: role === 'TECNICO' ? (tecnicoAsociado || '').trim() : null,
    puedeCerrar: !!puedeCerrar,
    disabled: false,
    createdAt: Date.now(),
    createdBy: 'seed-script'
  });
  console.log(`OK  ${role.padEnd(8)} usuario="${username}" clave="${password}"`);
  return uid;
}

const TECHS = [
  { name: 'GERARDO MOLERO', color: 'bg-fuchsia-500 text-white' },
  { name: 'REINEL BRAVO', color: 'bg-green-500 text-white' }
];

for (const t of TECHS) {
  await base.collection('technicians').doc(t.name.replace(/\s+/g, '-')).set(t);
}
console.log(`OK  ${TECHS.length} técnicos creados`);

await upsertUser({ username: 'admin', password: 'Admin1234', nombre: 'Admin Demo', role: 'ADMIN' });
await upsertUser({ username: 'usuario', password: 'Usuario1234', nombre: 'Usuario Demo', role: 'USUARIO', puedeCerrar: true });
await upsertUser({ username: 'tecnico1', password: 'Tecnico1234', nombre: 'Gerardo Molero', role: 'TECNICO', tecnicoAsociado: 'GERARDO MOLERO' });
await upsertUser({ username: 'tecnico2', password: 'Tecnico1234', nombre: 'Reinel Bravo', role: 'TECNICO', tecnicoAsociado: 'REINEL BRAVO' });

await base.collection('tickets').doc('seed-ticket-gerardo').set({
  fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  fechaProgramada: '', codigo: 'AS1', nombre: 'Cliente de Gerardo', cedula: 'V-11111111',
  direccion: 'Dirección de prueba 1', telefono: '04120000001', nap: '',
  tipoTrabajo: 'AVERÍA', falla: 'Sin señal', tecnico: 'GERARDO MOLERO',
  observacion: '', observacionInterna: false, estado: 'PENDIENTE',
  creado: 'usuario', createdAt: Date.now(), historialEdiciones: [], isAsignado: true
});

await base.collection('tickets').doc('seed-ticket-reinel').set({
  fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  fechaProgramada: '', codigo: 'AS2', nombre: 'Cliente de Reinel', cedula: 'V-22222222',
  direccion: 'Dirección de prueba 2', telefono: '04120000002', nap: '',
  tipoTrabajo: 'INSTALACIÓN', falla: 'Instalación nueva', tecnico: 'REINEL BRAVO',
  observacion: '', observacionInterna: false, estado: 'PENDIENTE',
  creado: 'usuario', createdAt: Date.now(), historialEdiciones: [], isAsignado: true
});
console.log('OK  2 tickets de prueba creados (uno por técnico)');

console.log('\nListo. Login en la app con cualquiera de estos usuarios (usuario/clave, NO el email):');
console.log('  admin / Admin1234        -> ve y edita todo');
console.log('  usuario / Usuario1234    -> ve y edita todo, puede cerrar día y aprobar');
console.log('  tecnico1 / Tecnico1234   -> solo ve el ticket AS1 (GERARDO MOLERO)');
console.log('  tecnico2 / Tecnico1234   -> solo ve el ticket AS2 (REINEL BRAVO)');
process.exit(0);
