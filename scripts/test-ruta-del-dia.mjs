// Prueba la Ruta del día del técnico (src/utils/rutaDelDia.js) y la función que la enciende (src/utils/funciones.js): qué órdenes entran, de dónde sale el
// punto de cada una, en qué orden se sugieren (prioridad alta primero y el resto por cercanía), cómo se arman los enlaces de Google Maps y que la
// función nazca apagada. No necesita el emulador. Uso: `npm run test:ruta`.
import { readFileSync } from 'node:fs';
import { coordenadasDeNap, coordenadasDeUbicacion } from '../src/utils/ubicacion.js';
import { FUENTE_CLIENTE, FUENTE_NAP, MAX_PARADAS_POR_RUTA, distanciaKm, enlacesDeRuta, kmDeRuta, ordenSugerido, ordenesDeRuta, paradasDeRuta, puntoDeOrden } from '../src/utils/rutaDelDia.js';
import { FUNCIONES, cambioDeFuncion, leerFunciones } from '../src/utils/funciones.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

// --- Coordenadas guardadas en la orden ---
check('la ubicación del cliente guardada como enlace con coordenadas da su punto', coordenadasDeUbicacion('https://www.google.com/maps?q=10.6454794,-71.6695485'), { lat: 10.6454794, lng: -71.6695485 });
check('las coordenadas escritas a mano también', coordenadasDeUbicacion('10.64, -71.67'), { lat: 10.64, lng: -71.67 });
check('un enlace corto de Google no trae coordenadas', coordenadasDeUbicacion('https://maps.app.goo.gl/abc123'), null);
check('sin ubicación, o con algo que no es de Google Maps, no hay punto', [coordenadasDeUbicacion(''), coordenadasDeUbicacion(undefined), coordenadasDeUbicacion('https://ejemplo.com/x')], [null, null, null]);
check('las coordenadas de la NAP ("lat, lng") dan su punto', coordenadasDeNap('10.6486062369, -71.6650880829'), { lat: 10.6486062369, lng: -71.6650880829 });
check('las de la NAP con texto alrededor también, y sin ellas no hay punto', [coordenadasDeNap('Lat: 10.66 / Lng: -71.70'), coordenadasDeNap(''), coordenadasDeNap('no son coordenadas')], [{ lat: 10.66, lng: -71.7 }, null, null]);

// --- De dónde sale el punto de una orden ---
check('con ubicación del cliente, el punto es la casa del cliente', puntoDeOrden({ ubicacion: '10.64, -71.67', napCoordenadas: '10.60, -71.60' }), { lat: 10.64, lng: -71.67, fuente: FUENTE_CLIENTE });
check('sin ubicación del cliente, el punto es la NAP', puntoDeOrden({ napCoordenadas: '10.60, -71.60' }), { lat: 10.6, lng: -71.6, fuente: FUENTE_NAP });
check('con un enlace corto (sin coordenadas) cae a la NAP', puntoDeOrden({ ubicacion: 'https://maps.app.goo.gl/abc123', napCoordenadas: '10.60, -71.60' }), { lat: 10.6, lng: -71.6, fuente: FUENTE_NAP });
check('sin ninguna de las dos no hay punto', [puntoDeOrden({}), puntoDeOrden(null)], [null, null]);

// --- Qué órdenes entran ---
const hoy = new Date(2026, 10, 11);
const o = (id, extra = {}) => ({ id, codigo: id.toUpperCase(), nombre: `Cliente ${id}`, tipoTrabajo: 'AVERÍA', estado: 'PENDIENTE', fechaProgramada: '', ubicacion: '10.64, -71.67', ...extra });
const tickets = [
  o('a'),
  o('b', { fechaProgramada: '2026-11-11' }),
  o('c', { fechaProgramada: '2026-11-09' }),
  o('d', { fechaProgramada: '2026-11-14' }),
  o('e', { estado: 'PRE-FINALIZADO' }),
  o('f', { estado: 'FINALIZADO' }),
  o('g', { infraestructura: { activa: true, motivo: 'Poste', por: 'x', origen: 'TECNICO', en: 1, tecnico: 'T' } }),
  o('h', { infraestructura: { activa: false, resultado: 'DEVUELTA', motivo: 'Poste', por: 'x', origen: 'TECNICO', en: 1, tecnico: 'T' } }),
  o('i', { ubicacion: '', napCoordenadas: '' }),
];
check('entran las pendientes de hoy, vencidas y sin fecha; no las de otro día, las que no están pendientes ni las que esperan a infraestructura',
  ordenesDeRuta(tickets, hoy).map((t) => t.id), ['a', 'b', 'c', 'h', 'i']);
