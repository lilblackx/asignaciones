// Consumo de materiales (metros de cable y conectores) por técnico, de los recableados y de las
// visitas de conector. Módulo solo para ADMIN. Cuenta las órdenes ya aprobadas (FINALIZADO): es lo
// que realmente se usó. Las que siguen pre-finalizadas esperando aprobación se informan aparte.
//   - Recableado: gasta los metros de cable y los conectores que se hayan marcado.
//   - Visita de conector (externo o interno): gasta el conector colocado. Las visitas anteriores a
//     que se pidiera el color del conector no lo tienen y no suman.
import { TIPO_CONECTOR_EXTERNO, TIPO_CONECTOR_INTERNO, TIPO_RECABLEADO, COLOR_AZUL, COLOR_VERDE, esVisitaConector } from './tipoVisita.js';

export const PERIODOS = [
  { id: 'HOY', etiqueta: 'Hoy' },
  { id: 'SEMANA', etiqueta: '7 días' },
  { id: 'MES', etiqueta: 'Este mes' },
  { id: 'TODO', etiqueta: 'Todo' },
];

const SIN_TECNICO = 'SIN TÉCNICO';

// Conectores que gastó la orden, por color. Como material solo importa el color: que el conector
// sea externo o interno no cambia cuál se gasta, y con los dos puestos son dos. En una visita de
// conector solo cuenta el conector de esa visita.
export function conectoresPorColor(t) {
  const colores = t.tipoVisita === TIPO_CONECTOR_EXTERNO ? [t.conectorExterno]
    : t.tipoVisita === TIPO_CONECTOR_INTERNO ? [t.conectorInterno]
    : [t.conectorExterno, t.conectorInterno];
  return {
    verde: colores.filter((c) => c === COLOR_VERDE).length,
    azul: colores.filter((c) => c === COLOR_AZUL).length,
  };
}

export const totalConectores = (r) => r.verde + r.azul;

const pendienteDeAprobar = (t) => t.estado === 'PRE-FINALIZADO' || t.estado === 'PRE-FINALIZADA';
const tieneMetros = (t) => t?.tipoVisita === TIPO_RECABLEADO && t.metrosCable != null && Number(t.metrosCable) > 0;
const tieneConector = (t) => esVisitaConector(t?.tipoVisita) && totalConectores(conectoresPorColor(t)) > 0;

export const esRecableadoFinalizado = (t) => tieneMetros(t) && t.estado === 'FINALIZADO';
export const esRecableadoPorAprobar = (t) => tieneMetros(t) && pendienteDeAprobar(t);
export const esVisitaConectorFinalizada = (t) => tieneConector(t) && t.estado === 'FINALIZADO';
export const esVisitaConectorPorAprobar = (t) => tieneConector(t) && pendienteDeAprobar(t);

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

const vacio = () => ({ ordenes: 0, visitas: 0, metros: 0, verde: 0, azul: 0 });

// `ordenes` cuenta recableados; `visitas`, visitas de conector. Los metros son solo de recableados.
function sumar(acum, t) {
  const { verde, azul } = conectoresPorColor(t);
  if (t.tipoVisita === TIPO_RECABLEADO) {
    acum.ordenes += 1;
    acum.metros += Number(t.metrosCable);
  } else {
    acum.visitas += 1;
  }
  acum.verde += verde;
  acum.azul += azul;
}

const nuevaFila = (nombre) => ({ tecnico: nombre, ...vacio(), detalle: [] });

// `ordenes`: las órdenes activas más las archivadas en reportes (pueden repetirse: se
// cuentan una vez por id). `tecnicos`: nombres de los técnicos registrados; salen siempre,
// aunque no hayan usado material en el período. Devuelve { filas, totales, porAprobar }:
//   filas: una por técnico, de más a menos metros (luego, conectores); cada una con su `detalle`
//     (las órdenes: `metros` es null en una visita de conector).
//   totales: suma de todos los técnicos.
//   porAprobar: recableados (con sus metros) y visitas de conector pre-finalizados del período
//     que aún no se aprueban.
export function consumoPorTecnico(ordenes, { desde = 0, hasta = Infinity, tecnicos = [] } = {}) {
  const porTecnico = new Map();
  for (const registrado of tecnicos) {
    const nombre = String(registrado || '').trim();
    if (nombre && !porTecnico.has(nombre.toUpperCase())) porTecnico.set(nombre.toUpperCase(), nuevaFila(nombre));
  }
  const totales = vacio();
  const porAprobar = { ordenes: 0, metros: 0, visitas: 0 };
  const vistas = new Set();

  for (const t of ordenes) {
    const finalizado = esRecableadoFinalizado(t) || esVisitaConectorFinalizada(t);
    if (!finalizado && !esRecableadoPorAprobar(t) && !esVisitaConectorPorAprobar(t)) continue;
    if (t.id != null) {
      if (vistas.has(t.id)) continue;
      vistas.add(t.id);
    }
    const fecha = fechaDeUso(t);
    if (fecha < desde || fecha > hasta) continue;

    if (!finalizado) {
      if (t.tipoVisita === TIPO_RECABLEADO) {
        porAprobar.ordenes += 1;
        porAprobar.metros += Number(t.metrosCable);
      } else {
        porAprobar.visitas += 1;
      }
      continue;
    }

    const nombre = String(t.tecnico || '').trim() || SIN_TECNICO;
    const clave = nombre.toUpperCase();
    if (!porTecnico.has(clave)) porTecnico.set(clave, nuevaFila(nombre));
    const fila = porTecnico.get(clave);
    sumar(fila, t);
    sumar(totales, t);
    fila.detalle.push({
      id: t.id,
      codigo: t.codigo || '',
      nombre: t.nombre || '',
      fecha,
      tipo: t.tipoVisita,
      metros: t.tipoVisita === TIPO_RECABLEADO ? Number(t.metrosCable) : null,
      ...conectoresPorColor(t),
    });
  }

  const filas = [...porTecnico.values()].sort((a, b) => b.metros - a.metros || totalConectores(b) - totalConectores(a) || a.tecnico.localeCompare(b.tecnico));
  filas.forEach((f) => f.detalle.sort((a, b) => b.fecha - a.fecha));
  return { filas, totales, porAprobar };
}
