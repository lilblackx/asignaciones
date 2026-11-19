import { observacionParaTecnico } from '../../utils/observacion';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, MapPin, Plug, Tag, Wrench } from 'lucide-react';
import Modal from '../Modal';
import AsistentePasos, { BotonesPasos } from '../AsistentePasos';
import { usePasosAsistente } from '../../hooks/usePasosAsistente';
import { motivoNoSePuedeLlegar } from '../../utils/pasos';
import { ETIQUETA_PASO_PREFINALIZAR, pasosDePreFinalizar } from '../../utils/pasosPreFinalizar';
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
import Aviso from '../Aviso';
import BotonCerrar from '../BotonCerrar';
import { oracion } from '../../utils/oracion';

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

  // Los pasos del formulario (ver utils/pasosPreFinalizar): una instalación siempre tiene los mismos; en una visita dependen del tipo que se elige en el primer paso.
  const ordenEsInstalacion = trabajoEsInstalacion(ticket?.tipoTrabajo);
  const claves = pasosDePreFinalizar({ instalacion: ordenEsInstalacion, tipoVisita: ordenEsInstalacion ? '' : tipoVisitaElegido });
  const nav = usePasosAsistente(claves);

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

  // Lo que se revisa del formulario, sin tocar el estado: lo leído de cada campo y los problemas que hay, en el orden de los pasos y, dentro de cada paso, en el del formulario. Cada problema dice en qué paso se arregla
  // y en qué campo (`id`) va el cursor. NAP y puerto están en el paso del equipo (instalación) o en el de los datos (visita).
  const pasoDeNap = esInstalacion ? 'equipo' : 'datos';
  const evaluar = () => {
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
    const faltaObs = !observacion.trim();
    const idConectorInst = { externoVerde: 'pf-cant-ext-verde', internoVerde: 'pf-cant-int-verde', internoAzul: 'pf-cant-int-azul' }[conectoresInst?.campo];
    const problemas = [
      [errorVisita, 'orden', 'pf-tipo-visita'],
      [metrosParseados?.errores?.inicial, 'datos', 'pf-metros-inicial'],
      [metrosParseados?.errores?.final, 'datos', 'pf-metros-final'],
      [vlanVisitaParseada?.error, 'datos', 'pf-vlan-visita'],
      [errorTipoEquipo, 'datos', 'pf-tipo-equipo'],
      [serialEquipoParseado?.error, 'datos', 'pf-serial-equipo'],
      [instalacion?.errores.serial, 'equipo', 'pf-serial'],
      [instalacion?.errores.vlan, 'equipo', 'pf-vlan'],
      [faltaNap, pasoDeNap, 'pf-nap'],
      [faltaPuerto, pasoDeNap, 'pf-puerto'],
      [instalacion?.errores.metrajeInicial || instalacion?.errores.metraje, 'cable', 'pf-metraje-inicial'],
      [instalacion?.errores.metrajeFinal, 'cable', 'pf-metraje-final'],
      [instalacion?.errores.posteadura, 'cable', 'pf-poste-1'],
      [instalacion?.errores.puertosDisponibles, 'cable', 'pf-puertos-disponibles'],
      [conectoresInst?.error, 'cable', idConectorInst],
      [errorCantidad, 'conectores', cantidades.campo === 'azul' ? 'pf-cant-azul' : 'pf-cant-verde'],
      [potenciaParseada.error, 'cierre', 'pf-potencia'],
      [faltaObs, 'cierre', 'pf-obs'],
    ].filter(([hay]) => Boolean(hay)).map(([, paso, id]) => ({ paso, id }));
    return { metrosParseados, cantidades, errorCantidad, serialEquipoParseado, errorTipoEquipo, vlanVisitaParseada, instalacion, conectoresInst, faltaNap, faltaPuerto, errorVisita, faltaObs, problemas };
  };

  // Muestra los problemas de los pasos indicados (todos si no se indica ninguno); los demás errores en pantalla no se tocan.
  const CLAVES_INSTALACION = { equipo: ['serial', 'vlan'], cable: ['metrajeInicial', 'metrajeFinal', 'metraje', 'posteadura', 'puertosDisponibles'] };
  const aplicarErrores = (ev, pasosDestino = null) => {
    const en = (...pasos) => !pasosDestino || pasos.some((p) => pasosDestino.includes(p));
    if (en('orden')) setTipoVisitaError(ev.errorVisita);
    if (en('datos')) {
      setMetrosError(ev.metrosParseados?.errores || {});
      setSerialEquipoError(ev.serialEquipoParseado?.error || '');
      setTipoEquipoError(ev.errorTipoEquipo);
      setVlanVisitaError(ev.vlanVisitaParseada?.error || '');
    }
    if (en('conectores')) setCantidadError({ campo: ev.cantidades.campo || '', mensaje: ev.errorCantidad });
    if (en(pasoDeNap)) {
      setNapError(ev.faltaNap ? 'Indica la nomenclatura real de la NAP (no vale "SN").' : '');
      setPuertoError(ev.faltaPuerto ? 'Indica el puerto.' : '');
    }
    if (en('equipo', 'cable')) {
      setInstalacionErrores((previos) => {
        const siguiente = { ...previos };
        ['equipo', 'cable'].filter((paso) => en(paso)).forEach((paso) => CLAVES_INSTALACION[paso].forEach((k) => { siguiente[k] = ev.instalacion?.errores?.[k]; }));
        return siguiente;
      });
    }
    if (en('cable')) setConectoresInstError({ campo: ev.conectoresInst?.campo || '', mensaje: ev.conectoresInst?.error || '' });
    if (en('cierre')) setObsError(ev.faltaObs ? 'Debes describir el trabajo realizado antes de pre-finalizar.' : '');
  };

  // Siguiente: revisa solo lo de este paso; si hay problemas los muestra y lleva el cursor al primero, y si no, avanza.
  const siguientePaso = () => {
    const ev = evaluar();
    aplicarErrores(ev, [nav.clave]);
    const propio = ev.problemas.find((p) => p.paso === nav.clave);
    if (propio) { document.getElementById(propio.id)?.focus(); return; }
    nav.siguiente();
  };

  // Con un problema en otro paso se va a ese paso (y el cursor al campo cuando ya se ve).
  const irAlPaso = (clavePaso, despues) => {
    if (nav.clave !== clavePaso && claves.includes(clavePaso)) {
      nav.ir(clavePaso);
      if (despues) setTimeout(despues, 320);
    } else if (despues) despues();
  };

  // Lo obligatorio de cada paso, sin mostrar nada en pantalla: sin cumplirlo no se llega a un paso posterior con el indicador de pasos (se ve con candado).
  const evaluacion = evaluar();
  const motivoDelPaso = (clavePaso) => (evaluacion.problemas.some((p) => p.paso === clavePaso) ? 'Completa lo obligatorio de este paso para continuar.' : '');
  const bloqueoParaLlegar = (destino) => motivoNoSePuedeLlegar(claves, nav.clave, destino, motivoDelPaso);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const ev = evaluar();
    aplicarErrores(ev, null);
    if (ev.problemas.length > 0) {
      const primero = ev.problemas[0];
      irAlPaso(primero.paso, () => document.getElementById(primero.id)?.focus());
      return;
    }
    const { metrosParseados, cantidades, serialEquipoParseado, vlanVisitaParseada, instalacion, conectoresInst } = ev;
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

  const encabezado = (
        <div className="encabezado-d bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-white">Pre-finalizar</h2>
            <p className="text-xs text-zinc-300 mt-1 truncate">
              {ticket.codigo || 'S/C'} · {ticket.nombre}
            </p>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>
  );
  const bloqueResumen = (
    <>
          {/* Resumen compacto de la orden */}
          <div className="bg-sunken p-3 rounded-campo border border-border space-y-1.5 text-xs text-card-foreground">
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-red-700 dark:text-red-400 shrink-0" />
              <span className="font-bold text-red-700 dark:text-red-400">{oracion(ticket.tipoTrabajo)}</span>
              {ticket.falla && <span className="text-muted-foreground">({ticket.falla})</span>}
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="line-clamp-2">{ticket.direccion}</span>
            </div>
            {ticket.cedula && (
              <div className="flex items-center gap-2 text-etiqueta text-muted-foreground">
                <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                <span>C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</span>
                {ticket.telefono && <span className="ml-2">Telf: {ticket.telefono}</span>}
              </div>
            )}
            <ContactoCliente telefono={ticket.telefono} ubicacion={ticket.ubicacion} napCoordenadas={ticket.napCoordenadas} nombre={ticket.nombre} className="pt-1" />
          </div>
    </>
  );
  const bloqueTipoVisita = (
    <>
          {!esInstalacion && (
          <div className="space-y-1">
            <label htmlFor="pf-tipo-visita" className="text-xs font-bold text-card-foreground ml-1">
              Tipo de visita <span className="font-normal text-red-700 dark:text-red-400">(obligatorio)</span>
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
            {tipoVisitaError && <p role="alert" className="text-etiqueta text-red-700 dark:text-red-400 font-bold ml-1">{tipoVisitaError}</p>}
          </div>
          )}
    </>
  );
  const bloqueAvisoCobro = (
    <>
          {llevaCobro({ tipoTrabajo: ticket.tipoTrabajo }) && (
            <Aviso nivel="info" icono={Plug} compact>{conceptoCobro({ tipoTrabajo: ticket.tipoTrabajo, tipoVisita })}: cuando se finalice la orden, verás el cobro resultante para el cliente.</Aviso>
          )}
    </>
  );
  const bloqueNotaOficina = (
    <>
          {observacionParaTecnico(ticket) && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-card-foreground ml-1">Nota de la oficina</span>
              <p className="w-full bg-zinc-100 dark:bg-zinc-900 border border-border px-3 py-2.5 rounded-campo text-xs text-card-foreground whitespace-pre-wrap break-words">{observacionParaTecnico(ticket)}</p>
            </div>
          )}
    </>
  );
  // Recableado: el metraje y la consulta de cobro van en el paso de datos; los colores de los conectores, en el de conectores.
  const bloqueRecabladoDatos = (
    <>
      {recableado && (
            <div className="space-y-4 rounded-campo border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
              <div className="space-y-1">
                <p className="text-xs font-bold text-card-foreground ml-1">
                  Metraje del cable <span className="font-normal text-muted-foreground">marca del cable al empezar y al terminar</span>
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
        </div>
      )}
    </>
  );
  const bloqueRecabladoConectores = (
    <>
      {recableado && (
            <div className="space-y-4 rounded-campo border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
              <ConectoresRecableado colorExterno={colorExterno} colorInterno={colorInterno} onExterno={setColorExterno} onInterno={setColorInterno} />
        </div>
      )}
    </>
  );
  const bloqueVlanVisita = (
    <>
          {configVlan && <VlanVisitaCampo vlan={vlanVisita} onVlan={(v) => { setVlanVisita(v); if (vlanVisitaError) setVlanVisitaError(''); }} error={vlanVisitaError} />}
    </>
  );
  const bloqueSerialEquipo = (
    <>
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
    </>
  );
  const bloqueNapPuertoVisita = (
    <>
      {!esInstalacion && visitaConNapPuerto && (
            <NapPuertoCampos
              nap={nap}
              onNap={(v) => { setNap(v); if (napError) setNapError(''); }}
              napError={napError}
              puerto={puerto}
              onPuerto={(v) => { setPuerto(v); if (puertoError) setPuertoError(''); }}
              puertoError={puertoError}
            />
      )}
    </>
  );
  const bloqueCantidadesVisita = (
    <>
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
    </>
  );
  const bloqueEquipoInstalacion = (
            <DatosInstalacion parte="equipo"
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
  );
  const bloqueCableInstalacion = (
    <>
            <DatosInstalacion parte="cable"
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
  );
  const bloquePotencia = (
          <div className="space-y-1">
            <label htmlFor="pf-potencia" className="text-xs font-bold text-card-foreground ml-1">
              Potencia óptica (dBm) <span className="font-normal text-muted-foreground">(opcional)</span>
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
            <p id="pf-potencia-hint" role={potenciaParseada.error ? 'alert' : undefined} className={`text-etiqueta font-bold ml-1 ${potenciaParseada.error ? 'text-red-700 dark:text-red-400' : potenciaEval ? potenciaEval.clase : 'text-muted-foreground font-normal'}`}>
              {potenciaParseada.error || (potenciaEval ? potenciaEval.texto : 'Potencia recibida en la ONU. Si omites el signo se toma como negativa.')}
            </p>
            {ticket.cedula && <SenalSmartOlt ticketId={ticket.id} onCapturar={capturarSenal} />}
          </div>
  );
  const bloqueReporteAnterior = (
    <>
          {devolucionPendiente(ticket) && ticket.observacionTecnico?.trim() && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-card-foreground ml-1">Tu reporte anterior</span>
              <p className="w-full bg-zinc-100 dark:bg-zinc-900 border border-border px-3 py-2.5 rounded-campo text-xs text-card-foreground whitespace-pre-wrap break-words">{ticket.observacionTecnico}</p>
            </div>
          )}
    </>
  );
  const bloqueObservacion = (
          <div className="space-y-1">
            <label htmlFor="pf-obs"className="text-xs font-bold text-card-foreground ml-1">
              Observación / detalles del trabajo <span className="font-normal text-red-700 dark:text-red-400">(obligatorio)</span>
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
            {obsError && <p role="alert" className="text-etiqueta text-red-700 dark:text-red-400 font-bold ml-1">{obsError}</p>}
          </div>
  );
  const bloqueAvisoPre = (
          <Aviso nivel="atencion" icono={AlertCircle} compact>Esta orden quedará en estado <strong>pre-finalizada</strong> para que el administrador u operador revise y realice la finalización definitiva.</Aviso>
  );

  // El contenido de cada paso. Si la oficina devolvió la orden, su motivo se ve completo en el primer paso y resumido en los demás.
  const aviso = <DevolucionAviso ticket={ticket} compact />;
  const contenidoDelPaso = {
    orden: (
      <>
        {borrador && (
          <Aviso nivel="atencion" compact titulo="Recuperamos lo que llevabas escrito"
            accion={{ etiqueta: "Descartar y empezar de nuevo", onClick: onDescartarBorrador }}>
            {borrador.version !== versionDeOrden(ticket) && <span>La oficina cambió esta orden mientras tanto: revisa los datos antes de enviar.</span>}
          </Aviso>
        )}
        <DevolucionAviso ticket={ticket} conValores />
        {bloqueResumen}
        {bloqueTipoVisita}
        {bloqueAvisoCobro}
        {bloqueNotaOficina}
      </>
    ),
    equipo: <>{aviso}{bloqueEquipoInstalacion}</>,
    cable: <>{aviso}{bloqueCableInstalacion}</>,
    datos: (
      <>
        {aviso}
        {bloqueRecabladoDatos}
        {bloqueVlanVisita}
        {bloqueSerialEquipo}
        {bloqueNapPuertoVisita}
      </>
    ),
    conectores: (
      <>
        {aviso}
        {bloqueRecabladoConectores}
        {bloqueCantidadesVisita}
      </>
    ),
    cierre: (
      <>
        {aviso}
        {bloquePotencia}
        {bloqueReporteAnterior}
        {bloqueObservacion}
        {bloqueAvisoPre}
      </>
    ),
  }[nav.clave];

  // Qué le dice la pantalla al técnico para seguir (va justo debajo del indicador de pasos).
  const indicacion = {
    orden: esInstalacion
      ? 'Revisa la orden y toca «Siguiente» para cargar los datos del equipo.'
      : tipoVisita ? 'Revisa la orden y toca «Siguiente» para cargar los datos de la visita.' : 'Revisa la orden y elige el tipo de visita para seguir.',
    equipo: 'Anota el serial del equipo, la VLAN y la NAP con su puerto.',
    cable: 'Anota el metraje del drop, la posteadura, los puertos disponibles y los conectores que usaste.',
    datos: 'Anota los datos de esta visita.',
    conectores: 'Indica los conectores que usaste.',
    cierre: 'Describe el trabajo y toca «Confirmar» para pre-finalizar la orden.',
  }[nav.clave];

  const pie = nav.esUltimo ? (
    <BotonesPasos
      onAnterior={nav.hayAnterior ? nav.anterior : null}
      siguiente={{ onClick: handleSubmit, texto: isSubmitting ? 'Guardando...' : 'Confirmar', icono: CheckCircle2, tono: 'ambar', disabled: isSubmitting, ocupado: isSubmitting ? <Spinner /> : null }}
    />
  ) : (
    <BotonesPasos onAnterior={nav.hayAnterior ? nav.anterior : null} siguiente={{ onClick: siguientePaso }} />
  );

  return (
    <>
    {/* Con la confirmación abierta, Escape cierra solo la confirmación y no pierde lo escrito en el formulario. */}
    <Modal onClose={() => { if (!porConfirmar) onClose(); }} zIndexClass="z-50">
      <AsistentePasos
        clasePanel="w-full max-w-lg h-[min(92dvh,50rem)] border border-border"
        etiquetaPasos="Pasos para pre-finalizar la orden"
        pasos={claves.map((clave) => ({ clave, etiqueta: ETIQUETA_PASO_PREFINALIZAR[clave] }))}
        actual={nav.clave}
        onElegir={(destino) => { if (!bloqueoParaLlegar(destino)) nav.ir(destino); }}
        bloqueo={bloqueoParaLlegar}
        encabezado={encabezado}
        indicacion={indicacion}
        pie={pie}
      >
        {/* noValidate: las faltas las revisa cada paso al pulsar Siguiente (y todo al confirmar), que muestra los errores y lleva el cursor al primero. Enter avanza. */}
        <form onSubmit={(e) => { e.preventDefault(); if (nav.esUltimo) handleSubmit(); else siguientePaso(); }} noValidate className="p-4 sm:p-5 space-y-4">
          {contenidoDelPaso}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Continuar</button>
        </form>
      </AsistentePasos>
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
