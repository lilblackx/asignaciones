import { useState } from 'react';
import { Camera, CheckCheck, Clock, MapPin, Plug, Tag, User, Wrench } from 'lucide-react';
import Modal from '../Modal';
import AsistentePasos, { BotonesPasos } from '../AsistentePasos';
import BotonCopiar from '../BotonCopiar';
import FormularioPagoCliente from '../FormularioPagoCliente';
import DetallesOrdenCampo from '../DetallesOrdenCampo';
import { useCopiado } from '../../hooks/useCopiado';
import { usePasosAsistente } from '../../hooks/usePasosAsistente';
import ValoresClienteTarjeta from './ValoresClienteTarjeta';
import { formatCedula } from '../../utils/ticketDisplay';
import { MONEDA_USD, conceptoCobro, estaExonerado, monedaDe, textoMonto } from '../../utils/cobro';
import { cobroEsperadoDe, piensaPagoCliente } from '../../utils/pagoCliente';
import { faltanDetalles } from '../../utils/detallesOrden';
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

// Los pasos de la pantalla con `registro`, uno por vez: 'cobro' (el monto que se le informa al cliente), 'pago' (registrar lo que pagó el cliente, si todavía falta) y 'detalles' (las fotos del trabajo, solo de una
// orden finalizada que aún no las tiene). Lo que ya está hecho no sale como paso.
const ETIQUETA_PASO = { cobro: 'Cobro', pago: 'Pago', detalles: 'Fotos' };
const PASO_DE = (clave) => ({ clave, etiqueta: ETIQUETA_PASO[clave] });
const pendientesDe = (ticket, registro) => ({
  pidePago: Boolean(registro) && !ticket?.pagoCliente && (ticket?.estado === 'PRE-FINALIZADO' || piensaPagoCliente(ticket)),
  pideDetalles: Boolean(registro?.onSubirDetalles) && faltanDetalles(ticket),
});
const pasosDe = ({ pidePago, pideDetalles }) => [...(pidePago ? ['cobro', 'pago'] : []), ...(pideDetalles ? ['detalles'] : [])];

