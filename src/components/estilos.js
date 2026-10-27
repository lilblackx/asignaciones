// Los estilos comunes de toda la app: los de Finanzas y de Revisión de órdenes, que son los mismos del resto (tarjetas blancas con borde y sombra sobre el fondo gris, letra de 14 px, controles de 36 px con
// borde fino, títulos en mayúsculas pequeñas). Quien necesite la letra más grande usa el selector "Tamaño de letra" de Finanzas, que agranda todo junto (todo está en rem).
export const TARJETA = 'bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm';
export const ETIQUETA = 'text-[11px] max-lg:text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400';
export const TEXTO_SUAVE = 'text-xs text-zinc-600 dark:text-zinc-400';
export const TITULO_SECCION = 'text-sm font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200';

export const CAMPO = 'w-full h-9 bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 px-3 rounded-lg text-sm text-zinc-900 dark:text-white focus:ring-0 focus:border-red-600 outline-none transition-colors';
export const SELECTOR = 'w-full h-9 bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-500 rounded-lg pl-3 pr-9 text-sm font-bold text-zinc-900 dark:text-white focus:ring-0 focus:border-red-600 outline-none transition-colors';

export const BOTON = 'inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg border border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50';
export const BOTON_PRINCIPAL = 'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-bold text-white transition-colors disabled:opacity-50';
// Los botones de acción de un técnico (Pagar, Adelanto): un poco más grandes que el resto.
export const BOTON_GRANDE = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-bold transition-colors disabled:opacity-50';
// Un botón pequeño dentro de una fila (Anular, Aprobar, Retener...).
export const BOTON_FILA = 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50';

export const CHIP = 'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] max-lg:text-xs font-bold';
export const ESTADO = {
  POR_PAGAR: { texto: 'Por pagar', clase: 'bg-amber-400 text-black' },
  PAGADO: { texto: 'Al día', clase: 'bg-emerald-700 text-white' },
  ANULADO: { texto: 'Anulado', clase: 'bg-red-600 text-white' },
  CON_ADELANTO: { texto: 'Con adelanto', clase: 'bg-sky-600 text-white' },
};
export const CAMPO_FECHA = 'w-full h-9 flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-500 rounded-lg px-3 text-sm font-bold text-zinc-900 dark:text-white focus:border-red-600 outline-none transition-colors';

// --- Barra de búsqueda y sus botones (Filtros, Exportar): una familia más grande (44 px, borde grueso, esquinas redondeadas) que va siempre junta.
// El resto de los controles usan la medida normal de arriba (36 px, borde fino).
export const BUSCADOR = 'w-full bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 pl-9 pr-10 h-11 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-0 focus:border-red-600 outline-none transition-colors';
export const BOTON_BARRA = 'shrink-0 inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border-2 text-sm font-bold transition-colors bg-white dark:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed';
export const BOTON_BARRA_NORMAL = 'border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-zinc-500';
export const BOTON_BARRA_ACTIVO = 'border-red-600 text-red-600 dark:text-red-400';

// --- Formularios (ventanas de crear y editar): campos de 44 px, cómodos para el dedo, con el mismo borde y color que los demás.
export const CAMPO_FORMULARIO = 'w-full h-11 bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 px-3 rounded-lg text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-0 focus:border-red-600 outline-none transition-colors';
export const AREA_TEXTO = 'w-full bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 px-3 py-2.5 rounded-lg text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-0 focus:border-red-600 outline-none transition-colors';

// --- Botones: variante (el color) y tamaño (la medida) se combinan; ver Boton.jsx.
const BASE_BOTON = 'inline-flex items-center justify-center font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const VARIANTES_BOTON = {
  principal: 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-100 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 disabled:hover:bg-zinc-300 dark:disabled:hover:bg-zinc-800',
  secundario: 'border border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800',
  peligro: 'border border-red-600 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
  discreto: 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800',
};
const TAMANOS_BOTON = {
  compacto: 'gap-1.5 h-8 px-2.5 rounded-lg text-xs',
  normal: 'gap-2 h-9 px-3 rounded-lg text-sm',
  grande: 'gap-2 h-10 px-4 rounded-lg text-sm',
};
export const claseBoton = (variante = 'secundario', tamano = 'normal') => `${BASE_BOTON} ${VARIANTES_BOTON[variante]} ${TAMANOS_BOTON[tamano]}`;

// --- Chips de filtro (los botones que se marcan en rojo al elegirlos): periodo, estado, rol... Ver Chip.jsx.
const BASE_CHIP = 'inline-flex items-center justify-center gap-1 h-9 rounded-lg border font-bold whitespace-nowrap transition-colors';
const TAMANOS_CHIP = { normal: 'px-3 text-sm', compacto: 'px-3 text-xs', angosto: 'px-1 sm:px-4 text-xs sm:text-sm' };
export const claseChip = (activo, tamano = 'normal') => `${BASE_CHIP} ${TAMANOS_CHIP[tamano]} ${activo ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-900 border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500'}`;

// --- Formularios de órdenes (Editar orden, Nueva venta): campos compactos, de letra pequeña, con el borde y el color de siempre.
export const ETIQUETA_ORDEN = 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 ml-1';
export const CAMPO_ORDEN = 'w-full bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
export const SELECTOR_ORDEN = 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 pl-3 pr-8 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none font-bold text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
