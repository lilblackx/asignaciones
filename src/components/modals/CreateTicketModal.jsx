import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, MapPin, Repeat, Star } from 'lucide-react';
import { MENSAJE_UBICACION_OBLIGATORIA, normalizarCoordenadasNap, normalizarUbicacion } from '../../utils/ubicacion';
import { TIPOS_POR_TRABAJO } from '../../constants';
import { REINCIDENCIA_MUY_RECIENTE_DIAS, VENTANA_REINCIDENCIA_DIAS, aplanarArchivados, buscarHistorialCliente, textoHace } from '../../utils/reincidencia';
import { parseInstalacionTemplate, tipoUsaPlantillaPromotora } from '../../utils/whatsapp';
import { buscarTecnicoPorNombre, esVentaDelTecnico } from '../../utils/tecnicoVenta';
import { codigosParaGarantia, errorCodigoGarantia, esTipoGarantia, llevaCodigoDeOriginal, tecnicoDeOriginal } from '../../utils/garantia';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';
import CampoFecha from '../CampoFecha';
import ConfirmCodigoAltoModal from './ConfirmCodigoAltoModal';
import ConfirmSinCoordenadasModal from './ConfirmSinCoordenadasModal';
import { ClienteSmartOltBoton, ClienteSmartOltEstado, ClienteSmartOltMensaje } from './ClienteSmartOltField';
import { useClienteSmartOlt } from '../../hooks/useClienteSmartOlt';
import { todasLasOrdenes } from '../../utils/gestionTecnicos';
import NapCoordenadasField from './NapCoordenadasField';
import TelefonosField from './TelefonosField';
import PromotorField from './PromotorField';
import { CedulaField, GarantiaField, ObservacionField, TecnicoField, TipoTrabajoField, TurnoSugeridoBanner } from './TicketFormFields';
import Spinner from '../Spinner';
import CobroAcordadoField from './CobroAcordadoField';
import { COBRO_PAGADA, resolverCobroAcordado } from '../../utils/cobroAcordado';
import { llevaCobro } from '../../utils/cobro';
import { CAMPO_FECHA_ORDEN, CAMPO_ORDEN, claseCampo, claseSelector } from '../estilos';
import { MENSAJE_PROMOTOR_CAMPO, claveNombre } from '../../utils/promotora';
import Aviso from '../Aviso';
import BotonCerrar from '../BotonCerrar';
import { oracion } from '../../utils/oracion';
import { legible } from '../../utils/nombreTecnico';

const OBLIGATORIO = <span className="font-normal text-red-700 dark:text-red-400"> (obligatorio)</span>;
const OPCIONAL = <span className="font-normal text-muted-foreground"> (opcional)</span>;
const ETIQUETA = 'text-xs font-semibold text-muted-foreground ml-1';
const AVISO = 'text-xs font-bold text-red-700 dark:text-red-400 ml-1';
// El título de cada grupo de campos. Los grupos van separados por una línea fina; el primero no la lleva.
function Seccion({ primera = false, children }) {
  return <h3 className={`col-span-2 sm:col-span-5 text-sm font-black text-foreground ${primera ? '' : 'pt-3 mt-1 border-t border-border'}`}>{children}</h3>;
}

