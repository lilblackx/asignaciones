// Arma el PDF de un documento de reporte (ver modelosReporte.js): A4 vertical, encabezado de marca, cifras en tarjetas, gráficos, tablas
// con filas alternadas y pie con la fecha de generación y el número de página. Se carga solo al exportar (jspdf pesa).
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { graficoAImagen } from './graficoImagen.js';
import { fechaHoraLegible } from './formatoFecha.js';

const MARCA = 'ASIGNACIONES NS';
const MARGEN = 15;
const PIE = 14;
const ROJO = [220, 38, 38];
const NEGRO = [11, 11, 11];
const GRIS = [82, 81, 78];
const GRIS_TENUE = [137, 135, 129];
const FONDO = [244, 244, 245];
const BORDE = [225, 224, 217];

// Los textos estándar del PDF (Helvetica) solo traen el alfabeto latino básico: lo demás se reemplaza por algo equivalente.
const limpio = (texto) => String(texto ?? '')
  .replace(/[—–]/g, '-')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/…/g, '...')
  .replace(new RegExp('[^\x20-\x7E\xA0-\xFF]', 'g'), '');

export function generarPdf(modelo) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  const limite = alto - PIE - 4;
  let y = 0;

  const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const nuevaPagina = () => { doc.addPage(); y = MARGEN + 6; };
  const asegurar = (necesario) => { if (y + necesario > limite) nuevaPagina(); };
  const texto = (t, x, yy, opciones) => doc.text(limpio(t), x, yy, opciones);

  // --- Portada: banda de marca, título y datos de generación ---
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, ancho, 24, 'F');
  doc.setFillColor(...ROJO);
  doc.rect(0, 24, ancho, 1.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  texto(MARCA, MARGEN, 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  texto('Reporte de gestión', ancho - MARGEN, 14.5, { align: 'right' });

  y = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  color(NEGRO);
  texto(modelo.titulo, MARGEN, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  color(GRIS);
  const subtitulo = doc.splitTextToSize(limpio(modelo.subtitulo), util);
  doc.text(subtitulo, MARGEN, y);
  y += subtitulo.length * 4.6 + 1;
  doc.setFontSize(8.5);
  color(GRIS_TENUE);
  texto(`Generado el ${fechaHoraLegible(modelo.generado.en)}${modelo.generado.por ? ` por ${modelo.generado.por}` : ''}`, MARGEN, y);
  y += 9;

  // --- Bloques ---
  const cifras = (items) => {
    const n = items.length;
    const gap = 3;
    const w = (util - gap * (n - 1)) / n;
    const h = 24;
    asegurar(h + 4);
    items.forEach((it, i) => {
      const x = MARGEN + i * (w + gap);
      doc.setFillColor(...FONDO);
      doc.setDrawColor(...BORDE);
      doc.roundedRect(x, y, w, h, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      color(GRIS_TENUE);
      doc.text(doc.splitTextToSize(limpio(it.etiqueta).toUpperCase(), w - 6).slice(0, 2), x + 3, y + 4.5);
      // El valor se achica si no cabe en la tarjeta (nombres largos).
      let tam = 16;
      const valor = limpio(it.valor);
      doc.setFontSize(tam);
      while (doc.getTextWidth(valor) > w - 6 && tam > 8) { tam -= 1; doc.setFontSize(tam); }
      color(NEGRO);
      doc.text(valor, x + 3, y + 14.5);
      if (it.detalle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        color(GRIS);
        doc.text(doc.splitTextToSize(limpio(it.detalle), w - 6).slice(0, 2), x + 3, y + 19.2);
      }
    });
    y += h + 7;
  };

  const encabezadoDeSeccion = (titulo, nota) => {
    asegurar(14);
    doc.setFillColor(...ROJO);
    doc.rect(MARGEN, y - 3.4, 1.2, 4.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    color(NEGRO);
    texto(titulo, MARGEN + 3.5, y);
    y += 3;
    if (nota) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      color(GRIS);
      const lineas = doc.splitTextToSize(limpio(nota), util);
      doc.text(lineas, MARGEN, y + 2);
      y += lineas.length * 3.6 + 1;
    }
    y += 3;
  };

  const parrafo = (t) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    color(GRIS);
    const lineas = doc.splitTextToSize(limpio(t), util);
    asegurar(lineas.length * 3.6 + 2);
    doc.text(lineas, MARGEN, y);
    y += lineas.length * 3.6 + 5;
  };

  const tabla = (b) => {
    // El título, el encabezado de la tabla y un par de filas van juntos: si no caben, todo pasa a la página siguiente.
    asegurar(b.filas.length === 0 ? 20 : 40);
    encabezadoDeSeccion(b.titulo || '', b.nota);
    if (b.filas.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      color(GRIS_TENUE);
      texto(b.vacio || 'Sin datos en este periodo.', MARGEN, y);
      y += 9;
      return;
    }
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: MARGEN + 6, bottom: PIE + 4 },
      head: [b.columnas.map((c) => limpio(c.titulo))],
      body: b.filas.map((f) => f.map(limpio)),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, textColor: NEGRO, overflow: 'linebreak' },
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: Object.fromEntries(b.columnas.map((c, i) => [i, { halign: c.derecha ? 'right' : 'left', fontStyle: c.derecha ? 'bold' : i === 0 ? 'bold' : 'normal' }])),
      didParseCell: (data) => {
        // El encabezado de las columnas numéricas también va a la derecha, sobre sus cifras.
        if (data.section === 'head' && b.columnas[data.column.index]?.derecha) data.cell.styles.halign = 'right';
      },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          doc.setDrawColor(...BORDE);
          doc.setLineWidth(0.15);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
    });
    y = doc.lastAutoTable.finalY + 9;
  };

  // Puntos de atención: una viñeta de color por línea (ámbar = alerta, verde = bien), con el texto ajustado al ancho.
  const lista = (b) => {
    encabezadoDeSeccion(b.titulo);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const item of b.items) {
      const lineas = doc.splitTextToSize(`${item.nivel === 'aviso' ? 'Atención: ' : 'Bien: '}${limpio(item.texto)}`, util - 8);
      asegurar(lineas.length * 4.2 + 2.5);
      doc.setFillColor(...(item.nivel === 'aviso' ? [217, 119, 6] : [22, 163, 74]));
      doc.roundedRect(MARGEN, y - 2.6, 2.6, 2.6, 0.5, 0.5, 'F');
      color(NEGRO);
      doc.text(lineas, MARGEN + 6, y);
      y += lineas.length * 4.2 + 2.5;
    }
    y += 4;
  };

  const grafico = (b) => {
    const img = graficoAImagen(b);
    const w = util;
    const h = (img.alto / img.ancho) * w;
    encabezadoDeSeccion(b.titulo, b.subtitulo);
    asegurar(h + 4);
    doc.addImage(img.dataUrl, 'PNG', MARGEN, y, w, h, undefined, 'FAST');
    y += h + 8;
  };

  for (const b of modelo.bloques) {
    if (b.tipo === 'cifras') cifras(b.items);
    else if (b.tipo === 'seccion') encabezadoDeSeccion(b.titulo);
    else if (b.tipo === 'texto') parrafo(b.texto);
    else if (b.tipo === 'tabla' && !b.soloCsv) tabla(b);
    else if (b.tipo === 'lista') lista(b);
    else if (b.tipo === 'grafico') grafico(b);
  }

  // --- Encabezado corrido y pie de cada página ---
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      color(GRIS_TENUE);
      texto(`${MARCA}  |  ${modelo.titulo}`, MARGEN, 9);
      doc.setDrawColor(...ROJO);
      doc.setLineWidth(0.4);
      doc.line(MARGEN, 11, ancho - MARGEN, 11);
    }
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, alto - PIE, ancho - MARGEN, alto - PIE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    color(GRIS_TENUE);
    texto(`${MARCA}  |  Documento de uso interno  |  Generado el ${fechaHoraLegible(modelo.generado.en)}`, MARGEN, alto - PIE + 5);
    texto(`Página ${p} de ${paginas}`, ancho - MARGEN, alto - PIE + 5, { align: 'right' });
  }

  doc.setProperties({ title: modelo.titulo, subject: limpio(modelo.subtitulo), author: modelo.generado.por || MARCA, creator: MARCA });
  return doc.output('blob');
}
