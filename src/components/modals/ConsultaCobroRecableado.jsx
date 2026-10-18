import { useState } from 'react';
import { Banknote, Hourglass } from 'lucide-react';
import { consultaCobroDe, consultaPendiente, respuestaVigente, textoRespuesta } from '../../utils/consultaCobro';
import { parseMetros } from '../../utils/tipoVisita';

// Bloque de Pre-finalizar con recableado: con los metros ya escritos, el técnico le pregunta a la oficina cuánto se cobra
// y aquí ve la respuesta. `ticket` es la orden al día (la respuesta llega mientras el modal está abierto).
// `onConsultar(metros)` guarda la consulta y avisa a la oficina; devuelve si se pudo.
export default function ConsultaCobroRecableado({ ticket, metros, onConsultar }) {
  const [enviando, setEnviando] = useState(false);
  const metrosEscritos = parseMetros(metros);
  const consulta = consultaCobroDe(ticket);
  const respuesta = respuestaVigente(ticket);
  const pendiente = consultaPendiente(ticket);
  // La consulta y la respuesta valen para los metros consultados: si el técnico los cambió, hay que consultar de nuevo.
  const mismosMetros = consulta && metrosEscritos.valor === consulta.metros;

  const consultar = async () => {
    setEnviando(true);
    await onConsultar(metrosEscritos.valor);
    setEnviando(false);
  };

  if (respuesta && mismosMetros) {
    return (
      <div role="status" className="rounded-xl border-2 border-sky-400 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 p-3 text-center">
        <p className="text-[11px] font-black tracking-wide text-sky-800 dark:text-sky-300">COBRO DEL RECABLEADO ({respuesta.metros} m)</p>
        <p className="mt-0.5 text-3xl font-black text-sky-700 dark:text-sky-300 leading-tight break-words">{textoRespuesta(respuesta)}</p>
        <p className="mt-1 text-[11px] text-sky-900 dark:text-sky-200">Lo respondió la oficina{respuesta.por ? ` (${respuesta.por})` : ''}. Infórmalo al cliente antes de colocar el cable.</p>
      </div>
    );
  }

  const esperando = pendiente && mismosMetros;
  return (
    <div className="space-y-2">
      {esperando ? (
        <div role="status" className="rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
          <Hourglass className="w-4 h-4 shrink-0 mt-px text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="leading-snug"><span className="font-black">Consulta enviada ({consulta.metros} m).</span> Te avisaremos cuando la oficina responda; esta pantalla se actualiza sola.</p>
        </div>
      ) : (
        <>
          {respuesta && !mismosMetros && (
            <p className="text-[11px] text-amber-800 dark:text-amber-300 ml-1">La respuesta anterior ({textoRespuesta(respuesta)}) fue para {respuesta.metros} m. Con los metros nuevos hay que consultar otra vez.</p>
          )}
          {consulta && !respuesta && !mismosMetros && (
            <p className="text-[11px] text-amber-800 dark:text-amber-300 ml-1">Cambiaste los metros ({consulta.metros} m consultados): vuelve a consultar.</p>
          )}
        </>
      )}
      <button
        type="button"
        onClick={consultar}
        disabled={enviando || Boolean(metrosEscritos.error)}
        className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Banknote className="w-3.5 h-3.5" aria-hidden="true" />
        {enviando ? 'Enviando...' : esperando ? 'Volver a avisar a la oficina' : 'Consultar cobro a la oficina'}
      </button>
      {!esperando && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-1">{metrosEscritos.error ? 'Escribe los metros de cable para poder consultar el cobro.' : 'La oficina te responde cuánto se cobra por este recableado.'}</p>}
    </div>
  );
}
