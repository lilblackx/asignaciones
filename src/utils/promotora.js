// La promotora que vendió una instalación: sale de la línea "Promotora:" (o "Promotor:") de la plantilla que pega
// quien crea la orden. Cada usuario con rol PROMOTORA ve solo las instalaciones cuya promotora coincide con alguno
// de los nombres que el administrador le asignó. Como en las plantillas el nombre se escribe de mil formas
// ("sariana", "Sariana ", "ALEXIS AÑEZ"), se compara por una clave normalizada: sin tildes, en minúsculas y con los
// espacios juntos. Esa misma clave se guarda en la orden (`promotoraClave`) y en el perfil del usuario
// (`promotoraClaves`) para que las reglas de Firestore puedan compararlas. Mantener sincronizado con claveNombre
// y nombrePromotora de cf-worker/src/index.js (el cierre automático arma el historial con ellas).

// Lo que se escribe cuando no hay promotora; no es un nombre.
const SIN_DATO = new Set(['', 'na', 'n a', 'no aplica', 'ninguno', 'ninguna', 'pendiente', 'por asignar', 'por definir', 'sin datos', 'sin dato', 'sin promotora', 'no tiene', 'xx', 'xxx']);

export const MAX_NOMBRE_PROMOTORA = 100;

// El promotor es obligatorio en toda instalación (al crearla y al editarla): sin él, nadie la ve en su pantalla.
export const MENSAJE_PROMOTOR_OBLIGATORIO = 'Promotor: es obligatorio en una instalación, escribe el nombre como aparece en la plantilla.';
export const MENSAJE_PROMOTOR_CAMPO = 'Escribe el promotor de la instalación, como aparece en la plantilla.';
export const MAX_NOMBRES_POR_PROMOTORA = 5;

// "Alexis Añez" -> "alexis anez". '' si no hay un nombre.
export function claveNombre(texto) {
  const clave = String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return SIN_DATO.has(clave) ? '' : clave;
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

// El nombre como se muestra y se guarda: espacios juntos y cada palabra con su mayúscula ("sariana" -> "Sariana",
// "ALEXIS AÑEZ" -> "Alexis Añez"). '' si no hay un nombre.
export function nombrePromotora(texto) {
  if (!claveNombre(texto)) return '';
  return String(texto).replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE_PROMOTORA)
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

// Lo que escribe el administrador: nombres separados por coma, "Sariana, Sariana Pérez" ->
// { nombres: ['Sariana', 'Sariana Pérez'], claves: ['sariana', 'sariana perez'] }. Sin repetidos ni vacíos.
export function parseNombresPromotora(texto) {
  const nombres = [];
  const claves = [];
  for (const parte of (Array.isArray(texto) ? texto : String(texto ?? '').split(/[,;\n]/))) {
    const clave = claveNombre(parte);
    if (!clave || claves.includes(clave)) continue;
    claves.push(clave);
    nombres.push(nombrePromotora(parte));
  }
  return { nombres: nombres.slice(0, MAX_NOMBRES_POR_PROMOTORA), claves: claves.slice(0, MAX_NOMBRES_POR_PROMOTORA) };
}

// Mensaje de error de los nombres que escribió el administrador ('' si están bien).
export function errorNombresPromotora(texto) {
  const { nombres } = parseNombresPromotora(texto);
  if (nombres.length === 0) return 'Escribe el nombre con que aparece el promotor en las plantillas.';
  const partes = (Array.isArray(texto) ? texto : String(texto ?? '').split(/[,;\n]/)).filter((p) => claveNombre(p)).length;
  if (partes > MAX_NOMBRES_POR_PROMOTORA) return `Máximo ${MAX_NOMBRES_POR_PROMOTORA} nombres por promotor.`;
  return '';
}
