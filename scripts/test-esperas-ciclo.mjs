// Prueba "Esperas del ciclo": las horas que se guardan en la orden (src/utils/tiemposOrden.js) y los tramos del reporte
// (src/utils/esperasCiclo.js). No necesita el emulador.
// Uso: `npm run test:esperas`.
import { camposTiempos } from '../src/utils/tiemposOrden.js';
import { INICIO_REGISTRO_HORAS, colasDeLaOficina, duracionesDeOrden, esperasDelCiclo } from '../src/utils/esperasCiclo.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const MIN = 60000;
const T0 = INICIO_REGISTRO_HORAS + 1000 * MIN;
const orden = { id: 'a', estado: 'PENDIENTE', tecnico: 'GERARDO', tipoTrabajo: 'AVERÍA' };

// --- Qué horas se guardan ---
check('una orden nueva no guarda horas', camposTiempos(null, orden, T0), {});
check('sin cambios no guarda nada', camposTiempos(orden, { ...orden }, T0), {});
check('asignar técnico a una orden sin técnico guarda las dos horas de asignación',
  camposTiempos({ ...orden, tecnico: '' }, orden, T0), { asignadoEn: T0, primerAsignadoEn: T0, salioEn: null, llegoEn: null });
check('pasarla a otro técnico solo cambia asignadoEn y reinicia el viaje',
  camposTiempos({ ...orden, primerAsignadoEn: T0 }, { ...orden, tecnico: 'REINEL' }, T0 + 5 * MIN), { asignadoEn: T0 + 5 * MIN, salioEn: null, llegoEn: null });
check('la primera asignación no se vuelve a escribir',
  Object.keys(camposTiempos({ ...orden, tecnico: '', primerAsignadoEn: T0 }, orden, T0 + 5 * MIN)).includes('primerAsignadoEn'), false);
check('quitar el técnico borra asignadoEn', camposTiempos(orden, { ...orden, tecnico: '' }, T0).asignadoEn, null);
check('"En camino" guarda la salida', camposTiempos(orden, { ...orden, enCamino: { tecnico: 'GERARDO', desde: T0 } }, T0), { salioEn: T0, llegoEn: null });
const enCamino = { ...orden, enCamino: { tecnico: 'GERARDO', desde: T0 } };
check('"Llegué" guarda la llegada', camposTiempos(enCamino, { ...orden, enCamino: { tecnico: 'GERARDO', desde: T0, llegoEn: T0 + 20 * MIN } }, T0 + 20 * MIN), { salioEn: T0, llegoEn: T0 + 20 * MIN });
check('deshacer "Llegué" borra la llegada', camposTiempos({ ...orden, enCamino: { tecnico: 'GERARDO', desde: T0, llegoEn: T0 + MIN } }, enCamino, T0).llegoEn, null);
check('cancelar el viaje con la orden pendiente borra salida y llegada', camposTiempos(enCamino, { ...orden, enCamino: null }, T0 + MIN), { salioEn: null, llegoEn: null });
check('pre-finalizar guarda la hora y no toca la salida aunque enCamino se borre',
  camposTiempos(enCamino, { ...orden, estado: 'PRE-FINALIZADO', enCamino: null }, T0 + 60 * MIN), { prefinalizadoEn: T0 + 60 * MIN });
check('devolverla borra prefinalizadoEn', camposTiempos({ ...orden, estado: 'PRE-FINALIZADO', prefinalizadoEn: T0 }, orden, T0 + MIN), { prefinalizadoEn: null });
check('finalizarla no guarda horas del ciclo', camposTiempos(orden, { ...orden, estado: 'FINALIZADO' }, T0), {});

