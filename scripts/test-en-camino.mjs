// Prueba "En camino" / "En sitio" (src/utils/enCamino.js): cuándo hay un viaje en curso, la caducidad, un viaje a la
// vez por técnico y cómo se detecta que un técnico salió o llegó. No necesita el emulador.
// Uso: `npm run test:encamino`.
import {
  CADUCA_EN_CAMINO_MS, CADUCA_EN_SITIO_MS, deshacerLlegada, estadoViaje, iniciarViaje, mapaViaje, puedeIniciarViaje,
  registrarLlegada, textoAvisoEnCamino, textoAvisoLlegada, tiempoTranscurrido, viajeEnCursoDe, viajesNuevos,
} from '../src/utils/enCamino.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const MIN = 60000;
const T0 = 1_700_000_000_000;
const orden = { id: 'a', estado: 'PENDIENTE', tecnico: 'GERARDO', codigo: 'AS184', nombre: 'Ana Pérez' };

// --- Estado del viaje ---
check('sin enCamino no hay viaje', estadoViaje(orden, T0), null);
check('con salida y sin llegada: en camino', estadoViaje({ ...orden, enCamino: { tecnico: 'GERARDO', desde: T0 } }, T0 + 5 * MIN), 'EN_CAMINO');
check('con llegada: en sitio', estadoViaje({ ...orden, enCamino: { tecnico: 'GERARDO', desde: T0, llegoEn: T0 + 20 * MIN } }, T0 + 30 * MIN), 'EN_SITIO');
check('si la orden no está pendiente el viaje no cuenta',
  ['PRE-FINALIZADO', 'FINALIZADO', 'CANCELADO', 'ELIMINADO'].map(estado => estadoViaje({ ...orden, estado, enCamino: { tecnico: 'GERARDO', desde: T0 } }, T0 + MIN)), [null, null, null, null]);
check('si la orden pasó a otro técnico el viaje no cuenta', estadoViaje({ ...orden, tecnico: 'REINEL', enCamino: { tecnico: 'GERARDO', desde: T0 } }, T0 + MIN), null);
check('sin técnico no hay viaje', estadoViaje({ ...orden, tecnico: '', enCamino: { tecnico: '', desde: T0 } }, T0 + MIN), null);
check('sin orden no hay viaje', [estadoViaje(null), estadoViaje(undefined)], [null, null]);

// --- Caducidad ---
const saliendo = { ...orden, enCamino: { tecnico: 'GERARDO', desde: T0 } };
check('un en camino sin cerrar caduca a las 4 h', [estadoViaje(saliendo, T0 + CADUCA_EN_CAMINO_MS - 1), estadoViaje(saliendo, T0 + CADUCA_EN_CAMINO_MS)], ['EN_CAMINO', null]);
const enSitio = { ...orden, enCamino: { tecnico: 'GERARDO', desde: T0, llegoEn: T0 + MIN } };
check('un en sitio caduca a las 12 h de la llegada', [estadoViaje(enSitio, T0 + MIN + CADUCA_EN_SITIO_MS - 1), estadoViaje(enSitio, T0 + MIN + CADUCA_EN_SITIO_MS)], ['EN_SITIO', null]);

// --- Quién puede avisar que sale ---
check('una orden pendiente con técnico y sin viaje se puede iniciar', puedeIniciarViaje(orden, T0), true);
check('con un viaje en curso no se vuelve a iniciar', [puedeIniciarViaje(saliendo, T0 + MIN), puedeIniciarViaje(enSitio, T0 + 2 * MIN)], [false, false]);
check('con el viaje caducado se puede iniciar de nuevo', puedeIniciarViaje(saliendo, T0 + CADUCA_EN_CAMINO_MS), true);
check('pre-finalizada o sin técnico no se puede iniciar', [puedeIniciarViaje({ ...orden, estado: 'PRE-FINALIZADO' }, T0), puedeIniciarViaje({ ...orden, tecnico: '' }, T0)], [false, false]);

// --- Un viaje a la vez por técnico ---
const lista = [
  { ...orden, id: '1', enCamino: { tecnico: 'GERARDO', desde: T0 } },
  { ...orden, id: '2' },
  { ...orden, id: '3', tecnico: 'REINEL', enCamino: { tecnico: 'REINEL', desde: T0 } },
  { ...orden, id: '4', enCamino: { tecnico: 'GERARDO', desde: T0, llegoEn: T0 + MIN } },
];
check('detecta la otra orden en camino del mismo técnico', viajeEnCursoDe(lista, 'GERARDO', '2', T0 + 5 * MIN)?.id, '1');
check('no cuenta la misma orden', viajeEnCursoDe(lista, 'GERARDO', '1', T0 + 5 * MIN), null);
check('en sitio y los viajes de otros técnicos no bloquean', viajeEnCursoDe([lista[2], lista[3]], 'GERARDO', '2', T0 + 5 * MIN), null);
check('un viaje caducado no bloquea', viajeEnCursoDe(lista, 'GERARDO', '2', T0 + CADUCA_EN_CAMINO_MS), null);

