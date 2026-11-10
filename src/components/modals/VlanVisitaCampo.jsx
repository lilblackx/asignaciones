import { claseCampo } from '../estilos';

// VLAN configurada en una visita de "Configuración de VLAN": número de 1 a 4094, obligatorio. Lo usan el Pre-finalizar del técnico
// y Editar orden de la oficina.
export default function VlanVisitaCampo({ vlan, onVlan, error = '' }) {
  return (
    <div className="space-y-1 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
      <label htmlFor="pf-vlan-visita" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        VLAN CONFIGURADA <span className="font-normal text-red-500">(obligatorio)</span>
      </label>
      <input
        id="pf-vlan-visita"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="Ej. 100"
        value={vlan}
        onChange={(e) => onVlan(e.target.value.replace(/\D/g, '').slice(0, 4))}
        aria-invalid={!!error}
        aria-describedby={error ? 'pf-vlan-visita-error' : undefined}
        className={`${claseCampo('grande', error ? 'error' : 'normal')} min-w-0 font-bold`}
      />
      {error && <p id="pf-vlan-visita-error" role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{error}</p>}
    </div>
  );
}
