import { useState } from 'react';
import { BellOff, BellRing, X } from 'lucide-react';
import Colapsable from './Colapsable';
import Spinner from './Spinner';

// Sin permiso de notificaciones el dispositivo no recibe nada con la app cerrada o el
// teléfono bloqueado, y la persona no tiene cómo saberlo. Este aviso lo hace visible y
// deja activarlas con un toque (pedir el permiso exige que lo toque la persona).
const esMovil = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// `avisarFallo`: mostrar también el aviso de "no quedó registrado". Se reserva a quien depende
// del push (el técnico); en una PC un fallo de registro se queda en la consola.
export default function AvisoNotificaciones({ permiso, registro, detalleError, onActivar, avisarFallo = false }) {
  const [descartado, setDescartado] = useState(false);
  const [activando, setActivando] = useState(false);

  const activar = async () => {
    setActivando(true);
    await onActivar();
    setActivando(false);
  };

  const aviso = () => {
    if (permiso === 'default' && !descartado) {
      return (
        <div role="status" className="mb-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200">
          <BellRing className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="flex-1 font-bold leading-snug">{esMovil() ? 'Activa las notificaciones para enterarte al instante de tus órdenes, incluso con el teléfono bloqueado.' : 'Activa las notificaciones para enterarte al instante de las órdenes, aunque la pestaña esté cerrada.'}</p>
          <button type="button" onClick={activar} disabled={activando} className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black disabled:opacity-60">
            {activando && <Spinner />}{activando ? 'Activando...' : 'Activar'}
          </button>
          <button type="button" onClick={() => setDescartado(true)} aria-label="Ahora no" title="Ahora no" className="shrink-0 p-1 rounded hover:bg-amber-200/60 dark:hover:bg-amber-900/40">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      );
    }

    if (permiso === 'denied') {
      return (
        <div role="alert" className="mb-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-3 text-xs text-red-900 dark:text-red-200">
          <BellOff className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" aria-hidden="true" />
          <p className="font-bold leading-snug">
            Las notificaciones están bloqueadas: no te enteras de órdenes nuevas con la app cerrada. Actívalas en los ajustes del navegador o de la app (Notificaciones, Permitir) y vuelve a abrir la app.
          </p>
        </div>
      );
    }

    if (permiso === 'granted' && registro === 'error' && avisarFallo) {
      return (
        <div role="alert" className="mb-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200">
          <BellOff className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="flex-1 font-bold leading-snug">
            Este dispositivo no quedó registrado para recibir avisos con la app cerrada.
            {detalleError && <span className="block font-normal opacity-80 mt-0.5">Detalle: {detalleError}</span>}
          </p>
          <button type="button" onClick={activar} disabled={activando} className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black disabled:opacity-60">
            {activando && <Spinner />}{activando ? 'Reintentando...' : 'Reintentar'}
          </button>
        </div>
      );
    }

    return null;
  };

  return <Colapsable>{aviso()}</Colapsable>;
}
