import { ChevronDown, Star } from 'lucide-react';
import { TIPOS_TRABAJO } from '../../constants';

// Estilos por variante: 'create' (CreateTicketModal) y 'edit' (EditTicketModal).
// Reproducen exactamente las clases originales de cada modal.
const STYLES = {
  create: {
    label: 'text-[10px] font-bold text-zinc-500 ml-1',
    labelObs: 'text-[10px] font-bold text-zinc-500',
    labelObsInterna: 'flex items-center gap-1 text-[10px] font-bold text-zinc-500 cursor-pointer',
    selectTipoDoc: 'w-16 shrink-0 appearance-none bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 pl-1 pr-5 py-1.5 rounded text-xs text-center',
    inputCedula: 'w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs',
    selectTecnico: 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 pl-2 pr-7 py-1.5 rounded text-xs uppercase',
    selectTipoTrabajo: 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 pl-2 pr-7 py-1.5 rounded text-xs font-bold',
    textarea: 'w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs',
    hint: 'text-[9px] text-zinc-400 ml-1',
    checkbox: 'w-3 h-3 accent-red-600',
  },
  edit: {
    label: 'text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1',
    labelObs: 'text-[10px] font-bold text-zinc-500 dark:text-zinc-400',
    labelObsInterna: 'flex items-center gap-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 cursor-pointer',
    selectTipoDoc: 'w-14 shrink-0 appearance-none bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 pl-1 pr-5 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-center text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    inputCedula: 'w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    selectTecnico: 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 pl-3 pr-8 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none uppercase text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    selectTipoTrabajo: 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 pl-3 pr-8 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none font-bold text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    textarea: 'w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors',
    hint: 'text-[9px] text-zinc-400 ml-1',
    checkbox: 'w-3 h-3 accent-red-600',
  },
};

// Formatea cédula/RIF con separador de miles, solo dígitos.
function formatCedulaValue(rawValue) {
  return rawValue.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function CedulaField({ variant, wrapperClassName, idPrefix, tipoDocumento, cedula, onChange, disabled = false }) {
  const s = STYLES[variant];
  const handleCedulaChange = (e) => {
    e.target.value = formatCedulaValue(e.target.value);
    onChange(e);
  };
  return (
    <div className={wrapperClassName}>
      <label htmlFor={`${idPrefix}-cedula`} className={s.label}>CÉDULA / RIF</label>
      <div className="flex gap-1">
        <div className="relative shrink-0">
          <select
            id={`${idPrefix}-tipo-doc`}
            disabled={disabled}
            name="tipoDocumento"
            value={tipoDocumento}
            onChange={onChange}
            title="Tipo de documento (V, E, J, G)"
            className={s.selectTipoDoc}
          >
            <option value="V">V</option>
            <option value="E">E</option>
            <option value="J">J</option>
            <option value="G">G</option>
          </select>
          <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        </div>
        <input
          id={`${idPrefix}-cedula`}
          disabled={disabled}
          required
          type="text"
          inputMode="numeric"
          maxLength="20"
          name="cedula"
          value={cedula}
          onChange={handleCedulaChange}
          className={s.inputCedula}
        />
      </div>
    </div>
  );
}

export function TecnicoField({ variant, wrapperClassName, idPrefix, label, value, onChange, disabled = false, technicians, showSuggestion, turnoSugerido, emptyOptionLabel }) {
  const s = STYLES[variant];
  return (
    <div className={wrapperClassName}>
      <label htmlFor={`${idPrefix}-tecnico`} className={s.label}>{label}</label>
      <div className="relative">
        <select id={`${idPrefix}-tecnico`} disabled={disabled} name="tecnico" value={value} onChange={onChange} className={s.selectTecnico}>
          <option value="">{emptyOptionLabel}</option>
          {technicians.map(t => (
            <option key={t.id} value={t.name}>{showSuggestion && t.name === turnoSugerido ? `${t.name} (turno sugerido)` : t.name}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}

export function TipoTrabajoField({ variant, wrapperClassName, idPrefix, value, onChange, disabled = false }) {
  const s = STYLES[variant];
  return (
    <div className={wrapperClassName}>
      <label htmlFor={`${idPrefix}-tipo`} className={s.label}>TRABAJO</label>
      <div className="relative">
        <select id={`${idPrefix}-tipo`} disabled={disabled} name="tipoTrabajo" value={value} onChange={onChange} className={s.selectTipoTrabajo}>
          {TIPOS_TRABAJO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}

export function ObservacionField({ variant, wrapperClassName, idPrefix, value, checked, onChange }) {
  const s = STYLES[variant];
  return (
    <div className={wrapperClassName}>
      <div className="flex items-center justify-between ml-1 mr-1">
        <label htmlFor={`${idPrefix}-observacion`} className={s.labelObs}>OBSERVACIÓN</label>
        <label htmlFor={`${idPrefix}-observacion-interna`} className={s.labelObsInterna}>
          <input id={`${idPrefix}-observacion-interna`} type="checkbox" name="observacionInterna" checked={checked} onChange={onChange} className={s.checkbox} />
          Observación interna
        </label>
      </div>
      <textarea id={`${idPrefix}-observacion`} name="observacion" maxLength="500" value={value} onChange={onChange} rows="2" className={s.textarea}></textarea>
      <p className={s.hint}>{checked ? 'Solo visible en el dashboard, no sale en la plantilla de WhatsApp.' : 'Se agrega en la plantilla de WhatsApp, después del aviso de cobro.'}</p>
    </div>
  );
}

export function TurnoSugeridoBanner({ wrapperClassName, turnoSugerido }) {
  return (
    <div className={wrapperClassName}>
      <Star className="w-3.5 h-3.5 shrink-0 fill-current" />
      <span>Turno sugerido para esta instalación: <strong>{turnoSugerido}</strong> (según el orden semanal configurado). Puedes elegir otro técnico si hace falta.</span>
    </div>
  );
}
