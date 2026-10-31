// Prueba los frenos de las escrituras automáticas (src/lib/escrituraAutomatica.js) y la recarga forzada (src/utils/recargaForzada.js).
// Reproduce el incidente del 31/10/2026: una lista en vivo que vuelve a mostrar un aviso cuyo borrado el servidor rechaza, y el código lo
// intenta borrar en cada cambio. No necesita el emulador. Uso: `node scripts/test-escritura-automatica.mjs`.
import { readFileSync } from 'node:fs';
import {
  ESPERAS_MS, MAX_FALLOS_SESION, MAX_INTENTOS, crearCortacircuitos, crearRegistroIntentos, ejecutarAutomatica, setAutomaticasPausadas,
} from '../src/lib/escrituraAutomatica.js';
import { debeRecargar } from '../src/utils/recargaForzada.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const silenciar = () => { const w = console.warn; const e = console.error; console.warn = () => {}; console.error = () => {}; return () => { console.warn = w; console.error = e; }; };
const esperarMicrotareas = () => new Promise((r) => setTimeout(r, 0));

// --- Registro de intentos por tarea ---
{
  const r = crearRegistroIntentos();
  check('una tarea nueva se puede intentar', r.puede('a', 0), true);
  r.empezar('a');
  check('mientras está en curso no se repite', r.puede('a', 0), false);
  r.fallo('a', 1000);
  check('tras fallar espera antes del 2.º intento', [r.puede('a', 1000), r.puede('a', 1000 + ESPERAS_MS[0] - 1), r.puede('a', 1000 + ESPERAS_MS[0])], [false, false, true]);
  r.empezar('a'); r.fallo('a', 2000);
  check('y espera más antes del 3.º', [r.puede('a', 2000 + ESPERAS_MS[0]), r.puede('a', 2000 + ESPERAS_MS[1])], [false, true]);
  r.empezar('a'); r.fallo('a', 3000);
  check(`tras ${MAX_INTENTOS} fallos no se intenta más en la sesión`, r.puede('a', 3000 + 365 * 86400000), false);
  r.empezar('b'); r.exito('b');
  check('una tarea que salió bien no se vuelve a hacer', r.puede('b', 10 ** 12), false);
}

// --- Cortacircuitos de la sesión ---
{
  const c = crearCortacircuitos({ maxFallos: 3, ventanaMs: 1000 });
  c.registrarFallo(0); c.registrarFallo(10);
  check('con menos fallos que el tope sigue cerrado', c.abierto(), false);
  check('los fallos viejos (fuera de la ventana) no suman', c.registrarFallo(5000), false);
  c.registrarFallo(5001);
  check('al llegar al tope dentro de la ventana se abre', c.registrarFallo(5002), true);
  check('y queda abierto', c.abierto(), true);
}

// --- El incidente: una lista en vivo que dispara la misma limpieza sin fin ---
{
  const restaurar = silenciar();
  let reloj = 1_000_000;
  const ahora = () => reloj;
  let llamadas = 0;
  const borradoRechazado = () => { llamadas++; return Promise.reject(new Error('permission-denied')); };
  for (let i = 0; i < 1000; i++) {
    ejecutarAutomatica('bloqueo:incidente', borradoRechazado, { ahora });
    await esperarMicrotareas();
  }
  check('1000 cambios de la lista seguidos: un solo intento llega al servidor', llamadas, 1);
  reloj += ESPERAS_MS[0];
  for (let i = 0; i < 1000; i++) { ejecutarAutomatica('bloqueo:incidente', borradoRechazado, { ahora }); await esperarMicrotareas(); }
  reloj += ESPERAS_MS[1];
  for (let i = 0; i < 1000; i++) { ejecutarAutomatica('bloqueo:incidente', borradoRechazado, { ahora }); await esperarMicrotareas(); }
  reloj += 86400000;
  for (let i = 0; i < 1000; i++) { ejecutarAutomatica('bloqueo:incidente', borradoRechazado, { ahora }); await esperarMicrotareas(); }
  check(`en todo un día de cambios, como máximo ${MAX_INTENTOS} intentos`, llamadas, MAX_INTENTOS);
  restaurar();
}

