// Consumo de materiales de los recableados (metros de cable y conectores) por técnico.
// Módulo solo para ADMIN. Cuenta los recableados ya aprobados (FINALIZADO): es lo que
// realmente se usó. Los que siguen pre-finalizados esperando aprobación se informan aparte.
import { TIPO_RECABLEADO, COLOR_AZUL, COLOR_VERDE } from './tipoVisita.js';

export const PERIODOS = [
  { id: 'HOY', etiqueta: 'Hoy' },
  { id: 'SEMANA', etiqueta: '7 días' },
  { id: 'MES', etiqueta: 'Este mes' },
  { id: 'TODO', etiqueta: 'Todo' },
];

const SIN_TECNICO = 'SIN TÉCNICO';

const tieneMetros = (t) => t?.tipoVisita === TIPO_RECABLEADO && t.metrosCable != null && Number(t.metrosCable) > 0;
export const esRecableadoFinalizado = (t) => tieneMetros(t) && t.estado === 'FINALIZADO';
export const esRecableadoPorAprobar = (t) => tieneMetros(t) && (t.estado === 'PRE-FINALIZADO' || t.estado === 'PRE-FINALIZADA');

// Cuándo se usó el material: al finalizar la orden (finalizadoEn) o, si no está, al crearla.
export const fechaDeUso = (t) => Number(t.finalizadoEn) || Number(t.createdAt) || 0;

// Inicio del período (ms) en la hora local; 0 = sin límite.
export function inicioPeriodo(periodo, ahora = new Date()) {
  const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  if (periodo === 'HOY') return dia.getTime();
  if (periodo === 'SEMANA') return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() - 6).getTime();
  if (periodo === 'MES') return new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
  return 0;
}

const vacio = () => ({ ordenes: 0, metros: 0, externoVerde: 0, internoVerde: 0, internoAzul: 0 });

function sumar(acum, t) {
  acum.ordenes += 1;
  acum.metros += Number(t.metrosCable);
  if (t.conectorExterno === COLOR_VERDE) acum.externoVerde += 1;
  if (t.conectorInterno === COLOR_VERDE) acum.internoVerde += 1;
  if (t.conectorInterno === COLOR_AZUL) acum.internoAzul += 1;
}

export const totalConectores = (r) => r.externoVerde + r.internoVerde + r.internoAzul;

// `ordenes`: las órdenes activas más las archivadas en reportes (pueden repetirse: se
// cuentan una vez por id). Devuelve { filas, totales, porAprobar }:
//   filas: una por técnico, de más a menos metros; cada una con su `detalle` (las órdenes).
//   totales: suma de todos los técnicos.
//   porAprobar: recableados pre-finalizados del período que aún no se aprueban.
export function consumoPorTecnico(ordenes, { desde = 0, hasta = Infinity } = {}) {
  const porTecnico = new Map();
  const totales = vacio();
  const porAprobar = { ordenes: 0, metros: 0 };
  const vistas = new Set();

  for (const t of ordenes) {
    const finalizado = esRecableadoFinalizado(t);
    if (!finalizado && !esRecableadoPorAprobar(t)) continue;
    if (t.id != null) {
      if (vistas.has(t.id)) continue;
      vistas.add(t.id);
    }
    const fecha = fechaDeUso(t);
    if (fecha < desde || fecha > hasta) continue;

    if (!finalizado) {
      porAprobar.ordenes += 1;
      porAprobar.metros += Number(t.metrosCable);
      continue;
    }

    const nombre = String(t.tecnico || '').trim() || SIN_TECNICO;
    const clave = nombre.toUpperCase();
    if (!porTecnico.has(clave)) porTecnico.set(clave, { tecnico: nombre, ...vacio(), detalle: [] });
    const fila = porTecnico.get(clave);
    sumar(fila, t);
    sumar(totales, t);
    fila.detalle.push({
      id: t.id,
      codigo: t.codigo || '',
      nombre: t.nombre || '',
      fecha,
      metros: Number(t.metrosCable),
      conectorExterno: t.conectorExterno || '',
      conectorInterno: t.conectorInterno || '',
    });
  }

  const filas = [...porTecnico.values()].sort((a, b) => b.metros - a.metros || a.tecnico.localeCompare(b.tecnico));
  filas.forEach((f) => f.detalle.sort((a, b) => b.fecha - a.fecha));
  return { filas, totales, porAprobar };
}
