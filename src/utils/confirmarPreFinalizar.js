import { textoConectoresInstalacion } from './conectoresInstalacion.js';
import { textoMetrajeConMarcas } from './metraje.js';
import { esCambioEquipo, esConfigVlan, esReconexion, esRecableado, esVisitaConector, pideNapPuertoVisita, textoConectorVisita } from './tipoVisita.js';

// Lo que el técnico va a enviar al pre-finalizar, para que lo revise en la confirmación antes de mandarlo (una vez enviado solo la oficina puede devolverle la orden). Recibe lo que arma el formulario
// (`extra` de PreFinalizarModal) y devuelve las filas { etiqueta, valor, destacado }: el serial va destacado, porque es lo que más se equivoca al escribirlo o al escanearlo.
// Solo salen los datos que esa orden lleva: una instalación trae su serial, VLAN, NAP, metraje...; un cambio de equipo, el equipo nuevo; una visita de conector, sus conectores.
export function datosParaConfirmar(extra) {
  if (!extra) return [];
  const filas = [];
  const agregar = (etiqueta, valor, destacado = false) => { if (valor !== '' && valor !== null && valor !== undefined) filas.push({ etiqueta, valor: String(valor), destacado }); };
  const inst = extra.instalacion;

  if (inst) {
    agregar('Serial', inst.serial, true);
    agregar('VLAN', inst.vlan);
    agregar('NAP y puerto', extra.nap);
    agregar('Metraje del drop', inst.metrajeExistente ? 'Metraje existente (no se descuenta cable)' : inst.metraje != null ? textoMetrajeConMarcas(inst.metraje, inst) : '');
    agregar('Posteadura', Array.isArray(inst.posteadura) ? inst.posteadura.join(', ') : '');
    agregar('Puertos disponibles en la NAP', inst.puertosDisponibles);
    agregar('Conectores usados', textoConectoresInstalacion(inst.conectores));
  } else {
    if (esCambioEquipo(extra.tipoVisita)) {
      agregar('Tipo de equipo nuevo', extra.tipoEquipoNuevo);
      agregar('Serial del equipo nuevo', extra.serialEquipo, true);
    }
    if (esReconexion(extra.tipoVisita) && !esCambioEquipo(extra.tipoVisita)) agregar('Serial del equipo', extra.serialEquipo, true);
    if (esConfigVlan(extra.tipoVisita)) agregar('VLAN configurada', extra.vlanVisita, true);
    if (pideNapPuertoVisita(extra.tipoVisita)) agregar('NAP y puerto', extra.nap);
    if (esRecableado(extra.tipoVisita)) agregar('Metros de cable', extra.metrosCable != null ? textoMetrajeConMarcas(extra.metrosCable, extra) : '');
    if (esVisitaConector(extra.tipoVisita)) agregar('Conectores usados', textoConectorVisita(extra).replace(/^Conectores?:?\s*/i, ''));
  }
  if (extra.potenciaDbm !== null && extra.potenciaDbm !== undefined) agregar('Potencia óptica', `${extra.potenciaDbm} dBm`);
  agregar('Observación', extra.observacionTecnico);
  return filas;
}
