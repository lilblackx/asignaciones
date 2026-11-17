import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';

// Los cuatro niveles de los avisos y de las confirmaciones: colores (claro y oscuro, ya medidos a 4.5:1 en texto y 3:1 en ícono), ícono y rol accesible.
export const NIVELES = {
  info: {
    caja: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/50 text-sky-900 dark:text-sky-200',
    icono: 'text-sky-700 dark:text-sky-400',
    tile: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
    boton: 'bg-sky-700 hover:bg-sky-600 text-white shadow-boton-azul',
    Icono: Info,
    rol: 'status',
  },
  atencion: {
    caja: 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200',
    icono: 'text-amber-700 dark:text-amber-400',
    tile: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    boton: 'bg-amber-500 hover:bg-amber-400 text-black shadow-boton-ambar',
    Icono: AlertTriangle,
    rol: 'status',
  },
  error: {
    caja: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200',
    icono: 'text-red-700 dark:text-red-400',
    tile: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    boton: 'bg-red-700 hover:bg-red-600 text-white shadow-boton',
    Icono: OctagonAlert,
    rol: 'alert',
  },
  exito: {
    caja: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200',
    icono: 'text-emerald-700 dark:text-emerald-400',
    tile: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    boton: 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-boton-verde',
    Icono: CheckCircle2,
    rol: 'status',
  },
};
