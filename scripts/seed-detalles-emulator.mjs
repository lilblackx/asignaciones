// Órdenes de prueba para los "Detalles de la orden" (fotos) en el emulador local. NUNCA toca producción: firebase-admin, al ver estas variables, escribe solo en los emuladores.
// Requiere `npm run emulators` (Firestore, Auth y Storage) y, antes, `npm run seed:emulator` (usuarios y técnicos). Entra con tecnico1 / Tecnico1234 (GERARDO MOLERO) para ver lo que le falta al técnico,
// y con admin / Admin1234 para ver las fotos ya subidas (Detalle de la orden y Revisión de órdenes). Para que una orden finalizada hoy pida los detalles, arranca la app con
// VITE_DETALLES_DESDE=2026-11-01 en .env.development.local (la fecha de inicio por defecto es posterior a hoy).
// Uso: `npm run seed:detalles`. Se puede repetir: vuelve a escribir las mismas órdenes (ids "seed-detalles-...").
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const carpeta = dirname(fileURLToPath(import.meta.url));
const app = initializeApp({ projectId: 'seguimientons-f2026', storageBucket: 'seguimientons-f2026.firebasestorage.app' });
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const tickets = db.collection('artifacts').doc('default-app-id').collection('public').doc('data').collection('tickets');

const ahora = Date.now();
const MIN = 60 * 1000;
const fecha = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const TECNICO = 'GERARDO MOLERO';

const base = (id, codigo, nombre, extra) => ({
  fecha, fechaProgramada: '', codigo, nombre, cedula: 'V-12345678', telefono: '04120000001', direccion: 'Dirección de prueba', nap: 'NAP 01 - 3',
  tipoTrabajo: 'AVERÍA', falla: 'LOS', tecnico: TECNICO, observacion: '', observacionInterna: false, estado: 'FINALIZADO',
  creado: 'usuario', createdAt: ahora - 120 * MIN, finalizadoEn: ahora - 10 * MIN, observacionTecnico: 'Trabajo de prueba terminado.',
  historialEdiciones: [], isAsignado: true, ...extra,
});
const pagoDespues = { tipo: 'DESPUES', pago: null, nota: 'Paga el viernes', compartidoCon: null, monedaDistinta: false, diferencia: false, registradoPor: 'tecnico1', registradoEn: ahora - 5 * MIN };

// Las fotos de muestra (3 imágenes pequeñas) se suben al emulador de Storage para que la galería tenga algo que mostrar.
async function subirMuestras(id) {
  const fotos = [];
  for (let i = 1; i <= 3; i += 1) {
    const bytes = readFileSync(join(carpeta, 'muestras', `foto-${i}.jpg`));
    const ruta = `ordenes/${id}/0${i}-muestra.jpg`;
    await bucket.file(ruta).save(bytes, { contentType: 'image/jpeg' });
    fotos.push({ ruta, bytes: bytes.length });
  }
  return { fotos, subidoPor: 'tecnico1', subidoEn: ahora - 3 * MIN };
}

