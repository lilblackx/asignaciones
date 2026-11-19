// Arma el PDF de un documento de reporte (ver modelosReporte.js): A4 vertical con el diseño de la app (estilo D): ficha de marca con el logo sobre un cuadro negro redondeado,
// título con la línea roja corta, cifras en tarjetas suaves, tablas claras con rayas finas y avisos en etiquetas de color suave. Pie con la fecha de generación y el número de
// página. Se carga solo al exportar (jspdf pesa).
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { graficoAImagen } from './graficoImagen.js';
import { fechaHoraLegible } from './formatoFecha.js';
import { cargarLogo } from './logoReportes.js';
import { ajustarTabla } from './tablaAngosta.js';
import { partirNegritas } from './textoEnriquecido.js';

const MARCA = 'Network Speed';
const MARGEN = 15;
const PIE = 14;
// Los colores son los de la app (src/index.css): tinta cálida, rojo de marca y el fondo suave de las tarjetas.
const ROJO = [220, 38, 38];
const NEGRO = [28, 25, 23];
const GRIS = [87, 83, 78];
const GRIS_TENUE = [120, 113, 108];
const FONDO = [244, 242, 239];
const BORDE = [231, 229, 228];
// Etiquetas de aviso (los niveles de Aviso en la app): fondo suave y texto oscuro del mismo tono.
const AVISO = { fondo: [254, 243, 199], texto: [146, 64, 14], punto: [217, 119, 6] };
const BIEN = { fondo: [209, 250, 229], texto: [4, 120, 87], punto: [22, 163, 74] };

// Los textos estándar del PDF (Helvetica) solo traen el alfabeto latino básico: lo demás se reemplaza por algo equivalente.
// El espacio sin salto (el de "21,33 $") se cambia por uno común: jsPDF lo mide como dos espacios y lo alineado a la derecha (los montos) quedaba unos 2,4 pt corrido a la izquierda de su encabezado.
const limpio = (texto) => String(texto ?? '')
  .replaceAll(String.fromCharCode(160), ' ')
  .replace(/[—–]/g, '-')
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/…/g, '...')
  .replace(new RegExp('[^\x20-\x7E\xA0-\xFF]', 'g'), '');

