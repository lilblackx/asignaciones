import { CheckCheck, Clock, MapPin, Plug, Tag, User, Wrench } from 'lucide-react';
import Modal from '../Modal';
import BotonCopiar from '../BotonCopiar';
import FormularioPagoCliente from '../FormularioPagoCliente';
import { useCopiado } from '../../hooks/useCopiado';
import ValoresClienteTarjeta from './ValoresClienteTarjeta';
import { formatCedula } from '../../utils/ticketDisplay';
import { MONEDA_USD, conceptoCobro, estaExonerado, monedaDe, textoMonto } from '../../utils/cobro';
import { cobroEsperadoDe } from '../../utils/pagoCliente';
import { esInstalacion } from '../../utils/instalacion';
import { normalizarFormasPago } from '../../utils/formasPago';
import { valoresGuardados } from '../../utils/valoresCliente';

function Dato({ icon: Icon, etiqueta, valor }) {
  if (!valor) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] max-lg:text-xs font-bold tracking-wide text-zinc-600 dark:text-zinc-400">{etiqueta}</p>
        <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">{valor}</p>
      </div>
    </div>
  );
}

// Aviso a pantalla completa para el técnico con el cobro al cliente de una orden suya con cobro (visita de conector, por ejemplo): no puede pasar desapercibido. Sale al finalizarse la orden o, con conector
// interno, apenas se pre-finaliza. Con cobro, debajo del monto va un botón para copiarlo. Si la oficina guardó los valores de señal del cliente al aprobar la orden, van en su propia tarjeta.
// `onCopy(texto, mensaje)` hace la copia (devuelve si pudo) y avisa con el toast.
// Sin `registro` (las exoneradas y las órdenes anteriores al registro del pago) se queda hasta que el técnico lo confirma con "Entendido"; si hay varias, las muestra una tras otra.
// `registro` (órdenes con cobro desde que se pide el pago del cliente): en lugar del botón de confirmar lleva el formulario del pago que hizo el cliente y no se cierra sin registrarlo (o sin decir que el
// cliente paga después); antes de guardar, el técnico confirma lo que va a registrar. { onRegistrar(ticket, valor) -> { ok } | { repetida } | { error }, onPagaDespues(ticket, { nota, compartidoCon }) -> { ok } | { error },
// otrasOrdenes, onPosponer? }. `onPosponer` (solo en una orden finalizada) agrega "Registrar después": la deja en la lista del técnico con su botón "Registrar el pago". Es una pantalla por orden: quien la usa le pone `key` con el id de la orden para que lo escrito no pase a la siguiente.
export default function CobroResultanteModal({ ticket, restantes = 0, formasPago, onCopy, onClose, registro = null }) {
  // Qué se acaba de copiar ('monto'): el botón muestra un visto un instante.
  const { copiado, copiar } = useCopiado(onCopy);
  if (!ticket) return null;
  const formas = normalizarFormasPago(formasPago);
  const visita = conceptoCobro(ticket);
  const preFinalizada = ticket.estado === 'PRE-FINALIZADO';
  const exonerado = estaExonerado(ticket);
  // Una instalación no trae monto: la pantalla solo sirve para registrar el pago (aparece si no se pudo guardar al pre-finalizar).
  const instalacion = esInstalacion(ticket.tipoTrabajo);
  const moneda = monedaDe(ticket);
  const IconoEstado = preFinalizada ? Clock : CheckCheck;
  return (
    // Escape no lo cierra: el técnico debe confirmar con el botón.
    <Modal onClose={() => {}} zIndexClass="z-[110]">
      <div
        role="alertdialog"
        aria-labelledby="cobro-titulo"
        className="w-full max-w-2xl h-[calc(100dvh-2rem)] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border-2 border-emerald-500 flex flex-col"
      >
        <div className="bg-emerald-700 text-white px-5 py-4 flex items-center gap-3">
          <IconoEstado className="w-7 h-7 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="cobro-titulo" className="text-lg sm:text-xl font-black leading-tight">{preFinalizada ? 'Orden pre-finalizada' : 'Orden finalizada'}</h2>
            <p className="text-xs font-bold opacity-90 truncate">{ticket.codigo || 'S/C'}{ticket.nombre ? ` - ${ticket.nombre}` : ''}</p>
          </div>
        </div>

        <div className="px-5 py-6 text-center bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/50">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-800 dark:text-emerald-300">{instalacion ? 'PAGO DE LA INSTALACIÓN' : 'COBRO RESULTANTE AL CLIENTE'}</p>
          {instalacion ? (
            <p className="mt-2 text-lg font-black text-emerald-800 dark:text-emerald-300 leading-tight">Registra el pago que recibiste del cliente.</p>
          ) : exonerado ? (
            <>
              <p className="mt-1 text-5xl sm:text-6xl font-black text-emerald-700 dark:text-emerald-400 leading-none">EXONERADA</p>
              <p className="mt-3 text-xs font-bold text-emerald-900 dark:text-emerald-200">Esta visita se exoneró: no le cobres nada al cliente.</p>
            </>
          ) : (
            <p className="mt-1 text-5xl sm:text-6xl font-black text-emerald-700 dark:text-emerald-400 leading-none break-words">
              {ticket.cobroBs} <span className="text-3xl sm:text-4xl">{moneda === MONEDA_USD ? '$' : 'Bs'}</span>
            </p>
          )}
          {preFinalizada && !instalacion && <p className="mt-3 text-xs font-bold text-emerald-900 dark:text-emerald-200">Informa este monto al cliente ahora. La orden queda pendiente de aprobación.</p>}
          {visita && !instalacion && <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-900/50 rounded-full px-3 py-1"><Plug className="w-3.5 h-3.5" aria-hidden="true" /> {visita}</p>}
          {!exonerado && !instalacion && onCopy && ticket.cobroBs && (
            <BotonCopiar
              copiado={copiado === 'monto'}
              onClick={() => copiar('monto', textoMonto(ticket.cobroBs, moneda), 'Monto copiado.')}
              className="mt-3 ml-2 inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1 border"
              tono="bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
              tonoCopiado="bg-emerald-700 border-emerald-700 text-white"
              iconoClase="w-3.5 h-3.5"
            >
              Copiar monto
            </BotonCopiar>
          )}
        </div>

        {registro && (
          <section aria-label="Registrar el pago del cliente" className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 className="text-sm font-black tracking-wide text-zinc-900 dark:text-white">REGISTRAR EL PAGO DEL CLIENTE</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{instalacion ? 'Anota lo que el cliente pagó por la instalación. Es obligatorio: el cliente paga la instalación de una vez y, sin esto, la oficina no puede aprobar la orden.' : 'Anota lo que el cliente pagó por este cobro. Es obligatorio: si todavía no pagó, di que paga después.'} Antes de guardar te pedimos confirmar los datos.</p>
            <FormularioPagoCliente
              key={ticket.id}
              ticket={ticket}
              cobro={cobroEsperadoDe(ticket)}
              cuentasEmpresa={formas}
              permitirPagarDespues={!instalacion}
              otrasOrdenes={registro.otrasOrdenes}
              onGuardar={(valor) => registro.onRegistrar(ticket, valor)}
              onPagaDespues={(datos) => registro.onPagaDespues(ticket, datos)}
            />
            {restantes > 0 && <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 text-center">{restantes} {restantes === 1 ? 'orden más' : 'órdenes más'} por registrar después de esta.</p>}
            {registro.onPosponer && (
              <div className="pt-1 space-y-1.5">
                <button type="button" onClick={registro.onPosponer} className="w-full h-11 rounded-xl border-2 border-zinc-400 dark:border-zinc-600 text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Registrar después</button>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 text-center">Queda en tu lista como "Falta registrar el pago" con el botón para hacerlo. La oficina no puede aprobar la orden hasta que lo registres.</p>
              </div>
            )}
          </section>
        )}

        {onCopy && valoresGuardados(ticket) && (
          <section aria-label="Valores del cliente" className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <ValoresClienteTarjeta valores={ticket.valoresCliente} onCopy={onCopy} />
          </section>
        )}

        <div className="px-5 py-4 space-y-3">
          <Dato icon={User} etiqueta="CLIENTE" valor={ticket.nombre} />
          <Dato icon={Tag} etiqueta="CÉDULA" valor={ticket.cedula ? formatCedula(ticket.cedula, ticket.tipoDocumento) : ''} />
          <Dato icon={Wrench} etiqueta="TRABAJO" valor={[ticket.tipoTrabajo, ticket.falla].filter(Boolean).join(' - ')} />
          <Dato icon={MapPin} etiqueta="DIRECCIÓN" valor={ticket.direccion} />
          <Dato icon={Tag} etiqueta="NAP / CAJA / PUERTO" valor={ticket.nap} />
        </div>

        {!registro && (
          <div className="sticky bottom-0 px-5 py-3 mt-auto bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 text-sm sm:text-base font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-md transition-colors"
            >
              {restantes > 0 ? `Entendido (${restantes} más por ver)` : 'Entendido'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
