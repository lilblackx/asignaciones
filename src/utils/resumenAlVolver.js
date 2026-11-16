// Resumen de avisos al volver a la app después de mucho tiempo. Al abrirla con un punto de partida viejo (ver `baseline` en hooks/useTickets), todo lo que cambió mientras no estaba llega de golpe: un aviso en
// pantalla y un sonido por cada tipo, que se pisan entre sí. Aquí se juntan en uno solo: cuántos avisos son y el más urgente. Cada aviso sigue entrando a la campana con su propio texto. Funciones puras.

// Más de este tiempo sin abrir la app: se resume.
export const UMBRAL_RESUMEN_MS = 30 * 60 * 1000;

// De lo que más exige actuar a lo informativo. Un tipo que no está aquí va al final.
const URGENCIA = ['prioridad', 'devuelto', 'cancelada', 'desasignada', 'nuevaAsignacion', 'nuevaVenta', 'prefinalizado', 'aprobado', 'pagoCliente'];
// Qué sonido corresponde al aviso más urgente (los mismos que tiene cada tipo hoy).
const SONIDO = { prioridad: 'prioridad', devuelto: 'devuelta', cancelada: 'devuelta', desasignada: 'devuelta', aprobado: 'aprobado', prefinalizado: 'prefinalizado', nuevaVenta: 'nuevaAsignacion', nuevaAsignacion: 'nuevaAsignacion', pagoCliente: 'aprobado' };

const rango = (tipo) => { const i = URGENCIA.indexOf(tipo); return i === -1 ? URGENCIA.length : i; };

// `t`: la hora en que el teléfono vio las órdenes por última vez (0 o ausente: nunca; no hay nada que resumir).
export const debeResumir = (t, ahora = Date.now(), umbral = UMBRAL_RESUMEN_MS) => Number(t) > 0 && ahora - Number(t) > umbral;

// `avisos`: lo que se iba a mostrar en pantalla ({ type, text, duration }). Devuelve { toast, sonido } o null si no hubo nada. Con un solo aviso se muestra tal cual.
export function construirResumen(avisos) {
  const lista = (avisos || []).filter((a) => a && a.text);
  if (lista.length === 0) return null;
  const masUrgente = [...lista].sort((a, b) => rango(a.type) - rango(b.type))[0];
  const sonido = SONIDO[masUrgente.type] || 'nuevaAsignacion';
  if (lista.length === 1) return { toast: masUrgente, sonido };
  const resto = lista.length - 1;
  return {
    toast: { type: masUrgente.type, duration: 10000, text: `Mientras no estabas llegaron ${lista.length} avisos. ${masUrgente.text} ${resto === 1 ? 'Hay otro más' : `Hay ${resto} más`} en la campana.` },
    sonido,
  };
}

// Cuánto se espera a la lectura del servidor antes de resumir lo que haya (si no hay cambios en el servidor no llega una segunda lectura).
export const ESPERA_RESUMEN_MS = 8000;

// El que junta los avisos mientras dura el resumen. Se arma una vez por sesión de lectura de órdenes; todo lo de afuera entra por parámetros:
//   mostrar(toast): el aviso en pantalla; silenciar(bool): apaga y enciende los sonidos; sonar(clave): el sonido del resumen ('prioridad', 'devuelta', 'aprobado', 'prefinalizado' o 'nuevaAsignacion');
//   programar(fn, ms) / cancelar(id): el temporizador (se inyectan para probarlo sin esperar).
// iniciar(): empieza a juntar. agregar(toast): true si lo juntó (el aviso no se muestra solo; los errores nunca se juntan). terminar(): muestra el resumen y vuelve a lo normal; se puede llamar de más.
export function crearResumenAlVolver({ mostrar, silenciar, sonar, programar = setTimeout, cancelar = clearTimeout, espera = ESPERA_RESUMEN_MS }) {
  let activo = false;
  let avisos = [];
  let temporizador = null;
  const terminar = () => {
    if (!activo) return;
    cancelar(temporizador);
    activo = false;
    silenciar(false);
    const r = construirResumen(avisos);
    avisos = [];
    if (!r) return;
    mostrar(r.toast);
    sonar(r.sonido);
  };
  return {
    iniciar() {
      if (activo) return;
      activo = true;
      silenciar(true);
      temporizador = programar(terminar, espera);
    },
    agregar(toast) {
      if (!activo || toast?.type === 'error') return false;
      avisos.push(toast);
      return true;
    },
    terminar,
    get activo() { return activo; },
  };
}
