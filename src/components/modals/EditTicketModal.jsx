import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { normalizarCoordenadasNap, normalizarUbicacion } from '../../utils/ubicacion';
import ContactoCliente from '../ContactoCliente';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';
import ConfirmCodigoAltoModal from './ConfirmCodigoAltoModal';
import ConfirmSinCoordenadasModal from './ConfirmSinCoordenadasModal';
import NapCoordenadasField from './NapCoordenadasField';
import TelefonosField from './TelefonosField';
import PromotorField from './PromotorField';
import DatosTecnicoEdicion from './DatosTecnicoEdicion';
import { TIPOS_POR_TRABAJO } from '../../constants';
import { evaluarPotencia, parsePotencia } from '../../utils/potencia';
import { esInstalacion as trabajoEsInstalacion, napConPuerto } from '../../utils/instalacion';
import { formularioDatosTecnico, formularioModificado, tieneDatosDelTecnico, validarDatosTecnico } from '../../utils/edicionDatosTecnico';
import { CedulaField, ObservacionField, ObservacionTecnicoField, TecnicoField, TipoTrabajoField, TurnoSugeridoBanner } from './TicketFormFields';
import { promotoraDeOrden, tipoUsaPlantillaPromotora } from '../../utils/whatsapp';
import { devolucionPendiente } from '../../utils/devolucion';
import { MAX_LARGO_MOTIVO_CANCELACION, cancelaAhora, parseMotivoCancelacion } from '../../utils/cancelacion';
import { stripEmojis } from '../../utils/sanitizeInput';
import Spinner from '../Spinner';
import CampoFecha from '../CampoFecha';

