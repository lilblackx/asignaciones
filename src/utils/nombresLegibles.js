// Para el PDF y el Word (no para el CSV, que se queda con los nombres tal cual están guardados): los nombres de los técnicos con mayúscula inicial ("Gerardo Molero"),
// como se ven en la app. Cambia las columnas "Técnico" de las tablas, las etiquetas de las gráficas "por técnico" y el técnico de la cifra "Mejor ritmo".
import { legible } from './nombreTecnico.js';

const EXCEPCIONES = new Set(['Sin técnico']);
const nombre = (v) => (typeof v === 'string' && v && !EXCEPCIONES.has(v) ? legible(v) : v);

export function conNombresLegibles(modelo) {
  return {
    ...modelo,
    bloques: (modelo.bloques || []).map((b) => {
      if (b.tipo === 'tabla' && Array.isArray(b.columnas)) {
        const columnas = b.columnas.map((c, i) => (c.titulo === 'Técnico' ? i : -1)).filter((i) => i >= 0);
        if (columnas.length === 0) return b;
        return { ...b, filas: b.filas.map((f) => (Array.isArray(f) ? f.map((v, i) => (columnas.includes(i) ? nombre(v) : v)) : f)) };
      }
      if (b.tipo === 'grafico' && /técnico/i.test(b.titulo || '') && Array.isArray(b.categorias)) {
        return { ...b, categorias: b.categorias.map((c) => (c && typeof c === 'object' ? { ...c, etiqueta: nombre(c.etiqueta) } : c)) };
      }
      if (b.tipo === 'cifras' && Array.isArray(b.items)) {
        return { ...b, items: b.items.map((it) => (it.etiqueta === 'Mejor ritmo' ? { ...it, valor: nombre(it.valor) } : it)) };
      }
      return b;
    }),
  };
}
