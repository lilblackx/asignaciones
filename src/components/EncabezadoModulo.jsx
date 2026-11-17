import { ArrowLeft } from 'lucide-react';
import { BOTON_ENCABEZADO } from './estilos';
import BotonCerrar from './BotonCerrar';

// La barra negra de arriba de los módulos: el título y, a la derecha, las acciones propias del módulo y la X, que cierra el módulo entero.
//   onVolver (opcional): un "Volver" a la izquierda (solo en PC) para subir un nivel dentro del módulo; sin él no hay Volver, porque la X ya cierra. Sin onClose (página) no hay X.
export default function EncabezadoModulo({ Icono, titulo, onClose, onVolver, acciones, className = '', enPagina = false }) {
  // Como página dentro del marco, el título y el menú los pone el encabezado de la app.
  if (enPagina) return null;
  return (
    <div className={`encabezado-d bg-black px-4 sm:px-6 py-3.5 border-b-2 border-red-600 flex items-center gap-3 shrink-0 sticky top-0 z-10 ${className}`}>
      {onVolver && (
        <button onClick={onVolver} className={`${BOTON_ENCABEZADO} hidden lg:inline-flex shrink-0 pl-2.5`}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Volver
        </button>
      )}
      <h2 className="text-lg font-black text-white flex items-center gap-2 min-w-0">
        <Icono className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0" aria-hidden="true" /> <span className="truncate">{titulo}</span>
      </h2>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {acciones}
        {onClose && (
          <BotonCerrar onClick={onClose} grande />
        )}
      </div>
    </div>
  );
}
