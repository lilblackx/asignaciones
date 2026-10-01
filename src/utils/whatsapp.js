import { TIPOS_POR_TRABAJO } from '../constants';
import { extraerUbicacionDeTexto, getUbicacionUrl, normalizarCoordenadasNap } from './ubicacion';
import { CODIGO_NAP, extraerCodigoNap } from './codigoNap';

// La línea "Observaciones:" de la plantilla siempre lleva el aviso de cobro
// (monto en Bs calculado según la tasa BCV del día). El campo "observacion" del
// formulario se agrega después de ese aviso solo si "observacionInterna" es
// explícitamente false. Tickets viejos (sin este campo, de antes de que existiera
// el check) se tratan como interna por defecto, para no exponer retroactivamente
// observaciones que nunca se pensaron para salir en WhatsApp.
export function generarMensajeWhatsApp(ticket, tasaConfig) {
  const montoBs = calcularMontoBs(tasaConfig);
  const avisoCobro = `Cliente debe cancelar ${montoBs || ''}Bs. Si la falla es interna.`;
  const observacionVisible = ticket.observacionInterna === false && ticket.observacion ? ticket.observacion.trim() : '';
  const observaciones = observacionVisible ? `${avisoCobro} ${observacionVisible}` : avisoCobro;
  const enlaceNap = normalizarCoordenadasNap(ticket.napCoordenadas).enlace;
  const enlace = getUbicacionUrl(ticket.ubicacion);

  return [
    ticket.codigo || '',
    `Tipo de avería: ${ticket.falla || ''}`,
    `Cliente: ${ticket.nombre || ''} C.I ${ticket.cedula || ''}`,
    `Dirección: ${ticket.direccion || ''}`,
    `Numero de Teléfono: ${ticket.telefono || ''}`,
    `NAP: ${ticket.nap || ''}`,
    `Puertos Disponibles en el NAP: ${ticket.puertosDisponibles || ''}`,
    `Materiales Utilizados: ${ticket.materiales || ''}`,
    `Operador: ${ticket.creado || ''}`,
    `Observaciones: ${observaciones}`,
    ...(enlace || enlaceNap ? [''] : []),
    ...(enlace ? [`*Ubicación:* ${enlace}`] : []),
    ...(enlaceNap ? [`*Ubicación NAP:* ${enlaceNap}`] : []),
  ].join('\n');
}

function calcularMontoBs(tasaConfig) {
  if (!tasaConfig || !tasaConfig.montoBaseEUR || !tasaConfig.tasa) return null;
  const monto = tasaConfig.montoBaseEUR * tasaConfig.tasa;
  // Formato venezolano: punto de miles, coma decimal (ej. 5.772)
  return monto.toLocaleString('es-VE', { maximumFractionDigits: 0 });
}

// Alias de las etiquetas tal como las escriben las promotoras (con errores de
// formato incluidos) hacia los campos que ya registramos en Asignaciones. Las
// claves ya vienen normalizadas (ver claveEtiqueta): mayúsculas, sin tildes,
// sin puntuación ni emojis ("C.I" -> "CI", "N° de teléfono" -> "N DE TELEFONO").
const ALIAS_CAMPOS = {
  'NOMBRES COMPLETOS': 'nombre',
  'NOMBRE COMPLETO': 'nombre',
  'NOMBRES Y APELLIDOS': 'nombre',
  'NOMBRE Y APELLIDO': 'nombre',
  'NOMBRE Y APELLIDOS': 'nombre',
  'NOMBRES': 'nombre',
  'NOMBRE': 'nombre',
  'CLIENTE': 'nombre',
  'CI': 'cedula',
  'CEDULA': 'cedula',
  'CEDULA DE IDENTIDAD': 'cedula',
  'CI RIF': 'cedula',
  'RIF': 'cedula',
  'NRO DE TELEFONO': 'telefono',
  'NUMERO DE TELEFONO': 'telefono',
  'N DE TELEFONO': 'telefono',
  'NO DE TELEFONO': 'telefono',
  'NRO TELEFONO': 'telefono',
  'NUMERO TELEFONICO': 'telefono',
  'TELEFONO': 'telefono',
  'CELULAR': 'telefono',
  'DIRECCION COMPLETA': 'direccion',
  'DIRECCION': 'direccion',
  'NAP': 'nap',
  'SERVICIO A CONTRATAR': 'falla',
  'SERVICIO': 'falla',
  'UBICACION': 'ubicacion',
  'UBICACION GPS': 'ubicacion',
  'UBICACION MAPS': 'ubicacion',
  'UBICACION GOOGLE MAPS': 'ubicacion',
  'LINK DE UBICACION': 'ubicacion',
  'LINK UBICACION': 'ubicacion',
  'GOOGLE MAPS': 'ubicacion',
  'MAPS': 'ubicacion',
};

