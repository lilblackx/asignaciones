// Los estilos de la pantalla de Finanzas, hechos para leerse sin esfuerzo: letra de 16 px como mínimo (la base de la pantalla es mayor y el usuario la puede agrandar), contraste alto
// (el texto secundario es gris claro sobre negro y gris oscuro sobre blanco, nunca gris medio), controles de 48 px de alto y bordes gruesos.
export const ETIQUETA = 'text-sm font-semibold text-zinc-600 dark:text-zinc-300';
export const TEXTO_SUAVE = 'text-sm text-zinc-600 dark:text-zinc-300';
export const TITULO_SECCION = 'text-lg font-bold text-zinc-900 dark:text-white';

export const CAMPO = 'w-full h-10 bg-white dark:bg-zinc-950 border-2 border-zinc-400 dark:border-zinc-600 px-3 rounded-lg text-base text-zinc-900 dark:text-white focus:ring-0 focus:border-red-600 outline-none';
export const SELECTOR = 'w-full h-10 bg-white dark:bg-zinc-950 border-2 border-zinc-400 dark:border-zinc-600 hover:border-zinc-500 rounded-lg pl-3 pr-9 text-base font-bold text-zinc-900 dark:text-white focus:ring-0 focus:border-red-600 outline-none';

export const BOTON = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border-2 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 text-base font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50';
export const BOTON_PRINCIPAL = 'inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-base font-bold text-white transition-colors disabled:opacity-50';
// Los botones de acción de un técnico (Pagar, Adelanto): más grandes que el resto.
export const BOTON_GRANDE = 'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-base font-bold transition-colors disabled:opacity-50';
// Un botón pequeño dentro de una fila (Anular, Interna/Externa): sigue midiendo 44 px para tocarlo bien.
export const BOTON_FILA = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border-2 border-zinc-400 dark:border-zinc-600 bg-white dark:bg-zinc-950 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50';

export const CHIP = 'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold';
export const ESTADO = {
  POR_PAGAR: { texto: 'Por pagar', clase: 'bg-amber-400 text-black' },
  PAGADO: { texto: 'Al día', clase: 'bg-emerald-600 text-white' },
  ANULADO: { texto: 'Anulado', clase: 'bg-red-600 text-white' },
  CON_ADELANTO: { texto: 'Con adelanto', clase: 'bg-sky-600 text-white' },
};
export const CAMPO_FECHA = 'w-full h-10 flex items-center justify-between gap-2 bg-white dark:bg-zinc-950 border-2 border-zinc-400 dark:border-zinc-600 hover:border-zinc-500 rounded-lg px-3 text-base font-bold text-zinc-900 dark:text-white focus:border-red-600 outline-none transition-colors';