check('una orden devuelta por infraestructura vuelve a la ruta', ordenesDeRuta(tickets, hoy).some((t) => t.id === 'h'), true);
const { paradas, sinPunto } = paradasDeRuta(tickets, hoy);
check('las que no tienen punto no entran en la ruta y se avisan aparte', { paradas: paradas.map((p) => p.id), sinPunto: sinPunto.map((p) => p.id) }, { paradas: ['a', 'b', 'c', 'h'], sinPunto: ['i'] });
check('la parada trae lo que la hoja muestra', paradas[0], { id: 'a', codigo: 'A', nombre: 'Cliente a', tipoTrabajo: 'AVERÍA', prioridad: false, punto: { lat: 10.64, lng: -71.67, fuente: FUENTE_CLIENTE } });
check('sin lista no hay paradas', paradasDeRuta(undefined, hoy), { paradas: [], sinPunto: [] });
check('solo cuenta como prioridad alta una orden pendiente con la marca', paradasDeRuta([o('p', { prioridadAlta: true }), o('q', { prioridadAlta: false })], hoy).paradas.map((p) => p.prioridad), [true, false]);

// --- Orden sugerido: prioridad alta primero y el resto de la más cercana a la más lejana, partiendo del técnico ---
const p = (id, lat, lng, prioridad = false) => ({ id, codigo: id, nombre: '', tipoTrabajo: '', prioridad, punto: { lat, lng, fuente: FUENTE_CLIENTE } });
const tecnico = { lat: 10.0, lng: -71.0 };
const lejos = p('lejos', 10.3, -71.0);
const cerca = p('cerca', 10.01, -71.0);
const medio = p('medio', 10.1, -71.0);
check('sin prioridades, de la más cercana a la más lejana desde el técnico', ordenSugerido([lejos, medio, cerca], tecnico).map((x) => x.id), ['cerca', 'medio', 'lejos']);
check('cada parada se escoge desde la anterior, no solo desde el técnico', ordenSugerido([p('x', 10.00, -70.9), p('y', 10.00, -71.2), p('z', 10.00, -70.8)], tecnico).map((x) => x.id), ['x', 'z', 'y']);
check('la prioridad alta va primero aunque esté lejos, y las demás siguen desde ella (no desde el técnico)', ordenSugerido([cerca, medio, p('urgente', 10.3, -71.0, true)], tecnico).map((x) => x.id), ['urgente', 'medio', 'cerca']);
check('con varias prioritarias, entre ellas por cercanía, y las demás siguen desde la última prioritaria',
  ordenSugerido([p('n1', 10.2, -71.0), p('pl', 10.3, -71.0, true), p('pc', 10.05, -71.0, true), p('n2', 10.28, -71.0)], tecnico).map((x) => x.id), ['pc', 'pl', 'n2', 'n1']);
check('sin la ubicación del técnico parte de la primera de cada grupo, en el orden de la lista', ordenSugerido([lejos, cerca, medio], null).map((x) => x.id), ['lejos', 'medio', 'cerca']);
check('una posición inválida se trata como desconocida', ordenSugerido([lejos, cerca], { lat: NaN, lng: 0 }).map((x) => x.id), ['lejos', 'cerca']);
check('una sola parada, o ninguna, no falla', [ordenSugerido([cerca], tecnico).length, ordenSugerido([], tecnico).length], [1, 0]);
check('no cambia la lista que recibe', (() => { const l = [lejos, cerca, medio]; ordenSugerido(l, tecnico); return l.map((x) => x.id); })(), ['lejos', 'cerca', 'medio']);

// --- Distancia ---
check('la distancia de un punto a sí mismo es cero', distanciaKm({ lat: 10, lng: -71 }, { lat: 10, lng: -71 }), 0);
check('un grado de latitud son unos 111 km', Math.round(distanciaKm({ lat: 10, lng: -71 }, { lat: 11, lng: -71 })), 111);
check('ordenar por cercanía recorre menos que visitar en desorden', kmDeRuta(ordenSugerido([lejos, medio, cerca], tecnico), tecnico) < kmDeRuta([lejos, cerca, medio], tecnico), true);

// --- Enlaces de Google Maps ---
const tres = [p('1', 10.1, -71.1), p('2', 10.2, -71.2), p('3', 10.3, -71.3)];
const [unico] = enlacesDeRuta(tres);
check('el enlace lleva las intermedias, el destino y no lleva origen (Maps sale de donde esté el técnico y ofrece "Iniciar")',
  unico.url, 'https://www.google.com/maps/dir/?api=1&waypoints=10.1,-71.1%7C10.2,-71.2&destination=10.3,-71.3&travelmode=driving');
