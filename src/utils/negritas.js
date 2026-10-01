// Las promotoras se equivocan al poner las negritas de WhatsApp: asteriscos
// sobrantes que dejan el valor en negrita, o los dos puntos fuera de la
// etiqueta. Esto las deja como "*Etiqueta:* valor".
//
// Solo se mueven asteriscos; el texto (letras, números, enlaces) nunca cambia.
// Como seguro, si el resultado difiere del original en algo que no sea
// asteriscos o espacios, se devuelve la plantilla original sin tocar.

// Etiqueta: hasta 40 caracteres, sin asteriscos, dos puntos ni saltos de línea.
const ETIQUETA = '([^*:\\r\\n]{1,40}?)';
// "*Fuente*: valor" y "*Fuente:*valor"
const ETIQUETA_BOLD = new RegExp(`^(\\s*)\\*+\\s*${ETIQUETA}\\s*(?::\\s*\\*+|\\*+\\s*:)(.*)$`);
// "*Posteadura:dm sn n01b01*": toda la línea en negrita, valor incluido
const LINEA_BOLD = new RegExp(`^(\\s*)\\*+\\s*${ETIQUETA}\\s*:([^*]*?)\\s*\\*+\\s*$`);

function normalizarLinea(linea) {
  const bold = linea.match(ETIQUETA_BOLD);
  if (bold) return `${bold[1]}*${bold[2].trim()}:*${bold[3]}`;
  const completa = linea.match(LINEA_BOLD);
  if (completa) return `${completa[1]}*${completa[2].trim()}:* ${completa[3].trim()}`;
  return linea;
}

const sinAsteriscosNiEspacios = (texto) => texto.replace(/[*\s]/g, '');

export function normalizarNegritas(plantilla) {
  const texto = String(plantilla ?? '');
  // La primera línea es el código de la orden: no se toca.
  const [primera, ...resto] = texto.split('\n');
  const corregida = [primera, ...resto.map(normalizarLinea)].join('\n');
  return sinAsteriscosNiEspacios(corregida) === sinAsteriscosNiEspacios(texto) ? corregida : texto;
}
