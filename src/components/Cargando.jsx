import { Loader2 } from 'lucide-react';

// El indicador de carga de toda la app: la misma rueda en el rojo de marca y el mismo texto, con `role="status"` para que el lector de pantalla lo anuncie.
//   variante="bloque" (por defecto): en el sitio de una lista o sección que todavía no llegó; centrado, con la rueda arriba y el texto debajo.
//   variante="lista": tres tarjetas de esqueleto (barras que laten) donde va a ir una lista de tarjetas; el texto queda solo para el lector de pantalla. Se ve que algo viene y de qué forma, en vez de una rueda en el vacío.
//   variante="linea": una rueda y el texto en una línea, para un dato suelto (un campo, una nota).
//   variante="pantalla": la pantalla entera vacía mientras arranca la app, o sobre una ventana que se está bajando (con `velo`).
// Para el texto de un botón que está procesando se usa `Spinner` (ver Spinner.jsx); para el ícono de "actualizar" que gira, el propio ícono.
// `texto`: lo que se está cargando ("Cargando cobros..."). Con prefers-reduced-motion la rueda no gira: parpadea suave.
const RUEDA = 'text-primary animate-spin motion-reduce:animate-pulse';

// Una tarjeta de esqueleto: título corto, línea larga, línea media y una fila de botones.
const TarjetaEsqueleto = () => (
  <div className="rounded-card bg-card shadow-card p-4 space-y-3" aria-hidden="true">
    <div className="esqueleto h-5 w-2/5" />
    <div className="esqueleto h-4 w-full" />
    <div className="esqueleto h-4 w-3/5" />
    <div className="flex gap-2 pt-1"><div className="esqueleto h-9 flex-1" /><div className="esqueleto h-9 flex-1" /></div>
  </div>
);

export default function Cargando({ texto = 'Cargando...', variante = 'bloque', velo = false, className = '' }) {
  if (variante === 'lista') {
    return (
      <div role="status" className={`space-y-2.5 ${className}`}>
        <span className="sr-only">{texto}</span>
        {[0, 1, 2].map((i) => <TarjetaEsqueleto key={i} />)}
      </div>
    );
  }
  if (variante === 'linea') {
    return (
      <p role="status" className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        <Loader2 className={`w-3.5 h-3.5 shrink-0 ${RUEDA}`} aria-hidden="true" /> {texto}
      </p>
    );
  }
  if (variante === 'pantalla') {
    return (
      <div role="status" className={`${velo ? 'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm' : 'min-h-dvh bg-fondo'} flex flex-col items-center justify-center gap-3 p-4 text-center ${className}`}>
        <Loader2 className={`w-10 h-10 ${RUEDA}`} aria-hidden="true" />
        {texto && <p className={`text-sm font-bold ${velo ? 'text-white' : 'text-card-foreground'}`}>{texto}</p>}
      </div>
    );
  }
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground ${className}`}>
      <Loader2 className={`w-7 h-7 ${RUEDA}`} aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}
