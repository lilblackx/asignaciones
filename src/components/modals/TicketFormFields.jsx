import { Star } from 'lucide-react';
import { TIPOS_TRABAJO } from '../../constants';
import SelectMenu from '../SelectMenu';
import BuscadorOrden from '../BuscadorOrden';
import { buscarOrdenesGarantia, datosGarantia } from '../../utils/garantia';

// Estilos por variante: 'create' (CreateTicketModal) y 'edit' (EditTicketModal).
// Reproducen exactamente las clases originales de cada modal.
const STYLES = {
  create: {
    label: 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 ml-1',
    labelObs: 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400',
    labelObsInterna: 'flex items-center gap-1 max-lg:min-h-11 text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer',
    selectTipoDoc: 'w-16 shrink-0 appearance-none bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 pl-1 pr-5 py-1.5 rounded text-xs text-center',
    inputCedula: 'w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs',
    selectTecnico: 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 pl-2 pr-7 py-1.5 rounded text-xs uppercase',
    selectTipoTrabajo: 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 pl-2 pr-7 py-1.5 rounded text-xs font-bold',
    textarea: 'w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 rounded text-xs',
    hint: 'text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 ml-1',
    checkbox: 'w-3 h-3 max-lg:w-4 max-lg:h-4 accent-red-600',
  },
  edit: {
    label: 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 ml-1',
    labelObs: 'text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400',
    labelObsInterna: 'flex items-center gap-1 max-lg:min-h-11 text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer',
    selectTipoDoc: 'w-14 shrink-0 appearance-none bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 pl-1 pr-5 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-center text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    inputCedula: 'w-full bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    selectTecnico: 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 pl-3 pr-8 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none uppercase text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    selectTipoTrabajo: 'w-full appearance-none bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 pl-3 pr-8 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none font-bold text-xs text-zinc-900 dark:text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
    textarea: 'w-full bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 px-3 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors',
    hint: 'text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 ml-1',
    checkbox: 'w-3 h-3 max-lg:w-4 max-lg:h-4 accent-red-600',
  },
};

const TIPOS_DOCUMENTO = ['V', 'E', 'J', 'G'].map(v => ({ value: v, label: v }));
const TIPOS_TRABAJO_ITEMS = TIPOS_TRABAJO.map(t => ({ value: t, label: t }));

