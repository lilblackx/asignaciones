import { stripEmojis } from '../../utils/sanitizeInput';
import { claseCampo } from '../estilos';

// NAP y puerto en dos campos (la orden los guarda juntos en `nap`, ver utils/napPuerto). Los usan
// la visita de conector externo y la instalación, para que se vean y se llenen igual.
export default function NapPuertoCampos({ nap, onNap, napError, puerto, onPuerto, puertoError }) {
  // Cuadrícula con una fila para las etiquetas, otra para los campos y otra para los avisos: así el campo del
  // puerto queda siempre a la misma altura que el de la NAP, aunque una etiqueta ocupe una línea y la otra dos
  // (el puerto es una columna angosta) o aparezca un aviso de error en una sola de las dos.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-x-2.5 gap-y-1 items-end">
      <label htmlFor="pf-nap" className="col-start-1 row-start-1 block text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        NOMENCLATURA DE LA NAP <span className="font-normal text-red-500">(obligatorio)</span>
      </label>
      <label htmlFor="pf-puerto" className="col-start-2 row-start-1 block text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
        PUERTO <span className="font-normal text-red-500">(obligatorio)</span>
      </label>
      <input
        id="pf-nap"
        type="text"
        maxLength="40"
        placeholder="Ej. NAP 08"
        value={nap}
        onChange={(e) => onNap(stripEmojis(e.target.value))}
        aria-invalid={!!napError}
        className={`col-start-1 row-start-2 min-w-0 ${claseCampo('grande', napError ? 'error' : 'normal')}`}
      />
      <input
        id="pf-puerto"
        type="text"
        inputMode="numeric"
        maxLength="3"
        placeholder="Ej. 3"
        value={puerto}
        onChange={(e) => onPuerto(e.target.value.replace(/\D/g, ''))}
        aria-invalid={!!puertoError}
        className={`col-start-2 row-start-2 min-w-0 ${claseCampo('grande', puertoError ? 'error' : 'normal')}`}
      />
      {napError && <p role="alert" className="col-start-1 row-start-3 text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{napError}</p>}
      {puertoError && <p role="alert" className="col-start-2 row-start-3 text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{puertoError}</p>}
    </div>
  );
}
