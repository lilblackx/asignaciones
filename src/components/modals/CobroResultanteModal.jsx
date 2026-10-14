import { useEffect, useState } from 'react';
import { Check, CheckCheck, ChevronDown, Clock, Copy, Landmark, MapPin, Plug, Tag, User, Wrench } from 'lucide-react';
import Modal from '../Modal';
import FormasPagoLista from './FormasPagoLista';
import { formatCedula } from '../../utils/ticketDisplay';
import { conceptoCobro, estaExonerado } from '../../utils/cobro';
import { normalizarFormasPago, textoCobroParaCliente } from '../../utils/formasPago';

function Dato({ icon: Icon, etiqueta, valor }) {
  if (!valor) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-wide text-zinc-500 dark:text-zinc-400">{etiqueta}</p>
        <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">{valor}</p>
      </div>
    </div>
  );
}

// Aviso a pantalla completa para el técnico con el cobro al cliente de una orden suya con cobro
// (visita de conector o instalación): no puede pasar desapercibido. Sale al finalizarse la orden o, con conector interno,
// apenas se pre-finaliza. Se queda hasta que el técnico lo confirma; si hay varias, las muestra
// una tras otra. Con cobro, debajo del monto van las formas de pago (cada dato se copia con un toque), un botón
// para copiar el monto y otro para copiar el mensaje completo para el cliente (monto + formas de pago).
// `onCopy(texto, mensaje)` hace la copia (devuelve si pudo) y avisa con el toast.
export default function CobroResultanteModal({ ticket, restantes = 0, formasPago, onCopy, onClose }) {
  // Qué se acaba de copiar ('monto' o 'mensaje'): el botón muestra un visto un instante.
  const [copiado, setCopiado] = useState(null);
  // Las formas de pago vienen plegadas: el técnico las despliega cuando las necesita.
  const [pagosAbierto, setPagosAbierto] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(null), 1500);
    return () => clearTimeout(t);
  }, [copiado]);

  if (!ticket) return null;
  const formas = normalizarFormasPago(formasPago);
  const copiar = async (id, texto, mensaje) => {
    const ok = await onCopy(texto, mensaje);
    if (ok) setCopiado(id);
  };
  const visita = conceptoCobro(ticket);
  const preFinalizada = ticket.estado === 'PRE-FINALIZADO';
  const exonerado = estaExonerado(ticket);
  const IconoEstado = preFinalizada ? Clock : CheckCheck;
  return (
    // Escape no lo cierra: el técnico debe confirmar con el botón.
    <Modal onClose={() => {}} zIndexClass="z-[110]">
      <div
        role="alertdialog"
        aria-labelledby="cobro-titulo"
        className="w-full max-w-2xl h-[calc(100dvh-2rem)] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border-2 border-emerald-500 flex flex-col"
      >
        <div className="bg-emerald-600 text-white px-5 py-4 flex items-center gap-3">
          <IconoEstado className="w-7 h-7 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="cobro-titulo" className="text-lg sm:text-xl font-black leading-tight">{preFinalizada ? 'Orden pre-finalizada' : 'Orden finalizada'}</h2>
            <p className="text-xs font-bold opacity-90 truncate">{ticket.codigo || 'S/C'}{ticket.nombre ? ` — ${ticket.nombre}` : ''}</p>
          </div>
        </div>

        <div className="px-5 py-6 text-center bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/50">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-800 dark:text-emerald-300">{exonerado ? 'VISITA EXONERADA' : 'COBRO RESULTANTE AL CLIENTE'}</p>
          {exonerado ? (
            <>
              <p className="mt-1 text-5xl sm:text-6xl font-black text-emerald-700 dark:text-emerald-400 leading-none">NO COBRAR</p>
              <p className="mt-3 text-xs font-bold text-emerald-900 dark:text-emerald-200">Esta visita se exoneró: no le cobres nada al cliente.</p>
            </>
          ) : (
            <p className="mt-1 text-5xl sm:text-6xl font-black text-emerald-700 dark:text-emerald-400 leading-none break-words">
              {ticket.cobroBs} <span className="text-3xl sm:text-4xl">Bs</span>
            </p>
          )}
          {preFinalizada && <p className="mt-3 text-xs font-bold text-emerald-900 dark:text-emerald-200">Informa este monto al cliente ahora. La orden queda pendiente de aprobación.</p>}
          {visita && <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-900/50 rounded-full px-3 py-1"><Plug className="w-3.5 h-3.5" aria-hidden="true" /> {visita}</p>}
          {!exonerado && onCopy && ticket.cobroBs && (
            <button
              type="button"
              onClick={() => copiar('monto', `${ticket.cobroBs} Bs`, 'Monto copiado.')}
              className={`mt-3 ml-2 inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1 border transition-colors ${copiado === 'monto' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'}`}
            >
              {copiado === 'monto' ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />} Copiar monto
            </button>
          )}
        </div>

        {!exonerado && onCopy && (
          <section aria-label="Formas de pago" className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
            <button
              type="button"
              onClick={() => setPagosAbierto((a) => !a)}
              aria-expanded={pagosAbierto}
              className="w-full flex items-center justify-between gap-2 text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            >
              <span className="flex items-center gap-1.5"><Landmark className="w-4 h-4" aria-hidden="true" /> Formas de pago</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${pagosAbierto ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {pagosAbierto && (
              formas.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Aún no se han cargado las formas de pago. Avisa al administrador.</p>
              ) : (
                <div className="space-y-3">
                  {ticket.cobroBs && (
                    <button
                      type="button"
                      onClick={() => copiar('mensaje', textoCobroParaCliente(ticket.cobroBs, formas), 'Monto y formas de pago copiados.')}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-md text-white ${copiado === 'mensaje' ? 'bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}
                    >
                      {copiado === 'mensaje' ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />} Copiar monto y formas de pago
                    </button>
                  )}
                  <FormasPagoLista formas={formas} onCopy={onCopy} />
                </div>
              )
            )}
          </section>
        )}

        <div className="px-5 py-4 space-y-3">
          <Dato icon={User} etiqueta="CLIENTE" valor={ticket.nombre} />
          <Dato icon={Tag} etiqueta="CÉDULA" valor={ticket.cedula ? formatCedula(ticket.cedula, ticket.tipoDocumento) : ''} />
          <Dato icon={Wrench} etiqueta="TRABAJO" valor={[ticket.tipoTrabajo, ticket.falla].filter(Boolean).join(' — ')} />
          <Dato icon={MapPin} etiqueta="DIRECCIÓN" valor={ticket.direccion} />
          <Dato icon={Tag} etiqueta="NAP / CAJA / PUERTO" valor={ticket.nap} />
        </div>

        <div className="sticky bottom-0 px-5 py-3 mt-auto bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 text-sm sm:text-base font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-colors"
          >
            {restantes > 0 ? `Entendido (${restantes} más por ver)` : 'Entendido'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
