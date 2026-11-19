import { Undo2 } from 'lucide-react';
import Aviso from './Aviso';
import { devolucionPendiente } from '../utils/devolucion';
import { calidadValor, textoDbm, valoresGuardados } from '../utils/valoresCliente';

// Aviso para el técnico: el admin devolvió la orden con un motivo y todavía no
// la vuelve a pre-finalizar. No renderiza nada si la orden no tiene devolución vigente.
// Con `conValores` y los valores del cliente ya guardados por la oficina, los muestra bajo el motivo: el técnico
// sabe con qué señal quedó el cliente en la OLT. Solo en el modal de pre-finalizar, para no cargar las listas.
function ValorLinea({ etiqueta, valor }) {
  const calidad = calidadValor(valor);
  return (
    <p className="leading-snug">
      {etiqueta}: <span className="font-black">{textoDbm(valor)}</span>
      {calidad && <span className="font-bold"> · {calidad.texto}</span>}
    </p>
  );
}

// El operador se guarda como su usuario en minúscula ("rcova"): se muestra con la inicial en mayúscula.
const nombreDe = (usuario) => String(usuario).charAt(0).toUpperCase() + String(usuario).slice(1);

export default function DevolucionAviso({ ticket, compact = false, conValores = false, className = '' }) {
  const devolucion = devolucionPendiente(ticket);
  if (!devolucion) return null;

  return (
    <Aviso
      nivel="error"
      icono={Undo2}
      compact={compact}
      titulo={`Devuelta${devolucion.operador ? ` por ${nombreDe(devolucion.operador)}` : ''}${devolucion.fecha && !compact ? ` · ${devolucion.fecha}` : ''}`}
      className={className}
    >
      <span className="font-bold">Motivo:</span> {devolucion.motivo}
      {conValores && valoresGuardados(ticket) && (
        <div className="mt-1.5 pt-1.5 border-t border-red-200 dark:border-red-900/50 whitespace-normal">
          <p className="font-bold">Valores con los que quedó el cliente:</p>
          <ValorLinea etiqueta="OLT Rx 1310 nm" valor={ticket.valoresCliente.olt1310Dbm} />
          <ValorLinea etiqueta="ONU Rx 1490 nm" valor={ticket.valoresCliente.onu1490Dbm} />
        </div>
      )}
    </Aviso>
  );
}
