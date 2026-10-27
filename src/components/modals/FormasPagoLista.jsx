import BotonCopiar, { BotonCopiarDato } from '../BotonCopiar';
import { useCopiado } from '../../hooks/useCopiado';
import { CAMPOS_POR_TIPO, TITULO_POR_TIPO, nombreForma, textoForma, textoTodasLasFormas } from '../../utils/formasPago';
import { ICONO_POR_TIPO } from './formasPagoIconos';

// Fila "etiqueta + valor + botón copiar". `id` identifica cuál se copió para
// mostrar el check un instante; `contexto` distingue los botones de cada tarjeta
// para los lectores de pantalla.
function FilaCopiable({ id, etiqueta, contexto, valor, copiado, onCopiar }) {
  if (!valor) return null;
  const esteCopiado = copiado === id;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[11px] max-lg:text-xs font-bold text-zinc-600 dark:text-zinc-400">{etiqueta}</div>
        <div className="text-sm font-black text-zinc-900 dark:text-white font-mono break-words">{valor}</div>
      </div>
      <BotonCopiarDato
        copiado={esteCopiado}
        onClick={() => onCopiar(id, valor, `${etiqueta} copiado.`)}
        etiqueta={`Copiar ${etiqueta} de ${contexto}`}
        titulo={`Copiar ${etiqueta}`}
      />
    </div>
  );
}

// Una forma de pago (pago móvil, cuenta bancaria, Zelle o Binance) en su propia tarjeta.
function TarjetaForma({ forma, indice, copiado, onCopiar }) {
  const Icono = ICONO_POR_TIPO[forma.tipo];
  const idTarjeta = `forma-${indice}`;
  const nombre = nombreForma(forma);
  const tarjetaCopiada = copiado === idTarjeta;
  return (
    <section aria-label={`${TITULO_POR_TIPO[forma.tipo]}: ${nombre}`} className="bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="flex items-center gap-1.5 text-xs font-black text-red-600 dark:text-red-400">
          <Icono className="w-4 h-4 shrink-0" aria-hidden="true" /> {TITULO_POR_TIPO[forma.tipo]}
        </h3>
        <BotonCopiar
          copiado={tarjetaCopiada}
          onClick={() => onCopiar(idTarjeta, textoForma(forma), `Datos de ${nombre} copiados.`)}
          etiqueta={`Copiar todos los datos de ${nombre}`}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] max-lg:text-xs font-bold"
          tono="bg-zinc-800 text-white hover:bg-zinc-700"
          iconoClase="w-3 h-3"
        >
          Copiar todo
        </BotonCopiar>
      </div>
      {CAMPOS_POR_TIPO[forma.tipo].map(({ clave, etiqueta }) => (
        <FilaCopiable key={clave} id={`${idTarjeta}-${clave}`} etiqueta={etiqueta} contexto={nombre} valor={forma[clave]} copiado={copiado} onCopiar={onCopiar} />
      ))}
    </section>
  );
}

// Las formas de pago (ya normalizadas con normalizarFormasPago) en tarjetas, cada dato con su botón de copiar y,
// con más de una, "Copiar todas". Lo usan el modal de "Pagos" y la pantalla del cobro resultante.
// `onCopy(texto, mensaje)` hace la copia (devuelve si pudo) y avisa con el toast.
export default function FormasPagoLista({ formas, onCopy }) {
  const { copiado, copiar } = useCopiado(onCopy);

  return (
    <>
      {formas.map((forma, i) => (
        <TarjetaForma key={i} forma={forma} indice={i} copiado={copiado} onCopiar={copiar} />
      ))}
      {formas.length > 1 && (
        <BotonCopiar
          copiado={copiado === 'todas'}
          onClick={() => copiar('todas', textoTodasLasFormas(formas), 'Todas las formas de pago copiadas.')}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm shadow-md"
          tono="bg-red-600 hover:bg-red-700 text-white"
          tonoCopiado="bg-emerald-700 text-white"
        >
          Copiar todas las formas de pago
        </BotonCopiar>
      )}
    </>
  );
}
