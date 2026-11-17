import { textoMetrajeConMarcas } from '../../utils/metraje';
import { useState } from 'react';
import { Banknote, Cable, CheckCheck, CircleAlert, Eye, Undo2, User, Wrench, X } from 'lucide-react';
import Modal from '../Modal';
import AsistentePasos, { BotonesPasos } from '../AsistentePasos';
import { usePasosAsistente } from '../../hooks/usePasosAsistente';
import { esAsistenteDeRevision, motivoNoSePuedeLlegar, pasosDeRevision } from '../../utils/pasosRevision';
import ConfirmModal from './ConfirmModal';
import { stripEmojis } from '../../utils/sanitizeInput';
import { faltantesInstalacion } from '../../utils/instalacion';
import { evaluarPotencia } from '../../utils/potencia';
import { avisaCobroAlPreFinalizar, esRecableado, tieneDatosRecableado } from '../../utils/tipoVisita';
import { COBRO_EXONERADO, conceptoCobro, llevaCobro, resolverCobro, textoMonto } from '../../utils/cobro';
import { cobroPrecargado, consultaCobroDe, respuestaVigente, textoRespuesta } from '../../utils/consultaCobro';
import DatosParaAutorizar from './DatosParaAutorizar';
import CobroSelector from './CobroSelector';
import CobroAcordadoAviso from './CobroAcordadoAviso';
import { cobroInicialDeOrden } from '../../utils/cobroAcordado';
import ConectorColocado from './ConectorColocado';
import InsigniaConector from '../InsigniaConector';
import ValoresClienteAdmin from './ValoresClienteAdmin';
import { exigeValoresCliente, ofreceValoresCliente, parseValoresCliente, valoresGuardados } from '../../utils/valoresCliente';
import Spinner from '../Spinner';
import Colapsable from '../Colapsable';
import { useMostrarAlAparecer } from '../../hooks/useMostrarAlAparecer';
import AvisoCambioDeOrden from '../AvisoCambioDeOrden';
import AvisoRevision from '../AvisoRevision';
import { cambioMientrasAbierta } from '../../utils/concurrencia';
import { claseArea } from '../estilos';
import PagoDelCliente from '../PagoDelCliente';
import Aviso from '../Aviso';

const PASO_ETIQUETA = { revisar: 'Revisar', autorizar: 'Autorizar', cobro: 'Cobro', valores: 'Valores', decision: 'Decisión' };
const PASO_DE = (clave) => ({ clave, etiqueta: PASO_ETIQUETA[clave] });

