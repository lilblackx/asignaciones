import { TIPOS_POR_TRABAJO } from '../constants.js';
import { extraerUbicacionDeTexto, getUbicacionUrl, normalizarCoordenadasNap } from './ubicacion.js';
import { normalizarNegritas } from './negritas.js';
import { CODIGO_NAP, extraerCodigoNap } from './codigoNap.js';
import { MAX_TELEFONOS, telefonoInternacional, unirTelefonos } from './telefono.js';

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
  'INSTALADOR': 'instalador',
  'TECNICO INSTALADOR': 'instalador',
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
// dígitos, si venía entera en negrita sin dos puntos ("*Condición*"), o si es una
// etiqueta conocida en negrita sin dos puntos pero con su valor ("*C.I* 34.250.195").
function esLineaEtiqueta(original, limpia) {
  const idx = limpia.indexOf(':');
  if (idx !== -1) return idx <= 40 && !/\d/.test(limpia.slice(0, idx));
  if (/^\s*\*[^*]+\*\s*$/.test(original)) return true;
  const enNegrita = original.match(/^\s*\*([^*]+)\*\s+\S/);
  return Boolean(enNegrita) && Boolean(ALIAS_CAMPOS[claveEtiqueta(limpiarLinea(enNegrita[1]))]);
}

