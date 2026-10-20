// Escalar una orden a infraestructura: el técnico (en el sitio) o la oficina (desde la lista) deja la orden esperando al equipo de
// infraestructura, con un motivo. Mientras espera, la orden sigue PENDIENTE pero sale de la lista del técnico; la oficina la ve con
// una etiqueta y decide cómo sigue: devolverla al técnico (ya está resuelto lo de infraestructura) o cerrarla como trabajo
// adicional (TA, el tipo que tu hoja de visitas llama "TRABAJOS ADICIONALES (INFRA)").
//
// En la orden se guarda un solo campo, que la escalada deja a la vista aunque ya se haya resuelto (así el reporte cuenta el TA
// también cuando la orden volvió al técnico):
//   infraestructura: { activa, motivo, por, origen, en, tecnico, resultado?, resueltaPor?, resueltaEn?, nota? }
//   - activa: true mientras espera; false cuando la oficina la resolvió.
//   - origen: 'TECNICO' (la escaló quien la tenía) u 'OFICINA'.
//   - resultado: 'DEVUELTA' (volvió al técnico) o 'CERRADA' (se cerró como TA).
// No se escalan las instalaciones: el reporte de instalaciones las cuenta finalizadas o no realizadas, sin TA.

import { esInstalacion } from './instalacion.js';

export const ORIGEN_TECNICO = 'TECNICO';
export const ORIGEN_OFICINA = 'OFICINA';
export const RESULTADO_DEVUELTA = 'DEVUELTA';
export const RESULTADO_CERRADA = 'CERRADA';
export const MAX_LARGO_MOTIVO = 300;

export const infraestructuraDe = (t) => {
  const infra = t?.infraestructura;
  return infra && typeof infra === 'object' && !Array.isArray(infra) ? infra : null;
};

// ¿Alguna vez se escaló? Es lo que cuenta el reporte como TA, también si la orden volvió al técnico.
export const fueEscalada = (t) => Boolean(infraestructuraDe(t));

// ¿Está esperando a infraestructura ahora? Solo mientras siga pendiente: una orden cancelada ya no espera nada.
export const enInfraestructura = (t) => t?.estado === 'PENDIENTE' && infraestructuraDe(t)?.activa === true;

// ¿Se cerró como trabajo adicional? Esas órdenes no llevan cobro.
export const cerradaComoTA = (t) => t?.estado === 'FINALIZADO' && infraestructuraDe(t)?.resultado === RESULTADO_CERRADA;

// Las instalaciones no se escalan; solo una orden pendiente y que no esté ya esperando.
export const puedeEscalar = (t) => t?.estado === 'PENDIENTE' && !esInstalacion(t.tipoTrabajo) && !enInfraestructura(t);

// Texto escrito por quien escala -> { valor } o { error }. Es obligatorio: infraestructura necesita saber qué hace falta.
export function parseMotivo(raw) {
  const texto = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!texto) return { error: 'Escribe qué hace falta de infraestructura (poste, troncal, NAP...).' };
  if (texto.length > MAX_LARGO_MOTIVO) return { error: `El motivo es demasiado largo (máximo ${MAX_LARGO_MOTIVO} caracteres).` };
  return { valor: texto };
}

export const construirEscalada = ({ motivo, por, origen, tecnico }, ahora = Date.now()) => ({
  activa: true,
  motivo,
  por: por || '',
  origen: origen === ORIGEN_TECNICO ? ORIGEN_TECNICO : ORIGEN_OFICINA,
  en: ahora,
  tecnico: tecnico || '',
});

// La oficina resuelve la escalada: devuelve la orden al técnico o la cierra como TA. `nota` es opcional (qué hizo infraestructura).
export function construirResolucion(infra, { resultado, por, nota }, ahora = Date.now()) {
  const resto = { ...infra };
  delete resto.nota;
  const notaLimpia = String(nota ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LARGO_MOTIVO);
  return {
    ...resto,
    activa: false,
    resultado: resultado === RESULTADO_CERRADA ? RESULTADO_CERRADA : RESULTADO_DEVUELTA,
    resueltaPor: por || '',
    resueltaEn: ahora,
    ...(notaLimpia ? { nota: notaLimpia } : {}),
  };
}

export const textoOrigen = (infra) => (infra?.origen === ORIGEN_TECNICO ? 'el técnico' : 'la oficina');

// --- Avisos en la app (mientras está abierta; con la app cerrada llega el push) ---

// Cuándo se escaló cada orden que espera ahora: id -> marca de tiempo (0 si no espera).
export const mapaInfraestructura = (tickets) => new Map(tickets.map((t) => [t.id, enInfraestructura(t) ? infraestructuraDe(t).en || 1 : 0]));

// Lo que cambió desde la lectura anterior. Sin lectura anterior (la app acaba de abrirse) no hay nada nuevo que avisar.
//   escaladas: órdenes que empezaron a esperar a infraestructura
//   resueltas: órdenes que dejaron de esperar (volvieron al técnico o se cerraron como TA)
export function cambiosInfraestructura(tickets, previa) {
  if (!previa) return { escaladas: [], resueltas: [] };
  const antes = (t) => previa.get(t.id) || 0;
  return {
    escaladas: tickets.filter((t) => enInfraestructura(t) && (infraestructuraDe(t).en || 1) > antes(t)),
    resueltas: tickets.filter((t) => antes(t) > 0 && !enInfraestructura(t) && infraestructuraDe(t)?.activa === false),
  };
}

const etiqueta = (t) => `${t.codigo || 'S/C'}${t.nombre ? ` — ${t.nombre}` : ''}`;

export const textoEscaladaOficina = (t) => `${infraestructuraDe(t)?.por || t.tecnico || 'Un técnico'} escaló la orden ${etiqueta(t)} a infraestructura.`;
export const textoEscaladaTecnico = (t) => `La orden ${etiqueta(t)} fue escalada a infraestructura. Ya no tienes que atenderla por ahora.`;
export const textoResueltaTecnico = (t) => (cerradaComoTA(t) || infraestructuraDe(t)?.resultado === RESULTADO_CERRADA
  ? `La orden ${etiqueta(t)} se cerró como trabajo de infraestructura. Ya no tienes que atenderla.`
  : `La orden ${etiqueta(t)} volvió de infraestructura. Ya puedes atenderla.${infraestructuraDe(t)?.nota ? ` Nota: ${infraestructuraDe(t).nota}` : ''}`);
