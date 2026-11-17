// Datos para probar el módulo Materiales (Almacén) en el emulador local: órdenes ya finalizadas de dos técnicos con metros de cable y conectores (recableados, instalaciones con serial, una visita
// de conector y un cambio de equipo), repartidas en los últimos días, y una pre-finalizada que espera aprobación. No toca usuarios ni nada más y escribe despacio para no cargar la PC.
// Requiere que `npm run emulators` ya esté corriendo y que los usuarios ya estén sembrados (scripts/seed-emulator.mjs). Uso: `node scripts/seed-materiales-emulator.mjs`.
// NUNCA toca el proyecto real: firebase-admin, al ver esta env var, escribe solo contra el emulador.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore(initializeApp({ projectId: 'seguimientons-f2026' }));
const base = db.collection('artifacts').doc('default-app-id').collection('public').doc('data');
const pausa = () => new Promise((resolve) => setTimeout(resolve, Number(process.env.SEED_PAUSA_MS) || 300));

const MIN = 60000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const ahora = Date.now();
const [GERARDO, REINEL] = ['GERARDO MOLERO', 'REINEL BRAVO'];

const orden = (id, codigo, n, tecnico, trabajo, haceDias, extra = {}) => {
  const finalizadoEn = ahora - haceDias * DIA - n * 15 * MIN;
  return {
    id, codigo, nombre: `Cliente ${codigo}`, cedula: `V-2300${n}00`, direccion: 'Dirección de prueba', telefono: '04140000002', tecnico, estado: 'FINALIZADO', creado: 'usuario', isAsignado: true,
    createdAt: finalizadoEn - 4 * HORA, prefinalizadoEn: finalizadoEn - 20 * MIN, finalizadoEn, historialEdiciones: [], ...trabajo, ...extra,
  };
};
const averia = (tipoVisita, extra = {}) => ({ tipoTrabajo: 'AVERÍA', falla: 'Sin señal', tipoVisita, ...extra });
const instalacion = (serial, metraje, conectores, extra = {}) => ({ tipoTrabajo: 'INSTALACIÓN', falla: 'MTV', instalacion: { serial, vlan: '110', nap: 'NAP 08', puerto: '3', metraje, conectores }, ...extra });

const ordenes = [
  // GERARDO: dos recableados, una instalación y una visita de conector.
  orden('mat-1', 'AR501', 1, GERARDO, averia('RECABLEADO', { metrosCable: 120, conectorExterno: 'VERDE', conectorInterno: 'AZUL' }), 0),
  orden('mat-2', 'AR502', 2, GERARDO, averia('RECABLEADO', { metrosCable: 85, conectorInterno: 'VERDE' }), 1),
  orden('mat-3', 'IN503', 3, GERARDO, instalacion('HWTC1A2B3C4D', 180, { externo: { verde: 1 }, interno: { verde: 1, azul: 1 } }), 2),
  orden('mat-4', 'AV504', 4, GERARDO, averia('CONECTOR_EXTERNO', { conectoresUsados: { verde: 2, azul: 0 }, conectorExterno: 'VERDE' }), 3),
  // REINEL: un recableado, dos instalaciones y un cambio de equipo.
  orden('mat-5', 'AR505', 5, REINEL, averia('RECABLEADO', { metrosCable: 60, conectorExterno: 'AZUL' }), 0),
  orden('mat-6', 'IN506', 6, REINEL, instalacion('ZTEG9F8E7D6C', 220, { externo: { verde: 1 }, interno: { verde: 2, azul: 0 } }), 1),
  orden('mat-7', 'IN507', 7, REINEL, instalacion('HWTC5A5B5C5D', 140, { externo: { verde: 0 }, interno: { verde: 1, azul: 1 } }), 4),
  orden('mat-8', 'AC508', 8, REINEL, averia('CAMBIO_EQUIPO', { serialEquipo: 'HWTC99887766', tipoEquipoNuevo: 'ONU' }), 2),
  // Una pre-finalizada: espera aprobación y se avisa aparte, sin sumarse.
  orden('mat-9', 'AR509', 9, REINEL, averia('RECABLEADO', { metrosCable: 40, conectorInterno: 'VERDE' }), 0, { estado: 'PRE-FINALIZADO', finalizadoEn: null }),
];

for (const { id, ...datos } of ordenes) {
  await base.collection('tickets').doc(id).set(datos);
  console.log(`OK  ${datos.codigo} · ${datos.tecnico} · ${datos.estado}`);
  await pausa();
}
console.log('Listo: entra como admin / Admin1234 → Almacén (o almacen / Almacen1234).');
process.exit(0);
