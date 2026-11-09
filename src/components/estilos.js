// Los estilos comunes de toda la app: los de Finanzas y de Revisión de órdenes, que son los mismos del resto (tarjetas blancas con borde y sombra sobre el fondo gris, letra de 14 px, controles de 36 px con
// borde fino, títulos en mayúsculas pequeñas). Quien necesite la letra más grande usa el selector "Tamaño de letra" de Finanzas, que agranda todo junto (todo está en rem).
export const TARJETA = 'bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-sm';
export const ETIQUETA = 'text-[11px] max-lg:text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400';
export const TEXTO_SUAVE = 'text-xs text-zinc-600 dark:text-zinc-400';
export const TITULO_SECCION = 'text-sm font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200';


// --- Campos: cajas de texto, áreas de texto, selectores y calendarios. SALEN TODOS DE AQUÍ (scripts/test-campos-radio.mjs falla si un campo trae sus clases a mano).
// Un solo radio (rounded-xl), borde, fondo y foco rojo. Dos alturas fijas: 'compacto' y 'normal' de 36 px (la letra del compacto es más chica) y 'grande' de 44 px, cómoda para el dedo (formularios y
// pantallas del técnico). `estado`: 'normal', 'error' (borde rojo), 'ok' (borde verde) o 'lectura' (gris, no editable). Las medidas de un campo concreto (ancho, alineación, tipo de letra) se le suman en su sitio; el aspecto, no.
const CAMPO_BASE = 'w-full border rounded-xl placeholder:text-zinc-500 focus:ring-0 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const FONDO_CAMPO = 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white';
const BORDE_CAMPO = {
  normal: `${FONDO_CAMPO} border-zinc-400 dark:border-zinc-700 hover:border-zinc-500 focus:border-red-600`,
  error: `${FONDO_CAMPO} border-red-500 focus:border-red-500`,
  ok: `${FONDO_CAMPO} border-emerald-500 focus:border-emerald-500`,
  lectura: 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-default', // dato que se ve pero no se edita (la fecha de la orden)
};
const MEDIDA_CAMPO = { compacto: 'h-9 px-3 text-xs', normal: 'h-9 px-3 text-sm', grande: 'h-11 px-3 text-sm' };
export const claseCampo = (tamano = 'normal', estado = 'normal') => `${CAMPO_BASE} ${MEDIDA_CAMPO[tamano]} ${BORDE_CAMPO[estado]}`;
// Selector (el botón de SelectMenu): letra en negrita y sitio a la derecha para la flecha.
export const claseSelector = (tamano = 'normal', estado = 'normal') => `${CAMPO_BASE} ${MEDIDA_CAMPO[tamano].replace('px-3', 'pl-3 pr-9')} font-bold ${BORDE_CAMPO[estado]}`;
// Área de texto: sin altura fija (crece con `rows`).
export const claseArea = (tamano = 'normal', estado = 'normal') => `${CAMPO_BASE} px-3 ${tamano === 'compacto' ? 'py-1.5 text-xs' : 'py-2.5 text-sm'} ${BORDE_CAMPO[estado]}`;
// Botón que abre un calendario (CampoFecha).
export const claseFecha = (tamano = 'normal', estado = 'normal') => `${CAMPO_BASE} flex items-center justify-between gap-2 ${MEDIDA_CAMPO[tamano]} ${tamano === 'compacto' ? '' : 'font-bold'} ${BORDE_CAMPO[estado]}`;

export const CAMPO = claseCampo('normal');
export const CAMPO_FORMULARIO = claseCampo('grande');
export const CAMPO_ORDEN = claseCampo('compacto');
export const AREA_TEXTO = claseArea('normal');
export const SELECTOR = claseSelector('normal');
export const SELECTOR_ORDEN = claseSelector('compacto');
export const SELECTOR_ORDEN_NORMAL = SELECTOR_ORDEN.replace(' font-bold', '');
export const SELECTOR_TECNICO_ORDEN = `${SELECTOR_ORDEN_NORMAL} uppercase`;
export const SELECTOR_TIPO_DOC_ORDEN = `${SELECTOR_ORDEN_NORMAL.replace('w-full', 'w-14 shrink-0').replace('pl-3 pr-9', 'pl-1 pr-5')} text-center`;
export const CAMPO_FECHA = claseFecha('normal');
export const CAMPO_FECHA_ORDEN = claseFecha('compacto');
// La pantalla de acceso: el campo más grande de la app (48 px, borde grueso, letra de 16 px).
export const CAMPO_LOGIN = 'w-full h-12 px-3 bg-white dark:bg-zinc-950 border-2 border-zinc-500 text-zinc-900 dark:text-white text-base rounded-xl focus:border-red-600 focus-visible:ring-4 focus-visible:ring-red-600/30 outline-none';

