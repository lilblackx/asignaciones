// Prueba la pantalla Configuración (solo ADMIN): "Estado del sistema" (src/utils/estadoSistema.js: versión publicada y escrituras automáticas) y el interruptor remoto
// (src/utils/interruptorRemoto.js: pausarAutomaticas de config/app). Comprueba que el estado no lea nada de Firestore, que el interruptor guarde solo su campo (merge) y que las reglas
// lo permitan solo al ADMIN. No necesita el emulador. Uso: `node scripts/test-estado-sistema.mjs`.
import { readFileSync } from 'node:fs';
import { NIVEL, estadoDeAutomaticas, estadoDeVersion } from '../src/utils/estadoSistema.js';
import { CAMPO_PAUSA, cambioDePausa, leerInterruptor } from '../src/utils/interruptorRemoto.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const sinComentarios = (t) => t.replace(/^\s*\/\/.*$/gm, '');

// --- Versión ---
check('misma compilación: última versión', estadoDeVersion('abc-1', 'abc-1').nivel, NIVEL.BIEN);
check('compilación distinta: hay una nueva', estadoDeVersion('abc-2', 'abc-1').nivel, NIVEL.AVISO);
check('con una actualización ya descargada avisa aunque coincida', estadoDeVersion('abc-1', 'abc-1', { actualizacionLista: true }).nivel, NIVEL.AVISO);
check('sin respuesta del servidor no se afirma nada', [estadoDeVersion(null, 'abc-1').nivel, estadoDeVersion('', 'abc-1').nivel, estadoDeVersion(12, 'abc-1').nivel], [NIVEL.INFO, NIVEL.INFO, NIVEL.INFO]);

// --- Escrituras automáticas ---
check('normales', estadoDeAutomaticas({ pausadas: false }).nivel, NIVEL.BIEN);
check('pausadas por el interruptor remoto: atención, y lo nombra', [estadoDeAutomaticas({ pausadas: true }).nivel, estadoDeAutomaticas({ pausadas: true }).texto.includes('interruptor remoto')], [NIVEL.AVISO, true]);
check('el interruptor manda sobre el cortacircuitos', estadoDeAutomaticas({ pausadas: true, cortacircuitos: true }).texto.includes('interruptor remoto'), true);
check('cortacircuitos de la sesión: atención', estadoDeAutomaticas({ pausadas: false, cortacircuitos: true }).nivel, NIVEL.AVISO);
check('mientras no se lee el interruptor no se afirma nada', estadoDeAutomaticas({ pausadas: null }).nivel, NIVEL.INFO);

// --- Interruptor remoto ---
check('sin documento o sin campo: apagado (nada pausado)', [leerInterruptor(null).pausarAutomaticas, leerInterruptor({}).pausarAutomaticas, leerInterruptor(undefined).pausarAutomaticas], [false, false, false]);
check('solo true pausa: "true" en texto, 1 u otros valores no', [leerInterruptor({ pausarAutomaticas: true }).pausarAutomaticas, leerInterruptor({ pausarAutomaticas: 'true' }).pausarAutomaticas, leerInterruptor({ pausarAutomaticas: 1 }).pausarAutomaticas], [true, false, false]);
check('lee quién y cuándo lo cambió (y descarta lo que no sea texto o número)', [leerInterruptor({ actualizadoPor: 'Ana', actualizadoEn: 5 }), leerInterruptor({ actualizadoPor: 7, actualizadoEn: 'x' })], [{ pausarAutomaticas: false, actualizadoPor: 'Ana', actualizadoEn: 5 }, { pausarAutomaticas: false, actualizadoPor: '', actualizadoEn: 0 }]);
check('el campo se llama como lo lee la app y lo escribe scripts/control-remoto.mjs', [CAMPO_PAUSA, /pausarAutomaticas/.test(leer('../src/hooks/useControlRemoto.js')), /pausarAutomaticas: true/.test(leer('./control-remoto.mjs')), /pausarAutomaticas: false/.test(leer('./control-remoto.mjs'))], ['pausarAutomaticas', true, true, true]);
check('al cambiarlo escribe el valor, quién y cuándo', cambioDePausa(true, 'Ana', 99), { pausarAutomaticas: true, actualizadoPor: 'Ana', actualizadoEn: 99 });
check('un valor que no es true se guarda como false y el nombre se recorta a 80 letras', [cambioDePausa('si', 'x').pausarAutomaticas, cambioDePausa(false, 'x').pausarAutomaticas, cambioDePausa(true, 'a'.repeat(200)).actualizadoPor.length], [false, false, 80]);

// --- El hook del interruptor ---
const hookInterruptor = sinComentarios(leer('../src/hooks/useInterruptorRemoto.js'));
check('escucha solo config/app y solo con Configuración abierta', [/'config', 'app'/.test(hookInterruptor), /if \(!firebaseUser \|\| !activo\) return undefined/.test(hookInterruptor)], [true, true]);
check('guarda con merge (no pisa recargarAntesDe ni pausarEstaciones)', /setDoc\(ref\(\), cambioDePausa\(valor, usuario\), \{ merge: true \}\)/.test(hookInterruptor), true);
check('pasa por el medidor de Estaciones', /from '\.\.\/lib\/medidorFirestore\.js'/.test(hookInterruptor), true);
check('App lo activa solo con Configuración abierta y se lo pasa a la pantalla', [/useInterruptorRemoto\(firebaseUser, configuracionAbierta,/.test(leer('../src/App.jsx')), /<ConfiguracionView[^>]*interruptor=\{interruptorRemoto\}/.test(leer('../src/App.jsx'))], [true, true]);
check('las reglas dejan escribir config/app solo al ADMIN y leerlo a todo usuario activo (config/{docId})', /match \/artifacts\/\{appId\}\/public\/data\/config\/\{docId\} \{\s*allow read: if isActiveUser\(appId\);\s*allow write: if isAdminUser\(appId\);/.test(leer('../firestore.rules')), true);

// --- El estado del sistema no lee Firestore ---
const hookEstado = sinComentarios(leer('../src/hooks/useEstadoSistema.js'));
check('el estado solo pide /version.json: sin Firestore, sin escuchadores y sin temporizadores', [/fetch\('\/version\.json'/.test(hookEstado), /firebase|getDoc|onSnapshot|setDoc|updateDoc|addDoc|deleteDoc|setInterval|setTimeout/.test(hookEstado)], [true, false]);
const vista = sinComentarios(leer('../src/components/EstadoSistema.jsx'));
check('la pantalla del estado no escribe ni escucha por su cuenta', /onSnapshot|setDoc|updateDoc|addDoc|deleteDoc|from 'firebase\/firestore'/.test(vista), false);
check('la tasa del dólar ya no está en Configuración (vive en su módulo)', [/tasasDolar|Tasa del dólar guardada/.test(vista), /tasasDolar/.test(hookEstado), /estadoDeTasa/.test(leer('../src/utils/estadoSistema.js'))], [false, false, false]);

console.log(failures ? `\n${failures} fallaron` : '\nTodas pasaron');
process.exit(failures ? 1 : 0);
