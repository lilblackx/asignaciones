// El logo de la empresa (sin fondo, recortado: public/logo-reportes.png) para los PDF y Word de los reportes. Sus letras son blancas, así que va sobre
// la banda negra de la portada. Se baja una vez al exportar; si no se puede (sin conexión, o fuera del navegador), el reporte sale igual, con el texto de
// la marca en su lugar.
let enMemoria = null;

// { bytes: Uint8Array del PNG, ancho, alto } (en píxeles) o null.
export async function cargarLogo() {
  if (enMemoria) return enMemoria;
  try {
    const respuesta = await fetch(`${import.meta.env?.BASE_URL ?? '/'}logo-reportes.png`);
    if (!respuesta.ok) return null;
    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    // Las medidas están en la cabecera del PNG (bytes 16 a 23).
    const vista = new DataView(bytes.buffer);
    enMemoria = { bytes, ancho: vista.getUint32(16), alto: vista.getUint32(20) };
    return enMemoria;
  } catch {
    return null;
  }
}
