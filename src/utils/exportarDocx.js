// Arma el Word (.docx) de un documento de reporte (ver modelosReporte.js): mismo contenido que el PDF pero editable. A4 vertical, encabezado de
// marca, cifras en tarjetas, gráficos como imagen, tablas con filas alternadas y pie con número de página. Se carga solo al exportar.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableLayoutType, TableRow, TableCell, TextRun, VerticalAlign, WidthType,
} from 'docx';
import { graficoAImagen } from './graficoImagen.js';
import { fechaHoraLegible } from './formatoFecha.js';

const MARCA = 'ASIGNACIONES NS';
const ANCHO_UTIL = 9638; // A4 (11906) menos márgenes de 2 cm, en veinteavos de punto
const PX_UTIL = 640; // el mismo ancho en píxeles (para las imágenes)
const FUENTE = 'Calibri';
const SIN_BORDE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
// Una franja blanca gruesa entre tarjetas: las separa sin dibujar cajas.
const SEPARADOR = { style: BorderStyle.SINGLE, size: 36, color: 'FFFFFF' };
const SIN_BORDES = { top: SIN_BORDE, bottom: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE };

const corrida = (text, opciones = {}) => new TextRun({ text: String(text ?? ''), font: FUENTE, ...opciones });
const parrafo = (hijos, opciones = {}) => new Paragraph({ children: hijos, ...opciones });

function tarjetas(items) {
  const n = items.length;
  const ancho = Math.floor(ANCHO_UTIL / n);
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: items.map(() => ancho),
    layout: TableLayoutType.FIXED,
    borders: { ...SIN_BORDES, insideHorizontal: SIN_BORDE, insideVertical: SEPARADOR },
    rows: [new TableRow({
      children: items.map((it) => new TableCell({
        width: { size: ancho, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'F4F4F5', color: 'auto' },
        margins: { top: 100, bottom: 100, left: 140, right: 100 },
        verticalAlign: VerticalAlign.TOP,
        borders: { top: SIN_BORDE, bottom: SIN_BORDE, left: SEPARADOR, right: SEPARADOR },
        children: [
          parrafo([corrida(String(it.etiqueta).toUpperCase(), { size: 13, bold: true, color: '898781' })], { spacing: { after: 40 } }),
          parrafo([corrida(it.valor, { size: 32, bold: true, color: '0B0B0B' })], { spacing: { after: 20 } }),
          ...(it.detalle ? [parrafo([corrida(it.detalle, { size: 14, color: '52514E' })])] : []),
        ],
      })),
    })],
  });
}

function seccion(titulo, nota) {
  return [
    parrafo([corrida(titulo, { size: 25, bold: true, color: '0B0B0B' })], {
      spacing: { before: 280, after: nota ? 40 : 100 },
      keepNext: true,
      border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'DC2626', space: 6 } },
    }),
    ...(nota ? [parrafo([corrida(nota, { size: 16, color: '52514E' })], { spacing: { after: 100 }, keepNext: true })] : []),
  ];
}

// Anchos de las columnas según lo que llevan, sin que ninguna quede demasiado angosta.
function anchosDeColumnas(b) {
  const pesos = b.columnas.map((c, i) => Math.min(30, Math.max(7, c.titulo.length, ...b.filas.map((f) => String(f[i] ?? '').length))));
  const suma = pesos.reduce((s, p) => s + p, 0);
  const anchos = pesos.map((p) => Math.floor((p / suma) * ANCHO_UTIL));
  anchos[0] += ANCHO_UTIL - anchos.reduce((s, a) => s + a, 0);
  return anchos;
}

function tabla(b) {
  if (b.filas.length === 0) return [...seccion(b.titulo || '', b.nota), parrafo([corrida(b.vacio || 'Sin datos en este periodo.', { size: 18, italics: true, color: '898781' })])];
  const anchos = anchosDeColumnas(b);
  const borde = { style: BorderStyle.SINGLE, size: 4, color: 'E1E0D9' };
  const celda = (texto, i, { cabecera = false, par = false } = {}) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA },
    shading: cabecera ? { type: ShadingType.CLEAR, fill: '18181B', color: 'auto' } : par ? { type: ShadingType.CLEAR, fill: 'FAFAF9', color: 'auto' } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE, bottom: cabecera ? SIN_BORDE : borde },
    children: [parrafo([corrida(texto, { size: cabecera ? 16 : 17, bold: cabecera || b.columnas[i].derecha || i === 0, color: cabecera ? 'FFFFFF' : '0B0B0B' })], { alignment: b.columnas[i].derecha ? AlignmentType.RIGHT : AlignmentType.LEFT })],
  });
  return [
    ...seccion(b.titulo || '', b.nota),
    new Table({
      width: { size: ANCHO_UTIL, type: WidthType.DXA },
      columnWidths: anchos,
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: b.columnas.map((c, i) => celda(c.titulo, i, { cabecera: true })) }),
        ...b.filas.map((f, r) => new TableRow({ cantSplit: true, children: f.map((t, i) => celda(t, i, { par: r % 2 === 1 })) })),
      ],
    }),
  ];
}

