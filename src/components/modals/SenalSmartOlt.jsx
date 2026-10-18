import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Radio } from 'lucide-react';
import { consultarSenalOnu } from '../../lib/smartolt';
import { onuEnLinea, valorSenal } from '../../utils/senalOnu';
import { calidadValor } from '../../utils/valoresCliente';

// Calidad con la escala de la empresa (la misma de los campos de valores del cliente), no la de SmartOLT: con dos
// escalas distintas el aviso y el campo se contradecían (SmartOLT decía "Muy buena" y el campo "Regular").
function Calidad({ valor }) {
  const calidad = calidadValor(valor);
  return calidad ? <> · <span className={`font-bold ${calidad.clase}`}>{calidad.texto}</span></> : null;
}

// "Ver valores": el técnico pide la potencia de la ONU del cliente a SmartOLT (solo al
// presionar el botón, nunca sola). El valor de 1310 nm se muestra y queda capturado en el
// campo de potencia por medio de `onCapturar(valor1310, valor1490)` (el de 1490 nm puede
// ser null); el técnico aún puede corregir el de 1310. `onCapturar` devuelve false si no
// escribió el de 1310 porque el campo ya tenía algo escrito: ese valor no se pisa.
// Si el cliente tiene varios servicios, elige cuál es.
export default function SenalSmartOlt({ ticketId, onCapturar, nota }) {
  const [estado, setEstado] = useState(null); // buscando | listo | opciones | vacio | error
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const mostrar = (onu) => {
    if (!onuEnLinea(onu.estado)) {
      setEstado({ tipo: 'fueraDeLinea', onu });
      return;
    }
    const valor = valorSenal(onu.senal1310);
    const valor1490 = valorSenal(onu.senal1490);
    if (valor === null && valor1490 === null) {
      setEstado({ tipo: 'sinSenal', onu });
      return;
    }
    const escrita = onCapturar(valor, valor1490);
    setEstado({ tipo: 'listo', onu, valor, conservada: escrita === false });
  };

  const verValores = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setEstado({ tipo: 'buscando' });
    try {
      const resultados = await consultarSenalOnu(ticketId, controller.signal);
      if (resultados.length === 0) setEstado({ tipo: 'vacio' });
      else if (resultados.length === 1) mostrar(resultados[0]);
      else setEstado({ tipo: 'opciones', opciones: resultados });
    } catch (err) {
      if (err.name !== 'AbortError') setEstado({ tipo: 'error', mensaje: err.message });
    }
  };

  const buscando = estado?.tipo === 'buscando';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={verValores}
        disabled={buscando}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors disabled:opacity-60"
      >
        {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Radio className="w-3.5 h-3.5" aria-hidden="true" />}
        {buscando ? 'Consultando SmartOLT...' : 'Ver valores'}
      </button>

      <div role="status" aria-live="polite">
        {estado?.tipo === 'listo' && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-900 dark:text-emerald-200 space-y-0.5">
            {estado.valor !== null
              ? <p><span className="font-bold">OLT Rx · Potencia (1310 nm):</span> <span className="font-black">{estado.valor} dBm</span><Calidad valor={estado.valor} /></p>
              : <p role="alert" className="font-bold text-amber-800 dark:text-amber-300">OLT Rx 1310 nm: SmartOLT no la reportó</p>}
            {valorSenal(estado.onu.senal1490) !== null
              ? <p><span className="font-bold">ONU Rx · Señal (1490 nm):</span> {valorSenal(estado.onu.senal1490)} dBm<Calidad valor={valorSenal(estado.onu.senal1490)} /></p>
              : <p role="alert" className="font-bold text-amber-800 dark:text-amber-300">ONU Rx 1490 nm: SmartOLT no la reportó</p>}
            {estado.conservada
              ? <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">No se cambió la potencia del campo porque ya tiene un valor escrito.{valorSenal(estado.onu.senal1490) !== null && ' La señal de 1490 nm sí queda capturada con la orden.'} Para usar la de SmartOLT, borra el campo y consulta de nuevo.</p>
              : <p className="text-[10px] opacity-80">{nota ?? (estado.valor === null ? 'La señal de 1490 nm queda capturada con la orden. Escribe la potencia de 1310 nm a mano.' : valorSenal(estado.onu.senal1490) !== null ? 'Ambas señales quedan capturadas con la orden (la de 1310 nm en el campo de potencia).' : 'La señal de 1310 nm queda capturada en el campo de potencia.') + ' Es la última medición de SmartOLT; puedes corregirla.'}</p>}
          </div>
        )}
        {estado?.tipo === 'fueraDeLinea' && (
          <div role="alert" className="rounded-xl border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5">
            <p className="font-bold">La ONU está fuera de línea en SmartOLT ({estado.onu.estado}). No se capturó la potencia.</p>
            <p>SmartOLT solo guarda la última señal de cuando estuvo en línea{valorSenal(estado.onu.senal1310) !== null ? ` (${valorSenal(estado.onu.senal1310)} dBm)` : ''}, que no es la actual. Escribe la potencia a mano o vuelve a consultar cuando la ONU esté en línea.</p>
          </div>
        )}
        {estado?.tipo === 'sinSenal' && (
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 ml-1">SmartOLT no tiene una señal registrada para esta ONU (¿apagada o sin sincronizar?). Escríbela a mano.</p>
        )}
        {estado?.tipo === 'vacio' && (
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 ml-1">No se encontró un cliente con esta cédula en SmartOLT. Escribe la potencia a mano.</p>
        )}
        {estado?.tipo === 'error' && (
          <p role="alert" className="text-[11px] font-bold text-red-600 dark:text-red-400 ml-1">{estado.mensaje} Escribe la potencia a mano.</p>
        )}
        {estado?.tipo === 'opciones' && (
          <div role="group" aria-label="Varias ONU con esta cédula, elige una" className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-500" aria-hidden="true" />
              Esta cédula tiene {estado.opciones.length} servicios. Elige cuál es:
            </p>
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
              {estado.opciones.map((onu) => (
                <button
                  key={onu.idExterno || onu.nombre}
                  type="button"
                  onClick={() => mostrar(onu)}
                  className="w-full text-left rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 hover:border-amber-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{onu.zona || onu.nombre || 'Servicio'}</span>
                    <span className="shrink-0 text-xs font-black text-zinc-600 dark:text-zinc-300">{valorSenal(onu.senal1310) !== null ? `${valorSenal(onu.senal1310)} dBm` : 'sin señal'}</span>
                  </span>
                  {onu.direccion && <span className="block mt-0.5 text-[11px] leading-snug font-medium text-zinc-500 dark:text-zinc-400">{onu.direccion}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
