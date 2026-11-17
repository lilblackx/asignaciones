// Arma el Word (.docx) de un documento de reporte (ver modelosReporte.js): mismo contenido y mismo diseño que el PDF (el estilo de la app) pero editable. A4 vertical, ficha de marca,
// título con la línea roja corta, cifras en tarjetas suaves, gráficos como imagen, tablas claras con rayas finas y pie con número de página. Se carga solo al exportar.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeightRule, ImageRun, LineRuleType, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableLayoutType, TableRow, TableCell, TextRun, VerticalAlign, WidthType,
} from 'docx';
import { graficoAImagen } from './graficoImagen.js';
import { fechaHoraLegible } from './formatoFecha.js';
import { cargarLogo } from './logoReportes.js';
import { ajustarTabla } from './tablaAngosta.js';
import { partirNegritas } from './textoEnriquecido.js';

const MARCA = 'Network Speed';
const ANCHO_PAGINA = 11906; // el ancho de la hoja A4, en veinteavos de punto
const MARGEN_LATERAL = 1134; // márgenes de 2 cm a los lados
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN_LATERAL * 2; // 9638
const FONDO = 'F4F2EF'; // el fondo suave de las tarjetas de la app
const RAYA = 'E7E5E4';
const TINTA = '1C1917';
const GRIS = '57534E';
const GRIS_TENUE = '78716C';
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
        shading: { type: ShadingType.CLEAR, fill: FONDO, color: 'auto' },
        margins: { top: 110, bottom: 110, left: 150, right: 100 },
        verticalAlign: VerticalAlign.TOP,
        borders: { top: SIN_BORDE, bottom: SIN_BORDE, left: SEPARADOR, right: SEPARADOR },
        children: [
          parrafo([corrida(String(it.etiqueta), { size: 15, bold: true, color: GRIS })], { spacing: { after: 40 } }),
          parrafo([corrida(it.valor, { size: 34, bold: true, color: TINTA })], { spacing: { after: 20 } }),
          ...(it.detalle ? [parrafo([corrida(it.detalle, { size: 14, color: GRIS })])] : []),
        ],
      })),
    })],
  });
}

function seccion(titulo, nota) {
  return [
    parrafo([corrida(titulo, { size: 25, bold: true, color: TINTA })], {
      spacing: { before: 300, after: nota ? 40 : 100 },
      keepNext: true,
    }),
    ...(nota ? [parrafo([corrida(nota, { size: 16, color: GRIS })], { spacing: { after: 100 }, keepNext: true })] : []),
  ];
}

// Anchos de las columnas según lo que llevan: reparto proporcional al texto de cada una, pero ninguna baja de lo que mide su palabra más larga
// (así una fecha, "Órdenes" o "Pagado" no se parten en dos líneas); las demás se reparten lo que sobra.
const TWIPS_POR_LETRA = 100;
const RELLENO_CELDA = 260;
function anchosDeColumnas(b) {
  const textos = (i) => [b.columnas[i].titulo, ...b.filas.map((f) => String(f[i] ?? ''))];
  const pesos = b.columnas.map((_, i) => Math.min(30, Math.max(7, ...textos(i).map((t) => t.length))));
  // Solo el espacio común separa palabras: el espacio sin salto de "1.010.845,61 Bs" las une.
  const minimos = b.columnas.map((_, i) => Math.max(...textos(i).flatMap((t) => t.split(/[ \t\r\n]+/)).map((p) => p.length)) * TWIPS_POR_LETRA + RELLENO_CELDA);
  const fijas = new Set();
  let anchos = [];
  for (let vuelta = 0; vuelta <= b.columnas.length; vuelta += 1) {
    const espacio = ANCHO_UTIL - [...fijas].reduce((s, i) => s + minimos[i], 0);
    const sumaLibres = pesos.reduce((s, p, i) => (fijas.has(i) ? s : s + p), 0);
    anchos = pesos.map((p, i) => (fijas.has(i) ? minimos[i] : Math.floor((p / sumaLibres) * espacio)));
    const chica = anchos.findIndex((a, i) => !fijas.has(i) && a < minimos[i]);
    if (chica === -1) break;
    fijas.add(chica);
  }
  // Si ni así caben (muchas columnas), se reducen todas en proporción.
  const total = anchos.reduce((s, a) => s + a, 0);
  if (total > ANCHO_UTIL) anchos = anchos.map((a) => Math.floor((a / total) * ANCHO_UTIL));
  anchos[0] += ANCHO_UTIL - anchos.reduce((s, a) => s + a, 0);
  return anchos;
}

