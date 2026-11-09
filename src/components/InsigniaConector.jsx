import { ETIQUETA_COLOR } from '../utils/tipoVisita';
import { normalizarConectoresInstalacion } from '../utils/conectoresInstalacion';

// UNA sola forma de mostrar un conector en toda la app: una insignia (píldora) con el color del conector, su punto y su nombre, y la cantidad si hay ("Verde ×2").
// El color se lee en el texto y en el fondo, nunca solo en uno de los dos. `apagada`: sin elegir o en cero. No dibujes un conector con texto suelto ni con un punto aparte: usa esta.
const ESTILO_COLOR = { VERDE: 'bg-emerald-700 text-white', AZUL: 'bg-blue-600 text-white' };

export default function InsigniaConector({ color, cantidad = null, children = null, apagada = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${ESTILO_COLOR[color] || 'bg-zinc-600 text-white'} ${apagada ? 'opacity-50' : ''} ${className}`}>
      <span className="w-2.5 h-2.5 rounded-full bg-white/90 shrink-0" aria-hidden="true" />
      {children ?? ETIQUETA_COLOR[color] ?? color}{cantidad !== null && <> ×{cantidad}</>}
    </span>
  );
}

// Los conectores de una instalación (externo e interno, cada uno con sus cantidades por color) como filas de insignias; solo los que se usaron. null si no hay ninguno.
export function InsigniasConectoresInstalacion({ conectores }) {
  const { externo, interno } = normalizarConectoresInstalacion(conectores);
  const filas = [
    { tipo: 'Externo', cantidades: { VERDE: externo.verde, AZUL: 0 } },
    { tipo: 'Interno', cantidades: { VERDE: interno.verde, AZUL: interno.azul } },
  ].filter((f) => f.cantidades.VERDE + f.cantidades.AZUL > 0);
  if (filas.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {filas.map((f) => (
        <li key={f.tipo} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="w-16 text-sm font-black">{f.tipo}</span>
          <span className="flex flex-wrap items-center gap-2">
            {['VERDE', 'AZUL'].filter((c) => f.cantidades[c] > 0).map((c) => <InsigniaConector key={c} color={c} cantidad={f.cantidades[c]} />)}
          </span>
        </li>
      ))}
    </ul>
  );
}
