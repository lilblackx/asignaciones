// Datos de prueba para el perfil de ventas en los emuladores locales: el usuario "ventas" y órdenes en distintos estados y edades
// (para ver los atrasos, los filtros, el resumen por promotor y el historial), más los totales del mes.
// NUNCA toca el proyecto real: firebase-admin, al ver estas env vars, escribe solo contra los emuladores.
// Requiere que `npm run emulators` ya esté corriendo. Uso: `npm run seed:ventas` (se puede repetir: pisa lo mismo).
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { claveNombre } from '../src/utils/promotora.js';

const PROJECT_ID = 'seguimientons-f2026';
const APP_ID = 'default-app-id';
const AUTH_EMAIL_DOMAIN = 'usuarios.seguimientons-f2026.internal';

const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);
const base = db.collection('artifacts').doc(APP_ID).collection('public').doc('data');

// --- El usuario de ventas: una PROMOTORA que ve todas las instalaciones y las averías LOS ---
const email = `ventas@${AUTH_EMAIL_DOMAIN}`;
let uid;
try {
  uid = (await auth.getUserByEmail(email)).uid;
  await auth.updateUser(uid, { password: 'Ventas1234' });
} catch {
  uid = (await auth.createUser({ email, password: 'Ventas1234', emailVerified: true })).uid;
}
await base.collection('users').doc(uid).set({
  username: 'ventas', nombre: 'Ventas Demo', role: 'PROMOTORA', tecnicoAsociado: null, promotoraNombres: [], promotoraClaves: [],
  verTodasInstalaciones: true, puedeCerrar: false, disabled: false, createdAt: Date.now(), createdBy: 'seed-script',
});
console.log('OK  PROMOTORA usuario="ventas" clave="Ventas1234" (ve todas las instalaciones y las averías LOS)');

// --- Órdenes en vivo ---
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const ahora = Date.now();
const plantilla = (cliente) => `*INSTALACIÓN FINALIZADA*\n*Cliente:* ${cliente}\n*Plan:* 100 MB\n*Serial:* HWTC1A2B3C4D`;
const orden = (id, codigo, nombre, promotora, extra) => base.collection('tickets').doc(id).set({
  fecha: '', fechaProgramada: '', codigo, nombre, cedula: '12345678', tipoDocumento: 'V', direccion: `Av. Principal, casa de ${nombre}`,
  telefono: '04120000000', nap: '', tipoTrabajo: 'INSTALACIÓN', falla: 'Instalación nueva', tecnico: '', observacion: '', observacionInterna: false,
  estado: 'PENDIENTE', creado: 'usuario', createdAt: ahora, historialEdiciones: [], isAsignado: false, promotora, promotoraClave: claveNombre(promotora), ...extra,
});
await orden('v-io101', 'IO101', 'Ana Pérez', 'Sariana', { createdAt: ahora - 3 * DIA });
await orden('v-io102', 'IO102', 'Luis Gómez', 'Alexis Añez', { createdAt: ahora - 30 * HORA });
await orden('v-io103', 'IO103', 'María López', 'Sariana', { createdAt: ahora - 5 * DIA, tecnico: 'GERARDO MOLERO', isAsignado: true });
await orden('v-io104', 'IO104', 'Carlos Ruiz', 'Alexis Añez', { createdAt: ahora - HORA, tecnico: 'REINEL BRAVO', isAsignado: true });
await orden('v-io105', 'IO105', 'Rosa Díaz', 'Sariana', { createdAt: ahora - 6 * HORA, tecnico: 'GERARDO MOLERO', isAsignado: true, estado: 'PRE-FINALIZADO' });
await orden('v-io106', 'IO106', 'Pedro Mora', 'Alexis Añez', { createdAt: ahora - 8 * HORA, tecnico: 'REINEL BRAVO', isAsignado: true, estado: 'FINALIZADO', finalizadoEn: ahora - 2 * HORA, plantillaFinal: plantilla('Pedro Mora') });
const los = (id, codigo, nombre, promotora, extra) => base.collection('tickets').doc(id).set({
  codigo, nombre, cedula: '23456789', tipoDocumento: 'V', direccion: 'Calle 5', telefono: '04120000000', nap: '', tipoTrabajo: 'AVERÍA', falla: 'LOS', tecnico: '',
  observacion: '', observacionInterna: false, estado: 'PENDIENTE', creado: 'usuario', createdAt: ahora, historialEdiciones: [], isAsignado: false, promotora, promotoraClave: claveNombre(promotora), ...extra,
});
await los('v-as201', 'AS201', 'Elena Vera', 'Sariana', { createdAt: ahora - 2 * DIA });
await los('v-as202', 'AS202', 'Jorge Silva', 'Alexis Añez', { createdAt: ahora - 5 * HORA, tecnico: 'REINEL BRAVO', isAsignado: true, estado: 'FINALIZADO', finalizadoEn: ahora - HORA });

