import { Loader2 } from 'lucide-react';

// El indicador de carga de toda la app: la misma rueda en el rojo de marca y el mismo texto, con `role="status"` para que el lector de pantalla lo anuncie.
//   variante="bloque" (por defecto): en el sitio de una lista o sección que todavía no llegó; centrado, con la rueda arriba y el texto debajo.
//   variante="linea": una rueda y el texto en una línea, para un dato suelto (un campo, una nota).
//   variante="pantalla": la pantalla entera vacía mientras arranca la app, o sobre una ventana que se está bajando (con `velo`).
// Para el texto de un botón que está procesando se usa `Spinner` (ver Spinner.jsx); para el ícono de "actualizar" que gira, el propio ícono.
// `texto`: lo que se está cargando ("Cargando cobros..."). Con prefers-reduced-motion la rueda no gira: parpadea suave.
const RUEDA = 'text-primary animate-spin motion-reduce:animate-pulse';

export default function Cargando({ texto = 'Cargando...', variante = 'bloque', velo = false, className = '' }) {
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