// Una fila del resumen del último paso: qué se eligió, si está bien o falta, y cómo volver al paso para cambiarlo. `valor` puede ser una lista: cada elemento va en su propia línea (los valores del cliente, uno debajo del otro).
function FilaResumen({ etiqueta, valor, ok, onCambiar }) {
  const lineas = Array.isArray(valor) ? valor : [valor];
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-[11px] max-lg:text-xs font-bold text-muted-foreground">{etiqueta}</dt>
        {lineas.map((linea, i) => (
          <dd key={i} className={`flex items-start gap-1.5 text-sm font-black break-words ${ok ? 'text-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
            {i === 0
              ? (ok ? <CheckCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" /> : <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />)
              : <span className="w-4 shrink-0" aria-hidden="true" />}
            <span>{linea}</span>
          </dd>
        ))}
      </div>
      {onCambiar && <button type="button" onClick={onCambiar} className="shrink-0 text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline">Cambiar</button>}
    </div>
  );
}

// Revisión de una orden antes de cerrarla. Sirve para los dos cierres de la oficina: aprobar una orden que el
// técnico pre-finalizó (con "Devolver" si algo no está bien) y finalizar directo una orden pendiente, sin que
// el técnico la haya pre-finalizado. Los datos y el cobro se ven igual en los dos.
// `actual`: la misma orden en vivo (cambia si otra persona la finaliza, la devuelve o la cancela mientras esta la tiene abierta); con un cambio
// se avisa y no deja guardar. `otrosRevisando`: nombres de otras personas que también la tienen abierta (solo aviso).
export default function AprobarFinalizarModal({ ticket, actual, otrosRevisando = [], montoBs, onConfirm, onGuardarValores, onDevolver, onCopy, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);
  // El paso desde el que se tocó "Devolver" (que salta directo a la decisión): si se cancela, se vuelve a ese paso y no se queda la ventana en la decisión sin haber pasado por lo obligatorio. null si ya estaba en la decisión.
  const [pasoDeOrigen, setPasoDeOrigen] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [motivoError, setMotivoError] = useState('');
  // Los pasos que aplican a esta orden: revisar lo que cargó el técnico; autorizar el equipo en SmartOLT (solo si hay algo que autorizar: serial, VLAN, tipo de equipo nuevo...; ver requiereAutorizar); el cobro (si lleva); los valores
  // de señal del cliente (si se piden u ofrecen) y la decisión. Con 2 pasos o menos (una avería simple: revisar y decidir) se queda en una sola pantalla; con más es un asistente (components/AsistentePasos).
  const claves = pasosDeRevision(ticket);
  const hayEquipo = claves.includes('autorizar');
  const porPasos = esAsistenteDeRevision(claves);
  const nav = usePasosAsistente(claves);
  // Al pulsar "Devolver" aparece el campo del motivo más abajo: la pantalla baja suave hasta él (en una sola pantalla dejando libre la barra de botones fija) y le da el foco.
  const mostrarMotivo = useMostrarAlAparecer({ margenInferior: porPasos ? 8 : 88, enfocar: 'aprobar-motivo' });
  // Confirmación final antes de cerrar o devolver: null, 'cerrar' o 'devolver'.
  const [confirmando, setConfirmando] = useState(null);
  // Lo que se eligió de cobro, ya validado, para usarlo al confirmar.
  const [extraCierre, setExtraCierre] = useState(undefined);
  // Cobro que verá el técnico (solo en visitas de conector): "Visita técnica" u "Otro monto".
  const [cobro, setCobro] = useState(() => cobroPrecargado(ticket) || cobroInicialDeOrden(ticket));
  const [cobroError, setCobroError] = useState('');
  // Valores de señal del cliente (obligatorios): los campos, lo ya guardado en la orden y si se está guardando.
  const [oltTexto, setOltTexto] = useState(ticket?.valoresCliente?.olt1310Dbm != null ? String(ticket.valoresCliente.olt1310Dbm) : '');
  const [onuTexto, setOnuTexto] = useState(ticket?.valoresCliente?.onu1490Dbm != null ? String(ticket.valoresCliente.onu1490Dbm) : '');
  const [valoresGuardadosEnOrden, setValoresGuardadosEnOrden] = useState(ticket && valoresGuardados(ticket) ? ticket.valoresCliente : null);
  const [valoresErrores, setValoresErrores] = useState({});
  const [valoresErrorGuardar, setValoresErrorGuardar] = useState('');
  const [guardandoValores, setGuardandoValores] = useState(false);

  if (!ticket) return null;
  const cambio = actual === undefined ? null : cambioMientrasAbierta(ticket, actual);
  // Pendiente = finalizar directo; pre-finalizada = aprobar. Devolver solo existe al aprobar.
  const finalizando = ticket.estado === 'PENDIENTE';
  const faltantes = faltantesInstalacion(ticket);
  const exigeValores = exigeValoresCliente(ticket);
  const ofreceValores = ofreceValoresCliente(ticket);
  const valoresLeidos = parseValoresCliente({ olt: oltTexto, onu: onuTexto });
  // Hay valores guardados pero los campos ya no coinciden con ellos: falta volver a guardar.
  const valoresSucios = Boolean(valoresGuardadosEnOrden) && (!valoresLeidos.valor
    || valoresLeidos.valor.olt1310Dbm !== valoresGuardadosEnOrden.olt1310Dbm
    || valoresLeidos.valor.onu1490Dbm !== valoresGuardadosEnOrden.onu1490Dbm);

  // Lo que decide si se puede seguir: el cobro elegido es válido, y los valores del cliente (donde son obligatorios, o donde se escribió algo) están guardados y al día con los campos.
  const cobroResuelto = llevaCobro(ticket) ? resolverCobro(cobro, montoBs) : null;
  const cobroValido = !cobroResuelto?.error;
  const escribioValores = oltTexto.trim() !== '' || onuTexto.trim() !== '';
  const valoresListos = !((exigeValores || (ofreceValores && escribioValores)) && (!valoresGuardadosEnOrden || valoresSucios));
  // Con pasos, un problema se muestra en el paso donde se arregla (y el foco va al campo cuando ya se ve).
  const irAlPaso = (clavePaso, despues) => {
    if (porPasos && nav.clave !== clavePaso) {
      nav.ir(clavePaso);
      if (despues) setTimeout(despues, 320);
    } else if (despues) despues();
  };
  const irADevolver = () => { setPasoDeOrigen(nav.clave === 'decision' ? null : nav.clave); setDevolviendo(true); nav.ir('decision'); };
  // Cancelar la devolución: se cierra el motivo y, si se venía de otro paso, se regresa a él (la decisión de aprobar solo se alcanza pasando por los pasos obligatorios).
  const cancelarDevolver = () => {
    setDevolviendo(false);
    setMotivoError('');
    if (pasoDeOrigen) nav.ir(pasoDeOrigen);
    setPasoDeOrigen(null);
  };

  const enfocarValores = (errores) => document.getElementById(errores?.olt ? 'vc-olt' : errores?.onu ? 'vc-onu' : 'vc-guardar')?.focus();

  const handleGuardarValores = async () => {
    setValoresErrorGuardar('');
    if (!valoresLeidos.valor) {
      setValoresErrores(valoresLeidos.errores);
      enfocarValores(valoresLeidos.errores);
      return;
    }
    setValoresErrores({});
    setGuardandoValores(true);
    const guardados = await onGuardarValores?.(ticket, valoresLeidos.valor);
    setGuardandoValores(false);
    if (guardados) setValoresGuardadosEnOrden(guardados);
  };

  const handleConfirm = async () => {
    if (cambio) return;
    // Sin los valores del cliente guardados (y al día con lo escrito en los campos) no se cierra la orden: son obligatorios
    // en toda orden con cobro y en las instalaciones (salvo retiro de equipo y validación NAP).
    if ((exigeValores || (ofreceValores && escribioValores)) && (!valoresGuardadosEnOrden || valoresSucios)) {
      setValoresErrores(valoresLeidos.valor ? {} : valoresLeidos.errores);
      setValoresErrorGuardar(valoresLeidos.valor ? 'Guarda los valores del cliente antes de cerrar la orden.' : '');
      irAlPaso('valores', () => enfocarValores(valoresLeidos.valor ? null : valoresLeidos.errores));
      return;
    }
    let extra;
    if (llevaCobro(ticket)) {
      const resuelto = resolverCobro(cobro, montoBs);
      if (resuelto.error) {
        setCobroError(resuelto.error);
        irAlPaso('cobro');
        return;
      }
      extra = { montoBs: resuelto.cobroBs, cobroTipo: resuelto.tipo, cobroMoneda: resuelto.moneda };
    }
    setExtraCierre(extra);
    setConfirmando('cerrar');
  };

  const ejecutarCierre = async () => {
    setIsSubmitting(true);
    await onConfirm(ticket, extraCierre);
    setIsSubmitting(false);
    setConfirmando(null);
  };

  const handleDevolver = async () => {
    if (cambio) return;
    if (!motivo.trim()) {
      setMotivoError('Escribe el motivo para que el técnico sepa qué corregir.');
      document.getElementById('aprobar-motivo')?.focus();
      return;
    }
    setConfirmando('devolver');
  };

  const ejecutarDevolucion = async () => {
    setIsSubmitting(true);
    await onDevolver(ticket, motivo);
    setIsSubmitting(false);
    setConfirmando(null);
  };

  const nombreCierre = finalizando ? 'Finalizar' : 'Aprobar';
  const ocupado = isSubmitting ? <Spinner /> : null;
  const encabezado = (
        <div className="encabezado-d bg-black px-4 py-3.5 border-b-2 border-blue-500 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded tracking-wide">
                {finalizando ? 'REVISAR ANTES DE FINALIZAR' : 'REVISAR ANTES DE APROBAR'}
              </span>
              <span className="text-xs font-bold text-blue-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate max-w-[260px] sm:max-w-md">{ticket.nombre}</h2>
            <AvisoCambioDeOrden texto={cambio} encabezado />
            {!cambio && <AvisoRevision nombres={otrosRevisando} encabezado />}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="inline-flex items-center justify-center relative bg-zinc-800 p-1.5 rounded-full max-lg:after:absolute max-lg:after:-inset-2 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
  );
  const aviso = (
          <p className="flex items-center gap-2 text-[11px] max-lg:text-xs text-blue-800 dark:text-blue-300 font-medium">
            <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {finalizando ? 'Solo lectura. El técnico aún no pre-finalizó esta orden: verifica los datos antes de finalizarla.' : 'Solo lectura. Verifica los datos que cargó el técnico antes de aprobar.'}
          </p>
  );
  const faltantesNode = (
    <>
          {faltantes.length > 0 && (
            <Aviso nivel="error" role="alert" compact titulo="Faltan datos de la instalación">{faltantes.join(', ')}.{finalizando ? ' Si la finalizas así, no quedarán registrados.' : ''}</Aviso>
          )}
    </>
  );
  const resumenNode = (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-foreground">
            <span className="inline-flex items-center gap-1.5"><Wrench className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" aria-hidden="true" /><span className="font-black text-red-700 dark:text-red-400">{ticket.tipoTrabajo}</span>{ticket.falla && ticket.falla !== ticket.tipoTrabajo && <span className="font-medium text-card-foreground">- {ticket.falla}</span>}</span>
            {ticket.tecnico && <span className="inline-flex items-center gap-1.5"><User className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />Técnico: <span className="font-black">{ticket.tecnico}</span></span>}
            {ticket.creado && <span className="text-card-foreground">Creado por: <span className="font-bold">{ticket.creado}</span></span>}
          </div>
  );
  const autorizarNode = (
          <DatosParaAutorizar ticket={ticket} onCopy={onCopy} paraAutorizar={hayEquipo} />
  );
  const recableadoNode = (
    <>
          {esRecableado(ticket.tipoVisita) && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-campo p-3 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              <p className="flex items-center gap-2 font-black"><Cable className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" /> RECABLEADO</p>
              {tieneDatosRecableado(ticket)
                ? (
                  <div className="ml-6 space-y-1.5">
                    {ticket.metrosCable != null && <p className="font-bold">{textoMetrajeConMarcas(ticket.metrosCable, ticket)} de cable</p>}
                    {[['Conector externo', ticket.conectorExterno], ['Conector interno', ticket.conectorInterno]].filter(([, color]) => color).map(([nombre, color]) => (
                      <p key={nombre} className="flex flex-wrap items-center gap-2 font-bold">{nombre} <InsigniaConector color={color} /></p>
                    ))}
                  </div>
                )
                : <p className="ml-6 italic">Sin datos del recableado.</p>}
              {ticket.metrosCable != null && !ticket.conectorExterno && !ticket.conectorInterno && <p className="ml-6 text-[11px] max-lg:text-xs opacity-80">Sin conectores registrados.</p>}
            </div>
          )}
    </>
  );
  const conectorNode = (
    <>
          {/* El conector colocado va en su propio bloque: no se mezcla con el cobro de la visita. */}
          <ConectorColocado ticket={ticket} />
    </>
  );
  const cobroNode = (
    <>
          {llevaCobro(ticket) && (
            <section aria-label="Cobro de la visita" className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-campo p-3 space-y-3 text-xs text-sky-900 dark:text-sky-200">
              <div>
                <h3 className="flex items-center gap-2 font-black tracking-wide">
                  <Banknote className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" /> COBRO
                </h3>
                <p className="ml-6 mt-1"><span className="opacity-70">Concepto:</span> <span className="font-bold">{conceptoCobro(ticket)}</span></p>
                {consultaCobroDe(ticket) && (
                  <p className="ml-6 mt-1 text-[11px] max-lg:text-xs font-bold">
                    {respuestaVigente(ticket)
                      ? (cobroPrecargado(ticket)
                        ? `El técnico consultó este cobro (${respuestaVigente(ticket).metros} m) y ya viene elegido: ${textoRespuesta(respuestaVigente(ticket))}. Cámbialo si hace falta.`
                        : `Respondiste ${textoRespuesta(respuestaVigente(ticket))} para ${respuestaVigente(ticket).metros} m, pero el técnico registró ${ticket.metrosCable} m: elige el cobro.`)
                      : `El técnico consultó el cobro (${ticket.consultaCobro.metros} m) y no se ha respondido.`}
                  </p>
                )}
                {avisaCobroAlPreFinalizar(ticket.tipoVisita) && <p className="ml-6 mt-1 text-[11px] max-lg:text-xs opacity-80">El técnico ya vio el cobro al pre-finalizar. Si cambias el cobro (otro monto o exonerar), se le muestra de nuevo.</p>}
              </div>
              <CobroAcordadoAviso ticket={ticket} />
              <CobroSelector
                idBase="cobro-aprobar"
                montoVisita={montoBs}
                seleccion={cobro}
                onChange={(siguiente) => { setCobro(siguiente); setCobroError(''); }}
                error={cobroError}
              />
            </section>
          )}
    </>
  );
  const observNode = (
    <>
          {/* Lo que describió el técnico va aparte de la nota de la oficina. En las órdenes viejas (sin campo propio) queda un solo bloque. */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-card-foreground ml-1">OBSERVACIÓN / DETALLES DEL TRABAJO</span>
            <div className="bg-sunken border border-border rounded-campo p-3 text-xs text-foreground whitespace-pre-wrap break-words min-h-[3rem]">
              {ticket.observacionTecnico || ticket.observacion || <span className="text-muted-foreground italic">Sin observación registrada.</span>}
            </div>
          </div>
          {ticket.observacionTecnico && ticket.observacion && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-card-foreground ml-1">NOTA DE LA OFICINA</span>
              <div className="bg-zinc-100 dark:bg-zinc-900 border border-border rounded-campo p-3 text-xs text-card-foreground whitespace-pre-wrap break-words">
                {ticket.observacion}
              </div>
            </div>
          )}
    </>
  );
  const valoresNode = (
    <>
          {ofreceValores && (
            <ValoresClienteAdmin
              ticket={ticket}
              obligatorio={exigeValores}
              tecnicoLosVe={llevaCobro(ticket)}
              olt={oltTexto}
              onu={onuTexto}
              onOlt={(v) => { setOltTexto(v); setValoresErrores((e) => ({ ...e, olt: undefined })); setValoresErrorGuardar(''); }}
              onOnu={(v) => { setOnuTexto(v); setValoresErrores((e) => ({ ...e, onu: undefined })); setValoresErrorGuardar(''); }}
              errores={valoresErrores}
              guardados={valoresGuardadosEnOrden}
              sucio={valoresSucios}
              guardando={guardandoValores}
              errorGuardar={valoresErrorGuardar}
              onGuardar={handleGuardarValores}
            />
          )}
    </>
  );
  const potenciaNode = (
    <>
          {ticket.potenciaDbm != null && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-card-foreground ml-1">POTENCIA ÓPTICA</span>
              <div className="bg-sunken border border-border rounded-campo p-3 text-xs flex items-center justify-between gap-2">
                <span className="font-black text-foreground">{ticket.potenciaDbm} dBm</span>
                {evaluarPotencia(ticket.potenciaDbm) && (
                  <span className={`font-bold ${evaluarPotencia(ticket.potenciaDbm).clase}`}>{evaluarPotencia(ticket.potenciaDbm).texto}</span>
                )}
              </div>
              {ticket.potencia1490Dbm != null && (
                <p className="text-[11px] max-lg:text-xs text-muted-foreground ml-1">ONU Rx · Señal 1490 nm: <span className="font-bold">{ticket.potencia1490Dbm} dBm</span></p>
              )}
            </div>
          )}
    </>
  );
  const pagoNode = (
          <PagoDelCliente orden={ticket} bloque />
  );
  const motivoNode = (
          <Colapsable>
            {devolviendo && (
              <div ref={mostrarMotivo} className="space-y-1">
                <label htmlFor="aprobar-motivo" className="text-xs font-bold text-red-700 dark:text-red-400 ml-1 flex items-center gap-1">
                  <Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> MOTIVO DE LA DEVOLUCIÓN <span className="font-normal">(obligatorio)</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => { setMotivo(stripEmojis(e.target.value)); setMotivoError(''); }}
                  rows={3}
                  aria-invalid={!!motivoError}
                  id="aprobar-motivo"
                  maxLength={500}
                  placeholder="Ej. Falta la potencia óptica de la ONU, confirma la NAP..."
                  className={`${claseArea('compacto')} resize-none`}
                />
                {motivoError && <p className="text-[11px] max-lg:text-xs text-red-700 dark:text-red-400 font-bold ml-1">{motivoError}</p>}
                <p className="text-[11px] max-lg:text-xs text-muted-foreground ml-1">
                  La orden vuelve a PENDIENTE y el técnico recibe una notificación con este motivo.
                </p>
              </div>
            )}
          </Colapsable>
  );

  // Una sola pantalla (2 pasos o menos): todo seguido, con la barra de botones fija abajo, como siempre.
  const unaSolaPantalla = (
    <Modal onClose={confirmando ? () => {} : onClose} zIndexClass="z-50">
      <div className="bg-card rounded-card shadow-2xl w-full max-w-lg md:max-w-3xl max-h-[92dvh] overflow-y-auto border border-border">
        {encabezado}
        <div className="p-4 sm:p-5 space-y-4">
          {aviso}
          {faltantesNode}
          {resumenNode}
          {autorizarNode}
          {recableadoNode}
          {conectorNode}
          {cobroNode}
          {observNode}
          {valoresNode}
          {potenciaNode}
          {pagoNode}
          {motivoNode}
          <div className="sticky bottom-0 z-10 flex gap-2.5 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 bg-card border-t border-border">
            <button
              type="button"
              onClick={devolviendo ? () => { setDevolviendo(false); setMotivoError(''); } : onClose}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center py-3 text-xs sm:text-sm text-card-foreground font-bold bg-white dark:bg-zinc-800 border border-input hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-campo transition-colors disabled:opacity-50"
            >
              {devolviendo ? 'Volver' : 'Cancelar'}
            </button>
            {devolviendo ? (
              <button
                type="button"
                onClick={handleDevolver}
                disabled={isSubmitting || Boolean(cambio)}
                className={`flex-1 py-3 text-xs sm:text-sm text-white font-black bg-red-600 hover:bg-red-700 border border-red-600 hover:border-red-700 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${
                  isSubmitting || cambio ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Undo2 className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{isSubmitting && <Spinner />}{isSubmitting ? 'Devolviendo...' : 'Devolver'}</span>
              </button>
            ) : (
              <>
                {onDevolver && !finalizando && (
                  <button
                    type="button"
                    onClick={() => setDevolviendo(true)}
                    disabled={isSubmitting || Boolean(cambio)}
                    className="flex-1 py-3 text-xs sm:text-sm text-red-700 dark:text-red-400 font-black bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-campo transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Undo2 className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Devolver</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting || guardandoValores || Boolean(cambio)}
                  className={`flex-1 py-3 text-xs sm:text-sm text-white font-black bg-blue-600 hover:bg-blue-700 border border-blue-600 hover:border-blue-700 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${
                    isSubmitting || cambio ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <CheckCheck className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{isSubmitting && <Spinner />}{finalizando ? (isSubmitting ? 'Finalizando...' : 'Finalizar') : (isSubmitting ? 'Aprobando...' : 'Aprobar')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );

  // Asistente por pasos: lo de cada paso, qué hacer para seguir y cuándo se puede avanzar.
  const clave = nav.clave;
  // Lo obligatorio de cada paso: sin cumplirlo no se pasa al siguiente, ni con "Siguiente" ni saltando con el indicador de pasos (que muestra bloqueados los pasos a los que aún no se puede llegar).
  const motivoDelPaso = (clavePaso) => (clavePaso === 'cobro' && !cobroValido
    ? 'Elige un cobro válido para continuar.'
    : clavePaso === 'valores' && !valoresListos
      ? (exigeValores ? 'Guarda los valores del cliente para continuar.' : 'Guarda lo que escribiste en los valores del cliente para continuar.')
      : '');
  const bloqueoParaLlegar = (destino) => motivoNoSePuedeLlegar(claves, clave, destino, motivoDelPaso);
  // Lo obligatorio que falta antes de la decisión, mirando todos los pasos desde el primero (por si se llegó a la decisión sin pasar por ellos): sin eso no se aprueba.
  const faltaAntesDeDecidir = motivoNoSePuedeLlegar(claves, claves[0], 'decision', motivoDelPaso);
  const bloqueoSiguiente = motivoDelPaso(clave);
  const indicacion = clave === 'revisar'
    ? 'Revisa lo que cargó el técnico. Es solo lectura.'
    : clave === 'autorizar'
      ? 'Copia estos datos a SmartOLT para autorizar el equipo del cliente.'
      : clave === 'cobro'
        ? (cobroValido ? 'Elige el cobro que verá el técnico y toca «Siguiente».' : 'Elige un cobro válido para poder continuar.')
        : clave === 'valores'
          ? (exigeValores ? (valoresListos ? 'Valores guardados. Toca «Siguiente».' : 'Guarda los valores de señal del cliente para poder continuar.') : 'Opcional: guarda los valores de señal del cliente y toca «Siguiente».')
          : devolviendo
            ? 'Escribe el motivo para que el técnico sepa qué corregir.'
            : `Revisa el resumen y ${finalizando ? 'finaliza' : 'aprueba'} la orden${onDevolver && !finalizando ? ', o devuélvela al técnico con un motivo' : ''}.`;
  // "Devolver" va como acción alterna del pie en todos los pasos (lleva a la decisión con el motivo abierto), salvo ya devolviendo.
  const secundariaDevolver = onDevolver && !finalizando && !devolviendo
    ? { texto: 'Devolver', icono: Undo2, tono: 'rojo', onClick: irADevolver, disabled: isSubmitting || Boolean(cambio) }
    : null;
  const pie = nav.esUltimo
    ? (devolviendo ? (
      <BotonesPasos
        onAnterior={cancelarDevolver}
        textoAnterior="Volver"
        siguiente={{ onClick: handleDevolver, texto: 'Devolver', icono: Undo2, tono: 'rojo', disabled: isSubmitting || Boolean(cambio), ocupado }}
      />
    ) : (
      <BotonesPasos
        onAnterior={nav.hayAnterior ? nav.anterior : null}
        siguiente={{ onClick: handleConfirm, texto: nombreCierre, icono: CheckCheck, tono: 'azul', disabled: isSubmitting || guardandoValores || Boolean(cambio) || Boolean(faltaAntesDeDecidir), titulo: faltaAntesDeDecidir || undefined, ocupado }}
        secundaria={secundariaDevolver}
      />
    ))
    : (
      <BotonesPasos
        onAnterior={nav.hayAnterior ? nav.anterior : null}
        siguiente={{ onClick: nav.siguiente, disabled: Boolean(bloqueoSiguiente), titulo: bloqueoSiguiente }}
        secundaria={secundariaDevolver}
      />
    );

  const resumenFinal = (
    <section aria-label="Resumen" className="rounded-campo border border-border bg-sunken p-3 space-y-3">
      <h3 className="text-xs font-black tracking-wide text-foreground">RESUMEN ANTES DE {finalizando ? 'FINALIZAR' : 'APROBAR'}</h3>
      <dl className="space-y-2.5">
        {cobroResuelto && (
          <FilaResumen
            etiqueta="Cobro al cliente"
            ok={cobroValido}
            valor={cobroValido ? (cobroResuelto.tipo === COBRO_EXONERADO ? 'Exonerado' : cobroResuelto.cobroBs ? textoMonto(cobroResuelto.cobroBs, cobroResuelto.moneda) : 'Sin monto') : 'Falta elegir el cobro'}
            onCambiar={() => nav.ir('cobro')}
          />
        )}
        {ofreceValores && (
          <FilaResumen
            etiqueta="Valores del cliente"
            ok={valoresListos}
            valor={valoresGuardadosEnOrden && !valoresSucios ? [`OLT ${valoresGuardadosEnOrden.olt1310Dbm} dBm`, `ONU ${valoresGuardadosEnOrden.onu1490Dbm} dBm`] : exigeValores ? 'Sin guardar (obligatorios)' : 'Sin guardar (opcionales)'}
            onCambiar={() => nav.ir('valores')}
          />
        )}
        {faltantes.length > 0 && <FilaResumen etiqueta="Datos de la instalación" ok={false} valor={`Faltan: ${faltantes.join(', ')}`} onCambiar={() => nav.ir('revisar')} />}
        {!cobroResuelto && !ofreceValores && faltantes.length === 0 && <FilaResumen etiqueta="Lo que cargó el técnico" ok valor="Revisado" onCambiar={() => nav.ir('revisar')} />}
      </dl>
      <p className="text-xs text-muted-foreground leading-snug">{finalizando ? 'La orden queda FINALIZADA sin que el técnico la haya pre-finalizado.' : 'Apruebas lo que cargó el técnico y la orden queda FINALIZADA.'}{ticket.tecnico ? ' Después el técnico registra el pago del cliente y sube las fotos del trabajo.' : ''}</p>
    </section>
  );

  const asistente = (
    <Modal onClose={confirmando ? () => {} : onClose} zIndexClass="z-50">
      <AsistentePasos
        clasePanel="w-full max-w-lg md:max-w-3xl h-[min(92dvh,50rem)] border border-border"
        etiquetaPasos="Pasos para revisar la orden"
        pasos={claves.map(PASO_DE)}
        actual={clave}
        onElegir={(destino) => { if (bloqueoParaLlegar(destino)) return; if (destino !== 'decision') { setDevolviendo(false); setPasoDeOrigen(null); } nav.ir(destino); }}
        bloqueo={bloqueoParaLlegar}
        encabezado={encabezado}
        indicacion={indicacion}
        pie={pie}
      >
        <div className="p-4 sm:p-5 space-y-4">
          {clave === 'revisar' && (
            <>
              {aviso}
              {faltantesNode}
              {resumenNode}
              {!hayEquipo && autorizarNode}
              {recableadoNode}
              {conectorNode}
              {potenciaNode}
              {observNode}
              {pagoNode}
            </>
          )}
          {clave === 'autorizar' && autorizarNode}
          {clave === 'cobro' && cobroNode}
          {clave === 'valores' && valoresNode}
          {clave === 'decision' && (
            <>
              {faltaAntesDeDecidir && !devolviendo && <p role="alert" className="text-xs font-bold text-amber-700 dark:text-amber-300">{faltaAntesDeDecidir} Usa «Cambiar» en el resumen o «Atrás».</p>}
              {resumenFinal}
              {motivoNode}
            </>
          )}
        </div>
      </AsistentePasos>
    </Modal>
  );

  return (
    <>
    {/* Con la confirmación abierta, Escape cierra solo la confirmación. */}
    {porPasos ? asistente : unaSolaPantalla}
    {confirmando === 'cerrar' && (
      <ConfirmModal
        color="blue"
        icon={CheckCheck}
        title={finalizando ? '¿Finalizar esta orden?' : '¿Aprobar y finalizar esta orden?'}
        description={finalizando ? 'La orden queda FINALIZADA sin que el técnico la haya pre-finalizado.' : 'Apruebas lo que cargó el técnico y la orden queda FINALIZADA.'}
        confirmLabel={finalizando ? 'Sí, finalizar' : 'Sí, aprobar'}
        processingLabel={finalizando ? 'Finalizando...' : 'Aprobando...'}
        cancelLabel="Volver"
        onCancel={() => setConfirmando(null)}
        onConfirm={ejecutarCierre}
      >
        <p className="text-sm font-bold text-foreground break-words">{ticket.codigo || 'S/C'}{ticket.nombre ? ` - ${ticket.nombre}` : ''}</p>
      </ConfirmModal>
    )}
    {confirmando === 'devolver' && (
      <ConfirmModal
        color="red"
        icon={Undo2}
        title="¿Devolver esta orden al técnico?"
        description="Vuelve a PENDIENTE y el técnico recibe una notificación con el motivo."
        confirmLabel="Sí, devolver"
        processingLabel="Devolviendo..."
        cancelLabel="Volver"
        onCancel={() => setConfirmando(null)}
        onConfirm={ejecutarDevolucion}
      >
        <p className="text-sm font-bold text-foreground break-words">{ticket.codigo || 'S/C'}{ticket.nombre ? ` - ${ticket.nombre}` : ''}</p>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 break-words whitespace-pre-wrap">Motivo: {motivo.trim()}</p>
      </ConfirmModal>
    )}
    </>
  );
}
