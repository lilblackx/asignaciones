// Las tasas BCV del dólar de los últimos 7 días, para que Finanzas pueda pagar con la de un día anterior (los pagos son semanales y a veces se pagan el martes con la tasa del lunes).
// Se guardan en config/tasasDolar como { dias: { 'AAAA-MM-DD': tasa, ... }, actualizadoEn, actualizadoPor }: una tasa por día hábil (el BCV no publica sábados ni domingos), solo de los últimos
// 7 días de calendario (hoy y los 6 anteriores); lo más viejo se borra al guardar. Los días son de Caracas (UTC-4 todo el año). Módulo sin dependencias: lo usan el hook, la pantalla y las pruebas.

export const DIAS_GUARDADOS = 7;

const HORA_MS = 3600000;
const DIA_MS = 24 * HORA_MS;
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const NOMBRES_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const NOMBRES_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const redondear = (n) => Math.round(Number(n) * 100) / 100;

// 'AAAA-MM-DD' del instante `ms` en hora de Caracas.
export const diaCaracas = (ms) => new Date(ms - 4 * HORA_MS).toISOString().slice(0, 10);

const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);

// El día más antiguo que se guarda estando en `hoy`.
export const primerDiaGuardado = (hoy) => sumarDias(hoy, -(DIAS_GUARDADOS - 1));

const diaDeSemana = (dia) => new Date(`${dia}T12:00:00Z`).getUTCDay();
const diaMes = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
// "lun 09/11" y "lunes 09/11".
export const etiquetaDia = (dia) => `${NOMBRES_CORTOS[diaDeSemana(dia)]} ${diaMes(dia)}`;
export const etiquetaDiaLarga = (dia) => `${NOMBRES_LARGOS[diaDeSemana(dia)]} ${diaMes(dia)}`;

// Las tasas del historial de la API (ve.dolarapi.com/v1/historicos/dolares/oficial: [{ fuente, promedio, fecha: 'AAAA-MM-DD' }]) que caen en la ventana de 7 días: { dia: tasa }.
// Se descartan las que no son oficiales, las de otros días fuera de la ventana (incluidas las publicadas para mañana) y las que no traen una tasa usable.
export function desdeHistorico(lista, hoy) {
  const dias = {};
  if (!Array.isArray(lista)) return dias;
  const desde = primerDiaGuardado(hoy);
  for (const e of lista) {
    const tasa = Number(e?.promedio ?? e?.venta);
    const dia = String(e?.fecha ?? '');
    if (e?.fuente !== 'oficial' || !FORMATO_DIA.test(dia) || !(tasa > 0) || dia < desde || dia > hoy) continue;
    dias[dia] = redondear(tasa);
  }
  return dias;
}

// La tasa que la API da ahora (fecha: cuándo la publicó el BCV, en ms) como { dia: tasa }; vacío si no hay tasa.
export function delMomento(tasa, fecha, hoy) {
  if (!(Number(tasa) > 0)) return {};
  const dia = Number.isFinite(fecha) && fecha > 0 ? diaCaracas(fecha) : hoy;
  return dia > hoy ? {} : { [dia]: redondear(tasa) };
}

// Une lo guardado con lo nuevo: cada día se queda con la tasa que ya tenía (lo guardado no se pisa: es la que se pudo haber usado para pagar), salvo hoy, que se actualiza si cambió. Lo que
// queda fuera de la ventana de 7 días se descarta. `hayCambios`: ¿hay algo que guardar (días nuevos, hoy distinto o días viejos que borrar)?
export function fusionarDias(guardados, nuevos, hoy) {
  const desde = primerDiaGuardado(hoy);
  const previos = {};
  for (const [dia, tasa] of Object.entries(guardados && typeof guardados === 'object' ? guardados : {})) {
    if (FORMATO_DIA.test(dia) && Number(tasa) > 0) previos[dia] = Number(tasa);
  }
  const dias = {};
  for (const [dia, tasa] of Object.entries(previos)) if (dia >= desde && dia <= hoy) dias[dia] = redondear(tasa);
  for (const [dia, tasa] of Object.entries(nuevos || {})) {
    if (!(Number(tasa) > 0) || dia < desde || dia > hoy) continue;
    if (!(dia in dias) || (dia === hoy && dias[dia] !== redondear(tasa))) dias[dia] = redondear(tasa);
  }
  const claves = Object.keys(dias).sort();
  const hayCambios = claves.length !== Object.keys(previos).length || claves.some((d) => previos[d] !== dias[d]);
  return { dias, hayCambios };
}

const textoTasa = (tasa) => tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Las opciones del selector, la más reciente primero: [{ dia, tasa, esHoy, etiqueta, texto }]. `texto`: "mié 11/11 (hoy) · 901,62 Bs". Solo hasta hoy y dentro de los 7 días.
export function opcionesDeTasa(dias, hoy) {
  const desde = primerDiaGuardado(hoy);
  return Object.entries(dias || {})
    .filter(([dia, tasa]) => FORMATO_DIA.test(dia) && dia >= desde && dia <= hoy && Number(tasa) > 0)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([dia, tasa]) => {
      const esHoy = dia === hoy;
      return { dia, tasa: Number(tasa), esHoy, etiqueta: etiquetaDia(dia), texto: `${etiquetaDia(dia)}${esHoy ? ' (hoy)' : ''} · ${textoTasa(Number(tasa))} Bs` };
    });
}

// La opción elegida por su día; si no está (o no se eligió ninguna), la más reciente. null si no hay ninguna.
export const opcionElegida = (opciones, dia) => opciones.find((o) => o.dia === dia) || opciones[0] || null;
