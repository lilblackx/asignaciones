import { diaDe } from './totalesMes.js';

// El logo de temporada: en Navidad, el login y el menú lateral (solo esos dos) muestran el logo con el árbol; pasada la fecha vuelven solos al logo de siempre, sin desplegar nada.
// El ícono de la app instalada (manifest, pantalla de inicio, notificaciones) NO cambia nunca con la fecha: sigue siendo icon-192x192.png e icon-512x512.png.
// Las fechas son días de Caracas, ambas inclusive: con NAVIDAD_HASTA = '2027-01-01' el logo de Navidad se ve hasta el 1 de enero y desde el 2 de enero (00:00, hora de Caracas) vuelve el normal.
export const NAVIDAD_DESDE = '2026-11-01';
export const NAVIDAD_HASTA = '2027-01-01';

export const esNavidad = (ahora = Date.now()) => {
  const dia = diaDe(ahora);
  return dia >= NAVIDAD_DESDE && dia <= NAVIDAD_HASTA;
};

const NORMAL = { menu: '/logo-menu.png', menuAncho: 93, menuAlto: 44, menuClase: 'h-11 w-auto', login192: '/icon-192x192.png', login512: '/icon-512x512.png', login512Ancho: 512, login512Alto: 512, login512Difuminado: true };
const NAVIDAD = { menu: '/navidad/logo-menu.png', menuAncho: 70, menuAlto: 48, menuClase: 'h-12 w-auto', login192: '/navidad/login-192.png', login512: '/navidad/login-transparente.png', login512Ancho: 989, login512Alto: 681, login512Difuminado: false, login512Transparente: true };

// `login512Transparente`: el logo de Navidad del login es un PNG sin fondo (se apoya directo en el panel negro, con un brillo rojo suave detrás). `login512Difuminado`: el ícono de siempre lleva una textura de ondas y se funde con el negro del panel con un degradado en los bordes; el de Navidad ya viene sobre negro puro, a 1024 px (nítido en pantallas de alta densidad), y sin degradado para no apagar el árbol.
// Los logos que toca mostrar ahora. Se calcula por hora (las pantallas lo piden en cada pintado y la fecha cambia una vez al día): una pantalla que quedó abierta pasada la medianoche del 2 de enero cambia sola al volver a pintarse.
let ultimo = { hora: -1, logos: NORMAL };
export function logosDeTemporada(ahora = Date.now()) {
  const hora = Math.floor(ahora / 3600000);
  if (hora !== ultimo.hora) ultimo = { hora, logos: esNavidad(ahora) ? NAVIDAD : NORMAL };
  return ultimo.logos;
}
