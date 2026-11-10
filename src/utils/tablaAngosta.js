// Cuando una tabla trae tantas columnas que en la hoja vertical no cabe, ni con la letra más chica, sin partir palabras ("Órden/es", "112.345,5/6 $"), las columnas que sobran pasan a una línea gris
// debajo de cada fila ("Periodo: 26/10/2026 · Nota: pago de la semana"): no se pierde ningún dato y ninguna palabra se corta. Las tablas que ya caben no se tocan, y el CSV sigue trayendo todas las columnas.
// Función pura: la medida la pone quien exporta (el PDF mide con la letra; el Word, con letras por columna).

// Solo el espacio común separa palabras: el espacio sin salto de "1.010.845,61 Bs" las une, y la columna debe dar cabida a las dos partes juntas.
const palabrasDe = (texto) => String(texto ?? '').split(/[ \t\r\n]+/).filter(Boolean);

// Un dato sin nada que decir ('' o '-') no va a la línea gris.
const dato = (valor) => {
  const texto = String(valor ?? '').trim();
  return texto === '-' ? '' : texto;
};

// `medida`: { ancho(palabra): lo que mide, util: el ancho disponible, relleno: lo que suman los bordes de cada celda, tope: lo más que se le exige a una sola columna }.
// Devuelve la misma tabla si cabe; si no, una con menos columnas y `subfilas` (las que ya traía, más las columnas que salieron, con su título).
// Sale primero la columna de texto más ancha (nunca la primera, que identifica la fila); las numéricas (`derecha`) se quedan mientras haya otras. Siempre quedan al menos dos columnas.
export function ajustarTabla(tabla, { ancho, util, relleno = 0, tope = Infinity }) {
  const minimos = tabla.columnas.map((columna, i) => Math.min(tope, Math.max(0, ...[columna.titulo, ...tabla.filas.map((f) => f[i])].flatMap(palabrasDe).map(ancho)) + relleno));
  const visibles = tabla.columnas.map((_, i) => i);
  const quitadas = [];
  const suma = () => visibles.reduce((total, i) => total + minimos[i], 0);
  while (suma() > util && visibles.length > 2) {
    const candidatas = visibles.filter((i) => i !== 0);
    const deTexto = candidatas.filter((i) => !tabla.columnas[i].derecha);
    const elegida = (deTexto.length > 0 ? deTexto : candidatas).reduce((a, b) => (minimos[b] > minimos[a] ? b : a));
    visibles.splice(visibles.indexOf(elegida), 1);
    quitadas.push(elegida);
  }
  if (quitadas.length === 0) return tabla;
  quitadas.sort((a, b) => a - b);
  return {
    ...tabla,
    columnas: visibles.map((i) => tabla.columnas[i]),
    filas: tabla.filas.map((fila) => visibles.map((i) => fila[i])),
    subfilas: tabla.filas.map((fila, r) => [tabla.subfilas?.[r], ...quitadas.map((i) => dato(fila[i]) && `${tabla.columnas[i].titulo}: ${dato(fila[i])}`)].filter(Boolean).join(' · ')),
  };
}
