import { useEffect, useRef, useState } from 'react';
import { sacudirVentanaDeLaUltimaAccion } from '../utils/sacudidaErrores';
import { NIVELES } from './nivelesAviso';
import { AlertCircle, Ban, Banknote, Car, CheckCheck, CheckCircle2, Clock, Flag, HardHat, MapPin, Star, Undo2, UserCog, UserMinus, Wrench } from 'lucide-react';

// Cada tipo de aviso: su ícono y su nivel (el tono): error (rojo), atención (ámbar), info (azul) o éxito (verde), los mismos de los avisos de la app (ver nivelesAviso).
// Antes cada tipo tenía su propio color sólido (rojo, naranja, morado, turquesa...): ahora el aviso es una tarjeta clara con el ícono en un círculo del tono de su nivel.
const TIPOS = {
  error: { Icono: AlertCircle, nivel: 'error' },
  devuelto: { Icono: Undo2, nivel: 'error' },
  cancelada: { Icono: Ban, nivel: 'error' },
  desasignada: { Icono: UserMinus, nivel: 'error' },
  prioridad: { Icono: Flag, nivel: 'error', relleno: true },
  aviso: { Icono: AlertCircle, nivel: 'atencion' },
  prefinalizado: { Icono: Clock, nivel: 'atencion' },
  consultaCobro: { Icono: Banknote, nivel: 'atencion' },
  nuevaVenta: { Icono: Star, nivel: 'atencion', relleno: true },
  infraestructura: { Icono: HardHat, nivel: 'atencion' },
  ajusteTecnico: { Icono: Banknote, nivel: 'atencion' },
  descuentoTecnico: { Icono: Banknote, nivel: 'atencion' },
  encamino: { Icono: Car, nivel: 'info' },
  respuestaCobro: { Icono: Banknote, nivel: 'info' },
  adelantoTecnico: { Icono: Banknote, nivel: 'info' },
  tecnicoStatus: { Icono: UserCog, nivel: 'info' },
  aprobado: { Icono: CheckCheck, nivel: 'info' },
  llegada: { Icono: MapPin, nivel: 'exito' },
  pagoCliente: { Icono: Banknote, nivel: 'exito' },
  pagoTecnico: { Icono: Banknote, nivel: 'exito' },
  nuevaAsignacion: { Icono: Wrench, nivel: 'exito' },
};
const POR_DEFECTO = { Icono: CheckCircle2, nivel: 'exito' };

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

  const { Icono, nivel, relleno } = TIPOS[toastMsg.type] || POR_DEFECTO;
  const tono = NIVELES[nivel];
  const esPrioridad = toastMsg.type === 'prioridad';
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
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[120] ${saliendo ? 'animate-fade-out-down' : 'animate-fade-in-up'} w-[92vw] sm:w-auto sm:max-w-md px-2 pointer-events-none`} role="status" aria-live="polite" aria-atomic="true">
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
        className={`pointer-events-auto select-none cursor-grab active:cursor-grabbing pl-3 pr-4 py-3 rounded-card bg-card text-card-foreground border border-border shadow-2xl flex items-center gap-3 font-bold text-sm ${esPrioridad ? 'ring-2 ring-red-600' : ''}`}
      >
        <span aria-hidden="true" className={`shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center ${tono.tile}`}>
          <Icono className={`w-[18px] h-[18px] ${relleno ? 'fill-current' : ''}`} />
        </span>
        <span className="min-w-0 flex-1 leading-snug">{toastMsg.text}</span>
        {accion && (
          <button
            type="button"
            onClick={() => { onClose?.(); accion.onClick(); }}
            className={`shrink-0 ml-1 px-3.5 min-h-9 rounded-boton text-xs font-black transition-colors pointer-events-auto ${tono.boton}`}
          >
            {accion.label}
          </button>
        )}
      </div>
    </div>
  );
}
