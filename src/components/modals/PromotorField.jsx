import { useEffect, useRef } from 'react';
import { claveNombre, MENSAJE_PROMOTOR_CAMPO } from '../../utils/promotora';

// Promotor de una instalación (el nombre de la línea "Promotor:" de la plantilla). Es obligatorio: sin él, el promotor
// no ve la instalación y la orden queda en el limbo. `required` solo no basta: deja pasar un campo con espacios o
// con "N/A", que no es un nombre; por eso se valida con la misma regla que usa la app para guardarlo.
export default function PromotorField({ id, value, onChange, wrapperClassName, labelClassName, inputClassName, ayuda }) {
  const ref = useRef(null);
  const falta = !claveNombre(value);
  useEffect(() => {
    ref.current?.setCustomValidity(falta ? MENSAJE_PROMOTOR_CAMPO : '');
  });
  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className={labelClassName}>
        PROMOTOR<span className="text-red-600 dark:text-red-400"> *</span> <span className="font-normal normal-case text-zinc-400">{ayuda}</span>
      </label>
      <input ref={ref} id={id} required type="text" maxLength="100" name="promotora" value={value} onChange={onChange} className={inputClassName} />
    </div>
  );
}