function tabla(original) {
  if (original.filas.length === 0) return [...seccion(original.titulo || '', original.nota), parrafo([corrida(original.vacio || 'Sin datos en este periodo.', { size: 18, italics: true, color: '898781' })])];
  // Si no cabe sin partir palabras, las columnas que sobran pasan a una línea gris debajo de cada fila (ver utils/tablaAngosta).
  const b = ajustarTabla(original, { ancho: (palabra) => palabra.length * TWIPS_POR_LETRA, util: ANCHO_UTIL, relleno: RELLENO_CELDA });
  const anchos = anchosDeColumnas(b);
  const borde = { style: BorderStyle.SINGLE, size: 4, color: RAYA };
  const celda = (texto, i, { cabecera = false, conLinea = false } = {}) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA },
    shading: cabecera ? { type: ShadingType.CLEAR, fill: FONDO, color: 'auto' } : undefined,
    margins: { top: 70, bottom: conLinea ? 20 : 70, left: 110, right: 110 },
    // Igual que en el PDF: el encabezado centrado en vertical y los datos arriba, para que una celda de varias líneas no desplace a las de al lado.
    verticalAlign: cabecera ? VerticalAlign.CENTER : VerticalAlign.TOP,
    borders: { top: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE, bottom: cabecera || conLinea ? SIN_BORDE : borde },
    children: [parrafo([corrida(cabecera ? String(texto).toUpperCase() : texto, { size: cabecera ? 15 : 17, bold: cabecera || b.columnas[i].derecha || i === 0, color: cabecera ? GRIS : TINTA })], { alignment: b.columnas[i].derecha ? AlignmentType.RIGHT : AlignmentType.LEFT, keepNext: conLinea })],
  });
  // La línea gris de debajo de una fila (`subfilas`: lo que no cabe en las columnas: forma de pago, nota...): una celda que ocupa todo el ancho y lleva la raya del conjunto.
  const celdaLinea = (texto) => new TableCell({
    columnSpan: b.columnas.length,
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    margins: { top: 0, bottom: 70, left: 110, right: 110 },
    borders: { top: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE, bottom: borde },
    children: [parrafo([corrida(texto, { size: 15, color: GRIS })])],
  });
  return [
    ...seccion(b.titulo || '', b.nota),
    new Table({
      width: { size: ANCHO_UTIL, type: WidthType.DXA },
      columnWidths: anchos,
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: b.columnas.map((c, i) => celda(c.titulo, i, { cabecera: true })) }),
        ...b.filas.flatMap((f, r) => {
          const linea = b.subfilas?.[r];
          const fila = new TableRow({ cantSplit: true, children: f.map((t, i) => celda(t, i, { conLinea: Boolean(linea) })) });
          return linea ? [fila, new TableRow({ cantSplit: true, children: [celdaLinea(linea)] })] : [fila];
        }),
      ],
    }),
  ];
}

