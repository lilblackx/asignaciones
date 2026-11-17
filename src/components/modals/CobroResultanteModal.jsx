import { useState } from 'react';
import { Camera, CheckCheck, ChevronDown, Clock, Landmark, MapPin, Plug, Tag, User, Wrench } from 'lucide-react';
import Modal from '../Modal';
import AsistentePasos, { BotonesPasos } from '../AsistentePasos';
import BotonCopiar from '../BotonCopiar';
import FormasPagoLista from './FormasPagoLista';
import Colapsable from '../Colapsable';
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
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] max-lg:text-xs font-semibold text-muted-foreground">{etiqueta}</p>
        <p className="text-sm font-bold text-foreground break-words">{valor}</p>
      </div>
    </div>
  );
}

// Los pasos de la pantalla con `registro`, uno por vez: 'cobro' (el monto que se le informa al cliente), 'pago' (registrar lo que pagó el cliente, si todavía falta) y 'detalles' (las fotos del trabajo, solo de una
// instalación finalizada que aún no las tiene: las demás órdenes no piden fotos). Lo que ya está hecho no sale como paso.
const ETIQUETA_PASO = { cobro: 'Cobro', pago: 'Pago', detalles: 'Fotos' };
const PASO_DE = (clave) => ({ clave, etiqueta: ETIQUETA_PASO[clave] });
const pendientesDe = (ticket, registro) => ({
  pidePago: Boolean(registro) && !ticket?.pagoCliente && (ticket?.estado === 'PRE-FINALIZADO' || piensaPagoCliente(ticket)),
  pideDetalles: Boolean(registro?.onSubirDetalles) && faltanDetalles(ticket),
});
const pasosDe = ({ pidePago, pideDetalles }) => [...(pidePago ? ['cobro', 'pago'] : []), ...(pideDetalles ? ['detalles'] : [])];
// Lo que la oficina espera todavía, para el aviso de "Hacerlo después": solo las fotos en una instalación (las demás órdenes no las piden), y no el pago si ya se registró.
const textoDeLoQueFalta = ({ pidePago, pideDetalles }) => [pidePago && 'registres el pago', pideDetalles && 'subas las fotos'].filter(Boolean).join(' y ') || 'la completes';

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
  // Las formas de pago de la empresa, plegadas hasta que el técnico las pida (el cliente a veces pregunta a dónde pagar).
  const [verFormas, setVerFormas] = useState(false);
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
    <div className="encabezado-d px-5 py-4 flex items-center gap-3 shrink-0">
      <span className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${preFinalizada ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}><IconoEstado className="w-6 h-6" aria-hidden="true" /></span>
      <div className="min-w-0">
        <h2 id="cobro-titulo" className="text-lg sm:text-xl font-black leading-tight">{preFinalizada ? 'Orden pre-finalizada' : 'Orden finalizada'}</h2>
        <p className="text-xs font-medium text-muted-foreground truncate">{ticket.codigo || 'S/C'}{ticket.nombre ? ` - ${ticket.nombre}` : ''}</p>
      </div>
    </div>
  );

  const datosDeLaOrden = (
    <div className="px-5 py-4 space-y-3">
      <h3 className="text-base font-black text-foreground">Datos de la orden</h3>
      <Dato icon={User} etiqueta="Cliente" valor={ticket.nombre} />
      <Dato icon={Tag} etiqueta="Cédula" valor={ticket.cedula ? formatCedula(ticket.cedula, ticket.tipoDocumento) : ''} />
      <Dato icon={Wrench} etiqueta="Trabajo" valor={[ticket.tipoTrabajo, ticket.falla].filter(Boolean).join(' - ')} />
      <Dato icon={MapPin} etiqueta="Dirección" valor={ticket.direccion} />
      <Dato icon={Tag} etiqueta="NAP / caja / puerto" valor={ticket.nap} />
    </div>
  );

  const valoresDelCliente = onCopy && valoresGuardados(ticket) && (
    <section aria-label="Valores del cliente" className="px-5 py-4 border-b border-border">
      <ValoresClienteTarjeta valores={ticket.valoresCliente} onCopy={onCopy} />
    </section>
  );

  // El cuadro verde grande: el monto que se le informa al cliente (o, si solo faltan las fotos, lo que toca hacer).
  const solo = porPasos && clave === 'detalles' && pasos.length === 1;
  const cuadroDelCobro = (
    <div className="mx-5 mt-3 px-4 py-5 text-center rounded-card bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{solo ? 'Detalles de la orden' : instalacion ? 'Pago de la instalación' : 'Cobro resultante al cliente'}</p>
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
      {!solo && visita && !instalacion && <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900 dark:text-emerald-200"><Plug className="w-4 h-4" aria-hidden="true" /> {visita}</p>}
      {!solo && !exonerado && !instalacion && onCopy && ticket.cobroBs && (
        <BotonCopiar
          copiado={copiado === 'monto'}
          onClick={() => copiar('monto', textoMonto(ticket.cobroBs, moneda), 'Monto copiado.')}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 text-sm font-bold rounded-boton px-4 py-2 border"
          tono="bg-card border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
          tonoCopiado="bg-emerald-700 border-emerald-700 text-white"
          iconoClase="w-4 h-4"
        >
          Copiar monto
        </BotonCopiar>
      )}
    </div>
  );

  // Las formas de pago de la empresa, junto al monto: por si el cliente pregunta a dónde pagar. Cada dato se copia con un toque. No salen en una orden exonerada (no hay nada que pagar) ni cuando solo faltan las fotos.
  const formasDelCobro = onCopy && formas.length > 0 && !exonerado && !solo && (
    <section aria-label="Formas de pago de la empresa" className="mx-5 mt-3">
      <button
        type="button"
        onClick={() => setVerFormas((v) => !v)}
        aria-expanded={verFormas}
        aria-controls="cobro-formas-de-pago"
        className="w-full min-h-11 px-4 inline-flex items-center justify-between gap-2 rounded-boton border border-input bg-card hover:bg-secondary text-sm font-bold text-foreground transition-colors"
      >
        <span className="inline-flex items-center gap-2"><Landmark className="w-4 h-4 text-red-700 dark:text-red-400" aria-hidden="true" /> Formas de pago de la empresa</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${verFormas ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <Colapsable>
        {verFormas && (
          <div id="cobro-formas-de-pago" className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">Si el cliente las necesita, aquí están los datos para pagar el monto de arriba. Toca para copiar cada uno.</p>
            <FormasPagoLista formas={formas} onCopy={onCopy} />
          </div>
        )}
      </Colapsable>
    </section>
  );

  // Escape no lo cierra: el técnico debe confirmar con el botón.
  if (!porPasos) {
    return (
      <Modal onClose={() => {}} zIndexClass="z-[110]">
        <div role="alertdialog" aria-labelledby="cobro-titulo" className="w-full max-w-lg max-h-[calc(100dvh-2rem)] bg-card rounded-card shadow-2xl border border-border flex flex-col overflow-hidden">
          {encabezado}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {cuadroDelCobro}
            {formasDelCobro}
            {valoresDelCliente}
            {datosDeLaOrden}
          </div>
          <div className="shrink-0 px-5 py-3 bg-card border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 text-sm sm:text-base font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-boton shadow-md transition-colors"
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
        clasePanel="w-full max-w-xl h-[calc(100dvh-2rem)] lg:h-[min(94dvh,54rem)] border border-border"
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
            secundaria={registro.onPosponer ? { texto: 'Hacerlo después', onClick: registro.onPosponer, titulo: `Queda en tu lista con su botón. La oficina no aprueba la orden hasta que ${textoDeLoQueFalta({ pidePago, pideDetalles })}.` } : null}
            nota={registro.onPosponer ? 'Queda en tu lista; la oficina no la aprueba hasta que esté completa.' : ''}
          />
        )}
      >
        {clave === 'cobro' && (
          <>
            {cuadroDelCobro}
            {formasDelCobro}
            {valoresDelCliente}
            {datosDeLaOrden}
          </>
        )}

        {clave === 'pago' && (
          <section aria-label="Registrar el pago del cliente" className="px-5 py-4 space-y-3">
            <h3 className="text-base font-black text-foreground">Registrar el pago del cliente</h3>
            <p className="text-xs text-muted-foreground">{instalacion ? 'Anota lo que el cliente pagó por la instalación. Es obligatorio: el cliente paga la instalación de una vez y, sin esto, la oficina no puede aprobar la orden.' : 'Anota lo que el cliente pagó por este cobro. Es obligatorio: si todavía no pagó, di que paga después.'} Antes de guardar te pedimos confirmar los datos.</p>
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
              <h3 className="text-base font-black text-foreground inline-flex items-center gap-2"><Camera className="w-4 h-4" aria-hidden="true" />Detalles de la orden</h3>
              <p className="text-xs text-muted-foreground">Sube 7 fotos del trabajo que hiciste (equipo instalado, cableado, conectores, caja...). Son exactamente 7 y es obligatorio: la oficina no puede aprobar la orden sin ellas. Si no las tienes a la mano, puedes hacerlo después y la orden sigue en tu lista.</p>
              <DetallesOrdenCampo onSubir={(fotos, onProgreso) => registro.onSubirDetalles(ticket, fotos, onProgreso)} />
            </section>
            {solo && datosDeLaOrden}
          </>
        )}
      </AsistentePasos>
    </Modal>
  );
}
