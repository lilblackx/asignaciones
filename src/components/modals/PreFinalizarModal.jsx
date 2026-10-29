import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, MapPin, Plug, Tag, Wrench, X } from 'lucide-react';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';
import SenalSmartOlt from './SenalSmartOlt';
import { napSinDato, separarNapPuerto, unirNapPuerto } from '../../utils/napPuerto';
import { stripEmojis } from '../../utils/sanitizeInput';
import { formatCedula } from '../../utils/ticketDisplay';
import ContactoCliente from '../ContactoCliente';
import DevolucionAviso from '../DevolucionAviso';
import { devolucionPendiente, reporteTecnicoInicial } from '../../utils/devolucion';
import ConfirmPreFinalizarModal from './ConfirmPreFinalizarModal';
import { evaluarPotencia, parsePotencia } from '../../utils/potencia';
import { puedeCapturarPotencia } from '../../utils/senalOnu';
import { TIPOS_VISITA_OBLIGATORIO, TIPO_CAMBIO_EQUIPO, errorTipoVisita, pideNapPuertoVisita, TIPO_CONECTOR_INTERNO, TIPO_RECABLEADO, cantidadesConector, colorConectorExterno, colorConectorInterno, datosConectores, errorTipoEquipoNuevo, esVisitaConector, etiquetaTipoVisita, parseCantidadesConector, parseMetros, parseSerialEquipo } from '../../utils/tipoVisita';
import { conceptoCobro, llevaCobro } from '../../utils/cobro';
import { consultaCobroDe } from '../../utils/consultaCobro';
import ConsultaCobroRecableado from './ConsultaCobroRecableado';
import { esInstalacion as trabajoEsInstalacion, napConPuerto, validarInstalacion } from '../../utils/instalacion';
import ConectoresRecableado, { CantidadesConectorInstalacion, CantidadesConectorVisita } from './ConectoresRecableado';
import { normalizarConectoresInstalacion, parseConectoresInstalacion } from '../../utils/conectoresInstalacion';
import SerialEquipoCampo from './SerialEquipoCampo';
import { errorSerialCaja } from '../../utils/serialOlt';
import DatosInstalacion from './DatosInstalacion';
import NapPuertoCampos from './NapPuertoCampos';
import Spinner from '../Spinner';
import FormularioPagoCliente from '../FormularioPagoCliente';

