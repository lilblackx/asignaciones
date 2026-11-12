import { Handshake, ShieldCheck, TriangleAlert } from 'lucide-react';
import { avisoCambioDeTrabajo, cobroAcordadoDe, sugiereExonerar, textoCobroAcordado } from '../../utils/cobroAcordado';

const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

// Lo que sabe la oficina antes de elegir el cobro de una orden (ver utils/cobroAcordado), solo informativo: no bloquea nada.
//   - Lo que se acordó con el cliente al crear la orden (con quién lo anotó), y un aviso si el técnico reportó otro trabajo.
//   - Si es una garantía: normalmente no se cobra; es solo una sugerencia, no elige ni bloquea nada.
export default function CobroAcordadoAviso({ ticket }) {
  const acordado = cobroAcordadoDe(ticket);
  const cambio = avisoCambioDeTrabajo(ticket);
  const garantia = sugiereExonerar(ticket);
  if (!acordado && !garantia) return null;

  return (
    <div className="space-y-2 text-left">
      {acordado && (
        <div role="note" className="rounded-xl border border-sky-300 dark:border-sky-800 bg-white dark:bg-sky-950/40 p-2.5 text-xs text-sky-900 dark:text-sky-100">
          <p className="flex items-center gap-1.5 font-black tracking-wide"><Handshake className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" /> ACORDADO CON EL CLIENTE</p>
          <p className="mt-1 font-bold text-sm">{textoCobroAcordado(acordado)}</p>
          {(acordado.por || acordado.en > 0) && (
            <p className="mt-0.5 text-[11px] max-lg:text-xs opacity-80">Anotado{acordado.por ? ` por ${acordado.por}` : ''}{acordado.en > 0 ? ` el ${fechaCorta(acordado.en)}` : ''}.</p>
          )}
          {cambio && <p className="mt-1.5 flex items-start gap-1.5 text-[11px] max-lg:text-xs font-bold text-amber-800 dark:text-amber-300"><TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />{cambio}</p>}
        </div>
      )}
      {garantia && (
        <div role="note" className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
          <p className="flex items-center gap-1.5 font-black tracking-wide"><ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" /> ES UNA GARANTÍA</p>
          <p className="mt-1">Las garantías normalmente no se cobran. Te sugerimos exonerarla, salvo que ya hayas acordado otra cosa con el cliente.</p>
        </div>
      )}
    </div>
  );
}
