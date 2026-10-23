// Datos mínimos para probar solo el módulo Revisión de órdenes en el emulador local: las tarifas, la tasa y seis órdenes finalizadas (dos técnicos), entre ellas una garantía de otro técnico
// (AS499, de la instalación IO399) que espera la decisión del administrador. No toca usuarios ni nada más y escribe despacio (una pausa entre escrituras) para no cargar la PC.
// Requiere que `npm run emulators` ya esté corriendo y que los usuarios ya estén sembrados (scripts/seed-emulator.mjs). Uso: `node scripts/seed-revision-minimo.mjs`.
// NUNCA toca el proyecto real: firebase-admin, al ver estas env vars, escribe solo contra el emulador.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { tarifasCompletas } from '../src/utils/finanzas.js';

const db = getFirestore(initializeApp({ projectId: 'seguimientons-f2026' }));
const base = db.collection('artifacts').doc('default-app-id').collection('public').doc('data');
const pausa = () => new Promise((resolve) => setTimeout(resolve, Number(process.env.SEED_PAUSA_MS) || 400));

const MIN = 60000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const ahora = Date.now();
const [GERARDO, REINEL] = ['GERARDO MOLERO', 'REINEL BRAVO'];

await base.collection('config').doc('tasaBcv').set({ montoBaseEUR: 10, tasa: 569.6, fuente: 'manual', actualizadoEn: ahora, actualizadoPor: 'seed' });
await pausa();
await base.collection('tarifasPago').doc('actual').set({ ...tarifasCompletas({ INSTALACION: 25, AVERIA: 4, MUDANZA_INTERNA: 5, MUDANZA_EXTERNA: 8, VALIDACION_NAP: 2, TRABAJO_ADICIONAL: 6, RECABLEADO: 8, LOW_SIGNAL: 3, CAMBIO_EQUIPO: 10 }), por: 'finanzas', en: ahora - 7 * DIA });
await pausa();

const visita = { tipoVisita: 'CONECTOR_INTERNO', cobroTipo: 'VISITA_TECNICA', cobroBs: '5.696' };
const orden = (id, codigo, n, tecnico, trabajo, haceDias, extra = {}) => {
  const finalizadoEn = ahora - haceDias * DIA - n * 20 * MIN;
  return {
    id, codigo, nombre: `Cliente ${codigo}`, cedula: `V-2200${n}00`, direccion: 'Dirección de prueba', telefono: '04140000001', tecnico, estado: 'FINALIZADO', creado: 'usuario', isAsignado: true,
    createdAt: finalizadoEn - 4 * HORA, prefinalizadoEn: finalizadoEn - 20 * MIN, finalizadoEn, historialEdiciones: [], ...trabajo, ...extra,
  };
};
const instalacion = { tipoTrabajo: 'INSTALACIÓN', falla: 'MR' };
const averia = { tipoTrabajo: 'AVERÍA', falla: 'Sin señal', ...visita };

const ordenes = [
  // La original: la instalación de GERARDO que falló.
  orden('rev-min-original', 'IO399', 1, GERARDO, instalacion, 3, { nombre: 'Cliente Garantía', cedula: 'V-21999999' }),
  // La garantía de otro técnico: REINEL fue a repararla. Lleva el check con su orden original y no se puede aprobar hasta decidir.
  orden('rev-min-garantia', 'AS499', 2, REINEL, averia, 1, {
    nombre: 'Cliente Garantía', cedula: 'V-21999999',
    garantiaDe: { id: 'rev-min-original', codigo: 'IO399', tecnico: GERARDO, cliente: 'Cliente Garantía' },
  }),
  orden('rev-min-3', 'IO401', 3, GERARDO, instalacion, 2),
  orden('rev-min-4', 'AS402', 4, REINEL, averia, 0),
  orden('rev-min-5', 'AS403', 5, GERARDO, averia, 0),
  // Para probar el descuento a mano ("Descuento por garantía") en una orden que no se marcó como garantía.
  orden('rev-min-6', 'IO404', 6, REINEL, instalacion, 1),
];
for (const { id, ...datos } of ordenes) {
  await base.collection('tickets').doc(id).set(datos);
  console.log(`OK  ${datos.codigo} · ${datos.tecnico}${datos.garantiaDe ? ' · garantía de otro técnico (de IO399)' : ''}`);
  await pausa();
}
console.log('Listo: entra como admin / Admin1234 → Revisión de órdenes.');
process.exit(0);
