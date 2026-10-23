import { NIVELES } from '../../hooks/useTamanoLetra';

// El selector de tamaño de letra de Finanzas (ver useTamanoLetra): tres "A" de distinto tamaño.
export default function TamanoLetra({ nivel, onNivel }) {
  return (
    <div role="group" aria-label="Tamaño de letra" className="inline-flex items-center gap-2">
      <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 hidden sm:inline">Tamaño de letra</span>
      <span className="inline-flex rounded-lg border border-zinc-400 dark:border-zinc-700 overflow-hidden">
        {NIVELES.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-pressed={nivel === n.id}
            aria-label={`Letra ${n.texto.toLowerCase()}`}
            title={n.texto}
            onClick={() => onNivel(n.id)}
            className={`h-9 min-w-10 px-2.5 font-bold transition-colors ${n.muestra} ${nivel === n.id ? 'bg-red-600 text-white' : 'bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >A</button>
        ))}
      </span>
    </div>
  );
}