// Puntos de atención: cada línea empieza con "Atención" (ámbar) o "Bien" (verde).
function lista(b) {
  return [
    ...seccion(b.titulo),
    ...b.items.map((item) => parrafo([
      corrida(item.nivel === 'aviso' ? 'Atención  ' : 'Bien  ', { size: 18, bold: true, color: item.nivel === 'aviso' ? 'D97706' : '16A34A' }),
      corrida(item.texto, { size: 19, color: '0B0B0B' }),
    ], { spacing: { after: 90 }, indent: { left: 120 } })),
  ];
}

function grafico(b) {
  const img = graficoAImagen(b);
  const ancho = PX_UTIL;
  const alto = Math.round((img.alto / img.ancho) * ancho);
  return [
    ...seccion(b.titulo, b.subtitulo),
    parrafo([new ImageRun({ type: 'png', data: img.bytes, transformation: { width: ancho, height: alto }, altText: { title: b.titulo, description: b.titulo, name: b.titulo } })], { spacing: { after: 160 } }),
  ];
}

export async function generarDocx(modelo) {
  const hijos = [
    parrafo([corrida(modelo.titulo, { size: 44, bold: true, color: '0B0B0B' })], { spacing: { after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'DC2626', space: 6 } } }),
    parrafo([corrida(modelo.subtitulo, { size: 21, color: '52514E' })], { spacing: { before: 100, after: 40 } }),
    parrafo([corrida(`Generado el ${fechaHoraLegible(modelo.generado.en)}${modelo.generado.por ? ` por ${modelo.generado.por}` : ''}`, { size: 17, color: '898781' })], { spacing: { after: 240 } }),
  ];
  for (const b of modelo.bloques) {
    if (b.tipo === 'cifras') { hijos.push(tarjetas(b.items), parrafo([], { spacing: { after: 120 } })); }
    else if (b.tipo === 'seccion') hijos.push(...seccion(b.titulo));
    else if (b.tipo === 'texto') hijos.push(parrafo([corrida(b.texto, { size: 16, color: '52514E' })], { spacing: { before: 120, after: 120 } }));
    else if (b.tipo === 'tabla' && !b.soloCsv) hijos.push(...tabla(b), parrafo([], { spacing: { after: 160 } }));
    else if (b.tipo === 'lista') hijos.push(...lista(b));
    else if (b.tipo === 'grafico') hijos.push(...grafico(b));
  }

  const documento = new Document({
    creator: modelo.generado.por || MARCA,
    title: modelo.titulo,
    description: modelo.subtitulo,
    styles: { default: { document: { run: { font: FUENTE, size: 21 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1200, left: 1134, right: 1134, header: 500, footer: 500 } } },
      headers: {
        default: new Header({
          children: [parrafo([corrida(MARCA, { size: 17, bold: true, color: '0B0B0B' }), corrida(`   |   ${modelo.titulo}`, { size: 17, color: '898781' })], { border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: 'DC2626', space: 4 } } })],
        }),
      },
      footers: {
        default: new Footer({
          children: [parrafo([
            corrida(`Documento de uso interno   |   Generado el ${fechaHoraLegible(modelo.generado.en)}`, { size: 15, color: '898781' }),
            corrida('\tPágina ', { size: 15, color: '898781' }),
            new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: 15, color: '898781' }),
            corrida(' de ', { size: 15, color: '898781' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FUENTE, size: 15, color: '898781' }),
          ], { tabStops: [{ type: 'right', position: ANCHO_UTIL }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E1E0D9', space: 4 } } })],
        }),
      },
      children: hijos,
    }],
  });
  return Packer.toBlob(documento);
}
