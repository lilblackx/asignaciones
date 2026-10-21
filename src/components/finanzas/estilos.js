// Los estilos de Finanzas y de Revisión de órdenes: los mismos del resto de la app (tarjetas blancas con borde y sombra sobre el fondo gris, letra de 14 px, controles de 36 px con
// borde fino, títulos en mayúsculas pequeñas). Quien necesite la letra más grande usa el selector "Tamaño de letra" de Finanzas, que agranda todo junto (todo está en rem).
export const TARJETA = 'bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm';
export const ETIQUETA = 'text-[11px] font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400';
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

export const CHIP = 'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold';
export const ESTADO = {
  POR_PAGAR: { texto: 'Por pagar', clase: 'bg-amber-400 text-black' },
  PAGADO: { texto: 'Al día', clase: 'bg-emerald-700 text-white' },
  ANULADO: { texto: 'Anulado', clase: 'bg-red-600 text-white' },
  CON_ADELANTO: { texto: 'Con adelanto', clase: 'bg-sky-600 text-white' },
};
export const CAMPO_FECHA = 'w-full h-9 flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-700 hover:border-zinc-500 rounded-lg px-3 text-sm font-bold text-zinc-900 dark:text-white focus:border-red-600 outline-none transition-colors';
