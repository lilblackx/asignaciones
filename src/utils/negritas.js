// Las promotoras se equivocan al poner las negritas de WhatsApp: asteriscos
// sobrantes que dejan el valor en negrita, o los dos puntos fuera de la
// etiqueta. Esto las deja como "*Etiqueta:* valor".
//
// Solo se mueven asteriscos (y se completan los dos puntos de etiquetas conocidas);
// el texto (letras, números, enlaces) nunca cambia. Como seguro, si el resultado
// difiere del original en algo que no sea asteriscos, dos puntos o espacios, se
// devuelve la plantilla original sin tocar.

// Etiqueta: hasta 40 caracteres, sin asteriscos, dos puntos ni saltos de línea.
const ETIQUETA = '([^*:\\r\\n]{1,40}?)';
// "*Fuente*: valor" y "*Fuente:*valor"
const ETIQUETA_BOLD = new RegExp(`^(\\s*)\\*+\\s*${ETIQUETA}\\s*(?::\\s*\\*+|\\*+\\s*:)(.*)$`);
// "*Posteadura:dm sn n01b01*": toda la línea en negrita, valor incluido
const LINEA_BOLD = new RegExp(`^(\\s*)\\*+\\s*${ETIQUETA}\\s*:([^*]*?)\\s*\\*+\\s*$`);

// "*Fuente: Sariana": asterisco de apertura sin cierre
const LINEA_SIN_CIERRE = new RegExp(`^(\\s*)\\*\\s*${ETIQUETA}\\s*:([^*]*)$`);

// "*Condición*": etiqueta de la plantilla escrita sin los dos puntos. Solo para
// etiquetas conocidas, para no tocar un énfasis suelto como "*URGENTE*".
const ETIQUETAS_SIN_DOS_PUNTOS = new Set(['CONDICION', 'CONDICIONES']);
const ETIQUETA_SOLA = new RegExp(`^(\\s*)\\*+\\s*${ETIQUETA}\\s*\\*+\\s*$`);
const claveSimple = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// WhatsApp solo cierra la negrita si el asterisco va seguido de espacio o puntuación:
// "*Instalador:*JOSE" se ve con los asteriscos a la vista; "*Instalador:* JOSE" no.
const conEspacio = (resto) => (/^\S/.test(resto) ? ` ${resto}` : resto);

function normalizarLinea(linea) {
  const bold = linea.match(ETIQUETA_BOLD);
  if (bold) return `${bold[1]}*${bold[2].trim()}:*${conEspacio(bold[3])}`;
  const completa = linea.match(LINEA_BOLD);
  if (completa) return `${completa[1]}*${completa[2].trim()}:* ${completa[3].trim()}`;
  const sinCierre = linea.match(LINEA_SIN_CIERRE);
  if (sinCierre) return `${sinCierre[1]}*${sinCierre[2].trim()}:*${conEspacio(sinCierre[3])}`;
  const sola = linea.match(ETIQUETA_SOLA);
  if (sola && ETIQUETAS_SIN_DOS_PUNTOS.has(claveSimple(sola[2]))) return `${sola[1]}*${sola[2].trim()}:*`;
  return linea;
}

const sinAsteriscosNiEspacios = (texto) => texto.replace(/[*:\s]/g, '');

export function normalizarNegritas(plantilla) {
  const texto = String(plantilla ?? '');
  // La primera línea es el código de la orden: no se toca.
  const [primera, ...resto] = texto.split('\n');
  const corregida = [primera, ...resto.map(normalizarLinea)].join('\n');
  return sinAsteriscosNiEspacios(corregida) === sinAsteriscosNiEspacios(texto) ? corregida : texto;
}
