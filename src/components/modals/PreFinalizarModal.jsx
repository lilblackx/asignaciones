import { observacionParaTecnico } from '../../utils/observacion';
import { useEffect, useRef, useState } from 'react';
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
import { datosParaConfirmar } from '../../utils/confirmarPreFinalizar';
import { evaluarPotencia, parsePotencia } from '../../utils/potencia';
import { puedeCapturarPotencia } from '../../utils/senalOnu';
import { TIPOS_VISITA_OBLIGATORIO, errorTipoVisita, pideNapPuertoVisita, TIPO_RECABLEADO, cantidadesConector, esCambioEquipo, esRecableado, avisaCobroAlPreFinalizar, colorConectorExterno, colorConectorInterno, datosConectores, errorTipoEquipoNuevo, esVisitaConector, etiquetaTipoVisita, parseCantidadesConector, parseSerialEquipo, pideSerialEquipo, esConfigVlan, parseVlanVisita } from '../../utils/tipoVisita';
import { conceptoCobro, llevaCobro } from '../../utils/cobro';
import { consultaCobroDe } from '../../utils/consultaCobro';
import ConsultaCobroRecableado from './ConsultaCobroRecableado';
import { esInstalacion as trabajoEsInstalacion, napConPuerto, validarInstalacion } from '../../utils/instalacion';
import ConectoresRecableado, { CantidadesConectorInstalacion, CantidadesConectorVisita } from './ConectoresRecableado';
import { normalizarConectoresInstalacion, parseConectoresInstalacion } from '../../utils/conectoresInstalacion';
import SerialEquipoCampo from './SerialEquipoCampo';
import VlanVisitaCampo from './VlanVisitaCampo';
import { errorSerialCaja } from '../../utils/serialOlt';
import DatosInstalacion from './DatosInstalacion';
import MetrajeInicialFinal from './MetrajeInicialFinal';
import { calcularMetraje, totalMetraje } from '../../utils/metraje';
import NapPuertoCampos from './NapPuertoCampos';
import Spinner from '../Spinner';
import { claseArea, claseCampo } from '../estilos';
import { guardarBorrador, leerBorrador, olvidarBorrador, versionDeOrden } from '../../utils/borradorPrefinalizar';

const marcaTexto = (v) => (v == null ? '' : String(v));

