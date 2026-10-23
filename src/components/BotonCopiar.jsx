import { Check, Copy } from 'lucide-react';

// Botón de copiar de toda la app: el ícono de copiar pasa a un visto (verde) cuando `copiado` es verdadero.
// `className` es lo que no cambia (tamaño y forma); `tono`, los colores de reposo y `tonoCopiado`, los del visto.
// Con `children` lleva texto junto al ícono ("Copiar todo"). Úsalo con useCopiado (hooks/useCopiado).
export default function BotonCopiar({ copiado, onClick, etiqueta, titulo, className = '', tono = '', tonoCopiado = 'bg-emerald-700 text-white', iconoClase = 'w-4 h-4', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={titulo}
      className={`transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className} ${copiado ? tonoCopiado : tono}`}
    >
      {copiado ? <Check className={iconoClase} aria-hidden="true" /> : <Copy className={iconoClase} aria-hidden="true" />}
      {children}
    </button>
  );
}

// El de un dato suelto (a la derecha de cada fila): solo el ícono, con el mismo aspecto en todas las pantallas.
export function BotonCopiarDato({ copiado, onClick, etiqueta, titulo }) {
  return (
    <BotonCopiar
      copiado={copiado}
      onClick={onClick}
      etiqueta={etiqueta}
      titulo={titulo}
      className="shrink-0 p-2 rounded-lg"
      tono="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700"
    />
  );
}