// `pagoInstalacion` (el técnico, en una instalación sin pago registrado): { cuentasEmpresa, otrasOrdenes, verificarReferencia }. La instalación pide el pago del cliente dentro de este formulario: sin él (o
// sin decir que el cliente paga después) no se envía a revisión. Ver FormularioPagoCliente.
export default function PreFinalizarModal({ ticket, onConfirm, onConsultarCobro, onClose, pagoInstalacion = null }) {
  const pagoRef = useRef(null);
  // La NAP y el puerto van en dos campos y son obligatorios con conector externo, drop atenuado y en las instalaciones (ver pideNapPuertoVisita); ahí una NAP "SN" (o vacía) no sirve: el técnico debe escribir la real.
  const pideNapPuertoInicial = pideNapPuertoVisita(ticket?.tipoVisita) || trabajoEsInstalacion(ticket?.tipoTrabajo);
  const separado = separarNapPuerto(ticket?.nap);
  const [nap, setNap] = useState(pideNapPuertoInicial && napSinDato(separado.nap) ? '' : separado.nap);
  const [puerto, setPuerto] = useState(separado.puerto);
  // Instalación: lo que la plantilla de la promotora trae vacío (ver utils/instalacion).
  const [serial, setSerial] = useState(ticket?.instalacion?.serial || '');
  const [vlan, setVlan] = useState(ticket?.instalacion?.vlan || '');
  const [metraje, setMetraje] = useState(ticket?.instalacion?.metraje ? String(ticket.instalacion.metraje) : '');
  const [puertosDisponibles, setPuertosDisponibles] = useState(ticket?.instalacion?.puertosDisponibles || '');
  const [postes, setPostes] = useState(ticket?.instalacion?.posteadura?.length ? ticket.instalacion.posteadura : ['']);
  const [instalacionErrores, setInstalacionErrores] = useState({});
  // Instalación: cuántos conectores usó de cada tipo y color (texto, como se escribe; obligatorio al menos 1).
  const conectoresPrevios = normalizarConectoresInstalacion(ticket?.instalacion?.conectores);
  const [instExternoVerde, setInstExternoVerde] = useState(conectoresPrevios.externo.verde ? String(conectoresPrevios.externo.verde) : '');
  const [instInternoVerde, setInstInternoVerde] = useState(conectoresPrevios.interno.verde ? String(conectoresPrevios.interno.verde) : '');
  const [instInternoAzul, setInstInternoAzul] = useState(conectoresPrevios.interno.azul ? String(conectoresPrevios.interno.azul) : '');
  const [conectoresInstError, setConectoresInstError] = useState({ campo: '', mensaje: '' });
  // Si ya consultó el cobro de un recableado, la orden se abre en ese recableado con esos metros.
  const [tipoVisitaElegido, setTipoVisita] = useState(ticket?.tipoVisita || (consultaCobroDe(ticket) ? TIPO_RECABLEADO : ''));
  const [napError, setNapError] = useState('');
  const [puertoError, setPuertoError] = useState('');
  const [observacion, setObservacion] = useState(() => reporteTecnicoInicial(ticket));
  const potenciaInicial = ticket?.potenciaDbm != null ? String(ticket.potenciaDbm) : '';
  const [potencia, setPotenciaCampo] = useState(potenciaInicial);
  // La consulta a SmartOLT es asíncrona: lo que hay en el campo y lo último que ella escribió se
  // leen de aquí, no del estado de cuando se tocó el botón (el técnico pudo escribir mientras tanto).
  const potenciaEscrita = useRef(potenciaInicial);
  const potenciaDeSmartOlt = useRef('');
  const setPotencia = (valor) => { potenciaEscrita.current = valor; setPotenciaCampo(valor); };
  const [potencia1490, setPotencia1490] = useState(ticket?.potencia1490Dbm != null ? String(ticket.potencia1490Dbm) : '');
  // Recableado: metros de cable (obligatorios) y conectores colocados (opcionales). Visita de
  // conector: el color del conector colocado (el interno es obligatorio).
  const [metros, setMetros] = useState(ticket?.metrosCable != null ? String(ticket.metrosCable) : (consultaCobroDe(ticket) ? String(ticket.consultaCobro.metros) : ''));
  const [colorExterno, setColorExterno] = useState(colorConectorExterno(ticket?.conectorExterno));
  const [colorInterno, setColorInterno] = useState(colorConectorInterno(ticket?.conectorInterno));
  // Visita de conector: cuántos conectores verdes y azules usó (texto, como se escribe).
  const cantidadesPrevias = cantidadesConector(ticket);
  const [cantVerde, setCantVerde] = useState(cantidadesPrevias.verde ? String(cantidadesPrevias.verde) : '');
  const [cantAzul, setCantAzul] = useState(cantidadesPrevias.azul ? String(cantidadesPrevias.azul) : '');
  // Cambio de equipo: serial del equipo nuevo (obligatorio).
  const [serialEquipo, setSerialEquipo] = useState(ticket?.serialEquipo || '');
  const [serialEquipoError, setSerialEquipoError] = useState('');
  const [tipoEquipo, setTipoEquipo] = useState(ticket?.tipoEquipoNuevo || '');
  const [tipoEquipoError, setTipoEquipoError] = useState('');
  const [tipoVisitaError, setTipoVisitaError] = useState('');
  const [metrosError, setMetrosError] = useState('');
  const [cantidadError, setCantidadError] = useState({ campo: '', mensaje: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Los datos ya validados que se guardarán si el técnico confirma; mientras haya algo aquí se ve el aviso de confirmación.
  const [porConfirmar, setPorConfirmar] = useState(null);
  const [obsError, setObsError] = useState('');

  if (!ticket) return null;

  // En una instalación no aplica el tipo de visita (conectores, recableado): se oculta y no se guarda.
  const esInstalacion = trabajoEsInstalacion(ticket.tipoTrabajo);
  const pedirPago = esInstalacion && Boolean(pagoInstalacion);
  const tipoVisita = esInstalacion ? '' : tipoVisitaElegido;
  const visitaConNapPuerto = pideNapPuertoVisita(tipoVisita);
  const recableado = tipoVisita === TIPO_RECABLEADO;
  // Lo que se resume en la confirmación para que el técnico vea qué está enviando: "Recableado: 250 m".
  const etiquetaVisita = tipoVisita ? `${etiquetaTipoVisita(tipoVisita)}${recableado && metros ? `: ${metros} m` : ''}` : '';
  const cambioEquipo = tipoVisita === TIPO_CAMBIO_EQUIPO;
  const potenciaParseada = parsePotencia(potencia);
  const potenciaEval = potenciaParseada.valor !== undefined ? evaluarPotencia(potenciaParseada.valor) : null;

  // SmartOLT solo rellena la potencia si nadie escribió nada: nunca pisa lo escrito. Devuelve si la escribió
  // (o true si no había señal de 1310 nm que escribir: el campo queda como estaba).
  const capturarSenal = (v1310, v1490) => {
    const escribir = v1310 !== null && puedeCapturarPotencia(potenciaEscrita.current, potenciaDeSmartOlt.current);
    if (escribir) {
      setPotencia(v1310);
      potenciaDeSmartOlt.current = v1310;
    }
    setPotencia1490(v1490 ?? '');
    return v1310 === null ? true : escribir;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const metrosParseados = recableado ? parseMetros(metros) : null;
    const cantidades = parseCantidadesConector(tipoVisita, { verde: cantVerde, azul: cantAzul });
    const errorCantidad = cantidades.error || '';
    // Además del formato, el serial debe ser el de la etiqueta (PON S/N o GPON...), no la MAC ni un "GOPN" mal escrito.
    const serialEquipoLeido = cambioEquipo ? parseSerialEquipo(serialEquipo) : null;
    const errorFormatoEquipo = serialEquipoLeido && !serialEquipoLeido.error ? errorSerialCaja(serialEquipo) : '';
    const serialEquipoParseado = errorFormatoEquipo ? { error: errorFormatoEquipo } : serialEquipoLeido;
    const errorTipoEquipo = errorTipoEquipoNuevo(tipoVisita, tipoEquipo);
    // El pago del cliente (instalaciones): se revisa junto con lo demás para mostrar todos los errores a la vez.
    const pagoCliente = pedirPago ? await pagoRef.current?.obtener() : null;
    const instalacionLeida = esInstalacion ? validarInstalacion({ serial, vlan, postes, metraje, nap, puerto, puertosDisponibles }) : null;
    const errorFormatoSerial = instalacionLeida && !instalacionLeida.errores.serial ? errorSerialCaja(serial) : '';
    const instalacion = errorFormatoSerial ? { ...instalacionLeida, errores: { ...instalacionLeida.errores, serial: errorFormatoSerial }, error: true } : instalacionLeida;
    const conectoresInst = esInstalacion ? parseConectoresInstalacion({ externoVerde: instExternoVerde, internoVerde: instInternoVerde, internoAzul: instInternoAzul }) : null;
    // Con conector externo y en las instalaciones la NAP real y el puerto son obligatorios.
    const pideNapPuerto = visitaConNapPuerto || esInstalacion;
    const faltaNap = pideNapPuerto && napSinDato(nap);
    const faltaPuerto = pideNapPuerto && !puerto.trim();
    const errorVisita = errorTipoVisita(ticket.tipoTrabajo, tipoVisita);
    setTipoVisitaError(errorVisita);
    setMetrosError(metrosParseados?.error || '');
    setCantidadError({ campo: cantidades.campo || '', mensaje: errorCantidad });
    setSerialEquipoError(serialEquipoParseado?.error || '');
    setTipoEquipoError(errorTipoEquipo);
    setInstalacionErrores(instalacion?.errores || {});
    setConectoresInstError({ campo: conectoresInst?.campo || '', mensaje: conectoresInst?.error || '' });
    setNapError(faltaNap ? 'Indica la nomenclatura real de la NAP (no vale "SN").' : '');
    setPuertoError(faltaPuerto ? 'Indica el puerto.' : '');
    const faltaObs = !observacion.trim();
    setObsError(faltaObs ? 'Debes describir el trabajo realizado antes de pre-finalizar.' : '');
    // El campo queda arriba y el botón abajo: el cursor va al primer campo con problema, en el orden del formulario.
    if (metrosParseados?.error) document.getElementById('pf-metros')?.focus();
    else if (errorCantidad) document.getElementById(cantidades.campo === 'azul' ? 'pf-cant-azul' : 'pf-cant-verde')?.focus();
    else if (errorVisita) document.getElementById('pf-tipo-visita')?.focus();
    else if (errorTipoEquipo) document.getElementById('pf-tipo-equipo')?.focus();
    else if (serialEquipoParseado?.error) document.getElementById('pf-serial-equipo')?.focus();
    else if (instalacion?.errores.serial) document.getElementById('pf-serial')?.focus();
    else if (instalacion?.errores.vlan) document.getElementById('pf-vlan')?.focus();
    else if (faltaNap) document.getElementById('pf-nap')?.focus();
    else if (faltaPuerto) document.getElementById('pf-puerto')?.focus();
    else if (instalacion?.errores.metraje) document.getElementById('pf-metraje')?.focus();
    else if (instalacion?.errores.posteadura) document.getElementById('pf-poste-1')?.focus();
    else if (instalacion?.errores.puertosDisponibles) document.getElementById('pf-puertos-disponibles')?.focus();
    else if (conectoresInst?.error) document.getElementById({ externoVerde: 'pf-cant-ext-verde', internoVerde: 'pf-cant-int-verde', internoAzul: 'pf-cant-int-azul' }[conectoresInst.campo])?.focus();
    else if (potenciaParseada.error) document.getElementById('pf-potencia')?.focus();
    else if (faltaObs) document.getElementById('pf-obs')?.focus();
    if (faltaObs || errorVisita || metrosParseados?.error || errorCantidad || errorTipoEquipo || serialEquipoParseado?.error || instalacion?.error || conectoresInst?.error || faltaNap || faltaPuerto || potenciaParseada.error || (pedirPago && !pagoCliente)) {
      if (pedirPago && !pagoCliente && !(faltaObs || errorVisita || instalacion?.error || conectoresInst?.error || faltaNap || faltaPuerto)) document.getElementById('pf-pago-forma')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    // Con todo en orden no se guarda todavía: primero se pide confirmar (ver ConfirmPreFinalizarModal).
    setPorConfirmar({
      ...(pagoCliente ? { pagoCliente } : {}),
      // Solo estas visitas piden NAP y puerto; en las demás la orden conserva la NAP que ya traía.
      nap: visitaConNapPuerto ? unirNapPuerto(nap, puerto) : esInstalacion ? napConPuerto(nap, puerto) : (ticket?.nap || ''),
      ...(instalacion ? { instalacion: { ...instalacion.datos, conectores: conectoresInst.valor } } : {}),
      observacionTecnico: observacion,
      potenciaDbm: potenciaParseada.valor ?? null,
      potencia1490Dbm: parsePotencia(potencia1490).valor ?? null,
      tipoVisita,
      serialEquipo: serialEquipoParseado?.valor ?? '',
      tipoEquipoNuevo: cambioEquipo ? tipoEquipo : '',
      ...datosConectores(tipoVisita, { metros: metrosParseados?.valor, conectorExterno: colorExterno, conectorInterno: colorInterno, conectores: cantidades.valor }),
    });
  };

  const confirmarPreFinalizar = async () => {
    setIsSubmitting(true);
    await onConfirm(ticket, porConfirmar);
    setIsSubmitting(false);
  };

  return (
    <>
    {/* Con la confirmación abierta, Escape cierra solo la confirmación y no pierde lo escrito en el formulario. */}
    <Modal onClose={() => { if (!porConfirmar) onClose(); }} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-amber-500 flex justify-between items-center sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-black text-[11px] max-lg:text-xs font-black px-2 py-0.5 rounded tracking-wide">
                PRE-FINALIZAR
              </span>
              <span className="text-xs font-bold text-amber-400">
                {ticket.codigo || 'S/C'}
              </span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate max-w-[260px] sm:max-w-md">
              {ticket.nombre}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* noValidate: las faltas las revisa handleSubmit, que muestra todos los errores y lleva el cursor al primero. */}
        <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-5 space-y-4">
          <DevolucionAviso ticket={ticket} conValores />
          {/* Resumen compacto de la orden */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="font-bold text-red-600 dark:text-red-400">{ticket.tipoTrabajo}</span>
              {ticket.falla && <span className="text-zinc-400">({ticket.falla})</span>}
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{ticket.direccion}</span>
            </div>
            {ticket.cedula && (
              <div className="flex items-center gap-2 text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400">
                <Tag className="w-3 h-3 text-zinc-400 shrink-0" />
                <span>C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</span>
                {ticket.telefono && <span className="ml-2">Telf: {ticket.telefono}</span>}
              </div>
            )}
            <ContactoCliente telefono={ticket.telefono} ubicacion={ticket.ubicacion} napCoordenadas={ticket.napCoordenadas} nombre={ticket.nombre} className="pt-1" />
          </div>

          {!esInstalacion && (
          <div className="space-y-1">
            <label htmlFor="pf-tipo-visita" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              TIPO DE VISITA <span className="font-normal text-red-500">(obligatorio)</span>
            </label>
            <SelectMenu
              id="pf-tipo-visita"
              ariaLabel="Tipo de visita"
              icon={Plug}
              value={tipoVisita}
              displayLabel={tipoVisita ? undefined : 'Elige el tipo de visita'}
              onChange={(v) => {
                setTipoVisita(v);
                setTipoVisitaError('');
                setNapError('');
                setPuertoError('');
                setMetrosError('');
                setCantidadError({ campo: '', mensaje: '' });
                setSerialEquipoError('');
                setTipoEquipoError('');
                // Un texto ya escrito como "NAP 08 - Puerto 3" se reparte en los dos campos.
                if (pideNapPuertoVisita(v) && !puerto) {
                  const sep = separarNapPuerto(nap);
                  setNap(sep.nap);
                  setPuerto(sep.puerto);
                }
                // Donde la NAP real es obligatoria un "SN" se vacía para que la escriba.
                if (pideNapPuertoVisita(v) && napSinDato(separarNapPuerto(nap).nap)) setNap('');
              }}
              items={TIPOS_VISITA_OBLIGATORIO}
            />
            {tipoVisitaError && <p role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{tipoVisitaError}</p>}
          </div>
          )}

          {recableado && (
            <div className="space-y-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
              <div className="space-y-1">
                <label htmlFor="pf-metros" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
                  METROS DE CABLE <span className="font-normal text-red-500">(obligatorio)</span>
                </label>
                <div className="relative">
                  <input
                    id="pf-metros"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 35"
                    value={metros}
                    onChange={(e) => { setMetros(e.target.value.replace(/\D/g, '').slice(0, 4)); if (metrosError) setMetrosError(''); }}
                    aria-invalid={!!metrosError}
                    aria-describedby={metrosError ? 'pf-metros-error' : undefined}
                    className={`w-full min-w-0 bg-white dark:bg-zinc-950 border pl-3 pr-9 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm font-bold text-zinc-900 dark:text-white shadow-sm transition-colors ${metrosError ? 'border-red-500' : 'border-zinc-400 dark:border-zinc-700 focus:border-amber-500'}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-600 dark:text-zinc-400 pointer-events-none" aria-hidden="true">m</span>
                </div>
                {metrosError && <p id="pf-metros-error" role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{metrosError}</p>}
              </div>
              {onConsultarCobro && <ConsultaCobroRecableado ticket={ticket} metros={metros} onConsultar={(valor) => onConsultarCobro(ticket, valor)} />}
              <ConectoresRecableado colorExterno={colorExterno} colorInterno={colorInterno} onExterno={setColorExterno} onInterno={setColorInterno} />
            </div>
          )}

          {cambioEquipo && (
            <SerialEquipoCampo
              serial={serialEquipo}
              onSerial={(v) => { setSerialEquipo(v); if (serialEquipoError) setSerialEquipoError(''); }}
              error={serialEquipoError}
              verificar
              tipoEquipo={tipoEquipo}
              onTipoEquipo={(v) => { setTipoEquipo(v); if (tipoEquipoError) setTipoEquipoError(''); }}
              errorTipo={tipoEquipoError}
            />
          )}

          {esVisitaConector(tipoVisita) && (
            <CantidadesConectorVisita
              interno={tipoVisita === TIPO_CONECTOR_INTERNO}
              verde={cantVerde}
              azul={cantAzul}
              onVerde={(v) => { setCantVerde(v); setCantidadError({ campo: '', mensaje: '' }); }}
              onAzul={(v) => { setCantAzul(v); setCantidadError({ campo: '', mensaje: '' }); }}
              error={cantidadError}
            />
          )}

          {esInstalacion ? (
            <>
            <DatosInstalacion
              serial={serial}
              onSerial={(v) => { setSerial(v); if (instalacionErrores.serial) setInstalacionErrores((e) => ({ ...e, serial: undefined })); }}
              vlan={vlan}
              onVlan={(v) => { setVlan(v); if (instalacionErrores.vlan) setInstalacionErrores((e) => ({ ...e, vlan: undefined })); }}
              postes={postes}
              onPostes={(v) => { setPostes(v); if (instalacionErrores.posteadura) setInstalacionErrores((e) => ({ ...e, posteadura: undefined })); }}
              metraje={metraje}
              onMetraje={(v) => { setMetraje(v); if (instalacionErrores.metraje) setInstalacionErrores((e) => ({ ...e, metraje: undefined })); }}
              nap={nap}
              onNap={(v) => { setNap(v); if (napError) setNapError(''); }}
              puerto={puerto}
              onPuerto={(v) => { setPuerto(v); if (puertoError) setPuertoError(''); }}
              puertosDisponibles={puertosDisponibles}
              onPuertosDisponibles={(v) => { setPuertosDisponibles(v); if (instalacionErrores.puertosDisponibles) setInstalacionErrores((e) => ({ ...e, puertosDisponibles: undefined })); }}
              errores={{ ...instalacionErrores, nap: napError, puerto: puertoError }}
            />
            <CantidadesConectorInstalacion
              externoVerde={instExternoVerde}
              internoVerde={instInternoVerde}
              internoAzul={instInternoAzul}
              onExternoVerde={(v) => { setInstExternoVerde(v); setConectoresInstError({ campo: '', mensaje: '' }); }}
              onInternoVerde={(v) => { setInstInternoVerde(v); setConectoresInstError({ campo: '', mensaje: '' }); }}
              onInternoAzul={(v) => { setInstInternoAzul(v); setConectoresInstError({ campo: '', mensaje: '' }); }}
              error={conectoresInstError}
            />
            {pedirPago && (
              <section aria-label="Pago del cliente" className="space-y-3 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 p-3">
                <h3 className="text-sm font-black tracking-wide text-zinc-900 dark:text-white">PAGO DEL CLIENTE</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">Registra lo que el cliente pagó por la instalación. Es obligatorio: sin esto no se envía a revisión.</p>
                <FormularioPagoCliente
                  ref={pagoRef}
                  incrustado
                  idPrefijo="pf-pago"
                  cuentasEmpresa={pagoInstalacion.cuentasEmpresa}
                  otrasOrdenes={pagoInstalacion.otrasOrdenes}
                  verificarReferencia={pagoInstalacion.verificarReferencia}
                  onPagaDespues={() => {}}
                />
              </section>
            )}
            </>
          ) : visitaConNapPuerto ? (
            <NapPuertoCampos
              nap={nap}
              onNap={(v) => { setNap(v); if (napError) setNapError(''); }}
              napError={napError}
              puerto={puerto}
              onPuerto={(v) => { setPuerto(v); if (puertoError) setPuertoError(''); }}
              puertoError={puertoError}
            />
          ) : null}

          {llevaCobro({ tipoTrabajo: ticket.tipoTrabajo }) && (
            <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-xl p-3 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-200">
              <Plug className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-tight">
                {conceptoCobro({ tipoTrabajo: ticket.tipoTrabajo, tipoVisita })}: cuando se finalice la orden, verás el cobro resultante para el cliente.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="pf-potencia" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              POTENCIA ÓPTICA (dBm) <span className="font-normal text-zinc-400">(opcional)</span>
            </label>
            <input
              id="pf-potencia"
              type="text"
              inputMode="decimal"
              maxLength="7"
              placeholder="Ej. -19.5"
              value={potencia}
              onChange={(e) => setPotencia(e.target.value.replace(/[^0-9.,-]/g, ''))}
              aria-invalid={!!potenciaParseada.error}
              aria-describedby="pf-potencia-hint"
              className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${potenciaParseada.error ? 'border-red-500' : 'border-zinc-400 dark:border-zinc-700 focus:border-amber-500'}`}
            />
            <p id="pf-potencia-hint" role={potenciaParseada.error ? 'alert' : undefined} className={`text-[11px] max-lg:text-xs font-bold ml-1 ${potenciaParseada.error ? 'text-red-600 dark:text-red-400' : potenciaEval ? potenciaEval.clase : 'text-zinc-400 font-normal'}`}>
              {potenciaParseada.error || (potenciaEval ? potenciaEval.texto : 'Potencia recibida en la ONU. Si omites el signo se toma como negativa.')}
            </p>
            {ticket.cedula && <SenalSmartOlt ticketId={ticket.id} onCapturar={capturarSenal} />}
          </div>

          {ticket.observacion?.trim() && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">NOTA DE LA OFICINA</span>
              <p className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{ticket.observacion}</p>
            </div>
          )}

          {devolucionPendiente(ticket) && ticket.observacionTecnico?.trim() && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">TU REPORTE ANTERIOR</span>
              <p className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{ticket.observacionTecnico}</p>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="pf-obs"className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              OBSERVACIÓN / DETALLES DEL TRABAJO <span className="font-normal text-red-500">(obligatorio)</span>
            </label>
            <textarea
              id="pf-obs"
              required
              rows="3"
              maxLength="300"
              placeholder="Escribe detalles del servicio (ej. Instalación operativa, cliente conforme)..."
              value={observacion}
              onChange={(e) => { setObservacion(stripEmojis(e.target.value)); if (obsError) setObsError(''); }}
              aria-invalid={!!obsError}
              className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors resize-none ${obsError ? 'border-red-500 focus:border-red-500' : 'border-zinc-400 dark:border-zinc-700 focus:border-amber-500'}`}
            />
            {obsError && <p role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{obsError}</p>}
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-tight">
              Esta orden quedará en estado <strong>PRE-FINALIZADA</strong> para que el administrador u operador revise y realice la finalización definitiva.
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3 text-xs sm:text-sm text-black font-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{isSubmitting && <Spinner />}{isSubmitting ? 'Guardando...' : 'Confirmar'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
    {porConfirmar && (
      <ConfirmPreFinalizarModal
        ticket={ticket}
        visita={etiquetaVisita}
        isSubmitting={isSubmitting}
        onCancel={() => setPorConfirmar(null)}
        onConfirm={confirmarPreFinalizar}
      />
    )}
    </>
  );
}
