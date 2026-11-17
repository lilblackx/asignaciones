import { NIVELES } from '../../hooks/useTamanoLetra';

// El selector de tamaño de letra de Finanzas (ver useTamanoLetra): tres "A" de distinto tamaño.
export default function TamanoLetra({ nivel, onNivel }) {
  return (
    <div role="group" aria-label="Tamaño de letra" title="Tamaño de letra" className="inline-flex items-center gap-2">
      <span className="inline-flex rounded-campo border border-input overflow-hidden">
        {NIVELES.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-pressed={nivel === n.id}
            aria-label={`Letra ${n.texto.toLowerCase()}`}
            title={n.texto}
            onClick={() => onNivel(n.id)}
            className={`h-8 max-lg:h-11 min-w-9 max-lg:min-w-11 px-2 font-bold transition-colors ${n.muestra} ${nivel === n.id ? 'bg-red-600 text-white' : 'bg-card text-zinc-800 dark:text-zinc-100 hover:bg-secondary'}`}
          >A</button>
        ))}
      </span>
    </div>
  );
}
