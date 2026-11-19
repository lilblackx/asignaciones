import { useId, useMemo, useState } from 'react';
import { Car, ChevronDown, HardHat, MapPin } from 'lucide-react';
import { estaEnCamino, estaEnSitio } from '../utils/enCamino';
import { enInfraestructura } from '../utils/infraestructura';
import NumeroPulso from './NumeroPulso';
import { iniciales, legible } from '../utils/nombreTecnico';

// Las píldoras de estado (sin técnico, en camino, en sitio, infraestructura): la misma forma y tamaño que las de los técnicos; solo cambia el tono suave. El número va en una cápsula, como en las de los técnicos.
const PILDORA_ESTADO = 'inline-flex items-center gap-2 rounded-boton border px-3 py-1 max-lg:min-h-11 text-xs font-bold leading-none transition-colors cursor-pointer';
const CONTADOR_ESTADO = 'rounded-full bg-white/60 dark:bg-black/20 px-2 py-0.5 text-etiqueta font-black leading-none';

// `rutaBoton`: el atajo a la Ruta del día (solo el técnico, y solo con la función encendida en Configuración); va al final de la misma fila, a la derecha.
export default function TechnicianWorkload({ tickets, technicians, getTecnicoColor, canEditTickets, isTecnico, onToggleActivo, onOpenSinTecnico, ahora, onOpenViaje, rutaBoton = null }) {
  // TECNICO solo recibe (por query scoping) su propio técnico en `technicians`,
  // así que dejarlo togglear acá nunca le da acceso al badge de otro.
  const canToggle = canEditTickets || isTecnico;
  // En celular, con más de un técnico las píldoras ocupaban media pantalla: se pliegan en un resumen ("Técnicos · 8 activos · 62 pendientes") que despliega la lista.
  const [abierto, setAbierto] = useState(false);
  const idLista = useId();
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

  const agrupar = counts.length > 1;
  const activos = counts.filter((t) => t.activo).length;
  const pendientes = counts.reduce((a, t) => a + t.count, 0);

  return (
    <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Técnicos y sus asignaciones activas">
      {sinTecnico > 0 && (
        <button
          type="button"
          onClick={onOpenSinTecnico}
          aria-label={`${sinTecnico} ${sinTecnico === 1 ? 'orden pendiente sin técnico' : 'órdenes pendientes sin técnico'}. Ver lista`}
          title="Ver órdenes pendientes sin técnico"
          className={`${PILDORA_ESTADO} bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 dark:hover:bg-amber-500/25`}
        >
          Sin técnico
          <span className={CONTADOR_ESTADO}><NumeroPulso valor={sinTecnico} /></span>
        </button>
      )}
      {[
        { filtro: 'EN_CAMINO', cantidad: viajes.enCamino, etiqueta: 'En camino', singular: 'técnico en camino', plural: 'técnicos en camino', Icono: Car, clase: 'bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40 dark:hover:bg-sky-500/25' },
        { filtro: 'EN_SITIO', cantidad: viajes.enSitio, etiqueta: 'En sitio', singular: 'técnico en sitio', plural: 'técnicos en sitio', Icono: MapPin, clase: 'bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/40 dark:hover:bg-teal-500/25' },
        { filtro: 'EN_INFRAESTRUCTURA', cantidad: enInfra, etiqueta: 'Infraestructura', singular: 'orden en infraestructura', plural: 'órdenes en infraestructura', Icono: HardHat, clase: 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40 dark:hover:bg-orange-500/25' },
      ].filter(v => v.cantidad > 0).map(({ filtro, cantidad, etiqueta, singular, plural, Icono, clase }) => (
        <button
          key={filtro}
          type="button"
          onClick={() => onOpenViaje?.(filtro)}
          aria-label={`${cantidad} ${cantidad === 1 ? singular : plural}. Ver lista`}
          title={filtro === 'EN_INFRAESTRUCTURA' ? 'Ver las órdenes en infraestructura' : `Ver órdenes con ${plural}`}
          className={`${PILDORA_ESTADO} ${clase}`}
        >
          <Icono className="w-3.5 h-3.5" aria-hidden="true" />
          {etiqueta}
          <span className={CONTADOR_ESTADO}><NumeroPulso valor={cantidad} /></span>
        </button>
      ))}
      {agrupar && (
        <div className="basis-full lg:hidden">
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls={idLista}
            onClick={() => setAbierto((a) => !a)}
            className="w-full min-h-11 px-4 rounded-boton border border-input bg-card hover:bg-secondary flex items-center justify-between gap-2 text-sm font-black text-foreground transition-colors"
          >
            <span>Técnicos <span className="font-bold text-muted-foreground text-xs">· {activos} {activos === 1 ? 'activo' : 'activos'} · {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}</span></span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {abierto && (
            <ul id={idLista} className="mt-1.5 rounded-card bg-card shadow-card divide-y divide-border overflow-hidden">
              {counts.map(({ id, name, activo, count }) => (
                <li key={name} className="flex items-center gap-3 px-3 min-h-14">
                  <span aria-hidden="true" className={`relative shrink-0 w-8 h-8 rounded-full border inline-flex items-center justify-center text-xs font-black leading-none ${activo ? getTecnicoColor(name) : 'border-dashed border-zinc-400 dark:border-zinc-600 text-muted-foreground'}`}>
                    {iniciales(name)}
                    <span className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${activo ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-zinc-500'}`} />
                  </span>
                  <span className={`min-w-0 flex-1 text-sm font-bold ${activo ? 'text-foreground' : 'text-muted-foreground'}`}>{legible(name)}{!activo && <span className="ml-1.5 text-xs font-bold">inactivo</span>}</span>
                  {count > 0 && <span className="rounded-full bg-secondary text-foreground px-2 py-0.5 text-xs font-black leading-none"><NumeroPulso valor={count} /></span>}
                  {canToggle ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activo}
                      aria-label={`${legible(name)}: ${activo ? 'activo' : 'inactivo'}`}
                      title={activo ? 'Activo - toca para marcar inactivo' : 'Inactivo - toca para marcar activo'}
                      onClick={() => onToggleActivo(id, !activo)}
                      className="relative shrink-0 w-11 h-11 inline-flex items-center justify-center"
                    >
                      <span className={`relative block w-10 h-6 rounded-full transition-colors ${activo ? 'bg-emerald-600' : 'bg-zinc-400 dark:bg-zinc-600'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${activo ? 'right-0.5' : 'left-0.5'}`} />
                      </span>
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className={agrupar ? 'hidden lg:contents' : 'contents'}>
      {counts.map(({ id, name, activo, count }) => {
        // El avatar lleva el color del técnico y un punto de estado (verde: activo; gris: inactivo). El estado no depende solo del color: el inactivo
        // lleva borde punteado y la palabra "inactivo".
        const pillClass = `inline-flex items-center gap-2 rounded-boton border bg-card pl-1 pr-3 py-1 text-xs font-bold ${activo ? 'border-input text-foreground' : 'border-dashed border-input text-muted-foreground'}`;
        const label = (
          <>
            <span aria-hidden="true" className={`relative shrink-0 w-7 h-7 max-lg:w-8 max-lg:h-8 rounded-full border inline-flex items-center justify-center text-etiqueta font-black leading-none ${activo ? getTecnicoColor(name) : 'border-dashed border-zinc-400 dark:border-zinc-600 text-muted-foreground'}`}>
              {iniciales(name)}
              <span className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${activo ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-zinc-500'}`} />
            </span>
            <span className="whitespace-nowrap">{legible(name)}</span>
            {!activo && <span className="text-etiqueta font-bold">inactivo</span>}
            {count > 0 && <span className="rounded-full bg-secondary text-foreground px-2 py-0.5 text-etiqueta font-black leading-none"><NumeroPulso valor={count} /></span>}
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
      </div>
      {rutaBoton && <div className="ml-auto">{rutaBoton}</div>}
    </div>
  );
}
