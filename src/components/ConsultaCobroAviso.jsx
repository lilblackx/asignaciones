import { Banknote, Hourglass } from 'lucide-react';
import Aviso from './Aviso';
import { legible } from '../utils/nombreTecnico';
import { consultaCobroDe, consultaPendiente, respuestaVigente, textoRespuesta } from '../utils/consultaCobro';

// Estado de la consulta del cobro de un recableado, para la lista de órdenes: pendiente (la oficina aún no responde) o con la
// respuesta. Con `onResponder` (oficina) la consulta pendiente trae el botón para responderla. No renderiza nada si el técnico
// no consultó, ni cuando la orden ya se cerró (el cobro final lo muestra CobroAviso).
export default function ConsultaCobroAviso({ ticket, compact = false, onResponder, className = '' }) {
  if (!['PENDIENTE', 'PRE-FINALIZADO'].includes(ticket?.estado)) return null;
  const consulta = consultaCobroDe(ticket);
  if (!consulta) return null;
  const respuesta = respuestaVigente(ticket);
  const pendiente = consultaPendiente(ticket);

  if (respuesta) {
    return <Aviso nivel="info" icono={Banknote} compact={compact} titulo={`Cobro del recableado (${respuesta.metros} m): ${textoRespuesta(respuesta)}`} className={className} />;
  }

  return (
    <Aviso
      nivel="atencion"
      icono={Hourglass}
      compact={compact}
      titulo={onResponder ? 'Consulta de cobro del recableado' : 'Consulta de cobro enviada'}
      accion={pendiente && onResponder ? { etiqueta: 'Responder', icono: Banknote, onClick: () => onResponder(ticket) } : null}
      className={className}
    >
      {onResponder ? `${legible(ticket.tecnico) || 'El técnico'} pregunta cuánto se cobra por ${consulta.metros} m.` : `${consulta.metros} m: esperando a la oficina.`}
    </Aviso>
  );
}
