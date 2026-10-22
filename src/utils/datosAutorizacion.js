// Lo que se necesita para autorizar una instalación en SmartOLT, listo para mostrar y copiar dato por dato
// o todo junto (ver components/modals/DatosParaAutorizar). Dos grupos:
//   - equipo: serial, VLAN, NAP, puerto, drop (el metraje), posteadura y puertos disponibles (lo que
//     el técnico llenó al instalar o al cambiar el equipo).
//   - cliente: nombre, cédula, teléfonos, dirección, ubicación, servicio y plan.
//   El plan sale de la plantilla de la promotora (ver parseDatosClienteTemplate).
// Cada dato es { clave, etiqueta, valor, copia?, tipo? }: `valor` es lo que se ve, `copia` lo que se copia si
// es distinto (el drop se ve "120 m" y se copia "120"), `tipo` el aspecto especial ('cedula', 'ubicacion').
import { formatCedula } from './cedula.js';
import { esInstalacion, metrajeInstalacion } from './instalacion.js';
import { parseTelefonos } from './telefono.js';
import { esCambioEquipo } from './tipoVisita.js';
import { getUbicacionUrl } from './ubicacion.js';
import { parseDatosClienteTemplate } from './whatsapp.js';

const limpio = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function datosAutorizacion(ticket) {
  const t = ticket || {};
  const inst = t.instalacion || {};
  const equipo = [];
  const cliente = [];
  const agregar = (lista, clave, etiqueta, valor, extra = {}) => {
    const texto = limpio(valor);
    if (texto) lista.push({ clave, etiqueta, valor: texto, ...extra });
  };

  if (esCambioEquipo(t.tipoVisita)) agregar(equipo, 'tipoEquipoNuevo', 'Tipo de equipo nuevo', t.tipoEquipoNuevo);
  if (esCambioEquipo(t.tipoVisita)) agregar(equipo, 'serialEquipo', 'Serial del equipo nuevo', t.serialEquipo);
  agregar(equipo, 'serial', 'Serial', inst.serial);
  agregar(equipo, 'vlan', 'VLAN', inst.vlan);
  if (limpio(inst.nap)) {
    agregar(equipo, 'nap', 'NAP', inst.nap);
    agregar(equipo, 'puerto', 'Puerto del cliente', inst.puerto);
  } else {
    // Visitas con NAP y puerto en un solo texto ("O02B12 - Puerto 3").
    agregar(equipo, 'nap', 'NAP / puerto', t.nap);
  }
  const metros = metrajeInstalacion(t);
  if (metros != null) agregar(equipo, 'drop', 'Drop', `${metros} m`, { copia: String(metros) });
  agregar(equipo, 'posteadura', 'Posteadura', (inst.posteadura || []).join(', '));
  agregar(equipo, 'puertosDisponibles', 'Puertos disponibles', inst.puertosDisponibles);

  const extra = parseDatosClienteTemplate(t.plantillaOriginal);
  agregar(cliente, 'nombre', 'Nombre', t.nombre);
  agregar(cliente, 'cedula', 'Cédula', formatCedula(t.cedula, t.tipoDocumento), { tipo: 'cedula' });
  const telefonos = parseTelefonos(t.telefono);
  telefonos.forEach((tel, i) => agregar(cliente, `telefono${i}`, telefonos.length > 1 ? `Teléfono ${i + 1}` : 'Teléfono', tel));
  agregar(cliente, 'direccion', 'Dirección', t.direccion);
  const ubicacion = getUbicacionUrl(t.ubicacion);
  if (ubicacion) agregar(cliente, 'ubicacion', 'Ubicación', ubicacion, { tipo: 'ubicacion' });
  // En una instalación `falla` guarda el servicio contratado (MR, SM...); en lo demás, la falla. Sin falla, la orden
  // guarda el tipo de trabajo como falla: no se repite.
  if (t.falla && t.falla !== t.tipoTrabajo) agregar(cliente, 'servicio', esInstalacion(t.tipoTrabajo) ? 'Servicio' : 'Falla', t.falla);
  agregar(cliente, 'plan', 'Plan', extra.plan);

  const linea = (d) => `${d.etiqueta}: ${d.valor}`;
  const texto = [
    `Orden ${t.codigo || 'S/C'}`,
    ...cliente.map(linea),
    ...(equipo.length > 0 ? ['', ...equipo.map(linea)] : []),
  ].join('\n');

  return { equipo, cliente, texto };
}

// Lo que se copia de un dato: su `copia` o, si no la tiene, lo que se ve.
export const textoACopiar = (dato) => dato.copia ?? dato.valor;
