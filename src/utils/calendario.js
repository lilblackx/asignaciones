// Fechas del calendario de los filtros. Todo en hora local; las fechas viajan como "AAAA-MM-DD" (lo mismo que da un <input type="date">).

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// La semana empieza el lunes.
export const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const dos = (n) => String(n).padStart(2, '0');

// Date o milisegundos -> "2026-10-19".
export const fechaISO = (fecha) => {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

// "2026-10-19" -> { anio, mes (1 a 12), dia }, o null si no es una fecha.
export function partesISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(anio, mes - 1, dia);
  return real.getFullYear() === anio && real.getMonth() === mes - 1 && real.getDate() === dia ? { anio, mes, dia } : null;
}

// "2026-10-19" -> "19/10/2026" (como se escriben las fechas en la app).
export const fechaCorta = (iso) => { const p = partesISO(iso); return p ? `${dos(p.dia)}/${dos(p.mes)}/${p.anio}` : ''; };

// Las casillas de un mes para dibujarlo: huecos (null) hasta el primer día (semana desde el lunes) y luego cada día como "AAAA-MM-DD".
export function casillasDelMes(anio, mes) {
  const primero = new Date(anio, mes - 1, 1);
  const huecos = (primero.getDay() + 6) % 7;
  const dias = new Date(anio, mes, 0).getDate();
  return [...Array(huecos).fill(null), ...Array.from({ length: dias }, (_, i) => `${anio}-${dos(mes)}-${dos(i + 1)}`)];
}

// Mes anterior (-1) o siguiente (+1) a uno dado.
export function mover(anio, mes, pasos) {
  const d = new Date(anio, mes - 1 + pasos, 1);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}
