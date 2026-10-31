// Uso de Firestore de todo el proyecto, para la pantalla de Estaciones: lo calcula el Worker cada 15 minutos con las métricas de Google Cloud
// (cf-worker/src/usoFirestore.js) y lo guarda en estadoFirestore/actual. Funciones puras: las usan el Worker, la pantalla y scripts/test-uso-firestore.mjs.

// La cuota gratis de cada día (plan Blaze): lo que pasa de aquí se cobra. Se reinicia a la medianoche de la hora del Pacífico.
export const CUOTA_GRATIS = { lecturas: 50000, escrituras: 20000, borrados: 20000 };
// Lo mismo que vigilan las alertas por correo de Google Cloud (Monitoring): mantener iguales.
export const UMBRALES_PROYECTO = { lecturasHora: 5000, escriturasHora: 1000, borradosHora: 500, rechazosHora: 600, cuotaPorcentaje: 80 };
export const ZONA_CUOTA = 'America/Los_Angeles';

// El inicio del día de la cuota (medianoche en la hora del Pacífico) que contiene `ms`.
export function inicioDiaCuota(ms) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONA_CUOTA, year: 'numeric', month: '2-digit', day: '2-digit', timeZoneName: 'longOffset' })
    .formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const desfase = (partes.timeZoneName || 'GMT-08:00').replace('GMT', '') || '+00:00';
  return Date.parse(`${partes.year}-${partes.month}-${partes.day}T00:00:00${desfase}`);
}

const porcentaje = (n, de) => Math.round(((Number(n) || 0) / de) * 100);
const miles = (n) => (Number(n) || 0).toLocaleString('es-VE');

// Lo que anda mal en el proyecto, del más grave al menos: [texto].
//   ultimaHora: { lecturas, escrituras, borrados, rechazos } de los últimos 60 minutos; hoy: { lecturas, escrituras, borrados } desde el inicio del día de la cuota.
export function alertasProyecto({ ultimaHora = {}, hoy = {} } = {}) {
  const alertas = [];
  for (const [clave, nombre] of [['lecturas', 'lecturas'], ['escrituras', 'escrituras'], ['borrados', 'borrados']]) {
    const p = porcentaje(hoy[clave], CUOTA_GRATIS[clave]);
    if (p >= 100) alertas.push(`Hoy ya se pasó la cuota gratis de ${nombre}: ${miles(hoy[clave])} de ${miles(CUOTA_GRATIS[clave])} (lo que sigue se cobra)`);
    else if (p >= UMBRALES_PROYECTO.cuotaPorcentaje) alertas.push(`Hoy va el ${p}% de la cuota gratis de ${nombre} (${miles(hoy[clave])} de ${miles(CUOTA_GRATIS[clave])})`);
  }
  if ((ultimaHora.lecturas || 0) > UMBRALES_PROYECTO.lecturasHora) alertas.push(`${miles(ultimaHora.lecturas)} lecturas en la última hora (lo normal es menos de 1.300)`);
  if ((ultimaHora.escrituras || 0) > UMBRALES_PROYECTO.escriturasHora) alertas.push(`${miles(ultimaHora.escrituras)} escrituras en la última hora (lo normal es menos de 100)`);
  if ((ultimaHora.borrados || 0) > UMBRALES_PROYECTO.borradosHora) alertas.push(`${miles(ultimaHora.borrados)} borrados en la última hora (lo normal es menos de 40)`);
  if ((ultimaHora.rechazos || 0) > UMBRALES_PROYECTO.rechazosHora) alertas.push(`Las reglas rechazaron ${miles(ultimaHora.rechazos)} operaciones en la última hora (lo normal es menos de 40): una pantalla reintenta algo que no tiene permitido`);
  return alertas;
}

// El documento estadoFirestore/actual. `porHora`: [{ hasta, lecturas, escrituras, borrados, rechazos }] de la más vieja a la más nueva (24).
export function armarEstado({ ahoraMs, hoy, inicioDia, porHora = [], escuchadores = null, conexiones = null, error = '' }) {
  const ultima = porHora[porHora.length - 1] || {};
  return {
    actualizadoEn: ahoraMs,
    inicioDia,
    hoy: { lecturas: hoy?.lecturas || 0, escrituras: hoy?.escrituras || 0, borrados: hoy?.borrados || 0 },
    cuota: { ...CUOTA_GRATIS },
    porHora: porHora.slice(-24).map((h) => ({ hasta: h.hasta, lecturas: h.lecturas || 0, escrituras: h.escrituras || 0, borrados: h.borrados || 0, rechazos: h.rechazos || 0 })),
    escuchadores: Number.isFinite(escuchadores) ? Math.round(escuchadores) : null,
    conexiones: Number.isFinite(conexiones) ? Math.round(conexiones) : null,
    alertas: error ? [] : alertasProyecto({ ultimaHora: ultima, hoy }),
    error: String(error || '').slice(0, 300),
  };
}
