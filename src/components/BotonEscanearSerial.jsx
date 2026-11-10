import { lazy, Suspense, useState } from 'react';
import { ScanLine } from 'lucide-react';

// La ventana del escáner (y con ella la lectura de códigos) se baja solo cuando el técnico toca "Escanear".
const EscanearSerialModal = lazy(() => import('./modals/EscanearSerialModal'));

// Botón "Escanear" junto al campo del serial: abre la cámara con un recuadro guía y entrega el serial leído (`onLeido(serial)`). Solo acepta el PON S/N o el GPON SN (ver utils/lecturaSerial).
export default function BotonEscanearSerial({ onLeido, disabled = false, className = '' }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={disabled}
        aria-label="Escanear el serial con la cámara"
        className={`shrink-0 inline-flex items-center justify-center gap-2 h-11 px-3 rounded-xl border-2 border-red-600 bg-red-600/10 hover:bg-red-600/20 text-red-700 dark:text-white text-sm font-bold transition-colors disabled:opacity-50 ${className}`}
      >
        <ScanLine className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" /> Escanear
      </button>
      {abierto && (
        <Suspense fallback={null}>
          <EscanearSerialModal onLeido={onLeido} onClose={() => setAbierto(false)} />
        </Suspense>
      )}
    </>
  );
}