export const BOTON = 'inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl border border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50';
export const BOTON_PRINCIPAL = 'inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold text-white transition-colors disabled:opacity-50';
// Los botones de acción de un técnico (Pagar, Adelanto): un poco más grandes que el resto.
export const BOTON_GRANDE = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-bold transition-colors disabled:opacity-50';
// El botón con borde (Cancelar, Volver) al lado de uno grande: la misma altura que BOTON_GRANDE.
export const BOTON_CON_BORDE_GRANDE = BOTON.replace('h-9 px-3', 'h-10 px-4');
// Un botón pequeño dentro de una fila (Anular, Aprobar, Retener...).
export const BOTON_FILA = 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-xl border border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50';

export const CHIP = 'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] max-lg:text-xs font-bold';
export const ESTADO = {
  POR_PAGAR: { texto: 'Por pagar', clase: 'bg-amber-400 text-black' },
  PAGADO: { texto: 'Al día', clase: 'bg-emerald-700 text-white' },
  ANULADO: { texto: 'Anulado', clase: 'bg-red-600 text-white' },
  CON_ADELANTO: { texto: 'Por descontar', clase: 'bg-sky-700 text-white' },
  PROGRAMADO: { texto: 'Con descuentos programados', clase: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' }, // los mismos colores que la marca "JM" (InsigniaJM)
};

// --- Barra de búsqueda y sus botones (Filtros, Exportar): una familia más grande (44 px, borde grueso, esquinas redondeadas) que va siempre junta.
// El resto de los controles usan la medida normal de arriba (36 px, borde fino).
export const BUSCADOR = 'w-full bg-white dark:bg-zinc-900 border-2 border-zinc-400 dark:border-zinc-700 pl-9 pr-10 h-11 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:ring-0 focus:border-red-600 outline-none transition-colors';
export const BOTON_BARRA = 'shrink-0 inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border-2 text-sm font-bold transition-colors bg-white dark:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed';
export const BOTON_BARRA_NORMAL = 'border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-zinc-500';
export const BOTON_BARRA_ACTIVO = 'border-red-600 text-red-600 dark:text-red-400';


// --- Botones: variante (el color) y tamaño (la medida) se combinan; ver Boton.jsx.
const BASE_BOTON = 'inline-flex items-center justify-center font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const VARIANTES_BOTON = {
  principal: 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-100 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 disabled:hover:bg-zinc-300 dark:disabled:hover:bg-zinc-800',
  secundario: 'border border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800',
  peligro: 'border border-red-600 bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
  discreto: 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800',
};
const TAMANOS_BOTON = {
  compacto: 'gap-1.5 h-8 px-2.5 rounded-xl text-xs',
  normal: 'gap-2 h-9 px-3 rounded-xl text-sm',
  grande: 'gap-2 h-10 px-4 rounded-xl text-sm',
};
export const claseBoton = (variante = 'secundario', tamano = 'normal') => `${BASE_BOTON} ${VARIANTES_BOTON[variante]} ${TAMANOS_BOTON[tamano]}`;

// --- Chips de filtro (los botones que se marcan en rojo al elegirlos): periodo, estado, rol... Ver Chip.jsx.
const BASE_CHIP = 'inline-flex items-center justify-center gap-1 h-9 rounded-xl border font-bold whitespace-nowrap transition-colors';
const TAMANOS_CHIP = { normal: 'px-3 text-sm', compacto: 'px-3 text-xs', angosto: 'px-1 sm:px-4 text-xs sm:text-sm' };
export const claseChip = (activo, tamano = 'normal') => `${BASE_CHIP} ${TAMANOS_CHIP[tamano]} ${activo ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-900 border-zinc-400 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500'}`;

// --- Etiqueta de los formularios de órdenes (Crear orden, Editar orden, Nueva venta).
export const ETIQUETA_ORDEN = 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 ml-1';
