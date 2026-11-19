import { Banknote, ChevronDown, Hourglass } from 'lucide-react';
import Aviso from './Aviso';
import { legible } from '../utils/nombreTecnico';
import { estadoConsulta, textoRespuesta } from '../utils/consultaCobro';

// Estado de la consulta del cobro de un recableado, para la lista de órdenes: pendiente (la oficina aún no responde) o con la
// respuesta. Con `onResponder` (oficina) la consulta pendiente trae el botón para responderla. No renderiza nada si el técnico
// no consultó, ni cuando la orden ya se cerró (el cobro final lo muestra CobroAviso).

const textoPendiente = (ticket, consulta, onResponder) => (onResponder
  ? `${legible(ticket.tecnico) || 'El técnico'} pregunta cuánto se cobra por ${consulta.metros} m.`
  : `${consulta.metros} m: esperando a la oficina.`);

// En la tabla de PC la consulta es una marca pequeña en la columna Nombre que despliega su detalle (ver DetalleConsultaCobro) en una franja bajo la fila.
export function MarcaConsultaCobro({ ticket, abierto, onAlternar, id }) {
  const estado = estadoConsulta(ticket);
  if (!estado) return null;
  const respuesta = estado.tipo === 'respuesta';
  const Icono = respuesta ? Banknote : Hourglass;
  const tono = respuesta
    ? 'border-sky-200 dark:border-sky-900/50 bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-950/50'
    : 'border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/50';
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-expanded={abierto}
      aria-controls={id}
      title={abierto ? 'Ocultar la consulta de cobro' : 'Ver la consulta de cobro'}
      className={`mt-1 inline-flex items-center gap-1 self-start rounded-md border px-2 py-0.5 text-xs font-bold transition-colors ${tono}`}
    >
      <Icono className="w-3 h-3" aria-hidden="true" /> {respuesta ? 'Cobro respondido' : 'Consulta de cobro'}
      <ChevronDown className={`w-3 h-3 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
  );
}

// La franja de detalle de la tabla: el texto de la consulta (o de la respuesta) y, para la oficina, el botón Responder, a todo el ancho.
export function DetalleConsultaCobro({ ticket, id, onResponder }) {
  const estado = estadoConsulta(ticket);
  if (!estado) return null;
  if (estado.tipo === 'respuesta') {
    return <div id={id}><Aviso nivel="info" icono={Banknote} titulo={`Cobro del recableado (${estado.respuesta.metros} m): ${textoRespuesta(estado.respuesta)}`} /></div>;
  }
  return (
    <div id={id}>
      <Aviso
        nivel="atencion"
        icono={Hourglass}
        titulo={onResponder ? 'Consulta de cobro del recableado' : 'Consulta de cobro enviada'}
        accion={estado.pendiente && onResponder ? { etiqueta: 'Responder', icono: Banknote, onClick: () => onResponder(ticket) } : null}
      >
        {textoPendiente(ticket, estado.consulta, onResponder)}
      </Aviso>
    </div>
  );
}

export default function ConsultaCobroAviso({ ticket, compact = false, onResponder, className = '' }) {
  const estado = estadoConsulta(ticket);
  if (!estado) return null;

  if (estado.tipo === 'respuesta') {
    return <Aviso nivel="info" icono={Banknote} compact={compact} titulo={`Cobro del recableado (${estado.respuesta.metros} m): ${textoRespuesta(estado.respuesta)}`} className={className} />;
  }

  return (
    <Aviso
      nivel="atencion"
      icono={Hourglass}
      compact={compact}
      titulo={onResponder ? 'Consulta de cobro del recableado' : 'Consulta de cobro enviada'}
      accion={estado.pendiente && onResponder ? { etiqueta: 'Responder', icono: Banknote, onClick: () => onResponder(ticket) } : null}
      className={className}
    >
      {textoPendiente(ticket, estado.consulta, onResponder)}
    </Aviso>
  );
}
