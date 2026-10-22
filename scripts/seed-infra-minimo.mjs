// Datos mínimos para probar solo el módulo de Infraestructura en el emulador local: el usuario infra / Infra1234 y siete instalaciones finalizadas (tres vivas y cuatro archivadas en dos cierres), con NAP y
// puerto, más una avería y una instalación sin finalizar que NO deben verse. Escribe despacio (una pausa entre escrituras) para no cargar la PC.
// Requiere que `npm run emulators` ya esté corriendo. Uso: `node scripts/seed-infra-minimo.mjs`.
// NUNCA toca el proyecto real: firebase-admin, al ver estas env vars, escribe solo contra el emulador.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'seguimientons-f2026' });
const auth = getAuth(app);
const base = getFirestore(app).collection('artifacts').doc('default-app-id').collection('public').doc('data');
const pausa = () => new Promise((resolve) => setTimeout(resolve, Number(process.env.SEED_PAUSA_MS) || 400));

const email = 'infra@usuarios.seguimientons-f2026.internal';
let uid;
try { uid = (await auth.getUserByEmail(email)).uid; await auth.updateUser(uid, { password: 'Infra1234' }); } catch { uid = (await auth.createUser({ email, password: 'Infra1234', emailVerified: true })).uid; }
await base.collection('users').doc(uid).set({ username: 'infra', nombre: 'Infraestructura Demo', role: 'INFRAESTRUCTURA', tecnicoAsociado: null, promotoraNombres: [], promotoraClaves: [], puedeCerrar: false, disabled: false, createdAt: Date.now(), createdBy: 'seed-script' });
console.log('OK  usuario infra / Infra1234');
await pausa();

const MIN = 60000;
const DIA = 24 * 60 * MIN;
const ahora = Date.now();
const [GERARDO, REINEL] = ['GERARDO MOLERO', 'REINEL BRAVO'];
const instalacion = (id, codigo, n, tecnico, haceDias, nap, puerto, libres, extra = {}) => ({
  id, codigo, nombre: `Cliente ${codigo}`, cedula: `V-3300${n}00`, direccion: `Urbanización de prueba, calle ${n}, casa ${n * 3}`, telefono: '04140000001', tecnico, tipoTrabajo: 'INSTALACIÓN', estado: 'FINALIZADO', creado: 'usuario',
  createdAt: ahora - haceDias * DIA - 5 * 60 * MIN, finalizadoEn: ahora - haceDias * DIA - n * 10 * MIN, nap: `${nap} - Puerto ${puerto}`, instalacion: { nap, puerto: String(puerto), puertosDisponibles: String(libres) },
  // Plantilla final ya guardada (la tienen todas menos IO603, para ver el botón apagado de una orden sin plantilla).
  ...(codigo === 'IO603' ? {} : { plantillaFinal: `*INSTALACIÓN ${codigo}*
Cliente: Cliente ${codigo}
Cédula: V-3300${n}00
NAP: ${nap} - Puerto ${puerto}
Técnico: ${tecnico}` }), ...extra,
});

const vivas = [
  instalacion('infra-1', 'IO601', 1, GERARDO, 0, 'O02D10', 3, 5),
  instalacion('infra-2', 'IO602', 2, REINEL, 0, 'N10D14', 7, 0),
  instalacion('infra-3', 'IO603', 3, GERARDO, 1, 'DM-SN-01', 2, 12),
  // No deben verse: una avería y una instalación que aún no se finaliza.
  { id: 'infra-no-1', codigo: 'AS610', nombre: 'Avería', cedula: 'V-1', direccion: 'x', tecnico: GERARDO, tipoTrabajo: 'AVERÍA', falla: 'Sin señal', estado: 'FINALIZADO', createdAt: ahora - DIA, finalizadoEn: ahora - DIA },
  { id: 'infra-no-2', codigo: 'IO611', nombre: 'Instalación pendiente', cedula: 'V-2', direccion: 'x', tecnico: '', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', createdAt: ahora - DIA },
];
for (const { id, ...datos } of vivas) { await base.collection('tickets').doc(id).set(datos); console.log(`OK  ${datos.codigo}`); await pausa(); }

const cierre = (id, haceDias, ticketsDetalle) => ({ tipoReporte: 'CIERRE', createdAt: ahora - haceDias * DIA, fechaCierre: new Date(ahora - haceDias * DIA).toLocaleDateString('es-VE'), horaCierre: '20:00', operador: 'admin', total: ticketsDetalle.length, ticketsDetalle });
await base.collection('reports').doc('infra-cierre-1').set(cierre('infra-cierre-1', 3, [
  instalacion('infra-4', 'IO604', 4, REINEL, 3, 'O02D10', 4, 4),
  instalacion('infra-5', 'IO605', 5, GERARDO, 3, 'O07H12', 1, 8),
  { id: 'infra-no-3', codigo: 'AS612', nombre: 'Avería archivada', cedula: 'V-3', direccion: 'x', tecnico: REINEL, tipoTrabajo: 'AVERÍA', estado: 'FINALIZADO', finalizadoEn: ahora - 3 * DIA },
]));
console.log('OK  cierre de hace 3 días');
await pausa();
await base.collection('reports').doc('infra-cierre-2').set(cierre('infra-cierre-2', 15, [
  instalacion('infra-6', 'IO606', 6, GERARDO, 15, 'N10D14', 8, 0),
  instalacion('infra-7', 'IO607', 7, REINEL, 15, 'G-SN03', 5, 3),
]));
console.log('OK  cierre de hace 15 días');
console.log('Listo: entra como infra / Infra1234 (o como admin → Infraestructura).');
process.exit(0);
