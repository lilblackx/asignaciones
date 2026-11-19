import { ChevronDown, Undo2 } from 'lucide-react';
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

// En la tabla de PC la devolución es una marca pequeña en la columna Nombre que despliega el detalle (ver DetalleDevolucion) en una franja bajo la fila: la columna es angosta para un motivo y una nota.
export function MarcaDevolucion({ ticket, abierto, onAlternar, id }) {
  if (!devolucionPendiente(ticket)) return null;
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-expanded={abierto}
      aria-controls={id}
      title={abierto ? 'Ocultar el motivo de la devolución' : 'Ver el motivo de la devolución'}
      className="mt-1 inline-flex items-center gap-1 self-start rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 text-xs font-bold text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
    >
      <Undo2 className="w-3 h-3" aria-hidden="true" /> Devuelta
      <ChevronDown className={`w-3 h-3 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
  );
}

// La franja de detalle de la tabla: el motivo de la oficina y, si la hay, la nota del técnico, lado a lado y a todo el ancho de la tabla.
export function DetalleDevolucion({ ticket, id }) {
  const devolucion = devolucionPendiente(ticket);
  if (!devolucion) return null;
  const nota = ticket.observacionTecnico;
  return (
    <div id={id} className={`grid gap-3 ${nota ? 'md:grid-cols-2' : ''}`}>
      <div role="alert" className="rounded-campo border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-800 dark:text-red-200">
        <p className="text-xs font-black leading-tight flex items-center gap-1.5"><Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> Devuelta por {nombreDe(devolucion.operador)}{devolucion.fecha ? ` · ${devolucion.fecha}` : ''}</p>
        <p className="mt-1 leading-snug break-words whitespace-pre-wrap">{devolucion.motivo}</p>
      </div>
      {nota && (
        <div className="rounded-campo bg-secondary/60 px-3 py-2 text-sm">
          <p className="text-xs font-bold text-muted-foreground leading-tight">Nota del técnico</p>
          <p className="mt-1 text-card-foreground leading-snug break-words">{nota}</p>
        </div>
      )}
    </div>
  );
}

export default function DevolucionAviso({ ticket, compact = false, conValores = false, nota = '', className = '' }) {
  const devolucion = devolucionPendiente(ticket);
  if (!devolucion) return null;

  return (
    <Aviso
      nivel="error"
      icono={Undo2}
      compact={compact}
      titulo={`Devuelta${devolucion.operador ? ` por ${nombreDe(devolucion.operador)}` : ''}${devolucion.fecha ? ` · ${devolucion.fecha}` : ''}`}
      className={className}
    >
      {devolucion.motivo}
      {nota && (
        <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-900/50 text-card-foreground">
          <p className="text-xs font-bold text-muted-foreground">Nota del técnico</p>
          <p className="leading-snug break-words">{nota}</p>
        </div>
      )}
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
