import { useState } from 'react';
import SelectMenu from '../SelectMenu';
import Colapsable from '../Colapsable';
import { CAMPO, ETIQUETA, SELECTOR } from './estilos';
import { MAX_BANCO, bancosDeForma } from '../../utils/datosPago';
import { stripEmojis } from '../../utils/sanitizeInput';

// El banco desde el que se pagó: el desplegable propio de la app con los bancos que corresponden a la forma de pago (venezolanos, o de EE. UU. con Zelle) y "Otro banco...",
// que muestra un campo para escribir el nombre.
// `onChange` recibe el nombre del banco ('' mientras no se elige). `error`: el texto del error, si lo hay.
const OTRO = '__otro__';

export default function CampoBanco({ id, forma, value, onChange, opcional = false, error = '' }) {
  const bancos = bancosDeForma(forma);
  const [otro, setOtro] = useState(() => Boolean(value) && !bancos.includes(value));
  const esOtro = otro || (Boolean(value) && !bancos.includes(value));
  const items = [{ value: '', label: opcional ? 'Sin banco' : 'Elige el banco' }, ...bancos.map((b) => ({ value: b, label: b })), { value: OTRO, label: 'Otro banco...' }];

  const elegir = (v) => {
    if (v === OTRO) { setOtro(true); onChange(''); return; }
    setOtro(false);
    onChange(v);
  };

  return (
    <div>
      <label htmlFor={id} className={ETIQUETA}>Banco desde el que se pagó {opcional && <span className="font-normal">(opcional)</span>}</label>
      <div className="mt-1">
        <SelectMenu id={id} ariaLabel="Banco desde el que se pagó" className={SELECTOR} value={esOtro ? OTRO : value} onChange={elegir} items={items} />
      </div>
      <Colapsable>{esOtro && <input aria-label="Nombre del banco" value={value} onChange={(e) => onChange(stripEmojis(e.target.value))} maxLength={MAX_BANCO} placeholder="Escribe el nombre del banco" autoComplete="off" aria-invalid={Boolean(error)} className={`${CAMPO} mt-2`} />}</Colapsable>
      <Colapsable>{error && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold mt-1">{error}</p>}</Colapsable>
    </div>
  );
}
