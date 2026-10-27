import { Plug } from 'lucide-react';
import { conectorDeVisita } from '../../utils/tipoVisita';
import { esInstalacion } from '../../utils/instalacion';
import { normalizarConectoresInstalacion } from '../../utils/conectoresInstalacion';

const ESTILO_COLOR = { VERDE: 'bg-emerald-700 text-white', AZUL: 'bg-blue-600 text-white' };

// Los conectores que se colocaron en una visita de conector: su tipo (externo o interno) y cuántos de cada color, en un bloque
// propio, aparte del cobro de la visita (que sale en su recuadro, con el concepto y el selector de cobro).
// En una instalación van los dos tipos a la vez (externo e interno), cada uno con sus cantidades por color; solo se
// listan los que se usaron. Una instalación anterior a que se pidieran no los tiene y no muestra el bloque.
function ConectoresInstalacion({ ticket }) {
  const { externo, interno } = normalizarConectoresInstalacion(ticket.instalacion?.conectores);
  const filas = [
    { tipo: 'Externo', cantidades: { verde: externo.verde, azul: 0 } },
    { tipo: 'Interno', cantidades: { verde: interno.verde, azul: interno.azul } },
  ].filter((f) => f.cantidades.verde + f.cantidades.azul > 0);
  if (filas.length === 0) return null;
  return (
    <section aria-label="Conectores colocados" className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200">
      <h3 className="flex items-center gap-2 font-black tracking-wide">
        <Plug className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" /> CONECTORES COLOCADOS
      </h3>
      <ul className="mt-2 ml-6 space-y-2">
        {filas.map((f) => (
          <li key={f.tipo} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="w-16 text-sm font-black">{f.tipo}</span>
            <span className="flex flex-wrap items-center gap-2">
              {['VERDE', 'AZUL'].filter((c) => f.cantidades[c.toLowerCase()] > 0).map((c) => (
                <span key={c} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${ESTILO_COLOR[c]}`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-white/90" aria-hidden="true" /> {c === 'VERDE' ? 'Verde' : 'Azul'} ×{f.cantidades[c.toLowerCase()]}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ConectorColocado({ ticket }) {
  if (esInstalacion(ticket?.tipoTrabajo)) return <ConectoresInstalacion ticket={ticket} />;
  const conector = conectorDeVisita(ticket);
  if (!conector) return null;
  // Visita de conector externo con internos azules: el verde es externo y el azul, interno; van en filas separadas.
  if (conector.tipo === 'Externo' && conector.cantidades.azul > 0) return <ConectoresInstalacion ticket={{ instalacion: { conectores: { externo: { verde: conector.cantidades.verde }, interno: { azul: conector.cantidades.azul } } } }} />;
  return (
    <section aria-label="Conectores colocados" className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200">
      <h3 className="flex items-center gap-2 font-black tracking-wide">
        <Plug className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" /> CONECTORES COLOCADOS
      </h3>
      <div className="mt-2 ml-6 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div>
          <span className="block text-[11px] max-lg:text-xs font-bold tracking-wide opacity-70">TIPO</span>
          <span className="text-sm font-black">{conector.tipo}</span>
        </div>
        <div>
          <span className="block text-[11px] max-lg:text-xs font-bold tracking-wide opacity-70">CANTIDAD</span>
          {conector.cantidades.verde + conector.cantidades.azul > 0 ? (
            <span className="mt-0.5 flex flex-wrap items-center gap-2">
              {['VERDE', 'AZUL'].filter((c) => conector.cantidades[c.toLowerCase()] > 0).map((c) => (
                <span key={c} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${ESTILO_COLOR[c]}`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-white/90" aria-hidden="true" /> {c === 'VERDE' ? 'Verde' : 'Azul'} ×{conector.cantidades[c.toLowerCase()]}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-sm italic">Sin cantidad registrada</span>
          )}
        </div>
      </div>
    </section>
  );
}
