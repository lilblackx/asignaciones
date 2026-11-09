// Prueba el aviso de "alguien está revisando esta orden" (src/lib/renovadorAviso.js y src/utils/avisoDeOrden.js): cuándo se renueva y cuándo no, con un reloj simulado (sin navegador ni Firestore).
// Cada renovación cuesta una escritura, una lectura del perfil en las reglas y una lectura en cada pestaña que escucha: solo debe renovarse mientras la pestaña se ve y la persona hace algo.
// Uso: `node scripts/test-aviso-orden.mjs`.
import { DURACION_AVISO_MS, INACTIVO_DESPUES_DE_MS, OCULTA_SIN_ESCUCHAR_DESPUES_DE_MS, RENOVAR_CADA_MS, debeRenovar } from '../src/utils/avisoDeOrden.js';
import { crearRenovador } from '../src/lib/renovadorAviso.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const S = 1000;

// Un reloj y un planificador simulados: `avanzar(ms)` corre las tareas que toquen en ese tiempo, en orden.
function entorno() {
  let t = 0;
  let viendose = true;
  const tareas = [];
  const llamadas = [];
  return {
    ahora: () => t,
    visible: () => viendose,
    cada: (fn, ms) => { const tarea = { fn, ms, proxima: t + ms, parada: false }; tareas.push(tarea); return () => { tarea.parada = true; }; },
    dejar: () => llamadas.push(Math.round(t / S)),
    avanzar(ms) {
      const fin = t + ms;
      for (;;) {
        const siguiente = tareas.filter((x) => !x.parada).sort((a, b) => a.proxima - b.proxima)[0];
        if (!siguiente || siguiente.proxima > fin) break;
        t = siguiente.proxima;
        siguiente.fn();
        siguiente.proxima += siguiente.ms;
      }
      t = fin;
    },
    ocultar() { viendose = false; },
    mostrar() { viendose = true; },
    llamadas,
  };
}

// --- Los tiempos ---
check('el aviso dura más de dos renovaciones y las reglas de Firestore lo admiten (nunca más de 10 minutos)', [DURACION_AVISO_MS >= 2 * RENOVAR_CADA_MS, DURACION_AVISO_MS <= 10 * 60000 - 60000, RENOVAR_CADA_MS >= 90 * S], [true, true, true]);
check('se renueva a más del doble de intervalo que antes (50 s) y una pestaña oculta espera un rato antes de dejar de escuchar', [RENOVAR_CADA_MS >= 2 * 50 * S, OCULTA_SIN_ESCUCHAR_DESPUES_DE_MS >= 60 * S], [true, true]);

// --- La regla ---
check('se renueva con la pestaña a la vista y actividad reciente; no con la pestaña oculta ni con la persona inactiva', [
  debeRenovar({ visible: true, ultimaActividad: 0, ahora: 60 * S }),
  debeRenovar({ visible: false, ultimaActividad: 0, ahora: 60 * S }),
  debeRenovar({ visible: true, ultimaActividad: 0, ahora: INACTIVO_DESPUES_DE_MS }),
  debeRenovar({ visible: true, ultimaActividad: 0, ahora: INACTIVO_DESPUES_DE_MS - 1 }),
], [true, false, false, true]);

// --- Con una persona activa y la pestaña a la vista ---
{
  const e = entorno();
  const r = crearRenovador(e);
  check('el aviso se deja al empezar', e.llamadas, [0]);
  for (let i = 0; i < 10; i++) { e.avanzar(30 * S); r.actividad(); }   // 5 minutos con actividad cada 30 s
  check('con actividad y la pestaña a la vista se renueva cada ~100 s (no cada 50 s)', e.llamadas, [0, 100, 200, 300]);
  r.detener();
  e.avanzar(600 * S);
  check('al detenerlo no se renueva más', e.llamadas.length, 4);
}

// --- Pestaña oculta ---
{
  const e = entorno();
  const r = crearRenovador(e);
  e.avanzar(60 * S); r.actividad();
  e.ocultar();
  e.avanzar(300 * S);
  check('con la pestaña oculta no se renueva (el aviso vence solo)', e.llamadas, [0]);
  e.mostrar();
  r.actividad();   // volver a ver la pestaña cuenta como actividad
  check('al volver a verla se deja el aviso de inmediato', e.llamadas, [0, 360]);
  e.avanzar(30 * S); r.actividad();
  check('y no se repite enseguida con la renovación que tocaba', e.llamadas, [0, 360]);
  e.avanzar(120 * S); r.actividad();
  check('después sigue su ritmo normal (la próxima renovación del reloj, sin que el aviso llegue a vencer: 140 s entre una y otra, de 240 s que dura)', [e.llamadas, 500 - 360 < DURACION_AVISO_MS / S], [[0, 360, 500], true]);
}

// --- Persona inactiva con la pestaña a la vista ---
{
  const e = entorno();
  const r = crearRenovador(e);
  e.avanzar(INACTIVO_DESPUES_DE_MS + 200 * S);   // sin tocar nada
  check('sin actividad deja de renovar pasados 5 minutos, pero antes sí renueva', e.llamadas, [0, 100, 200]);
  r.actividad();
  check('apenas la persona hace algo se deja el aviso de nuevo', e.llamadas.at(-1), Math.round((INACTIVO_DESPUES_DE_MS + 200 * S) / S));
  const antes = e.llamadas.length;
  e.avanzar(10 * S); r.actividad();
  check('y mover el mouse seguido no escribe una y otra vez', e.llamadas.length, antes);
}

// --- Actividad antes de que venza el plazo: nunca se pausa ---
{
  const e = entorno();
  const r = crearRenovador(e);
  for (let i = 0; i < 40; i++) { e.avanzar(60 * S); r.actividad(); }   // 40 minutos con actividad cada minuto
  check('mientras haya actividad se renueva durante 40 minutos sin cortes (cada ~100 s o 120 s según el tic)', e.llamadas.every((t, i, l) => i === 0 || t - l[i - 1] <= 120) && e.llamadas.length >= 20, true);
}

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
