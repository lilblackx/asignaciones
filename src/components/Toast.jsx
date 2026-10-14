import { AlertCircle, Ban, Car, CheckCheck, CheckCircle2, Clock, Flag, MapPin, Undo2, UserCog, UserMinus, Wrench } from 'lucide-react';

export default function Toast({ toastMsg, onClose }) {
  if (!toastMsg) return null;

  const isError = toastMsg.type === 'error';
  const isPreFinalizado = toastMsg.type === 'prefinalizado';
  const isTecnicoStatus = toastMsg.type === 'tecnicoStatus';
  const isAprobado = toastMsg.type === 'aprobado';
  const isNuevaAsignacion = toastMsg.type === 'nuevaAsignacion';
  const isAviso = toastMsg.type === 'aviso';
  const isDevuelto = toastMsg.type === 'devuelto';
  const isPrioridad = toastMsg.type === 'prioridad';
  const isCancelada = toastMsg.type === 'cancelada';
  const isDesasignada = toastMsg.type === 'desasignada';
  const isEnCamino = toastMsg.type === 'encamino';
  const isLlegada = toastMsg.type === 'llegada';
  const accion = toastMsg.action;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[120] animate-fade-in-up w-[92vw] sm:w-auto sm:max-w-sm px-2 pointer-events-none" role="status" aria-live="polite" aria-atomic="true">
      <div className={`px-5 py-3 rounded-2xl shadow-xl flex items-start gap-2.5 font-bold text-sm ${
        isError || isDevuelto || isCancelada || isDesasignada ? 'bg-red-600 text-white'
          : isPrioridad ? 'bg-red-700 text-white ring-2 ring-white/70'
          : isEnCamino ? 'bg-sky-600 text-white'
          : isLlegada ? 'bg-teal-600 text-white'
          : isPreFinalizado || isAviso ? 'bg-amber-500 text-black'
            : isTecnicoStatus ? 'bg-purple-600 text-white'
              : isAprobado ? 'bg-blue-600 text-white'
                : isNuevaAsignacion ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 border border-zinc-700 dark:border-zinc-200 text-white'
      }`}>
        {isPrioridad ? <Flag className="w-4 h-4 shrink-0 mt-0.5 fill-current" aria-hidden="true" />
          : isDevuelto ? <Undo2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isEnCamino ? <Car className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isLlegada ? <MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isCancelada ? <Ban className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isDesasignada ? <UserMinus className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          : isError || isAviso ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
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
            className="shrink-0 ml-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-black transition-colors pointer-events-auto"
          >
            {accion.label}
          </button>
        )}
      </div>
    </div>
  );
}