// Mismo formato que el campo CÉDULA / RIF del formulario: solo dígitos con punto
// de miles (ej. "11.297.749"), sin importar cómo lo escribió la promotora.
function formatearDigitos(texto) {
  return texto.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Cédula/RIF venezolano: letra opcional (V/E/J/G) y de 6 a 9 dígitos, seguidos o
// con separador de miles (punto, coma o espacio; el mismo en todo el número).
// Ante cualquier duda devuelve null y el campo queda vacío para llenarlo a mano:
// una cédula inventada se guardaría sin que nadie lo note, y además alimenta la
// detección de órdenes duplicadas y reincidencias. Se descartan: otros números en
// el valor (un teléfono pegado al lado), ceros a la izquierda (teléfonos), grupos
// de miles incompletos ("34 250 19"), separadores mezclados y letras raras.
function extraerCedula(valor) {
  let resto = valor.trim();
  let tipoDocumento;
  const prefijo = resto.match(/^([VEJGvejg])[\s.-]*(?=\d)/);
  if (prefijo) {
    tipoDocumento = prefijo[1].toUpperCase();
    resto = resto.slice(prefijo[0].length);
  }
  const numero = resto.match(/^\d+(?:([.,\s])\d+(?:\1\d+)*)?/);
  if (!numero) return null;

  const grupos = numero[1] ? numero[0].split(numero[1]) : [numero[0]];
  if (grupos.length > 1 && (grupos[0].length > 3 || grupos.slice(1).some(g => g.length !== 3))) return null;
  const digitos = grupos.join('');
  if (!/^[1-9]\d{5,8}$/.test(digitos)) return null;

  // Lo que sigue (una nota como "(titular)", el dígito verificador del RIF) no
  // puede traer más números.
  const cola = resto.slice(numero[0].length).replace(/^\s*-\s*\d(?!\d)/, '');
  if (/\d/.test(cola)) return null;

  return { tipoDocumento, cedula: formatearDigitos(digitos) };
}

function interpretarCedula(valor, campos) {
  const cedula = extraerCedula(valor);
  if (!cedula) return;
  if (cedula.tipoDocumento) campos.tipoDocumento = cedula.tipoDocumento;
  campos.cedula = cedula.cedula;
}

// Mismos límites que los campos del formulario (maxLength de nombre y dirección).
const MAX_NOMBRE = 100;
const MAX_DIRECCION = 200;

// Lo que ponen las promotoras cuando no tienen el dato. No es un nombre ni una
// dirección, y como pasaría el "obligatorio" del formulario nadie lo notaría.
const SIN_DATO = new Set(['NA', 'N A', 'NO APLICA', 'NINGUNO', 'NINGUNA', 'PENDIENTE', 'POR ASIGNAR', 'POR DEFINIR', 'SIN DATOS', 'NO TIENE', 'XX', 'XXX']);

// Texto libre (nombre, dirección): no hay un formato fijo que validar, así que se
// descarta lo que claramente no es el dato: vacío, más largo que el campo, sin
// letras, un "no aplica", el nombre de otra etiqueta, un correo o enlace, o con
// un número largo pegado (una cédula o un teléfono que se coló en la línea).
function extraerTextoLibre(valor, maximo) {
  const texto = valor.replace(/\s+/g, ' ').trim();
  if (!texto || texto.length > maximo) return null;
  if ((texto.match(/\p{L}/gu) || []).length < 2) return null;
  const clave = claveEtiqueta(texto);
  if (SIN_DATO.has(clave) || ALIAS_CAMPOS[clave]) return null;
  if (/@|https?:|www\./i.test(texto)) return null;
  if (/\d{7,}/.test(texto.replace(/(?<=\d)[\s.-](?=\d)/g, ''))) return null;
  return texto;
}

// Teléfonos de la plantilla: uno o varios (separados por "/", coma, punto y coma o
// una palabra como "y"), con el mismo criterio que valida el formulario
// (utils/telefono) y, además, un número venezolano debe empezar por 02 o 04. O se
// leen todos o queda vacío: un número a medias o inventado se llamaría sin que
// nadie lo note. Los repetidos se juntan y el máximo es el del formulario.
function extraerTelefonos(valor) {
  const segmentos = valor
    .split(/[/,;|]|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/)
    .map(s => s.replace(/^[^\d+(]+/, '').replace(/[^\d)]+$/, ''))
    .filter(s => /\d/.test(s));
  if (segmentos.length === 0) return null;

  const vistos = new Set();
  const lista = [];
  for (const crudo of segmentos) {
    const segmento = crudo.replace(/\s+/g, ' ');
    // 20 es el maxLength del campo de teléfono del formulario.
    if (!/^\+?[\d\s().-]+$/.test(segmento) || segmento.length > 20) return null;
    if ((segmento.match(/\(/g) || []).length !== (segmento.match(/\)/g) || []).length) return null;
    const numero = telefonoInternacional(segmento);
    if (!numero || (numero.startsWith('58') && !/^58[24]/.test(numero))) return null;
    if (!vistos.has(numero)) {
      vistos.add(numero);
      lista.push(segmento);
    }
  }
  return lista.length <= MAX_TELEFONOS ? unirTelefonos(lista) : null;
}

// Códigos de NAP distintos que aparecen en un texto (en mayúsculas).
const CODIGO_NAP_EN_TEXTO = new RegExp(`(?<![A-Z0-9])${CODIGO_NAP}(?![A-Z0-9])`, 'gi');
function codigosNap(texto) {
  const encontrados = String(texto || '').match(CODIGO_NAP_EN_TEXTO) || [];
  return [...new Set(encontrados.map(c => c.toUpperCase()))];
}

export { extraerCodigoNap };

// Etiquetas donde las promotoras escriben notas libres (a veces con el NAP).
const ETIQUETAS_NOTA = new Set(['NOTA', 'NOTAS', 'OBSERVACION', 'OBSERVACIONES']);

// Rellena los campos que ya manejamos a partir de la plantilla cruda que pega
// la promotora. Es "best effort": si una etiqueta no calza con el formato
// esperado, simplemente no se autocompleta ese campo (queda para llenar a mano).
// Tolera el formato de WhatsApp (asteriscos, etc.) y valores que la promotora
// puso en la línea de abajo en vez de junto a la etiqueta.
export function parseInstalacionTemplate(texto) {
  const campos = {};
  let napAmbiguo = false;
  const originales = (texto || '').split(/\r?\n|\r/);
  const lineas = originales.map(limpiarLinea);

  for (let i = 0; i < lineas.length; i++) {
    const limpia = lineas[i];
    const idx = limpia.indexOf(':');
    let etiqueta;
    let valor;
    if (idx !== -1) {
      etiqueta = limpia.slice(0, idx);
      valor = limpia.slice(idx + 1).trim();
    } else {
      // Etiqueta en negrita sin dos puntos, con el valor en la misma línea:
      // "*C.I* 34.250.195". Solo se acepta para la cédula (que además se valida
      // de forma estricta): así una frase que empiece con una palabra en negrita
      // ("*Cliente* conecta en el puerto 3") no se toma por un campo ni bloquea
      // la etiqueta real. Ante la duda se deja vacío.
      const enNegrita = originales[i].match(/^\s*\*([^*]+)\*\s+(\S.*)$/);
      if (!enNegrita) continue;
      etiqueta = limpiarLinea(enNegrita[1]);
      valor = limpiarLinea(enNegrita[2]);
      if (ALIAS_CAMPOS[claveEtiqueta(etiqueta)] !== 'cedula') continue;
    }
    const campo = ALIAS_CAMPOS[claveEtiqueta(etiqueta)];
    if (!campo || campos[campo] !== undefined) continue;

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
    } else if (campo === 'nombre') {
      const nombre = extraerTextoLibre(valor, MAX_NOMBRE);
      if (nombre) campos.nombre = nombre;
    } else if (campo === 'direccion') {
      const direccion = extraerTextoLibre(valor, MAX_DIRECCION);
      if (direccion) campos.direccion = direccion;
    } else if (campo === 'telefono') {
      const telefono = extraerTelefonos(valor);
      if (telefono) campos.telefono = telefono;
    } else if (campo === 'nap') {
      // Solo se acepta si hay un único código; con varios no se elige uno.
      const codigos = codigosNap(valor);
      if (codigos.length === 1) campos.nap = codigos[0];
      else if (codigos.length > 1) napAmbiguo = true;
    } else {
      campos[campo] = valor;
    }
  }
  // A veces la línea "Nap:" va vacía y el código aparece en otra parte, por
  // ejemplo en la nota: "se puede hacer del NAP O10H37 a 240m". Si hay más de un
  // código distinto no se elige ninguno: queda para llenarlo a mano.
  if (campos.nap === undefined && !napAmbiguo) {
    const conPalabra = [...String(texto || '').matchAll(new RegExp(`\\bNAP\\W{0,4}(${CODIGO_NAP})`, 'gi'))].map(m => m[1].toUpperCase());
    const distintos = [...new Set(conPalabra)];
    if (distintos.length === 1) campos.nap = distintos[0];
    else if (distintos.length > 1) napAmbiguo = true;
  }
  // O la nota solo dice "se puede hacer del O02E13", sin la palabra NAP: se
  // busca el código suelto, pero solo desde la línea NOTA / Observación en
  // adelante (así no se confunde con otros códigos de la plantilla, como la MAC).
  if (campos.nap === undefined && !napAmbiguo) {
    const idxNota = lineas.findIndex(l => ETIQUETAS_NOTA.has(claveEtiqueta(l.split(':')[0] || '')));
    if (idxNota !== -1) {
      const codigos = codigosNap(lineas.slice(idxNota).join(' '));
      if (codigos.length === 1) campos.nap = codigos[0];
    }
  }
  // Muchas promotoras pegan el enlace de Maps suelto, sin etiqueta.
  if (campos.ubicacion === undefined) {
    const url = extraerUbicacionDeTexto(texto);
    if (url) campos.ubicacion = url;
  }
  return campos;
}

