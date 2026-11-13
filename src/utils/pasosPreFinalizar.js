import { esConfigVlan, esRecableado, llevaConectores, pideNapPuertoVisita, pideSerialEquipo } from './tipoVisita.js';

// Los pasos del formulario de pre-finalizar del técnico (ver components/modals/PreFinalizarModal), solo los que aplican a esa orden:
//   orden       el resumen de la orden, el contacto, la nota de la oficina y, en una visita, el tipo de visita (siempre)
//   equipo      instalación: serial, VLAN, NAP y puerto
//   cable       instalación: metraje del drop, posteadura, puertos disponibles y conectores usados
//   datos       visita: lo propio del tipo de visita (metraje y consulta de cobro del recableado, VLAN, serial y tipo del equipo, NAP y puerto)
//   conectores  visita: los conectores (colores del recableado, cantidades de las visitas de conector)
//   cierre      potencia óptica, observación y confirmar (siempre)
// Una instalación tiene siempre los mismos 4 pasos. En una visita dependen del tipo que se elige en el primer paso: sin tipo elegido son 2 (orden y cierre) y al elegirlo aparecen los que ese tipo necesita.
export const ETIQUETA_PASO_PREFINALIZAR = { orden: 'Orden', equipo: 'Equipo', cable: 'Cable', datos: 'Datos', conectores: 'Conectores', cierre: 'Cierre' };

// ¿Esta visita tiene datos propios que cargar (aparte de los conectores)? NAP y puerto (conector externo, drop atenuado, recableado), metraje (recableado), serial y tipo de equipo (cambio de equipo, reconexión) o VLAN.
export const visitaPideDatos = (tipoVisita) => pideNapPuertoVisita(tipoVisita) || esRecableado(tipoVisita) || pideSerialEquipo(tipoVisita) || esConfigVlan(tipoVisita);

export function pasosDePreFinalizar({ instalacion = false, tipoVisita = '' } = {}) {
  if (instalacion) return ['orden', 'equipo', 'cable', 'cierre'];
  return ['orden', ...(visitaPideDatos(tipoVisita) ? ['datos'] : []), ...(llevaConectores(tipoVisita) ? ['conectores'] : []), 'cierre'];
}
