// Baja un documento de reporte (ver modelosReporte.js) como PDF o Word. Las librerías que arman los archivos pesan, así que se cargan
// recién al exportar y no forman parte de lo que descarga la app al abrir.

const FORMATOS = {
  pdf: { extension: 'pdf', cargar: async () => (await import('./exportarPdf.js')).generarPdf },
  docx: { extension: 'docx', cargar: async () => (await import('./exportarDocx.js')).generarDocx },
};

// "tiempo-de-atencion_2026-10-13_2026-10-19" a partir del título del reporte y su periodo.
export function nombreDeArchivo(modelo, rango) {
  const base = modelo.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return rango ? `${base}_${rango.desde}_${rango.hasta}` : `${base}_${new Date(modelo.generado.en).toISOString().slice(0, 10)}`;
}

export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// formato: 'pdf' | 'docx'. Devuelve el blob (y lo descarga salvo que se pida `descargar: false`, para pruebas).
export async function exportarDocumento(modelo, formato, rango, { descargar = true } = {}) {
  const f = FORMATOS[formato];
  if (!f) throw new Error(`Formato desconocido: ${formato}`);
  const generar = await f.cargar();
  const blob = await generar(modelo);
  if (descargar) descargarBlob(blob, `${nombreDeArchivo(modelo, rango)}.${f.extension}`);
  return blob;
}
