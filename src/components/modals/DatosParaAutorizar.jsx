import { ExternalLink, FileText, MapPin, Router, ShieldCheck, User } from 'lucide-react';
import BotonCopiar, { BotonCopiarDato } from '../BotonCopiar';
import { useCopiado } from '../../hooks/useCopiado';
import { buildSmartOltUrl } from '../../utils/smartolt';
import { datosAutorizacion, textoACopiar } from '../../utils/datosAutorizacion';

// Datos con los que se autoriza una instalación en SmartOLT, en dos bloques (equipo y cliente), cada dato
// con su botón de copiar y un "Copiar todo". `onCopy` es el copiado de la app (avisa si falla).
function Fila({ dato, ticket, copiado, onCopiar }) {
  const destacado = dato.clave === 'serial' || dato.clave === 'serialEquipo';
  const mono = ['serial', 'serialEquipo', 'vlan', 'nap', 'puerto', 'drop'].includes(dato.clave);
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <span className="text-[11px] max-lg:text-xs font-bold text-muted-foreground block">{dato.etiqueta}</span>
        {dato.tipo === 'cedula' ? (
          <a
            href={buildSmartOltUrl(ticket.cedula, ticket.tipoDocumento)}
            target="_blank"
            rel="noopener noreferrer"
            title="Buscar cliente en SmartOLT"
            className="inline-flex items-center gap-1 max-lg:min-h-11 text-sm text-blue-700 dark:text-blue-400 font-bold hover:underline"
          >
            {dato.valor}
            <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
          </a>
        ) : dato.tipo === 'ubicacion' ? (
          <a href={dato.valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-700 dark:text-blue-400 font-bold hover:underline">
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Abrir en Maps
          </a>
        ) : (
          <span className={`block break-words text-foreground ${destacado ? 'text-base font-black tracking-wide' : 'text-sm font-bold'} ${mono ? 'font-mono' : ''}`}>{dato.valor}</span>
        )}
      </div>
      <BotonCopiarDato
        copiado={copiado === dato.clave}
        etiqueta={`Copiar ${dato.etiqueta.toLowerCase()}`}
        titulo={`Copiar ${dato.etiqueta.toLowerCase()}`}
        onClick={() => onCopiar(dato.clave, textoACopiar(dato), `${dato.etiqueta} copiado.`)}
      />
    </div>
  );
}

function Bloque({ titulo, icono: Icono, datos, ticket, copiado, onCopiar, className = '', tono }) {
  if (datos.length === 0) return null;
  return (
    <section className={`rounded-campo border p-3 ${tono} ${className}`} aria-label={titulo}>
      <h3 className="flex items-center gap-2 text-xs font-black tracking-wide text-zinc-700 dark:text-zinc-200 mb-0.5">
        <Icono className="w-4 h-4 shrink-0" aria-hidden="true" /> {titulo}
      </h3>
      <div className="divide-y divide-zinc-200/70 dark:divide-zinc-800">
        {datos.map((d) => <Fila key={d.clave} dato={d} ticket={ticket} copiado={copiado} onCopiar={onCopiar} />)}
      </div>
    </section>
  );
}

// `paraAutorizar` (por defecto sí): la orden necesita autorizar un equipo en SmartOLT (ver requiereAutorizar). Si no, el mismo bloque dice "Datos del cliente" (y su tarjeta del equipo, "NAP"): son los mismos datos para copiar, sin
// hablar de autorizar lo que no hay que autorizar.
export default function DatosParaAutorizar({ ticket, onCopy, paraAutorizar = true }) {
  const { equipo, cliente, texto } = datosAutorizacion(ticket);
  const { copiado, copiar } = useCopiado(onCopy);

  if (equipo.length === 0 && cliente.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* El título de la sección, como los demás del modal (COBRO, RECABLEADO...): más grande, con su ícono rojo y la línea roja de las ventanas de la app. */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-red-600">
        <h3 className="min-w-0 flex items-center gap-2 text-sm font-black tracking-wide uppercase text-foreground">
          {paraAutorizar ? <ShieldCheck className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" aria-hidden="true" /> : <User className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" aria-hidden="true" />}
          <span className="truncate">{paraAutorizar ? 'Para autorizar en SmartOLT' : 'Datos del cliente'}</span>
        </h3>
        <BotonCopiar
          copiado={copiado === 'todo'}
          onClick={() => copiar('todo', texto, 'Datos copiados.')}
          className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-campo text-xs font-black"
          tono="bg-blue-600 hover:bg-blue-700 text-white"
          iconoClase="w-3.5 h-3.5"
        >
          {copiado === 'todo' ? 'Copiado' : 'Copiar todo'}
        </BotonCopiar>
      </div>

      {/* En el celular el equipo va primero (es lo que más se usa); en escritorio, el cliente a la izquierda y el equipo a la derecha. */}
      <div className="grid gap-3 md:grid-cols-2 items-start">
        <Bloque
          titulo={paraAutorizar ? 'EQUIPO' : 'NAP'}
          icono={Router}
          datos={equipo}
          ticket={ticket}
          copiado={copiado}
          onCopiar={copiar}
          tono="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 order-1 md:order-2"
        />
        <Bloque
          titulo="CLIENTE"
          icono={User}
          datos={cliente}
          ticket={ticket}
          copiado={copiado}
          onCopiar={copiar}
          tono={`bg-sunken border-border order-2 md:order-1 ${equipo.length === 0 ? 'md:col-span-2' : ''}`}
        />
      </div>

      {ticket.plantillaOriginal && (
        <details className="group rounded-campo border border-border bg-sunken">
          <summary className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
            <FileText className="w-4 h-4 shrink-0" aria-hidden="true" /> Ver plantilla completa de la promotora
          </summary>
          <div className="px-3 pb-3 space-y-2">
            <pre className="whitespace-pre-wrap break-words text-[11px] max-lg:text-xs leading-snug font-mono text-card-foreground max-h-56 overflow-y-auto">{ticket.plantillaOriginal}</pre>
            <BotonCopiar
              copiado={copiado === 'plantilla'}
              onClick={() => copiar('plantilla', ticket.plantillaOriginal, 'Plantilla copiada.')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-campo text-xs font-bold"
              tono="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700"
              iconoClase="w-3.5 h-3.5"
            >
              {copiado === 'plantilla' ? 'Copiada' : 'Copiar plantilla'}
            </BotonCopiar>
          </div>
        </details>
      )}
    </div>
  );
}
