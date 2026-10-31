// Prueba el registro de estaciones (src/utils/estaciones.js) y que toda la app lea y escriba a través del medidor (src/lib/medidorFirestore.js).
// No necesita el emulador (las reglas de estaciones las prueba test-rules.mjs). Uso: `node scripts/test-estaciones.mjs`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { explicarFalloPush } from '../src/utils/fallosPush.js';
import {
  EN_LINEA_MS, UMBRALES, USUARIOS_ESTACIONES, alertasDe, anomaliaDe, armarReporte, avisosDePantalla, crearMedidor, describirEquipo, desfaseReloj, enLinea, haceCuanto,
  ordenarEstaciones, principales, veEstaciones,
} from '../src/utils/estaciones.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

// --- Medidor ---
{
  const m = crearMedidor();
  m.sumar('tickets', 40, 0); m.sumar('reports', 30, 1000); m.sumar('tickets', 2, 2000); m.sumar('config', 0, 2000);
  m.escritura('tickets', 3, 2000); m.rechazo('permission-denied', 2000); m.errorLectura('unavailable', 2000);
  m.suscrito(0); m.suscrito(0); m.desuscrito(); m.errorApp('  Algo\nfalló  ', 2000);
  const v = m.ventana();
  check('lecturas y escrituras por colección', [m.total(), v.lecturas, v.porColeccion, v.escrituras, v.escriturasPorColeccion], [72, 72, { tickets: 42, reports: 30 }, 3, { tickets: 3 }]);
  check('rechazos y errores de lectura por motivo', [v.rechazadas, v.erroresEscucha, v.errores], [1, 1, { 'escritura:permission-denied': 1, 'lectura:unavailable': 1 }]);
  check('escuchadores abiertos (suscribir suma, cancelar resta) y suscripciones', [m.activos(), v.suscripciones], [1, 2]);
  check('el último error de la app, limpio', [v.erroresApp, m.ultimoError()], [1, 'Algo falló']);
  check('al reportar se corta la ventana y empieza otra; el total de la sesión sigue', [m.cortar().lecturas, m.ventana().lecturas, m.totales().lecturas, m.activos()], [72, 0, 72, 1]);
  check('lo de los últimos 5 minutos', [m.recientes(60 * 1000), m.recientes(6 * 60 * 1000), m.ultimos5(60 * 1000).escrituras], [72, 0, 3]);
}

// --- Alertas ---
{
  // El bucle del 31/10: ~6 lecturas por segundo sin parar, con borrados rechazados.
  const m = crearMedidor();
  for (let s = 0; s < 300; s++) { m.sumar('bloqueosOrden', 6, s * 1000); m.rechazo('permission-denied', s * 1000); }
  const alertas = alertasDe({ ultimos5: m.ultimos5(300 * 1000), errores: m.erroresVentana() });
  check('el bucle del 31/10 da dos alertas: lee demasiado y el servidor le rechaza escrituras', [alertas.some((a) => a.startsWith('Lee demasiado')), alertas.some((a) => a.includes('le rechazó'))], [true, true]);
}
check('uso normal (abrir la app: unos cientos de lecturas, 30 escuchadores, alguna escritura): sin alertas',
  alertasDe({ ultimos5: { lecturas: 450, escrituras: 10, suscripciones: 40 }, escuchadoresActivos: 30 }), []);
check('cuota agotada: alerta aunque sea una sola vez, y va primero', alertasDe({ errores: { 'lectura:resource-exhausted': 1 }, ultimos5: { lecturas: 5000 } })[0], 'Firestore rechazó 1 operación por cuota agotada');
check('escribe demasiado', alertasDe({ ultimos5: { escrituras: UMBRALES.escrituras + 1 } }).length, 1);
check('se vuelve a suscribir sin parar (relee todo cada vez)', alertasDe({ ultimos5: { suscripciones: UMBRALES.suscripciones + 1 } })[0].startsWith('Se vuelve a suscribir'), true);
check('fuga de escuchadores', alertasDe({ escuchadoresActivos: UMBRALES.escuchadoresActivos + 1 })[0].startsWith('Demasiados escuchadores'), true);
check('lecturas sin permiso', alertasDe({ errores: { 'lectura:permission-denied': 3 } }), ['3 lecturas rechazadas por falta de permiso']);
check('errores de la app', alertasDe({ ultimos5: { erroresApp: 5 } }), ['5 errores de la app en 5 minutos']);
check('el freno de escrituras automáticas y las automáticas fallidas', alertasDe({ cortacircuitos: true, fallidasVentana: 3 }).length, 2);
check('el texto guardado junta las alertas y no pasa de 600', [anomaliaDe({ cortacircuitos: true, fallidasVentana: 3 }).includes(' · '), anomaliaDe({}).length], [true, 0]);
check('las claves con más cantidad, y el resto en "otras"', principales({ a: 1, b: 9, c: 5, d: 4, e: 3, f: 2, g: 7, h: 0 }), { b: 9, g: 7, c: 5, d: 4, e: 3, f: 2, otras: 1 });

