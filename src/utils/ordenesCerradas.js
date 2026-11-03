// Órdenes ya cerradas (finalizadas o canceladas) que salen en la búsqueda del dashboard, debajo de las activas.
// Salen de dos lados, sin pedir nada nuevo a Firestore: las de hoy, que siguen en la lista viva hasta el cierre del día, y las ya archivadas
// por el cierre (los reportes que la app tiene cargados).
import { fechaDeOrden } from './fechaOrden.js';

// Con menos letras casi todo coincide y la lista se llenaría de órdenes viejas.
export const MIN_BUSQUEDA_CERRADAS = 3;

export const esCerrada = (t) => t?.estado === 'FINALIZADO' || t?.estado === 'CANCELADO';

export const buscaEnCerradas = (texto) => String(texto || '').trim().length >= MIN_BUSQUEDA_CERRADAS;

// DD/MM/AAAA del día en que se finalizó o se canceló (la misma fecha que usan los reportes).
export function fechaCierreTexto(t) {
  const ms = fechaDeOrden(t);
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Las cerradas que cumplen `coincide`, la más reciente primero.
//   vivas:      las órdenes de la lista (las finalizadas de hoy se devuelven tal cual, para que editarlas funcione igual que en "Finalizados").
//   archivadas: las de los cierres cargados. Se devuelven COPIAS marcadas con `_archivada` (no son órdenes vivas: la oficina solo las consulta).
//               Una que ya está viva no se repite, ni tampoco la misma en dos cierres (gana la del cierre más reciente: vienen en ese orden).
//   coincide:   la misma prueba del buscador de activas.
//   filtros:    tipo de trabajo (en mayúsculas) y técnico elegidos en Filtros, para que valgan también aquí.
export function buscarCerradas({ vivas, archivadas = [], coincide, tipo = 'TODOS', tecnico = '' }) {
  const vistos = new Set(vivas.map((t) => t.id));
  const lista = vivas.filter(esCerrada);
  for (const t of archivadas) {
    if (!esCerrada(t) || (t.id !== undefined && vistos.has(t.id))) continue;
    if (t.id !== undefined) vistos.add(t.id);
    lista.push({ ...t, _archivada: true, _clave: `archivada-${lista.length}-${t.id ?? ''}` });
  }
  return lista
    .filter((t) => coincide(t)
      && (tipo === 'TODOS' || String(t.tipoTrabajo || '').toUpperCase() === tipo)
      && (!tecnico || t.tecnico === tecnico))
    .sort((a, b) => fechaDeOrden(b) - fechaDeOrden(a));
}
