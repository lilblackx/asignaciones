import { Check, Lock } from 'lucide-react';

// Indicador de pasos para cualquier asistente de la app (varias pantallas seguidas que se recorren con "Siguiente"): una píldora discreta con un círculo por paso, su nombre y una línea fina entre ellos.
// El paso actual va resaltado, los hechos llevan un visto y los que faltan quedan apagados. Es solo el indicador: quien lo usa decide qué pantalla muestra y cuándo se avanza (ver components/AsistentePasos).
//   <Pasos pasos={[{ clave: 'cobro', etiqueta: 'Cobro' }, { clave: 'pago', etiqueta: 'Pago' }]} actual={0} hecho={(clave) => ...} />
// `pasos`: [{ clave, etiqueta }]; `actual`: el índice del paso que se ve; `hecho(clave)`: si ese paso ya está completo (además de los anteriores al actual, que cuentan como hechos); `className`: margen o posición.
// `onElegir(clave)`: si se pasa, cada paso es un botón que lleva a él (para quien necesita saltar entre pasos, como la oficina); sin ella, el indicador solo informa.
// `bloqueo(clave)`: el motivo por el que no se puede llegar a ese paso todavía ('' si se puede); un paso bloqueado se ve apagado, con un candado, y no se puede tocar.
export default function Pasos({ pasos, actual, hecho = () => false, onElegir = null, bloqueo = null, etiqueta = 'Pasos', className = '' }) {
  if (!pasos?.length) return null;
  return (
    <nav aria-label={etiqueta} className={className}>
      <ol className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5">
        {pasos.map(({ clave, etiqueta: nombre }, i) => {
          const completo = i !== actual && (hecho(clave) || i < actual);
          const esActual = i === actual;
          const razon = onElegir && !esActual && bloqueo ? bloqueo(clave) : '';
          // En un celular solo se escribe el nombre del paso actual (los demás quedan con su círculo, su número o visto, y su nombre en el aria-label): así el indicador se ve igual, y cabe, con 2, 3, 4 o 5 pasos.
          const ocultarNombre = !esActual;
          const contenido = (
            <>
              <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-etiqueta font-black transition-colors duration-300 ${razon ? 'opacity-60' : ''} ${completo ? 'bg-emerald-700 text-white' : esActual ? 'bg-emerald-700 text-white' : 'border border-zinc-400 dark:border-zinc-600 text-muted-foreground'}`}>
                {razon ? <Lock className="w-3 h-3" aria-hidden="true" /> : completo ? <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className={`${ocultarNombre ? 'hidden sm:inline ' : ''}text-xs leading-none whitespace-nowrap transition-colors duration-300 ${esActual ? 'font-black text-foreground' : completo ? 'font-bold text-emerald-800 dark:text-emerald-400' : 'font-bold text-muted-foreground'}`}>{nombre}</span>
            </>
          );
          return (
            <li key={clave} aria-current={esActual ? 'step' : undefined} className={`flex items-center gap-1.5 ${i < pasos.length - 1 ? 'flex-1' : ''}`}>
              {razon ? (
                <button type="button" disabled title={razon} aria-label={`Paso ${i + 1}: ${nombre}, bloqueado. ${razon}`} className="flex items-center gap-1.5 rounded-full -mx-1 px-1 py-0.5 cursor-not-allowed">{contenido}</button>
              ) : onElegir && !esActual ? (
                <button type="button" onClick={() => onElegir(clave)} aria-label={`Ir al paso ${i + 1}: ${nombre}`} className="flex items-center gap-1.5 rounded-full -mx-1 px-1 py-0.5 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 transition-colors">{contenido}</button>
              ) : (
                <span className="flex items-center gap-1.5">{contenido}</span>
              )}
              {i < pasos.length - 1 && <span aria-hidden="true" className={`flex-1 min-w-3 h-px transition-colors duration-300 ${completo ? 'bg-emerald-700' : 'bg-zinc-300 dark:bg-zinc-600'}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
