// Cobertura práctica de los rangos Unicode donde viven los emojis (símbolos,
// pictogramas, banderas, selector de variación y el conector zero-width que
// arma emojis compuestos). No incluye el bloque "Arrows" (U+2190-U+21FF)
// porque son flechas de texto normal (←→↑↓), no emoji, y se estaban borrando
// por error. No pretende ser exhaustiva al 100%, pero cubre lo que un
// teclado normal puede insertar.
// El selector de variación y el ZWJ van en alternancia, no dentro de la clase de
// caracteres: son modificadores que combinan con el carácter anterior, y ESLint
// marca eso como potencialmente engañoso dentro de un [...]. El resultado (quitar
// cada uno donde aparezca) es el mismo.
const EMOJI_REGEX = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|\u{FE0F}|\u{200D}/gu;

export function stripEmojis(value) {
  return typeof value === 'string' ? value.replace(EMOJI_REGEX, '') : value;
}
