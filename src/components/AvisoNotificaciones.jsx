import { useState } from 'react';
import { BellOff, BellRing } from 'lucide-react';
import Colapsable from './Colapsable';
import Aviso from './Aviso';
import { explicarFalloPush } from '../utils/fallosPush';

// Sin permiso de notificaciones el dispositivo no recibe nada con la app cerrada o el
// teléfono bloqueado, y la persona no tiene cómo saberlo. Este aviso lo hace visible y
// deja activarlas con un toque (pedir el permiso exige que lo toque la persona). No se puede ocultar: sale mientras el permiso siga sin activar.
const esMovil = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// `avisarFallo`: mostrar también el aviso de "no quedó registrado". Se reserva a quien depende
// del push (el técnico); en una PC un fallo de registro se queda en la consola, salvo en Brave (`brave`): ahí se explica siempre qué ajuste cambiar,
// porque es lo que más se les escapa y la persona cree que las notificaciones están activas.
export default function AvisoNotificaciones({ permiso, registro, detalleError, brave = false, onActivar, avisarFallo = false }) {
  const [activando, setActivando] = useState(false);

  const activar = async () => {
    setActivando(true);
    await onActivar();
    setActivando(false);
  };

  const aviso = () => {
    if (permiso === 'default') {
      return (
        <Aviso
          className="mb-3"
          nivel="atencion"
          icono={BellRing}
          titulo={esMovil() ? 'Activa las notificaciones para enterarte al instante de tus órdenes, incluso con el teléfono bloqueado.' : 'Activa las notificaciones para enterarte al instante de las órdenes, aunque la pestaña esté cerrada.'}
          accion={{ etiqueta: activando ? 'Activando...' : 'Activar', onClick: activar, deshabilitada: activando }}
        />
      );
    }

    if (permiso === 'denied') {
      return (
        <Aviso className="mb-3" nivel="error" icono={BellOff} titulo="Las notificaciones están bloqueadas: no te enteras de órdenes nuevas con la app cerrada.">
          Actívalas en los ajustes del navegador o de la app (Notificaciones, Permitir) y vuelve a abrir la app.
        </Aviso>
      );
    }

    if (permiso === 'granted' && registro === 'error' && (avisarFallo || brave)) {
      const explicacion = explicarFalloPush({ brave, detalle: detalleError });
      return (
        <Aviso
          className="mb-3"
          nivel="atencion"
          role="alert"
          icono={BellOff}
          titulo={explicacion?.titulo || 'Este dispositivo no quedó registrado para recibir avisos con la app cerrada.'}
          plegable={Boolean(explicacion)}
          accion={{ etiqueta: activando ? 'Reintentando...' : 'Reintentar', onClick: activar, deshabilitada: activando }}
        >
          {explicacion && (
            <ol className="list-decimal pl-4 mt-1 space-y-0.5 whitespace-normal">
              {explicacion.pasos.map((paso) => <li key={paso}>{paso}</li>)}
            </ol>
          )}
          {detalleError && <span className="block opacity-80 mt-1">Detalle: {detalleError}</span>}
        </Aviso>
      );
    }

    return null;
  };

  return <Colapsable>{aviso()}</Colapsable>;
}
