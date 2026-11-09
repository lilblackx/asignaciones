import { ensancharRango } from './periodoReporte.js';

// Qué hay que leer de Firestore para que una pantalla que filtra por periodo no relea todo cada vez que se abre o cambia de periodo (cada lectura nueva cobra de nuevo todos los documentos de la ventana).
// `actual`: lo que ya se lee ({ uid, dia, ventana: { desde, hasta } }, o null si nada). `pedido`: { uid, hoy, rango }, lo que la pantalla necesita ahora.
// Devuelve { cambiar, ventana, conservarDatos }:
//   - cambiar: false si lo que ya se lee cubre lo pedido (no se toca nada); true si hay que empezar o ampliar la lectura.
//   - ventana: la que hay que leer: la unión de lo que ya se leía y lo pedido, para que pasar a un periodo más corto o volver a uno ya visto no cambie nada. Si cambió el usuario o el día se empieza de nuevo
//     (así una sesión abierta varios días no va ensanchando la ventana para siempre).
//   - conservarDatos: si lo ya leído (de este mismo usuario) sirve mientras llega la lectura nueva.
export function planDeLectura(actual, { uid, hoy, rango }) {
  const delMismoUsuario = Boolean(actual?.ventana) && actual.uid === uid;
  const vigente = delMismoUsuario && actual.dia === hoy;
  const ventana = ensancharRango(vigente ? actual.ventana : null, rango);
  const igual = vigente && ventana.desde === actual.ventana.desde && ventana.hasta === actual.ventana.hasta;
  return { cambiar: !igual, ventana, conservarDatos: delMismoUsuario };
}
