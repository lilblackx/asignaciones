import { ShieldAlert } from 'lucide-react';

// La marca "Garantía de IO123" de una orden que se hace de nuevo porque otro técnico falló (solo la ve la oficina).
export default function InsigniaGarantia({ ticket }) {
  if (!ticket?.garantiaDe?.id) return null;
  const { codigo, tecnico } = ticket.garantiaDe;
  return (
    <span title={`Garantía de la orden ${codigo || 's/c'}, de ${tecnico}`} className="inline-flex items-center gap-1 text-[11px] max-lg:text-xs font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
      <ShieldAlert className="w-3 h-3" aria-hidden="true" /> Garantía de {codigo || 's/c'}
    </span>
  );
}
