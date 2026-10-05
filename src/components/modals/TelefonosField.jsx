import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { MAX_TELEFONOS, errorTelefono, limpiarTelefono, parseTelefonos, unirTelefonos } from '../../utils/telefono';

// "×" dentro del input (a la derecha) y "+ Agregar" como enlace bajo la lista:
// así cada número ocupa una sola fila, sin una columna de botones al lado.
const botonQuitar = 'absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors';
const botonAgregar = 'inline-flex items-center gap-1 ml-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed';

const aFilas = (valor) => {
  const lista = parseTelefonos(valor);
  return lista.length ? lista : [''];
};

// Teléfonos de la orden: un input por número y un "+" para sumar otro. Hacia
// afuera sigue siendo un solo string ("a / b"), ver utils/telefono. El primer
// input lleva `id` para enlazarlo con el <label> del formulario.
export default function TelefonosField({ id, value, onChange, disabled = false, inputClassName }) {
  const [filas, setFilas] = useState(() => aFilas(value));
  const [tocado, setTocado] = useState(false);
  const [enfocada, setEnfocada] = useState(-1);
  const inputs = useRef([]);
  const enfocarUltima = useRef(false);

  // Si el valor cambia desde afuera (plantilla pegada, otra orden), se rehacen
  // las filas; si solo es eco de lo que se está escribiendo, no se tocan.
  const [valorPrevio, setValorPrevio] = useState(value);
  if (value !== valorPrevio) {
    setValorPrevio(value);
    if (unirTelefonos(filas) !== unirTelefonos(parseTelefonos(value))) setFilas(aFilas(value));
  }

  useEffect(() => {
    if (!enfocarUltima.current) return;
    enfocarUltima.current = false;
    inputs.current[filas.length - 1]?.focus();
  }, [filas.length]);

  const actualizar = (nuevas) => {
    setFilas(nuevas);
    onChange(unirTelefonos(nuevas));
  };

  const editar = (i, texto) => {
    setTocado(true);
    actualizar(filas.map((f, j) => (j === i ? limpiarTelefono(texto) : f)));
  };
  const agregar = () => {
    enfocarUltima.current = true;
    actualizar([...filas, '']);
  };
  const quitar = (i) => actualizar(filas.length > 1 ? filas.filter((_, j) => j !== i) : ['']);

  const ultimaVacia = !filas[filas.length - 1].trim();

  // Solo se exige formato una vez que el usuario toca este campo, para que una
  // orden vieja con un teléfono en otro formato siga guardándose si no lo edita.
  // El bloqueo al guardar lo hace la validación nativa del formulario.
  const errores = filas.map((fila, i) => (tocado ? errorTelefono(fila, filas.slice(0, i)) : ''));
  useEffect(() => {
    inputs.current.forEach((el, i) => el?.setCustomValidity(errores[i] || ''));
  });

  return (
    <div className="space-y-1.5">
      {filas.map((fila, i) => {
        const puedeQuitar = !disabled && filas.length > 1;
        const error = enfocada === i ? '' : errores[i];
        return (
          <div key={i}>
            <div className="relative">
              <input
                id={i === 0 ? id : `${id}-${i + 1}`}
                ref={(el) => { inputs.current[i] = el; }}
                type="tel"
                inputMode="tel"
                maxLength="20"
                disabled={disabled}
                aria-label={filas.length > 1 ? `Teléfono ${i + 1}` : undefined}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? `${id}-error-${i}` : undefined}
                value={fila}
                onChange={(e) => editar(i, e.target.value)}
                onFocus={() => setEnfocada(i)}
                onBlur={() => setEnfocada(-1)}
                className={`w-full ${puedeQuitar ? 'pr-8' : ''} ${inputClassName} aria-invalid:border-red-500 dark:aria-invalid:border-red-500`}
              />
              {puedeQuitar && (
                <button type="button" onClick={() => quitar(i)} aria-label={`Quitar teléfono ${i + 1}`} title="Quitar" className={botonQuitar}>
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            {error && <p id={`${id}-error-${i}`} className="text-[10px] font-medium text-red-600 dark:text-red-400 ml-1 mt-0.5">{error}</p>}
          </div>
        );
      })}
      {!disabled && filas.length < MAX_TELEFONOS && (
        <button type="button" onClick={agregar} disabled={ultimaVacia} className={botonAgregar}>
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Agregar otro teléfono
        </button>
      )}
    </div>
  );
}
