import { esOltJM } from '../utils/olt';

// Marca "JM" de una orden cuyo cliente depende de la OLT de JMTV (campo `olt`). Solo la ven Finanzas y la Revisión de órdenes; es informativa,
// no cambia el pago. Mismo tamaño que la marca "Venta", en violeta para no confundirlas, y sin más texto.
export default function InsigniaJM({ orden, className = '' }) {
  if (!esOltJM(orden?.olt)) return null;
  return (
    <span className={`inline-flex items-center align-middle text-[11px] max-lg:text-xs font-black px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 ${className}`}>JM</span>
  );
}