// Datos del cliente que la plantilla de la promotora trae y la orden no guarda como campos (hoy, el plan a
// contratar): se leen de la plantilla al mostrarlos (por ejemplo al revisar una instalación antes de aprobarla),
// así que sirven también con las órdenes ya creadas. Etiqueta ya normalizada (ver claveEtiqueta) -> campo.
const ETIQUETAS_DATOS_CLIENTE = {
  'PLAN A CONTRATAR': 'plan',
  'PLAN': 'plan',
};
const MAX_DATO_CLIENTE = 120;

// { plan }: solo los que la plantilla trae con valor (en la
// misma línea o, como lo hacen algunas promotoras, en la de abajo). Lo que no se entiende queda fuera.
export function parseDatosClienteTemplate(texto) {
  const datos = {};
  const originales = String(texto || '').split(/\r?\n|\r/);
  const lineas = originales.map(limpiarLinea);
  for (let i = 0; i < lineas.length; i++) {
    const idx = lineas[i].indexOf(':');
    if (idx === -1) continue;
    const campo = ETIQUETAS_DATOS_CLIENTE[claveEtiqueta(lineas[i].slice(0, idx))];
    if (!campo || datos[campo] !== undefined) continue;
    let valor = lineas[i].slice(idx + 1).trim();
    if (!valor) {
      let j = i + 1;
      while (j < lineas.length && !lineas[j]) j++;
      if (j < lineas.length && !esLineaEtiqueta(originales[j], lineas[j])) valor = lineas[j];
    }
    valor = valor.replace(/\s+/g, ' ').trim();
    if (!valor || valor.length > MAX_DATO_CLIENTE || SIN_DATO.has(claveEtiqueta(valor))) continue;
    datos[campo] = valor;
  }
  return datos;
}

