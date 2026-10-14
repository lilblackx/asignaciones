import { useMemo } from 'react';
import { Car, MapPin } from 'lucide-react';
import { estaEnCamino, estaEnSitio } from '../utils/enCamino';

export default function TechnicianWorkload({ tickets, technicians, getTecnicoColor, canEditTickets, isTecnico, onToggleActivo, onOpenSinTecnico, ahora, onOpenViaje }) {
  // TECNICO solo recibe (por query scoping) su propio técnico en `technicians`,
  // así que dejarlo togglear acá nunca le da acceso al badge de otro.
  const canToggle = canEditTickets || isTecnico;
  const counts = useMemo(() => {
    const byTech = new Map(technicians.map(t => [t.name.toUpperCase(), 0]));
    tickets.forEach(t => {
      if (t.estado !== 'PENDIENTE' || !t.tecnico) return;
      const key = t.tecnico.toUpperCase();
      if (byTech.has(key)) byTech.set(key, byTech.get(key) + 1);
    });
    return technicians
      .map(t => ({ id: t.id, name: t.name, activo: t.activo !== false, count: byTech.get(t.name.toUpperCase()) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [technicians, tickets]);

  // Órdenes pendientes que aún esperan técnico: lo más urgente de asignar. Solo
  // lo ven quienes pueden asignar; el TECNICO no tiene qué hacer con esto.
  const sinTecnico = useMemo(
    () => (canEditTickets ? tickets.filter(t => t.estado === 'PENDIENTE' && !t.tecnico?.trim()).length : 0),
    [tickets, canEditTickets]
  );

  // Técnicos que avisaron que van en camino o que ya llegaron: solo lo ve quien coordina.
  const viajes = useMemo(() => {
    if (!canEditTickets) return { enCamino: 0, enSitio: 0 };
    return { enCamino: tickets.filter(t => estaEnCamino(t, ahora)).length, enSitio: tickets.filter(t => estaEnSitio(t, ahora)).length };
  }, [tickets, canEditTickets, ahora]);

  if (counts.length === 0 && sinTecnico === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Técnicos y sus asignaciones activas">
      {sinTecnico > 0 && (
        <button
          type="button"
          onClick={onOpenSinTecnico}
          aria-label={`${sinTecnico} ${sinTecnico === 1 ? 'orden pendiente sin técnico' : 'órdenes pendientes sin técnico'}. Ver lista`}
          title="Ver órdenes pendientes sin técnico"
          className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded leading-none bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 dark:hover:bg-amber-500/25 transition-colors cursor-pointer"
        >
          SIN TÉCNICO
          <span className="bg-black/15 rounded px-1.5 py-0.5">{sinTecnico}</span>
        </button>
      )}
      {[
        { filtro: 'EN_CAMINO', cantidad: viajes.enCamino, etiqueta: 'EN CAMINO', singular: 'técnico en camino', plural: 'técnicos en camino', Icono: Car, clase: 'bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40 dark:hover:bg-sky-500/25' },
        { filtro: 'EN_SITIO', cantidad: viajes.enSitio, etiqueta: 'EN SITIO', singular: 'técnico en sitio', plural: 'técnicos en sitio', Icono: MapPin, clase: 'bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/40 dark:hover:bg-teal-500/25' },
      ].filter(v => v.cantidad > 0).map(({ filtro, cantidad, etiqueta, singular, plural, Icono, clase }) => (
        <button
          key={filtro}
          type="button"
          onClick={() => onOpenViaje?.(filtro)}
          aria-label={`${cantidad} ${cantidad === 1 ? singular : plural}. Ver lista`}
          title={`Ver órdenes con ${plural}`}
          className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded leading-none border transition-colors cursor-pointer ${clase}`}
        >
          <Icono className="w-3 h-3" aria-hidden="true" />
          {etiqueta}
          <span className="bg-black/15 rounded px-1.5 py-0.5">{cantidad}</span>
        </button>
      ))}
      {counts.map(({ id, name, activo, count }) => {
        const pillClass = `inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded leading-none transition-opacity ${activo ? getTecnicoColor(name) : 'bg-zinc-300 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500'}`;
        const dot = <span className={`w-2 h-2 rounded-full shrink-0 ring-2 ring-white dark:ring-zinc-950 ${activo ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />;
        const label = (
          <>
            {dot}
            {name}
            {count > 0 && <span className="bg-black/15 dark:bg-white/15 rounded px-1.5 py-0.5">{count}</span>}
          </>
        );
        return canToggle ? (
          <button
            key={name}
            type="button"
            onClick={() => onToggleActivo(id, !activo)}
            aria-label={`Marcar ${name} como ${activo ? 'inactivo' : 'activo'}`}
            title={activo ? 'Activo — click para marcar inactivo' : 'Inactivo — click para marcar activo'}
            className={`${pillClass} hover:opacity-80 cursor-pointer`}
          >
            {label}
          </button>
        ) : (
          <span key={name} className={pillClass} title={activo ? 'Técnico activo' : 'Técnico inactivo'}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
