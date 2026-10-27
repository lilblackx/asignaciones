import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import Colapsable from './Colapsable';

const hayRed = () => typeof navigator === 'undefined' || navigator.onLine !== false;

// Franja bajo el encabezado mientras el dispositivo no tiene internet. Los datos y los cambios quedan en el teléfono
// (caché de Firestore) y se sincronizan al volver la red; lo que pasa por el servidor propio, no.
export default function AvisoSinConexion() {
  const [enLinea, setEnLinea] = useState(hayRed);

  useEffect(() => {
    const actualizar = () => setEnLinea(hayRed());
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);

  return (
    <Colapsable>
      {!enLinea && (
        <div role="status" className="bg-red-700 text-white">
          <div className="max-w-[1400px] mx-auto w-full px-4 py-2 flex items-center gap-2.5 text-xs max-lg:text-sm font-bold leading-snug">
            <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
            <p>Sin conexión. Ves los últimos datos guardados y tus cambios se envían cuando vuelva internet.</p>
          </div>
        </div>
      )}
    </Colapsable>
  );
}
