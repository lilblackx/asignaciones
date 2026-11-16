import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AnularOrdenPagoModal from './AnularOrdenPagoModal';
import { BOTON_FILA, CHIP, ESTADO, TEXTO_SUAVE } from './estilos';
import { CONCEPTOS_PAGO, anulacionesDeOrdenes, dolares, ordenAnuladaEnPago } from '../../utils/finanzas';
import { fechaHoraLegible } from '../../utils/formatoFecha';

const nombreConcepto = (id) => CONCEPTOS_PAGO.find((c) => c.id === id)?.nombre || id;

// Las órdenes de un pago, para anular el pago de una sola (con un motivo que ve el técnico). Se leen al abrir la lista. `leer(pago)` devuelve las órdenes pagadas del pago; `onAnular(pago, orden, motivo)` devuelve
// true si se guardó. Las que ya se anularon quedan a la vista con su motivo, quién y cuándo.
export default function OrdenesDelPago({ pago, leer, onAnular, ocupado }) {
  const [abierto, setAbierto] = useState(false);
  const [ordenes, setOrdenes] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [elegida, setElegida] = useState(null);
  const anuladas = anulacionesDeOrdenes(pago);

  const cargar = async () => {
    try {
      setOrdenes((await leer(pago)).filter((o) => o.pagoId === pago.id).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true })));
      setFallo(false);
    } catch (error) {
      console.error('No se pudieron leer las órdenes del pago:', error);
      setFallo(true);
    }
  };
  const alternar = () => {
    if (!abierto && ordenes === null) cargar();
    setAbierto((v) => !v);
  };
  // Al anular no se vuelve a leer: la lectura usa el pago y las órdenes pagadas tal como estaban al abrir la pantalla (todavía con la orden), así que la orden anulada volvería a salir con su botón.
  const confirmar = async (motivo) => {
    const ok = await onAnular(pago, elegida, motivo);
    if (ok) setOrdenes((previas) => previas && previas.filter((o) => o.id !== elegida.id));
    return ok;
  };

  return (
    <div className="w-full">
      <button type="button" onClick={alternar} aria-expanded={abierto} className={`${BOTON_FILA} mt-1`}>
        <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" /> Órdenes del pago{anuladas.length > 0 ? ` (${anuladas.length} anulada${anuladas.length === 1 ? '' : 's'})` : ''}
      </button>
      {abierto && (
        <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800 rounded-campo border border-border px-3">
          {fallo && <li className="py-2 text-xs font-bold text-red-600 dark:text-red-400">No se pudieron leer las órdenes de este pago. Intenta de nuevo.</li>}
          {ordenes === null && !fallo && <li className={`py-2 ${TEXTO_SUAVE}`}>Leyendo las órdenes...</li>}
          {(ordenes || []).filter((o) => !ordenAnuladaEnPago(pago, o.id)).map((o) => (
            <li key={o.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-sm text-foreground"><span className="font-bold">{o.codigo || 'S/C'}</span> <span className={TEXTO_SUAVE}>{nombreConcepto(o.concepto)}</span></span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-bold tabular-nums text-foreground">{dolares(o.monto)}</span>
                <button type="button" onClick={() => setElegida(o)} disabled={ocupado} className={`${BOTON_FILA} !border-red-600 !text-red-700 dark:!text-red-400`}>Anular pago de esta orden</button>
              </span>
            </li>
          ))}
          {ordenes !== null && ordenes.length === 0 && !fallo && <li className={`py-2 ${TEXTO_SUAVE}`}>Este pago no tiene órdenes sueltas por anular (puede ser solo de bonos o ya están todas anuladas).</li>}
          {anuladas.map((a) => (
            <li key={a.id} className="py-2">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-foreground"><span className="font-bold">{a.codigo || 'S/C'}</span> <span className={`${CHIP} ${ESTADO.ANULADO.clase}`}>Pago anulado</span></span>
                <span className="text-sm font-bold tabular-nums line-through text-muted-foreground">{dolares(a.monto)}</span>
              </span>
              <span className={`block ${TEXTO_SUAVE}`}>Motivo: {a.motivo} · {a.por} · {fechaHoraLegible(a.en)}</span>
            </li>
          ))}
        </ul>
      )}
      {elegida && <AnularOrdenPagoModal orden={elegida} tecnico={pago.tecnico} onConfirmar={confirmar} onClose={() => setElegida(null)} />}
    </div>
  );
}
