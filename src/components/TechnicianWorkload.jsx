import { useMemo } from 'react';
import { Car, HardHat, MapPin } from 'lucide-react';
import { estaEnCamino, estaEnSitio } from '../utils/enCamino';
import { enInfraestructura } from '../utils/infraestructura';
import NumeroPulso from './NumeroPulso';
import { iniciales, legible } from '../utils/nombreTecnico';

// `rutaBoton`: el atajo a la Ruta del día (solo el técnico, y solo con la función encendida en Configuración); va al final de la misma fila, a la derecha.
export default function TechnicianWorkload({ tickets, technicians, getTecnicoColor, canEditTickets, isTecnico, onToggleActivo, onOpenSinTecnico, ahora, onOpenViaje, rutaBoton = null }) {
  // TECNICO solo recibe (por query scoping) su propio técnico en `technicians`,
  // así que dejarlo togglear acá nunca le da acceso al badge de otro.
  const canToggle = canEditTickets || isTecnico;
  const counts = useMemo(() => {
    const byTech = new Map(technicians.map(t => [t.name.toUpperCase(), 0]));
    tickets.forEach(t => {
      // Lo que espera a infraestructura no cuenta como carga del técnico: no puede atenderlo.
      if (t.estado !== 'PENDIENTE' || !t.tecnico || enInfraestructura(t)) return;
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

  // Órdenes esperando a infraestructura: solo lo ve quien las resuelve.
  const enInfra = useMemo(
    () => (canEditTickets ? tickets.filter(enInfraestructura).length : 0),
    [tickets, canEditTickets]
  );

  // Técnicos que avisaron que van en camino o que ya llegaron: solo lo ve quien coordina.
  const viajes = useMemo(() => {
    if (!canEditTickets) return { enCamino: 0, enSitio: 0 };
    return { enCamino: tickets.filter(t => estaEnCamino(t, ahora)).length, enSitio: tickets.filter(t => estaEnSitio(t, ahora)).length };
  }, [tickets, canEditTickets, ahora]);

  if (counts.length === 0 && sinTecnico === 0 && enInfra === 0 && !rutaBoton) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Técnicos y sus asignaciones activas">
      {sinTecnico > 0 && (
        <button
          type="button"
          onClick={onOpenSinTecnico}
          aria-label={`${sinTecnico} ${sinTecnico === 1 ? 'orden pendiente sin técnico' : 'órdenes pendientes sin técnico'}. Ver lista`}
          title="Ver órdenes pendientes sin técnico"
          className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] max-lg:text-xs font-bold rounded max-lg:rounded-boton leading-none bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 dark:hover:bg-amber-500/25 transition-colors cursor-pointer"
        >
          SIN TÉCNICO
          <span className="bg-white/60 dark:bg-black/15 rounded px-1.5 py-0.5"><NumeroPulso valor={sinTecnico} /></span>
        </button>
      )}
      {[
        { filtro: 'EN_CAMINO', cantidad: viajes.enCamino, etiqueta: 'EN CAMINO', singular: 'técnico en camino', plural: 'técnicos en camino', Icono: Car, clase: 'bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40 dark:hover:bg-sky-500/25' },
        { filtro: 'EN_SITIO', cantidad: viajes.enSitio, etiqueta: 'EN SITIO', singular: 'técnico en sitio', plural: 'técnicos en sitio', Icono: MapPin, clase: 'bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/40 dark:hover:bg-teal-500/25' },
        { filtro: 'EN_INFRAESTRUCTURA', cantidad: enInfra, etiqueta: 'INFRAESTRUCTURA', singular: 'orden en infraestructura', plural: 'órdenes en infraestructura', Icono: HardHat, clase: 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40 dark:hover:bg-orange-500/25' },
      ].filter(v => v.cantidad > 0).map(({ filtro, cantidad, etiqueta, singular, plural, Icono, clase }) => (
        <button
          key={filtro}
          type="button"
          onClick={() => onOpenViaje?.(filtro)}
          aria-label={`${cantidad} ${cantidad === 1 ? singular : plural}. Ver lista`}
          title={filtro === 'EN_INFRAESTRUCTURA' ? 'Ver las órdenes en infraestructura' : `Ver órdenes con ${plural}`}
          className={`inline-flex items-center gap-1.5 px-2 py-1 max-lg:min-h-11 max-lg:px-3 text-[11px] max-lg:text-xs font-bold rounded max-lg:rounded-boton leading-none border transition-colors cursor-pointer ${clase}`}
        >
          <Icono className="w-3 h-3" aria-hidden="true" />
          {etiqueta}
          <span className="bg-white/60 dark:bg-black/15 rounded px-1.5 py-0.5"><NumeroPulso valor={cantidad} /></span>
        </button>
      ))}
      {counts.map(({ id, name, activo, count }) => {
        // El avatar lleva el color del técnico y un punto de estado (verde: activo; gris: inactivo). El estado no depende solo del color: el inactivo
        // lleva borde punteado y la palabra "inactivo".
        const pillClass = `inline-flex items-center gap-2 rounded-boton border bg-card pl-1 pr-3 py-1 text-xs font-bold ${activo ? 'border-input text-foreground' : 'border-dashed border-input text-muted-foreground'}`;
        const label = (
          <>
            <span aria-hidden="true" className={`relative shrink-0 w-7 h-7 max-lg:w-8 max-lg:h-8 rounded-full border inline-flex items-center justify-center text-[11px] max-lg:text-xs font-black leading-none ${activo ? getTecnicoColor(name) : 'border-dashed border-zinc-400 dark:border-zinc-600 text-muted-foreground'}`}>
              {iniciales(name)}
              <span className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${activo ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-zinc-500'}`} />
            </span>
            <span className="whitespace-nowrap">{legible(name)}</span>
            {!activo && <span className="text-[11px] max-lg:text-xs font-semibold">inactivo</span>}
            {count > 0 && <span className="rounded-full bg-secondary text-foreground px-2 py-0.5 text-[11px] max-lg:text-xs font-black leading-none"><NumeroPulso valor={count} /></span>}
          </>
        );
        return canToggle ? (
          <button
            key={name}
            type="button"
            onClick={() => onToggleActivo(id, !activo)}
            aria-label={`Marcar ${name} como ${activo ? 'inactivo' : 'activo'}`}
            title={activo ? 'Activo - click para marcar inactivo' : 'Inactivo - click para marcar activo'}
            className={`${pillClass} max-lg:min-h-11 hover:bg-secondary transition-colors cursor-pointer`}
          >
            {label}
          </button>
        ) : (
          <span key={name} className={pillClass} title={activo ? 'Técnico activo' : 'Técnico inactivo'}>
            {label}
          </span>
        );
      })}
      {rutaBoton && <div className="ml-auto">{rutaBoton}</div>}
    </div>
  );
}
