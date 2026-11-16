// Prueba la ubicación de un técnico en la calle (src/utils/ubicacionTecnico.js) y la función que la enciende (src/utils/funciones.js): los documentos que se escriben, cuándo una solicitud
// está vigente, qué estado ve la oficina, el mapa de teselas y que la función nazca apagada. También comprueba que el envío es en silencio (sin push ni avisos). No necesita el emulador.
// Uso: `npm run test:ubicacion`.
import { readFileSync } from 'node:fs';
import { FUNCIONES, cambioDeFuncion, leerFunciones } from '../src/utils/funciones.js';
import {
  DURACION_SOLICITUD_MS, ESTADOS, EN_VIVO_MS, PROBLEMAS, armarPosicion, armarProblema, detencion, enlaceGoogleMaps, estadoUbicacion, haceCuanto, idDeTecnico, nuevaSolicitud,
  ENVIOS_RAPIDOS, INTERVALO_LENTO_MS, INTERVALO_RAPIDO_MS, MOTIVOS_PUNTO, RETENCION_ULTIMA_MS, armarPunto, intervaloDeEnvio, posicionesHuerfanas, solicitudVigente, tiempoRestante, ultimaVigente, ultimasViejas,
} from '../src/utils/ubicacionTecnico.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

// --- La función nace apagada ---
check('sin documento, o sin su campo, la ubicación está apagada', [leerFunciones(null).ubicacionActiva, leerFunciones({}).ubicacionActiva, leerFunciones({ rutasActivas: true }).ubicacionActiva], [false, false, false]);
check('solo true la enciende ("true" en texto o 1 no)', [leerFunciones({ ubicacionActiva: true }).ubicacionActiva, leerFunciones({ ubicacionActiva: 'true' }).ubicacionActiva, leerFunciones({ ubicacionActiva: 1 }).ubicacionActiva], [true, false, false]);
check('encender la ubicación no toca la ruta y al revés', [leerFunciones({ ubicacionActiva: true }).rutasActivas, leerFunciones({ rutasActivas: true }).ubicacionActiva], [false, false]);
check('el cambio guarda el valor, quién y cuándo', cambioDeFuncion(FUNCIONES.UBICACION, true, 'Ana', 99), { ubicacionActiva: true, actualizadoPor: 'Ana', actualizadoEn: 99 });

// --- El id del técnico ---
check('el id es el nombre en mayúsculas, con sus espacios', idDeTecnico('Reinel Bravo'), 'REINEL BRAVO');
check('un nombre vacío o que no sirve como id de Firestore da null', [idDeTecnico(''), idDeTecnico('   '), idDeTecnico(null), idDeTecnico('A/B'), idDeTecnico('..')], [null, null, null, null, null]);

// --- La solicitud ---
const T0 = 1_800_000_000_000;
const s = nuevaSolicitud('lfernandez', T0);
check('la solicitud dura 30 minutos y nace sin detener', s, { pedidaPor: 'lfernandez', pedidaEn: T0, venceEn: T0 + 1800000, detenidaEn: 0 });
check('la duración es la que esperan las reglas (1800000 ms)', DURACION_SOLICITUD_MS, 1800000);
check('vigente mientras no venza ni la detengan', [solicitudVigente(s, T0 + 1000), solicitudVigente(s, T0 + 1799999), solicitudVigente(s, T0 + 1800000), solicitudVigente({ ...s, ...detencion('OFICINA', T0 + 5) }, T0 + 10), solicitudVigente(null, T0), solicitudVigente({}, T0)], [true, true, false, false, false, false]);
check('detener escribe cuándo y por quién (recortado a 80 letras)', [detencion('OFICINA', 7), detencion('x'.repeat(200), 7).detenidaPor.length], [{ detenidaEn: 7, detenidaPor: 'OFICINA' }, 80]);