// Formatea cédula/RIF con separador de miles, solo dígitos.
function formatCedulaValue(rawValue) {
  return rawValue.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// `extra`: controles opcionales a la derecha del campo (p. ej. el estado de SmartOLT).
export function CedulaField({ variant, wrapperClassName, idPrefix, tipoDocumento, cedula, onChange, disabled = false, extra = null }) {
  const s = STYLES[variant];
  const handleCedulaChange = (e) => {
    e.target.value = formatCedulaValue(e.target.value);
    onChange(e);
  };
  return (
    <div className={wrapperClassName}>
      <label htmlFor={`${idPrefix}-cedula`} className={s.label}>CÉDULA / RIF<span className="text-red-600 dark:text-red-400"> *</span></label>
      <div className="flex gap-1">
        <div className="shrink-0">
          <SelectMenu
            id={`${idPrefix}-tipo-doc`}
            ariaLabel="Tipo de documento (V, E, J, G)"
            disabled={disabled}
            value={tipoDocumento}
            onChange={(v) => onChange({ target: { name: 'tipoDocumento', value: v, type: 'text' } })}
            items={TIPOS_DOCUMENTO}
            className={s.selectTipoDoc}
            chevronClassName="w-3 h-3 right-1.5"
          />
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
        {extra}
      </div>
    </div>
  );
}

export function TecnicoField({ variant, wrapperClassName, idPrefix, label, value, onChange, disabled = false, technicians, showSuggestion, turnoSugerido, emptyOptionLabel }) {
  const s = STYLES[variant];
  const tecnicoItems = [
    { value: '', label: emptyOptionLabel },
    ...technicians.map(t => ({ value: t.name, label: showSuggestion && t.name === turnoSugerido ? `${t.name} (turno sugerido)` : t.name }))
  ];
  return (
    <div className={wrapperClassName}>
      <label htmlFor={`${idPrefix}-tecnico`} className={s.label}>{label}</label>
      <SelectMenu
        id={`${idPrefix}-tecnico`}
        ariaLabel={label}
        disabled={disabled}
        value={value}
        onChange={(v) => onChange({ target: { name: 'tecnico', value: v, type: 'text' } })}
        items={tecnicoItems}
        className={s.selectTecnico}
        chevronClassName="w-3.5 h-3.5 right-2"
      />
    </div>
  );
}

export function TipoTrabajoField({ variant, wrapperClassName, idPrefix, value, onChange, disabled = false }) {
  const s = STYLES[variant];
  return (
    <div className={wrapperClassName}>
      <label htmlFor={`${idPrefix}-tipo`} className={s.label}>TRABAJO</label>
      <SelectMenu
        id={`${idPrefix}-tipo`}
        ariaLabel="Trabajo"
        disabled={disabled}
        value={value}
        onChange={(v) => onChange({ target: { name: 'tipoTrabajo', value: v, type: 'text' } })}
        items={TIPOS_TRABAJO_ITEMS}
        className={s.selectTipoTrabajo}
        chevronClassName="w-3.5 h-3.5 right-2"
      />
    </div>
  );
}

export function ObservacionField({ variant, wrapperClassName, idPrefix, value, checked, onChange, etiqueta = 'OBSERVACIÓN' }) {
  const s = STYLES[variant];
  return (
    <div className={wrapperClassName}>
      <div className="flex items-center justify-between ml-1 mr-1">
        <label htmlFor={`${idPrefix}-observacion`} className={s.labelObs}>{etiqueta}</label>
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

// Lo que el técnico describió del trabajo al pre-finalizar: aparte de la observación de la oficina (ObservacionField).
export function ObservacionTecnicoField({ wrapperClassName, idPrefix, value, onChange }) {
  const s = STYLES.edit;
  return (
    <div className={wrapperClassName}>
      <label htmlFor={`${idPrefix}-observacion-tecnico`} className={`${s.labelObs} ml-1 block`}>OBSERVACIÓN DEL TÉCNICO</label>
      <textarea id={`${idPrefix}-observacion-tecnico`} name="observacionTecnico" maxLength="300" value={value} onChange={onChange} rows="2" className={s.textarea}></textarea>
      <p className={s.hint}>Detalles del trabajo que escribió el técnico al pre-finalizar. No sale en la plantilla de WhatsApp.</p>
    </div>
  );
}

export function TurnoSugeridoBanner({ wrapperClassName, turnoSugerido }) {
  return (
    <div className={wrapperClassName}>
      <Star className="w-3.5 h-3.5 shrink-0 fill-current text-red-600 dark:text-red-500" />
      <span>Turno sugerido para esta instalación: <strong>{turnoSugerido}</strong> (según el orden semanal configurado). Puedes elegir otro técnico si hace falta.</span>
    </div>
  );
}

// "Garantía de otro técnico": la orden se hace de nuevo porque lo que hizo otro técnico falló. Marcar el check pide elegir la orden original (con el buscador); al revisar la orden, el administrador
// decide si le descuenta algo al técnico de esa original. `value`: la garantía ({ id, codigo, tecnico, cliente }; sin id = marcada pero sin elegir) o null; `onChange(valor | null)`.
export function GarantiaField({ wrapperClassName, idPrefix, value, onChange, ordenes, idOrden = '', tecnico = '', cedula = '', disabled = false }) {
  const marcada = Boolean(value);
  return (
    <div className={`${wrapperClassName} rounded border border-zinc-300 dark:border-zinc-700 px-2.5 py-2 space-y-2`}>
      <label htmlFor={`${idPrefix}-garantia`} className="flex items-center gap-2 max-lg:min-h-11 text-[11px] max-lg:text-xs font-bold text-zinc-800 dark:text-zinc-100 cursor-pointer">
        <input id={`${idPrefix}-garantia`} type="checkbox" checked={marcada} disabled={disabled} onChange={(e) => onChange(e.target.checked ? { id: '' } : null)} className="w-3.5 h-3.5 max-lg:w-4 max-lg:h-4 accent-red-600" />
        Garantía de otro técnico
      </label>
      {marcada && (
        <div className="space-y-1">
          <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400">Elige la orden original que falló. Al revisar esta orden se decide si se le descuenta algo a su técnico.</p>
          <BuscadorOrden
            id={`${idPrefix}-garantia-orden`}
            etiqueta="Orden original de la garantía"
            valor={value.id ? value : null}
            onElegir={(o) => onChange(o ? datosGarantia(o) : { id: '' })}
            buscar={(texto) => buscarOrdenesGarantia(ordenes, texto, { idExcluido: idOrden, tecnico, cedula })}
            detalle={(o) => o.tipoTrabajo || ''}
            ayuda="Escribe el código, el cliente, la cédula o el técnico. Si la cédula ya está escrita salen primero las órdenes de ese cliente."
          />
        </div>
      )}
    </div>
  );
}
