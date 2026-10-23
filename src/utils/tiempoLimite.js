// Firestore, sin conexión (o con el servidor sin responder), deja guardar "en el aire": la pantalla ya muestra el cambio pero la promesa de la escritura no termina hasta que el servidor la
// confirme, y el botón se queda esperando para siempre. Esto la corta pasado un tiempo: devuelve true si la escritura terminó a tiempo o false si no hubo respuesta (el cambio queda en cola y se
// aplica cuando vuelva la conexión).
export const ESPERA_MAXIMA_MS = 15000;

export function esperarConLimite(promesa, ms = ESPERA_MAXIMA_MS) {
  let temporizador;
  const limite = new Promise((resolve) => { temporizador = setTimeout(() => resolve(false), ms); });
  return Promise.race([promesa.then(() => true), limite]).finally(() => clearTimeout(temporizador));
}
