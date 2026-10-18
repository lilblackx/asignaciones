import { useState } from 'react';
import { Banknote, Cable, CheckCheck, CircleAlert, Eye, Undo2, User, Wrench, X } from 'lucide-react';
import Modal from '../Modal';
import ConfirmModal from './ConfirmModal';
import { stripEmojis } from '../../utils/sanitizeInput';
import { faltantesInstalacion } from '../../utils/instalacion';
import { evaluarPotencia } from '../../utils/potencia';
import { TIPO_RECABLEADO, avisaCobroAlPreFinalizar, partesRecableado } from '../../utils/tipoVisita';
import { COBRO_INICIAL, conceptoCobro, llevaCobro, resolverCobro } from '../../utils/cobro';
import { cobroPrecargado, consultaCobroDe, respuestaVigente, textoRespuesta } from '../../utils/consultaCobro';
import ContactoCliente from '../ContactoCliente';
import DatosParaAutorizar from './DatosParaAutorizar';
import CobroSelector from './CobroSelector';
import ConectorColocado from './ConectorColocado';
import ValoresClienteAdmin from './ValoresClienteAdmin';
import { exigeValoresCliente, ofreceValoresCliente, parseValoresCliente, valoresGuardados } from '../../utils/valoresCliente';

// Revisión de una orden antes de cerrarla. Sirve para los dos cierres de la oficina: aprobar una orden que el
// técnico pre-finalizó (con "Devolver" si algo no está bien) y finalizar directo una orden pendiente, sin que
// el técnico la haya pre-finalizado. Los datos y el cobro se ven igual en los dos.
export default function AprobarFinalizarModal({ ticket, montoBs, onConfirm, onGuardarValores, onDevolver, onCopy, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [motivoError, setMotivoError] = useState('');
  // Confirmación final antes de cerrar o devolver: null, 'cerrar' o 'devolver'.
  const [confirmando, setConfirmando] = useState(null);
  // Lo que se eligió de cobro, ya validado, para usarlo al confirmar.
  const [extraCierre, setExtraCierre] = useState(undefined);
  // Cobro que verá el técnico (solo en visitas de conector): "Visita técnica" u "Otro monto".
  const [cobro, setCobro] = useState(() => cobroPrecargado(ticket) || COBRO_INICIAL);
  const [cobroError, setCobroError] = useState('');
  // Valores de señal del cliente (obligatorios): los campos, lo ya guardado en la orden y si se está guardando.
  const [oltTexto, setOltTexto] = useState(ticket?.valoresCliente?.olt1310Dbm != null ? String(ticket.valoresCliente.olt1310Dbm) : '');
  const [onuTexto, setOnuTexto] = useState(ticket?.valoresCliente?.onu1490Dbm != null ? String(ticket.valoresCliente.onu1490Dbm) : '');
  const [valoresGuardadosEnOrden, setValoresGuardadosEnOrden] = useState(ticket && valoresGuardados(ticket) ? ticket.valoresCliente : null);
  const [valoresErrores, setValoresErrores] = useState({});
  const [valoresErrorGuardar, setValoresErrorGuardar] = useState('');
  const [guardandoValores, setGuardandoValores] = useState(false);

  if (!ticket) return null;
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
    // Sin los valores del cliente guardados (y al día con lo escrito en los campos) no se cierra la orden. Donde son
    // opcionales (instalaciones) solo se exige si escribió algo: así no se pierde lo que no guardó.
    const escribioValores = oltTexto.trim() !== '' || onuTexto.trim() !== '';
    if ((exigeValores || (ofreceValores && escribioValores)) && (!valoresGuardadosEnOrden || valoresSucios)) {
      setValoresErrores(valoresLeidos.valor ? {} : valoresLeidos.errores);
      setValoresErrorGuardar(valoresLeidos.valor ? 'Guarda los valores del cliente antes de cerrar la orden.' : '');
      enfocarValores(valoresLeidos.valor ? null : valoresLeidos.errores);
      return;
    }
    let extra;
    if (llevaCobro(ticket)) {
      const resuelto = resolverCobro(cobro, montoBs);
      if (resuelto.error) {
        setCobroError(resuelto.error);
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

  return (
    <>
    {/* Con la confirmación abierta, Escape cierra solo la confirmación. */}
    <Modal onClose={confirmando ? () => {} : onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg md:max-w-3xl max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-blue-500 flex justify-between items-center sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wide">
                {finalizando ? 'REVISAR ANTES DE FINALIZAR' : 'REVISAR ANTES DE APROBAR'}
              </span>
              <span className="text-xs font-bold text-blue-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate max-w-[260px] sm:max-w-md">{ticket.nombre}</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <p className="flex items-center gap-2 text-[11px] text-blue-800 dark:text-blue-300 font-medium">
            <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {finalizando ? 'Solo lectura. El técnico aún no pre-finalizó esta orden: verifica los datos antes de finalizarla.' : 'Solo lectura. Verifica los datos que cargó el técnico antes de aprobar.'}
          </p>

          {faltantes.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-800 dark:text-red-300">
              <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-snug"><span className="font-black">Faltan datos de la instalación:</span> {faltantes.join(', ')}.{finalizando ? ' Si la finalizas así, no quedarán registrados.' : ''}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-700 dark:text-zinc-300">
            <span className="inline-flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-red-500 shrink-0" aria-hidden="true" /><span className="font-bold text-red-600 dark:text-red-400">{ticket.tipoTrabajo}</span>{ticket.falla && ticket.falla !== ticket.tipoTrabajo && <span className="text-zinc-500 dark:text-zinc-400">— {ticket.falla}</span>}</span>
            {ticket.tecnico && <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />Técnico: <span className="font-bold">{ticket.tecnico}</span></span>}
            {ticket.creado && <span className="text-zinc-500 dark:text-zinc-400">Creado por: {ticket.creado}</span>}
          </div>

          <DatosParaAutorizar ticket={ticket} onCopy={onCopy} />

          <ContactoCliente telefono={ticket.telefono} ubicacion={ticket.ubicacion} napCoordenadas={ticket.napCoordenadas} nombre={ticket.nombre} />

          {ticket.tipoVisita === TIPO_RECABLEADO && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              <p className="flex items-center gap-2 font-black"><Cable className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" /> RECABLEADO</p>
              {partesRecableado(ticket).length > 0
                ? partesRecableado(ticket).map((parte) => <p key={parte} className="font-bold ml-6">{parte}</p>)
                : <p className="ml-6 italic">Sin datos del recableado.</p>}
              {ticket.metrosCable != null && !ticket.conectorExterno && !ticket.conectorInterno && <p className="ml-6 text-[11px] opacity-80">Sin conectores registrados.</p>}
            </div>
          )}

          {/* El conector colocado va en su propio bloque: no se mezcla con el cobro de la visita. */}
          <ConectorColocado ticket={ticket} />

          {llevaCobro(ticket) && (
            <section aria-label="Cobro de la visita" className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-xl p-3 space-y-3 text-xs text-sky-900 dark:text-sky-200">
              <div>
                <h3 className="flex items-center gap-2 font-black tracking-wide">
                  <Banknote className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" /> COBRO
                </h3>
                <p className="ml-6 mt-1"><span className="opacity-70">Concepto:</span> <span className="font-bold">{conceptoCobro(ticket)}</span></p>
                {consultaCobroDe(ticket) && (
                  <p className="ml-6 mt-1 text-[11px] font-bold">
                    {respuestaVigente(ticket)
                      ? (cobroPrecargado(ticket)
                        ? `El técnico consultó este cobro (${respuestaVigente(ticket).metros} m) y ya viene elegido: ${textoRespuesta(respuestaVigente(ticket))}. Cámbialo si hace falta.`
                        : `Respondiste ${textoRespuesta(respuestaVigente(ticket))} para ${respuestaVigente(ticket).metros} m, pero el técnico registró ${ticket.metrosCable} m: elige el cobro.`)
                      : `El técnico consultó el cobro (${ticket.consultaCobro.metros} m) y no se ha respondido.`}
                  </p>
                )}
                {avisaCobroAlPreFinalizar(ticket.tipoVisita) && <p className="ml-6 mt-1 text-[11px] opacity-80">El técnico ya vio el cobro al pre-finalizar. Si cambias el cobro (otro monto o exonerar), se le muestra de nuevo.</p>}
              </div>
              <CobroSelector
                idBase="cobro-aprobar"
                montoVisita={montoBs}
                seleccion={cobro}
                onChange={(siguiente) => { setCobro(siguiente); setCobroError(''); }}
                error={cobroError}
              />
            </section>
          )}

          {ofreceValores && (
            <ValoresClienteAdmin
              ticket={ticket}
              obligatorio={exigeValores}
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

          {ticket.potenciaDbm != null && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">POTENCIA ÓPTICA</span>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
                <span className="font-black text-zinc-900 dark:text-white">{ticket.potenciaDbm} dBm</span>
                {evaluarPotencia(ticket.potenciaDbm) && (
                  <span className={`font-bold ${evaluarPotencia(ticket.potenciaDbm).clase}`}>{evaluarPotencia(ticket.potenciaDbm).texto}</span>
                )}
              </div>
              {ticket.potencia1490Dbm != null && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1">ONU Rx · Señal 1490 nm: <span className="font-bold">{ticket.potencia1490Dbm} dBm</span></p>
              )}
            </div>
          )}

          {/* Lo que describió el técnico va aparte de la nota de la oficina. En las órdenes viejas (sin campo propio) queda un solo bloque. */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">OBSERVACIÓN / DETALLES DEL TRABAJO</span>
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words min-h-[3rem]">
              {ticket.observacionTecnico || ticket.observacion || <span className="text-zinc-400 italic">Sin observación registrada.</span>}
            </div>
          </div>
          {ticket.observacionTecnico && ticket.observacion && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">NOTA DE LA OFICINA</span>
              <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                {ticket.observacion}
              </div>
            </div>
          )}

          {devolviendo && (
            <div className="space-y-1">
              <label htmlFor="motivo-devolucion" className="text-xs font-bold text-red-600 dark:text-red-400 ml-1 flex items-center gap-1">
                <Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> MOTIVO DE LA DEVOLUCIÓN <span className="font-normal">(obligatorio)</span>
              </label>
              <textarea
                id="motivo-devolucion"
                value={motivo}
                onChange={(e) => { setMotivo(stripEmojis(e.target.value)); setMotivoError(''); }}
                rows={3}
                id="aprobar-motivo"
                maxLength={500}
                autoFocus
                placeholder="Ej. Falta la potencia óptica de la ONU, confirma la NAP..."
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-xs text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              {motivoError && <p className="text-[11px] text-red-500 font-bold ml-1">{motivoError}</p>}
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1">
                La orden vuelve a PENDIENTE y el técnico recibe una notificación con este motivo.
              </p>
            </div>
          )}

          <div className="sticky bottom-0 z-10 flex gap-2.5 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={devolviendo ? () => { setDevolviendo(false); setMotivoError(''); } : onClose}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center py-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {devolviendo ? 'Volver' : 'Cancelar'}
            </button>
            {devolviendo ? (
              <button
                type="button"
                onClick={handleDevolver}
                disabled={isSubmitting}
                className={`flex-1 py-3 text-xs sm:text-sm text-white font-black bg-red-600 hover:bg-red-700 border border-red-600 hover:border-red-700 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Undo2 className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">{isSubmitting ? 'Devolviendo...' : 'Devolver'}</span>
              </button>
            ) : (
              <>
                {onDevolver && !finalizando && (
                  <button
                    type="button"
                    onClick={() => setDevolviendo(true)}
                    disabled={isSubmitting}
                    className="flex-1 py-3 text-xs sm:text-sm text-red-700 dark:text-red-400 font-black bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Undo2 className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Devolver</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting || guardandoValores}
                  className={`flex-1 py-3 text-xs sm:text-sm text-white font-black bg-blue-600 hover:bg-blue-700 border border-blue-600 hover:border-blue-700 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <CheckCheck className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{finalizando ? (isSubmitting ? 'Finalizando...' : 'Finalizar') : (isSubmitting ? 'Aprobando...' : 'Aprobar')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
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
        <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">{ticket.codigo || 'S/C'}{ticket.nombre ? ` — ${ticket.nombre}` : ''}</p>
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
        <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">{ticket.codigo || 'S/C'}{ticket.nombre ? ` — ${ticket.nombre}` : ''}</p>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 break-words whitespace-pre-wrap">Motivo: {motivo.trim()}</p>
      </ConfirmModal>
    )}
    </>
  );
}
