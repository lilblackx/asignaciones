// El nombre y la dirección de un cliente como se guardan. Llegan de muchos lados (los escribe la oficina, los pegan las promotoras en su
// plantilla, los trae SmartOLT) y cada uno los trae a su manera: TODO EN MAYÚSCULAS, todo en minúsculas o mezclado. Se normalizan al
// guardarlos, así la base queda uniforme y no hay que arreglarlos en cada pantalla. Módulo sin dependencias: lo usan la app, el Worker
// (resumen del historial) y el script que arregla lo ya guardado. No toca la plantilla que pegó la promotora (esa se guarda tal cual).
// Ambas funciones son idempotentes: normalizar algo ya normalizado no lo cambia.

const MAYUSCULA_EN_MEDIO = /\p{Ll}\p{Lu}/u;
const SEPARADORES = /([-'’/.])/;
const ES_SEPARADOR = /^[-'’/.]$/;

const conInicial = (parte) => (parte ? parte.charAt(0).toLocaleUpperCase('es') + parte.slice(1).toLocaleLowerCase('es') : parte);
// Cada parte de una palabra separada por guion, apóstrofo, barra o punto ("Perez-Gomez", "O'Brien", "Av.", "C.C.").
const porPartes = (palabra) => palabra.split(SEPARADORES).map((p) => (ES_SEPARADOR.test(p) ? p : conInicial(p))).join('');
const normalizarTexto = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

// --- Nombre de una persona o empresa ---
//  - Cada palabra con su inicial en mayúscula y el resto en minúscula ("angela MARIA" -> "Angela Maria").
//  - Las partículas (de, del, la, las, los, y) van en minúscula, salvo la primera palabra ("Maria de los Angeles").
//  - Una palabra que ya trae una mayúscula en medio ("McDonald", "DeLaCruz") se deja: alguien la escribió así a propósito.
//  - Siglas de empresas ("C.A.", "S.A.S", "CA", "SRL", "LTDA") y números romanos (II, III) se quedan en mayúsculas.
const PARTICULAS_NOMBRE = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const SIGLAS = new Set(['ca', 'sa', 'sas', 'srl', 'ltda', 'ii', 'iii', 'iv']);

function palabraDeNombre(palabra, esPrimera) {
  const minuscula = palabra.toLocaleLowerCase('es');
  if (MAYUSCULA_EN_MEDIO.test(palabra)) return palabra;
  if (SIGLAS.has(minuscula) || /^(\p{L}\.){2,}\p{L}?\.?$/u.test(palabra)) return palabra.toLocaleUpperCase('es');
  if (!esPrimera && PARTICULAS_NOMBRE.has(minuscula)) return minuscula;
  return porPartes(palabra);
}

export function nombrePersona(texto) {
  return normalizarTexto(texto).split(' ').filter(Boolean).map((p, i) => palabraDeNombre(p, i === 0)).join(' ');
}

// --- Dirección ---
//  - Cada palabra con su inicial en mayúscula ("BARRIO san juan" -> "Barrio San Juan"); las de enlace (de, del, en, con, a...) en minúscula.
//    Los artículos (la, el, los, las) no: casi siempre son parte del nombre de un lugar ("El Centro", "La Colina").
//  - Lo que lleva números va en mayúsculas ("101d" -> "101D", "casa b2" -> "casa B2"), salvo los ordinales ("2da", "1ra", "3er").
//  - Las abreviaturas de siempre (NAP, PH, CC, ONU, OLT, SN, KM) se quedan en mayúsculas.
//  - Una palabra con una mayúscula en medio se deja como está.
const ENLACES_DIRECCION = new Set(['de', 'del', 'y', 'e', 'en', 'con', 'al', 'por', 'sin', 'a']);
const ABREVIATURAS = new Set(['nap', 'ph', 'cc', 'onu', 'olt', 'sn', 'km']);
const ORDINAL = /^\d+(ra|ro|da|do|er|to|ta|vo|va|mo|ma|no|na)$/i;

function palabraDeDireccion(palabra, esPrimera) {
  const minuscula = palabra.toLocaleLowerCase('es');
  if (MAYUSCULA_EN_MEDIO.test(palabra)) return palabra;
  if (ORDINAL.test(palabra)) return minuscula;
  if (/\d/.test(palabra)) return palabra.toLocaleUpperCase('es');
  if (ABREVIATURAS.has(minuscula)) return palabra.toLocaleUpperCase('es');
  if (!esPrimera && ENLACES_DIRECCION.has(minuscula)) return minuscula;
  return porPartes(palabra);
}

export function direccionCliente(texto) {
  return normalizarTexto(texto).split(' ').filter(Boolean).map((p, i) => palabraDeDireccion(p, i === 0)).join(' ');
}
