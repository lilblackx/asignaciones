// Datos de prueba para los reportes "Esperas del ciclo" y "Cobros y exoneraciones" en los emuladores locales: órdenes finalizadas de los últimos días con las
// horas del ciclo (asignación, salida, llegada, pre-finalización), una vieja sin horas, y las dos colas de la oficina (sin técnico y por
// aprobar). Antes corre `npm run seed:emulator` (usuarios y técnicos).
// NUNCA toca el proyecto real: firebase-admin, al ver estas env vars, escribe solo contra los emuladores.
// Requiere que `npm run emulators` ya esté corriendo. Uso: `npm run seed:esperas` (se puede repetir: pisa lo mismo).
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'seguimientons-f2026' });
const db = getFirestore(app);
const base = db.collection('artifacts').doc('default-app-id').collection('public').doc('data');

const MIN = 60000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const ahora = Date.now();
const fecha = (ms) => new Date(ms).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const TECNICOS = ['GERARDO MOLERO', 'REINEL BRAVO'];
const TIPOS = [['AVERÍA', 'Sin señal'], ['INSTALACIÓN', 'Instalación nueva'], ['AVERÍA', 'LOS']];

// Cómo se cerró el cobro de cada orden de prueba (las instalaciones no llevan cobro): mezcla de cobradas, exoneradas y sin registrar.
const VISITAS = ['', 'CONECTOR_INTERNO', 'RECABLEADO', 'CAMBIO_EQUIPO', 'CONECTOR_EXTERNO'];
const cobroDe = (n, tipoTrabajo) => {
  if (tipoTrabajo === 'INSTALACIÓN') return {};
  const tipoVisita = VISITAS[n % VISITAS.length];
  const base = tipoVisita ? { tipoVisita } : {};
  switch (n % 6) {
    case 0: return { ...base, cobroTipo: 'EXONERADO', cobroBs: null };
    case 1: case 2: case 3: return { ...base, cobroTipo: 'VISITA_TECNICA', cobroBs: '5.696' };
    case 4: return { ...base, cobroTipo: 'OTRO_MONTO', cobroBs: '30', cobroMoneda: 'USD' };
    default: return base;
  }
};

// Una orden finalizada con sus horas: espera de asignación, salida, viaje, trabajo y aprobación en minutos.
function finalizada(n, { haceDias, tecnico, tipo, asignar, salir, viaje, sitio, aprobar }) {
  const [tipoTrabajo, falla] = tipo;
  const creada = ahora - haceDias * DIA - 6 * HORA;
  const primer = asignar === null ? null : creada + asignar * MIN;
  const recibida = primer ?? creada;
  const salio = recibida + salir * MIN;
  const llego = salio + viaje * MIN;
  const pre = llego + sitio * MIN;
  const fin = pre + aprobar * MIN;
  return {
    id: `esperas-${n}`,
    datos: {
      fecha: fecha(creada), fechaProgramada: '', codigo: `AS${100 + n}`, nombre: `Cliente de prueba ${n}`, cedula: `V-3${String(n).padStart(7, '0')}`,
      direccion: `Dirección de prueba ${n}`, telefono: `0412000${String(n).padStart(4, '0')}`, nap: '', tipoTrabajo, falla, tecnico,
      observacion: '', observacionInterna: false, estado: 'FINALIZADO', creado: 'usuario', createdAt: creada, historialEdiciones: [], isAsignado: true,
      ...(primer ? { primerAsignadoEn: primer, asignadoEn: primer } : {}),
      salioEn: salio, llegoEn: llego, prefinalizadoEn: pre, finalizadoEn: fin,
      ...cobroDe(n, tipoTrabajo),
    },
  };
}

const ordenes = [];
let n = 1;
for (let d = 0; d < 6; d++) {
  for (const tecnico of TECNICOS) {
    const rapido = tecnico === TECNICOS[0];
    for (const tipo of TIPOS.slice(0, 2 + (d % 2))) {
      ordenes.push(finalizada(n++, {
        haceDias: d, tecnico, tipo,
        asignar: tipo[0] === 'INSTALACIÓN' ? null : 10 + ((n * 7) % 50),
        salir: (rapido ? 15 : 55) + ((n * 11) % 40), viaje: (rapido ? 20 : 35) + ((n * 5) % 25),
        sitio: tipo[0] === 'INSTALACIÓN' ? 90 + ((n * 13) % 60) : 40 + ((n * 9) % 35), aprobar: 20 + ((n * 17) % 240),
      }));
    }
  }
}
// Una finalizada de antes de que existieran las horas: no entra en ningún tramo.
ordenes.push({ id: 'esperas-vieja', datos: { fecha: fecha(ahora - DIA), fechaProgramada: '', codigo: 'AS99', nombre: 'Cliente antiguo', cedula: 'V-30000099', direccion: 'Dirección de prueba', telefono: '04120009999', nap: '', tipoTrabajo: 'AVERÍA', falla: 'Sin señal', tecnico: 'GERARDO MOLERO', observacion: '', observacionInterna: false, estado: 'FINALIZADO', creado: 'usuario', createdAt: ahora - 3 * DIA, finalizadoEn: ahora - DIA, historialEdiciones: [], isAsignado: true } });

// Las colas de la oficina: pendientes sin técnico y pre-finalizadas por aprobar.
const pendiente = (id, codigo, haceHoras, extra) => ({ id, datos: { fecha: fecha(ahora), fechaProgramada: '', codigo, nombre: `Cliente ${codigo}`, cedula: `V-4${codigo.replace(/\D/g, '').padStart(7, '0')}`, direccion: 'Dirección de prueba', telefono: '04120001111', nap: '', tipoTrabajo: 'AVERÍA', falla: 'Sin señal', tecnico: '', observacion: '', observacionInterna: false, estado: 'PENDIENTE', creado: 'usuario', createdAt: ahora - haceHoras * HORA, historialEdiciones: [], isAsignado: false, ...extra } });
ordenes.push(
  pendiente('esperas-sin-1', 'AS201', 30),
  pendiente('esperas-sin-2', 'AS202', 7),
  pendiente('esperas-sin-3', 'AS203', 1),
  pendiente('esperas-pre-1', 'AS204', 26, { tecnico: 'REINEL BRAVO', estado: 'PRE-FINALIZADO', observacionTecnico: 'Listo', prefinalizadoEn: ahora - 18 * HORA, salioEn: ahora - 22 * HORA, llegoEn: ahora - 21 * HORA, primerAsignadoEn: ahora - 25 * HORA, asignadoEn: ahora - 25 * HORA }),
  pendiente('esperas-pre-2', 'AS205', 5, { tecnico: 'GERARDO MOLERO', estado: 'PRE-FINALIZADO', observacionTecnico: 'Listo', prefinalizadoEn: ahora - 2 * HORA, salioEn: ahora - 4 * HORA, llegoEn: ahora - 3 * HORA }),
);

let lote = db.batch();
for (const { id, datos } of ordenes) lote.set(base.collection('tickets').doc(id), datos);
await lote.commit();
console.log(`OK  ${ordenes.length} órdenes de prueba para el reporte de esperas (entra con admin / Admin1234 y abre Reportes > Esperas del ciclo y Cobros y exoneraciones)`);
process.exit(0);
