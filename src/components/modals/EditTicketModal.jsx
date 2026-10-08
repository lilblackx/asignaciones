import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { normalizarCoordenadasNap, normalizarUbicacion } from '../../utils/ubicacion';
import HistorialTimeline from '../HistorialTimeline';
import ContactoCliente from '../ContactoCliente';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';
import ConfirmCodigoAltoModal from './ConfirmCodigoAltoModal';
import ConfirmSinCoordenadasModal from './ConfirmSinCoordenadasModal';
import NapCoordenadasField from './NapCoordenadasField';
import TelefonosField from './TelefonosField';
import { TIPOS_POR_TRABAJO } from '../../constants';
import { evaluarPotencia, parsePotencia } from '../../utils/potencia';
import { CedulaField, ObservacionField, TecnicoField, TipoTrabajoField, TurnoSugeridoBanner } from './TicketFormFields';

export default function EditTicketModal({ editingTicket, handleEditChange, handleEditSubmit, verificarCodigoManual, technicians, napsConocidas, turnoSugerido, onClose, isTecnico = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saltoCodigo, setSaltoCodigo] = useState(null);
  const [showSinCoordenadas, setShowSinCoordenadas] = useState(false);

  const esInstalacion = editingTicket.tipoTrabajo?.toUpperCase().includes('INSTAL');
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
  const estadoItems = ['PENDIENTE', 'PRE-FINALIZADO', ...(isTecnico ? [] : ['FINALIZADO', 'CANCELADO'])].map(v => ({ value: v, label: v }));

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

  const guardar = async () => {
    setIsSubmitting(true);
    await handleEditSubmit({ preventDefault: () => {} });
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
  const faltanNapCoordenadas = !isTecnico && Boolean(editingTicket.nap?.trim()) && !napCoordenadasParseadas.valor;

  const onSubmit = (e) => {
    e.preventDefault();
    if (potenciaParseada.error || ubicacionParseada.error || napCoordenadasParseadas.error || isSubmitting) return;
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
            <label htmlFor="ed-nombre" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">NOMBRE</label>
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
            <label htmlFor="ed-direccion" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">DIRECCIÓN</label>
            <input id="ed-direccion" disabled={isTecnico} required type="text" maxLength="200" name="direccion" value={editingTicket.direccion || ''} onChange={handleEditChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
          <div className="col-span-1 space-y-1">
            <label htmlFor="ed-fechaprog" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">F. PROG (Opcional)</label>
            <input id="ed-fechaprog" disabled={isTecnico} type="date" name="fechaProgramada" value={editingTicket.fechaProgramada || ''} onChange={handleEditChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors [color-scheme:light] dark:[color-scheme:dark] disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
          <div className="col-span-1 space-y-1">
            <label htmlFor="ed-codigo" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">CÓDIGO</label>
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
          </div>
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
            <label htmlFor="ed-telefono" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">TELÉFONO</label>
            <TelefonosField
              id="ed-telefono"
              disabled={isTecnico}
              value={editingTicket.telefono || ''}
              onChange={(value) => handleEditChange({ target: { name: 'telefono', value, type: 'text' } })}
              inputClassName="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <ContactoCliente telefono={editingTicket.telefono} nombre={editingTicket.nombre} className="col-span-2" />
          <div className="col-span-2 space-y-1">
            <label htmlFor="ed-nap" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">NAP</label>
            <input id="ed-nap" type="text" maxLength="50" name="nap" value={editingTicket.nap || ''} onChange={handleEditChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors" />
          </div>
          <NapCoordenadasField
            variant="edit"
            idPrefix="ed"
            wrapperClassName="col-span-2 space-y-1"
            nap={editingTicket.nap}
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
          <ObservacionField
            variant="edit"
            wrapperClassName="col-span-2 space-y-1"
            idPrefix="ed"
            value={editingTicket.observacion}
            checked={editingTicket.observacionInterna !== false}
            onChange={handleEditChange}
          />

          <div className="col-span-2 mt-1">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1 block mb-1">HISTORIAL DE LA ORDEN</span>
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3">
              <HistorialTimeline ticket={editingTicket} compact />
            </div>
          </div>

          <div className="col-span-2 pt-2 mt-1 flex gap-2 justify-end border-t border-zinc-100 dark:border-zinc-800">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-1.5 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className={`px-6 py-1.5 text-white font-bold rounded-lg text-xs transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSubmitting ? 'Guardando...' : 'Actualizar'}</button>
          </div>
        </form>
      </div>

      {showSinCoordenadas && (
        <ConfirmSinCoordenadasModal
          nap={editingTicket.nap.trim()}
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
