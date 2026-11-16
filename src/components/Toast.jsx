import { useEffect, useRef, useState } from 'react';
import { sacudirVentanaDeLaUltimaAccion } from '../utils/sacudidaErrores';
import { AlertCircle, Ban, Banknote, Car, CheckCheck, CheckCircle2, Clock, Flag, HardHat, MapPin, Star, Undo2, UserCog, UserMinus, Wrench } from 'lucide-react';

const DURACION_SALIDA_MS = 200;
// Cuánto hay que deslizar el aviso para quitarlo (a un lado o hacia abajo), y cuánto dura la salida animada.
const DISTANCIA_PARA_QUITAR = 80;
const DURACION_DESLIZAR_MS = 160;
const SIN_ARRASTRE = { x: 0, y: 0, suelto: false };

export default function Toast({ toastMsg: entrante, onClose }) {
  // El padre quita el aviso poniéndolo en null; aquí se conserva el último unos instantes para poder animar su salida.
  const [mostrado, setMostrado] = useState(entrante);
  const [saliendo, setSaliendo] = useState(false);
  // El aviso se quita deslizándolo con el dedo (o el ratón): acompaña al dedo, y al soltar se va si pasó de cierta distancia o vuelve a su sitio.
  const [arrastre, setArrastre] = useState(SIN_ARRASTRE);
  const inicio = useRef(null);
  // El aviso que hay ahora: al terminar de deslizar uno, no se cierra otro que llegó en esos instantes.
  const vigente = useRef(entrante);
  useEffect(() => { vigente.current = entrante; });
  if (entrante && entrante !== mostrado) {
    setMostrado(entrante);
    setSaliendo(false);
    setArrastre(SIN_ARRASTRE);
  } else if (!entrante && mostrado && !saliendo) {
    setSaliendo(true);
  }

  useEffect(() => {
    if (!saliendo) return;
    const id = setTimeout(() => { setMostrado(null); setSaliendo(false); }, DURACION_SALIDA_MS);
    return () => clearTimeout(id);
  }, [saliendo]);

  // Un error que llega justo después de pulsar la acción de una ventana abierta sacude esa ventana.
  useEffect(() => {
    if (entrante?.type === 'error') sacudirVentanaDeLaUltimaAccion();
  }, [entrante]);

  const toastMsg = entrante || mostrado;
  if (!toastMsg) return null;

  const isError = toastMsg.type === 'error';
  const isPreFinalizado = toastMsg.type === 'prefinalizado';
  const isTecnicoStatus = toastMsg.type === 'tecnicoStatus';
  const isAprobado = toastMsg.type === 'aprobado';
  const isNuevaAsignacion = toastMsg.type === 'nuevaAsignacion';
  const isNuevaVenta = toastMsg.type === 'nuevaVenta';
  const isAviso = toastMsg.type === 'aviso';
  const isDevuelto = toastMsg.type === 'devuelto';
  const isPrioridad = toastMsg.type === 'prioridad';
  const isCancelada = toastMsg.type === 'cancelada';
  const isDesasignada = toastMsg.type === 'desasignada';
  const isEnCamino = toastMsg.type === 'encamino';
  const isLlegada = toastMsg.type === 'llegada';
  const isConsultaCobro = toastMsg.type === 'consultaCobro';
  const isRespuestaCobro = toastMsg.type === 'respuestaCobro';
  const isInfraestructura = toastMsg.type === 'infraestructura';
  const isPago = toastMsg.type === 'pagoCliente' || toastMsg.type === 'pagoTecnico' || toastMsg.type === 'adelantoTecnico' || toastMsg.type === 'descuentoTecnico' || toastMsg.type === 'ajusteTecnico';
  const accion = toastMsg.action;

  // El botón de acción del aviso (si lo tiene) sigue siendo un botón: no empieza un deslizamiento.
  const alBajar = (e) => {
    if (e.target.closest?.('button')) return;
    inicio.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const alMover = (e) => {
    if (!inicio.current) return;
    setArrastre({ x: e.clientX - inicio.current.x, y: Math.max(0, e.clientY - inicio.current.y), suelto: false });
  };
  const alSoltar = (e, cancelado = false) => {
    if (!inicio.current) return;
    const x = e.clientX - inicio.current.x;
    const y = Math.max(0, e.clientY - inicio.current.y);
    inicio.current = null;
    if (!cancelado && (Math.abs(x) > DISTANCIA_PARA_QUITAR || y > DISTANCIA_PARA_QUITAR)) {
      // Se va hacia donde lo llevaron: a un lado, o hacia abajo.
      const aLoLado = Math.abs(x) >= y;
      setArrastre({ x: aLoLado ? Math.sign(x) * window.innerWidth : 0, y: aLoLado ? 0 : 160, suelto: true, fuera: true });
      const quitado = entrante;
      setTimeout(() => { if (vigente.current === quitado) onClose?.(); }, DURACION_DESLIZAR_MS);
    } else {
      setArrastre({ x: 0, y: 0, suelto: true });
    }
  };
  const lejos = Math.min(1, Math.hypot(arrastre.x, arrastre.y) / (window.innerWidth * 0.6));

  return (
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[120] ${saliendo ? 'animate-fade-out-down' : 'animate-fade-in-up'} w-[92vw] sm:w-auto sm:max-w-sm px-2 pointer-events-none`} role="status" aria-live="polite" aria-atomic="true">
      <div
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={(e) => alSoltar(e, true)}
        style={{
          transform: `translate3d(${arrastre.x}px, ${arrastre.y}px, 0)`,
          opacity: arrastre.fuera ? 0 : 1 - lejos * 0.6,
          transition: arrastre.suelto ? `transform ${DURACION_DESLIZAR_MS}ms ease-out, opacity ${DURACION_DESLIZAR_MS}ms ease-out` : 'none',
          touchAction: 'none',
        }}
        className={`pointer-events-auto select-none cursor-grab active:cursor-grabbing px-5 py-3 rounded-2xl shadow-xl flex items-start gap-2.5 font-bold text-sm ${
        isError || isDevuelto || isCancelada || isDesasignada ? 'bg-red-600 text-white'
          : isPrioridad ? 'bg-red-700 text-white ring-2 ring-white/70'
          : isEnCamino ? 'bg-sky-700 text-white'
          : isLlegada ? 'bg-teal-700 text-white'
          : isRespuestaCobro ? 'bg-sky-700 text-white'
          : isPago ? 'bg-emerald-700 text-white'
          : isInfraestructura ? 'bg-orange-600 text-white'
          : isPreFinalizado || isAviso || isConsultaCobro || isNuevaVenta ? 'bg-amber-500 text-black'
            : isTecnicoStatus ? 'bg-purple-600 text-white'
              : isAprobado ? 'bg-blue-600 text-white'
                : isNuevaAsignacion ? 'bg-emerald-700 text-white'
                  : 'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 border border-zinc-700 dark:border-zinc-200 text-white'
      }`}>
        {isConsultaCobro || isRespuestaCobro || isPago ? <Banknote className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isPrioridad ? <Flag className="w-4 h-4 shrink-0 mt-0.5 fill-current" aria-hidden="true" />
          : isInfraestructura ? <HardHat className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isDevuelto ? <Undo2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isEnCamino ? <Car className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isLlegada ? <MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isCancelada ? <Ban className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isDesasignada ? <UserMinus className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isError || isAviso ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isNuevaVenta ? <Star className="w-4 h-4 shrink-0 mt-0.5 fill-current" aria-hidden="true" />
          : isPreFinalizado ? <Clock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            : isTecnicoStatus ? <UserCog className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              : isAprobado ? <CheckCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                : isNuevaAsignacion ? <Wrench className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />}
        <span className="leading-snug">{toastMsg.text}</span>
        {accion && (
          <button
            type="button"
            onClick={() => { onClose?.(); accion.onClick(); }}
            className="shrink-0 ml-1 px-2.5 py-1 rounded-boton bg-white/20 hover:bg-white/30 text-xs font-black transition-colors pointer-events-auto"
          >
            {accion.label}
          </button>
        )}
      </div>
    </div>
  );
}