// Texto de etiqueta -> clave comparable. WhatsApp mete asteriscos/guiones bajos
// (negrita/cursiva), y las promotoras escriben "N°", "C.I", "Nro." o con emojis.
function claveEtiqueta(texto) {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Quita el formato de WhatsApp (*negrita*, _cursiva_, ~tachado~, ```mono```) y
// caracteres invisibles (espacio duro, ancho cero) que rompen las comparaciones.
function limpiarLinea(linea) {
  return linea
    .replace(new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g'), '')
    .replace(new RegExp('\\u00A0', 'g'), ' ')
    .replace(/[*~]|```/g, '')
    .replace(/(^|\s)_+|_+(?=\s|$)/g, '$1')
    .replace(/[：﹕]/g, ':')
    .trim();
}

// Una línea es "etiqueta" (no un valor) si es "Algo:" con prefijo corto y sin
// dígitos, o si venía entera en negrita sin dos puntos ("*Condición*").
function esLineaEtiqueta(original, limpia) {
  const idx = limpia.indexOf(':');
  if (idx !== -1 && idx <= 40 && !/\d/.test(limpia.slice(0, idx))) return true;
  return idx === -1 && /^\s*\*[^*]+\*\s*$/.test(original);
}

// Mismo formato que el campo CÉDULA / RIF del formulario: solo dígitos con punto
// de miles (ej. "11.297.749"), sin importar cómo lo escribió la promotora.
function formatearDigitos(texto) {
  return texto.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function interpretarCedula(valor, campos) {
  const match = valor.match(/^([VEJGvejg])[.\s-]*([\d.]+)/);
  if (match) {
    campos.tipoDocumento = match[1].toUpperCase();
    campos.cedula = formatearDigitos(match[2]);
  } else {
    const cedula = formatearDigitos(valor);
    if (cedula) campos.cedula = cedula;
  }
}

export { extraerCodigoNap };

// Rellena los campos que ya manejamos a partir de la plantilla cruda que pega
// la promotora. Es "best effort": si una etiqueta no calza con el formato
// esperado, simplemente no se autocompleta ese campo (queda para llenar a mano).
// Tolera el formato de WhatsApp (asteriscos, etc.) y valores que la promotora
// puso en la línea de abajo en vez de junto a la etiqueta.
export function parseInstalacionTemplate(texto) {
  const campos = {};
  const originales = (texto || '').split(/\r?\n|\r/);
  const lineas = originales.map(limpiarLinea);

  for (let i = 0; i < lineas.length; i++) {
    const limpia = lineas[i];
    const idx = limpia.indexOf(':');
    if (idx === -1) continue;
    const campo = ALIAS_CAMPOS[claveEtiqueta(limpia.slice(0, idx))];
    if (!campo || campos[campo] !== undefined) continue;

    let valor = limpia.slice(idx + 1).trim();
    if (!valor) {
      // Valor en la línea siguiente: se toma la próxima línea no vacía, salvo
      // que ya sea otra etiqueta (campo que la promotora dejó en blanco).
      let j = i + 1;
      while (j < lineas.length && !lineas[j]) j++;
      if (j < lineas.length && !esLineaEtiqueta(originales[j], lineas[j])) valor = lineas[j];
    }
    if (!valor) continue;

    if (campo === 'cedula') {
      interpretarCedula(valor, campos);
    } else if (campo === 'falla') {
      // Solo se autocompleta si calza con una de las opciones válidas para
      // INSTALACIÓN (MRTV/MTV/MR/SM); si no, se deja para elegir a mano.
      const opciones = TIPOS_POR_TRABAJO['INSTALACIÓN'] || [];
      const primerToken = valor.split(/[^A-Za-z0-9]+/).find(Boolean) || '';
      const encontrado = opciones.find(o => o.toUpperCase() === primerToken.toUpperCase());
      if (encontrado) campos.falla = encontrado;
    } else if (campo === 'ubicacion') {
      const url = extraerUbicacionDeTexto(valor);
      if (url) campos.ubicacion = url;
    } else {
      campos[campo] = valor;
    }
  }
  // A veces la línea "Nap:" va vacía y el código aparece en otra parte, por
  // ejemplo en la nota: "se puede hacer del NAP O10H37 a 240m".
  if (campos.nap === undefined) {
    const enTexto = String(texto || '').match(new RegExp(`\\bNAP\\W{0,4}(${CODIGO_NAP})`, 'i'));
    if (enTexto) campos.nap = enTexto[1].toUpperCase();
  }
  // Muchas promotoras pegan el enlace de Maps suelto, sin etiqueta.
  if (campos.ubicacion === undefined) {
    const url = extraerUbicacionDeTexto(texto);
    if (url) campos.ubicacion = url;
  }
  return campos;
}

// Toca 2 líneas de la plantilla cruda: el correlativo (primera línea) y el
// técnico instalador. Si la orden ya tiene ubicación, agrega el enlace de Maps
// al final (o lo completa en una etiqueta "Ubicación:" vacía); si la plantilla
// ya trae un enlace de Maps propio no se duplica. El resto queda exactamente
// como lo pegó la promotora.
function aplicarCorrelativoYTecnico(plantilla, codigo, tecnico, ubicacion, napCoordenadas) {
  const lineas = plantilla.split('\n');
  if (lineas.length > 0) lineas[0] = codigo || lineas[0];
  const idxInstalador = lineas.findIndex(l => claveEtiqueta(limpiarLinea(l).split(':')[0] || '') === 'INSTALADOR');
  if (idxInstalador !== -1) {
    lineas[idxInstalador] = `*Instalador:*${tecnico || ''}`;
  }
  const enlace = getUbicacionUrl(ubicacion);
  let agregoAlFinal = false;
  if (enlace && !extraerUbicacionDeTexto(plantilla)) {
    const idxUbicacion = lineas.findIndex(l => {
      const limpia = limpiarLinea(l);
      const idx = limpia.indexOf(':');
      return idx !== -1 && ALIAS_CAMPOS[claveEtiqueta(limpia.slice(0, idx))] === 'ubicacion' && !limpia.slice(idx + 1).trim();
    });
    if (idxUbicacion !== -1) {
      lineas[idxUbicacion] = `*Ubicación:* ${enlace}`;
    } else {
      while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
      lineas.push('', `*Ubicación:* ${enlace}`);
      agregoAlFinal = true;
    }
  }
  const enlaceNap = normalizarCoordenadasNap(napCoordenadas).enlace;
  if (enlaceNap && !plantilla.includes(enlaceNap)) {
    if (!agregoAlFinal) {
      while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
      lineas.push('');
    }
    lineas.push(`*Ubicación NAP:* ${enlaceNap}`);
  }
  return lineas.join('\n');
}

// Fallback para instalaciones creadas sin pegar la plantilla de la promotora
// (ej. carga manual): arma un mensaje con el mismo estilo, solo con los campos
// que registramos.
function generarMensajeInstalacionBasico(ticket) {
  const enlace = getUbicacionUrl(ticket.ubicacion);
  const enlaceNap = normalizarCoordenadasNap(ticket.napCoordenadas).enlace;
  return [
    ticket.codigo || '',
    `*Nap:* ${ticket.nap || ''}`,
    '',
    `*Nombres  Completos:*${ticket.nombre || ''}`,
    `*C.I:* ${ticket.cedula || ''}`,
    `*NRO de teléfono:* ${ticket.telefono || ''}`,
    `*Dirección completa:*${ticket.direccion || ''}`,
    `*Instalador:*${ticket.tecnico || ''}`,
    `*Observación:*${ticket.observacion || ''}`,
    ...(enlace || enlaceNap ? [''] : []),
    ...(enlace ? [`*Ubicación:* ${enlace}`] : []),
    ...(enlaceNap ? [`*Ubicación NAP:* ${enlaceNap}`] : []),
  ].join('\n');
}

// Tipos de trabajo cuya orden nace de una plantilla que manda la promotora
// (se pega al crear y el mensaje sale de esa misma plantilla).
export const tipoUsaPlantillaPromotora = (tipoTrabajo) => {
  const t = String(tipoTrabajo || '').toUpperCase();
  return t.includes('INSTAL') || t.includes('RECONEX');
};

// Igual que generarMensajeWhatsAppInstalacion pero para cualquier orden que
// traiga plantillaOriginal (instalaciones y reconexiones).
export function generarMensajeDesdePlantilla(ticket) {
  return aplicarCorrelativoYTecnico(ticket.plantillaOriginal, ticket.codigo, ticket.tecnico, ticket.ubicacion, ticket.napCoordenadas);
}

export function generarMensajeWhatsAppInstalacion(ticket) {
  if (ticket.plantillaOriginal && ticket.plantillaOriginal.trim()) {
    return aplicarCorrelativoYTecnico(ticket.plantillaOriginal, ticket.codigo, ticket.tecnico, ticket.ubicacion, ticket.napCoordenadas);
  }
  return generarMensajeInstalacionBasico(ticket);
}
