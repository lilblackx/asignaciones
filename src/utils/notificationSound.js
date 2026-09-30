// Beep corto generado con Web Audio, sin archivos de audio que mantener.
// El AudioContext se crea recién al primer uso (no en el import) porque los
// navegadores lo bloquean si no hay interacción del usuario todavía.
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

// Una notificación de "nueva asignación" puede llegar por un cambio remoto
// (Firestore) sin que el técnico haya tocado nada todavía en esa sesión —
// a diferencia de los otros sonidos, que normalmente ocurren después de que
// ya interactuó con la app. Sin una interacción previa, el navegador bloquea
// el AudioContext y resume() no sirve de nada porque no corre dentro de un
// gesto del usuario. Por eso se intenta desbloquear apenas haya cualquier
// primer toque/click/tecla en la página (por ejemplo, al iniciar sesión),
// mucho antes de que haga falta sonar una notificación.
let unlockAttached = false;
function ensureUnlockOnInteraction() {
  if (unlockAttached || typeof document === 'undefined') return;
  unlockAttached = true;
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
    } catch {
      // Sin Web Audio disponible: no hay nada que desbloquear.
    }
  };
  document.addEventListener('pointerdown', unlock, { once: true, passive: true });
  document.addEventListener('keydown', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
}
ensureUnlockOnInteraction();

function tone(ctx, freq, startTime, duration, peakGain) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle'; // más presencia que 'sine', sigue sin ser áspero
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Dos "ding-dong" seguidos, más fuerte y con más cuerpo que la versión anterior.
export function playPreFinalizadoSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    tone(ctx, 880, now, 0.18, 0.7);
    tone(ctx, 1174.66, now + 0.15, 0.22, 0.7);
    tone(ctx, 880, now + 0.42, 0.18, 0.55);
    tone(ctx, 1174.66, now + 0.57, 0.24, 0.55);
  } catch {
    // Sin Web Audio o autoplay bloqueado: se pierde el sonido, no la app.
  }
}

// Un solo tono, más grave: se distingue del ding-dong de pre-finalizado.
export function playTecnicoStatusSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    tone(ctx, 587.33, ctx.currentTime, 0.2, 0.5);
  } catch {
    // Sin Web Audio o autoplay bloqueado: se pierde el sonido, no la app.
  }
}

// Tres tonos ascendentes rápidos ("listo!"): para el técnico cuando le aprueban
// una orden. Distinto de los otros dos (ni el ding-dong ni el tono grave).
export function playAprobadoSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    tone(ctx, 659.25, now, 0.12, 0.6);
    tone(ctx, 830.61, now + 0.1, 0.12, 0.6);
    tone(ctx, 1046.5, now + 0.2, 0.22, 0.65);
  } catch {
    // Sin Web Audio o autoplay bloqueado: se pierde el sonido, no la app.
  }
}

// Dos tonos agudos cortos ("ping-ping"): para el técnico cuando le llega una
// orden nueva asignada. Distinto de los otros tres patrones ya usados.
export function playNuevaAsignacionSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    tone(ctx, 1046.5, now, 0.14, 0.65);
    tone(ctx, 1318.51, now + 0.12, 0.2, 0.65);
  } catch {
    // Sin Web Audio o autoplay bloqueado: se pierde el sonido, no la app.
  }
}
