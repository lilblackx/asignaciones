import { CHIP, ESTADO, TEXTO_SUAVE } from './estilos';
import { aBs, bolivares, dolares, textoOrdenes } from '../../utils/finanzas';

// La lista de técnicos de Finanzas: una fila grande por técnico (nombre, estado y lo que se le debe), sin cajas. El elegido queda marcado con una barra roja a la izquierda y
// el fondo más claro. `onElegir(tecnico)`.
const estadoDe = (fila) => (fila.pendientes.length > 0 ? 'POR_PAGAR' : fila.adelantos > 0 ? 'CON_ADELANTO' : 'PAGADO');

export default function ListaTecnicos({ filas, elegido, tasa, onElegir }) {
  return (
    <ul aria-label="Técnicos" className="border-y-2 lg:border-2 border-zinc-300 dark:border-zinc-700 lg:rounded-lg divide-y-2 divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
      {filas.map((fila) => {
        const estado = estadoDe(fila);
        const seleccionado = fila.tecnico === elegido;
        const neto = fila.neto ?? fila.total;
        return (
          <li key={fila.tecnico}>
            <button
              type="button"
              onClick={() => onElegir(fila.tecnico)}
              aria-current={seleccionado ? 'true' : undefined}
              className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-l-8 transition-colors ${seleccionado ? 'border-red-600 bg-zinc-100 dark:bg-zinc-800' : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
            >
              <span className="min-w-0">
                <span className="block text-base font-bold text-zinc-900 dark:text-white break-words">{fila.tecnico}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`${CHIP} ${ESTADO[estado].clase}`}>{ESTADO[estado].texto}</span>
                  <span className={TEXTO_SUAVE}>{fila.pendientes.length > 0 ? textoOrdenes(fila.pendientes.length) : fila.adelantos > 0 ? `Adelanto ${dolares(fila.adelantos)}` : 'Nada por pagar'}</span>
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-lg font-bold tabular-nums text-zinc-900 dark:text-white whitespace-nowrap">{dolares(neto)}</span>
                {tasa > 0 && <span className="block text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{bolivares(aBs(neto, tasa))}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
