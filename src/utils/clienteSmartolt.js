import { MAX_TELEFONOS, telefonoInternacional, unirTelefonos } from './telefono';

export const soloDigitos = (texto) => String(texto || '').replace(/\D/g, '');

// Cédulas a partir de las cuales se consulta SmartOLT (y las que acepta el Worker).
export const MIN_DIGITOS_CEDULA = 7;

// SmartOLT guarda el nombre y, después, el documento con su etiqueta y códigos:
// "JUAN PEREZ C.I 12.345.678 (P150)", "... CI: 12.345.678 A1", "... C.l. 12.345.678"
// (con L minúscula, un error de tipeo común), "... E-12.345.678". El nombre es lo que
// va antes del documento, sin su etiqueta; lo que viene después (códigos de plan, etc.)
// no es parte del nombre. Si el documento va al principio ("V12345678 JUAN PEREZ"), el
// nombre es lo que le sigue.
const LETRAS = 'A-Za-zÁÉÍÓÚÑáéíóúñ';

// Etiqueta al final del texto: C.I, CI, C.I., C.l (L minúscula), C,I, Ci, .I, I, C.,
// CÉDULA, RIF, V-, E-... Debe ir como palabra aparte ("Gil" no pierde la "l").
const ETIQUETA_FINAL = new RegExp(
  String.raw`(?:^|[\s,.;:-])(?:C\s*[.,]?\s*[Il1|]|[.,]?\s*[Il1|]|C[EÉ]DULA|C[EÉ]D|RIF|DNI|C|[VEJGP])[\s.,:;#-]*$`,
  'i'
);

const recortar = (texto) => texto.replace(/^[\s\-_|:,.]+|[\s\-_|:,.]+$/g, '').replace(/\s{2,}/g, ' ');
const quitarEtiqueta = (texto) => recortar(recortar(texto).replace(ETIQUETA_FINAL, ''));
const tieneNombre = (texto) => new RegExp(String.raw`[${LETRAS}]{2}`).test(texto);

export function limpiarNombre(nombre, cedula) {
  const digitos = soloDigitos(cedula);
  const texto = String(nombre || '');
  let resultado = texto;
  if (digitos) {
    const separador = String.raw`[.\s-]?`;
    const documento = new RegExp(String.raw`(?<!\d)` + digitos.split('').join(separador) + String.raw`(?!\d)`);
    const m = documento.exec(texto);
    if (m) {
      const antes = quitarEtiqueta(texto.slice(0, m.index));
      resultado = tieneNombre(antes) ? antes : texto.slice(m.index + m[0].length);
    }
  }
  return quitarEtiqueta(recortar(resultado).replace(/(\s*\([^)]*\))+\s*$/, ''));
}

// El "contacto" de SmartOLT es texto libre ("Juan 0414-1234567 / 0424 7654321"):
// se sacan los números que sirven como teléfono, hasta el máximo de la orden.
export function extraerTelefonos(contacto) {
  const candidatos = String(contacto || '').match(/\+?\d[\d\s\-().]{6,}\d/g) || [];
  const validos = [];
  for (const c of candidatos) {
    const limpio = c.trim();
    if (telefonoInternacional(limpio) && !validos.some((v) => soloDigitos(v) === soloDigitos(limpio))) validos.push(limpio);
  }
  return validos.slice(0, MAX_TELEFONOS);
}

const CAMPOS = [
  ['nombre', 'nombre'],
  ['direccion', 'dirección'],
  ['telefono', 'teléfono'],
  ['nap', 'NAP'],
  ['ubicacion', 'ubicación'],
];

// Datos de la ONU -> campos de la orden nueva (solo los que tengan valor).
export function camposDeOnu(onu, cedula) {
  const tel = unirTelefonos(extraerTelefonos(onu.telefono));
  const campos = {
    nombre: limpiarNombre(onu.nombre, cedula),
    direccion: String(onu.direccion || '').trim(),
    telefono: tel,
    nap: String(onu.nap || '').trim().toUpperCase(),
    ubicacion: onu.latitud != null && onu.longitud != null ? `${onu.latitud}, ${onu.longitud}` : '',
  };
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v));
}

// Qué campos se llenan: solo los que están vacíos en el formulario (nunca se pisa
// lo que ya escribió quien crea la orden). Devuelve { campos, etiquetas }.
export function camposParaRellenar(onu, cedula, formulario) {
  const disponibles = camposDeOnu(onu, cedula);
  const campos = Object.fromEntries(Object.entries(disponibles).filter(([nombre]) => !String(formulario?.[nombre] || '').trim()));
  const etiquetas = CAMPOS.filter(([nombre]) => nombre in campos).map(([, etiqueta]) => etiqueta);
  return { campos, etiquetas };
}
