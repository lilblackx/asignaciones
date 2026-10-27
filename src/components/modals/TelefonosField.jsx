import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { MAX_TELEFONOS, errorTelefono, limpiarTelefono, parseTelefonos, unirTelefonos } from '../../utils/telefono';
import Colapsable from '../Colapsable';
import { DURACION_PLIEGUE_MS, salidaAnimada } from '../../hooks/usePresencia';

// "×" dentro del input (a la derecha) y "+ Agregar" como enlace bajo la lista:
// así cada número ocupa una sola fila, sin una columna de botones al lado.
const botonQuitar = 'absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors';
const botonAgregar = 'inline-flex items-center gap-1 ml-1 text-[11px] max-lg:text-xs font-bold text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed';

// Cada fila lleva una clave propia para que, al quitar una, se pliegue esa y no se reacomode el resto.
let ultimaClave = 0;
const nuevaClave = () => { ultimaClave += 1; return ultimaClave; };

const aFilas = (valor) => {
  const lista = parseTelefonos(valor);
  return lista.length ? lista : [''];
};

// Teléfonos de la orden: un input por número y un "+" para sumar otro. Hacia
// afuera sigue siendo un solo string ("a / b"), ver utils/telefono. El primer
// input lleva `id` para enlazarlo con el <label> del formulario. Con `required`,
// el primer número es obligatorio (un campo deshabilitado no se exige).
export default function TelefonosField({ id, value, onChange, disabled = false, required = false, inputClassName }) {
  const [filas, setFilas] = useState(() => aFilas(value));
  const [claves, setClaves] = useState(() => filas.map(nuevaClave));
  // Las filas con las que se abrió el formulario no se despliegan: solo las que se suman después.
  const [clavesIniciales] = useState(() => new Set(claves));
  // Clave de la fila que se está plegando antes de quitarla de verdad.
  const [saliendo, setSaliendo] = useState(null);
  const [tocado, setTocado] = useState(false);
  const [enfocada, setEnfocada] = useState(-1);
  const inputs = useRef([]);
  const enfocarUltima = useRef(false);
  // Lo último que hubo, para quitar la fila correcta cuando termina de plegarse aunque se haya editado otra mientras tanto.
  const ultimas = useRef({ filas, claves });
  const temporizador = useRef(null);

  // Si el valor cambia desde afuera (plantilla pegada, otra orden), se rehacen
  // las filas; si solo es eco de lo que se está escribiendo, no se tocan.
  const [valorPrevio, setValorPrevio] = useState(value);
  if (value !== valorPrevio) {
    setValorPrevio(value);
    if (unirTelefonos(filas) !== unirTelefonos(parseTelefonos(value))) {
      const rehechas = aFilas(value);
      setFilas(rehechas);
      setClaves(rehechas.map(nuevaClave));
    }
  }

  useEffect(() => {
    if (!enfocarUltima.current) return;
    enfocarUltima.current = false;
    inputs.current[filas.length - 1]?.focus();
  }, [filas.length]);

  useEffect(() => {
    ultimas.current = { filas, claves };
  });
  useEffect(() => () => clearTimeout(temporizador.current), []);

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
    setClaves([...claves, nuevaClave()]);
    actualizar([...filas, '']);
  };
  const quitar = (i) => {
    if (saliendo !== null) return;
    const clave = claves[i];
    const quitarYa = () => {
      const { filas: actuales, claves: clavesActuales } = ultimas.current;
      const j = clavesActuales.indexOf(clave);
      setSaliendo(null);
      if (j < 0) return;
      if (actuales.length > 1) {
        setClaves(clavesActuales.filter((_, k) => k !== j));
        actualizar(actuales.filter((_, k) => k !== j));
      } else {
        actualizar(['']);
      }
    };
    // En PC la fila se pliega primero y se quita al terminar; si es la única, solo se vacía.
    if (filas.length > 1 && salidaAnimada()) {
      setSaliendo(clave);
      temporizador.current = setTimeout(quitarYa, DURACION_PLIEGUE_MS);
    } else {
      quitarYa();
    }
  };

  const ultimaVacia = !filas[filas.length - 1].trim();

  // Solo se exige formato una vez que el usuario toca este campo, para que una
  // orden vieja con un teléfono en otro formato siga guardándose si no lo edita.
  // El bloqueo al guardar lo hace la validación nativa del formulario.
  const errores = filas.map((fila, i) => (tocado ? errorTelefono(fila, filas.slice(0, i)) : ''));
  // Obligatorio = que haya al menos un número en alguna fila; el aviso va en la primera.
  // `required` solo no basta: deja pasar un campo con solo espacios y la orden se guardaría sin teléfono.
  const falta = required && !disabled && !filas.some(f => f.trim());
  useEffect(() => {
    inputs.current.forEach((el, i) => {
      el?.setCustomValidity(falta && i === 0 ? 'Escribe el teléfono del cliente.' : (errores[i] || ''));
    });
  });

  return (
    <div className="space-y-1.5">
      {filas.map((fila, i) => {
        const puedeQuitar = !disabled && filas.length > 1;
        const error = enfocada === i ? '' : errores[i];
        return (
          <Colapsable key={claves[i]} animarAlMontar={!clavesIniciales.has(claves[i])}>
            {claves[i] !== saliendo && (
              <div>
                <div className="relative">
                  <input
                    id={i === 0 ? id : `${id}-${i + 1}`}
                    ref={(el) => { inputs.current[i] = el; }}
                    type="tel"
                    inputMode="tel"
                    maxLength="20"
                    required={falta && i === 0}
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
                {error && <p id={`${id}-error-${i}`} className="text-[11px] max-lg:text-xs font-medium text-red-600 dark:text-red-400 ml-1 mt-0.5">{error}</p>}
              </div>
            )}
          </Colapsable>
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