// --- Equipo ---
check('Windows con Edge', describirEquipo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', { ancho: 1366, alto: 768 }),
  { sistema: 'Windows', navegador: 'Edge', movil: false, pantalla: '1366x768', instalada: false });
check('Android con Chrome, app instalada', describirEquipo('Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', { ancho: 412, alto: 915, instalada: true }),
  { sistema: 'Android', navegador: 'Chrome', movil: true, pantalla: '412x915', instalada: true });
const iphone = describirEquipo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
check('iPhone con Safari', `${iphone.sistema}/${iphone.navegador}`, 'iOS/Safari');

// --- El reporte tiene exactamente los campos que aceptan las reglas ---
const reporte = armarReporte({
  estacionId: 'abc123def456ghi7', uid: 'u1', usuario: 'lfernandez', nombre: 'Luis', rol: 'ADMIN', equipo: describirEquipo(''), build: 'b1', abiertaEn: 1, ahora: 2, visible: true,
  ventana: crearMedidor().ventana(), desde: 1, totales: crearMedidor().totales(), automaticas: { intentadas: 1, fallidas: 0, ventanaIntentadas: 1, ventanaFallidas: 0 },
  cortacircuitos: false, pausadas: false, anomalia: 'x'.repeat(900), ultimoError: 'y'.repeat(500), escuchadoresActivos: 12.7,
});
const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bloque = reglas.slice(reglas.indexOf('match /artifacts/{appId}/public/data/estaciones/'));
const lista = (re) => JSON.parse(`[${bloque.match(re)[1].replace(/'/g, '"')}]`).sort();
check('el reporte (más la hora del servidor que pone la app) tiene los mismos campos que permiten las reglas', [...Object.keys(reporte), 'reloj'].sort(), lista(/e\.keys\(\)\.hasOnly\(\[([^\]]*)\]/));
check('la ventana y el total también', [Object.keys(reporte.ventana).sort(), Object.keys(reporte.total).sort()], [lista(/e\.ventana\.keys\(\)\.hasOnly\(\[([^\]]*)\]/), lista(/e\.total\.keys\(\)\.hasOnly\(\[([^\]]*)\]/)]);
check('textos recortados a los topes de las reglas y escuchadores como entero', [reporte.anomalia.length, reporte.ultimoError.length, reporte.escuchadoresActivos], [600, 200, 13]);
const fuente = (ruta) => readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8');
check('la app guarda la hora del servidor en cada reporte', fuente('hooks/useEstacion.js').includes('reloj: serverTimestamp()'), true);

// --- Quién lo ve ---
check('solo lfernandez ve las estaciones (sin importar mayúsculas ni espacios)', [veEstaciones('lfernandez'), veEstaciones(' LFernandez '), veEstaciones('admin'), veEstaciones('')], [true, true, false, false]);
check('las reglas permiten leer a los mismos usuarios que la app', reglas.includes(`function veEstaciones(appId) {\n      return isActiveUser(appId) && get(profilePath(appId)).data.get('username', '') in [${USUARIOS_ESTACIONES.map((u) => `'${u}'`).join(', ')}];`), true);