// Lo que el técnico llena al instalar (ticket.instalacion, ver utils/instalacion) y la plantilla de la
// promotora trae vacío: la etiqueta (ya normalizada) de su línea en la plantilla.
const CAMPOS_INSTALACION = [
  // El serial va en la línea "Mac" de la plantilla (o "Serial", si la promotora la nombra así).
  { campo: 'serial', claves: ['MAC', 'SERIAL'] },
  { campo: 'vlan', claves: ['VLAN'] },
  { campo: 'posteadura', claves: ['POSTEADURA'] },
  // El metraje va solo en la línea "Drop" de la plantilla, con "m" (ej. "*Drop:* 150 m").
  { campo: 'metraje', claves: ['DROP'] },
  { campo: 'nap', claves: ['NAP'] },
  { campo: 'puerto', claves: ['CLIENTE CONECTA EN EL PUERTO N'] },
  { campo: 'puertosDisponibles', claves: ['PUERTOS DISPONIBLES'] },
];

// Solo los campos que el técnico llenó, ya como texto (los postes van separados por coma).
function camposLlenosDeInstalacion(instalacion) {
  if (!instalacion) return [];
  const texto = {
    serial: instalacion.serial,
    vlan: instalacion.vlan,
    posteadura: (instalacion.posteadura || []).join(', '),
    metraje: instalacion.metraje ? `${instalacion.metraje} m` : '',
    nap: instalacion.nap,
    puerto: instalacion.puerto,
    puertosDisponibles: instalacion.puertosDisponibles,
  };
  return CAMPOS_INSTALACION.map(c => ({ ...c, valor: String(texto[c.campo] ?? '').trim() })).filter(c => c.valor);
}

// Los datos de la instalación entran en la plantilla solo desde que el técnico pre-finaliza la orden
// (o ya está finalizada). Antes, y también si la devuelven al técnico (vuelve a PENDIENTE), sale la
// plantilla original con sus campos vacíos.
const ESTADOS_CON_DATOS_DE_INSTALACION = ['PRE-FINALIZADO', 'PRE-FINALIZADA', 'FINALIZADO'];
const instalacionParaLaPlantilla = (ticket) => (ESTADOS_CON_DATOS_DE_INSTALACION.includes(ticket.estado) ? ticket.instalacion : null);

// ¿La línea de esta etiqueta ya trae un valor? Escrito junto a la etiqueta o, como lo hacen
// algunas promotoras, en la línea de abajo (si lo que sigue es otra etiqueta, el campo está vacío).
function etiquetaTieneValor(lineas, idx) {
  const limpia = limpiarLinea(lineas[idx]);
  const dosPuntos = limpia.indexOf(':');
  if (dosPuntos !== -1 && limpia.slice(dosPuntos + 1).trim()) return true;
  let j = idx + 1;
  while (j < lineas.length && !limpiarLinea(lineas[j])) j++;
  return j < lineas.length && !esLineaEtiqueta(lineas[j], limpiarLinea(lineas[j]));
}

