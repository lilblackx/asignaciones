// Prueba el escáner de serial con cámara: qué códigos de la etiqueta de la caja se aceptan (solo el PON S/N o el GPON SN, con LA MISMA verificación del campo a mano) y cuáles se rechazan (la MAC,
// el S/N de fábrica, el EAN-13...), con las etiquetas reales de V-SOL y TP-Link; y que el botón esté conectado a los campos del serial. No necesita el emulador. Uso: `npm run test:lecturaserial`.
import { readFileSync } from 'node:fs';
import { leerCodigo, mejorLectura, normalizarLectura } from '../src/utils/lecturaSerial.js';
import { evaluarSerialCaja } from '../src/utils/serialOlt.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const tipo = (t) => leerCodigo(t).tipo;
const leer = (nombre) => readFileSync(new URL(nombre, import.meta.url), 'utf8').replaceAll('\r\n', '\n');

// --- Etiqueta V-SOL (MAC, PON S/N y S/N de fábrica) ---
check('V-SOL: el PON S/N se acepta', leerCodigo('VSOL00B9766A'), { tipo: 'ok', leido: 'VSOL00B9766A', serial: 'VSOL00B9766A', etiqueta: 'PON S/N · V-SOL', mensaje: '' });
check('V-SOL: la MAC se rechaza como MAC', tipo('4C46D1B97669'), 'mac');
check('V-SOL: el S/N de fábrica se rechaza', tipo('LP20251124357'), 'otro');

// --- Etiqueta TP-Link MR (S/N de fábrica, MAC, GPON SN y EAN-13) ---
check('TP-Link: el GPON SN se acepta', leerCodigo('54504C47BDAA8E40'), { tipo: 'ok', leido: '54504C47BDAA8E40', serial: '54504C47BDAA8E40', etiqueta: 'GPON SN · TP-Link', mensaje: '' });
check('TP-Link: el GPON SN con "GPON" delante también', tipo('GPON54504C47BDAA8E40'), 'ok');
check('TP-Link: la MAC (CCBABDAA8E40) se rechaza aunque empiece con cuatro letras A-F', tipo('CCBABDAA8E40'), 'mac');
check('TP-Link: la MAC con guiones (CC-BA-BD-AA-8E-40) se rechaza', tipo('CC-BA-BD-AA-8E-40'), 'otro');
check('TP-Link: el S/N de fábrica (2259196006167) se rechaza', tipo('2259196006167'), 'otro');
check('TP-Link: el EAN-13 (1210002603317) se rechaza', tipo('1210002603317'), 'otro');

// --- Otras marcas, como hasta ahora ---
check('BT-PON se acepta', leerCodigo('BTPTDD9BA416').etiqueta, 'PON S/N · BT-PON');
check('Huawei en texto se acepta', tipo('HWTC10184360'), 'ok');
check('AmericanPon (XPSN con dos puntos) se acepta', tipo('XPSN:4857544310184360'), 'ok');
check('"GOPN" (GPON al revés) se rechaza', tipo('GOPN54504C47BDAA8E40'), 'otro');
check('un código demasiado largo se rechaza', tipo('A'.repeat(40)), 'otro');
check('un código vacío no es una lectura', mejorLectura(['', '  ']), null);

// --- Lo que se acepta es EXACTAMENTE lo que acepta el campo a mano (incluida la MAC con letras A-F, que antes a mano se colaba como serial correcto) ---
for (const t of ['CCBABDAA8E40', '4C46D1B97669', 'VSOL00B9766A', '54504C47BDAA8E40', 'BTPTDD9BA416', 'HWTC10184360', 'XPSN4857544310184360', 'LP20251124357', '2259196006167', 'GOPN54504C47BDAA8E40']) {
  check(`el escáner y el campo a mano coinciden con ${t}`, tipo(t) === 'ok', evaluarSerialCaja(t).estado === 'ok');
}