// --- Muchas tareas distintas fallando: el cortacircuitos apaga todo ---
{
  const restaurar = silenciar();
  let llamadas = 0;
  const falla = () => { llamadas++; return Promise.reject(new Error('rechazada')); };
  for (let i = 0; i < 500; i++) { ejecutarAutomatica(`distinta:${i}`, falla); await esperarMicrotareas(); }
  // La tarea del bloque anterior ya sumó fallos a la misma sesión: el corte llega a más tardar en MAX_FALLOS_SESION.
  check(`500 tareas distintas que fallan: se cortan antes de ${MAX_FALLOS_SESION + 1} intentos`, llamadas <= MAX_FALLOS_SESION, true);
  let despues = 0;
  ejecutarAutomatica('otra:mas', () => { despues++; return Promise.resolve(); });
  await esperarMicrotareas();
  check('con el cortacircuitos abierto ninguna escritura automática corre', despues, 0);
  restaurar();
}

// --- La pausa remota (config/app) se prueba con un registro nuevo: el módulo de arriba ya quedó cortado ---
{
  const mod = await import(`../src/lib/escrituraAutomatica.js?pausa=${Date.now()}`);
  let llamadas = 0;
  mod.setAutomaticasPausadas(true);
  const r = mod.ejecutarAutomatica('pausada', () => { llamadas++; return Promise.resolve(); });
  await esperarMicrotareas();
  check('con pausarAutomaticas no se escribe nada', [r, llamadas], [null, 0]);
  mod.setAutomaticasPausadas(false);
  await mod.ejecutarAutomatica('pausada', () => { llamadas++; return Promise.resolve('ok'); });
  check('al reanudar vuelve a escribir', llamadas, 1);
  const restaurar = silenciar();
  const res = await mod.ejecutarAutomatica('falla-sin-romper', () => Promise.reject(new Error('x'))).catch(() => 'RECHAZÓ');
  restaurar();
  check('una escritura que falla nunca rechaza hacia quien la pidió', res === 'RECHAZÓ' ? 'RECHAZÓ' : 'no rechaza', 'no rechaza');
}
setAutomaticasPausadas(false);

// --- Recarga forzada ---
check('página abierta antes de la marca y sin recarga previa: se recarga', debeRecargar(5000, 1000, null), true);
check('ya se recargó por esa marca: no otra vez (aunque el reloj esté atrasado)', debeRecargar(5000, 1000, '5000'), false);
check('página abierta después de la marca: no', debeRecargar(5000, 6000, null), false);
check('sin almacenamiento en el navegador: no (mejor no obedecer que arriesgar un bucle)', debeRecargar(5000, 1000, undefined), false);
check('marca vacía o inválida: no', [debeRecargar(undefined, 1000, null), debeRecargar('mañana', 1000, null), debeRecargar(0, 1000, null)], [false, false, false]);
check('una marca nueva después de una anterior: sí', debeRecargar(9000, 1000, '5000'), true);

// --- Las escrituras automáticas conocidas pasan por el freno ---
const fuente = (ruta) => readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8');
check('la limpieza de avisos de revisión, completar la promotora, numerar ventas y anotar el operador usan ejecutarAutomatica',
  ['hooks/useBloqueosOrden.js', 'hooks/useCompletarPromotoras.js', 'hooks/useTickets.js', 'hooks/useOperadorEnOrdenes.js'].map((r) => fuente(r).includes('ejecutarAutomatica(')), [true, true, true, true]);
check('la limpieza de avisos ya no borra directo dentro del escuchador', /forEach\(\(a\) => deleteDoc/.test(fuente('hooks/useBloqueosOrden.js')), false);
check('los escuchadores de órdenes y técnicos no dependen de setToastMsg ni de onNotify (no se resuscriben en cada render)',
  ['hooks/useTickets.js', 'hooks/useTechnicians.js'].map((r) => /\}, \[firebaseUser, role, tecnicoAsociado, setToastMsg, onNotify\]\)/.test(fuente(r))), [false, false]);
check('el control remoto está en la raíz (llega a todos los roles)', fuente('Root.jsx').includes('useControlRemoto(auth.firebaseUser)'), true);
const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
check('borrar un aviso que ya no existe no es un error en las reglas', /bloqueosOrden[\s\S]*?allow delete:[^;]*resource == null/.test(reglas), true);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
