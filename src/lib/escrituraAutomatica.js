// Escrituras que la app hace sola, sin que nadie pulse nada (limpiar avisos vencidos, completar un dato que falta en una orden, numerar una
// venta...). Son las únicas que pueden repetirse sin fin: si el servidor las rechaza, la lista en vivo vuelve a mostrar lo mismo y el código las
// intenta otra vez. Eso pasó el 31/10/2026 con la limpieza de avisos de revisión: ~6 borrados rechazados por segundo durante horas, y cada
// uno costó una lectura en las reglas. Toda escritura automática pasa por `ejecutarAutomatica`, que pone tres frenos:
//   1. Por tarea (`clave`): no se repite mientras está en curso; si falla, espera cada vez más antes de reintentar y, tras MAX_INTENTOS,
//      no se intenta más en esta sesión. Si sale bien, no se vuelve a hacer.
//   2. Cortacircuitos de la sesión: si fallan demasiadas escrituras automáticas en poco tiempo, se apagan todas hasta recargar la página.
//   3. Interruptor remoto: con `pausarAutomaticas` en config/app (ver useControlRemoto) ninguna sesión hace escrituras automáticas.
// Lo que pulsa una persona (guardar, aprobar, pagar) no pasa por aquí: eso ya se hace una vez por clic.

export const MAX_INTENTOS = 3;
// Espera antes del 2.º y del 3.er intento.
export const ESPERAS_MS = [60 * 1000, 10 * 60 * 1000];
export const MAX_FALLOS_SESION = 20;
export const VENTANA_FALLOS_MS = 60 * 1000;

// Cuándo puede volver a intentarse cada tarea. Funciones puras con el reloj por parámetro (las prueba scripts/test-escritura-automatica.mjs).
export function crearRegistroIntentos({ maxIntentos = MAX_INTENTOS, esperasMs = ESPERAS_MS } = {}) {
  const tareas = new Map(); // clave -> { intentos, enCurso, hecha, proximoEn }
  return {
    // ¿Se puede intentar ahora?
    puede(clave, ahora) {
      const t = tareas.get(clave);
      if (!t) return true;
      return !t.hecha && !t.enCurso && t.intentos < maxIntentos && ahora >= t.proximoEn;
    },
    empezar(clave) {
      const t = tareas.get(clave) || { intentos: 0, enCurso: false, hecha: false, proximoEn: 0 };
      tareas.set(clave, { ...t, intentos: t.intentos + 1, enCurso: true });
    },
    exito(clave) {
      tareas.set(clave, { ...tareas.get(clave), enCurso: false, hecha: true });
    },
    fallo(clave, ahora) {
      const t = tareas.get(clave);
      const espera = esperasMs[Math.min(t.intentos - 1, esperasMs.length - 1)] ?? 0;
      tareas.set(clave, { ...t, enCurso: false, proximoEn: ahora + espera });
    },
    intentos: (clave) => tareas.get(clave)?.intentos || 0,
  };
}

// Abierto (todo apagado) cuando hubo `maxFallos` o más fallos dentro de `ventanaMs`. Una vez abierto, queda así hasta recargar.
export function crearCortacircuitos({ maxFallos = MAX_FALLOS_SESION, ventanaMs = VENTANA_FALLOS_MS } = {}) {
  let fallos = [];
  let abierto = false;
  return {
    abierto: () => abierto,
    registrarFallo(ahora) {
      fallos = [...fallos.filter((t) => ahora - t < ventanaMs), ahora];
      if (fallos.length >= maxFallos) abierto = true;
      return abierto;
    },
  };
}

// --- El estado de esta sesión ---

const registro = crearRegistroIntentos();
const cortacircuitos = crearCortacircuitos();
let pausadas = false;
let avisoCorte = false;

// Lo cambia useControlRemoto con lo que dice config/app.
export function setAutomaticasPausadas(valor) {
  pausadas = Boolean(valor);
}
export const automaticasPausadas = () => pausadas;

// Corre `escribir()` (una promesa) si la tarea `clave` se puede intentar ahora. Devuelve la promesa de la escritura, o null si no se intentó.
// Nunca rechaza: un fallo se cuenta y se anota en la consola, y el que llama no tiene que capturarlo.
export function ejecutarAutomatica(clave, escribir, { ahora = Date.now } = {}) {
  if (pausadas || cortacircuitos.abierto() || !registro.puede(clave, ahora())) return null;
  registro.empezar(clave);
  return Promise.resolve()
    .then(escribir)
    .then((resultado) => {
      registro.exito(clave);
      return resultado;
    })
    .catch((error) => {
      registro.fallo(clave, ahora());
      if (cortacircuitos.registrarFallo(ahora()) && !avisoCorte) {
        avisoCorte = true;
        console.error(`Demasiadas escrituras automáticas fallaron (${MAX_FALLOS_SESION} en ${VENTANA_FALLOS_MS / 1000} s): se apagan en esta sesión hasta recargar la página.`);
      }
      console.warn(`Escritura automática "${clave}" falló (intento ${registro.intentos(clave)} de ${MAX_INTENTOS}):`, error);
      return null;
    });
}
