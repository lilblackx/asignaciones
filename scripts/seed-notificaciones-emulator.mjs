// Mueve datos del emulador local mientras la app está abierta, para que la campana muestre avisos reales: un técnico se marca inactivo y activo, entran dos órdenes pre-finalizadas (oficina) y dos órdenes nuevas para Gerardo (técnico).
// Es para ver (y revisar el diseño de) el panel de Notificaciones. Requiere `npm run emulators` y la app abierta como admin o como tecnico1. Uso: `node scripts/seed-notificaciones-emulator.mjs`.
// NUNCA toca el proyecto real: firebase-admin, al ver esta env var, escribe solo contra el emulador.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore(initializeApp({ projectId: 'seguimientons-f2026' }));
const base = db.collection('artifacts').doc('default-app-id').collection('public').doc('data');
const pausa = (ms = 1500) => new Promise((resolve) => setTimeout(resolve, ms));
const ahora = Date.now();

const prefinalizada = (id, codigo, tecnico, nombre) => ({
  id, codigo, nombre, cedula: '24000111', direccion: 'Dirección de prueba', telefono: '04140000003', tecnico, estado: 'PRE-FINALIZADO', creado: 'usuario', isAsignado: true,
  tipoTrabajo: 'AVERÍA', falla: 'Sin señal', createdAt: ahora - 3600000, prefinalizadoEn: ahora, historialEdiciones: [],
});

// Se borran primero las de la vez anterior: una orden que ya existe y se vuelve a escribir igual no es un cambio y no genera aviso.
for (const id of ['notif-1', 'notif-2', 'notif-3', 'notif-4']) await base.collection('tickets').doc(id).delete();
await pausa(800);
await base.collection('technicians').doc('REINEL BRAVO').update({ activo: false });
console.log('Reinel Bravo -> inactivo');
await pausa();
await base.collection('technicians').doc('REINEL BRAVO').update({ activo: true });
console.log('Reinel Bravo -> activo');
await pausa();
await base.collection('tickets').doc('notif-1').set(prefinalizada('notif-1', 'AR701', 'GERARDO MOLERO', 'Cliente AR701'));
console.log('AR701 pre-finalizada');
await pausa();
await base.collection('tickets').doc('notif-2').set(prefinalizada('notif-2', 'AR702', 'REINEL BRAVO', 'Cliente AR702'));
console.log('AR702 pre-finalizada');
// Para el técnico (GERARDO): una orden nueva asignada y otra con prioridad alta, que le llegan como avisos en su campana.
const pendiente = (id, codigo, nombre, extra = {}) => ({
  id, codigo, nombre, cedula: '24000222', direccion: 'Dirección de prueba', telefono: '04140000004', tecnico: 'GERARDO MOLERO', estado: 'PENDIENTE', creado: 'usuario', isAsignado: true,
  tipoTrabajo: 'AVERÍA', falla: 'Sin señal', createdAt: Date.now(), historialEdiciones: [], ...extra,
});
await base.collection('tickets').doc('notif-3').set(pendiente('notif-3', 'AV801', 'Cliente AV801'));
console.log('AV801 asignada a Gerardo');
await pausa();
await base.collection('tickets').doc('notif-4').set(pendiente('notif-4', 'AV802', 'Cliente AV802', { prioridadAlta: true }));
console.log('AV802 con prioridad alta para Gerardo');
await pausa(500);
process.exit(0);
