// Consumo de materiales (metros de cable y conectores) por técnico, de los recableados, las
// instalaciones y las visitas de conector. Módulo solo para ADMIN. Cuenta las órdenes ya aprobadas (FINALIZADO): es lo
// que realmente se usó. Las que siguen pre-finalizadas esperando aprobación se informan aparte.
//   - Recableado: gasta los metros de cable y los conectores que se hayan marcado.
//   - Instalación: gasta el metraje de cable que el técnico registró al instalar (es obligatorio).
//   - Visita de conector (externo o interno): gasta el conector colocado. Las visitas anteriores a
//     que se pidiera el color del conector no lo tienen y no suman.
import { esInstalacion, metrajeInstalacion } from './instalacion.js';
import { TIPO_RECABLEADO, COLOR_AZUL, COLOR_VERDE, cantidadesConector, esVisitaConector } from './tipoVisita.js';

export const PERIODOS = [
  { id: 'HOY', etiqueta: 'Hoy' },
  { id: 'SEMANA', etiqueta: '7 días' },
  { id: 'MES', etiqueta: 'Este mes' },
  { id: 'TODO', etiqueta: 'Todo' },
];

const SIN_TECNICO = 'SIN TÉCNICO';

// Conectores que gastó la orden, por color. Como material solo importa el color: que el conector
// sea externo o interno no cambia cuál se gasta. En una visita de conector cuentan las cantidades que
// el técnico escribió (las visitas anteriores, que solo tienen el color, cuentan como 1); en un recableado,
// un conector por cada uno marcado (con los dos puestos son dos).
export function conectoresPorColor(t) {
  if (esVisitaConector(t.tipoVisita)) return cantidadesConector(t);
  const colores = [t.conectorExterno, t.conectorInterno];
  return {
    verde: colores.filter((c) => c === COLOR_VERDE).length,
    azul: colores.filter((c) => c === COLOR_AZUL).length,
  };
}

export const totalConectores = (r) => r.verde + r.azul;

const pendienteDeAprobar = (t) => t.estado === 'PRE-FINALIZADO' || t.estado === 'PRE-FINALIZADA';
const esRecableado = (t) => t?.tipoVisita === TIPO_RECABLEADO;
const tieneMetros = (t) => esRecableado(t) && t.metrosCable != null && Number(t.metrosCable) > 0;
// Una instalación con su metraje registrado. Las anteriores a que se pidiera no lo tienen y no suman.
const tieneMetraje = (t) => esInstalacion(t?.tipoTrabajo) && metrajeInstalacion(t) != null;
// Gasta cable: recableado o instalación. Si no, es una visita de conector (que no gasta cable).
const gastaCable = (t) => tieneMetros(t) || tieneMetraje(t);
const metrosDe = (t) => (esRecableado(t) ? Number(t.metrosCable) : metrajeInstalacion(t));
// Tipo de la orden para mostrarla: 'RECABLEADO', 'INSTALACION' o 'VISITA' (de conector).
const claseDe = (t) => (esRecableado(t) ? 'RECABLEADO' : esInstalacion(t?.tipoTrabajo) ? 'INSTALACION' : 'VISITA');
const tieneConector = (t) => esVisitaConector(t?.tipoVisita) && totalConectores(conectoresPorColor(t)) > 0;

export const esRecableadoFinalizado = (t) => tieneMetros(t) && t.estado === 'FINALIZADO';
export const esRecableadoPorAprobar = (t) => tieneMetros(t) && pendienteDeAprobar(t);
// Un recableado con metros se cuenta como recableado aunque la orden sea de instalación.
export const esInstalacionFinalizada = (t) => !esRecableado(t) && tieneMetraje(t) && t.estado === 'FINALIZADO';
export const esInstalacionPorAprobar = (t) => !esRecableado(t) && tieneMetraje(t) && pendienteDeAprobar(t);
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

const vacio = () => ({ ordenes: 0, instalaciones: 0, visitas: 0, metros: 0, verde: 0, azul: 0 });

// `ordenes` cuenta recableados; `instalaciones`, instalaciones; `visitas`, visitas de conector. Los
// metros son de recableados e instalaciones.
function sumar(acum, t) {
  const { verde, azul } = conectoresPorColor(t);
  if (esRecableado(t)) {
    acum.ordenes += 1;
    acum.metros += metrosDe(t);
  } else if (tieneMetraje(t)) {
    acum.instalaciones += 1;
    acum.metros += metrosDe(t);
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
//     (las órdenes: `clase` es RECABLEADO, INSTALACION o VISITA; `metros` es null en una visita de conector).
//   totales: suma de todos los técnicos.
//   porAprobar: recableados e instalaciones (con sus metros) y visitas de conector pre-finalizados
//     del período que aún no se aprueban.
export function consumoPorTecnico(ordenes, { desde = 0, hasta = Infinity, tecnicos = [] } = {}) {
  const porTecnico = new Map();
  for (const registrado of tecnicos) {
    const nombre = String(registrado || '').trim();
    if (nombre && !porTecnico.has(nombre.toUpperCase())) porTecnico.set(nombre.toUpperCase(), nuevaFila(nombre));
  }
  const totales = vacio();
  const porAprobar = { ordenes: 0, instalaciones: 0, metros: 0, visitas: 0 };
  const vistas = new Set();

  for (const t of ordenes) {
    const finalizado = esRecableadoFinalizado(t) || esInstalacionFinalizada(t) || esVisitaConectorFinalizada(t);
    if (!finalizado && !esRecableadoPorAprobar(t) && !esInstalacionPorAprobar(t) && !esVisitaConectorPorAprobar(t)) continue;
    if (t.id != null) {
      if (vistas.has(t.id)) continue;
      vistas.add(t.id);
    }
    const fecha = fechaDeUso(t);
    if (fecha < desde || fecha > hasta) continue;

    if (!finalizado) {
      if (esRecableado(t)) {
        porAprobar.ordenes += 1;
        porAprobar.metros += metrosDe(t);
      } else if (tieneMetraje(t)) {
        porAprobar.instalaciones += 1;
        porAprobar.metros += metrosDe(t);
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
      clase: claseDe(t),
      metros: gastaCable(t) ? metrosDe(t) : null,
      ...conectoresPorColor(t),
    });
  }

  const filas = [...porTecnico.values()].sort((a, b) => b.metros - a.metros || totalConectores(b) - totalConectores(a) || a.tecnico.localeCompare(b.tecnico));
  filas.forEach((f) => f.detalle.sort((a, b) => b.fecha - a.fecha));
  return { filas, totales, porAprobar };
}