// Aviso a pantalla completa para el técnico con el cobro al cliente de una orden suya con cobro (visita de conector, por ejemplo): no puede pasar desapercibido. Sale al finalizarse la orden o, con conector
// interno, apenas se pre-finaliza. Con cobro, debajo del monto va un botón para copiarlo. Si la oficina guardó los valores de señal del cliente al aprobar la orden, van en su propia tarjeta.
// `onCopy(texto, mensaje)` hace la copia (devuelve si pudo) y avisa con el toast.
// Sin `registro` (las exoneradas y las órdenes anteriores al registro del pago) es una sola pantalla y se queda hasta que el técnico lo confirma con "Entendido"; si hay varias, las muestra una tras otra.
// `registro` (órdenes con cobro desde que se pide el pago del cliente) la convierte en un asistente por pasos (components/AsistentePasos) que el técnico recorre con "Siguiente" (ver pasosDe): el cobro, el pago que hizo el
// cliente (no se sigue sin registrarlo o sin decir que el cliente paga después; antes de guardar, el técnico confirma lo que va a registrar) y, en una orden finalizada, los "Detalles de la orden" (de 2 a 7 fotos, ver utils/detallesOrden).
// { onRegistrar(ticket, valor) -> { ok } | { repetida } | { error }, onPagaDespues(ticket, { nota, compartidoCon }) -> { ok } | { error }, otrasOrdenes, onPosponer?, onSubirDetalles(ticket, fotos, onProgreso) -> { ok } | { error } }.
// `onPosponer` (solo en una orden finalizada) agrega "Hacerlo después" en todos los pasos: deja la orden en la lista del técnico con su botón. La orden no sale de esa lista hasta tener el pago y los detalles.
// Es una pantalla por orden: quien la usa le pone `key` con el id de la orden para que lo escrito no pase a la siguiente.
export default function CobroResultanteModal({ ticket, restantes = 0, formasPago, onCopy, onClose, registro = null }) {
  // Qué se acaba de copiar ('monto'): el botón muestra un visto un instante.
  const { copiado, copiar } = useCopiado(onCopy);
  const { pidePago, pideDetalles } = pendientesDe(ticket, registro);
  // Los pasos se fijan al abrir (el indicador no cambia aunque ya se registre el pago).
  const [pasos] = useState(() => pasosDe({ pidePago, pideDetalles }));
  // Lo hecho se salta: al registrar el pago se pasa solo a las fotos.
  const hecho = (clave) => (clave === 'pago' && !pidePago) || (clave === 'detalles' && !pideDetalles);
  const nav = usePasosAsistente(pasos, hecho);
  if (!ticket) return null;
  const formas = normalizarFormasPago(formasPago);
  const visita = conceptoCobro(ticket);
  const preFinalizada = ticket.estado === 'PRE-FINALIZADO';
  const exonerado = estaExonerado(ticket);
  // Una instalación no trae monto: la pantalla solo sirve para registrar el pago (aparece si no se pudo guardar al pre-finalizar).
  const instalacion = esInstalacion(ticket.tipoTrabajo);
  const moneda = monedaDe(ticket);
  const IconoEstado = preFinalizada ? Clock : CheckCheck;
  const porPasos = Boolean(registro) && pasos.length > 0;
  const clave = nav.clave;

  const encabezado = (
    <div className="bg-emerald-700 text-white px-5 py-4 flex items-center gap-3 shrink-0">
      <IconoEstado className="w-7 h-7 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <h2 id="cobro-titulo" className="text-lg sm:text-xl font-black leading-tight">{preFinalizada ? 'Orden pre-finalizada' : 'Orden finalizada'}</h2>
        <p className="text-xs font-bold opacity-90 truncate">{ticket.codigo || 'S/C'}{ticket.nombre ? ` - ${ticket.nombre}` : ''}</p>
      </div>
    </div>
  );

  const datosDeLaOrden = (
    <div className="px-5 py-4 space-y-3">
      <Dato icon={User} etiqueta="CLIENTE" valor={ticket.nombre} />
      <Dato icon={Tag} etiqueta="CÉDULA" valor={ticket.cedula ? formatCedula(ticket.cedula, ticket.tipoDocumento) : ''} />
      <Dato icon={Wrench} etiqueta="TRABAJO" valor={[ticket.tipoTrabajo, ticket.falla].filter(Boolean).join(' - ')} />
      <Dato icon={MapPin} etiqueta="DIRECCIÓN" valor={ticket.direccion} />
      <Dato icon={Tag} etiqueta="NAP / CAJA / PUERTO" valor={ticket.nap} />
    </div>
  );

  const valoresDelCliente = onCopy && valoresGuardados(ticket) && (
    <section aria-label="Valores del cliente" className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
      <ValoresClienteTarjeta valores={ticket.valoresCliente} onCopy={onCopy} />
    </section>
  );

  // El cuadro verde grande: el monto que se le informa al cliente (o, si solo faltan las fotos, lo que toca hacer).
  const solo = porPasos && clave === 'detalles' && pasos.length === 1;
  const cuadroDelCobro = (
    <div className="px-5 py-6 text-center bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/50">
      <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-800 dark:text-emerald-300">{solo ? 'DETALLES DE LA ORDEN' : instalacion ? 'PAGO DE LA INSTALACIÓN' : 'COBRO RESULTANTE AL CLIENTE'}</p>
      {solo ? (
        <p className="mt-2 text-lg font-black text-emerald-800 dark:text-emerald-300 leading-tight">Sube las fotos de tu trabajo para terminar con esta orden.</p>
      ) : instalacion ? (
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
      {!solo && preFinalizada && !instalacion && <p className="mt-3 text-xs font-bold text-emerald-900 dark:text-emerald-200">Informa este monto al cliente ahora. La orden queda pendiente de aprobación.</p>}
      {!solo && visita && !instalacion && <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-900/50 rounded-full px-3 py-1"><Plug className="w-3.5 h-3.5" aria-hidden="true" /> {visita}</p>}
      {!solo && !exonerado && !instalacion && onCopy && ticket.cobroBs && (
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
  );

  // Escape no lo cierra: el técnico debe confirmar con el botón.
  if (!porPasos) {
    return (
      <Modal onClose={() => {}} zIndexClass="z-[110]">
        <div role="alertdialog" aria-labelledby="cobro-titulo" className="w-full max-w-2xl h-[calc(100dvh-2rem)] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border-2 border-emerald-500 flex flex-col overflow-hidden">
          {encabezado}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {cuadroDelCobro}
            {valoresDelCliente}
            {datosDeLaOrden}
          </div>
          <div className="shrink-0 px-5 py-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 text-sm sm:text-base font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-md transition-colors"
            >
              {restantes > 0 ? `Entendido (${restantes} más por ver)` : 'Entendido'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Qué le dice la pantalla al técnico para seguir (va justo debajo del indicador de pasos).
  const esUltimo = nav.esUltimo;
  // En el paso de las fotos no hay indicación: las explicaciones de ese paso ya van debajo (qué fotos subir, cuántas, y que se puede hacer después).
  const indicacion = clave === 'detalles' ? '' : `${clave === 'cobro'
    ? 'Informa el monto al cliente y toca «Siguiente» para registrar su pago.'
    : `Registra lo que pagó el cliente${instalacion ? '' : ' (o di que paga después)'}. ${esUltimo ? 'Con eso terminas con la orden.' : 'Después pasas al siguiente paso.'}`}${restantes > 0 ? ` Después, ${restantes} ${restantes === 1 ? 'orden más' : 'órdenes más'}.` : ''}`;

  return (
    // Escape no lo cierra: el técnico debe confirmar con el botón.
    <Modal onClose={() => {}} zIndexClass="z-[110]">
      <AsistentePasos
        rol="alertdialog"
        ariaLabelledBy="cobro-titulo"
        clasePanel="w-full max-w-2xl h-[calc(100dvh-2rem)] border-2 border-emerald-500"
        etiquetaPasos="Pasos para terminar con la orden"
        pasos={pasos.map(PASO_DE)}
        actual={clave}
        hecho={hecho}
        encabezado={encabezado}
        indicacion={indicacion}
        pie={(
          <BotonesPasos
            onAnterior={nav.hayAnterior ? nav.anterior : null}
            siguiente={clave === 'cobro' ? { onClick: nav.siguiente } : clave === 'pago' && !esUltimo ? { onClick: nav.siguiente, disabled: true, titulo: 'Registra el pago para continuar' } : null}
            secundaria={registro.onPosponer ? { texto: 'Hacerlo después', onClick: registro.onPosponer, titulo: 'Queda en tu lista con su botón. La oficina no aprueba la orden hasta que registres el pago y subas las fotos.' } : null}
            nota={registro.onPosponer ? 'Queda en tu lista; la oficina no la aprueba hasta que esté completa.' : ''}
          />
        )}
      >
        {clave === 'cobro' && (
          <>
            {cuadroDelCobro}
            {valoresDelCliente}
            {datosDeLaOrden}
          </>
        )}

        {clave === 'pago' && (
          <section aria-label="Registrar el pago del cliente" className="px-5 py-4 space-y-3">
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
          </section>
        )}

        {clave === 'detalles' && (
          <>
            {solo && cuadroDelCobro}
            <section aria-label="Detalles de la orden" className="px-5 py-4 space-y-3">
              <h3 className="text-sm font-black tracking-wide text-zinc-900 dark:text-white inline-flex items-center gap-2"><Camera className="w-4 h-4" aria-hidden="true" />DETALLES DE LA ORDEN</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Fotos del trabajo que hiciste (equipo instalado, cableado, conectores, caja...). Es obligatorio: la oficina no puede aprobar la orden sin ellas. Si no las tienes a la mano, puedes hacerlo después y la orden sigue en tu lista.</p>
              <DetallesOrdenCampo onSubir={(fotos, onProgreso) => registro.onSubirDetalles(ticket, fotos, onProgreso)} />
            </section>
            {solo && datosDeLaOrden}
          </>
        )}
      </AsistentePasos>
    </Modal>
  );
}