// --- La posición que escribe el técnico ---
check('la lectura del GPS se guarda con 6 decimales, la precisión entera y la solicitud a la que responde', armarPosicion({ latitude: 10.6454794123, longitude: -71.6695485987, accuracy: 18.6 }, T0, T0 + 5), { lat: 10.645479, lng: -71.669549, precision: 19, en: T0 + 5, solicitudEn: T0 });
check('sin latitud, con valores fuera de rango o sin número no hay posición', [armarPosicion({ latitude: 91, longitude: 0 }, T0), armarPosicion({ latitude: 0, longitude: 181 }, T0), armarPosicion({}, T0), armarPosicion(null, T0)], [null, null, null, null]);
check('una precisión que falta o es negativa queda en 0; una enorme se topa', [armarPosicion({ latitude: 1, longitude: 1 }, T0, 1).precision, armarPosicion({ latitude: 1, longitude: 1, accuracy: -5 }, T0, 1).precision, armarPosicion({ latitude: 1, longitude: 1, accuracy: 9e9 }, T0, 1).precision], [0, 0, 100000]);
check('un problema se guarda con su motivo y la solicitud; cualquier otro motivo cuenta como sin GPS', [armarProblema(PROBLEMAS.DENEGADO, T0, 3), armarProblema('raro', T0, 3)], [{ problema: 'denegado', en: 3, solicitudEn: T0 }, { problema: 'sin-gps', en: 3, solicitudEn: T0 }]);

// --- Qué ve la oficina ---
const pos = (extra = {}) => ({ lat: 10.6, lng: -71.6, precision: 10, en: T0 + 20000, solicitudEn: T0, ...extra });
check('sin solicitud no hay nada', [estadoUbicacion(null, null, T0), estadoUbicacion(undefined, pos(), T0)], [ESTADOS.NINGUNA, ESTADOS.NINGUNA]);
check('con la solicitud vigente y sin posición: esperando', estadoUbicacion(s, null, T0 + 5000), ESTADOS.ESPERANDO);
check('con posición reciente: en vivo', estadoUbicacion(s, pos(), T0 + 30000), ESTADOS.EN_VIVO);
check('en vivo hasta 150 s (algo más que un envío lento); pasado eso, sin señal reciente', [estadoUbicacion(s, pos(), T0 + 20000 + EN_VIVO_MS), estadoUbicacion(s, pos(), T0 + 20001 + EN_VIVO_MS)], [ESTADOS.EN_VIVO, ESTADOS.SIN_SENAL]);
check('una posición de OTRA solicitud no vale (queda esperando)', estadoUbicacion(s, pos({ solicitudEn: T0 - 1 }), T0 + 30000), ESTADOS.ESPERANDO);
check('el problema que avisó el teléfono se muestra', [estadoUbicacion(s, armarProblema('denegado', T0, T0 + 1), T0 + 5000), estadoUbicacion(s, armarProblema('sin-gps', T0, T0 + 1), T0 + 5000)], [ESTADOS.DENEGADO, ESTADOS.SIN_GPS]);
check('vencida o detenida, la posición ya no se muestra', [estadoUbicacion(s, pos(), T0 + 1800000), estadoUbicacion({ ...s, ...detencion('OFICINA', T0 + 50) }, pos(), T0 + 100)], [ESTADOS.VENCIDA, ESTADOS.DETENIDA]);

// --- Posiciones que quedaron sin solicitud (el teléfono se cerró antes de borrarlas) ---
const detenida = { ...s, ...detencion('OFICINA', T0 + 50) };
check('es huérfana la posición sin solicitud, con la solicitud vencida o detenida, o de otra solicitud; la vigente y que responde a ella no', posicionesHuerfanas(
  { A: s, B: s, C: detenida, D: { ...s, pedidaEn: T0 - 700000, venceEn: T0 - 100000 } },
  { A: pos(), B: pos({ solicitudEn: T0 - 1 }), C: pos(), D: pos(), E: pos() }, T0 + 30000), ['B', 'C', 'D', 'E']);