// Toca estas líneas de la plantilla cruda: el correlativo (primera línea), el técnico
// instalador y, si el técnico ya los llenó al pre-finalizar, el serial, VLAN, posteadura,
// metraje, NAP, puerto y puertos disponibles. Estos últimos SOLO se completan donde la plantilla
// los trae vacíos: lo que la promotora ya escribió se respeta y nunca se agregan líneas
// (la plantilla sigue siendo la de la promotora, con sus huecos llenos). Si la orden ya
// tiene ubicación, agrega el enlace de Maps al final (o lo completa en una etiqueta
// "Ubicación:" vacía); si la plantilla ya trae un enlace de Maps propio no se duplica.
// El resto queda exactamente como lo pegó la promotora.
function aplicarCorrelativoYTecnico(plantilla, codigo, tecnico, ubicacion, napCoordenadas, instalacion) {
  const lineas = normalizarNegritas(plantilla).split('\n');
  if (lineas.length > 0) lineas[0] = codigo || lineas[0];
  const idxInstalador = lineas.findIndex(l => claveEtiqueta(limpiarLinea(l).split(':')[0] || '') === 'INSTALADOR');
  if (idxInstalador !== -1) {
    lineas[idxInstalador] = `*Instalador:* ${tecnico || ''}`;
  }
  for (const { claves, valor } of camposLlenosDeInstalacion(instalacion)) {
    const idx = lineas.findIndex(l => limpiarLinea(l).includes(':') && claves.includes(claveEtiqueta(limpiarLinea(l).split(':')[0])));
    // Sin la línea en la plantilla no se agrega; con un valor ya escrito, no se toca.
    if (idx === -1 || etiquetaTieneValor(lineas, idx)) continue;
    lineas[idx] = `${lineas[idx].replace(/\s+$/, '')} ${valor}`;
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

// Tipos de trabajo cuya orden nace de una plantilla que manda la promotora
// (se pega al crear y el mensaje sale de esa misma plantilla).
export const tipoUsaPlantillaPromotora = (tipoTrabajo) => {
  const t = String(tipoTrabajo || '').toUpperCase();
  return t.includes('INSTAL') || t.includes('RECONEX');
};

// Igual que generarMensajeWhatsAppInstalacion pero para cualquier orden que
// traiga plantillaOriginal (instalaciones y reconexiones).
export function generarMensajeDesdePlantilla(ticket) {
  return aplicarCorrelativoYTecnico(ticket.plantillaOriginal, ticket.codigo, ticket.tecnico, ticket.ubicacion, ticket.napCoordenadas, instalacionParaLaPlantilla(ticket));
}

// Las órdenes que nacen de una plantilla de la promotora (instalaciones y reconexiones) solo tienen plantilla que
// copiar si se pegó la de la promotora al crear la orden (o después, al editarla): la app nunca arma una por su
// cuenta, para no mandar una plantilla distinta a la de la promotora. Sin ella, el botón de copiar está deshabilitado.
export const ordenSinPlantilla = (ticket) =>
  tipoUsaPlantillaPromotora(ticket?.tipoTrabajo) && !String(ticket?.plantillaOriginal || '').trim();

export const TEXTO_SIN_PLANTILLA = 'Esta orden no tiene la plantilla de la promotora: pégala desde Editar para poder copiarla.';

// La plantilla de la promotora de la instalación, tal cual se pegó, con el correlativo, el instalador y los
// datos que llenó el técnico en sus campos vacíos. Sin plantilla pegada devuelve vacío (ver ordenSinPlantilla).
export function generarMensajeWhatsAppInstalacion(ticket) {
  if (!ticket.plantillaOriginal || !ticket.plantillaOriginal.trim()) return '';
  return aplicarCorrelativoYTecnico(ticket.plantillaOriginal, ticket.codigo, ticket.tecnico, ticket.ubicacion, ticket.napCoordenadas, instalacionParaLaPlantilla(ticket));
}