// Secuencia completa: un técnico con dos órdenes pendientes (la misma lógica que usa iniciarEnCamino).
{
  const intentar = (ordenes, id, ahora) => {
    const t = ordenes.find(o => o.id === id);
    if (!puedeIniciarViaje(t, ahora)) return { ok: false, ordenes };
    if (viajeEnCursoDe(ordenes, t.tecnico, t.id, ahora)) return { ok: false, ordenes };
    return { ok: true, ordenes: ordenes.map(o => (o.id === id ? { ...o, enCamino: iniciarViaje(o, ahora) } : o)) };
  };
  let ordenes = [{ ...orden, id: 'A' }, { ...orden, id: 'B' }, { ...orden, id: 'C', tecnico: 'REINEL' }];
  let r = intentar(ordenes, 'A', T0); ordenes = r.ordenes;
  check('la primera orden se puede poner en camino', r.ok, true);
  r = intentar(ordenes, 'B', T0 + MIN);
  check('no se puede poner en camino una segunda orden del mismo técnico', r.ok, false);
  check('otro técnico sí puede ir en camino al mismo tiempo', intentar(ordenes, 'C', T0 + MIN).ok, true);
  ordenes = ordenes.map(o => (o.id === 'A' ? { ...o, enCamino: registrarLlegada(o, T0 + 5 * MIN) } : o));
  check('tras llegar a la primera ya puede salir hacia la segunda', intentar(ordenes, 'B', T0 + 6 * MIN).ok, true);
  ordenes = ordenes.map(o => (o.id === 'A' ? { ...o, enCamino: iniciarViaje(o, T0) } : o));
  check('si deshace la llegada, la segunda vuelve a quedar bloqueada', intentar(ordenes, 'B', T0 + 7 * MIN).ok, false);
  ordenes = ordenes.map(o => (o.id === 'A' ? { ...o, enCamino: null } : o));
  check('si cancela el viaje, ya puede salir hacia la segunda', intentar(ordenes, 'B', T0 + 8 * MIN).ok, true);
  ordenes = [{ ...orden, id: 'A', enCamino: iniciarViaje(orden, T0) }, { ...orden, id: 'B' }];
  check('si la primera pasó a pre-finalizada ya no bloquea', intentar(ordenes.map(o => (o.id === 'A' ? { ...o, estado: 'PRE-FINALIZADO' } : o)), 'B', T0 + MIN).ok, true);
}

// --- Valores que se guardan ---
check('salir guarda técnico y hora', iniciarViaje(orden, T0), { tecnico: 'GERARDO', desde: T0 });
check('llegar conserva la hora de salida', registrarLlegada(saliendo, T0 + 9 * MIN), { tecnico: 'GERARDO', desde: T0, llegoEn: T0 + 9 * MIN });
check('deshacer la llegada vuelve a en camino con la salida original', deshacerLlegada(enSitio, T0 + 30 * MIN), { tecnico: 'GERARDO', desde: T0 });

// --- Textos ---
check('tiempo transcurrido', [tiempoTranscurrido(T0, T0 + 20_000), tiempoTranscurrido(T0, T0 + 12 * MIN), tiempoTranscurrido(T0, T0 + 60 * MIN), tiempoTranscurrido(T0, T0 + 130 * MIN)],
  ['justo ahora', 'hace 12 min', 'hace 1 h', 'hace 2 h 10 min']);
check('aviso de salida', textoAvisoEnCamino(orden), 'GERARDO va en camino a la orden AS184 — Ana Pérez.');
check('aviso de llegada sin código ni nombre', textoAvisoLlegada({ tecnico: 'GERARDO' }), 'GERARDO llegó al sitio de la orden S/C.');

// --- Detectar los viajes nuevos (aviso a la oficina) ---
const antes = mapaViaje([{ id: 'a', estado: 'PENDIENTE', tecnico: 'G' }, { id: 'b', estado: 'PENDIENTE', tecnico: 'G', enCamino: { tecnico: 'G', desde: T0 } }, { id: 'c', estado: 'PENDIENTE', tecnico: 'G' }]);
check('el punto de partida guarda el viaje de cada orden', [...antes], [['a', ''], ['b', `${T0}|`], ['c', '']]);
const ahora = T0 + 5 * MIN;
const despues = [
  { id: 'a', estado: 'PENDIENTE', tecnico: 'G', enCamino: { tecnico: 'G', desde: T0 + MIN } },                 // salió: se avisa
  { id: 'b', estado: 'PENDIENTE', tecnico: 'G', enCamino: { tecnico: 'G', desde: T0, llegoEn: T0 + 2 * MIN } }, // llegó: se avisa
  { id: 'c', estado: 'PENDIENTE', tecnico: 'G' },                                                               // sin cambios: no
  { id: 'd', estado: 'PENDIENTE', tecnico: 'G', enCamino: { tecnico: 'G', desde: T0 } },                        // orden nueva: no
];
const nuevos = viajesNuevos(despues, antes, ahora);
check('avisa de quien salió', nuevos.enCamino.map(t => t.id), ['a']);
check('avisa de quien llegó', nuevos.llegadas.map(t => t.id), ['b']);
check('cancelar el viaje no avisa', viajesNuevos([{ id: 'b', estado: 'PENDIENTE', tecnico: 'G' }], antes, ahora), { enCamino: [], llegadas: [] });
check('deshacer la llegada no vuelve a avisar la salida',
  viajesNuevos([{ id: 'b', estado: 'PENDIENTE', tecnico: 'G', enCamino: { tecnico: 'G', desde: T0 } }], mapaViaje([{ id: 'b', estado: 'PENDIENTE', tecnico: 'G', enCamino: { tecnico: 'G', desde: T0, llegoEn: T0 + MIN } }]), ahora),
  { enCamino: [], llegadas: [] });
check('un viaje caducado no avisa', viajesNuevos([{ id: 'a', estado: 'PENDIENTE', tecnico: 'G', enCamino: { tecnico: 'G', desde: T0 } }], mapaViaje([{ id: 'a', estado: 'PENDIENTE', tecnico: 'G' }]), T0 + CADUCA_EN_CAMINO_MS), { enCamino: [], llegadas: [] });
check('sin punto de partida no se avisa nada', [viajesNuevos(despues, null, ahora), viajesNuevos(despues, undefined, ahora)], [{ enCamino: [], llegadas: [] }, { enCamino: [], llegadas: [] }]);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