check('sin posiciones no hay nada que borrar', [posicionesHuerfanas({ A: s }, {}, T0), posicionesHuerfanas(null, null, T0)], [[], []]);
check('el problema que avisó el teléfono (sin coordenadas) también cuenta como posición de su solicitud', posicionesHuerfanas({ A: s }, { A: armarProblema('denegado', T0, T0 + 1) }, T0 + 5000), []);
check('el ADMIN borra las huérfanas al abrir el módulo (la vista usa posicionesHuerfanas y el hook borra la posición)', [leer('../src/components/UbicacionView.jsx').includes('posicionesHuerfanas('), leer('../src/hooks/useUbicacionTecnicos.js').includes('deleteDoc(documento(coleccion, id))')], [true, true]);

// --- El envío espaciado (cuidar el consumo) ---
check('los primeros 4 envíos van cada 30 s y después cada 2 minutos', [0, 1, 2, 3, 4, 5, 20].map(intervaloDeEnvio), [30000, 30000, 30000, 30000, 120000, 120000, 120000]);
check('las constantes del ritmo (30 s x 4 y luego 2 min)', [INTERVALO_RAPIDO_MS, INTERVALO_LENTO_MS, ENVIOS_RAPIDOS], [30000, 120000, 4]);
check('en una solicitud de 30 minutos, un teléfono que la tiene abierta todo el rato envía unas 18 veces (no 60)', (() => { let t = 0; let n = 0; while (t < 1800000) { n += 1; t += intervaloDeEnvio(n - 1); } return n; })(), 18);

// --- Un punto por acción (En camino, Llegué, pre-finalizar) ---
const gps = { latitude: 10.6454794123, longitude: -71.6695485987, accuracy: 18.6 };
check('el punto de una acción lleva la lectura, el motivo y la orden', armarPunto(gps, 'llegada', 'AS2', T0), { lat: 10.645479, lng: -71.669549, precision: 19, en: T0, motivo: 'llegada', codigo: 'AS2' });
check('sin orden no lleva código; un motivo que no existe o una lectura inválida no dan punto', [armarPunto(gps, 'camino', '', T0), armarPunto(gps, 'otro', 'AS2', T0), armarPunto({ latitude: 99, longitude: 0 }, 'camino', '', T0)].map((p) => (p && 'codigo' in p) ? 'con código' : p === null ? null : 'sin código'), ['sin código', null, null]);
check('los tres motivos de las acciones', Object.keys(MOTIVOS_PUNTO), ['camino', 'llegada', 'prefinalizar']);
check('la última ubicación vale 24 horas; pasado eso el ADMIN la borra', [ultimaVigente({ lat: 1, lng: 1, en: T0 }, T0 + RETENCION_ULTIMA_MS - 1), ultimaVigente({ lat: 1, lng: 1, en: T0 }, T0 + RETENCION_ULTIMA_MS), ultimaVigente(null, T0), ultimasViejas({ A: { lat: 1, lng: 1, en: T0 }, B: { lat: 1, lng: 1, en: T0 - RETENCION_ULTIMA_MS - 1 } }, T0 + 1000)], [true, false, false, ['B']]);

// --- Textos ---
check('"hace" en segundos, minutos y horas', [haceCuanto(T0, T0 + 2000), haceCuanto(T0, T0 + 12000), haceCuanto(T0, T0 + 185000), haceCuanto(T0, T0 + 7300000)], ['ahora mismo', 'hace 12 s', 'hace 3 min', 'hace 2 h']);
check('el tiempo que falta se muestra como minutos:segundos y no baja de 0:00', [tiempoRestante(s, T0 + 1000), tiempoRestante(s, T0 + 1740000), tiempoRestante(s, T0 + 1900000)], ['29:59', '1:00', '0:00']);
check('el enlace abre Google Maps en el punto', enlaceGoogleMaps({ lat: 10.6, lng: -71.6 }), 'https://www.google.com/maps/search/?api=1&query=10.6,-71.6');

