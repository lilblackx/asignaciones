import { useMemo, useState } from 'react';
import { AlertTriangle, MapPin, Repeat, Star, X } from 'lucide-react';
import { normalizarCoordenadasNap, normalizarUbicacion } from '../../utils/ubicacion';
import { TIPOS_POR_TRABAJO } from '../../constants';
import { REINCIDENCIA_MUY_RECIENTE_DIAS, VENTANA_REINCIDENCIA_DIAS, aplanarArchivados, buscarHistorialCliente, textoHace } from '../../utils/reincidencia';
import { parseInstalacionTemplate, tipoUsaPlantillaPromotora } from '../../utils/whatsapp';
import { buscarTecnicoPorNombre, esVentaDelTecnico } from '../../utils/tecnicoVenta';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';
import ConfirmCodigoAltoModal from './ConfirmCodigoAltoModal';
import ConfirmSinCoordenadasModal from './ConfirmSinCoordenadasModal';
import { ClienteSmartOltIcono, ClienteSmartOltMensaje } from './ClienteSmartOltField';
import { useClienteSmartOlt } from '../../hooks/useClienteSmartOlt';
import NapCoordenadasField from './NapCoordenadasField';
import TelefonosField from './TelefonosField';
import { CedulaField, ObservacionField, TecnicoField, TipoTrabajoField, TurnoSugeridoBanner } from './TicketFormFields';

