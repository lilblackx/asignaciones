// Qué se envía al inventario del otro sistema (Telecom) cuando se aprueba una orden, y cómo. Lo usan la app (para saber si
// hay algo que enviar) y el Worker que hace el envío (cf-worker/src/inventario.js): es una sola lógica, la de aquí.
//
// Cada orden aprobada genera, según su tipo, una "acción" del otro sistema:
//   - Instalación            -> instalacion_nueva: material (drop en metros, conectores APC = verde y UPC = azul) y el serial
//                               de la ONU pasa a "Instalado" en su inventario.
//   - Cambio de equipo       -> cambio_equipo: el serial del equipo nuevo pasa a "Instalado" (no gasta material).
//   - Recableado             -> averia: solo el material (drop y conectores), con el motivo "Recableado - Orden #1234".
//   - Visita de conector     -> averia: solo el material, con el motivo "Visita de conector externo - Orden #1234".
// El serial se envía como lo ve la OLT (ver utils/serialOlt): el de la caja de TP-Link (GOPN...) se convierte; lo guardado en la orden no cambia.
// Cualquier otra orden (drop atenuado, averías sin material...) no envía nada.
import { conectoresPorColor, esCambioEquipoFinalizado, esInstalacionFinalizada, esRecableadoFinalizado, esVisitaConectorFinalizada } from './consumoMateriales.js';
import { etiquetaTipoVisita } from './tipoVisita.js';
import { serialParaOlt } from './serialOlt.js';

export const ACCION_INSTALACION = 'instalacion_nueva';
export const ACCION_CAMBIO_EQUIPO = 'cambio_equipo';
export const ACCION_AVERIA = 'averia';

// Estados de un envío (colección telecomEnvios, un documento por orden):
//   ENVIADO              ya está en el inventario (no se vuelve a enviar).
//   PENDIENTE            no se pudo llegar al otro sistema (red, clave...); se reintenta solo.
// Los siguientes necesitan que alguien los mire (alerta en la app y aviso push):
//   SERIAL_NO_ENCONTRADO el serial no existe en su inventario: no se envió nada de la orden.
//   SERIAL_YA_INSTALADO  ese equipo ya figura instalado a otro cliente: no se tocó.
//   EQUIPO_NO_ASIGNADO   el equipo no figura "Con Técnico" en su inventario (p. ej. sigue "En Almacén"): solo se descuenta y
//                        pasa a "Instalado" el que ya está asignado a un técnico, así que no se tocó nada de la orden.
//   SIN_SERIAL           la orden no trae serial (órdenes anteriores a que se pidiera): no hay equipo que descontar.
//   TECNICO_NO_VINCULADO el técnico de la orden no tiene elegido su nombre en el inventario (Técnicos > "Nombre en el inventario"):
//                        sin ese nombre el material se descontaría de una cuenta que el inventario no muestra, así que no se envía.
//   TECNICO_NO_ENCONTRADO el nombre elegido ya no existe en la lista de técnicos del inventario (lo borraron o lo cambiaron).
//   TECNICO_INACTIVO     el técnico figura inactivo en el inventario (activo en Asignaciones): no se envía nada hasta confirmarlo allá.
//   EQUIPO_OTRO_TECNICO  el equipo figura asignado a otro técnico en el inventario que el de la orden: no se tocó nada.
//   ERROR                se agotaron los reintentos.
//   DESCARTADO           una alerta que se dio por resuelta sin enviar (queda guardada, no se borra).
export const ESTADO_ENVIADO = 'ENVIADO';
export const ESTADO_PENDIENTE = 'PENDIENTE';
export const ESTADO_DESCARTADO = 'DESCARTADO';
export const ESTADOS_CON_ALERTA = ['SERIAL_NO_ENCONTRADO', 'SERIAL_YA_INSTALADO', 'EQUIPO_NO_ASIGNADO', 'SIN_SERIAL', 'TECNICO_NO_VINCULADO', 'TECNICO_NO_ENCONTRADO', 'TECNICO_INACTIVO', 'EQUIPO_OTRO_TECNICO', 'ERROR'];

export const TEXTO_ESTADO_ENVIO = {
  SERIAL_NO_ENCONTRADO: 'El serial no existe en el inventario del almacén: no se envió nada de esta orden.',
  SERIAL_YA_INSTALADO: 'Ese equipo ya figura instalado a otro cliente en el inventario: no se modificó.',
  EQUIPO_NO_ASIGNADO: 'El equipo no figura "Con Técnico" en el inventario: no se envió nada de esta orden.',
  SIN_SERIAL: 'La orden no tiene serial del equipo: no hay equipo que descontar.',
  TECNICO_NO_VINCULADO: 'El técnico de la orden no tiene elegido su nombre en el inventario: no se envió nada. Elígelo en Técnicos y reintenta.',
  TECNICO_NO_ENCONTRADO: 'El nombre elegido para el técnico no existe en la lista de técnicos del inventario: no se envió nada.',
  TECNICO_INACTIVO: 'El técnico figura inactivo en el inventario: no se envió nada. Confirma con el almacén que esté activo y reintenta.',
  EQUIPO_OTRO_TECNICO: 'El equipo figura con otro técnico en el inventario: no se envió nada de esta orden.',
  ERROR: 'No se pudo enviar después de varios intentos.',
};

const soloLetrasYNumeros = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

// Lo que hay que enviar de una orden aprobada, o null si no corresponde enviar nada.
//   { accion, codigo, tecnico, cliente, serial, apc, upc, dropMetros, motivo, finalizadoEn }
export function payloadEnvioInventario(t) {
  if (!t) return null;
  const base = {
    codigo: soloLetrasYNumeros(t.codigo),
    tecnico: soloLetrasYNumeros(t.tecnico),
    cliente: soloLetrasYNumeros(t.nombre),
    finalizadoEn: Number(t.finalizadoEn) || Number(t.createdAt) || 0,
  };
  const orden = `Orden #${base.codigo || 'S/C'}`;
  const { verde, azul } = conectoresPorColor(t);
  const material = { apc: verde, upc: azul };

  if (esCambioEquipoFinalizado(t)) {
    return { ...base, accion: ACCION_CAMBIO_EQUIPO, serial: serialParaOlt(soloLetrasYNumeros(t.serialEquipo)), apc: 0, upc: 0, dropMetros: 0, motivo: '' };
  }
  if (esInstalacionFinalizada(t)) {
    return { ...base, accion: ACCION_INSTALACION, serial: serialParaOlt(soloLetrasYNumeros(t.instalacion?.serial)), ...material, dropMetros: Number(t.instalacion?.metraje) || 0, motivo: '' };
  }
  if (esRecableadoFinalizado(t)) {
    return { ...base, accion: ACCION_AVERIA, serial: '', ...material, dropMetros: Number(t.metrosCable) || 0, motivo: `Recableado - ${orden}` };
  }
  if (esVisitaConectorFinalizada(t)) {
    return { ...base, accion: ACCION_AVERIA, serial: '', ...material, dropMetros: 0, motivo: `Visita de ${etiquetaTipoVisita(t.tipoVisita).toLowerCase()} - ${orden}` };
  }
  return null;
}
