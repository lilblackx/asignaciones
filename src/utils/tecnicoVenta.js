// Plantilla de instalación con el técnico ya escrito en "Instalador:": la venta
// la consiguió ese técnico, así que se le asigna directo y no gasta el turno.

const normalizar = (texto) => String(texto || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Devuelve el técnico registrado que corresponde al nombre escrito en la
// plantilla ("Edgar", "EDGAR Montero"...). Solo si hay exactamente uno:
// ante la duda no se asigna nada y queda el flujo normal de turno.
export function buscarTecnicoPorNombre(nombre, technicians) {
  const buscado = normalizar(nombre);
  if (!buscado) return null;
  const coincidencias = (technicians || []).filter((t) => {
    const nombreTecnico = normalizar(t.name);
    if (!nombreTecnico) return false;
    return buscado === nombreTecnico
      || buscado.startsWith(`${nombreTecnico} `)
      || nombreTecnico.startsWith(`${buscado} `);
  });
  return coincidencias.length === 1 ? coincidencias[0] : null;
}

// ¿La orden quedó asignada a quien trajo la venta? (si luego eligieron otro
// técnico a mano, ya no cuenta como venta del técnico).
export const esVentaDelTecnico = (ventaTecnico, tecnico) =>
  Boolean(ventaTecnico) && Boolean(tecnico) && normalizar(ventaTecnico) === normalizar(tecnico);
