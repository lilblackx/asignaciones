import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import NapPuertoCampos from './NapPuertoCampos';
import { MAX_LARGO_METRAJE, MAX_LARGO_POSTE, MAX_LARGO_PUERTOS_DISPONIBLES, MAX_LARGO_SERIAL, MAX_POSTES } from '../../utils/instalacion';
import { stripEmojis } from '../../utils/sanitizeInput';
import { evaluarSerialCaja } from '../../utils/serialOlt';

const claseInput = (error, correcto = false) =>
  `w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${error ? 'border-red-500' : correcto ? 'border-emerald-500 focus:border-emerald-500' : 'border-zinc-400 dark:border-zinc-700 focus:border-amber-500'}`;
const claseEtiqueta = 'text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1';

// Lo que el técnico llena al instalar y la plantilla de la promotora trae vacío. Los campos van en el mismo orden
// que en el modal de revisión de la oficina (ver DatosParaAutorizar): serial, VLAN, NAP y puerto donde
// conecta el cliente (iguales que en la visita de conector externo), metraje del drop, posteadura (uno o varios
// postes) y puertos disponibles en la NAP. Todo es obligatorio. Si se cambia el orden aquí, también el del
// modal de revisión y el del foco al validar (PreFinalizarModal): lo vigila la prueba de utils/instalacion.
export default function DatosInstalacion({ serial, onSerial, vlan, onVlan, postes, onPostes, metraje, onMetraje, nap, onNap, puerto, onPuerto, puertosDisponibles, onPuertosDisponibles, errores }) {
  const cambiarPoste = (i, valor) => onPostes(postes.map((p, j) => (j === i ? valor : p)));
  // Recuadro del serial: verde si es correcto; rojo si no (el rojo sale al salir del campo, salvo "GOPN", que se avisa de una vez).
  const [serialTocado, setSerialTocado] = useState(false);
  const evaluacionSerial = evaluarSerialCaja(serial);
  const serialRojo = evaluacionSerial.estado === 'error' && (serialTocado || evaluacionSerial.codigo === 'GOPN');
  const serialVerde = evaluacionSerial.estado === 'ok';

  return (
    <div className="space-y-4">
      <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 ml-1">Estos datos se escriben en la plantilla de la orden, que luego puedes copiar completa.</p>

      <div className="space-y-1">
        <label htmlFor="pf-serial" className={claseEtiqueta}>
          SERIAL <span className="font-normal text-red-500">(obligatorio)</span>
        </label>
        <input
          id="pf-serial"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={MAX_LARGO_SERIAL}
          placeholder="Ej. HWTC1A2B3C4D"
          value={serial}
          onChange={(e) => onSerial(e.target.value.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase())}
          onBlur={() => setSerialTocado(true)}
          aria-invalid={!!errores.serial || serialRojo}
          aria-describedby={errores.serial || serialRojo || serialVerde ? 'pf-serial-error' : undefined}
          className={claseInput(errores.serial || serialRojo, serialVerde)}
        />
        {errores.serial || serialRojo
          ? <p id="pf-serial-error" role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{errores.serial || evaluacionSerial.mensaje}</p>
          : serialVerde && <p id="pf-serial-error" role="status" className="text-[11px] max-lg:text-xs text-emerald-700 dark:text-emerald-400 font-bold ml-1">{evaluacionSerial.mensaje}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="pf-vlan" className={claseEtiqueta}>
          VLAN <span className="font-normal text-red-500">(obligatorio)</span>
        </label>
        <input
          id="pf-vlan"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="Ej. 100"
          value={vlan}
          onChange={(e) => onVlan(e.target.value.replace(/\D/g, ''))}
          aria-invalid={!!errores.vlan}
          aria-describedby={errores.vlan ? 'pf-vlan-error' : undefined}
          className={claseInput(errores.vlan)}
        />
        {errores.vlan && <p id="pf-vlan-error" role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{errores.vlan}</p>}
      </div>

      <NapPuertoCampos nap={nap} onNap={onNap} napError={errores.nap} puerto={puerto} onPuerto={onPuerto} puertoError={errores.puerto} />

      <div className="space-y-1">
        <label htmlFor="pf-metraje" className={claseEtiqueta}>
          METRAJE DEL DROP <span className="font-normal text-red-500">(obligatorio)</span> <span className="font-normal text-zinc-400">metros de cable</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id="pf-metraje"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={MAX_LARGO_METRAJE}
            placeholder="Ej. 120"
            value={metraje}
            onChange={(e) => onMetraje(e.target.value.replace(/\D/g, ''))}
            aria-invalid={!!errores.metraje}
            aria-describedby={errores.metraje ? 'pf-metraje-error' : undefined}
            className={`flex-1 min-w-0 ${claseInput(errores.metraje)}`}
          />
          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400" aria-hidden="true">m</span>
        </div>
        {errores.metraje && <p id="pf-metraje-error" role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{errores.metraje}</p>}
      </div>

      <div className="space-y-1.5" role="group" aria-labelledby="pf-postes-etiqueta" aria-describedby={errores.posteadura ? 'pf-postes-error' : undefined}>
        <p id="pf-postes-etiqueta" className={claseEtiqueta}>
          POSTEADURA <span className="font-normal text-red-500">(obligatorio)</span> <span className="font-normal text-zinc-400">uno o varios postes</span>
        </p>
        {postes.map((poste, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              autoComplete="off"
              maxLength={MAX_LARGO_POSTE}
              id={`pf-poste-${i + 1}`}
              placeholder={i === 0 ? 'Ej. DM SN N01B01' : `Poste ${i + 1}`}
              aria-label={`Poste ${i + 1}`}
              aria-invalid={i === 0 && !!errores.posteadura}
              value={poste}
              onChange={(e) => cambiarPoste(i, stripEmojis(e.target.value))}
              className={`flex-1 min-w-0 ${claseInput(i === 0 && errores.posteadura)}`}
            />
            {postes.length > 1 && (
              <button
                type="button"
                onClick={() => onPostes(postes.filter((_, j) => j !== i))}
                aria-label={`Quitar poste ${i + 1}`}
                className="shrink-0 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onPostes([...postes, ''])}
          disabled={postes.length >= MAX_POSTES}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-zinc-400 dark:border-zinc-600 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Agregar otro poste
        </button>
        {errores.posteadura && <p id="pf-postes-error" role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{errores.posteadura}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="pf-puertos-disponibles" className={claseEtiqueta}>
          PUERTOS DISPONIBLES <span className="font-normal text-red-500">(obligatorio)</span>
        </label>
        <input
          id="pf-puertos-disponibles"
          type="text"
          autoComplete="off"
          maxLength={MAX_LARGO_PUERTOS_DISPONIBLES}
          placeholder="Ej. 6"
          value={puertosDisponibles}
          onChange={(e) => onPuertosDisponibles(stripEmojis(e.target.value))}
          aria-invalid={!!errores.puertosDisponibles}
          aria-describedby={errores.puertosDisponibles ? 'pf-puertos-disponibles-error' : undefined}
          className={claseInput(errores.puertosDisponibles)}
        />
        {errores.puertosDisponibles
          ? <p id="pf-puertos-disponibles-error" role="alert" className="text-[11px] max-lg:text-xs text-red-600 dark:text-red-400 font-bold ml-1">{errores.puertosDisponibles}</p>
          : <p className="text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400 ml-1">Los que quedan libres en la NAP (si no queda ninguno, escribe 0).</p>}
      </div>
    </div>
  );
}
