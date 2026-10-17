// Color de cada estado (claro/oscuro), pensado para distinguirlos de un vistazo sin leer.
export const ESTILO_ESTADO_PROMOTORA = {
  SIN_TECNICO: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
  PROGRAMADA: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  ASIGNADA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  EN_CAMINO: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  EN_SITIO: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  EN_REVISION: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  INSTALADA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  CANCELADA: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

// Variante SÓLIDA de cada estado (como las etiquetas de estado de la tabla de la oficina), para la tarjeta de orden (TarjetaInstalacion) sobre su cabecera negra.
// Es igual en claro y oscuro: la cabecera es negra en los dos temas.
export const ESTILO_ESTADO_PROMOTORA_SOLIDO = {
  SIN_TECNICO: 'bg-zinc-600 text-white',
  PROGRAMADA: 'bg-indigo-600 text-white',
  ASIGNADA: 'bg-blue-600 text-white',
  EN_CAMINO: 'bg-sky-600 text-white',
  EN_SITIO: 'bg-teal-600 text-white',
  EN_REVISION: 'bg-amber-400 text-black',
  INSTALADA: 'bg-emerald-600 text-white',
  CANCELADA: 'bg-red-600 text-white',
};
