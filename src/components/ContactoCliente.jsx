import { MessageCircle, Navigation, Network, Phone } from 'lucide-react';
import { getEnlaceLlamada, getEnlaceWhatsApp } from '../utils/telefono';
import { getEnlaceNavegacion, getEnlaceNavegacionNap } from '../utils/ubicacion';

const base = 'flex-1 min-w-0 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-colors';

// Accesos rápidos al cliente de una orden, para usar dentro de los modales:
// cómo llegar (ubicación), llamar y WhatsApp (teléfono). Llamar y WhatsApp solo
// se muestran en móvil (lg:hidden) —en escritorio `tel:` no llama a nadie—;
// "Llegar" sirve en cualquier pantalla; "NAP" (cómo llegar a la caja) solo en
// móvil, donde está el técnico. No renderiza nada si no hay datos usables.
export default function ContactoCliente({ telefono, ubicacion, napCoordenadas, nombre, className = '' }) {
  const llegar = getEnlaceNavegacion(ubicacion);
  const nap = getEnlaceNavegacionNap(napCoordenadas);
  const llamar = getEnlaceLlamada(telefono);
  const chat = getEnlaceWhatsApp(telefono);
  if (!llegar && !nap && !llamar && !chat) return null;

  return (
    <div className={`flex gap-2 ${llegar ? '' : 'lg:hidden'} ${className}`}>
      {llegar && (
        <a href={llegar} target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar al domicilio" title="Cómo llegar" className={`${base} bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-900/50`}>
          <Navigation className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">Llegar</span>
        </a>
      )}
      {nap && (
        <a href={nap} target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar a la NAP" title="Cómo llegar a la NAP" className={`${base} lg:hidden bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50`}>
          <Network className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">NAP</span>
        </a>
      )}
      {llamar && (
        <a href={llamar} aria-label={`Llamar a ${nombre || 'el cliente'}`} title="Llamar al cliente" className={`${base} lg:hidden bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700`}>
          <Phone className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">Llamar</span>
        </a>
      )}
      {chat && (
        <a href={chat} target="_blank" rel="noopener noreferrer" aria-label={`Escribir por WhatsApp a ${nombre || 'el cliente'}`} title="WhatsApp al cliente" className={`${base} lg:hidden bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50`}>
          <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">Chat</span>
        </a>
      )}
    </div>
  );
}
