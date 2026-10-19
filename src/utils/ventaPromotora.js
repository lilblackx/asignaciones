import { esCodigoSinNumero, generarCodigoBase } from './correlativo.js';
import { claveNombre, nombrePromotora } from './promotora.js';
import { direccionCliente, nombrePersona } from './datosCliente.js';
import { normalizarUbicacion } from './ubicacion.js';
import { tieneTelefono } from './telefono.js';
import { parseInstalacionTemplate } from './whatsapp.js';
import { buscarTecnicoPorNombre } from './tecnicoVenta.js';
import { esInstalacion } from './instalacion.js';

// Venta = instalación nueva que una promotora con permiso de crear ventas (puedeCrearVentas) carga ella misma. Es siempre
// una INSTALACIÓN pendiente y sin técnico: la oficina la ve en su lista y le asigna el técnico, como cualquier otra.
export const TIPO_VENTA = 'INSTALACIÓN';

// Los campos de la plantilla que el formulario de la venta aplica (el resto de lo que lee el parser no lo pide).
const CAMPOS_PLANTILLA = ['cedula', 'tipoDocumento', 'nombre', 'direccion', 'telefono', 'falla', 'ubicacion', 'nap', 'promotora'];

export function camposDePlantillaVenta(texto) {
  const campos = parseInstalacionTemplate(texto);
  return Object.fromEntries(CAMPOS_PLANTILLA.filter((c) => campos[c] !== undefined).map((c) => [c, campos[c]]));
}

// El técnico de una venta solo sale de la línea "Instalador:" de la plantilla: la promotora no lo elige. Es el técnico registrado
// que corresponde a ese nombre (uno solo; ante la duda no se asigna y la oficina lo asigna con el turno), igual que al crear la
// orden en la oficina. Devuelve su nombre, o '' si no hay.
// Sin distinguir mayúsculas, tildes ni espacios de más ("GERARDO molero" = "Gerardo Molero").
export const tecnicoRegistradoDePlantilla = (texto, technicians) => buscarTecnicoPorNombre(parseInstalacionTemplate(texto).instalador, technicians);
export const tecnicoDePlantilla = (texto, technicians) => tecnicoRegistradoDePlantilla(texto, technicians)?.name || '';

// La plantilla nombra un instalador pero no se pudo emparejar con un técnico registrado (no se leyeron los técnicos, o el nombre
// no coincide con uno solo). La venta se puede guardar igual: queda sin técnico y la oficina lo asigna.
export const instaladorDePlantilla = (texto) => parseInstalacionTemplate(texto).instalador || '';

// Lo que dice el aviso a la oficina cuando una promotora carga una venta (el push y el aviso dentro de la app): solo eso.
export const TEXTO_AVISO_NUEVA_VENTA = 'Nueva venta';

// Venta que llegó con técnico (el de la plantilla) pero todavía sin número ("IS"): la oficina la numera y le avisa al técnico.
// La promotora no puede numerar: los contadores son de la oficina.
export const esVentaPorNumerar = (t) => esInstalacion(t?.tipoTrabajo) && t.estado === 'PENDIENTE' && Boolean(String(t.tecnico || '').trim()) && esCodigoSinNumero(t.codigo);

// Mensaje del primer problema de la venta (o ''). Se comprueba antes de guardar; las reglas de Firestore vuelven a exigir lo esencial.
// `perfil`: { verTodas, promotoraClaves } de quien la crea. Sin "ve todas", el promotor tiene que ser uno de sus nombres:
// si no, la venta quedaría guardada y ella no la vería.
export function errorVentaPromotora(datos, { verTodas, promotoraClaves }) {
  if (!tieneTelefono(datos.telefono)) return 'Escribe el teléfono del cliente.';
  if (!String(datos.nombre || '').trim()) return 'Escribe el nombre del cliente.';
  if (!String(datos.cedula || '').trim()) return 'Escribe la cédula o RIF del cliente.';
  if (!String(datos.direccion || '').trim()) return 'Escribe la dirección del cliente.';
  if (!String(datos.falla || '').trim()) return 'Selecciona el tipo de instalación.';
  const clave = claveNombre(datos.promotora);
  if (!clave) return 'Escribe el nombre del promotor.';
  if (!verTodas && !promotoraClaves.includes(clave)) return 'El promotor tiene que ser uno de los nombres de tu usuario.';
  const ubicacion = normalizarUbicacion(datos.ubicacion);
  if (ubicacion.error) return `Ubicación: ${ubicacion.error}`;
  return '';
}

// La orden que se guarda: los mismos campos que arma la oficina al crear una instalación sin técnico ("IS", sin número).
// Las reglas de Firestore aceptan exactamente estos campos (ver `creaVentaPromotora`).
export function armarVentaPromotora(datos, { username, nombre }, ahora = new Date()) {
  return {
    fecha: ahora.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    fechaProgramada: '',
    codigo: generarCodigoBase(TIPO_VENTA, ahora),
    nombre: nombrePersona(datos.nombre),
    cedula: datos.cedula,
    tipoDocumento: datos.tipoDocumento || 'V',
    direccion: direccionCliente(datos.direccion),
    telefono: datos.telefono,
    nap: (datos.nap || '').trim(),
    napCoordenadas: '',
    ubicacion: normalizarUbicacion(datos.ubicacion).valor || '',
    tipoTrabajo: TIPO_VENTA,
    falla: datos.falla,
    tecnico: datos.tecnico || '',
    // `ventaTecnicoId`: el documento del técnico registrado; las reglas comprueban con él que existe y que el nombre es el suyo.
    ...(datos.tecnico ? { ventaTecnico: datos.tecnico, ventaTecnicoId: datos.tecnicoId } : {}),
    observacion: '',
    observacionInterna: false,
    estado: 'PENDIENTE',
    plantillaOriginal: datos.plantillaOriginal || '',
    promotora: nombrePromotora(datos.promotora),
    promotoraClave: claveNombre(datos.promotora),
    creado: username,
    creadoNombre: nombre || username,
    createdAt: ahora.getTime(),
    historialEdiciones: [],
    isAsignado: false,
    // La cargó una promotora con permiso de crear ventas: la oficina se entera de que llegó (aviso de nueva venta).
    ventaPromotora: true,
  };
}