// Lo que el formulario trae al abrir la orden (sin borrador). Es también la base con que se decide si hay algo escrito que guardar como borrador (ver utils/borradorPrefinalizar).
function valoresDelTicket(ticket) {
  // La NAP y el puerto van en dos campos y son obligatorios con conector externo, drop atenuado y en las instalaciones (ver pideNapPuertoVisita); ahí una NAP "SN" (o vacía) no sirve: el técnico debe escribir la real.
  const pideNapPuerto = pideNapPuertoVisita(ticket?.tipoVisita) || trabajoEsInstalacion(ticket?.tipoTrabajo);
  const separado = separarNapPuerto(ticket?.nap);
  const conectoresInst = normalizarConectoresInstalacion(ticket?.instalacion?.conectores);
  const cantidades = cantidadesConector(ticket);
  return {
    nap: pideNapPuerto && napSinDato(separado.nap) ? '' : separado.nap,
    puerto: separado.puerto,
    // Instalación: lo que la plantilla de la promotora trae vacío (ver utils/instalacion).
    serial: ticket?.instalacion?.serial || '',
    vlan: ticket?.instalacion?.vlan || '',
    metrajeInicial: marcaTexto(ticket?.instalacion?.metrajeInicial),
    metrajeFinal: marcaTexto(ticket?.instalacion?.metrajeFinal),
    metrajeExiste: ticket?.instalacion?.metrajeExistente === true,
    puertosDisponibles: ticket?.instalacion?.puertosDisponibles || '',
    postes: ticket?.instalacion?.posteadura?.length ? ticket.instalacion.posteadura : [''],
    // Instalación: cuántos conectores usó de cada tipo y color (texto, como se escribe; obligatorio al menos 1).
    instExternoVerde: conectoresInst.externo.verde ? String(conectoresInst.externo.verde) : '',
    instInternoVerde: conectoresInst.interno.verde ? String(conectoresInst.interno.verde) : '',
    instInternoAzul: conectoresInst.interno.azul ? String(conectoresInst.interno.azul) : '',
    // Si ya consultó el cobro de un recableado, la orden se abre en ese recableado con esos metros.
    tipoVisita: ticket?.tipoVisita || (consultaCobroDe(ticket) ? TIPO_RECABLEADO : ''),
    observacion: reporteTecnicoInicial(ticket),
    potencia: ticket?.potenciaDbm != null ? String(ticket.potenciaDbm) : '',
    potencia1490: ticket?.potencia1490Dbm != null ? String(ticket.potencia1490Dbm) : '',
    // Recableado: metros de cable (obligatorios) y conectores colocados (opcionales). Visita de conector: el color del conector colocado (el interno es obligatorio).
    metrosInicial: marcaTexto(ticket?.metrajeInicial),
    metrosFinal: marcaTexto(ticket?.metrajeFinal),
    colorExterno: colorConectorExterno(ticket?.conectorExterno),
    colorInterno: colorConectorInterno(ticket?.conectorInterno),
    // Visita de conector: cuántos conectores verdes y azules usó (texto, como se escribe).
    cantVerde: cantidades.verde ? String(cantidades.verde) : '',
    cantAzul: cantidades.azul ? String(cantidades.azul) : '',
    // Cambio de equipo: serial del equipo nuevo (obligatorio).
    serialEquipo: ticket?.serialEquipo || '',
    tipoEquipo: ticket?.tipoEquipoNuevo || '',
    // Configuración de VLAN: el número de VLAN configurada (obligatorio).
    vlanVisita: ticket?.vlanVisita || '',
  };
}

// El borrador se lee una sola vez al abrir. "Descartar" lo borra y vuelve a armar el formulario con lo que trae la orden.
export default function PreFinalizarModal(props) {
  const { ticket, usuario } = props;
  const [borrador, setBorrador] = useState(() => (ticket && usuario ? leerBorrador(usuario, ticket.id) : null));
  const [reinicio, setReinicio] = useState(0);
  const descartar = () => { olvidarBorrador(usuario, ticket.id); setBorrador(null); setReinicio((n) => n + 1); };
  return <FormularioPreFinalizar key={reinicio} {...props} borrador={borrador} onDescartarBorrador={descartar} />;
}

