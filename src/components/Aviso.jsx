import { useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, OctagonAlert } from 'lucide-react';

// El aviso de toda la app: un solo estilo con cuatro niveles. Un título corto que se lee de un vistazo, el detalle debajo (o plegado con `plegable`),
// los códigos de orden como chips y, si hace falta, UNA acción clara.
//   nivel: 'info' (algo que saber), 'atencion' (algo por atender), 'error' (algo falló o está mal), 'exito' (todo bien).
//   titulo: la frase corta. children: el detalle (opcional).
//   accion: { etiqueta, onClick, icono?: Icono, deshabilitada?, cargando? } o un nodo ya hecho.
//   plegable: el detalle y los códigos quedan tras un botón "Ver detalle" (abierto si `abierto`).
//   compact: para dentro de las listas (tarjetas de orden): menos relleno y letra de 12 px.
// Los colores salen en claro y oscuro ya medidos a 4.5:1 (texto) y 3:1 (ícono).
const NIVELES = {
  info: {
    caja: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/50 text-sky-900 dark:text-sky-200',
    icono: 'text-sky-700 dark:text-sky-400',
    boton: 'bg-sky-700 hover:bg-sky-600 text-white shadow-boton-azul',
    Icono: Info,
    rol: 'status',
  },
  atencion: {
    caja: 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200',
    icono: 'text-amber-700 dark:text-amber-400',
    boton: 'bg-amber-500 hover:bg-amber-400 text-black shadow-boton-ambar',
    Icono: AlertTriangle,
    rol: 'status',
  },
  error: {
    caja: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200',
    icono: 'text-red-700 dark:text-red-400',
    boton: 'bg-red-700 hover:bg-red-600 text-white shadow-boton',
    Icono: OctagonAlert,
    rol: 'alert',
  },
  exito: {
    caja: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200',
    icono: 'text-emerald-700 dark:text-emerald-400',
    boton: 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-boton-verde',
    Icono: CheckCircle2,
    rol: 'status',
  },
};

// Los códigos de las órdenes de un aviso. Con `onElegir` son botones que filtran la lista; sin él, solo etiquetas. Muestra hasta `maximo` y dice cuántas más hay.
export function CodigosAviso({ codigos, onElegir, maximo = 6, compact = false }) {
  if (!codigos || codigos.length === 0) return null;
  const visibles = codigos.slice(0, maximo);
  const resto = codigos.length - visibles.length;
  const base = `inline-flex items-center justify-center rounded-boton px-2.5 font-black tabular-nums border ${compact ? 'min-h-6 text-[11px] max-lg:text-xs' : 'min-h-7 text-xs'} border-current/30 bg-white/60 dark:bg-black/20`;
  return (
    <ul className="flex flex-wrap gap-1.5 mt-2" aria-label="Órdenes de este aviso">
      {visibles.map((codigo) => (
        <li key={codigo}>
          {onElegir
            ? <button type="button" onClick={() => onElegir(codigo)} className={`${base} max-lg:min-h-11 max-lg:px-3.5 hover:bg-white dark:hover:bg-black/40 transition-colors`} title={`Ver la orden ${codigo}`}>{codigo}</button>
            : <span className={base}>{codigo}</span>}
        </li>
      ))}
      {resto > 0 && <li className="inline-flex items-center text-xs font-bold">y {resto} más</li>}
    </ul>
  );
}

export default function Aviso({ nivel = 'atencion', titulo, children, codigos, onElegirCodigo, accion, plegable = false, abierto = false, compact = false, icono: IconoPropio, role, className = '' }) {
  const n = NIVELES[nivel] || NIVELES.atencion;
  const Icono = IconoPropio || n.Icono;
  const [desplegado, setDesplegado] = useState(abierto);
  const idDetalle = useId();
  const hayDetalle = Boolean(children) || (codigos && codigos.length > 0);
  const mostrarDetalle = hayDetalle && (!plegable || desplegado);
  const tamanoIcono = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const boton = accion && typeof accion === 'object' && 'onClick' in accion ? (() => {
    const IconoAccion = accion.icono;
    return (
      <button
        type="button"
        onClick={accion.onClick}
        disabled={accion.deshabilitada}
        className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-boton font-black transition-colors disabled:opacity-60 disabled:shadow-none ${n.boton} ${compact ? 'px-3 py-1.5 text-xs min-h-8 max-lg:min-h-11' : 'px-4 py-2 text-sm min-h-10 max-lg:min-h-11'}`}
      >
        {IconoAccion && <IconoAccion className="w-4 h-4" aria-hidden="true" />}{accion.etiqueta}
      </button>
    );
  })() : accion;

  return (
    <div role={role || n.rol} className={`rounded-campo border ${n.caja} ${compact ? 'p-2 text-xs' : 'p-3 text-xs sm:text-sm'} ${className}`}>
      <div className="flex items-start gap-2.5">
        <Icono className={`${tamanoIcono} shrink-0 mt-0.5 ${n.icono}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-black leading-snug break-words">{titulo}</p>
          {plegable && hayDetalle && (
            <button
              type="button"
              aria-expanded={desplegado}
              aria-controls={idDetalle}
              onClick={() => setDesplegado((d) => !d)}
              className="mt-1 -ml-1 px-1 inline-flex items-center gap-1 text-xs font-bold underline underline-offset-2 max-lg:min-h-11"
            >
              {desplegado ? 'Ocultar detalle' : 'Ver detalle'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${desplegado ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          )}
          {mostrarDetalle && (
            <div id={idDetalle}>
              {children && <div className="leading-snug break-words whitespace-pre-wrap mt-0.5 font-normal">{children}</div>}
              <CodigosAviso codigos={codigos} onElegir={onElegirCodigo} compact={compact} />
            </div>
          )}
        </div>
        {boton && !compact && <div className="shrink-0 self-center max-sm:hidden">{boton}</div>}
      </div>
      {boton && (compact ? <div className="mt-2">{boton}</div> : <div className="mt-2.5 sm:hidden [&>button]:w-full">{boton}</div>)}
    </div>
  );
}

// Varios avisos en uno solo que se despliega ("3 avisos por atender"). `abierto` por defecto en PC y cerrado en celular, para que lo importante no quede fuera de la pantalla.
export function AvisosAgrupados({ total, nivel = 'atencion', children, className = '' }) {
  const n = NIVELES[nivel] || NIVELES.atencion;
  const [abierto, setAbierto] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const id = useId();
  if (!total) return null;
  const Icono = n.Icono;
  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className={`w-full min-h-11 px-3.5 flex items-center justify-between gap-2 rounded-campo border text-sm font-black ${n.caja}`}
      >
        <span className="flex items-center gap-2"><Icono className={`w-4 h-4 shrink-0 ${n.icono}`} aria-hidden="true" /> {total === 1 ? '1 aviso por atender' : `${total} avisos por atender`}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {abierto && <div id={id} className="space-y-2">{children}</div>}
    </div>
  );
}
