import { Loader2 } from 'lucide-react';

// Rueda de "trabajando" para el texto de un botón que está procesando (va antes del texto, en línea).
export default function Spinner({ className = 'w-3.5 h-3.5' }) {
  return <Loader2 className={`inline-block ${className} mr-1.5 align-text-bottom animate-spin`} aria-hidden="true" />;
}