export default function EditTicketModal({ editingTicket, handleEditChange, handleEditSubmit, verificarCodigoManual, technicians, napsConocidas, turnoSugerido, onClose, isTecnico = false, esAdmin = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saltoCodigo, setSaltoCodigo] = useState(null);
  const [showSinCoordenadas, setShowSinCoordenadas] = useState(false);
  const [errorMotivo, setErrorMotivo] = useState('');

  const esInstalacion = editingTicket.tipoTrabajo?.toUpperCase().includes('INSTAL');
  // Instalación o reconexión que se creó sin la plantilla de la promotora: aquí se puede pegar. Si ya la tiene, no se
  // edita (la original no se toca). Se decide al abrir, para que el campo no desaparezca mientras se pega.
  const [faltabaPlantilla] = useState(() => tipoUsaPlantillaPromotora(editingTicket.tipoTrabajo) && !isTecnico && !String(editingTicket.plantillaOriginal || '').trim());
  // Lo que el técnico cargó (serial, VLAN, conectores, tipo de visita...) se corrige aquí cuando la orden ya está
  // pre-finalizada o finalizada. Se decide al abrir, con la orden como estaba: cambiar el estado o el trabajo en el formulario
  // no hace desaparecer ni cambiar la sección.
  const [ordenAlAbrir] = useState(editingTicket);
  const [conDatosTecnico] = useState(() => !isTecnico && tieneDatosDelTecnico(editingTicket));
  // La observación del técnico aparece cuando ya la escribió o cuando la orden ya pasó por sus manos (para poder corregirla).
  const conObservacionTecnico = Boolean(ordenAlAbrir.observacionTecnico) || ordenAlAbrir.estado === 'PRE-FINALIZADO' || ordenAlAbrir.estado === 'FINALIZADO';
  const instalacionAlAbrir = trabajoEsInstalacion(ordenAlAbrir.tipoTrabajo);
  const [datosInicial] = useState(() => formularioDatosTecnico(editingTicket));
  const [datos, setDatos] = useState(datosInicial);
  const [datosErrores, setDatosErrores] = useState({});
  const cambiarDatos = (parcial) => {
    setDatos((prev) => ({ ...prev, ...parcial }));
    setDatosErrores({});
  };
  const datosModificados = conDatosTecnico && formularioModificado(datosInicial, datos);
  // En una instalación la NAP y el puerto se corrigen en esa sección (la orden los guarda juntos en `nap`).
  const napEnSeccion = conDatosTecnico && instalacionAlAbrir;
  const napCambiadaEnSeccion = napEnSeccion && (datos.nap !== datosInicial.nap || datos.puerto !== datosInicial.puerto);
  const napActual = napCambiadaEnSeccion ? napConPuerto(datos.nap, datos.puerto) : (editingTicket.nap || '');
  const mostrarSugerencia = !isTecnico && esInstalacion && !editingTicket.tecnico && turnoSugerido;
  const opcionesTipo = TIPOS_POR_TRABAJO[editingTicket.tipoTrabajo] || [];
  const ubicacionParseada = normalizarUbicacion(editingTicket.ubicacion);
  const napCoordenadasParseadas = normalizarCoordenadasNap(editingTicket.napCoordenadas);
  const potenciaParseada = parsePotencia(editingTicket.potenciaDbm);
  const potenciaEval = potenciaParseada.valor !== undefined ? evaluarPotencia(potenciaParseada.valor) : null;

  const tipoItems = [
    { value: '', label: opcionesTipo.length === 0 ? 'N/A' : 'Seleccione...' },
    ...opcionesTipo.map(t => ({ value: t, label: t }))
  ];
  // FINALIZADO no se elige aquí (la orden no tendría cobro resultante): se finaliza con "Finalizar" o "Aprobar" de la lista.
  // Solo aparece si la orden ya está finalizada, para que se vea su estado.
  const estadoItems = ['PENDIENTE', 'PRE-FINALIZADO', ...(isTecnico ? [] : [...(editingTicket.estado === 'FINALIZADO' ? ['FINALIZADO'] : []), 'CANCELADO'])].map(v => ({ value: v, label: v }));

  const handleTipoTrabajoChange = (e) => {
    handleEditChange(e);
    const nuevasOpciones = TIPOS_POR_TRABAJO[e.target.value] || [];
    if (!nuevasOpciones.includes(editingTicket.falla)) {
      handleEditChange({ target: { name: 'falla', value: '', type: 'text' } });
    }
  };

  const handleNapCoordenadasChange = (value) => {
    handleEditChange({ target: { name: 'napCoordenadas', value, type: 'text' } });
  };

  // Lo corregido de los datos del técnico (ya validado en onSubmit; no cambia mientras se confirma un aviso), o null si no se tocó.
  const datosAGuardar = () => (datosModificados ? validarDatosTecnico(ordenAlAbrir, datos).datos : null);

  const guardar = async () => {
    setIsSubmitting(true);
    await handleEditSubmit({ preventDefault: () => {} }, datosAGuardar());
    setIsSubmitting(false);
  };

  // Un código corregido a mano que se salta números del correlativo pide confirmación.
  const verificarCodigoYGuardar = async () => {
    setIsSubmitting(true);
    const salto = await verificarCodigoManual(editingTicket.tipoTrabajo, editingTicket.codigo, editingTicket.id);
    setIsSubmitting(false);
    if (salto) {
      setSaltoCodigo(salto);
      return;
    }
    guardar();
  };

  // Con NAP escrita pero sin coordenadas, avisa y deja que el usuario decida.
  // No aplica a técnicos: ellos solo pre-finalizan y no deben frenarse por esto.
  const faltanNapCoordenadas = !isTecnico && Boolean(napActual.trim()) && !napCoordenadasParseadas.valor;

  const onSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    // Cancelar la orden pide el motivo: se ve en la lista, el historial, ventas y los reportes.
    if (cancelaAhora(ordenAlAbrir, editingTicket)) {
      const motivo = parseMotivoCancelacion(editingTicket.motivoCancelacion);
      if (motivo.error) {
        setErrorMotivo(motivo.error);
        document.getElementById('ed-motivo-cancelacion')?.focus();
        return;
      }
    }
    // Un dato con error: el cursor va al primero, en el orden del formulario.
    const campoConError = napCoordenadasParseadas.error ? 'ed-nap-coords' : ubicacionParseada.error ? 'ed-ubicacion' : potenciaParseada.error ? 'ed-potencia' : null;
    if (campoConError) {
      document.getElementById(campoConError)?.focus();
      return;
    }
    // Lo corregido de los datos del técnico debe ser válido; solo se revisa si se tocó algo.
    if (datosModificados) {
      const revision = validarDatosTecnico(ordenAlAbrir, datos);
      if (revision.error) {
        setDatosErrores(revision.errores);
        document.getElementById(revision.primerCampo)?.focus();
        return;
      }
    }
    if (faltanNapCoordenadas) {
      setShowSinCoordenadas(true);
      return;
    }
    verificarCodigoYGuardar();
  };

  const confirmSinCoordenadasAndContinue = () => {
    setShowSinCoordenadas(false);
    verificarCodigoYGuardar();
  };

  const confirmSaltoAndSave = () => {
    setSaltoCodigo(null);
    guardar();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-black text-white">{isTecnico ? 'DETALLES / PRE-FINALIZAR' : 'EDITAR ORDEN'}</h2>
            <p className="text-[10px] font-medium text-red-400">Cliente: {editingTicket.nombre}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <label htmlFor="ed-nombre" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">NOMBRE<span className="text-red-600"> *</span></label>
            <input id="ed-nombre" disabled={isTecnico} required type="text" maxLength="100" name="nombre" value={editingTicket.nombre || ''} onChange={handleEditChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
          <CedulaField
            variant="edit"
            wrapperClassName="col-span-2 space-y-1"
            idPrefix="ed"
            tipoDocumento={editingTicket.tipoDocumento || 'V'}
            cedula={editingTicket.cedula || ''}
            onChange={handleEditChange}
            disabled={isTecnico}
          />
          <div className="col-span-2 space-y-1">
            <label htmlFor="ed-direccion" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">DIRECCIÓN<span className="text-red-600"> *</span></label>
            <input id="ed-direccion" disabled={isTecnico} required type="text" maxLength="200" name="direccion" value={editingTicket.direccion || ''} onChange={handleEditChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
          <div className="col-span-1 space-y-1">
            <label htmlFor="ed-fechaprog" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">F. PROG (Opcional)</label>
            <CampoFecha id="ed-fechaprog" ariaLabel="Fecha programada" vacio="Sin fecha" disabled={isTecnico} valor={editingTicket.fechaProgramada || ''} onChange={(v) => handleEditChange({ target: { name: 'fechaProgramada', value: v, type: 'text' } })} permitirBorrar clase="w-full h-8 flex items-center justify-between gap-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-2 rounded-lg focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
          <div className="col-span-1 space-y-1">
            <label htmlFor="ed-codigo" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">CÓDIGO<span className="text-red-600"> *</span></label>
            <input id="ed-codigo" disabled={isTecnico} required type="text" maxLength="7" name="codigo" value={editingTicket.codigo} onChange={handleEditChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none uppercase text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
          <TipoTrabajoField
            variant="edit"
            wrapperClassName="col-span-1 space-y-1"
            idPrefix="ed"
            value={editingTicket.tipoTrabajo || ''}
            onChange={handleTipoTrabajoChange}
            disabled={isTecnico}
          />
          <div className="col-span-1 space-y-1">
            <label htmlFor="ed-falla" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">TIPO</label>
            <SelectMenu
              id="ed-falla"
              ariaLabel="Tipo"
              disabled={isTecnico || opcionesTipo.length === 0}
              value={editingTicket.falla || ''}
              onChange={(v) => handleEditChange({ target: { name: 'falla', value: v, type: 'text' } })}
              items={tipoItems}
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 pl-3 pr-8 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              chevronClassName="w-3.5 h-3.5 right-2"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <label htmlFor="ed-estado" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">ESTADO</label>
            <SelectMenu
              id="ed-estado"
              ariaLabel="Estado"
              disabled={isTecnico}
              value={editingTicket.estado}
              onChange={(v) => handleEditChange({ target: { name: 'estado', value: v, type: 'text' } })}
              items={estadoItems}
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 pl-3 pr-8 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none font-bold text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              chevronClassName="w-3.5 h-3.5 right-2"
            />
            {isTecnico && <p className="text-[9px] text-zinc-400 ml-1">Usa el botón "Pre-finalizar" de la lista para cambiar el estado.</p>}
            {!isTecnico && editingTicket.estado !== 'FINALIZADO' && <p className="text-[9px] text-zinc-400 ml-1">Para finalizar usa "Finalizar" o "Aprobar" en la lista: ahí se elige el cobro resultante.</p>}
          </div>
          {!isTecnico && editingTicket.estado === 'CANCELADO' && (
            <div className="col-span-2 space-y-1">
              <label htmlFor="ed-motivo-cancelacion" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">
                MOTIVO DE LA CANCELACIÓN {cancelaAhora(ordenAlAbrir, editingTicket) && <span className="font-normal">(obligatorio)</span>}
              </label>
              <textarea
                id="ed-motivo-cancelacion"
                name="motivoCancelacion"
                value={editingTicket.motivoCancelacion || ''}
                onChange={(e) => { handleEditChange({ target: { name: 'motivoCancelacion', value: stripEmojis(e.target.value), type: 'text' } }); setErrorMotivo(''); }}
                rows={2}
                maxLength={MAX_LARGO_MOTIVO_CANCELACION}
                aria-invalid={!!errorMotivo}
                placeholder="Ej. El cliente ya no quiere el servicio, no hay cobertura en la zona..."
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2 focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm resize-none"
              />
              {errorMotivo && <p role="alert" className="text-[11px] text-red-500 font-bold ml-1">{errorMotivo}</p>}
              <p className="text-[9px] text-zinc-400 ml-1">Se ve en la lista, el historial, ventas y los reportes.</p>
            </div>
          )}
          <TecnicoField
            variant="edit"
            wrapperClassName="col-span-2 space-y-1"
            idPrefix="ed"
            label="TÉCNICO ASIGNADO"
            value={editingTicket.tecnico}
            onChange={handleEditChange}
            disabled={isTecnico}
            technicians={technicians}
            showSuggestion={mostrarSugerencia}
            turnoSugerido={turnoSugerido}
            emptyOptionLabel="SIN ASIGNAR"
          />

          {mostrarSugerencia && (
            <TurnoSugeridoBanner
              wrapperClassName="col-span-2 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-2 text-[11px] text-zinc-700 dark:text-zinc-200"
              turnoSugerido={turnoSugerido}
            />
          )}
          <div className="col-span-2 space-y-1">
            <label htmlFor="ed-telefono" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">TELÉFONO<span className="text-red-600"> *</span></label>
            <TelefonosField
              id="ed-telefono"
              required
              disabled={isTecnico}
              value={editingTicket.telefono || ''}
              onChange={(value) => handleEditChange({ target: { name: 'telefono', value, type: 'text' } })}
              inputClassName="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <ContactoCliente telefono={editingTicket.telefono} nombre={editingTicket.nombre} className="col-span-2" />
          {!napEnSeccion && (
            <div className="col-span-2 space-y-1">
              <label htmlFor="ed-nap" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">NAP</label>
              <input id="ed-nap" type="text" maxLength="50" name="nap" value={editingTicket.nap || ''} onChange={handleEditChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors" />
            </div>
          )}
          <NapCoordenadasField
            variant="edit"
            idPrefix="ed"
            wrapperClassName="col-span-2 space-y-1"
            nap={napActual}
            value={editingTicket.napCoordenadas}
            onChange={handleNapCoordenadasChange}
            autoBuscar
            napsConocidas={napsConocidas}
          />
          <div className="col-span-2 space-y-1">
            <label htmlFor="ed-ubicacion" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">UBICACIÓN (Google Maps)</label>
            <input id="ed-ubicacion" disabled={isTecnico} type="text" inputMode="url" maxLength="300" name="ubicacion" placeholder="https://maps.app.goo.gl/..." value={editingTicket.ubicacion || ''} onChange={handleEditChange} aria-invalid={!!ubicacionParseada.error} className={`w-full bg-white dark:bg-zinc-950 border px-3 py-1.5 rounded-lg focus:ring-0 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${ubicacionParseada.error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-red-600'}`} />
            {ubicacionParseada.error && <p role="alert" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">{ubicacionParseada.error}</p>}
            {ubicacionParseada.valor && <a href={ubicacionParseada.valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-400 hover:underline ml-1"><MapPin className="w-3 h-3" aria-hidden="true" /> Cómo llegar</a>}
          </div>
          <div className="col-span-2 space-y-1">
            <label htmlFor="ed-potencia" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">POTENCIA ÓPTICA (dBm)</label>
            <input id="ed-potencia" type="text" inputMode="decimal" maxLength="7" name="potenciaDbm" placeholder="Ej. -19.5" value={editingTicket.potenciaDbm ?? ''} onChange={(e) => handleEditChange({ target: { name: 'potenciaDbm', value: e.target.value.replace(/[^0-9.,-]/g, ''), type: 'text' } })} aria-invalid={!!potenciaParseada.error} aria-describedby="ed-potencia-hint" className={`w-full bg-white dark:bg-zinc-950 border px-3 py-1.5 rounded-lg focus:ring-0 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${potenciaParseada.error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-red-600'}`} />
            {(potenciaParseada.error || potenciaEval) && (
              <p id="ed-potencia-hint" className={`text-[10px] font-bold ml-1 ${potenciaParseada.error ? 'text-red-600 dark:text-red-400' : potenciaEval.clase}`}>{potenciaParseada.error || potenciaEval.texto}</p>
            )}
          </div>
          {conDatosTecnico && (
            <DatosTecnicoEdicion
              instalacion={instalacionAlAbrir}
              form={datos}
              onChange={cambiarDatos}
              errores={datosErrores}
              finalizada={ordenAlAbrir.estado === 'FINALIZADO'}
              avisoSerial={esAdmin && ordenAlAbrir.estado === 'FINALIZADO'}
            />
          )}
          {esInstalacion && !isTecnico && (
            <PromotorField
              id="ed-promotora"
              value={editingTicket.promotora ?? promotoraDeOrden(editingTicket)}
              onChange={handleEditChange}
              wrapperClassName="col-span-2 space-y-1"
              labelClassName="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1"
              inputClassName="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors"
              ayuda="(con él lo ve el promotor)"
            />
          )}
          {faltabaPlantilla && (
            <div className="col-span-2 space-y-1">
              <label htmlFor="ed-plantilla" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">PLANTILLA DE LA PROMOTORA <span className="font-normal normal-case text-zinc-400">(pégala tal cual: sin ella no se puede copiar la plantilla de esta orden)</span></label>
              <textarea id="ed-plantilla" rows="4" name="plantillaOriginal" value={editingTicket.plantillaOriginal || ''} onChange={handleEditChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs font-mono text-zinc-900 dark:text-white shadow-sm transition-colors" placeholder="Pega aquí la plantilla tal como la envió la promotora..." />
            </div>
          )}
          {isTecnico ? (
            // El técnico no cambia lo que escribió la oficina: lo lee, y escribe lo suyo aparte.
            <>
              {editingTicket.observacion?.trim() && (
                <div className="col-span-2 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1 block">NOTA DE LA OFICINA</span>
                  <p className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{editingTicket.observacion}</p>
                </div>
              )}
              {devolucionPendiente(ordenAlAbrir) ? (
                // Orden devuelta: el reporte anterior solo se lee; el nuevo se escribe al pre-finalizar, para no mezclarlos.
                <div className="col-span-2 space-y-1">
                  {editingTicket.observacionTecnico?.trim() && (
                    <>
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1 block">TU REPORTE ANTERIOR</span>
                      <p className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{editingTicket.observacionTecnico}</p>
                    </>
                  )}
                  <p className="text-[9px] text-zinc-400 ml-1">La oficina te devolvió la orden: escribe tu nuevo reporte con el botón "Pre-finalizar" de la lista.</p>
                </div>
              ) : (
                <ObservacionTecnicoField wrapperClassName="col-span-2 space-y-1" idPrefix="ed" value={editingTicket.observacionTecnico || ''} onChange={handleEditChange} />
              )}
            </>
          ) : (
            <>
              <ObservacionField
                variant="edit"
                wrapperClassName="col-span-2 space-y-1"
                idPrefix="ed"
                value={editingTicket.observacion}
                checked={editingTicket.observacionInterna !== false}
                onChange={handleEditChange}
                etiqueta="OBSERVACIÓN DE LA OFICINA"
              />
              {conObservacionTecnico && (
                <ObservacionTecnicoField wrapperClassName="col-span-2 space-y-1" idPrefix="ed" value={editingTicket.observacionTecnico || ''} onChange={handleEditChange} />
              )}
            </>
          )}

          <div className="col-span-2 pt-2 mt-1 flex gap-2 justify-end border-t border-zinc-100 dark:border-zinc-800">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-1.5 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className={`px-6 py-1.5 text-white font-bold rounded-lg text-xs transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSubmitting && <Spinner />}{isSubmitting ? 'Guardando...' : 'Actualizar'}</button>
          </div>
        </form>
      </div>

      {showSinCoordenadas && (
        <ConfirmSinCoordenadasModal
          nap={napActual.trim()}
          textoConfirmar="Guardar la orden"
          onCancel={() => setShowSinCoordenadas(false)}
          onConfirm={confirmSinCoordenadasAndContinue}
        />
      )}

      {saltoCodigo && (
        <ConfirmCodigoAltoModal
          salto={saltoCodigo}
          isSubmitting={isSubmitting}
          onCancel={() => setSaltoCodigo(null)}
          onConfirm={confirmSaltoAndSave}
        />
      )}
    </Modal>
  );
}
