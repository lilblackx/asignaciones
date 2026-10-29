// Cobros de prueba para ADMINISTRACION en el emulador local (no toca producción): pendientes de varios días, una instalación sin monto, cargados, uno con cambio de monto por corregir y uno anulado.
// Requiere `npm run emulators` y, antes, `npm run seed:emulator` (usuarios y técnicos). Entra con administracion / Administracion1234 (o admin / Admin1234 desde el menú, o finanzas / Finanzas1234 para
// ver la sección "Pagos de clientes"). Para ver también el historial de pagos que registraban los técnicos: `node scripts/seed-pagos-cliente-emulator.mjs`.
// Uso: `node scripts/seed-cobros-emulator.mjs`. Se puede repetir: borra todos los cobros del emulador y los vuelve a crear.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { armarCarga, armarCobro, sincronizarCobro } from '../src/utils/cobrosClientes.js';

const db = getFirestore(initializeApp({ projectId: 'seguimientons-f2026' }));
const coleccion = db.collection('artifacts').doc('default-app-id').collection('public').doc('data').collection('cobrosClientes');

const ahora = Date.now();
const HORA = 3600 * 1000;
const DIA = 24 * HORA;
for (const d of (await coleccion.get()).docs) await d.ref.delete();

const orden = (id, codigo, nombre, tecnico, extra = {}) => ({
  id, codigo, nombre, cedula: '12345678', telefono: '0414-5550142 / 0424-5550199', tecnico, tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO', estado: 'FINALIZADO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', ...extra,
});
const visita = (id, codigo, nombre, tecnico, extra) => orden(id, codigo, nombre, tecnico, extra);
const cambioEquipo = (id, codigo, nombre, tecnico, usd) => orden(id, codigo, nombre, tecnico, { falla: 'Cambio de ONU', tipoVisita: 'CAMBIO_EQUIPO', cobroBs: String(usd), cobroTipo: 'OTRO_MONTO', cobroMoneda: 'USD' });
const instalacion = (id, codigo, nombre, tecnico) => orden(id, codigo, nombre, tecnico, { tipoTrabajo: 'INSTALACIÓN', falla: 'SM', tipoVisita: '', cobroBs: '', cobroTipo: '' });

// Un cobro emitido hace `hace` milisegundos.
const emitido = (o, hace) => armarCobro(o, { por: 'usuario', ahora: ahora - hace });
const guardar = (c) => coleccion.doc(c.ticketId).set(c);

// Pendientes
await guardar(emitido(visita('co-1', 'AO410', 'Carlos Rojas', 'REINEL BRAVO'), 6 * DIA));
await guardar(emitido(cambioEquipo('co-2', 'AC415', 'María Salas', 'GERARDO MOLERO', 40), 2 * DIA));
await guardar(emitido(instalacion('co-3', 'IO418', 'José Ríos', 'REINEL BRAVO'), 3 * HORA));
await guardar(emitido(visita('co-4', 'AO420', 'Ana Torres', 'GERARDO MOLERO', { cobroBs: '8.500' }), 90 * 60000));
await guardar(emitido(instalacion('co-5', 'IO421', 'Pedro Díaz', 'GERARDO MOLERO'), 26 * HORA));

// Cargados
const cargar = (c, datos, hace) => ({ ...c, ...armarCarga(c, datos, { por: 'administracion', ahora: ahora - hace }).cambios });
await guardar(cargar(emitido(visita('co-6', 'AO400', 'Elena Mora', 'GERARDO MOLERO'), 3 * DIA), {}, 2 * DIA));
await guardar(cargar(emitido(instalacion('co-7', 'IO410', 'Sofía Peña', 'GERARDO MOLERO'), 2 * DIA), { monto: '45', moneda: 'USD' }, DIA));
await guardar(cargar(emitido(cambioEquipo('co-8', 'AC395', 'Iván Soto', 'REINEL BRAVO', 30), 5 * DIA), {}, 4 * DIA));

// Uno ya cargado cuyo monto cambió después (la oficina lo corrigió): Administración debe corregirlo en el portal.
const conCambio = cargar(emitido(visita('co-9', 'AO402', 'Raúl León', 'REINEL BRAVO'), 4 * DIA), {}, 3 * DIA);
await guardar({ ...conCambio, ...sincronizarCobro(conCambio, { ...visita('co-9', 'AO402', 'Raúl León', 'REINEL BRAVO'), cobroBs: '7.000' }, { por: 'usuario', ahora: ahora - 2 * HORA }).cambios });

// Uno anulado (la orden se canceló antes de cargarlo): no sale en ninguna lista.
const anulado = emitido(visita('co-10', 'AO403', 'Luisa Pérez', 'GERARDO MOLERO'), 2 * DIA);
await guardar({ ...anulado, ...sincronizarCobro(anulado, { ...visita('co-10', 'AO403', 'Luisa Pérez', 'GERARDO MOLERO'), estado: 'CANCELADO' }, { por: 'usuario', ahora: ahora - DIA }).cambios });

console.log('OK  10 cobros: 5 pendientes (uno de 6 días, una instalación sin monto, un cambio de equipo en $), 3 cargados, 1 cargado con cambio de monto por corregir y 1 anulado');
console.log('    administracion / Administracion1234 -> Administración: lista, "Cargar", "Devolver a pendiente" y el aviso de cambio de monto');
console.log('    finanzas / Finanzas1234 -> Finanzas > "Pagos de clientes" > "Cobros emitidos"');
process.exit(0);