export async function generarPdf(modelo) {
  const logo = await cargarLogo();
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

  // --- Portada: ficha de marca, título con la línea roja corta y datos de generación ---
  // El logo (letras blancas, sin fondo) va sobre un cuadro negro de esquinas redondeadas, como en el menú de la app, con el nombre de la marca al lado.
  const altoFicha = 17;
  const altoLogo = 10.5;
  const relleno = (altoFicha - altoLogo) / 2;
  const anchoLogo = logo ? (logo.ancho / logo.alto) * altoLogo : 34;
  const anchoFicha = anchoLogo + relleno * 2;
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(MARGEN, 11, anchoFicha, altoFicha, 3.4, 3.4, 'F');
  if (logo) {
    doc.addImage(logo.bytes, 'PNG', MARGEN + relleno, 11 + relleno, anchoLogo, altoLogo, 'logo', 'FAST');
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    texto(MARCA, MARGEN + relleno, 11 + altoFicha / 2 + 1.2);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  color(NEGRO);
  texto('Network Speed', MARGEN + anchoFicha + 4, 18.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  color(GRIS_TENUE);
  texto('Asignaciones', MARGEN + anchoFicha + 4, 23.6);
  y = 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  color(NEGRO);
  texto(modelo.titulo, MARGEN, y);
  // La línea roja corta de la marca, bajo el título (como en los encabezados de la app).
  doc.setFillColor(...ROJO);
  doc.roundedRect(MARGEN, y + 2.6, 11, 1.1, 0.55, 0.55, 'F');
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  color(GRIS);
  const subtitulo = doc.splitTextToSize(limpio(modelo.subtitulo), util);
  doc.text(subtitulo, MARGEN, y);
  y += subtitulo.length * 4.6 + 1;
  doc.setFontSize(8.5);
  color(GRIS_TENUE);
  texto(`Generado el ${fechaHoraLegible(modelo.generado.en)}${modelo.generado.por ? ` por ${modelo.generado.por}` : ''}`, MARGEN, y);
  y += 10;

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
      doc.roundedRect(x, y, w, h, 3.4, 3.4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      color(GRIS);
      doc.text(doc.splitTextToSize(limpio(it.etiqueta), w - 6).slice(0, 2), x + 3.2, y + 5);
      // El valor se achica si no cabe en la tarjeta (nombres largos).
      let tam = 16;
      const valor = limpio(it.valor);
      doc.setFontSize(tam);
      while (doc.getTextWidth(valor) > w - 6 && tam > 8) { tam -= 1; doc.setFontSize(tam); }
      color(NEGRO);
      doc.text(valor, x + 3.2, y + 14.8);
      if (it.detalle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        color(GRIS);
        doc.text(doc.splitTextToSize(limpio(it.detalle), w - 6).slice(0, 2), x + 3.2, y + 19.4);
      }
    });
    y += h + 10;
  };

  const encabezadoDeSeccion = (titulo, nota) => {
    asegurar(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    color(NEGRO);
    texto(titulo, MARGEN, y);
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

  // Un párrafo con fragmentos en negrita (jsPDF no mezcla tipos de letra en una misma línea): se parte en palabras, se miden con su tipo de letra, se reparten en líneas y cada palabra se pinta en su sitio.
  const parrafoConNegritas = (partes) => {
    doc.setFontSize(8);
    color(GRIS);
    const palabras = [];
    let hayEspacio = false;
    for (const p of partes) {
      for (const trozo of limpio(p.texto).split(/(\s+)/)) {
        if (trozo === '') continue;
        if (/^\s+$/.test(trozo)) { hayEspacio = true; continue; }
        palabras.push({ t: trozo, negrita: p.negrita, espacio: hayEspacio && palabras.length > 0 });
        hayEspacio = false;
      }
    }
    doc.setFont('helvetica', 'normal');
    const espacio = doc.getTextWidth(' ');
    const lineas = [];
    let linea = [];
    let usado = 0;
    for (const w of palabras) {
      doc.setFont('helvetica', w.negrita ? 'bold' : 'normal');
      const ancho = doc.getTextWidth(w.t);
      if (linea.length && usado + (w.espacio ? espacio : 0) + ancho > util) { lineas.push(linea); linea = []; usado = 0; }
      const antes = linea.length && w.espacio ? espacio : 0;
      linea.push({ ...w, x: usado + antes });
      usado += antes + ancho;
    }
    if (linea.length) lineas.push(linea);
    const paso = doc.getLineHeight() / doc.internal.scaleFactor;
    asegurar(lineas.length * 3.6 + 2);
    // Cada palabra se pinta en su sitio medido (no por tramos): así una diferencia de ancho de la letra del visor no se acumula en una línea larga y no se come el espacio junto a la negrita.
    lineas.forEach((l, i) => l.forEach((w) => {
      doc.setFont('helvetica', w.negrita ? 'bold' : 'normal');
      doc.text(w.t, MARGEN + w.x, y + i * paso);
    }));
    doc.setFont('helvetica', 'normal');
    y += lineas.length * 3.6 + 5;
  };

  const parrafo = (t, negritas) => {
    if (negritas?.length) { parrafoConNegritas(partirNegritas(t, negritas)); return; }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    color(GRIS);
    const lineas = doc.splitTextToSize(limpio(t), util);
    asegurar(lineas.length * 3.6 + 2);
    doc.text(lineas, MARGEN, y);
    y += lineas.length * 3.6 + 5;
  };

  const tabla = (original) => {
    // El título, el encabezado de la tabla y un par de filas van juntos: si no caben, todo pasa a la página siguiente.
    asegurar(original.filas.length === 0 ? 20 : 40);
    encabezadoDeSeccion(original.titulo || '', original.nota);
    if (original.filas.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      color(GRIS_TENUE);
      texto(original.vacio || 'Sin datos en este periodo.', MARGEN, y);
      y += 9;
      return;
    }
    // Ninguna columna debe partir sus palabras ("Instalacione/s", "Órden/es"): cada una mide lo que su palabra más larga (con tope, para que un texto sin espacios no deje sin sitio a las demás)
    // y, si todas juntas no caben, la letra baja de 8,5 a un mínimo de 6,5. Lo que queda libre se lo reparten las columnas de texto, que sí pueden saltar de línea.
    // RELLENO: los bordes de la celda (2,5 por lado) y un poco más, para que una palabra que justo cabe no salte de línea por un redondeo.
    const RELLENO = 5.4;
    const TOPE_MINIMO = 38;
    const LETRA_MAXIMA = 8.5;
    const LETRA_COMODA = 7.5;
    const LETRA_MINIMA = 6.5;
    // Solo el espacio común separa palabras: el espacio sin salto de "1.010.845,61 Bs" las une, y la columna debe dar cabida a las dos partes juntas.
    const medida = (palabra) => doc.getTextWidth(limpio(palabra));
    // Si no cabe con las palabras enteras ni a una letra cómoda (7,5), las columnas que sobran pasan a una línea gris debajo de cada fila (ver utils/tablaAngosta): mejor eso que una letra diminuta.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(LETRA_COMODA);
    const b = ajustarTabla(original, { ancho: medida, util, relleno: RELLENO, tope: TOPE_MINIMO });
    const minimosA = (fuente) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fuente);
      return b.columnas.map((c, i) => {
        const palabras = [c.titulo, ...b.filas.map((f) => f[i])].flatMap((t) => String(t ?? '').split(/[ \t\r\n]+/)).filter(Boolean);
        return Math.min(TOPE_MINIMO, Math.max(0, ...palabras.map(medida)) + RELLENO);
      });
    };
    let fuente = LETRA_MAXIMA;
    let minimos = minimosA(fuente);
    while (minimos.reduce((suma, m) => suma + m, 0) > util && fuente > LETRA_MINIMA) {
      fuente -= 0.5;
      minimos = minimosA(fuente);
    }
    // Último recurso (casi imposible tras ajustarTabla): si aun así no caben se reducen en proporción, para que la tabla nunca pase del margen; una palabra podría partirse.
    const sumaMinimos = minimos.reduce((suma, m) => suma + m, 0);
    if (sumaMinimos > util) minimos = minimos.map((m) => (m * util) / sumaMinimos);
    // Las filas con una línea gris debajo (`subfilas`, lo que no cabe en las columnas: forma de pago, nota...) forman una sola pieza: la línea no lleva raya encima y la raya va al final del conjunto.
    const conLinea = new Set();
    const cuerpo = [];
    b.filas.forEach((f, r) => {
      const fondo = [255, 255, 255];
      cuerpo.push(f.map((t) => ({ content: limpio(t), styles: { fillColor: fondo } })));
      const linea = b.subfilas?.[r];
      if (linea) {
        conLinea.add(cuerpo.length - 1);
        cuerpo.push([{ content: limpio(linea), colSpan: b.columnas.length, styles: { fillColor: fondo, textColor: GRIS, fontStyle: 'normal', halign: 'left', fontSize: Math.max(6, fuente - 1), cellPadding: { top: 0, bottom: 2.2, left: 2.5, right: 2.5 } } }]);
      }
    });
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN, top: MARGEN + 6, bottom: PIE + 4 },
      head: [b.columnas.map((c) => limpio(c.titulo).toUpperCase())],
      body: cuerpo,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: fuente, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, textColor: NEGRO, overflow: 'linebreak' },
      headStyles: { fillColor: FONDO, textColor: GRIS, fontStyle: 'bold', fontSize: fuente - 0.7, valign: 'middle' },
      columnStyles: Object.fromEntries(b.columnas.map((c, i) => [i, { halign: c.derecha ? 'right' : 'left', fontStyle: c.derecha ? 'bold' : i === 0 ? 'bold' : 'normal', minCellWidth: minimos[i] }])),
      didParseCell: (data) => {
        // Cada encabezado se alinea igual que los datos de su columna: a la derecha las numéricas (sobre sus cifras) y a la izquierda las de texto. Ninguno queda centrado.
        if (data.section === 'head') data.cell.styles.halign = b.columnas[data.column.index]?.derecha ? 'right' : 'left';
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && !conLinea.has(data.row.index)) {
          doc.setDrawColor(...BORDE);
          doc.setLineWidth(0.15);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
    });
    y = doc.lastAutoTable.finalY + 9;
  };

  // Puntos de atención: cada línea empieza con una etiqueta de color suave ("Atención" en ámbar, "Bien" en verde), como los avisos de la app, y el texto ajustado al ancho.
  const lista = (b) => {
    encabezadoDeSeccion(b.titulo);
    for (const item of b.items) {
      const tono = item.nivel === 'aviso' ? AVISO : BIEN;
      const etiqueta = item.nivel === 'aviso' ? 'Atención' : 'Bien';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const anchoEtiqueta = doc.getTextWidth(etiqueta) + 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lineas = doc.splitTextToSize(limpio(item.texto), util - anchoEtiqueta - 3);
      asegurar(lineas.length * 4.2 + 3);
      doc.setFillColor(...tono.fondo);
      doc.roundedRect(MARGEN, y - 3.7, anchoEtiqueta, 5.2, 2.6, 2.6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...tono.texto);
      doc.text(etiqueta, MARGEN + 2.5, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      color(NEGRO);
      doc.text(lineas, MARGEN + anchoEtiqueta + 3, y);
      y += lineas.length * 4.2 + 3;
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
    else if (b.tipo === 'salto') { if (y > MARGEN + 8) nuevaPagina(); }
    else if (b.tipo === 'texto') parrafo(b.texto, b.negritas);
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
      texto(`Network Speed  |  ${modelo.titulo}`, MARGEN, 9);
      doc.setDrawColor(...BORDE);
      doc.setLineWidth(0.3);
      doc.line(MARGEN, 11, ancho - MARGEN, 11);
    }
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, alto - PIE, ancho - MARGEN, alto - PIE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    color(GRIS_TENUE);
    // `modelo.pie`: el texto del medio (los documentos para compartir con alguien de fuera no son "de uso interno"; con '' no lleva ninguno).
    texto([MARCA, modelo.pie ?? 'Documento de uso interno', `Generado el ${fechaHoraLegible(modelo.generado.en)}`].filter(Boolean).join('  |  '), MARGEN, alto - PIE + 5);
    texto(`Página ${p} de ${paginas}`, ancho - MARGEN, alto - PIE + 5, { align: 'right' });
  }

  doc.setProperties({ title: modelo.titulo, subject: limpio(modelo.subtitulo), author: modelo.generado.por || MARCA, creator: MARCA });
  return doc.output('blob');
}
