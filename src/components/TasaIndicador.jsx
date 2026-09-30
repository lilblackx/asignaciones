import { Coins } from 'lucide-react';
import { getEstadoTasa, montoBsDe } from '../utils/tasa';

const CLASES_NIVEL = {
  ok: 'text-zinc-600 dark:text-zinc-400',
  aviso: 'text-amber-600 dark:text-amber-400 font-bold',
  alerta: 'text-red-600 dark:text-red-400 font-bold',
  sin: 'text-red-600 dark:text-red-400 font-bold',
};

// Tasa BCV a la vista: la plantilla de WhatsApp calcula el monto en Bs con ella,
// así que una tasa vieja significa cobros equivocados. Se marca en ámbar (de ayer)
// o rojo (2+ días). Si onClick existe (ADMIN) abre el modal de Tasa.
export default function TasaIndicador({ tasaConfig, onClick }) {
  const { nivel, dias } = getEstadoTasa(tasaConfig);
  const montoBs = montoBsDe(tasaConfig);
  const cuando = nivel === 'sin' ? null
    : dias === 0 ? `hoy ${new Date(tasaConfig.actualizadoEn).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`
      : dias === 1 ? 'de ayer' : `hace ${dias} días`;

  const contenido = (
    <>
      <Coins className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {nivel === 'sin' ? (
        <span>Tasa BCV sin configurar</span>
      ) : (
        <span>
          Tasa BCV {tasaConfig.tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {montoBs && <> · {montoBs} Bs</>} · {cuando}
        </span>
      )}
    </>
  );
  const clases = `inline-flex items-center gap-1 ${CLASES_NIVEL[nivel]}`;

  return onClick ? (
    <button type="button" onClick={onClick} title="Abrir configuración de la tasa" className={`${clases} hover:underline`}>{contenido}</button>
  ) : (
    <span className={clases}>{contenido}</span>
  );
}