check('a mano: la MAC de la etiqueta TP-Link (CCBABDAA8E40) ya no se acepta como serial', [evaluarSerialCaja('CCBABDAA8E40').estado, evaluarSerialCaja('CCBABDAA8E40').codigo], ['error', 'MAC']);
check('a mano: el GPON SN y el PON S/N siguen aceptándose', ['54504C47BDAA8E40', 'VSOL00B9766A', 'BTPTDD9BA416', 'HWTC10184360'].map((t) => evaluarSerialCaja(t).estado), ['ok', 'ok', 'ok', 'ok']);

// --- Varios códigos a la vez en el recuadro ---
check('entre la MAC, el S/N y el PON S/N gana el PON S/N', mejorLectura(['4C46D1B97669', 'LP20251124357', 'VSOL00B9766A']).serial, 'VSOL00B9766A');
check('si solo se ven la MAC y el S/N, se avisa de la MAC', mejorLectura(['LP20251124357', '4C46D1B97669']).tipo, 'mac');
check('si solo se ve el S/N, se rechaza como otro código', mejorLectura(['LP20251124357']).tipo, 'otro');
check('los dos puntos y los espacios se quitan antes de leer', normalizarLectura(' xpsn:4857 5443 '), 'XPSN48575443');

// --- Conexiones ---
const instalacion = leer('../src/components/modals/DatosInstalacion.jsx');
const equipo = leer('../src/components/modals/SerialEquipoCampo.jsx');
const boton = leer('../src/components/BotonEscanearSerial.jsx');
const modal = leer('../src/components/modals/EscanearSerialModal.jsx');
const lector = leer('../src/lib/lectorCodigos.js');
check('la instalación tiene el botón Escanear junto al serial', instalacion.includes('<BotonEscanearSerial') && instalacion.includes('id="pf-serial"'), true);
check('el equipo nuevo (cambio de equipo) tiene el botón Escanear', equipo.includes('<BotonEscanearSerial') && equipo.includes('id="pf-serial-equipo"'), true);
check('lo escaneado entra al campo con la misma limpieza que lo escrito', instalacion.includes("leido.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase()") && equipo.includes("leido.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase()"), true);
check('la ventana del escáner se baja solo al tocar el botón (carga diferida)', boton.includes("lazy(() => import('./modals/EscanearSerialModal'))"), true);
check('el escáner solo usa lo que se lee con mejorLectura (la misma verificación del serial)', modal.includes("mejorLectura(") && modal.includes("mejor.tipo === 'ok'"), true);
check('"Usar este serial" es lo único que llena el campo (no se llena solo al leer)', modal.includes('onLeido(leido.serial)') && !/setLeido\([^)]*\);[^]*onLeido/.test(modal.split('const usar')[0]), true);
check('la librería ZXing se baja solo donde no hay lector del navegador', lector.includes("import('@zxing/browser')") && !/^import .*zxing/m.test(lector), true);
check('solo se lee lo que cae dentro del recuadro guía', lector.includes('export function recortarMarco') && modal.includes('recortarMarco(videoRef.current, marcoRef.current'), true);
check('la cámara se apaga al cerrar la ventana', modal.includes('camaraRef.current?.cerrar()'), true);

// El hosting no debe bloquear la cámara (antes decía camera=(): en producción el navegador la negaba sin preguntar) ni abrirla a otros sitios.
const hosting = JSON.parse(leer('../firebase.json')).hosting.headers.flatMap((h) => h.headers).find((h) => h.key === 'Permissions-Policy').value;
check('el hosting permite la cámara solo a la propia app (camera=(self)) y mantiene el micrófono cerrado (la ubicación la prueba test-ruta-del-dia)', hosting.includes('camera=(self)') && hosting.includes('microphone=()'), true);
const config = leer('../vite.config.js');
check('la librería ZXing no se descarga con la instalación de la app (fuera del precache)', config.includes("'**/esm-*.js'"), true);

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las pruebas pasaron.');