// --- Pantalla ---
const ahora = 10 * EN_LINEA_MS;
const estaciones = [
  { id: 'vieja', ultimaSenal: ahora - EN_LINEA_MS - 1 },
  { id: 'normal', ultimaSenal: ahora - 1000 },
  { id: 'anomala', ultimaSenal: ahora - 5000, anomalia: 'Lee demasiado' },
  { id: 'anomalaDesconectada', ultimaSenal: ahora - EN_LINEA_MS * 2, anomalia: 'algo' },
];
check('en línea si reportó hace menos de 15 minutos', estaciones.map((e) => enLinea(e, ahora)), [false, true, true, false]);
check('primero la anómala en línea, luego la anómala desconectada, luego en línea, luego el resto', ordenarEstaciones(estaciones, ahora).map((e) => e.id), ['anomala', 'anomalaDesconectada', 'normal', 'vieja']);
check('hace cuánto', [haceCuanto(ahora, ahora), haceCuanto(ahora - 3 * 60000, ahora), haceCuanto(ahora - 5 * 3600000, ahora), haceCuanto(ahora - 4 * 86400000, ahora)], ['ahora', 'hace 3 min', 'hace 5 h', 'hace 4 d']);
const reloj = (ms) => ({ toMillis: () => ms });
check('reloj del equipo adelantado o atrasado respecto del servidor', [desfaseReloj({ ultimaSenal: 20 * 60000, reloj: reloj(5 * 60000) }), desfaseReloj({ ultimaSenal: 5 * 60000, reloj: reloj(20 * 60000) }), desfaseReloj({ ultimaSenal: 1 })], [15, -15, null]);
check('avisos de pantalla: reloj desfasado, versión anterior y sin conexión',
  avisosDePantalla({ ultimaSenal: 20 * 60000, reloj: reloj(5 * 60000), build: 'viejo', conectada: false }, 'nuevo').map((a) => a.split(' ').slice(0, 3).join(' ')),
  ['El reloj del', 'Usa una versión', 'Estaba sin conexión']);
check('un reloj con 2 minutos de diferencia y la versión actual: sin avisos', avisosDePantalla({ ultimaSenal: 2 * 60000, reloj: reloj(0), build: 'b' }, 'b'), []);

// --- Toda la app lee y escribe a través del medidor (si no, algo podría leer o escribir sin que la estación lo cuente) ---
const archivos = [];
const recorrer = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) recorrer(p); else if (/\.(js|jsx)$/.test(f)) archivos.push(p); } };
recorrer(fileURLToPath(new URL('../src', import.meta.url)));
const sinMedir = archivos.filter((p) => !p.replace(/\\/g, '/').endsWith('lib/medidorFirestore.js'))
  .filter((p) => /import \{[^}]*\b(onSnapshot|getDocs|getDoc|setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction)\b[^}]*\} from 'firebase\/firestore'/.test(readFileSync(p, 'utf8')));
check('ningún archivo lee ni escribe directo con firebase/firestore', sinMedir.map((p) => p.split(/[\\/]src[\\/]/)[1]), []);
check('la estación se reporta desde la raíz (todos los roles)', fuente('Root.jsx').includes('useEstacion(auth)'), true);

// --- Avisos cuando el registro de notificaciones push falla ---
const enBrave = explicarFalloPush({ brave: true, detalle: 'AbortError' });
check('en Brave dice qué ajuste cambiar, con los pasos, y conserva el código del error', [enBrave.titulo.startsWith('Brave'), enBrave.pasos.length, enBrave.pasos.some((p) => p.includes('brave://settings/privacy')), enBrave.pasos.some((p) => p.includes('mensajería push')), enBrave.detalle], [true, 4, true, true, 'AbortError']);
check('el paso de cerrar Brave por completo está (recargar la página no basta)', enBrave.pasos.some((p) => p.includes('Cierra Brave por completo')), true);
check('otro navegador con un error del servicio de push: pide revisar internet y reiniciar el navegador', explicarFalloPush({ detalle: 'messaging/token-subscribe-failed' }).pasos.length, 2);
check('otro error desconocido: sin explicación aparte (se muestra el aviso general)', explicarFalloPush({ detalle: 'Error' }), null);
const aviso = readFileSync(new URL('../src/components/AvisoNotificaciones.jsx', import.meta.url), 'utf8');
check('el aviso del fallo sale para el técnico y también en Brave aunque sea de oficina', aviso.includes("registro === 'error' && (avisarFallo || brave)"), true);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
