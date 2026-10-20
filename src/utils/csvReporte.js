// CSV de los reportes de gerencia: separador ";" (el que Excel en español espera) y BOM al inicio para que respete tildes y ñ.

// Una celda de texto: sin saltos de línea, y con apóstrofo si empieza como fórmula de Excel (= + - @).
export const celda = (valor) => {
  let texto = String(valor ?? '').replace(/\s+/g, ' ').trim();
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return /[";]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

// secciones: [{ titulo, cabecera: ['Técnico', ...], filas: [[...], ...] }]. `encabezado`: líneas de arriba (título del reporte, periodo...).
export function csvReporte(encabezado, secciones) {
  const lineas = [...encabezado.map((l) => [l]), []];
  for (const { titulo, cabecera, filas } of secciones) {
    lineas.push([titulo], cabecera, ...filas, []);
  }
  return `${String.fromCharCode(0xFEFF)}${lineas.map((fila) => fila.map(celda).join(';')).join('\r\n')}\r\n`;
}

// "Del 13/10/2026 al 19/10/2026" y el técnico elegido, para el encabezado.
export function lineasPeriodo({ desde, hasta }, tecnico) {
  const legible = (dia) => dia.split('-').reverse().join('/');
  return [`Del ${legible(desde)} al ${legible(hasta)}`, tecnico ? `Técnico: ${tecnico}` : 'Todos los técnicos'];
}

// El CSV de un documento de reporte (ver modelosReporte.js): sus cifras y todas sus tablas. Los gráficos no van: sus datos ya están en las tablas.
export function csvDeDocumento(modelo) {
  const secciones = [];
  for (const b of modelo.bloques) {
    if (b.tipo === 'cifras') secciones.push({ titulo: b.titulo || 'Resumen', cabecera: ['Indicador', 'Valor', 'Detalle'], filas: b.items.map((i) => [i.etiqueta, i.valor, i.detalle || '']) });
    else if (b.tipo === 'tabla' && !b.noCsv) secciones.push({ titulo: b.titulo || '', cabecera: b.columnas.map((c) => c.titulo), filas: b.filas });
  }
  return csvReporte([modelo.titulo, modelo.subtitulo], secciones);
}
