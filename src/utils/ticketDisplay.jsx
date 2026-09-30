import { AlertCircle } from 'lucide-react';

// Verde = terminado, ámbar = esperando aprobación, gris azulado = en espera de
// atención, rojo = cancelado. Antes PENDIENTE era verde y se leía como "listo".
export const getEstadoColor = (estado) => {
  const e = estado?.toUpperCase() || '';
  if (e === 'CANCELADO') return 'bg-red-700 text-white';
  if (e === 'PENDIENTE') return 'bg-slate-600 text-white';
  if (e === 'PRE-FINALIZADO' || e === 'PRE-FINALIZADA') return 'bg-amber-500 text-black dark:bg-amber-600 dark:text-white font-bold';
  if (e === 'FINALIZADO') return 'bg-emerald-700 text-white';
  if (e === 'ELIMINADO') return 'bg-zinc-800 text-white dark:bg-zinc-600';
  return 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200';
};

// Un color por tipo de trabajo: `badge` para la etiqueta, `borde` para la franja
// lateral de la fila. Clases completas (Tailwind no detecta clases armadas).
const TIPO_TRABAJO_ESTILOS = {
  'AVERÍA': { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', borde: 'border-l-red-500' },
  'INSTALACIÓN': { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', borde: 'border-l-blue-500' },
  'RECONEXIÓN': { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', borde: 'border-l-emerald-500' },
  'VALIDACION NAP': { badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', borde: 'border-l-violet-500' },
  'MUDANZA': { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', borde: 'border-l-amber-500' },
  'GARANTIA': { badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', borde: 'border-l-teal-500' },
  'LOW SIGNAL': { badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', borde: 'border-l-orange-500' },
  'RETIRO EQUIPO': { badge: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300', borde: 'border-l-zinc-500' },
};
const TIPO_TRABAJO_DEFAULT = { badge: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300', borde: 'border-l-zinc-400' };

export const getTipoTrabajoEstilo = (tipo) =>
  TIPO_TRABAJO_ESTILOS[String(tipo || '').toUpperCase()] || TIPO_TRABAJO_DEFAULT;

const parseFechaTicket = (fechaStr) => {
  const [day, month, year] = String(fechaStr || '').split('/');
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
};

const ESTADOS_CERRADOS = ['FINALIZADO', 'CANCELADO', 'ELIMINADO'];

// Encabezado de grupo por día: "Hoy · 29/09/2026" o "Ayer · ...". Para órdenes
// aún abiertas con 2+ días de antigüedad agrega "hace N días" y marca `atrasado`.
export const getEtiquetaDia = (fechaStr, estado) => {
  const fecha = parseFechaTicket(fechaStr);
  if (!fecha) return { texto: fechaStr || 'Sin fecha', atrasado: false };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy.getTime() - fecha.getTime()) / 86400000);
  const abierta = !ESTADOS_CERRADOS.includes(estado);
  if (dias === 0) return { texto: `Hoy · ${fechaStr}`, atrasado: false };
  if (dias === 1) return { texto: `Ayer · ${fechaStr}`, atrasado: false };
  if (abierta && dias >= 2) return { texto: `${fechaStr} · hace ${dias} días`, atrasado: true };
  return { texto: fechaStr, atrasado: false };
};

// Estado del envío por WhatsApp (campo isAsignado) leído del historial:
// quién/cuándo lo marcó y si hubo cambios que afectan el mensaje después
// (técnico, trabajo, programación o código) y por tanto hay que reenviar.
export const getEnvioInfo = (ticket) => {
  if (!ticket?.isAsignado) return { enviado: false, cambioTrasEnvio: false, detalle: 'Sin enviar' };
  const hist = ticket.historialEdiciones || [];
  let idx = -1;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (/(ENVIADO|ASIGNADO) marcado/.test(hist[i].detalle || '')) { idx = i; break; }
  }
  const marca = idx >= 0 ? hist[idx] : null;
  const cambioTrasEnvio = idx >= 0 && hist.slice(idx + 1).some(h => /(Técnico|Trabajo|Prog|Cód):/.test(h.detalle || ''));
  const base = marca ? `Enviado por ${marca.operador} el ${marca.fecha}` : 'Enviado';
  return {
    enviado: true,
    cambioTrasEnvio,
    detalle: cambioTrasEnvio ? `${base}. La orden cambió después del envío: copia y reenvía la plantilla.` : base,
  };
};

export const getFechaStyles =(fechaStr, estado) => {
  if (estado === 'FINALIZADO' || estado === 'CANCELADO' || estado === 'ELIMINADO') {
    return "text-zinc-500 dark:text-zinc-400 font-medium";
  }
  try {
    const [day, month, year] = fechaStr.split('/');
    const ticketDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    ticketDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - ticketDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);
    if (diffDays >= 2) {
      return "text-red-600 font-bold dark:text-red-500";
    }
  } catch {
    // fechaStr malformado (ticket viejo/manual): no resaltar como atrasado.
  }
  return "text-zinc-500 dark:text-zinc-400 font-medium";
};

export const getCreadoColor = (creado) => {
  const c = creado?.toUpperCase() || '';
  // Estilo tenue (fondo con tinte + borde fino), igual que las etiquetas de técnico.
  if (c === 'ALEJANDRO') return 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40';
  if (c === 'ROMER') return 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40';
  if (c === 'SKEYVER') return 'bg-zinc-200 text-zinc-700 border border-zinc-300 dark:bg-zinc-500/15 dark:text-zinc-300 dark:border-zinc-500/40';
  if (c === 'RENNY') return 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40';
  return c ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40' : 'bg-transparent';
};

// Antepone el tipo de documento (J, E, G) cuando no es el caso por defecto
// (persona natural, "V"), para que un RIF jurídico se distinga a simple vista
// de una cédula. No cambia nada para los tickets ya existentes (sin este
// campo, o con "V") — mismo texto que siempre se mostró.
export const formatCedula = (cedula, tipoDocumento) => {
  if (!cedula) return cedula;
  if (!tipoDocumento || tipoDocumento === 'V') return cedula;
  // RIF (jurídico/extranjero/gubernamental): sin puntos, solo el prefijo y los números.
  return `${tipoDocumento}-${String(cedula).replace(/\D/g, '')}`;
};

// Evita que "break-all"/wrap corte una cédula en medio de un grupo de dígitos
// (ej. "18.395.7" / "53"): solo se permite el salto justo después de cada punto
// o guion (para los RIF con prefijo, ej. "J-403369895").
export const renderCedulaConSaltos = (cedula) => {
  const partes = String(cedula || '').split(/([.-])/);
  return partes.map((parte, i) => (
    <span key={i}>
      {parte}
      {(parte === '.' || parte === '-') ? <wbr /> : null}
    </span>
  ));
};

export const renderProgramadaBadge = (fechaProgStr, tecnico) => {
  if (!fechaProgStr || (tecnico && tecnico.trim() !== '')) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const progDate = new Date(fechaProgStr + 'T00:00:00');
  const [y, m, d] = fechaProgStr.split('-');
  const formatted = `${d}/${m}/${y}`;

  if (progDate <= today) {
    return (
      <div className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded mt-1 flex flex-col items-center justify-center shadow-sm w-max animate-pulse leading-none gap-0.5">
        <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> ¡ASIGNAR!</span>
        <span>{formatted}</span>
      </div>
    );
  }
  return <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 border border-blue-200 dark:border-blue-800 w-max inline-block">Prog: {formatted}</span>;
};
