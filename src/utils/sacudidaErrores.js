// Al pulsar la acción de una ventana (Guardar, Confirmar, Finalizar...), los campos inválidos dan un sacudón corto, y si la acción falla con
// un aviso rojo sin campo marcado se sacude la ventana. Solo se activa con ese clic: un campo que se marca como inválido mientras se
// escribe no se sacude. El CSS (index.css) sacude `[data-sacudir] ...` y `[data-sacudir-ventana] > *`; aquí solo se ponen y quitan esos atributos.
const DURACION_MS = 450;
// Cuánto después del clic puede llegar el aviso de error de esa acción (puede venir de algo asíncrono).
const ESPERA_AVISO_MS = 5000;
// Botones que no son la acción de la ventana: cerrar, abrir o cerrar secciones, consultar, copiar...
const NO_ES_ACCION = /^\s*(cancelar|cerrar|volver|atrás|quitar|agregar|limpiar|ver|ocultar|mostrar|buscar|copiar|pegar|exportar)\b/i;

let ultimaAccion = null;

function esAccion(boton) {
  if (boton.type === 'submit') return true;
  if (['aria-expanded', 'aria-haspopup', 'aria-pressed', 'role'].some((atributo) => boton.hasAttribute(atributo))) return false;
  const texto = boton.textContent.trim() || boton.getAttribute('aria-label') || '';
  return texto !== '' && !NO_ES_ACCION.test(texto);
}

function marcar(ventana, atributo) {
  ventana.setAttribute(atributo, '');
  setTimeout(() => ventana.removeAttribute(atributo), DURACION_MS);
}

// La llama el aviso rojo (Toast) al aparecer: si viene de la acción que se acaba de pulsar en una ventana, sacude esa ventana.
export function sacudirVentanaDeLaUltimaAccion() {
  if (!ultimaAccion || Date.now() - ultimaAccion.t > ESPERA_AVISO_MS || !ultimaAccion.ventana.isConnected) return;
  marcar(ultimaAccion.ventana, 'data-sacudir-ventana');
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const boton = e.target instanceof Element ? e.target.closest('button') : null;
    if (!boton || boton.disabled) return;
    const ventana = boton.closest('[role="dialog"]');
    if (!ventana || !esAccion(boton)) return;
    ultimaAccion = { ventana, t: Date.now() };
    marcar(ventana, 'data-sacudir');
  }, true);
}
