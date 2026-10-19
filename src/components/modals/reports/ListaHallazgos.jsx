import { AlertTriangle, CheckCircle2 } from 'lucide-react';

// Los puntos de atención de un reporte: alertas en ámbar y lo que va bien en verde. Cada línea lleva icono y texto, nunca solo color.
export default function ListaHallazgos({ titulo = 'Puntos de atención', items }) {
  if (items.length === 0) return null;
  return (
    <section className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">{titulo}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => {
          const alerta = item.nivel === 'aviso';
          const Icono = alerta ? AlertTriangle : CheckCircle2;
          return (
            <li key={i} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-xs leading-snug ${alerta ? 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/50' : 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-900/50'}`}>
              <Icono className={`w-4 h-4 shrink-0 mt-px ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} aria-hidden="true" />
              <span className="text-zinc-800 dark:text-zinc-200"><span className="font-bold">{alerta ? 'Atención: ' : 'Bien: '}</span>{item.texto}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