// Puntos de atención: cada línea empieza con "Atención" (ámbar) o "Bien" (verde).
function lista(b) {
  return [
    ...seccion(b.titulo),
    ...b.items.map((item) => parrafo([
      // La etiqueta de color suave de los avisos de la app: fondo claro y texto oscuro del mismo tono.
      corrida(item.nivel === 'aviso' ? ' Atención ' : ' Bien ', { size: 17, bold: true, color: item.nivel === 'aviso' ? '92400E' : '047857', shading: { type: ShadingType.CLEAR, fill: item.nivel === 'aviso' ? 'FEF3C7' : 'D1FAE5', color: 'auto' } }),
      corrida('   ' + item.texto, { size: 19, color: TINTA }),
    ], { spacing: { after: 100 } })),
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

// La ficha de marca de la portada, igual que la del PDF: el logo (letras blancas) sobre un cuadro negro y, al lado, el nombre de la marca. Va en el encabezado de la primera página.
function fichaDeMarca(logo) {
  const alto = 40; // el logo, en píxeles
  const marca = logo
    ? new ImageRun({ type: 'png', data: logo.bytes, transformation: { width: Math.round((logo.ancho / logo.alto) * alto), height: alto }, altText: { title: 'Network Speed', description: 'Logo de Network Speed', name: 'Logo' } })
    : corrida(MARCA, { size: 22, bold: true, color: 'FFFFFF' });
  const anchoLogo = logo ? Math.round((logo.ancho / logo.alto) * alto) * 15 + 560 : 2400; // el logo en veinteavos de punto más el relleno
  return new Table({
    width: { size: anchoLogo + 2600, type: WidthType.DXA },
    columnWidths: [anchoLogo, 2600],
    layout: TableLayoutType.FIXED,
    borders: { ...SIN_BORDES, insideHorizontal: SIN_BORDE, insideVertical: SIN_BORDE },
    rows: [new TableRow({
      cantSplit: true,
      height: { value: 964, rule: HeightRule.EXACT }, // 17 mm, como la ficha del PDF
      children: [
        new TableCell({
          width: { size: anchoLogo, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: '000000', color: 'auto' },
          margins: { top: 0, bottom: 0, left: 280, right: 280 },
          verticalAlign: VerticalAlign.CENTER,
          borders: SIN_BORDES,
          children: [parrafo([marca])],
        }),
        new TableCell({
          width: { size: 2600, type: WidthType.DXA },
          margins: { top: 0, bottom: 0, left: 200, right: 0 },
          verticalAlign: VerticalAlign.CENTER,
          borders: SIN_BORDES,
          children: [
            parrafo([corrida('Network Speed', { size: 24, bold: true, color: TINTA })], { spacing: { after: 0 } }),
            parrafo([corrida('Asignaciones', { size: 17, color: GRIS_TENUE })], { spacing: { after: 0 } }),
          ],
        }),
      ],
    })],
  });
}

// La línea roja corta de la marca bajo el título: una tabla de una celda roja, pequeña y sin bordes.
function lineaRoja() {
  return new Table({
    width: { size: 620, type: WidthType.DXA },
    columnWidths: [620],
    layout: TableLayoutType.FIXED,
    borders: { ...SIN_BORDES, insideHorizontal: SIN_BORDE, insideVertical: SIN_BORDE },
    rows: [new TableRow({
      cantSplit: true,
      height: { value: 56, rule: HeightRule.EXACT },
      children: [new TableCell({ width: { size: 620, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: 'DC2626', color: 'auto' }, borders: SIN_BORDES, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: [parrafo([], { spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, run: { size: 2 } })] })],
    })],
  });
}

// Un párrafo vacío y mínimo para cerrar el encabezado de la primera página: Word exige que un encabezado termine en un párrafo, no en una tabla.
const cierreDeEncabezado = () => parrafo([], { spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, run: { size: 2 } });

// "Network Speed | título del reporte" con una línea fina debajo: el encabezado de las hojas que siguen a la primera (la primera lleva la banda de marca). La hoja tiene el encabezado a
// 0 cm del borde de arriba (como el de la primera), así que este se baja con `spacing.before` hasta donde estaba (500 veinteavos de punto, unos 0,9 cm).
const encabezadoCorrido = (modelo) => parrafo([corrida('Network Speed', { size: 17, bold: true, color: TINTA }), corrida(`   |   ${modelo.titulo}`, { size: 17, color: GRIS_TENUE })], {
  spacing: { before: 500 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RAYA, space: 4 } },
});

function pieDePagina(modelo) {
  return new Footer({
    children: [parrafo([
      // `modelo.pie`: el texto del medio (los documentos para compartir con alguien de fuera no son "de uso interno"; con '' no lleva ninguno).
      corrida([modelo.pie ?? 'Documento de uso interno', `Generado el ${fechaHoraLegible(modelo.generado.en)}`].filter(Boolean).join('   |   '), { size: 15, color: GRIS_TENUE }),
      corrida('\tPágina ', { size: 15, color: GRIS_TENUE }),
      new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: 15, color: GRIS_TENUE }),
      corrida(' de ', { size: 15, color: GRIS_TENUE }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FUENTE, size: 15, color: GRIS_TENUE }),
    ], { tabStops: [{ type: 'right', position: ANCHO_UTIL }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: RAYA, space: 4 } } })],
  });
}

export async function generarDocx(modelo) {
  const logo = await cargarLogo();
  const hijos = [
    parrafo([corrida(modelo.titulo, { size: 44, bold: true, color: TINTA })], { spacing: { before: 300, after: 90 }, keepNext: true }),
    lineaRoja(),
    parrafo([corrida(modelo.subtitulo, { size: 21, color: GRIS })], { spacing: { before: 160, after: 40 } }),
    parrafo([corrida(`Generado el ${fechaHoraLegible(modelo.generado.en)}${modelo.generado.por ? ` por ${modelo.generado.por}` : ''}`, { size: 17, color: GRIS_TENUE })], { spacing: { after: 240 } }),
  ];
  for (const b of modelo.bloques) {
    if (b.tipo === 'cifras') { hijos.push(tarjetas(b.items), parrafo([], { spacing: { after: 120 } })); }
    else if (b.tipo === 'seccion') hijos.push(...seccion(b.titulo));
    else if (b.tipo === 'salto') hijos.push(parrafo([new PageBreak()]));
    else if (b.tipo === 'texto') hijos.push(parrafo(partirNegritas(b.texto, b.negritas).map((p) => corrida(p.texto, { size: 16, color: GRIS, ...(p.negrita ? { bold: true } : {}) })), { spacing: { before: 120, after: 120 } }));
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
      // `titlePage`: la primera página lleva su propio encabezado, la ficha de marca con el logo (igual que la portada del PDF), y las demás el de texto con su línea fina.
      // El cuerpo baja solo cuando el encabezado es más alto que el margen de arriba.
      properties: { titlePage: true, page: { size: { width: ANCHO_PAGINA, height: 16838 }, margin: { top: 1300, bottom: 1200, left: MARGEN_LATERAL, right: MARGEN_LATERAL, header: 620, footer: 500 } } },
      headers: {
        first: new Header({ children: [fichaDeMarca(logo), cierreDeEncabezado()] }),
        default: new Header({ children: [encabezadoCorrido(modelo)] }),
      },
      footers: { first: pieDePagina(modelo), default: pieDePagina(modelo) },
      children: hijos,
    }],
  });
  return Packer.toBlob(documento);
}
