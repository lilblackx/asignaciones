import { doc, runTransaction } from 'firebase/firestore';

// Códigos de mes: letra única salvo los 6 meses que colisionan
// (Marzo/Mayo, Junio/Julio, Abril/Agosto)
const MESES_CODIGO = [
  'E',  // 0  Enero
  'F',  // 1  Febrero
  'MZ', // 2  Marzo
  'AB', // 3  Abril
  'MY', // 4  Mayo
  'JN', // 5  Junio
  'JL', // 6  Julio
  'AG', // 7  Agosto
  'S',  // 8  Septiembre
  'O',  // 9  Octubre
  'N',  // 10 Noviembre
  'D',  // 11 Diciembre
];

function normalizarTipo(tipoTrabajo) {
  return (tipoTrabajo || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .toUpperCase()
    .trim();
}

// Regla de negocio (confirmada): INSTALACIÓN -> I (sin número hasta asignar técnico);
// MUDANZA y RETIRO EQUIPO -> V (numerado al crear, igual que AVERÍA);
// cualquier otro tipo (AVERÍA, RECONEXIÓN, VALIDACION NAP, GARANTIA, LOW SIGNAL) -> A por defecto.
export function obtenerPrefijoTipo(tipoTrabajo) {
  const clave = normalizarTipo(tipoTrabajo);
  if (clave.includes('INSTAL')) return 'I';
  if (clave.includes('MUDANZA') || clave.includes('RETIRO')) return 'V';
  return 'A';
}

export function obtenerCodigoMes(fecha = new Date()) {
  return MESES_CODIGO[fecha.getMonth()];
}

// Código base SIN número (ej. "IS") — se usa al crear una instalación sin técnico,
// que todavía no debe tener correlativo numérico asignado.
export function generarCodigoBase(tipoTrabajo, fecha = new Date()) {
  const prefijo = obtenerPrefijoTipo(tipoTrabajo);
  if (!prefijo) throw new Error(`Tipo de trabajo no reconocido: "${tipoTrabajo}"`);
  return `${prefijo}${obtenerCodigoMes(fecha)}`;
}

// El año va en el ID del contador (no en el código visible) para que
// "AS1" de septiembre 2026 no siga la cuenta de septiembre 2027.
function contadorRefPara(db, appId, prefijo, mesCodigo, anio) {
  const contadorId = `${prefijo}_${mesCodigo}_${anio}`;
  return doc(db, 'artifacts', appId, 'public', 'data', 'counters', contadorId);
}

// Genera el correlativo CON número, usando una transacción atómica.
// Úsalo para avería/visita al crear, y para instalación al asignar técnico.
// `catchUpMax`: el número más alto visto entre los tickets ya existentes para este
// prefijo+mes+año (por si hubo códigos manuales de antes de que existiera la
// sincronización automática, y el contador guardado quedó atrasado respecto a ellos).
export async function generarCorrelativo(db, appId, tipoTrabajo, fecha = new Date(), catchUpMax = 0) {
  const prefijo = obtenerPrefijoTipo(tipoTrabajo);
  if (!prefijo) throw new Error(`Tipo de trabajo no reconocido: "${tipoTrabajo}"`);

  const mesCodigo = obtenerCodigoMes(fecha);
  const contadorRef = contadorRefPara(db, appId, prefijo, mesCodigo, fecha.getFullYear());

  const siguienteNumero = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contadorRef);
    const actual = snap.exists() ? snap.data().ultimo : 0;
    const siguiente = Math.max(actual, catchUpMax) + 1;
    transaction.set(contadorRef, { ultimo: siguiente, actualizadoEn: Date.now() }, { merge: true });
    return siguiente;
  });

  return `${prefijo}${mesCodigo}${siguienteNumero}`;
}

// Busca, entre tickets ya existentes, el número más alto usado para este
// prefijo+mes+año (por ejemplo "AS26" -> 26), sin importar si se generó
// automático o se tecleó a mano.
export function maxNumeroExistente(tickets, prefijo, mesCodigo, anio) {
  const patron = new RegExp(`^${prefijo}${mesCodigo}(\\d+)$`);
  return (tickets || []).reduce((max, t) => {
    if (!t?.codigo) return max;
    const match = patron.exec(t.codigo.toString().toUpperCase().trim());
    if (!match) return max;
    const anioTicket = t.createdAt ? new Date(t.createdAt).getFullYear() : anio;
    if (anioTicket !== anio) return max;
    return Math.max(max, parseInt(match[1], 10));
  }, 0);
}

// Si un código se escribió a mano y sigue el mismo patrón que generaría el
// automático (ej. "AS4" un día de AVERÍA en septiembre), sincroniza el contador
// a ese número para que el próximo automático continúe la secuencia real,
// en vez de ignorar por completo lo que se tecleó a mano.
export async function sincronizarCorrelativoManual(db, appId, tipoTrabajo, codigoManual, fecha = new Date()) {
  const prefijo = obtenerPrefijoTipo(tipoTrabajo);
  const mesCodigo = obtenerCodigoMes(fecha);
  const match = /^([A-Z]+)(\d+)$/.exec((codigoManual || '').toUpperCase().trim());
  if (!match || match[1] !== `${prefijo}${mesCodigo}`) return;

  const numero = parseInt(match[2], 10);
  if (!Number.isFinite(numero) || numero <= 0) return;

  const contadorRef = contadorRefPara(db, appId, prefijo, mesCodigo, fecha.getFullYear());
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contadorRef);
    const actual = snap.exists() ? snap.data().ultimo : 0;
    if (numero > actual) {
      transaction.set(contadorRef, { ultimo: numero, actualizadoEn: Date.now() }, { merge: true });
    }
  });
}