// --- Tramos de una orden ---
const completa = { ...orden, createdAt: T0, asignadoEn: T0 + 10 * MIN, primerAsignadoEn: T0 + 10 * MIN, salioEn: T0 + 40 * MIN, llegoEn: T0 + 70 * MIN, prefinalizadoEn: T0 + 130 * MIN, estado: 'FINALIZADO', finalizadoEn: T0 + 150 * MIN };
check('los cinco tramos de una orden completa', duracionesDeOrden(completa), { asignar: 10 * MIN, aprobar: 20 * MIN, salir: 30 * MIN, viaje: 30 * MIN, sitio: 60 * MIN });
check('una orden que nació con técnico no mide "asignar" y cuenta "salir" desde que se creó',
  duracionesDeOrden({ ...completa, asignadoEn: undefined, primerAsignadoEn: undefined }), { asignar: null, aprobar: 20 * MIN, salir: 40 * MIN, viaje: 30 * MIN, sitio: 60 * MIN });
check('una orden vieja sin horas no mide nada', duracionesDeOrden({ ...orden, createdAt: INICIO_REGISTRO_HORAS - MIN, estado: 'FINALIZADO', finalizadoEn: T0 }), { asignar: null, aprobar: null, salir: null, viaje: null, sitio: null });
check('una orden vieja que salió después del despliegue no mide "salir" (no se sabe cuándo la recibió)',
  duracionesDeOrden({ ...orden, createdAt: INICIO_REGISTRO_HORAS - 500 * MIN, salioEn: T0, llegoEn: T0 + MIN }).salir, null);
check('"salir" arranca en la fecha programada si es posterior',
  duracionesDeOrden({ ...completa, fechaProgramada: '2099-01-01', salioEn: Date.parse('2099-01-01T12:00:00-04:00') }).salir, Date.parse('2099-01-01T12:00:00-04:00') - Date.parse('2099-01-01T00:00:00-04:00'));
check('horas al revés no dan duración negativa', duracionesDeOrden({ ...completa, llegoEn: T0 }).viaje, null);

// --- El reporte ---
const dia = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(ms));
const rango = { desde: dia(T0 - 86400000), hasta: dia(T0 + 86400000) };
const otra = { ...completa, id: 'b', tecnico: 'REINEL', salioEn: T0 + 70 * MIN, llegoEn: T0 + 100 * MIN };
const esperas = esperasDelCiclo([completa, otra, { ...orden, id: 'c', estado: 'PENDIENTE' }], rango, {});
check('cuenta las finalizadas del periodo', [esperas.finalizadas, esperas.conHoras], [2, 2]);
check('promedio del tramo "salir" de los dos técnicos', esperas.tramos.find((t) => t.id === 'salir').promedio, 45 * MIN);
check('por técnico lista a cada uno con sus tramos', esperas.porTecnico.map((f) => [f.nombre, f.cantidad, f.salir.promedio]).sort(), [['GERARDO', 1, 30 * MIN], ['REINEL', 1, 60 * MIN]]);
check('el filtro por técnico deja solo sus órdenes', esperasDelCiclo([completa, otra], rango, { tecnico: 'reinel' }).finalizadas, 1);

const AHORA = T0 + 1000 * MIN;
const colas = colasDeLaOficina([
  { id: '1', estado: 'PENDIENTE', tecnico: '', createdAt: T0, codigo: 'IS' },
  { id: '2', estado: 'PENDIENTE', tecnico: '', createdAt: T0 + 100 * MIN, codigo: 'IS' },
  { id: '3', estado: 'PENDIENTE', tecnico: 'GERARDO', createdAt: T0 },
  { id: '4', estado: 'PRE-FINALIZADO', tecnico: 'GERARDO', prefinalizadoEn: T0 + 500 * MIN },
  { id: '5', estado: 'PRE-FINALIZADO', tecnico: 'GERARDO' },
], AHORA);
check('la cola sin técnico va de la más vieja a la más nueva', colas.sinTecnico.lista.map((x) => x.orden.id), ['1', '2']);
check('la cola por aprobar solo trae las que tienen hora', [colas.porAprobar.total, colas.porAprobar.lista[0].esperaMs], [1, 500 * MIN]);

if (failures) { console.log(`\n${failures} falló/fallaron.`); process.exit(1); }
console.log('\nTodo bien.');
