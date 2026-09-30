const DIA_MS = 86400000;

// Ventana en la que una orden finalizada del mismo cliente cuenta como reincidencia,
// y umbral dentro de esa ventana para marcarla como "muy reciente".
export const VENTANA_REINCIDENCIA_DIAS = 30;
export const REINCIDENCIA_MUY_RECIENTE_DIAS = 7;

const ESTADOS_ABIERTOS = ['PENDIENTE', 'PRE-FINALIZADO', 'PRE-FINALIZADA'];

// La cédula se guarda con puntos ("18.395.753"); se compara solo por dígitos.
const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');

function fechaOrden(ticket) {
  if (ticket.createdAt) return ticket.createdAt;
  const [d, m, y] = String(ticket.fecha || '').split('/');
  const ms = new Date(y, m - 1, d).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export const aplanarArchivados = (reports) => reports.flatMap(r => r.ticketsDetalle || []);

// Busca lo que ya hay de este cliente. `activos` son las órdenes vivas y
// `archivados` las de cierres de día ya cargados (solo los reportes más
// recientes; un cierre más viejo que eso no se ve aquí).
//   abiertas:  PENDIENTE / PRE-FINALIZADO (misma cédula)
//   recientes: FINALIZADO dentro de la ventana, la más nueva primero
export function buscarHistorialCliente(cedula, activos, archivados = [], ahora = Date.now()) {
  const digitos = soloDigitos(cedula);
  if (digitos.length < 5) return { abiertas: [], recientes: [] };

  const vistos = new Set();
  const abiertas = [];
  const recientes = [];
  for (const t of [...activos, ...archivados]) {
    if (soloDigitos(t.cedula) !== digitos) continue;
    if (t.id !== undefined) {
      if (vistos.has(t.id)) continue;
      vistos.add(t.id);
    }
    if (ESTADOS_ABIERTOS.includes(t.estado)) {
      abiertas.push(t);
    } else if (t.estado === 'FINALIZADO') {
      const cuando = fechaOrden(t);
      if (cuando === null) continue;
      const dias = Math.floor((ahora - cuando) / DIA_MS);
      if (dias <= VENTANA_REINCIDENCIA_DIAS) recientes.push({ ticket: t, dias: Math.max(0, dias), cuando });
    }
  }
  recientes.sort((a, b) => b.cuando - a.cuando);
  return { abiertas, recientes };
}

export const textoHace = (dias) => (dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`);