check('con una sola parada solo hay destino', enlacesDeRuta([tres[0]])[0].url, 'https://www.google.com/maps/dir/?api=1&destination=10.1,-71.1&travelmode=driving');
check('sin paradas no hay enlaces', enlacesDeRuta([]), []);
check('el enlace no lleva datos personales: solo coordenadas', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1(&waypoints=[-\d.,%A-F7C]+)?&destination=[-\d.,]+&travelmode=driving$/.test(unico.url), true);
const doce = Array.from({ length: 12 }, (_, i) => p(String(i + 1), 10 + i / 100, -71));
const tandas = enlacesDeRuta(doce);
check('una ruta larga se parte en tandas de hasta el máximo de paradas', tandas.map((t) => [t.desde, t.hasta, t.cantidad]), [[1, MAX_PARADAS_POR_RUTA, MAX_PARADAS_POR_RUTA], [MAX_PARADAS_POR_RUTA + 1, 12, 12 - MAX_PARADAS_POR_RUTA]]);
check('la primera tanda sale de donde esté el técnico y la segunda de la última parada de la primera',
  [tandas[0].url.includes('origin='), tandas[1].url.includes(`origin=${doce[MAX_PARADAS_POR_RUTA - 1].punto.lat},${doce[MAX_PARADAS_POR_RUTA - 1].punto.lng}`)], [false, true]);
check('el máximo por enlace deja margen bajo el tope de Google (9 intermedias)', MAX_PARADAS_POR_RUTA - 1 <= 9, true);

// --- La función se enciende en Configuración y nace apagada ---
check('sin el documento, o sin el campo, la ruta está apagada', [leerFunciones(null).rutasActivas, leerFunciones({}).rutasActivas, leerFunciones(undefined).rutasActivas], [false, false, false]);
check('solo true la enciende (un texto o un número no)', [true, 'true', 1, 'si', false, null].map((v) => leerFunciones({ rutasActivas: v }).rutasActivas), [true, false, false, false, false, false]);
check('lo que se escribe al cambiar la función trae el valor, quién y cuándo', cambioDeFuncion(FUNCIONES.RUTAS, true, 'admin', 123), { rutasActivas: true, actualizadoPor: 'admin', actualizadoEn: 123 });
check('un valor que no es true se guarda como false', cambioDeFuncion(FUNCIONES.RUTAS, 'x', 'admin', 1).rutasActivas, false);
check('no deja cambiar una función que no existe', (() => { try { cambioDeFuncion('otra', true, 'admin'); return 'no falló'; } catch { return 'falló'; } })(), 'falló');

// --- Conexión en la app ---
const app = leer('../src/App.jsx');
check('la función se escucha solo para el técnico y para Configuración abierta', /useFunciones\(firebaseUser, isTecnico \|\| configuracionAbierta,/.test(app), true);
check('el botón de la ruta solo sale con la función encendida (paradasRuta nace de funciones.rutasActivas)', /const paradasRuta = isTecnico && funciones\.rutasActivas \? paradasDeRuta\(ticketsParaVer\) : null;/.test(app), true);
check('la hoja de la ruta solo se muestra al técnico con la función encendida', /\{isTecnico && funciones\.rutasActivas && rutaAbierta && \(/.test(app), true);
check('la Configuración solo se monta para el ADMIN', /\{isAdmin && abierta\('CONFIGURACION', false\)/.test(app), true);
const menu = leer('../src/components/Sidebar.jsx');
check('el menú del ADMIN tiene Configuración', menu.includes("acciones.modulo('CONFIGURACION')"), true);
const rutaBoton = leer('../src/components/TechnicianWorkload.jsx');
check('el atajo va en la misma fila del chip del técnico, a la derecha', rutaBoton.includes('{rutaBoton && <div className="ml-auto">{rutaBoton}</div>}'), true);
const hosting = JSON.parse(leer('../firebase.json')).hosting.headers.flatMap((h) => h.headers).find((h) => h.key === 'Permissions-Policy').value;
check('el hosting permite la ubicación solo a la propia app (geolocation=(self)) y mantiene el micrófono cerrado y la cámara propia', hosting.includes('geolocation=(self)') && hosting.includes('microphone=()') && hosting.includes('camera=(self)'), true);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas de la ruta del día pasaron.');
