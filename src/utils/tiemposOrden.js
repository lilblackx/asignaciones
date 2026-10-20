// Las horas del ciclo de una orden, guardadas como números sueltos en la orden para el reporte "Esperas del ciclo". `enCamino` se
// borra al pre-finalizar y el historial solo guarda minutos en texto, así que cada hora se copia aquí en el momento en que ocurre:
//   primerAsignadoEn  la primera vez que la orden pasó de no tener técnico a tenerlo (no se vuelve a escribir).
//   asignadoEn        cuándo la recibió el técnico que la tiene ahora; cambia si la pasan a otro técnico.
//   salioEn / llegoEn cuándo el técnico avisó "En camino" y "Llegué" (se copian de `enCamino`).
//   prefinalizadoEn   cuándo el técnico la pre-finalizó (vuelve a null si la oficina la devuelve).
// Una orden que nace con técnico no lleva primerAsignadoEn ni asignadoEn: su espera empieza al crearla (o en su fecha programada).
// Las órdenes anteriores a esta versión no traen estos campos y el reporte las deja fuera de los tramos que no pueden medirse.

// Los campos de horas que cambian al pasar de `original` a `nueva` (vacío si no cambia ninguno, o si la orden es nueva).
// Solo devuelve lo que corresponde al cambio, así un técnico nunca escribe un campo que sus reglas no le permiten (asignadoEn y
// primerAsignadoEn los escribe la oficina al cambiar el técnico).
export function camposTiempos(original, nueva, ahora = Date.now()) {
  if (!original || !nueva) return {};
  const campos = {};
  const antes = String(original.tecnico || '').trim();
  const despues = String(nueva.tecnico || '').trim();

  if (antes !== despues) {
    // Otro técnico: lo que había avanzado el anterior no cuenta para el nuevo.
    campos.asignadoEn = despues ? ahora : null;
    if (despues && !antes && !original.primerAsignadoEn) campos.primerAsignadoEn = ahora;
    campos.salioEn = null;
    campos.llegoEn = null;
  } else if (nueva.enCamino?.desde) {
    campos.salioEn = nueva.enCamino.desde;
    campos.llegoEn = nueva.enCamino.llegoEn ?? null;
  } else if (original.enCamino && nueva.estado === 'PENDIENTE') {
    // El técnico canceló el viaje con la orden aún pendiente. (Si dejó de estar pendiente, `enCamino` se borra pero la hora se queda.)
    campos.salioEn = null;
    campos.llegoEn = null;
  }

  if (original.estado !== nueva.estado) {
    if (nueva.estado === 'PRE-FINALIZADO') campos.prefinalizadoEn = ahora;
    else if (original.estado === 'PRE-FINALIZADO' && nueva.estado === 'PENDIENTE') campos.prefinalizadoEn = null;
  }
  return campos;
}

// La orden con sus horas al día.
export const conTiempos = (original, nueva, ahora) => ({ ...nueva, ...camposTiempos(original, nueva, ahora) });
