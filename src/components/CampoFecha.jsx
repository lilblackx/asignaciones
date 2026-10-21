import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import Calendario from './Calendario';
import Colapsable from './Colapsable';
import { fechaCorta } from '../utils/calendario';

// El campo de fecha de la app: muestra la fecha como dd/mm/aaaa y, al tocarlo, abre el calendario propio de la app (el del navegador se ve distinto en cada equipo).
// `valor`/`onChange(iso)`: la fecha como "AAAA-MM-DD" ('' si no hay). `min`/`max`: límites. `onChange('')` solo se llama si `permitirBorrar` (fecha opcional).
// `flotante`: el calendario sale sobre lo que hay debajo (para barras de filtros; `derecha` lo alinea al borde derecho del campo); si no, se despliega debajo del campo, dentro del formulario.
// `clase`: el estilo del botón (debe dejar sitio a la derecha para el ícono); `grande`: calendario de letra grande.
const CLASE = 'w-full h-10 flex items-center justify-between gap-2 bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg px-3 text-sm text-zinc-900 dark:text-white focus:border-red-600 outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

export default function CampoFecha({ id, valor, onChange, min, max, ariaLabel, vacio = 'Elige la fecha', permitirBorrar = false, flotante = false, derecha = false, grande = false, disabled = false, clase = CLASE, ancho = '' }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  // Un calendario flotante se cierra al pulsar fuera de él o con Escape.
  useEffect(() => {
    if (!abierto || !flotante) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto, flotante]);

  const calendario = (
    <Calendario
      valor={valor}
      min={min}
      max={max}
      grande={grande}
      onElegir={(iso) => { onChange(iso); setAbierto(false); }}
      onBorrar={permitirBorrar && valor ? () => { onChange(''); setAbierto(false); } : undefined}
      onCerrar={() => setAbierto(false)}
    />
  );

  return (
    <div ref={caja} className={`relative ${ancho}`}>
      <button id={id} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={abierto} aria-label={`${ariaLabel || 'Fecha'}: ${valor ? fechaCorta(valor) : 'sin fecha'}`} onClick={() => setAbierto((a) => !a)} className={clase}>
        <span className={valor ? '' : 'text-zinc-500 dark:text-zinc-400'}>{valor ? fechaCorta(valor) : vacio}</span>
        <CalendarDays className={grande ? 'w-6 h-6 shrink-0' : 'w-4 h-4 shrink-0'} aria-hidden="true" />
      </button>
      {flotante
        ? abierto && <div className={`absolute ${derecha ? 'right-0' : 'left-0'} top-full mt-1 z-[300] ${grande ? 'w-80' : 'w-72'} lg:animate-menu-entrada`}>{calendario}</div>
        : <Colapsable>{abierto && <div className="mt-2">{calendario}</div>}</Colapsable>}
    </div>
  );
}
