import { Radio } from 'lucide-react';
import BotonCopiar, { BotonCopiarDato } from '../BotonCopiar';
import { useCopiado } from '../../hooks/useCopiado';
import { calidadValor, textoDbm, textoValorConCalidad, textoValoresCliente } from '../../utils/valoresCliente';

function Fila({ id, etiqueta, valor, copiado, onCopiar }) {
  const calidad = calidadValor(valor);
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400">{etiqueta}</div>
        <div className="text-sm font-black text-zinc-900 dark:text-white font-mono break-words">
          {textoDbm(valor)}
          {calidad && <span className={`ml-2 font-sans text-xs ${calidad.clase}`}>{calidad.texto}</span>}
        </div>
      </div>
      <BotonCopiarDato
        copiado={copiado === id}
        onClick={() => onCopiar(id, textoValorConCalidad(valor), `${etiqueta} copiado.`)}
        etiqueta={`Copiar ${etiqueta}`}
        titulo={`Copiar ${etiqueta}`}
      />
    </div>
  );
}

// Valores de señal del cliente que guardó la oficina al aprobar la orden, con el mismo aspecto que las tarjetas de
// formas de pago: cada valor con su calidad (Bueno / Regular / Crítico) y su botón de copiar, y "Copiar todo".
// `onCopy(texto, mensaje)` hace la copia (devuelve si pudo) y avisa con el toast.
export default function ValoresClienteTarjeta({ valores, onCopy }) {
  const { copiado, copiar } = useCopiado(onCopy);
  return (
    <section aria-label="Valores del cliente" className="bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="flex items-center gap-1.5 text-xs font-black text-red-600 dark:text-red-400">
          <Radio className="w-4 h-4 shrink-0" aria-hidden="true" /> Valores del cliente
        </h3>
        <BotonCopiar
          copiado={copiado === 'todo'}
          onClick={() => copiar('todo', textoValoresCliente(valores), 'Valores del cliente copiados.')}
          etiqueta="Copiar todos los valores del cliente"
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] max-lg:text-xs font-bold"
          tono="bg-zinc-800 text-white hover:bg-zinc-700"
          iconoClase="w-3 h-3"
        >
          Copiar todo
        </BotonCopiar>
      </div>
      <Fila id="olt" etiqueta="OLT Rx · Potencia (1310 nm)" valor={valores.olt1310Dbm} copiado={copiado} onCopiar={copiar} />
      <Fila id="onu" etiqueta="ONU Rx · Señal (1490 nm)" valor={valores.onu1490Dbm} copiado={copiado} onCopiar={copiar} />
      <p className="mt-2 text-[11px] max-lg:text-xs text-zinc-600 dark:text-zinc-400">Medidos por la oficina al revisar la orden.</p>
    </section>
  );
}
