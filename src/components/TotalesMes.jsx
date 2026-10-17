import { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import SelectMenu from './SelectMenu';
import { etiquetaMes } from '../utils/totalesMes';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function Cifra({ valor, etiqueta, nota, resaltar = false }) {
  return (
    <div className="min-w-0">
      <p className={`text-3xl font-black tabular-nums leading-none ${resaltar ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'}`}>{valor ?? '…'}</p>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{etiqueta}</p>
      {nota && <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{nota}</p>}
    </div>
  );
}

// Lo que ventas lleva cada mes, sin adornos: las instalaciones finalizadas del mes y las que están en proceso. Lo demás (canceladas y
// averías LOS) se abre con "Ver detalle". `totales` es null mientras se leen los cerrados del mes.
export default function TotalesMes({ mes, meses, onCambiarMes, totales, error }) {
  const [detalle, setDetalle] = useState(false);
  const inst = totales?.instalaciones;
  const los = totales?.los;

  return (
    <section aria-label="Totales del mes" className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-6">
        <div className="w-44">
          <SelectMenu id="totales-mes" ariaLabel="Mes de los totales" icon={CalendarDays} value={mes} onChange={onCambiarMes} items={meses.map((m) => ({ value: m, label: etiquetaMes(m).replace(/^./, (c) => c.toUpperCase()) }))} />
        </div>
        <div className="flex flex-wrap items-end justify-end gap-x-5 gap-y-3 sm:gap-x-6 sm:ml-auto">
          <Cifra valor={inst?.finalizadas} etiqueta="Finalizadas" nota="solo instalaciones del mes" resaltar />
          {(!inst || inst.enProceso !== null) && (
            <div className="border-l border-zinc-300 dark:border-zinc-700 pl-5 sm:pl-6"><Cifra valor={inst?.enProceso} etiqueta="En proceso" nota="instalaciones, ahora" /></div>
          )}
          <button
            type="button"
            aria-expanded={detalle}
            onClick={() => setDetalle((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 pb-0.5"
          >
            Ver detalle <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detalle ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">No se pudieron cargar los totales cerrados de este mes. Se muestran solo las órdenes de hoy.</p>}

      {detalle && inst && los && (
        <dl className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1 text-right">
          <div><dt className="inline font-bold text-zinc-800 dark:text-zinc-100">Instalaciones: </dt><dd className="inline">{plural(inst.finalizadas, 'finalizada', 'finalizadas')}, {plural(inst.canceladas, 'cancelada', 'canceladas')}{inst.enProceso !== null && `, ${inst.enProceso} en proceso`}</dd></div>
          <div><dt className="inline font-bold text-zinc-800 dark:text-zinc-100">Averías LOS: </dt><dd className="inline">{plural(los.finalizadas, 'resuelta', 'resueltas')}, {plural(los.canceladas, 'cancelada', 'canceladas')}{los.enProceso !== null && `, ${los.enProceso} en proceso`}</dd></div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 text-right">Incluye lo cerrado del mes y lo de hoy. "En proceso" es de este momento, por eso solo está en el mes actual.</p>
        </dl>
      )}
    </section>
  );
}
