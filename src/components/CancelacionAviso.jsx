import { Ban } from 'lucide-react';
import Aviso from './Aviso';
import { motivoCancelacion } from '../utils/cancelacion';

const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');

// Por qué se canceló la orden, en las listas y el detalle. No renderiza nada si la orden no está cancelada o es una de las
// canceladas antes de que se pidiera el motivo (esas no lo tienen).
export default function CancelacionAviso({ ticket, compact = false, className = '' }) {
  const motivo = motivoCancelacion(ticket);
  if (!motivo) return null;
  const quien = ticket.canceladaPor ? ` por ${ticket.canceladaPor}` : '';
  const cuando = !compact && ticket.canceladaEn ? ` · ${fechaHora(ticket.canceladaEn)}` : '';
  return <Aviso nivel="error" role="status" icono={Ban} compact={compact} titulo={`Cancelada${quien}${cuando}`} className={className}>{motivo}</Aviso>;
}
