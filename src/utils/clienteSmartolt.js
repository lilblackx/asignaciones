import { MAX_TELEFONOS, telefonoInternacional, unirTelefonos } from './telefono';

export const soloDigitos = (texto) => String(texto || '').replace(/\D/g, '');

// Cédulas a partir de las cuales se consulta SmartOLT (y las que acepta el Worker).
export const MIN_DIGITOS_CEDULA = 7;

// SmartOLT guarda el nombre y, después, el documento con su etiqueta y códigos:
// "JUAN PEREZ C.I 12.345.678 (P150)", "... CI: 12.345.678 A1", "... V-12.345.678".
// El nombre es lo que va antes del documento; lo que viene después (códigos de
// plan, etc.) no es parte del nombre. Si el documento va al principio
// ("V12345678 JUAN PEREZ"), el nombre es lo que le sigue.
const ETIQUETA_DOCUMENTO = String.raw`C\.?\s*I\.?|C[EÉ]DULA|RIF|DNI|[VEJG]`;
const LETRAS = 'A-Za-zÁÉÍÓÚÑáéíóúñ';
const ETIQUETA_SUELTA = new RegExp(String.raw`(?<![${LETRAS}])(?:C\.?\s*I\.?|C[EÉ]DULA|RIF)[\s.:#-]*$`, 'i');

const recortar = (texto) => texto.replace(/^[\s\-_|:,.]+|[\s\-_|:,.]+$/g, '').replace(/\s{2,}/g, ' ');

export function limpiarNombre(nombre, cedula) {
  const digitos = soloDigitos(cedula);
  const texto = String(nombre || '');
  let resultado = texto;
  if (digitos) {
    const separador = String.raw`[.\s-]?`;
    const documento = new RegExp(
      String.raw`(?:(?<![${LETRAS}])(?:${ETIQUETA_DOCUMENTO})[\s.:#-]*)?(?<!\d)` + digitos.split('').join(separador) + String.raw`(?!\d)`,
      'i'
    );
    const m = documento.exec(texto);
    if (m) {
      const antes = recortar(texto.slice(0, m.index));
      resultado = /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2}/.test(antes) ? antes : texto.slice(m.index + m[0].length);
    }
  }
  return recortar(resultado.replace(/(\s*\([^)]*\))+\s*$/, '').replace(ETIQUETA_SUELTA, ''));
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