// --- Historial de las ya cerradas (lo que dejó el cierre del día) ---
const historial = (id, codigo, nombre, promotora, estado, diasAtras, extra = {}) => base.collection('historialInstalaciones').doc(id).set({
  codigo, nombre, cedula: '45678901', tipoDocumento: 'V', direccion: `Sector Centro, ${nombre}`, tecnico: 'GERARDO MOLERO', estado, tipoTrabajo: 'INSTALACIÓN', falla: '',
  creadaEn: ahora - (diasAtras + 1) * DIA, finalizadoEn: estado === 'FINALIZADO' ? ahora - diasAtras * DIA : null, promotora, promotoraClave: claveNombre(promotora),
  plantillaFinal: estado === 'FINALIZADO' ? plantilla(nombre) : '', archivadoEn: ahora - diasAtras * DIA, ...extra,
});
await historial('h-io90', 'IO90', 'Teresa Blanco', 'Sariana', 'FINALIZADO', 1);
await historial('h-io91', 'IO91', 'Miguel Soto', 'Alexis Añez', 'FINALIZADO', 2);
await historial('h-io92', 'IO92', 'Lucía Ortiz', 'Sariana', 'CANCELADO', 3);
await historial('h-io93', 'IO93', 'Andrés Peña', 'Alexis Añez', 'FINALIZADO', 5);
await historial('h-io94', 'IO94', 'Sofía Rivas', 'Sariana', 'FINALIZADO', 8);
await historial('h-io95', 'IO95', 'Héctor Luna', 'Mariela Cruz', 'FINALIZADO', 10);
await historial('h-io96', 'IO96', 'Camila Prieto', '', 'FINALIZADO', 12);
await historial('h-as80', 'AS80', 'Ramón Acosta', 'Sariana', 'FINALIZADO', 4, { tipoTrabajo: 'AVERÍA', falla: 'LOS', plantillaFinal: '' });
// Más historial para probar la paginación (se trae de a TAMANO_PAGINA): 45 más repartidas en los últimos 14 días, varias con la misma hora de archivo.
const promotoras = ['Sariana', 'Alexis Añez', 'Mariela Cruz'];
for (let i = 0; i < 45; i++) {
  await historial(`h-masivo-${String(i).padStart(2, '0')}`, `IO${200 + i}`, `Cliente de prueba ${i + 1}`, promotoras[i % 3], i % 9 === 0 ? 'CANCELADO' : 'FINALIZADO', 1 + Math.floor(i / 4) + (i % 2) * 0.01);
}
console.log('OK  8 órdenes en vivo y 53 en el historial');

// --- Totales ya cerrados del mes actual y de los dos anteriores (los que suma el cierre del día) ---
const mesDe = (desplazamiento) => {
  const d = new Date(ahora);
  d.setDate(1);
  d.setMonth(d.getMonth() - desplazamiento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const totalesMes = [
  [0, { instalacionesFinalizadas: 14, instalacionesCanceladas: 2, losResueltas: 3, losCanceladas: 0 }],
  [1, { instalacionesFinalizadas: 41, instalacionesCanceladas: 5, losResueltas: 9, losCanceladas: 1 }],
  [2, { instalacionesFinalizadas: 37, instalacionesCanceladas: 4, losResueltas: 7, losCanceladas: 0 }],
];
for (const [desplazamiento, campos] of totalesMes) await base.collection('estadisticasMensuales').doc(mesDe(desplazamiento)).set(campos);
console.log('OK  totales del mes (actual y 2 anteriores)');

console.log('\nListo. Entra a la app con ventas / Ventas1234.');
process.exit(0);
