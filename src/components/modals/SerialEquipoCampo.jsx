import { useState } from 'react';
import { TIPOS_DE_EQUIPO } from '../../constants';
import SelectMenu from '../SelectMenu';
import { MAX_LARGO_SERIAL } from '../../utils/instalacion';
import { evaluarSerialCaja } from '../../utils/serialOlt';

// Equipo nuevo en una visita de "Cambio de equipo": su tipo (MRTV, MTV, MR o SM) y su serial, los dos obligatorios. El serial tiene el mismo
// formato que el de la ONU de una instalación: letras y números, en mayúsculas.
// `onTipoEquipo` (con `tipoEquipo` y `errorTipo`): muestra el desplegable del tipo sobre el serial.
// `aviso`: texto o elemento opcional bajo el campo (solo lo pasa Editar orden para los admins).
// `verificar`: marca el recuadro en verde si el serial es correcto y en rojo si no (lo usa el técnico al pre-finalizar).
const ITEMS_TIPO = [{ value: '', label: 'Elige el tipo de equipo' }, ...TIPOS_DE_EQUIPO.map((t) => ({ value: t, label: t }))];

export default function SerialEquipoCampo({ serial, onSerial, error, aviso = null, verificar = false, tipoEquipo = '', onTipoEquipo = null, errorTipo = '' }) {
  const [tocado, setTocado] = useState(false);
  const evaluacion = verificar ? evaluarSerialCaja(serial) : { estado: 'vacio', codigo: '', mensaje: '' };
  const rojo = evaluacion.estado === 'error' && (tocado || evaluacion.codigo === 'GOPN');
  const verde = evaluacion.estado === 'ok';
  return (
    <div className="space-y-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
      {onTipoEquipo && (
        <div className="space-y-1">
          <label htmlFor="pf-tipo-equipo" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
            TIPO DE EQUIPO NUEVO <span className="font-normal text-red-500">(obligatorio)</span>
          </label>
          <SelectMenu id="pf-tipo-equipo" ariaLabel="Tipo de equipo nuevo" value={tipoEquipo} onChange={onTipoEquipo} items={ITEMS_TIPO} />
          {errorTipo && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{errorTipo}</p>}
        </div>
      )}
      <div className="space-y-1">
      <label htmlFor="pf-serial-equipo" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        SERIAL DEL EQUIPO NUEVO <span className="font-normal text-red-500">(obligatorio)</span>
      </label>
      <input
        id="pf-serial-equipo"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={MAX_LARGO_SERIAL}
        placeholder="Ej. HWTC1A2B3C4D"
        value={serial}
        onChange={(e) => onSerial(e.target.value.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase())}
        onBlur={() => setTocado(true)}
        aria-invalid={!!error || rojo}
        aria-describedby={error || rojo || verde ? 'pf-serial-equipo-error' : undefined}
        className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${error || rojo ? 'border-red-500' : verde ? 'border-emerald-500 focus:border-emerald-500' : 'border-zinc-400 dark:border-zinc-700 focus:border-amber-500'}`}
      />
      {error || rojo
        ? <p id="pf-serial-equipo-error" role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{error || evaluacion.mensaje}</p>
        : verde && <p id="pf-serial-equipo-error" role="status" className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold ml-1">{evaluacion.mensaje}</p>}
      {aviso}
      </div>
    </div>
  );
}
