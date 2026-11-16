import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { claseCampo } from './estilos';

// Elige una orden buscándola: un campo de texto y debajo los resultados (`buscar(texto)` devuelve las órdenes que coinciden). Elegida una, se muestra resumida con un botón para cambiarla.
// `valor`: la elegida ({ codigo, tecnico, cliente }) o null; `onElegir(orden | null)`; `detalle(orden)`: un texto extra por resultado (el precio, el tipo de trabajo...); `vacio`: qué decir si no hay resultados.
export default function BuscadorOrden({ id, etiqueta, valor, onElegir, buscar, detalle, vacio = 'Ninguna orden coincide.', ayuda = 'Escribe el código, el cliente, la cédula o el técnico.', className = '' }) {
  const [texto, setTexto] = useState('');
  const resultados = buscar(texto);

  if (valor) {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-card border border-input bg-card px-3 py-2 ${className} max-lg:shadow-card`}>
        <span className="min-w-0 text-xs text-zinc-900 dark:text-zinc-100">
          <span className="font-bold">{valor.codigo || 'S/C'}</span>{valor.cliente ? ` · ${valor.cliente}` : ''}
          <span className="block text-muted-foreground">Técnico {valor.tecnico}{detalle && valor.detalle ? ` · ${valor.detalle}` : ''}</span>
        </span>
        <button type="button" onClick={() => { onElegir(null); setTexto(''); }} aria-label="Cambiar la orden elegida" className="shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-campo border border-input hover:bg-secondary"><X className="w-3.5 h-3.5" aria-hidden="true" /> Cambiar</button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
        <input id={id} type="search" aria-label={etiqueta} value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" placeholder="Buscar orden..." className={claseCampo('normal').replace('px-3', 'pl-9 pr-3')} />
      </div>
      {resultados.length > 0 ? (
        <ul role="listbox" aria-label="Resultados" className="mt-1 max-h-56 overflow-y-auto rounded-card border border-zinc-300 dark:border-zinc-700 bg-card divide-y divide-zinc-200 dark:divide-zinc-800 max-lg:shadow-card">
          {resultados.map((o) => (
            <li key={o.id ?? `${o.codigo}-${o.createdAt}`} role="option" aria-selected="false">
              <button type="button" onClick={() => onElegir(o)} className="w-full text-left px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 hover:bg-secondary">
                <span className="font-bold">{o.codigo || 'S/C'}</span> · {o.nombre || 'Sin nombre'}
                <span className="block text-muted-foreground">Técnico {o.tecnico}{detalle ? ` · ${detalle(o)}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{texto.trim() ? vacio : ayuda}</p>
      )}
    </div>
  );
}