export default function CreateTicketModal({ formData, handleCreateChange, handleCreateSubmit, verificarCodigoManual, technicians, tickets, reports = [], napsConocidas, turnoSugerido, cuentasEmpresa = [], onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Los datos del pago cuando el cobro acordado es "Pagada" (el formulario de pago los entrega al guardar).
  const pagoRef = useRef(null);
  // Las órdenes entre las que se busca la original de una garantía (vivas y de los cierres cargados).
  const ordenesGarantia = useMemo(() => todasLasOrdenes(tickets, reports), [tickets, reports]);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);
  const [saltoCodigo, setSaltoCodigo] = useState(null);
  const [showSinCoordenadas, setShowSinCoordenadas] = useState(false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  // Lo obligatorio lo exige el navegador (`required`, o setCustomValidity en el teléfono y el promotor), pero su burbuja no se parece al resto de la app: se cancela, el cursor va al primer campo con falta,
  // cada campo dice su falta en texto y abajo queda el mensaje del primero.
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
  const esInstalacion = formData.tipoTrabajo?.toUpperCase().includes('INSTAL');
  // Instalación con plantilla de la promotora pegada: ya trae todos los datos y el
  // cliente es nuevo (aún no existe en la OLT), así que SmartOLT no se consulta solo.
  const plantillaPegada = Boolean(esInstalacion && formData.plantillaOriginal?.trim());
  const clienteSmartOlt = useClienteSmartOlt({
    cedula: formData.cedula,
    formData,
    autoBuscar: !plantillaPegada,
    onApply: (campos) => Object.entries(campos).forEach(([name, value]) => handleCreateChange({ target: { name, value, type: 'text' } })),
  });
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
  // Una garantía (del mismo técnico) lleva el código de la orden original: las del cliente que se pueden reutilizar, y el error si falta. Con el check "Garantía de otro técnico" es una
  // orden nueva para otro técnico: no se pide ni se reutiliza el código de la original y toma un número nuevo de su tipo.
  const esGarantiaTipo = esTipoGarantia(formData.tipoTrabajo);
  const usaCodigoOriginal = llevaCodigoDeOriginal(formData.tipoTrabajo, formData.garantiaDe);
  const codigosOriginales = useMemo(() => (usaCodigoOriginal ? codigosParaGarantia(ordenesGarantia, formData.cedula) : []), [usaCodigoOriginal, ordenesGarantia, formData.cedula]);
  const errorCodigo = errorCodigoGarantia(formData.tipoTrabajo, formData.codigo, codigosOriginales, formData.garantiaDe);
  // Reincidencia: solo tiene sentido si esto no es una instalación nueva.
  const reincidencias = esInstalacion ? [] : historial.recientes;
  const reincidenciaMuyReciente = reincidencias.some(r => r.dias <= REINCIDENCIA_MUY_RECIENTE_DIAS);

  // Al elegir o escribir el código de la orden original, la garantía se asigna al técnico de esa orden (si sigue en la lista de técnicos). Se aplica una vez por código: después se puede cambiar a mano.
  const codigoAsignado = useRef('');
  useEffect(() => {
    const codigo = usaCodigoOriginal ? formData.codigo.trim().toUpperCase() : '';
    if (codigo === codigoAsignado.current) return;
    codigoAsignado.current = codigo;
    const nombre = tecnicoDeOriginal(ordenesGarantia, codigo, formData.cedula);
    const tecnicoOriginal = nombre && technicians.find((t) => t.name === nombre);
    if (tecnicoOriginal && tecnicoOriginal.name !== formData.tecnico) handleCreateChange({ target: { name: 'tecnico', value: tecnicoOriginal.name, type: 'text' } });
  }, [usaCodigoOriginal, formData.codigo, formData.cedula, formData.tecnico, ordenesGarantia, technicians, handleCreateChange]);

  const doSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Cobro acordado "Pagada": el formulario de pago valida y entrega los datos (si falta algo muestra el error y no se guarda).
      let pagada = null;
      if (llevaCobro({ tipoTrabajo: formData.tipoTrabajo }) && formData.cobroSel.modo === COBRO_PAGADA) {
        const r = await pagoRef.current?.obtener();
        if (!r || r.tipo !== 'pago') return;
        pagada = r.valor;
      }
      await handleCreateSubmit({ preventDefault: () => {} }, { pagada });
    } finally {
      setIsSubmitting(false);
    }
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

  // El tipo es obligatorio cuando el trabajo tiene opciones (instalación o avería).
  const faltaTipo = opcionesTipo.length > 0 && !formData.falla;
  const mostrarFaltaTipo = faltaTipo && intentoGuardar;
  // En una instalación la ubicación del cliente es obligatoria (la de la NAP sigue como estaba).
  const faltaUbicacion = esInstalacion && ubicacionParseada.vacio;
  const mostrarFaltaUbicacion = faltaUbicacion && intentoGuardar;

  // El cobro acordado solo va en las órdenes que llevan cobro (no en las instalaciones); un monto escrito debe ser válido.
  const pideCobroAcordado = llevaCobro({ tipoTrabajo: formData.tipoTrabajo });
  const errorCobroAcordado = pideCobroAcordado ? (resolverCobroAcordado(formData.cobroSel).error || '') : '';

  // Los datos obligatorios de texto: el navegador deja pasar uno con solo espacios, y aquí no.
  const veFalta = (falta) => falta && intentoGuardar;
  const faltaCedula = !formData.cedula?.trim();
  const faltaNombre = !formData.nombre?.trim();
  const faltaTelefono = !formData.telefono?.trim();
  const faltaDireccion = !formData.direccion?.trim();
  const faltaPromotor = esInstalacion && !claveNombre(formData.promotora || '');

  const onSubmit = (e) => {
    e.preventDefault();
    setMensajeInvalido('');
    const sinDato = faltaCedula ? 'tk-cedula' : faltaNombre ? 'tk-nombre' : faltaTelefono ? 'tk-telefono' : faltaDireccion ? 'tk-direccion' : faltaPromotor ? 'tk-promotora' : null;
    if (sinDato) {
      setIntentoGuardar(true);
      document.getElementById(sinDato)?.focus();
      return;
    }
    if (faltaTipo) {
      setIntentoGuardar(true);
      document.getElementById('tk-falla')?.focus();
      return;
    }
    if (verificandoCodigo) return;
    if (errorCobroAcordado) {
      setIntentoGuardar(true);
      document.getElementById('tk-cobro-monto')?.focus();
      return;
    }
    if (errorCodigo) {
      setIntentoGuardar(true);
      document.getElementById('tk-codigo')?.focus();
      return;
    }
    // Un dato con error: el cursor va al primero, en el orden del formulario.
    const campoConError = napCoordenadasParseadas.error ? 'tk-nap-coords' : ubicacionParseada.error || faltaUbicacion ? 'tk-ubicacion' : null;
    if (campoConError) {
      setIntentoGuardar(true);
      document.getElementById(campoConError)?.focus();
      return;
    }
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
      <div className="bg-card rounded-card shadow-2xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden border border-border">
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white">Nueva asignación</h2>
            <p className="text-xs text-zinc-300 mt-1">Fecha de la orden: {formData.fecha}</p>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>

        <form onSubmit={onSubmit} onInvalidCapture={alInvalidar} onInput={() => { if (mensajeInvalido) setMensajeInvalido(''); }} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-5 gap-x-2 gap-y-3 content-start">
            <Seccion primera>Cliente</Seccion>
            <CedulaField
              variant="create"
              wrapperClassName="col-span-2 sm:col-span-5 space-y-0.5"
              idPrefix="tk"
              tipoDocumento={formData.tipoDocumento}
              cedula={formData.cedula}
              onChange={handleCreateChange}
              extra={<ClienteSmartOltBoton cliente={clienteSmartOlt} />}
              dentro={<ClienteSmartOltEstado cliente={clienteSmartOlt} />}
              error={veFalta(faltaCedula) ? 'Escribe la cédula o el RIF del cliente.' : ''}
            />
            <ClienteSmartOltMensaje cliente={clienteSmartOlt} wrapperClassName="col-span-2 sm:col-span-5 -mt-1 space-y-0.5" />

            {/* !isSubmitting evita el falso positivo: al crear, el listener de
                Firestore trae el ticket recién creado (misma cédula, PENDIENTE)
                antes de que este modal termine de cerrarse, y se compara consigo mismo. */}
            {ticketDuplicado && !isSubmitting && (
              <Aviso nivel="atencion" compact className="col-span-2 sm:col-span-5">Ya existe una orden <strong>{oracion(ticketDuplicado.estado)}</strong> con esta cédula: <strong>{ticketDuplicado.codigo || 'S/C'}</strong> - {ticketDuplicado.nombre}{ticketDuplicado.tecnico ? ` (${ticketDuplicado.tecnico})` : ''}. Puedes seguir creando igual si es una avería distinta.</Aviso>
            )}

            {reincidencias.length > 0 && !isSubmitting && (
              <div role="status" className={`col-span-2 sm:col-span-5 flex items-start gap-2 rounded px-2.5 py-2 text-[11px] max-lg:text-xs border ${reincidenciaMuyReciente ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300'}`}>
                <Repeat className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p>
                    <strong>{reincidenciaMuyReciente ? `Reincidencia reciente (menos de ${REINCIDENCIA_MUY_RECIENTE_DIAS} días)` : 'Cliente con órdenes recientes'}:</strong>{' '}
                    {reincidencias.length === 1 ? 'tuvo 1 orden finalizada' : `tuvo ${reincidencias.length} órdenes finalizadas`} en los últimos {VENTANA_REINCIDENCIA_DIAS} días.
                  </p>
                  <ul className="list-disc pl-4">
                    {reincidencias.slice(0, 3).map(({ ticket, dias }) => (
                      <li key={ticket.id}>
                        <strong>{ticket.codigo || 'S/C'}</strong> · {oracion(ticket.tipoTrabajo)}{ticket.falla ? ` (${ticket.falla})` : ''} · {textoHace(dias)}{ticket.tecnico ? ` · ${ticket.tecnico}` : ''}
                      </li>
                    ))}
                  </ul>
                  {reincidencias.length > 3 && <p>y {reincidencias.length - 3} más.</p>}
                </div>
              </div>
            )}

            <div className="col-span-2 sm:col-span-5 space-y-0.5">
              <label htmlFor="tk-nombre" className={ETIQUETA}>Nombre{OBLIGATORIO}</label>
              <input id="tk-nombre" required type="text" maxLength="100" name="nombre" value={formData.nombre} onChange={handleCreateChange} aria-invalid={veFalta(faltaNombre) ? 'true' : undefined} className={claseCampo('compacto', veFalta(faltaNombre) ? 'error' : 'normal')} />
              {veFalta(faltaNombre) && <p role="alert" className={AVISO}>Escribe el nombre del cliente.</p>}
            </div>

            <div className="col-span-2 sm:col-span-5 space-y-0.5">
              <label htmlFor="tk-telefono" className={ETIQUETA}>Teléfono{OBLIGATORIO}</label>
              <TelefonosField
                id="tk-telefono"
                required
                value={formData.telefono}
                onChange={(value) => handleCreateChange({ target: { name: 'telefono', value, type: 'text' } })}
                inputClassName={claseCampo('compacto', veFalta(faltaTelefono) ? 'error' : 'normal')}
              />
              {veFalta(faltaTelefono) && <p role="alert" className={AVISO}>Escribe el teléfono del cliente.</p>}
            </div>

            <div className="col-span-2 sm:col-span-5 space-y-0.5">
              <label htmlFor="tk-direccion" className={ETIQUETA}>Dirección{OBLIGATORIO}</label>
              <input id="tk-direccion" required type="text" maxLength="200" name="direccion" value={formData.direccion} onChange={handleCreateChange} aria-invalid={veFalta(faltaDireccion) ? 'true' : undefined} className={claseCampo('compacto', veFalta(faltaDireccion) ? 'error' : 'normal')} />
              {veFalta(faltaDireccion) && <p role="alert" className={AVISO}>Escribe la dirección del cliente.</p>}
            </div>

            <Seccion>Trabajo</Seccion>
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
              label="Técnico"
              value={formData.tecnico}
              onChange={handleCreateChange}
              technicians={technicians}
              showSuggestion={esInstalacion}
              turnoSugerido={turnoSugerido}
              emptyOptionLabel="N/A"
            />

            <div className="col-span-1 sm:col-span-3 space-y-0.5">
              <label htmlFor="tk-falla" className={ETIQUETA}>Tipo{opcionesTipo.length > 0 && OBLIGATORIO}</label>
              <SelectMenu
                id="tk-falla"
                ariaLabel="Tipo"
                disabled={opcionesTipo.length === 0}
                value={formData.falla}
                onChange={(v) => handleCreateChange({ target: { name: 'falla', value: v, type: 'text' } })}
                items={tipoItems}
                className={claseSelector('compacto', mostrarFaltaTipo ? 'error' : 'normal').replace(' font-bold', '')}
                chevronClassName="w-3.5 h-3.5 right-2"
              />
              {mostrarFaltaTipo && <p role="alert" className={AVISO}>Elige un tipo.</p>}
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-0.5">
              <label htmlFor="tk-codigo" className={ETIQUETA}>Código{OPCIONAL}</label>
              <input id="tk-codigo" type="text" maxLength="7" name="codigo" placeholder={usaCodigoOriginal && codigosOriginales.length ? 'Original' : 'Auto'} value={formData.codigo} onChange={handleCreateChange} className={`${CAMPO_ORDEN} uppercase placeholder:normal-case placeholder:text-muted-foreground`} />
            </div>

            <div className="col-span-2 sm:col-span-5 space-y-0.5">
              <label htmlFor="tk-fecha-prog" className={ETIQUETA}>Programada{OPCIONAL}</label>
              <CampoFecha id="tk-fecha-prog" ariaLabel="Fecha programada" vacio="Sin fecha programada" valor={formData.fechaProgramada} onChange={(v) => handleCreateChange({ target: { name: 'fechaProgramada', value: v, type: 'text' } })} permitirBorrar clase={CAMPO_FECHA_ORDEN} />
            </div>

            {usaCodigoOriginal && (
              <div className="col-span-2 sm:col-span-5 rounded border border-zinc-300 dark:border-zinc-700 px-2.5 py-2 space-y-1.5 text-[11px] max-lg:text-xs text-zinc-700 dark:text-zinc-200">
                {codigosOriginales.length > 0 ? (
                  <>
                    <p>La garantía lleva el código de la orden original, no un número nuevo. Elige la del cliente o escribe el código; la garantía se asigna al técnico de esa orden:</p>
                    <div role="group" aria-label="Código de la orden original" className="flex flex-wrap gap-1.5">
                      {codigosOriginales.map((o) => (
                        <button key={o.codigo} type="button" onClick={() => handleCreateChange({ target: { name: 'codigo', value: o.codigo, type: 'text' } })} aria-pressed={formData.codigo.trim().toUpperCase() === o.codigo} className="max-lg:min-h-11 px-2.5 py-1 rounded-campo border border-zinc-300 dark:border-zinc-600 font-bold aria-pressed:bg-black aria-pressed:text-white aria-pressed:border-black">
                          {o.codigo}<span className="font-normal"> · {oracion(o.tipoTrabajo)}{o.tecnico ? ` · ${o.tecnico}` : ''}</span>
                        </button>
                      ))}
                    </div>
                    {intentoGuardar && errorCodigo && <p role="alert" className="font-bold text-red-700 dark:text-red-400">{errorCodigo}</p>}
                  </>
                ) : (
                  <p>No hay órdenes anteriores de esta cédula en la app. Si la original existe, escribe su código arriba; si no, la garantía toma un número nuevo.</p>
                )}
              </div>
            )}

            {esInstalacion && esVentaDelTecnico(formData.ventaTecnico, formData.tecnico) && (
              <Aviso nivel="exito" icono={Star} compact className="col-span-2 sm:col-span-5">Venta de <strong>{legible(formData.tecnico)}</strong>: se asigna directo y no consume el turno{turnoSugerido ? <> (el turno sugerido sigue siendo <strong>{turnoSugerido}</strong>)</> : null}.</Aviso>
            )}

            {esInstalacion && turnoSugerido && !esVentaDelTecnico(formData.ventaTecnico, formData.tecnico) && (
              <TurnoSugeridoBanner
                wrapperClassName="col-span-2 sm:col-span-5 flex items-center gap-2 bg-sunken border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-2 text-[11px] max-lg:text-xs text-zinc-700 dark:text-zinc-200"
                turnoSugerido={turnoSugerido}
              />
            )}

            {esGarantiaTipo && formData.garantiaDe && (
              <p className="col-span-2 sm:col-span-5 rounded border border-zinc-300 dark:border-zinc-700 px-2.5 py-2 text-[11px] max-lg:text-xs text-zinc-700 dark:text-zinc-200">
                Es una garantía de otro técnico: es una orden nueva para él, así que toma un número nuevo y no el código de la original.
              </p>
            )}

            <GarantiaField
              suave
              wrapperClassName="col-span-2 sm:col-span-5"
              idPrefix="tk"
              value={formData.garantiaDe}
              onChange={(value) => {
                handleCreateChange({ target: { name: 'garantiaDe', value, type: 'garantia' } });
                // Al marcar el check, el código de la original que ya se hubiera elegido o escrito se quita: la orden nueva toma el suyo.
                if (value && esGarantiaTipo && formData.codigo) handleCreateChange({ target: { name: 'codigo', value: '', type: 'text' } });
              }}
              ordenes={ordenesGarantia}
              tecnico={formData.tecnico}
              cedula={formData.cedula}
            />

            {tipoUsaPlantillaPromotora(formData.tipoTrabajo) && (
              <div className="col-span-2 sm:col-span-5 space-y-0.5">
                <label htmlFor="tk-plantilla" className={ETIQUETA}>{esInstalacion ? 'Plantilla de la promotora' : 'Pegar plantilla'} <span className="font-normal text-muted-foreground">(pega el texto completo, autocompleta los campos)</span></label>
                <textarea id="tk-plantilla" rows="4" value={formData.plantillaOriginal} onChange={handlePlantillaChange} className={`${CAMPO_ORDEN} font-mono`} placeholder={esInstalacion ? 'Pega aquí la plantilla tal como la envió la promotora...' : 'Pega aquí la plantilla completa...'} />
                {!formData.plantillaOriginal?.trim() && (esInstalacion
                  ? <p className="text-xs font-bold text-amber-700 dark:text-amber-400 ml-1">Sin la plantilla pegada no se podrá copiar la plantilla de esta orden.</p>
                  : <p className="text-xs text-muted-foreground ml-1">Sin la plantilla de la promotora, la plantilla de esta orden se arma con el formato de la app.</p>)}
              </div>
            )}

            {esInstalacion && (
              <PromotorField
                suave
                id="tk-promotora"
                value={formData.promotora || ''}
                onChange={handleCreateChange}
                wrapperClassName="col-span-2 sm:col-span-5 space-y-0.5"
                labelClassName={ETIQUETA}
                inputClassName={claseCampo('compacto', veFalta(faltaPromotor) ? 'error' : 'normal')}
                ayuda="(se llena con la plantilla)"
                error={veFalta(faltaPromotor) ? MENSAJE_PROMOTOR_CAMPO : ''}
              />
            )}

            <Seccion>Ubicación y red</Seccion>
            <div className="col-span-2 sm:col-span-5 space-y-0.5">
              <label htmlFor="tk-nap" className={ETIQUETA}>NAP{OPCIONAL}</label>
              <input id="tk-nap" type="text" maxLength="50" name="nap" value={formData.nap} onChange={handleCreateChange} className={CAMPO_ORDEN} />
            </div>

            <NapCoordenadasField
              suave
              idPrefix="tk"
              wrapperClassName="col-span-2 sm:col-span-5 space-y-0.5"
              nap={formData.nap}
              value={formData.napCoordenadas}
              onChange={handleNapCoordenadasChange}
              autoBuscar
              napsConocidas={napsConocidas}
            />

            <div className="col-span-2 sm:col-span-5 space-y-0.5">
              <label htmlFor="tk-ubicacion" className={ETIQUETA}>Ubicación{esInstalacion ? OBLIGATORIO : OPCIONAL}</label>
              <input id="tk-ubicacion" type="text" inputMode="url" maxLength="300" name="ubicacion" placeholder="https://maps.app.goo.gl/..." value={formData.ubicacion} onChange={handleCreateChange} aria-invalid={!!ubicacionParseada.error || mostrarFaltaUbicacion} aria-required={esInstalacion} className={claseCampo('compacto', ubicacionParseada.error || mostrarFaltaUbicacion ? 'error' : 'normal')} />
              <p className="text-xs text-muted-foreground ml-1">Enlace de Google Maps o coordenadas.</p>
              {mostrarFaltaUbicacion && <p role="alert" className={AVISO}>{MENSAJE_UBICACION_OBLIGATORIA}</p>}
              {ubicacionParseada.error && <p role="alert" className={AVISO}>{ubicacionParseada.error}</p>}
              {ubicacionParseada.valor && <a href={ubicacionParseada.valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 max-lg:min-h-11 text-xs font-bold text-sky-700 dark:text-sky-400 hover:underline ml-1"><MapPin className="w-3 h-3" aria-hidden="true" /> Probar enlace</a>}
            </div>

            {pideCobroAcordado && (
              <CobroAcordadoField
                suave
                idPrefix="tk"
                wrapperClassName="col-span-2 sm:col-span-5 space-y-1 pt-3 mt-1 border-t border-border"
                value={formData.cobroSel}
                onChange={(siguiente) => handleCreateChange({ target: { name: 'cobroSel', value: siguiente, type: 'object' } })}
                error={intentoGuardar ? errorCobroAcordado : ''}
                cuentasEmpresa={cuentasEmpresa}
                pagoRef={pagoRef}
                permitirPagada
              />
            )}

            <ObservacionField
              variant="create"
              wrapperClassName="col-span-2 sm:col-span-5 space-y-0.5 pt-3 mt-1 border-t border-border"
              idPrefix="tk"
              etiqueta="Observación"
              value={formData.observacion}
              checked={formData.observacionInterna}
              onChange={handleCreateChange}
            />
          </div>

          <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
            <p role="alert" className="min-w-0 text-xs font-bold text-red-700 dark:text-red-400">{mensajeInvalido}</p>
            <div className="flex gap-2 shrink-0 ml-auto">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-card-foreground text-sm font-bold bg-card border-2 border-input hover:bg-secondary rounded-boton transition-colors">Cancelar</button>
              <button type="submit" disabled={isSubmitting || verificandoCodigo} className={`min-w-[8.5rem] px-4 py-2 text-white text-sm font-bold rounded-boton transition-colors ${isSubmitting || verificandoCodigo ? 'bg-zinc-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover shadow-boton'}`}>{isSubmitting && <Spinner />}{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
            </div>
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
          <div className="bg-card rounded-card shadow-2xl w-full max-w-sm overflow-hidden text-center border border-border">
            <div className="pt-6 pb-4 px-6 flex flex-col items-center">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full mb-4">
                <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-500" />
              </div>
              <h2 className="text-xl font-black text-foreground mb-2">¿Cédula duplicada?</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Ya existe una orden <strong>{oracion(ticketDuplicado.estado)}</strong> con esta cédula: <strong>{ticketDuplicado.codigo || 'S/C'}</strong> - {ticketDuplicado.nombre}{ticketDuplicado.tecnico ? ` (${ticketDuplicado.tecnico})` : ''}. ¿Crear esta de todas formas?
              </p>
            </div>
            <div className="p-6 bg-sunken flex gap-3 border-t border-border">
              <button
                onClick={() => setShowDuplicateConfirm(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 text-card-foreground font-bold bg-card border-2 border-input hover:bg-secondary rounded-card transition-colors disabled:opacity-50 shadow-card">
                Cancelar
              </button>
              <button
                onClick={confirmDuplicateAndSubmit}
                disabled={isSubmitting}
                className={`flex-1 py-3 text-white font-bold rounded-campo transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {isSubmitting && <Spinner />}{isSubmitting ? 'Creando...' : 'Sí, crear igual'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
