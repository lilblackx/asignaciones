// Prueba el logo de temporada (src/utils/temporada.js): el logo de Navidad se ve en el login y en el menú lateral hasta el 1 de enero (hora de Caracas) y desde el 2 de enero vuelve solo el de siempre; el ícono de la app
// instalada (manifest, pantalla de inicio, notificaciones) no cambia nunca con la fecha. No necesita el emulador.
// Uso: `npm run test:temporada`.
import { existsSync, readFileSync } from 'node:fs';
import { NAVIDAD_DESDE, NAVIDAD_HASTA, esNavidad, logosDeTemporada } from '../src/utils/temporada.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(ruta, 'utf8');
const caracas = (iso) => Date.parse(`${iso}-04:00`);

check('las fechas de la temporada', [NAVIDAD_DESDE, NAVIDAD_HASTA], ['2026-11-01', '2027-01-01']);
check('Navidad: se ve hoy (13 de noviembre), el 24 y el 25 de diciembre y el 31 de diciembre', ['2026-11-13T12:00:00', '2026-12-24T09:00:00', '2026-12-25T00:00:00', '2026-12-31T23:59:59'].map((f) => esNavidad(caracas(f))), [true, true, true, true]);
check('el 1 de enero todavía se ve, hasta el último segundo en Caracas', [esNavidad(caracas('2027-01-01T00:00:00')), esNavidad(caracas('2027-01-01T23:59:59'))], [true, true]);
check('el 2 de enero a las 00:00 (Caracas) vuelve el logo normal, y también después', [esNavidad(caracas('2027-01-02T00:00:00')), esNavidad(caracas('2027-01-02T08:00:00')), esNavidad(caracas('2027-03-15T12:00:00'))], [false, false, false]);
check('antes de la temporada no se ve', [esNavidad(caracas('2026-10-31T23:59:59')), esNavidad(caracas('2026-06-01T12:00:00'))], [false, false]);
check('la hora de Caracas manda, no la del dispositivo: la noche del 1 de enero en Caracas ya es 2 de enero en UTC y todavía es Navidad', [esNavidad(Date.parse('2027-01-02T03:00:00Z')), esNavidad(Date.parse('2027-01-02T04:00:00Z'))], [true, false]);

const navidad = logosDeTemporada(caracas('2026-12-20T10:00:00'));
const normal = logosDeTemporada(caracas('2027-02-01T10:00:00'));
check('en Navidad el login y el menú usan los archivos de /navidad', [navidad.menu, navidad.login192, navidad.login512], ['/navidad/logo-menu.png', '/navidad/login-192.png', '/navidad/login-transparente.webp']);
check('los dos logos del login van sin fondo y sin degradado en los bordes', [navidad.login512Difuminado, logosDeTemporada(caracas('2027-02-01T10:00:00')).login512Difuminado], [false, false]);
check('fuera de Navidad usan los de siempre', [normal.menu, normal.login192, normal.login512], ['/logo-menu.png', '/icon-192x192.png', '/login-normal.webp']);
check('el logo del login se pide con prioridad alta (WebP de 548 KB)', leer('src/components/LoginScreen.jsx').includes('fetchPriority="high"'), true);
check('la elección sigue a la fecha aunque se pida varias veces seguidas (el cálculo se guarda por hora)', [logosDeTemporada(caracas('2027-01-01T23:00:00')).menu, logosDeTemporada(caracas('2027-01-01T23:30:00')).menu, logosDeTemporada(caracas('2027-01-02T00:30:00')).menu], ['/navidad/logo-menu.png', '/navidad/logo-menu.png', '/logo-menu.png']);
check('existen los archivos de Navidad', ['public/navidad/logo-menu.png', 'public/navidad/login-192.png', 'public/navidad/login-1024.png'].map(existsSync), [true, true, true]);

// El ícono de la app instalada no se toca: nada de eso apunta a /navidad ni usa el cálculo por fecha.
check('el manifest, la barra del navegador, el service worker y las notificaciones no usan el logo de Navidad', ['vite.config.js', 'index.html', 'src/sw.js', 'src/components/modals/reports/CierreAutomaticoConfig.jsx'].map((f) => leer(f).includes('navidad')), [false, false, false, false]);
check('el manifest sigue con los íconos de siempre', [leer('vite.config.js').includes("src: '/icon-192x192.png'"), leer('vite.config.js').includes("src: '/icon-512x512.png'"), leer('index.html').includes('href="/icon-192x192.png"')], [true, true, true]);
check('solo el login y el menú lateral usan el logo de temporada', [leer('src/components/LoginScreen.jsx').includes('logosDeTemporada()'), leer('src/components/Sidebar.jsx').includes('logosDeTemporada()'), leer('src/components/LoginScreen.jsx').includes('src={logos.login192}'), leer('src/components/LoginScreen.jsx').includes('src={logos.login512}'), leer('src/components/Sidebar.jsx').includes('src={logos.login192}')], [true, true, true, true, true]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
