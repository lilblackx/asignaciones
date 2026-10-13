import { useEffect, useState } from 'react';
import { Check, Copy, Landmark, Smartphone, X } from 'lucide-react';
import Modal from '../Modal';
import { CAMPOS_POR_TIPO, TIPO_PAGO_MOVIL, TITULO_POR_TIPO, nombreForma, normalizarFormasPago, textoForma, textoTodasLasFormas } from '../../utils/formasPago';

// Fila "etiqueta + valor + botón copiar". `id` identifica cuál se copió para
// mostrar el check un instante; `contexto` distingue los botones de cada tarjeta
// para los lectores de pantalla.
function FilaCopiable({ id, etiqueta, contexto, valor, copiado, onCopiar }) {
  if (!valor) return null;
  const esteCopiado = copiado === id;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{etiqueta}</div>
        <div className="text-sm font-black text-zinc-900 dark:text-white font-mono break-words">{valor}</div>
      </div>
      <button
        type="button"
        onClick={() => onCopiar(id, valor, `${etiqueta} copiado.`)}
        aria-label={`Copiar ${etiqueta} de ${contexto}`}
        title={`Copiar ${etiqueta}`}
        className={`shrink-0 p-2 rounded-lg transition-colors ${esteCopiado ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}
      >
        {esteCopiado ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

// Una forma de pago (pago móvil, o una cuenta bancaria) en su propia tarjeta.
function TarjetaForma({ forma, indice, copiado, onCopiar }) {
  const Icono = forma.tipo === TIPO_PAGO_MOVIL ? Smartphone : Landmark;
  const idTarjeta = `forma-${indice}`;
  const nombre = nombreForma(forma);
  const tarjetaCopiada = copiado === idTarjeta;
  return (
    <section aria-label={`${TITULO_POR_TIPO[forma.tipo]}: ${nombre}`} className="bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="flex items-center gap-1.5 text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wide">
          <Icono className="w-4 h-4 shrink-0" aria-hidden="true" /> {TITULO_POR_TIPO[forma.tipo]}
        </h3>
        <button
          type="button"
          onClick={() => onCopiar(idTarjeta, textoForma(forma), `Datos de ${nombre} copiados.`)}
          aria-label={`Copiar todos los datos de ${nombre}`}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${tarjetaCopiada ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
        >
          {tarjetaCopiada ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
          Copiar todo
        </button>
      </div>
      {CAMPOS_POR_TIPO[forma.tipo].map(({ clave, etiqueta }) => (
        <FilaCopiable key={clave} id={`${idTarjeta}-${clave}`} etiqueta={etiqueta} contexto={nombre} valor={forma[clave]} copiado={copiado} onCopiar={onCopiar} />
      ))}
    </section>
  );
}

// Vista de solo lectura para el técnico: cada forma de pago en su tarjeta y cada
// dato se copia con un toque para pegarlo en WhatsApp. `onCopy(texto, mensaje)`
// hace la copia (devuelve si pudo) y avisa con el toast.
export default function FormasPagoModal({ formasPago, onCopy, onClose }) {
  const [copiado, setCopiado] = useState(null);
  const formas = normalizarFormasPago(formasPago);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(null), 1500);
    return () => clearTimeout(t);
  }, [copiado]);

  const copiar = async (id, texto, mensaje) => {
    const ok = await onCopy(texto, mensaje);
    if (ok) setCopiado(id);
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Landmark className="w-5 h-5 text-red-500" aria-hidden="true" /> FORMAS DE PAGO</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {formas.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-6">Aún no se han cargado las formas de pago. Avisa al administrador.</p>
          ) : (
            <>
              {formas.map((forma, i) => (
                <TarjetaForma key={i} forma={forma} indice={i} copiado={copiado} onCopiar={copiar} />
              ))}
              {formas.length > 1 && (
                <button
                  type="button"
                  onClick={() => copiar('todas', textoTodasLasFormas(formas), 'Todas las formas de pago copiadas.')}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-colors shadow-md text-white ${copiado === 'todas' ? 'bg-emerald-600' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {copiado === 'todas' ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />} Copiar todas las formas de pago
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
