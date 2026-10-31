// ¿Debe recargarse esta página por `recargarAntesDe` de config/app (ver hooks/useControlRemoto)? Solo si se abrió antes de esa marca y este
// navegador todavía no se recargó por ella. Un mismo valor recarga como máximo una vez aunque el reloj del equipo esté atrasado (si no, se
// recargaría sin fin y cada recarga leería todo de nuevo). `yaRecargadaCon`: lo guardado en el navegador (null si nada; undefined si no
// hay almacenamiento, y entonces no se recarga: es mejor no obedecer que arriesgar un bucle).
export function debeRecargar(recargarAntesDe, abiertaEn, yaRecargadaCon) {
  const marca = Number(recargarAntesDe);
  if (!Number.isFinite(marca) || marca <= 0 || abiertaEn >= marca) return false;
  return yaRecargadaCon !== undefined && String(yaRecargadaCon ?? '') !== String(marca);
}