const ordenes = {
  // Falta el pago y los detalles: la pantalla del técnico muestra el cobro, el formulario del pago y el paso 2 con las fotos.
  'seed-detalles-cobro': base('seed-detalles-cobro', 'DC1', 'Cliente con cobro (falta pago y fotos)', { tipoVisita: 'CONECTOR_EXTERNO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' }),
  // Sin cobro ni pago que registrar: solo piden los detalles.
  'seed-detalles-sin-cobro': base('seed-detalles-sin-cobro', 'DS2', 'Cliente sin cobro (solo fotos)', { falla: 'Sin señal' }),
  // Instalación: el técnico anota lo que pagó el cliente y sube las fotos.
  'seed-detalles-instalacion': base('seed-detalles-instalacion', 'DI3', 'Cliente de instalación (falta pago y fotos)', { tipoTrabajo: 'INSTALACIÓN', falla: 'SM', tipoVisita: '', nap: 'NAP 02 - 5' }),
  // El pago ya está registrado: solo faltan las fotos.
  'seed-detalles-solo-fotos': base('seed-detalles-solo-fotos', 'DF4', 'Cliente con pago registrado (solo fotos)', { falla: 'Sin señal', pagoCliente: pagoDespues }),
  // Todo completo: con 3 fotos de muestra (se ven en Detalle de la orden y en Revisión).
  // Es una avería con conector externo (lleva tarifa), para que también aparezca en la Revisión de órdenes de la oficina con su botón "Ver detalles".
  'seed-detalles-completa': { ...base('seed-detalles-completa', 'DK5', 'Cliente con fotos subidas', { tipoVisita: 'CONECTOR_EXTERNO', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', pagoCliente: pagoDespues }), detallesOrden: await subirMuestras('seed-detalles-completa') },
  // Pre-finalizadas por el técnico, para probar el asistente de la oficina ("Revisar antes de aprobar"; entra con admin / Admin1234).
  // Instalación: revisar, autorizar, valores y decisión (4 pasos).
  'seed-aprobar-instalacion': base('seed-aprobar-instalacion', 'AI7', 'Instalación por aprobar (4 pasos)', {
    estado: 'PRE-FINALIZADO', finalizadoEn: null, prefinalizadoEn: ahora - 8 * MIN, tipoTrabajo: 'INSTALACIÓN', falla: 'SM', tipoVisita: '', nap: 'NAP 02 - 5',
    instalacion: { serial: 'GPON12AB34CD', vlan: '120', metrajeInicial: 100, metrajeFinal: 220, posteadura: ['P-12'], puertosDisponibles: 4, nap: 'NAP 02', puerto: '5', conectores: { externo: { verde: 1 }, interno: { verde: 1, azul: 0 } } },
    potenciaDbm: -21.5,
  }),
  // Avería con cobro: revisar, cobro, valores y decisión (4 pasos).
  'seed-aprobar-cobro': base('seed-aprobar-cobro', 'AC8', 'Avería con cobro por aprobar (4 pasos)', {
    estado: 'PRE-FINALIZADO', finalizadoEn: null, prefinalizadoEn: ahora - 6 * MIN, tipoVisita: 'CONECTOR_EXTERNO', nap: 'NAP 03 - 2', potenciaDbm: -23.1,
  }),
  // Cambio de equipo: revisar, autorizar, cobro, valores y decisión (5 pasos).
  'seed-aprobar-cambio': base('seed-aprobar-cambio', 'AE9', 'Cambio de equipo por aprobar (5 pasos)', {
    estado: 'PRE-FINALIZADO', finalizadoEn: null, prefinalizadoEn: ahora - 4 * MIN, falla: 'Cambio de ONU', tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'GPON99AA88BB', tipoEquipoNuevo: 'ONU', nap: 'NAP 04 - 7', potenciaDbm: -20.4,
  }),
  // Pendientes del técnico, para probar el formulario de pre-finalizar por pasos (entra con tecnico1 / Tecnico1234).
  // Instalación: orden, equipo, cable y cierre (4 pasos fijos).
  'seed-pre-instalacion': base('seed-pre-instalacion', 'PI1', 'Instalación por pre-finalizar (4 pasos)', { estado: 'PENDIENTE', finalizadoEn: null, tipoTrabajo: 'INSTALACIÓN', falla: 'SM', nap: '', observacionTecnico: '' }),
  // Avería: los pasos dependen del tipo de visita que elijas (conector externo, recableado, cambio de equipo, VLAN...).
  'seed-pre-averia': base('seed-pre-averia', 'PV2', 'Avería por pre-finalizar (elige el tipo de visita)', { estado: 'PENDIENTE', finalizadoEn: null, nap: '', observacionTecnico: '', observacion: 'Revisa el conector del cliente antes de cambiar nada.' }),
  // Avería devuelta por la oficina: su motivo se ve en todos los pasos.
  'seed-pre-devuelta': base('seed-pre-devuelta', 'PD3', 'Avería devuelta por la oficina', {
    estado: 'PENDIENTE', finalizadoEn: null, nap: '', observacionTecnico: 'Quedó operativo.',
    historialEdiciones: [{ fecha: '12/11/26 6:40 p. m.', operador: 'admin', tipo: 'devuelto', detalle: 'Devuelta al técnico | Motivo: Falta la potencia óptica de la ONU y confirmar la NAP.', motivo: 'Falta la potencia óptica de la ONU y confirmar la NAP.' }],
  }),
};

for (const [id, datos] of Object.entries(ordenes)) await tickets.doc(id).set(datos);
console.log(`OK  ${Object.keys(ordenes).length} órdenes de ${TECNICO} creadas:`);
console.log('  DC1  con cobro: falta el pago y las fotos');
console.log('  DS2  sin cobro: solo faltan las fotos');
console.log('  DI3  instalación: falta el pago y las fotos');
console.log('  DF4  pago registrado: solo faltan las fotos');
console.log('  DK5  completa: con 3 fotos subidas (la oficina las ve en el detalle y en Revisión de órdenes)');
console.log('  PI1, PV2, PD3  pendientes por pre-finalizar con tecnico1: instalación (4 pasos), avería (según el tipo de visita) y una devuelta por la oficina');
console.log('  AI7, AC8, AE9  pre-finalizadas por aprobar en la oficina: instalación (4 pasos), avería con cobro (4) y cambio de equipo (5)');
console.log('\nEntra con tecnico1 / Tecnico1234 para subir las fotos, y con admin / Admin1234 para verlas.');
process.exit(0);