// El pago del cliente ya no se pide aquí: el técnico lo registra cuando la oficina finaliza la orden (ver CobroResultanteModal).
function FormularioPreFinalizar({ ticket, usuario, borrador, onDescartarBorrador, onConfirm, onConsultarCobro, onClose }) {
  // Con borrador, lo que el técnico había escrito pisa a lo que trae la orden.
  const [ini] = useState(() => ({ ...valoresDelTicket(ticket), ...(borrador?.valores || {}) }));
  const [nap, setNap] = useState(ini.nap);
  const [puerto, setPuerto] = useState(ini.puerto);
  const [serial, setSerial] = useState(ini.serial);
  const [vlan, setVlan] = useState(ini.vlan);
  const [metrajeInicial, setMetrajeInicial] = useState(ini.metrajeInicial);
  const [metrajeFinal, setMetrajeFinal] = useState(ini.metrajeFinal);
  const [metrajeExiste, setMetrajeExiste] = useState(ini.metrajeExiste);
  const [puertosDisponibles, setPuertosDisponibles] = useState(ini.puertosDisponibles);
  const [postes, setPostes] = useState(ini.postes);
  const [instalacionErrores, setInstalacionErrores] = useState({});
  const [instExternoVerde, setInstExternoVerde] = useState(ini.instExternoVerde);
  const [instInternoVerde, setInstInternoVerde] = useState(ini.instInternoVerde);
  const [instInternoAzul, setInstInternoAzul] = useState(ini.instInternoAzul);
  const [conectoresInstError, setConectoresInstError] = useState({ campo: '', mensaje: '' });
  const [tipoVisitaElegido, setTipoVisita] = useState(ini.tipoVisita);
  const [napError, setNapError] = useState('');
  const [puertoError, setPuertoError] = useState('');
  const [observacion, setObservacion] = useState(ini.observacion);
  const [potencia, setPotenciaCampo] = useState(ini.potencia);
  // La consulta a SmartOLT es asíncrona: lo que hay en el campo y lo último que ella escribió se
  // leen de aquí, no del estado de cuando se tocó el botón (el técnico pudo escribir mientras tanto).
  const potenciaEscrita = useRef(ini.potencia);
  const potenciaDeSmartOlt = useRef('');
  const setPotencia = (valor) => { potenciaEscrita.current = valor; setPotenciaCampo(valor); };
  const [potencia1490, setPotencia1490] = useState(ini.potencia1490);
  const [metrosInicial, setMetrosInicial] = useState(ini.metrosInicial);
  const [metrosFinal, setMetrosFinal] = useState(ini.metrosFinal);
  const [colorExterno, setColorExterno] = useState(ini.colorExterno);
  const [colorInterno, setColorInterno] = useState(ini.colorInterno);
  const [cantVerde, setCantVerde] = useState(ini.cantVerde);
  const [cantAzul, setCantAzul] = useState(ini.cantAzul);
  const [serialEquipo, setSerialEquipo] = useState(ini.serialEquipo);
  const [serialEquipoError, setSerialEquipoError] = useState('');
  const [tipoEquipo, setTipoEquipo] = useState(ini.tipoEquipo);
  const [tipoEquipoError, setTipoEquipoError] = useState('');
  const [vlanVisita, setVlanVisita] = useState(ini.vlanVisita);
  const [vlanVisitaError, setVlanVisitaError] = useState('');
  const [tipoVisitaError, setTipoVisitaError] = useState('');
  const [metrosError, setMetrosError] = useState({});
  const [cantidadError, setCantidadError] = useState({ campo: '', mensaje: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Los datos ya validados que se guardarán si el técnico confirma; mientras haya algo aquí se ve el aviso de confirmación.
  const [porConfirmar, setPorConfirmar] = useState(null);
  const [obsError, setObsError] = useState('');

  // Borrador: lo escrito se guarda en el teléfono medio segundo después del último cambio (ver utils/borradorPrefinalizar). Mientras se envía no se toca: al terminar, la app lo borra.
  const escrito = { nap, puerto, serial, vlan, metrajeInicial, metrajeFinal, metrajeExiste, puertosDisponibles, postes, instExternoVerde, instInternoVerde, instInternoAzul, tipoVisita: tipoVisitaElegido, observacion, potencia, potencia1490, metrosInicial, metrosFinal, colorExterno, colorInterno, cantVerde, cantAzul, serialEquipo, tipoEquipo, vlanVisita };
  const escritoTexto = JSON.stringify(escrito);
  useEffect(() => {
    if (!usuario || !ticket || isSubmitting) return undefined;
    const espera = setTimeout(() => guardarBorrador(usuario, ticket, JSON.parse(escritoTexto), valoresDelTicket(ticket)), 500);
    return () => clearTimeout(espera);
  }, [escritoTexto, usuario, ticket, isSubmitting]);

  if (!ticket) return null;

  // En una instalación no aplica el tipo de visita (conectores, recableado): se oculta y no se guarda.
  const esInstalacion = trabajoEsInstalacion(ticket.tipoTrabajo);
  const tipoVisita = esInstalacion ? '' : tipoVisitaElegido;
  const visitaConNapPuerto = pideNapPuertoVisita(tipoVisita);
  const recableado = esRecableado(tipoVisita);
  // Recableado: los metros son la diferencia entre el metraje inicial y el final (texto vacío mientras no se pueda calcular).
  const metrosTotal = totalMetraje(metrosInicial, metrosFinal);
  const metros = metrosTotal != null ? String(metrosTotal) : '';
  // Lo que se resume en la confirmación para que el técnico vea qué está enviando: "Recableado: 250 m".
  const etiquetaVisita = tipoVisita ? `${etiquetaTipoVisita(tipoVisita)}${recableado && metros ? `: ${metros} m` : ''}` : '';
  // El cambio de equipo y sus combinaciones (recableado, reconexión o conector interno + cambio de equipo) piden el tipo y el serial del equipo nuevo.
  const cambioEquipo = esCambioEquipo(tipoVisita);
  // El cambio de equipo y la reconexión piden el serial del equipo (obligatorio); el tipo del equipo solo el cambio.
  const pideSerial = pideSerialEquipo(tipoVisita);
  const configVlan = esConfigVlan(tipoVisita);
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
    const metrosParseados = recableado ? calcularMetraje(metrosInicial, metrosFinal) : null;
    const cantidades = parseCantidadesConector(tipoVisita, { verde: cantVerde, azul: cantAzul });
    const errorCantidad = cantidades.error || '';
    // Además del formato, el serial debe ser el de la etiqueta (PON S/N o GPON...), no la MAC ni un "GOPN" mal escrito.
    const serialEquipoLeido = pideSerial ? parseSerialEquipo(serialEquipo, tipoVisita) : null;
    const errorFormatoEquipo = serialEquipoLeido && !serialEquipoLeido.error ? errorSerialCaja(serialEquipo) : '';
    const serialEquipoParseado = errorFormatoEquipo ? { error: errorFormatoEquipo } : serialEquipoLeido;
    const errorTipoEquipo = errorTipoEquipoNuevo(tipoVisita, tipoEquipo);
    const vlanVisitaParseada = configVlan ? parseVlanVisita(vlanVisita) : null;
    const instalacionLeida = esInstalacion ? validarInstalacion({ serial, vlan, postes, metrajeInicial, metrajeFinal, pideMarcas: true, metrajeExistente: metrajeExiste, nap, puerto, puertosDisponibles }) : null;
    const errorFormatoSerial = instalacionLeida && !instalacionLeida.errores.serial ? errorSerialCaja(serial) : '';
    const instalacion = errorFormatoSerial ? { ...instalacionLeida, errores: { ...instalacionLeida.errores, serial: errorFormatoSerial }, error: true } : instalacionLeida;
    const conectoresInst = esInstalacion ? parseConectoresInstalacion({ externoVerde: instExternoVerde, internoVerde: instInternoVerde, internoAzul: instInternoAzul }) : null;
    // Con conector externo y en las instalaciones la NAP real y el puerto son obligatorios.
    const pideNapPuerto = visitaConNapPuerto || esInstalacion;
    const faltaNap = pideNapPuerto && napSinDato(nap);
    const faltaPuerto = pideNapPuerto && !puerto.trim();
    const errorVisita = errorTipoVisita(ticket.tipoTrabajo, tipoVisita);
    setTipoVisitaError(errorVisita);
    setMetrosError(metrosParseados?.errores || {});
    setCantidadError({ campo: cantidades.campo || '', mensaje: errorCantidad });
    setSerialEquipoError(serialEquipoParseado?.error || '');
    setTipoEquipoError(errorTipoEquipo);
    setVlanVisitaError(vlanVisitaParseada?.error || '');
    setInstalacionErrores(instalacion?.errores || {});
    setConectoresInstError({ campo: conectoresInst?.campo || '', mensaje: conectoresInst?.error || '' });
    setNapError(faltaNap ? 'Indica la nomenclatura real de la NAP (no vale "SN").' : '');
    setPuertoError(faltaPuerto ? 'Indica el puerto.' : '');
    const faltaObs = !observacion.trim();
    setObsError(faltaObs ? 'Debes describir el trabajo realizado antes de pre-finalizar.' : '');
    // El campo queda arriba y el botón abajo: el cursor va al primer campo con problema, en el orden del formulario.
    if (metrosParseados?.errores?.inicial) document.getElementById('pf-metros-inicial')?.focus();
    else if (metrosParseados?.errores?.final) document.getElementById('pf-metros-final')?.focus();
    else if (errorCantidad) document.getElementById(cantidades.campo === 'azul' ? 'pf-cant-azul' : 'pf-cant-verde')?.focus();
    else if (errorVisita) document.getElementById('pf-tipo-visita')?.focus();
    else if (vlanVisitaParseada?.error) document.getElementById('pf-vlan-visita')?.focus();
    else if (errorTipoEquipo) document.getElementById('pf-tipo-equipo')?.focus();
    else if (serialEquipoParseado?.error) document.getElementById('pf-serial-equipo')?.focus();
    else if (instalacion?.errores.serial) document.getElementById('pf-serial')?.focus();
    else if (instalacion?.errores.vlan) document.getElementById('pf-vlan')?.focus();
    else if (faltaNap) document.getElementById('pf-nap')?.focus();
    else if (faltaPuerto) document.getElementById('pf-puerto')?.focus();
    else if (instalacion?.errores.metrajeInicial || instalacion?.errores.metraje) document.getElementById('pf-metraje-inicial')?.focus();
    else if (instalacion?.errores.metrajeFinal) document.getElementById('pf-metraje-final')?.focus();
    else if (instalacion?.errores.posteadura) document.getElementById('pf-poste-1')?.focus();
    else if (instalacion?.errores.puertosDisponibles) document.getElementById('pf-puertos-disponibles')?.focus();
    else if (conectoresInst?.error) document.getElementById({ externoVerde: 'pf-cant-ext-verde', internoVerde: 'pf-cant-int-verde', internoAzul: 'pf-cant-int-azul' }[conectoresInst.campo])?.focus();
    else if (potenciaParseada.error) document.getElementById('pf-potencia')?.focus();
    else if (faltaObs) document.getElementById('pf-obs')?.focus();
    if (faltaObs || errorVisita || metrosParseados?.errores || errorCantidad || errorTipoEquipo || vlanVisitaParseada?.error || serialEquipoParseado?.error || instalacion?.error || conectoresInst?.error || faltaNap || faltaPuerto || potenciaParseada.error) {
      return;
    }
    // Con todo en orden no se guarda todavía: primero se pide confirmar (ver ConfirmPreFinalizarModal).
    setPorConfirmar({
      // Solo estas visitas piden NAP y puerto; en las demás la orden conserva la NAP que ya traía.
      nap: visitaConNapPuerto ? unirNapPuerto(nap, puerto) : esInstalacion ? napConPuerto(nap, puerto) : (ticket?.nap || ''),
      ...(instalacion ? { instalacion: { ...instalacion.datos, conectores: conectoresInst.valor } } : {}),
      observacionTecnico: observacion,
      potenciaDbm: potenciaParseada.valor ?? null,
      potencia1490Dbm: parsePotencia(potencia1490).valor ?? null,
      tipoVisita,
      serialEquipo: serialEquipoParseado?.valor ?? '',
      tipoEquipoNuevo: cambioEquipo ? tipoEquipo : '',
      vlanVisita: vlanVisitaParseada?.valor ?? '',
      ...datosConectores(tipoVisita, { metros: metrosParseados?.valor?.total, metrajeInicial: metrosParseados?.valor?.inicial, metrajeFinal: metrosParseados?.valor?.final, conectorExterno: colorExterno, conectorInterno: colorInterno, conectores: cantidades.valor }),
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
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
            className="inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* noValidate: las faltas las revisa handleSubmit, que muestra todos los errores y lleva el cursor al primero. */}
        <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-5 space-y-4">
          {borrador && (
            <div role="status" className="rounded-xl border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100 space-y-1.5">
              <p className="font-bold">Recuperamos lo que llevabas escrito.</p>
              {borrador.version !== versionDeOrden(ticket) && <p>La oficina cambió esta orden mientras tanto: revisa los datos antes de enviar.</p>}
              <button type="button" onClick={onDescartarBorrador} className="font-bold underline underline-offset-2">Descartar y empezar de nuevo</button>
            </div>
          )}
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
                setMetrosError({});
                setCantidadError({ campo: '', mensaje: '' });
                setSerialEquipoError('');
                setTipoEquipoError('');
                setVlanVisitaError('');
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
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
                  METRAJE DEL CABLE <span className="font-normal text-zinc-400">marca del cable al empezar y al terminar</span>
                </p>
                <MetrajeInicialFinal
                  idInicial="pf-metros-inicial"
                  idFinal="pf-metros-final"
                  inicial={metrosInicial}
                  final={metrosFinal}
                  onInicial={(v) => { setMetrosInicial(v); if (metrosError.inicial) setMetrosError((e) => ({ ...e, inicial: undefined })); }}
                  onFinal={(v) => { setMetrosFinal(v); if (metrosError.final) setMetrosError((e) => ({ ...e, final: undefined })); }}
                  errorInicial={metrosError.inicial}
                  errorFinal={metrosError.final}
                />
              </div>
              {onConsultarCobro && <ConsultaCobroRecableado ticket={ticket} metros={metros} onConsultar={(valor) => onConsultarCobro(ticket, valor)} />}
              <ConectoresRecableado colorExterno={colorExterno} colorInterno={colorInterno} onExterno={setColorExterno} onInterno={setColorInterno} />
            </div>
          )}

          {configVlan && <VlanVisitaCampo vlan={vlanVisita} onVlan={(v) => { setVlanVisita(v); if (vlanVisitaError) setVlanVisitaError(''); }} error={vlanVisitaError} />}

          {pideSerial && (
            <SerialEquipoCampo
              nuevo={cambioEquipo}
              serial={serialEquipo}
              onSerial={(v) => { setSerialEquipo(v); if (serialEquipoError) setSerialEquipoError(''); }}
              error={serialEquipoError}
              verificar
              tipoEquipo={tipoEquipo}
              onTipoEquipo={cambioEquipo ? (v) => { setTipoEquipo(v); if (tipoEquipoError) setTipoEquipoError(''); } : null}
              errorTipo={tipoEquipoError}
            />
          )}

          {esVisitaConector(tipoVisita) && (
            <CantidadesConectorVisita
              interno={avisaCobroAlPreFinalizar(tipoVisita)}
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
              metrajeInicial={metrajeInicial}
              onMetrajeInicial={(v) => { setMetrajeInicial(v); if (instalacionErrores.metrajeInicial) setInstalacionErrores((e) => ({ ...e, metrajeInicial: undefined })); }}
              metrajeFinal={metrajeFinal}
              onMetrajeFinal={(v) => { setMetrajeFinal(v); if (instalacionErrores.metrajeFinal) setInstalacionErrores((e) => ({ ...e, metrajeFinal: undefined })); }}
              metrajeExistente={metrajeExiste}
              onMetrajeExistente={(v) => { setMetrajeExiste(v); if (v) { setMetrajeInicial(''); setMetrajeFinal(''); } setInstalacionErrores((e) => ({ ...e, metrajeInicial: undefined, metrajeFinal: undefined })); }}
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
              className={claseCampo('grande', potenciaParseada.error ? 'error' : 'normal')}
            />
            <p id="pf-potencia-hint" role={potenciaParseada.error ? 'alert' : undefined} className={`text-[11px] max-lg:text-xs font-bold ml-1 ${potenciaParseada.error ? 'text-red-600 dark:text-red-400' : potenciaEval ? potenciaEval.clase : 'text-zinc-400 font-normal'}`}>
              {potenciaParseada.error || (potenciaEval ? potenciaEval.texto : 'Potencia recibida en la ONU. Si omites el signo se toma como negativa.')}
            </p>
            {ticket.cedula && <SenalSmartOlt ticketId={ticket.id} onCapturar={capturarSenal} />}
          </div>

          {observacionParaTecnico(ticket) && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">NOTA DE LA OFICINA</span>
              <p className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{observacionParaTecnico(ticket)}</p>
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
              className={`${claseArea('grande', obsError ? 'error' : 'normal')} resize-none`}
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
        datos={datosParaConfirmar(porConfirmar)}
        isSubmitting={isSubmitting}
        onCancel={() => setPorConfirmar(null)}
        onConfirm={confirmarPreFinalizar}
      />
    )}
    </>
  );
}
