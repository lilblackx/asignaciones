// Logo de Navidad: se muestra en la pantalla de entrada y en el menú hasta el 2 de enero de 2027 (hora de Venezuela, UTC-4) y después vuelve solo el de siempre.
// Las imágenes están en public/navidad. No cambia el ícono de la app instalada, el de las notificaciones ni los PDF.
// Para otra temporada: cambiar FIN_NAVIDAD y las imágenes; pasada la fecha se pueden borrar public/navidad y este archivo.
export const FIN_NAVIDAD = Date.UTC(2027, 0, 2, 4, 0, 0);

export const esNavidad = (ahora = Date.now()) => ahora < FIN_NAVIDAD;

// La ruta del logo: el de Navidad mientras dure la temporada, si no el normal.
export const logoDeTemporada = (normal, navidad, ahora = Date.now()) => (esNavidad(ahora) ? navidad : normal);