// --- El módulo del menú y el mapa ---
const vista = leer('../src/components/UbicacionView.jsx');
const sidebar = leer('../src/components/Sidebar.jsx');
const app = leer('../src/App.jsx');
check('el módulo Ubicación está en el menú lateral (solo con la función encendida) y se abre como página del marco', [sidebar.includes("veUbicacion ? [{ id: 'ubicacion'") && sidebar.includes("acciones.modulo('UBICACION')"), app.includes("UBICACION: 'ubicacion'"), app.includes("abierta('UBICACION', false) && enMarco('Ubicación de técnicos'"), app.includes('veUbicacion={funciones.ubicacionActiva}')], [true, true, true, true]);
check('no hay un botón "Ubicación" en la fila de órdenes: el único acceso es el menú', [leer('../src/components/TechnicianWorkload.jsx').includes('bicaci'), app.includes('BotonUbicacion')], [false, false]);
check('el mapa es de OpenStreetMap con Leaflet (cargado solo al abrir el módulo) y su librería está fijada a una versión exacta', [leer('../src/components/MapaTecnicos.jsx').includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png'), leer('../src/components/MapaTecnicos.jsx').includes("import('leaflet')"), JSON.parse(leer('../package.json')).dependencies.leaflet === '1.9.4'], [true, true, true]);
check('el nombre del técnico en el mapa nunca se interpreta como código HTML (se pone con textContent)', [leer('../src/components/MapaTecnicos.jsx').includes('etiqueta.textContent ='), /innerHTML/.test(leer('../src/components/MapaTecnicos.jsx'))], [true, false]);

// --- Sin avisos (pedido del usuario) y lo demás que debe estar en su sitio ---
const hookTecnico = leer('../src/hooks/useCompartirUbicacion.js');
const hookOficina = leer('../src/hooks/useUbicacionTecnicos.js');
check('el técnico no recibe avisos: ni push (sendPush) ni mensaje en pantalla (toast, notificación)', [/sendPush|notify|Notification|setToastMsg|addNotification/.test(hookTecnico), /sendPush|notify|Notification/.test(hookOficina), /sendPush|Notification/.test(vista)], [false, false, false]);
check('las reglas piden los 30 minutos que escribe la app', leer('../firestore.rules').includes('s.venceEn == s.pedidaEn + 1800000'), true);
check('los puntos de las acciones se guardan al marcar En camino y Llegué y al pre-finalizar, solo con el técnico', [app.includes("registrarPunto('camino', ticket?.codigo)"), app.includes("registrarPunto('llegada', ticket?.codigo)"), app.includes("if (ok && isTecnico) registrarPunto('prefinalizar', ticket.codigo)")], [true, true, true]);
check('el módulo tiene el botón de pantalla completa y la casilla de rutas, esta solo con la función Ruta del día encendida', [vista.includes('Pantalla completa'), vista.includes('{rutasActivas && ('), vista.includes('id="ubicacion-rutas"'), app.includes('rutasActivas={funciones.rutasActivas}')], [true, true, true, true]);
check('el técnico nunca pide el GPS sin que la función esté encendida (registrarPunto y el envío salen si no está activa)', [leer('../src/hooks/useCompartirUbicacion.js').includes('if (!activo || !firebaseUser || !id'), leer('../firestore.rules').includes('ubicacionEncendida(appId) && ultimaValida()')], [true, true]);
check('las teselas del mapa están permitidas en la política de seguridad del hosting', JSON.parse(leer('../firebase.json')).hosting.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value.includes('img-src \'self\' data: blob: https://firebasestorage.googleapis.com https://tile.openstreetmap.org'), true);
check('la casilla de Configuración y el menú usan la misma función', [leer('../src/components/ConfiguracionView.jsx').includes('FUNCIONES.UBICACION'), leer('../src/App.jsx').includes('funciones.ubicacionActiva')], [true, true]);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
