import { AlertTriangle, Check, Loader2, RefreshCw, SearchX } from 'lucide-react';
import { limpiarNombre } from '../../utils/clienteSmartolt';

// Estado de la búsqueda de cliente en SmartOLT (ver useClienteSmartOlt) con dos piezas:
// <ClienteSmartOltIcono> junto al campo de cédula (un icono de estado y el botón de
// volver a buscar) y <ClienteSmartOltMensaje> debajo, que solo escribe algo cuando no
// hay resultado, hay error o hay que elegir entre varias ONU.

const BOTON = 'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded border transition-colors';

// Icono de estado + botón de volver a buscar, para ir al lado del campo de cédula.
export function ClienteSmartOltIcono({ cliente }) {
  if (!cliente.visible) return null;
  const { estado } = cliente;
  const buscando = estado?.tipo === 'buscando';

  let icono = null;
  if (buscando) icono = { Icono: Loader2, clase: 'text-zinc-400 animate-spin', titulo: 'Buscando en SmartOLT...' };
  else if (estado?.tipo === 'listo') icono = estado.llenados > 0
    ? { Icono: Check, clase: 'text-emerald-600 dark:text-emerald-400', titulo: 'Datos tomados de SmartOLT' }
    : { Icono: Check, clase: 'text-zinc-400', titulo: 'Cliente encontrado en SmartOLT (no había campos vacíos que llenar)' };
  else if (estado?.tipo === 'vacio') icono = { Icono: SearchX, clase: 'text-amber-600 dark:text-amber-400', titulo: 'No se encontró un cliente con esta cédula en SmartOLT' };
  else if (estado?.tipo === 'error') icono = { Icono: AlertTriangle, clase: 'text-red-600 dark:text-red-400', titulo: 'SmartOLT no respondió' };
  else if (estado?.tipo === 'opciones') icono = { Icono: AlertTriangle, clase: 'text-amber-600 dark:text-amber-400', titulo: 'Varias ONU con esta cédula: elige una' };

  return (
    <>
      {icono && (
        <span role="status" title={icono.titulo} className={`${BOTON} border-transparent`}>
          <icono.Icono className={`w-4 h-4 ${icono.clase}`} aria-hidden="true" />
          <span className="sr-only">{icono.titulo}</span>
        </span>
      )}
      <button
        type="button"
        onClick={cliente.buscarAhora}
        disabled={buscando}
        title="Buscar cliente en SmartOLT"
        aria-label="Buscar cliente en SmartOLT"
        className={`${BOTON} border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 disabled:opacity-50`}
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </>
  );
}

// Texto bajo el campo: solo cuando hay algo que decir (sin resultado, error o varias ONU).
export function ClienteSmartOltMensaje({ cliente, wrapperClassName }) {
  const { estado } = cliente;
  if (!cliente.visible || !estado || !['vacio', 'error', 'opciones'].includes(estado.tipo)) return null;
  return (
    <div className={wrapperClassName}>
      {estado.tipo === 'vacio' && <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 ml-1">No se encontró un cliente con esta cédula en SmartOLT.</p>}
      {estado.tipo === 'error' && <p role="alert" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">{estado.mensaje} Llena los datos a mano.</p>}
      {estado.tipo === 'opciones' && (
        <div role="group" aria-label="Varias ONU con esta cédula, elige una" className="mt-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-500" aria-hidden="true" />
            Esta cédula tiene {estado.opciones.length} servicios. Elige cuál es:
          </p>
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {estado.opciones.map((onu) => (
              <button
                key={onu.idExterno || onu.nombre}
                type="button"
                onClick={() => cliente.elegir(onu)}
                className="group w-full text-left rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <span className="flex items-center gap-2">
                  {onu.zona && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                      {onu.zona}
                    </span>
                  )}
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                    {limpiarNombre(onu.nombre, estado.digitos) || 'Sin nombre'}
                  </span>
                </span>
                {onu.direccion && (
                  <span className="block mt-0.5 text-[11px] leading-snug font-medium text-zinc-500 dark:text-zinc-400">{onu.direccion}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
