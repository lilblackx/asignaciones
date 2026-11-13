import { useEffect, useState } from 'react';
import { urlDeFoto } from '../lib/fotosOrden';

// Las direcciones para mostrar las fotos de una orden (ver utils/detallesOrden), pedidas a Cloud Storage con la sesión de quien mira: { ruta: url }, con `false` si la foto ya no está (el bucket las borra a los 60 días) o no se
// pudo leer, y sin la ruta mientras carga. Con una lista vacía no pide nada: así quien la usa decide cuándo empezar (al abrir la sección, al tocar un botón...) y no se descarga de más.
export function useUrlsDeFotos(rutas) {
  const [urls, setUrls] = useState({});
  const clave = rutas.join('|');
  useEffect(() => {
    let vigente = true;
    rutas.forEach((ruta) => {
      urlDeFoto(ruta)
        .then((url) => { if (vigente) setUrls((previas) => ({ ...previas, [ruta]: url })); })
        .catch((error) => {
          // storage/object-not-found: ya la borró el bucket. Otro error (sin permiso, sin conexión) también deja el aviso, sin romper la pantalla.
          if (error?.code !== 'storage/object-not-found') console.warn('No se pudo cargar una foto de la orden:', error);
          if (vigente) setUrls((previas) => ({ ...previas, [ruta]: false }));
        });
    });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave` representa a `rutas`
  }, [clave]);
  return urls;
}
