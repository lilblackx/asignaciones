// Dibuja un gráfico del documento (bloque tipo 'grafico', ver modelosReporte.js) en un canvas y lo devuelve como imagen PNG, para
// incrustarlo en el PDF y en el Word. Se dibuja siempre en claro (es para imprimir) con la paleta validada de dataviz.
// Solo corre en el navegador (usa canvas).

const ESCALA = 2; // la imagen sale al doble de resolución para que no se vea borrosa al imprimir
const TINTA = '#0b0b0b';
const TINTA_SUAVE = '#52514e';
const TINTA_TENUE = '#898781';
const REJILLA = '#e1e0d9';
const LINEA_BASE = '#c3c2b7';
const FUENTE = 'Helvetica, Arial, sans-serif';

// Un paso "redondo" (1, 2, 5, 10 × potencia de 10) para que el eje tenga 4 tramos con números limpios.
function pasoDelEje(maximo) {
  const crudo = Math.max(maximo, 1) / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  return [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= crudo);
}
const compacto = (n) => (Number.isInteger(n) ? (n >= 1000 ? `${n / 1000}K` : String(n)) : String(Math.round(n * 10) / 10).replace('.', ','));

function barraRedondeada(ctx, x, y, ancho, alto, radio) {
  if (alto <= 0) return;
  const r = Math.min(radio, alto, ancho / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + alto);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + ancho - r, y);
  ctx.quadraticCurveTo(x + ancho, y, x + ancho, y + r);
  ctx.lineTo(x + ancho, y + alto);
  ctx.closePath();
  ctx.fill();
}

function barraHorizontal(ctx, x, y, largo, alto, radio) {
  if (largo <= 0) return;
  const r = Math.min(radio, largo, alto / 2);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + largo - r, y);
  ctx.quadraticCurveTo(x + largo, y, x + largo, y + r);
  ctx.lineTo(x + largo, y + alto - r);
  ctx.quadraticCurveTo(x + largo, y + alto, x + largo - r, y + alto);
  ctx.lineTo(x, y + alto);
  ctx.closePath();
  ctx.fill();
}

function nuevoLienzo(ancho, alto) {
  const canvas = document.createElement('canvas');
  canvas.width = ancho * ESCALA;
  canvas.height = alto * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textBaseline = 'middle';
  return { canvas, ctx };
}

function leyenda(ctx, series, x, y) {
  ctx.font = `12px ${FUENTE}`;
  let cursor = x;
  for (const s of series) {
    ctx.fillStyle = s.color;
    ctx.fillRect(cursor, y - 5, 10, 10);
    ctx.fillStyle = TINTA_SUAVE;
    ctx.textAlign = 'left';
    ctx.fillText(s.nombre, cursor + 15, y);
    cursor += 15 + ctx.measureText(s.nombre).width + 18;
  }
}

function columnas({ series, categorias }) {
  const ancho = 760;
  const alto = 300;
  const { canvas, ctx } = nuevoLienzo(ancho, alto);
  const izq = 40;
  const der = 12;
  const arriba = series.length > 1 ? 36 : 14;
  const abajo = 28;
  const anchoPlot = ancho - izq - der;
  const altoPlot = alto - arriba - abajo;

  const paso = pasoDelEje(Math.max(0, ...categorias.flatMap((c) => c.valores)));
  const maximo = paso * 4;
  const yDe = (v) => arriba + altoPlot - (v / maximo) * altoPlot;

  if (series.length > 1) leyenda(ctx, series, izq, 14);

  ctx.font = `11px ${FUENTE}`;
  for (let i = 0; i <= 4; i += 1) {
    const v = i * paso;
    ctx.strokeStyle = i === 0 ? LINEA_BASE : REJILLA;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(izq, yDe(v) + 0.5);
    ctx.lineTo(ancho - der, yDe(v) + 0.5);
    ctx.stroke();
    ctx.fillStyle = TINTA_TENUE;
    ctx.textAlign = 'right';
    ctx.fillText(compacto(v), izq - 6, yDe(v));
  }

  const anchoGrupo = anchoPlot / categorias.length;
  const anchoBarra = Math.min(24, (anchoGrupo - 10) / series.length - 2);
  categorias.forEach((c, i) => {
    const total = series.length * anchoBarra + (series.length - 1) * 2;
    const inicio = izq + i * anchoGrupo + (anchoGrupo - total) / 2;
    c.valores.forEach((v, k) => {
      const x = inicio + k * (anchoBarra + 2);
      ctx.fillStyle = series[k].color;
      barraRedondeada(ctx, x, yDe(v), anchoBarra, yDe(0) - yDe(v), 4);
      // Solo se rotula el último mes: el resto lo dan el eje y la tabla del documento.
      if (i === categorias.length - 1 && v > 0) {
        ctx.fillStyle = TINTA;
        ctx.font = `bold 11px ${FUENTE}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(v), x + anchoBarra / 2, yDe(v) - 8);
      }
    });
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `11px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(c.etiqueta, izq + i * anchoGrupo + anchoGrupo / 2, alto - abajo / 2 + 2);
  });
  return { canvas, ancho, alto };
}

function barras({ series, categorias }) {
  const ancho = 760;
  const fila = 30;
  const alto = categorias.length * fila + 16;
  const { canvas, ctx } = nuevoLienzo(ancho, alto);
  ctx.font = `12px ${FUENTE}`;
  const etiquetaMax = Math.min(190, Math.max(...categorias.map((c) => ctx.measureText(c.etiqueta).width)) + 12);
  const textoMax = Math.max(...categorias.map((c) => ctx.measureText(c.textos?.[0] ?? String(c.valores[0])).width)) + 12;
  const x0 = etiquetaMax + 8;
  const anchoMax = ancho - x0 - textoMax - 8;
  const maximo = Math.max(...categorias.map((c) => c.valores[0]), 1);

  categorias.forEach((c, i) => {
    const y = 8 + i * fila + fila / 2;
    ctx.fillStyle = TINTA;
    ctx.textAlign = 'right';
    let etiqueta = c.etiqueta;
    while (ctx.measureText(etiqueta).width > etiquetaMax - 4 && etiqueta.length > 3) etiqueta = `${etiqueta.slice(0, -2)}…`;
    ctx.fillText(etiqueta, etiquetaMax, y);
    const largo = Math.max((c.valores[0] / maximo) * anchoMax, c.valores[0] > 0 ? 3 : 0);
    ctx.fillStyle = series[0].color;
    // Redondeada en la punta, cuadrada en la base.
    barraHorizontal(ctx, x0, y - 9, largo, 18, 4);
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `bold 12px ${FUENTE}`;
    ctx.textAlign = 'left';
    ctx.fillText(c.textos?.[0] ?? String(c.valores[0]), x0 + largo + 8, y);
    ctx.font = `12px ${FUENTE}`;
  });
  ctx.strokeStyle = LINEA_BASE;
  ctx.beginPath();
  ctx.moveTo(x0 + 0.5, 4);
  ctx.lineTo(x0 + 0.5, alto - 4);
  ctx.stroke();
  return { canvas, ancho, alto };
}

// { bytes: Uint8Array del PNG, dataUrl, ancho, alto } (ancho y alto lógicos, sin el factor de resolución).
export function graficoAImagen(bloque) {
  const { canvas, ancho, alto } = bloque.variante === 'barras' ? barras(bloque) : columnas(bloque);
  const dataUrl = canvas.toDataURL('image/png');
  const binario = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return { bytes, dataUrl, ancho, alto };
}