export default function CreateTicketModal({ formData, handleCreateChange, handleCreateSubmit, verificarCodigoManual, technicians, tickets, reports = [], napsConocidas, turnoSugerido, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);
  const [saltoCodigo, setSaltoCodigo] = useState(null);
  const [showSinCoordenadas, setShowSinCoordenadas] = useState(false);
  const clienteSmartOlt = useClienteSmartOlt({
    cedula: formData.cedula,
    formData,
    onApply: (campos) => Object.entries(campos).forEach(([name, value]) => handleCreateChange({ target: { name, value, type: 'text' } })),
  });

  const esInstalacion = formData.tipoTrabajo?.toUpperCase().includes('INSTAL');
  const opcionesTipo = TIPOS_POR_TRABAJO[formData.tipoTrabajo] || [];
  const tipoItems = [
    { value: '', label: opcionesTipo.length === 0 ? 'N/A' : 'Seleccione...' },
    ...opcionesTipo.map(t => ({ value: t, label: t }))
  ];

  const handleTipoTrabajoChange = (e) => {
    handleCreateChange(e);
    const nuevasOpciones = TIPOS_POR_TRABAJO[e.target.value] || [];
    if (!nuevasOpciones.includes(formData.falla)) {
      handleCreateChange({ target: { name: 'falla', value: '', type: 'text' } });
    }
  };

  // Pega la plantilla tal cual la manda la promotora: se guarda cruda (para
  // copiarla después sin tocarle nada más que el correlativo y el técnico) y
  // de paso rellena los campos que ya registramos en Asignaciones.
  const handlePlantillaChange = (e) => {
    const texto = e.target.value;
    handleCreateChange({ target: { name: 'plantillaOriginal', value: texto, type: 'text' } });
    const campos = parseInstalacionTemplate(texto);
    // Si "Instalador:" ya trae un técnico registrado, la venta es suya: se le
    // asigna de una vez (sin gastar el turno). Solo la primera vez que se detecta,
    // para no pisar un cambio manual si siguen editando la plantilla.
    if (esInstalacion) {
      const vendedor = buscarTecnicoPorNombre(campos.instalador, technicians);
      if (vendedor && formData.ventaTecnico !== vendedor.name) {
        handleCreateChange({ target: { name: 'tecnico', value: vendedor.name, type: 'text' } });
        handleCreateChange({ target: { name: 'ventaTecnico', value: vendedor.name, type: 'text' } });
      } else if (!vendedor && formData.ventaTecnico) {
        handleCreateChange({ target: { name: 'ventaTecnico', value: '', type: 'text' } });
      }
    }
    delete campos.instalador;
    Object.entries(campos).forEach(([name, value]) => {
      // "Servicio a contratar" solo se traduce a TIPO para instalaciones (MRTV,
      // MTV...); una reconexión no tiene esa lista.
      if (name === 'falla' && !esInstalacion) return;
      handleCreateChange({ target: { name, value, type: 'text' } });
    });
  };

  const archivados = useMemo(() => aplanarArchivados(reports), [reports]);
  const historial = useMemo(
    () => buscarHistorialCliente(formData.cedula, tickets, archivados),
    [formData.cedula, tickets, archivados]
  );
  // Orden todavía abierta del mismo cliente: pide confirmación antes de crear.
  const ticketDuplicado = historial.abiertas[0] || null;
  // Reincidencia: solo tiene sentido si esto no es una instalación nueva.
  const reincidencias = esInstalacion ? [] : historial.recientes;
  const reincidenciaMuyReciente = reincidencias.some(r => r.dias <= REINCIDENCIA_MUY_RECIENTE_DIAS);

  const doSubmit = async () => {
    setIsSubmitting(true);
    await handleCreateSubmit({ preventDefault: () => {} });
    setIsSubmitting(false);
  };

  const ubicacionParseada = normalizarUbicacion(formData.ubicacion);
  const napCoordenadasParseadas = normalizarCoordenadasNap(formData.napCoordenadas);

  const handleNapCoordenadasChange = (value) => {
    handleCreateChange({ target: { name: 'napCoordenadas', value, type: 'text' } });
  };

  // Último paso antes de guardar: un código manual que se salta números pide confirmación.
  const verificarCodigoYGuardar = async () => {
    setVerificandoCodigo(true);
    const salto = await verificarCodigoManual(formData.tipoTrabajo, formData.codigo);
    setVerificandoCodigo(false);
    if (salto) {
      setSaltoCodigo(salto);
      return;
    }
    doSubmit();
  };

  const continuarGuardado = () => {
    if (ticketDuplicado) {
      setShowDuplicateConfirm(true);
      return;
    }
    verificarCodigoYGuardar();
  };

  // Con NAP escrita pero sin coordenadas, avisa y deja que el usuario decida.
  const faltanNapCoordenadas = Boolean(formData.nap?.trim()) && !napCoordenadasParseadas.valor;

  const onSubmit = (e) => {
    e.preventDefault();
    if (ubicacionParseada.error || napCoordenadasParseadas.error || verificandoCodigo) return;
    if (faltanNapCoordenadas) {
      setShowSinCoordenadas(true);
      return;
    }
    continuarGuardado();
  };

  const confirmSinCoordenadasAndContinue = () => {
    setShowSinCoordenadas(false);
    continuarGuardado();
  };

  const confirmDuplicateAndSubmit = () => {
    setShowDuplicateConfirm(false);
    verificarCodigoYGuardar();
  };

  const confirmSaltoAndSubmit = () => {
    setSaltoCodigo(null);
    doSubmit();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center">
          <h2 className="text-sm font-black text-white">NUEVA ASIGNACIÓN</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={onSubmit} className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="col-span-1 space-y-0.5">
            <label htmlFor="tk-fecha" className="text-[10px] font-bold text-zinc-500 ml-1">FECHA</label>
            <input id="tk-fecha" readOnly type="text" name="fecha" value={formData.fecha} className="w-full bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs text-zinc-500 dark:text-zinc-400 cursor-default" />
          </div>
          <div className="col-span-1 space-y-0.5">
            <label htmlFor="tk-codigo" className="text-[10px] font-bold text-zinc-500 ml-1">CÓDIGO</label>
            <input id="tk-codigo" type="text" maxLength="7" name="codigo" placeholder="Auto" value={formData.codigo} onChange={handleCreateChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs uppercase placeholder:normal-case placeholder:text-zinc-400" />
          </div>
          <div className="col-span-2 sm:col-span-3 space-y-0.5">
            <label htmlFor="tk-fecha-prog" className="text-[10px] font-bold text-zinc-500 ml-1">FECHA PROGRAMADA <span className="font-normal normal-case text-zinc-400">(opcional)</span></label>
            <input id="tk-fecha-prog" type="date" name="fechaProgramada" value={formData.fechaProgramada} onChange={handleCreateChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-1.5 py-1.5 rounded text-xs [color-scheme:light] dark:[color-scheme:dark]" />
          </div>
          <CedulaField
            variant="create"
            wrapperClassName="col-span-2 sm:col-span-5 space-y-0.5"
            idPrefix="tk"
            tipoDocumento={formData.tipoDocumento}
            cedula={formData.cedula}
            onChange={handleCreateChange}
            extra={<ClienteSmartOltIcono cliente={clienteSmartOlt} />}
          />
          <ClienteSmartOltMensaje cliente={clienteSmartOlt} wrapperClassName="col-span-2 sm:col-span-5 -mt-1 space-y-0.5" />

          {/* !isSubmitting evita el falso positivo: al crear, el listener de
              Firestore trae el ticket recién creado (misma cédula, PENDIENTE)
              antes de que este modal termine de cerrarse, y se compara consigo mismo. */}
          {ticketDuplicado && !isSubmitting && (
            <div className="col-span-2 sm:col-span-5 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Ya existe una orden <strong>{ticketDuplicado.estado}</strong> con esta cédula: <strong>{ticketDuplicado.codigo || 'S/C'}</strong> — {ticketDuplicado.nombre}{ticketDuplicado.tecnico ? ` (${ticketDuplicado.tecnico})` : ''}. Puedes seguir creando igual si es una avería distinta.</span>
            </div>
          )}

          {reincidencias.length > 0 && !isSubmitting && (
            <div role="status" className={`col-span-2 sm:col-span-5 flex items-start gap-2 rounded px-2.5 py-2 text-[11px] border ${reincidenciaMuyReciente ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300'}`}>
              <Repeat className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  <strong>{reincidenciaMuyReciente ? `Reincidencia reciente (menos de ${REINCIDENCIA_MUY_RECIENTE_DIAS} días)` : 'Cliente con órdenes recientes'}:</strong>{' '}
                  {reincidencias.length === 1 ? 'tuvo 1 orden finalizada' : `tuvo ${reincidencias.length} órdenes finalizadas`} en los últimos {VENTANA_REINCIDENCIA_DIAS} días.
                </p>
                <ul className="list-disc pl-4">
                  {reincidencias.slice(0, 3).map(({ ticket, dias }) => (
                    <li key={ticket.id}>
                      <strong>{ticket.codigo || 'S/C'}</strong> · {ticket.tipoTrabajo}{ticket.falla ? ` (${ticket.falla})` : ''} · {textoHace(dias)}{ticket.tecnico ? ` · ${ticket.tecnico}` : ''}
                    </li>
                  ))}
                </ul>
                {reincidencias.length > 3 && <p>y {reincidencias.length - 3} más.</p>}
              </div>
            </div>
          )}

          <div className="col-span-2 sm:col-span-5 space-y-0.5">
            <label htmlFor="tk-nombre" className="text-[10px] font-bold text-zinc-500 ml-1">NOMBRE</label>
            <input id="tk-nombre" required type="text" maxLength="100" name="nombre" value={formData.nombre} onChange={handleCreateChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs" />
          </div>

          <TipoTrabajoField
            variant="create"
            wrapperClassName="col-span-1 sm:col-span-2 space-y-0.5"
            idPrefix="tk"
            value={formData.tipoTrabajo}
            onChange={handleTipoTrabajoChange}
          />
          <TecnicoField
            variant="create"
            wrapperClassName="col-span-1 sm:col-span-3 space-y-0.5"
            idPrefix="tk"
            label="TÉCNICO"
            value={formData.tecnico}
            onChange={handleCreateChange}
            technicians={technicians}
            showSuggestion={esInstalacion}
            turnoSugerido={turnoSugerido}
            emptyOptionLabel="N/A"
          />

          {esInstalacion && esVentaDelTecnico(formData.ventaTecnico, formData.tecnico) && (
            <div className="col-span-2 sm:col-span-5 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded px-2.5 py-2 text-[11px] text-emerald-800 dark:text-emerald-300">
              <Star className="w-3.5 h-3.5 shrink-0 fill-current" aria-hidden="true" />
              <span>Venta de <strong>{formData.tecnico}</strong>: se asigna directo y no consume el turno{turnoSugerido ? <> (el turno sugerido sigue siendo <strong>{turnoSugerido}</strong>)</> : null}.</span>
            </div>
          )}

          {esInstalacion && turnoSugerido && !esVentaDelTecnico(formData.ventaTecnico, formData.tecnico) && (
            <TurnoSugeridoBanner
              wrapperClassName="col-span-2 sm:col-span-5 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-2 text-[11px] text-zinc-700 dark:text-zinc-200"
              turnoSugerido={turnoSugerido}
            />
          )}

          {tipoUsaPlantillaPromotora(formData.tipoTrabajo) && (
            <div className="col-span-2 sm:col-span-5 space-y-0.5">
              <label htmlFor="tk-plantilla" className="text-[10px] font-bold text-zinc-500 ml-1">{esInstalacion ? 'PLANTILLA DE LA PROMOTORA' : 'PEGAR PLANTILLA'} <span className="font-normal normal-case text-zinc-400">(pega el texto completo, autocompleta los campos)</span></label>
              <textarea id="tk-plantilla" rows="4" value={formData.plantillaOriginal} onChange={handlePlantillaChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs font-mono" placeholder={esInstalacion ? 'Pega aquí la plantilla tal como la envió la promotora...' : 'Pega aquí la plantilla completa...'} />
            </div>
          )}

          <div className="col-span-1 sm:col-span-2 space-y-0.5">
            <label htmlFor="tk-falla" className="text-[10px] font-bold text-zinc-500 ml-1">TIPO</label>
            <SelectMenu
              id="tk-falla"
              ariaLabel="Tipo"
              disabled={opcionesTipo.length === 0}
              value={formData.falla}
              onChange={(v) => handleCreateChange({ target: { name: 'falla', value: v, type: 'text' } })}
              items={tipoItems}
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 pl-2 pr-7 py-1.5 rounded text-xs disabled:opacity-60 disabled:cursor-not-allowed"
              chevronClassName="w-3.5 h-3.5 right-2"
            />
          </div>
          <div className="col-span-1 sm:col-span-3 space-y-0.5">
            <label htmlFor="tk-direccion" className="text-[10px] font-bold text-zinc-500 ml-1">DIRECCIÓN</label>
            <input id="tk-direccion" required type="text" maxLength="200" name="direccion" value={formData.direccion} onChange={handleCreateChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs" />
          </div>

          <div className="col-span-2 sm:col-span-3 space-y-0.5">
            <label htmlFor="tk-telefono" className="text-[10px] font-bold text-zinc-500 ml-1">TELÉFONO</label>
            <TelefonosField
              id="tk-telefono"
              value={formData.telefono}
              onChange={(value) => handleCreateChange({ target: { name: 'telefono', value, type: 'text' } })}
              inputClassName="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs"
            />
          </div>
          <div className="col-span-2 sm:col-span-2 space-y-0.5">
            <label htmlFor="tk-nap" className="text-[10px] font-bold text-zinc-500 ml-1">NAP</label>
            <input id="tk-nap" type="text" maxLength="50" name="nap" value={formData.nap} onChange={handleCreateChange} className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs" />
          </div>

          <NapCoordenadasField
            variant="create"
            idPrefix="tk"
            wrapperClassName="col-span-2 sm:col-span-5 space-y-0.5"
            nap={formData.nap}
            value={formData.napCoordenadas}
            onChange={handleNapCoordenadasChange}
            autoBuscar
            napsConocidas={napsConocidas}
          />

          <div className="col-span-2 sm:col-span-5 space-y-0.5">
            <label htmlFor="tk-ubicacion" className="text-[10px] font-bold text-zinc-500 ml-1">UBICACIÓN <span className="font-normal normal-case text-zinc-400">(enlace de Google Maps o coordenadas, opcional)</span></label>
            <input id="tk-ubicacion" type="text" inputMode="url" maxLength="300" name="ubicacion" placeholder="https://maps.app.goo.gl/..." value={formData.ubicacion} onChange={handleCreateChange} aria-invalid={!!ubicacionParseada.error} className={`w-full bg-white dark:bg-zinc-950 border px-2 py-1.5 rounded text-xs ${ubicacionParseada.error ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-700'}`} />
            {ubicacionParseada.error && <p role="alert" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">{ubicacionParseada.error}</p>}
            {ubicacionParseada.valor && <a href={ubicacionParseada.valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-400 hover:underline ml-1"><MapPin className="w-3 h-3" aria-hidden="true" /> Probar enlace</a>}
          </div>

          <ObservacionField
            variant="create"
            wrapperClassName="col-span-2 sm:col-span-5 space-y-0.5"
            idPrefix="tk"
            value={formData.observacion}
            checked={formData.observacionInterna}
            onChange={handleCreateChange}
          />

          <div className="col-span-2 sm:col-span-5 pt-1 flex gap-2 justify-end mt-1">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-1.5 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs transition-colors">Cancelar</button>
            <button type="submit" disabled={isSubmitting || verificandoCodigo} className={`px-4 py-1.5 text-white font-bold rounded-lg text-xs shadow-md transition-colors ${isSubmitting || verificandoCodigo ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>

      {showSinCoordenadas && (
        <ConfirmSinCoordenadasModal
          nap={formData.nap.trim()}
          textoConfirmar="Crear la asignación"
          onCancel={() => setShowSinCoordenadas(false)}
          onConfirm={confirmSinCoordenadasAndContinue}
        />
      )}

      {saltoCodigo && (
        <ConfirmCodigoAltoModal
          salto={saltoCodigo}
          isSubmitting={isSubmitting}
          onCancel={() => setSaltoCodigo(null)}
          onConfirm={confirmSaltoAndSubmit}
        />
      )}

      {showDuplicateConfirm && ticketDuplicado && (
        <Modal onClose={() => setShowDuplicateConfirm(false)} zIndexClass="z-[70]">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center border border-zinc-300 dark:border-zinc-800">
            <div className="pt-6 pb-4 px-6 flex flex-col items-center">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full mb-4">
                <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-500" />
              </div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white mb-2">¿Cédula duplicada?</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">
                Ya existe una orden <strong>{ticketDuplicado.estado}</strong> con esta cédula: <strong>{ticketDuplicado.codigo || 'S/C'}</strong> — {ticketDuplicado.nombre}{ticketDuplicado.tecnico ? ` (${ticketDuplicado.tecnico})` : ''}. ¿Crear esta de todas formas?
              </p>
            </div>
            <div className="p-6 bg-zinc-50 dark:bg-zinc-950 flex gap-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setShowDuplicateConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={confirmDuplicateAndSubmit}
                disabled={isSubmitting}
                className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {isSubmitting ? 'Creando...' : 'Sí, crear igual'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
