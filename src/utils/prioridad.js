// Prioridad alta de una orden. ADMIN y USUARIO la marcan con el botón junto al código (campo
// `prioridadAlta`); el técnico la ve primero, con una etiqueta roja, y recibe un aviso. Solo cuenta
// mientras la orden está pendiente: una vez pre-finalizada o cerrada ya no hay nada que priorizar
// (el campo se conserva, y si la devuelven al técnico vuelve a ser prioritaria).

export const esPrioritaria = (t) => Boolean(t?.prioridadAlta) && t.estado === 'PENDIENTE';

// Se puede marcar o quitar mientras la orden está pendiente.
export const puedeCambiarPrioridad = (t) => t?.estado === 'PENDIENTE';

// Las prioritarias primero; entre ellas y entre las demás se conserva el orden que traían.
export const prioritariasPrimero = (lista) => [...lista.filter(esPrioritaria), ...lista.filter((t) => !esPrioritaria(t))];

// Texto del aviso al técnico ("La orden AS184 — Ana Pérez es PRIORIDAD ALTA...").
export const textoAvisoPrioridad = (t) =>
  `La orden ${t.codigo || 'S/C'}${t.nombre ? ` — ${t.nombre}` : ''} es PRIORIDAD ALTA. Atiéndela primero.`;

// --- Detectar la prioridad que llegó mientras se miraba (o con la app cerrada) ---
// id -> 1 si la orden tenía prioridad marcada, '' si no: el punto de partida para notar el cambio.
export const mapaPrioridad = (tickets) => new Map(tickets.map((t) => [t.id, t.prioridadAlta ? 1 : '']));

// Órdenes pendientes a las que se les acaba de marcar la prioridad: ya estaban en la lista (una orden
// nueva se avisa como asignación) y no la tenían marcada. Sin punto de partida (`previa` nula) no
// se puede saber qué cambió y no se avisa nada.
export const prioridadNueva = (tickets, previa) =>
  previa ? tickets.filter((t) => esPrioritaria(t) && previa.has(t.id) && !previa.get(t.id)) : [];
