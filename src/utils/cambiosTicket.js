import { arrayUnion } from 'firebase/firestore';

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Campos que cambiaron entre la orden como la vio el usuario (`base`) y como queda
// (`nueva`), listos para updateDoc. Así se escribe solo lo que este usuario tocó y no
// se pisa lo que otro cambió mientras tanto (antes se reescribía la orden completa).
// Las entradas nuevas de historialEdiciones se agregan con arrayUnion, sin reemplazar
// las que otro haya sumado. `id` no se escribe: es el nombre del documento.
export function cambiosDeTicket(base, nueva) {
  const cambios = {};
  for (const [campo, valor] of Object.entries(nueva)) {
    if (campo === 'id' || valor === undefined || igual(base[campo], valor)) continue;
    if (campo === 'historialEdiciones') {
      const previas = base.historialEdiciones || [];
      const agregaAlFinal = Array.isArray(valor) && valor.length > previas.length && previas.every((e, i) => igual(e, valor[i]));
      cambios[campo] = agregaAlFinal ? arrayUnion(...valor.slice(previas.length)) : valor;
      continue;
    }
    cambios[campo] = valor;
  }
  return cambios;
}
