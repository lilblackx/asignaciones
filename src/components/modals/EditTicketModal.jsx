import { observacionParaTecnico } from '../../utils/observacion';
import { useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { MENSAJE_UBICACION_OBLIGATORIA, normalizarCoordenadasNap, normalizarUbicacion, ubicacionObligatoria } from '../../utils/ubicacion';
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
import { todasLasOrdenes } from '../../utils/gestionTecnicos';
import { CedulaField, GarantiaField, ObservacionField, ObservacionTecnicoField, TecnicoField, TipoTrabajoField, TurnoSugeridoBanner } from './TicketFormFields';
import { promotoraDeOrden, tipoUsaPlantillaPromotora } from '../../utils/whatsapp';
import { claveNombre, MENSAJE_PROMOTOR_CAMPO } from '../../utils/promotora';
import { devolucionPendiente } from '../../utils/devolucion';
import { MAX_LARGO_MOTIVO_CANCELACION, cancelaAhora, parseMotivoCancelacion } from '../../utils/cancelacion';
import { stripEmojis } from '../../utils/sanitizeInput';
import Spinner from '../Spinner';
import { CAMPO_FECHA_ORDEN, CAMPO_ORDEN, SELECTOR_ORDEN, SELECTOR_ORDEN_NORMAL, claseCampo } from '../estilos';
import CampoFecha from '../CampoFecha';
import CobroAcordadoField from './CobroAcordadoField';
import { COBRO_PAGADA, formularioCobroAcordado, resolverCobroAcordado } from '../../utils/cobroAcordado';
import { llevaCobro } from '../../utils/cobro';
import BotonCerrar from '../BotonCerrar';

const OBLIGATORIO = <span className="font-normal text-red-700 dark:text-red-400"> (obligatorio)</span>;
const OPCIONAL = <span className="font-normal text-muted-foreground"> (opcional)</span>;
const ETIQUETA = 'text-xs font-semibold text-muted-foreground ml-1';
const AVISO = 'text-xs font-bold text-red-700 dark:text-red-400 ml-1';
// El título de cada grupo de campos. Los grupos van separados por una línea fina; el primero no la lleva.
function Seccion({ primera = false, children }) {
  return <h3 className={`col-span-2 text-sm font-black text-foreground ${primera ? '' : 'pt-3 mt-1 border-t border-border'}`}>{children}</h3>;
}

export default function EditTicketModal({ editingTicket, handleEditChange, handleEditSubmit, verificarCodigoManual, technicians, tickets = [], reports = [], napsConocidas, turnoSugerido, cuentasEmpresa = [], onClose, isTecnico = false, esAdmin = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Lo obligatorio lo exige el navegador (`required`), pero su burbuja no se parece al resto de la app: se cancela, el cursor va al primer campo con falta,
  // cada campo dice su falta en texto y abajo queda un aviso general (igual que en Nueva asignación).
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const primerInvalido = useRef(null);
  const [mensajeInvalido, setMensajeInvalido] = useState('');
  const alInvalidar = (e) => {
    e.preventDefault();
    setIntentoGuardar(true);
    if (primerInvalido.current) return;
    primerInvalido.current = e.target;
    setMensajeInvalido('Revisa los campos marcados en rojo.');
    setTimeout(() => { primerInvalido.current?.focus(); primerInvalido.current = null; }, 0);
  };
  const veFalta = (falta) => intentoGuardar && falta;
  const faltaNombre = !isTecnico && !String(editingTicket.nombre || '').trim();
  const faltaCedula = !isTecnico && !String(editingTicket.cedula || '').trim();
  const faltaDireccion = !isTecnico && !String(editingTicket.direccion || '').trim();
  const faltaCodigo = !isTecnico && !String(editingTicket.codigo || '').trim();
  const faltaTelefono = !isTecnico && !String(editingTicket.telefono || '').trim();
  // Los datos del pago cuando se elige el cobro acordado "Pagada" (el formulario de pago los entrega al guardar).
  const pagoRef = useRef(null);
  // Las órdenes entre las que se busca la original de una garantía (vivas y de los cierres cargados).
  const ordenesGarantia = useMemo(() => (isTecnico ? [] : todasLasOrdenes(tickets, reports)), [isTecnico, tickets, reports]);
  const [saltoCodigo, setSaltoCodigo] = useState(null);
  const [showSinCoordenadas, setShowSinCoordenadas] = useState(false);
  const [errorMotivo, setErrorMotivo] = useState('');
  const [intentoSinUbicacion, setIntentoSinUbicacion] = useState(false);
  // Cobro acordado con el cliente (solo la oficina, mientras la orden sigue abierta): se edita aparte y se guarda junto con lo demás.
  const [cobroSel, setCobroSel] = useState(() => formularioCobroAcordado(editingTicket));
  const [intentoCobro, setIntentoCobro] = useState(false);
  const pideCobroAcordado = !isTecnico && llevaCobro(editingTicket) && editingTicket.estado !== 'FINALIZADO' && editingTicket.estado !== 'CANCELADO';
  const cobroResuelto = pideCobroAcordado ? resolverCobroAcordado(cobroSel) : null;

  const esInstalacion = editingTicket.tipoTrabajo?.toUpperCase().includes('INSTAL');
  const faltaPromotor = !isTecnico && esInstalacion && !claveNombre(editingTicket.promotora ?? promotoraDeOrden(editingTicket) ?? '');
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
  // Una instalación abierta no se guarda sin ubicación del cliente (los técnicos no: ellos solo pre-finalizan).
  const faltaUbicacion = !isTecnico && ubicacionObligatoria(editingTicket) && ubicacionParseada.vacio;
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
    try {
      let cobro = cobroResuelto;
      // "Pagada" recién elegida: el formulario de pago valida y entrega los datos (si falta algo muestra el error y no se guarda).
      if (pideCobroAcordado && cobroSel.modo === COBRO_PAGADA && !cobroSel.pagada?.pago) {
        const r = await pagoRef.current?.obtener();
        if (!r || r.tipo !== 'pago') return;
        cobro = resolverCobroAcordado(cobroSel, r.valor);
      }
      const extra = { ...(datosAGuardar() || {}), ...(cobro && !cobro.error ? { cobroAcordado: cobro.valor } : {}) };
      await handleEditSubmit({ preventDefault: () => {} }, Object.keys(extra).length > 0 ? extra : null);
    } finally {
      setIsSubmitting(false);
    }
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
    if (cobroResuelto?.error) {
      setIntentoCobro(true);
      document.getElementById('ed-cobro-monto')?.focus();
      return;
    }
    // Un dato con error: el cursor va al primero, en el orden del formulario.
    const campoConError = napCoordenadasParseadas.error ? 'ed-nap-coords' : ubicacionParseada.error || faltaUbicacion ? 'ed-ubicacion' : potenciaParseada.error ? 'ed-potencia' : null;
    if (campoConError) {
      setIntentoSinUbicacion(true);
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
      <div className="bg-card rounded-card shadow-2xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden border border-border">
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center gap-3 shrink-0">
          <div>
            <h2 className="text-sm font-black text-white">{isTecnico ? 'DETALLES / PRE-FINALIZAR' : 'EDITAR ORDEN'}</h2>
            <p className="text-xs text-zinc-300 mt-1">Cliente: {editingTicket.nombre}</p>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>
        <form onSubmit={onSubmit} onInvalidCapture={alInvalidar} onInput={() => { if (mensajeInvalido) setMensajeInvalido(''); }} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-2 gap-x-2 gap-y-3 content-start">
          <Seccion primera>Cliente</Seccion>
          <div className="col-span-2 space-y-0.5">
            <label htmlFor="ed-nombre" className={ETIQUETA}>Nombre{OBLIGATORIO}</label>
            <input id="ed-nombre" disabled={isTecnico} required type="text" maxLength="100" name="nombre" value={editingTicket.nombre || ''} onChange={handleEditChange} aria-invalid={veFalta(faltaNombre) ? 'true' : undefined} className={claseCampo('compacto', veFalta(faltaNombre) ? 'error' : 'normal')} />
            {veFalta(faltaNombre) && <p role="alert" className={AVISO}>Escribe el nombre del cliente.</p>}
          </div>
          <CedulaField
            variant="create"
            wrapperClassName="col-span-2 space-y-0.5"
            idPrefix="ed"
            tipoDocumento={editingTicket.tipoDocumento || 'V'}
            cedula={editingTicket.cedula || ''}
            onChange={handleEditChange}
            disabled={isTecnico}
            error={veFalta(faltaCedula) ? 'Escribe la cédula o el RIF del cliente.' : ''}
          />
          <div className="col-span-2 space-y-0.5">
            <label htmlFor="ed-telefono" className={ETIQUETA}>Teléfono{OBLIGATORIO}</label>
            <TelefonosField
              id="ed-telefono"
              required
              disabled={isTecnico}
              value={editingTicket.telefono || ''}
              onChange={(value) => handleEditChange({ target: { name: 'telefono', value, type: 'text' } })}
              inputClassName={claseCampo('compacto', veFalta(faltaTelefono) ? 'error' : 'normal')}
            />
            {veFalta(faltaTelefono) && <p role="alert" className={AVISO}>Escribe el teléfono del cliente.</p>}
          </div>
          <Seccion>Trabajo</Seccion>
          <TipoTrabajoField
            variant="create"
            wrapperClassName="col-span-1 space-y-0.5"
            idPrefix="ed"
            value={editingTicket.tipoTrabajo || ''}
            onChange={handleTipoTrabajoChange}
            disabled={isTecnico}
          />
          <div className="col-span-1 space-y-0.5">
            <label htmlFor="ed-falla" className={ETIQUETA}>Tipo</label>
            <SelectMenu
              id="ed-falla"
              ariaLabel="Tipo"
              disabled={isTecnico || opcionesTipo.length === 0}
              value={editingTicket.falla || ''}
              onChange={(v) => handleEditChange({ target: { name: 'falla', value: v, type: 'text' } })}
              items={tipoItems}
              className={SELECTOR_ORDEN_NORMAL}
              chevronClassName="w-3.5 h-3.5 right-2"
            />
          </div>
          <div className="col-span-1 space-y-0.5">
            <label htmlFor="ed-codigo" className={ETIQUETA}>Código{OBLIGATORIO}</label>
            <input id="ed-codigo" disabled={isTecnico} required type="text" maxLength="7" name="codigo" value={editingTicket.codigo} onChange={handleEditChange} aria-invalid={veFalta(faltaCodigo) ? 'true' : undefined} className={`${claseCampo('compacto', veFalta(faltaCodigo) ? 'error' : 'normal')} uppercase`} />
            {veFalta(faltaCodigo) && <p role="alert" className={AVISO}>Escribe el código de la orden.</p>}
          </div>
          <div className="col-span-1 space-y-0.5">
            <label htmlFor="ed-fechaprog" className={ETIQUETA}>Programada{OPCIONAL}</label>
            <CampoFecha id="ed-fechaprog" ariaLabel="Fecha programada" vacio="Sin fecha" disabled={isTecnico} valor={editingTicket.fechaProgramada || ''} onChange={(v) => handleEditChange({ target: { name: 'fechaProgramada', value: v, type: 'text' } })} permitirBorrar clase={CAMPO_FECHA_ORDEN} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <label htmlFor="ed-estado" className={ETIQUETA}>Estado</label>
            <SelectMenu
              id="ed-estado"
              ariaLabel="Estado"
              disabled={isTecnico}
              value={editingTicket.estado}
              onChange={(v) => handleEditChange({ target: { name: 'estado', value: v, type: 'text' } })}
              items={estadoItems}
              className={SELECTOR_ORDEN}
              chevronClassName="w-3.5 h-3.5 right-2"
            />
            {isTecnico && <p className="text-xs text-muted-foreground ml-1">Usa el botón "Pre-finalizar" de la lista para cambiar el estado.</p>}
            {!isTecnico && editingTicket.estado !== 'FINALIZADO' && <p className="text-xs text-muted-foreground ml-1">Para finalizar usa "Finalizar" o "Aprobar" en la lista: ahí se elige el cobro resultante.</p>}
          </div>
          {!isTecnico && editingTicket.estado === 'CANCELADO' && (
            <div className="col-span-2 space-y-0.5">
              <label htmlFor="ed-motivo-cancelacion" className={ETIQUETA}>
                Motivo de la cancelación{cancelaAhora(ordenAlAbrir, editingTicket) && OBLIGATORIO}
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
                className={`${CAMPO_ORDEN} resize-none`}
              />
              {errorMotivo && <p role="alert" className="text-xs text-red-700 dark:text-red-400 font-bold ml-1">{errorMotivo}</p>}
              <p className="text-xs text-muted-foreground ml-1">Se ve en la lista, el historial, ventas y los reportes.</p>
            </div>
          )}
          <TecnicoField
            variant="create"
            wrapperClassName="col-span-2 space-y-0.5"
            idPrefix="ed"
            label="Técnico asignado"
            value={editingTicket.tecnico}
            onChange={handleEditChange}
            disabled={isTecnico}
            technicians={technicians}
            showSuggestion={mostrarSugerencia}
            turnoSugerido={turnoSugerido}
            emptyOptionLabel="SIN ASIGNAR"
          />

          {!isTecnico && (
            <GarantiaField
              wrapperClassName="col-span-2"
              idPrefix="ed"
              suave
              value={editingTicket.garantiaDe || null}
              onChange={(value) => handleEditChange({ target: { name: 'garantiaDe', value, type: 'garantia' } })}
              ordenes={ordenesGarantia}
              idOrden={editingTicket.id}
              tecnico={editingTicket.tecnico}
              cedula={editingTicket.cedula}
            />
          )}

          {mostrarSugerencia && (
            <TurnoSugeridoBanner
              wrapperClassName="col-span-2 flex items-center gap-2 bg-sunken rounded-campo px-3 py-2 text-xs text-card-foreground"
              turnoSugerido={turnoSugerido}
            />
          )}
          {esInstalacion && !isTecnico && (
            <PromotorField
              suave
              id="ed-promotora"
              value={editingTicket.promotora ?? promotoraDeOrden(editingTicket)}
              onChange={handleEditChange}
              wrapperClassName="col-span-2 space-y-0.5"
              labelClassName={ETIQUETA}
              inputClassName={claseCampo('compacto', veFalta(faltaPromotor) ? 'error' : 'normal')}
              ayuda="(con él lo ve el promotor)"
              error={veFalta(faltaPromotor) ? MENSAJE_PROMOTOR_CAMPO : ''}
            />
          )}
          {faltabaPlantilla && (
            <div className="col-span-2 space-y-0.5">
              <label htmlFor="ed-plantilla" className={ETIQUETA}>Plantilla de la promotora <span className="font-normal text-muted-foreground">{esInstalacion ? '(pégala tal cual: sin ella no se puede copiar la plantilla de esta orden)' : '(opcional: sin ella la plantilla sale en el formato de la app)'}</span></label>
              <textarea id="ed-plantilla" rows="4" name="plantillaOriginal" value={editingTicket.plantillaOriginal || ''} onChange={handleEditChange} className={`${CAMPO_ORDEN} font-mono`} placeholder="Pega aquí la plantilla tal como la envió la promotora..." />
            </div>
          )}
          <Seccion>Ubicación y red</Seccion>
          <div className="col-span-2 space-y-0.5">
            <label htmlFor="ed-direccion" className={ETIQUETA}>Dirección{OBLIGATORIO}</label>
            <input id="ed-direccion" disabled={isTecnico} required type="text" maxLength="200" name="direccion" value={editingTicket.direccion || ''} onChange={handleEditChange} aria-invalid={veFalta(faltaDireccion) ? 'true' : undefined} className={claseCampo('compacto', veFalta(faltaDireccion) ? 'error' : 'normal')} />
            {veFalta(faltaDireccion) && <p role="alert" className={AVISO}>Escribe la dirección del cliente.</p>}
          </div>
          <div className="col-span-2 space-y-0.5">
            <label htmlFor="ed-ubicacion" className={ETIQUETA}>Ubicación (Google Maps){!isTecnico && ubicacionObligatoria(editingTicket) && OBLIGATORIO}</label>
            <input id="ed-ubicacion" disabled={isTecnico} type="text" inputMode="url" maxLength="300" name="ubicacion" placeholder="https://maps.app.goo.gl/..." value={editingTicket.ubicacion || ''} onChange={handleEditChange} aria-invalid={!!ubicacionParseada.error || (faltaUbicacion && intentoSinUbicacion)} className={claseCampo('compacto', ubicacionParseada.error || (faltaUbicacion && intentoSinUbicacion) ? 'error' : 'normal')} />
            {faltaUbicacion && intentoSinUbicacion && <p role="alert" className="text-xs font-bold text-red-700 dark:text-red-400 ml-1">{MENSAJE_UBICACION_OBLIGATORIA}</p>}
            {ubicacionParseada.error && <p role="alert" className="text-xs font-bold text-red-700 dark:text-red-400 ml-1">{ubicacionParseada.error}</p>}
            {ubicacionParseada.valor && <a href={ubicacionParseada.valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 max-lg:min-h-11 text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline ml-1"><MapPin className="w-3 h-3" aria-hidden="true" /> Cómo llegar</a>}
          </div>
          {!napEnSeccion && (
            <div className="col-span-2 space-y-0.5">
              <label htmlFor="ed-nap" className={ETIQUETA}>NAP</label>
              <input id="ed-nap" type="text" maxLength="50" name="nap" value={editingTicket.nap || ''} onChange={handleEditChange} className={CAMPO_ORDEN} />
            </div>
          )}
          <NapCoordenadasField
            idPrefix="ed"
            wrapperClassName="col-span-2 space-y-0.5"
            nap={napActual}
            value={editingTicket.napCoordenadas}
            onChange={handleNapCoordenadasChange}
            autoBuscar
            napsConocidas={napsConocidas}
          />
          <div className="col-span-2 space-y-0.5">
            <label htmlFor="ed-potencia" className={ETIQUETA}>Potencia óptica (dBm)</label>
            <input id="ed-potencia" type="text" inputMode="decimal" maxLength="7" name="potenciaDbm" placeholder="Ej. -19.5" value={editingTicket.potenciaDbm ?? ''} onChange={(e) => handleEditChange({ target: { name: 'potenciaDbm', value: e.target.value.replace(/[^0-9.,-]/g, ''), type: 'text' } })} aria-invalid={!!potenciaParseada.error} aria-describedby="ed-potencia-hint" className={claseCampo('compacto', potenciaParseada.error ? 'error' : 'normal')} />
            {(potenciaParseada.error || potenciaEval) && (
              <p id="ed-potencia-hint" className={`text-xs font-bold ml-1 ${potenciaParseada.error ? 'text-red-700 dark:text-red-400' : potenciaEval.clase}`}>{potenciaParseada.error || potenciaEval.texto}</p>
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
              ticketMetros={ordenAlAbrir.metrosCable ?? null}
            />
          )}
          <Seccion>{isTecnico ? 'Observaciones' : 'Cobro y observaciones'}</Seccion>
          {isTecnico ? (
            // El técnico no cambia lo que escribió la oficina: lo lee, y escribe lo suyo aparte.
            <>
              {observacionParaTecnico(editingTicket) && (
                <div className="col-span-2 space-y-0.5">
                  <span className={`${ETIQUETA} block`}>Nota de la oficina</span>
                  <p className="w-full bg-sunken px-3 py-2 rounded-campo text-xs text-card-foreground whitespace-pre-wrap break-words">{observacionParaTecnico(editingTicket)}</p>
                </div>
              )}
              {devolucionPendiente(ordenAlAbrir) ? (
                // Orden devuelta: el reporte anterior solo se lee; el nuevo se escribe al pre-finalizar, para no mezclarlos.
                <div className="col-span-2 space-y-0.5">
                  {editingTicket.observacionTecnico?.trim() && (
                    <>
                      <span className={`${ETIQUETA} block`}>Tu reporte anterior</span>
                      <p className="w-full bg-sunken px-3 py-2 rounded-campo text-xs text-card-foreground whitespace-pre-wrap break-words">{editingTicket.observacionTecnico}</p>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground ml-1">La oficina te devolvió la orden: escribe tu nuevo reporte con el botón "Pre-finalizar" de la lista.</p>
                </div>
              ) : (
                <ObservacionTecnicoField wrapperClassName="col-span-2 space-y-0.5" idPrefix="ed" value={editingTicket.observacionTecnico || ''} onChange={handleEditChange} />
              )}
            </>
          ) : (
            <>
              {pideCobroAcordado && (
                <CobroAcordadoField
                  idPrefix="ed"
                  wrapperClassName="col-span-2 space-y-0.5"
                  value={cobroSel}
                  onChange={setCobroSel}
                  error={intentoCobro ? cobroResuelto?.error || '' : ''}
                  cuentasEmpresa={cuentasEmpresa}
                  pagoRef={pagoRef}
                  permitirPagada
                />
              )}
              <ObservacionField
                variant="create"
                wrapperClassName="col-span-2 space-y-0.5"
                idPrefix="ed"
                value={editingTicket.observacion}
                checked={editingTicket.observacionInterna !== false}
                onChange={handleEditChange}
                etiqueta="Observación de la oficina"
              />
              {conObservacionTecnico && (
                <ObservacionTecnicoField wrapperClassName="col-span-2 space-y-0.5" idPrefix="ed" value={editingTicket.observacionTecnico || ''} onChange={handleEditChange} />
              )}
            </>
          )}

          </div>

          <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
            <p role="alert" className="min-w-0 text-xs font-bold text-red-700 dark:text-red-400">{mensajeInvalido}</p>
            <div className="flex gap-2 shrink-0 ml-auto">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-card-foreground text-sm font-bold bg-card border-2 border-input hover:bg-secondary rounded-boton transition-colors">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className={`min-w-[8.5rem] px-4 py-2 text-white text-sm font-bold rounded-boton transition-colors ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover shadow-boton'}`}>{isSubmitting && <Spinner />}{isSubmitting ? 'Guardando...' : 'Actualizar'}</button>
            </div>
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
