import { useState } from 'react';
import { Car, MapPin, Undo2, X } from 'lucide-react';
import { ESTADO_EN_SITIO, estadoViaje, puedeIniciarViaje, tiempoTranscurrido } from '../utils/enCamino';

// Etiqueta que ve la oficina bajo el técnico: "EN CAMINO · hace 12 min" o "EN SITIO · hace 5 min".
export function EtiquetaViaje({ ticket, ahora, className = '' }) {
  const estado = estadoViaje(ticket, ahora);
  if (!estado) return null;
  const enSitio = estado === ESTADO_EN_SITIO;
  const desde = enSitio ? ticket.enCamino.llegoEn : ticket.enCamino.desde;
  return (
    <span
      className={`inline-flex flex-wrap items-center justify-center gap-x-1 text-[9px] font-black tracking-wide px-1.5 py-0.5 rounded text-white leading-tight text-center ${enSitio ? 'bg-teal-600' : 'bg-sky-600'} ${className}`}
      title={`${ticket.tecnico} ${enSitio ? 'llegó al sitio' : 'va en camino'} (${tiempoTranscurrido(desde, ahora)})`}
    >
      {/* Si no cabe en una línea, se parte entre la etiqueta y la hora, nunca en medio de una de las dos. */}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {enSitio ? <MapPin className="w-2.5 h-2.5" aria-hidden="true" /> : <Car className="w-2.5 h-2.5" aria-hidden="true" />}
        {enSitio ? 'EN SITIO' : 'EN CAMINO'}
      </span>
      <span className="whitespace-nowrap font-bold opacity-90">{tiempoTranscurrido(desde, ahora)}</span>
    </span>
  );
}

// Lo que ve el técnico en su orden pendiente: "Estoy en camino" → panel EN CAMINO ("Llegué" / "Cancelar") →
// panel EN SITIO ("Deshacer"). `compact`: versión de una línea para la tabla de escritorio.
export default function ViajeControl({ ticket, ahora, onIniciar, onLlegue, onCancelar, compact = false }) {
  const [ocupado, setOcupado] = useState(false);
  const estado = estadoViaje(ticket, ahora);
  const orden = ticket.codigo || ticket.id;

  // Evita que un doble toque guarde dos veces la misma acción.
  const ejecutar = (accion) => async () => {
    if (ocupado) return;
    setOcupado(true);
    try { await accion(ticket); } finally { setOcupado(false); }
  };

  if (!estado) {
    if (!puedeIniciarViaje(ticket, ahora)) return null;
    return (
      <button
        type="button"
        onClick={ejecutar(onIniciar)}
        disabled={ocupado}
        aria-label={`Avisar que vas en camino a la orden ${orden}`}
        className={compact
          ? 'inline-flex items-center gap-1 self-start text-[10px] font-bold px-2 py-1 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors disabled:opacity-60'
          : 'w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-black text-base transition-colors disabled:opacity-60'}
      >
        <Car className={compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} aria-hidden="true" /> Estoy en camino
      </button>
    );
  }

  const enSitio = estado === ESTADO_EN_SITIO;
  const desde = enSitio ? ticket.enCamino.llegoEn : ticket.enCamino.desde;
  const tono = enSitio
    ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-300'
    : 'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300';
  const Icono = enSitio ? MapPin : Car;
  const boton = compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-sm';
  const icono = compact ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <div className={`border rounded-xl ${compact ? 'px-2 py-1.5' : 'p-3'} flex flex-col gap-2 ${tono}`} role="status">
      <div className="flex items-center gap-2 font-black leading-tight">
        <Icono className={compact ? 'w-3.5 h-3.5 shrink-0' : 'w-5 h-5 shrink-0'} aria-hidden="true" />
        <span className={compact ? 'text-[10px]' : 'text-sm'}>
          {enSitio ? 'EN SITIO' : 'EN CAMINO'}
          <span className="font-bold opacity-80"> · {enSitio ? 'llegaste' : 'saliste'} {tiempoTranscurrido(desde, ahora)}</span>
        </span>
      </div>
      <div className="flex gap-2">
        {!enSitio && (
          <button
            type="button"
            onClick={ejecutar(onLlegue)}
            disabled={ocupado}
            aria-label={`Avisar que llegaste a la orden ${orden}`}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-black transition-colors disabled:opacity-60 ${boton}`}
          >
            <MapPin className={icono} aria-hidden="true" /> Llegué
          </button>
        )}
        <button
          type="button"
          onClick={ejecutar(onCancelar)}
          disabled={ocupado}
          aria-label={enSitio ? `Deshacer la llegada a la orden ${orden}` : `Cancelar el viaje a la orden ${orden}`}
          className={`${enSitio ? 'flex-1' : ''} inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/70 dark:bg-zinc-900/60 border border-current/30 font-bold hover:bg-white dark:hover:bg-zinc-900 transition-colors disabled:opacity-60 ${boton}`}
        >
          {enSitio ? <><Undo2 className={icono} aria-hidden="true" /> Deshacer</> : <><X className={icono} aria-hidden="true" /> Cancelar</>}
        </button>
      </div>
    </div>
  );
}
