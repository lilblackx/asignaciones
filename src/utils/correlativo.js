import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';

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

// Instalación todavía sin número ("IS", "IMZ", etc.).
export function esCodigoSinNumero(codigo) {
  return /^I[A-Z]{1,2}$/.test(codigo || '');
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
// `alReservar(transaction, codigo)` (opcional): escribe la orden dentro de la MISMA
// transacción que sube el contador. Si el guardado falla, el número no se consume
// (antes se subía el contador y luego setDoc podía fallar, dejando un salto).
// `ticketRef` (opcional, al numerar una orden existente): se lee dentro de la transacción;
// si otro clic/operador ya la numeró, se reutiliza ese código en vez de gastar otro número.
export async function generarCorrelativo(db, appId, tipoTrabajo, fecha = new Date(), catchUpMax = 0, alReservar = null, ticketRef = null) {
  const prefijo = obtenerPrefijoTipo(tipoTrabajo);
  if (!prefijo) throw new Error(`Tipo de trabajo no reconocido: "${tipoTrabajo}"`);

  const mesCodigo = obtenerCodigoMes(fecha);
  const contadorRef = contadorRefPara(db, appId, prefijo, mesCodigo, fecha.getFullYear());

  return conReintentoPorContencion(() => runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contadorRef);
    if (ticketRef) {
      const ticketSnap = await transaction.get(ticketRef);
      const codigoGuardado = ticketSnap.exists() ? ticketSnap.data().codigo : null;
      if (codigoGuardado && !esCodigoSinNumero(codigoGuardado)) {
        if (alReservar) alReservar(transaction, codigoGuardado);
        return codigoGuardado;
      }
    }
    const actual = snap.exists() ? snap.data().ultimo : 0;
    const siguiente = Math.max(actual, catchUpMax) + 1;
    const codigo = `${prefijo}${mesCodigo}${siguiente}`;
    transaction.set(contadorRef, { ultimo: siguiente, actualizadoEn: Date.now() }, { merge: true });
    if (alReservar) alReservar(transaction, codigo);
    return codigo;
  }));
}

// Dos operadores numerando casi a la vez: la regla del contador ("ultimo" nunca
// retrocede) puede rechazar la transacción que perdió la carrera con "permission-denied"
// en vez de dejar que el SDK la reintente. Se reintenta (releyendo el contador) unas
// veces con una pausa corta antes de mostrar el error. Un rechazo real sigue fallando.
const REINTENTOS_CONTENCION = 5;
async function conReintentoPorContencion(operacion) {
  for (let intento = 1; ; intento++) {
    try {
      return await operacion();
    } catch (err) {
      if (err?.code !== 'permission-denied' || intento >= REINTENTOS_CONTENCION) throw err;
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 40 * intento));
    }
  }
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

// Avisa si un código manual se salta números respecto al último usado (ej. "AO150"
// cuando el último es 15): sincronizarCorrelativoManual subiría el contador a 150 y
// el siguiente automático saldría 151, dejando un salto enorme por un error de tecleo.
// Devuelve null si el código no sigue el patrón automático o no salta; si no, { codigo, ultimo, esperado }.
export async function detectarSaltoManual(db, appId, tickets, tipoTrabajo, codigoManual, fecha = new Date()) {
  const prefijo = obtenerPrefijoTipo(tipoTrabajo);
  const mesCodigo = obtenerCodigoMes(fecha);
  const codigo = (codigoManual || '').toUpperCase().trim();
  const match = /^([A-Z]+)(\d+)$/.exec(codigo);
  if (!match || match[1] !== `${prefijo}${mesCodigo}`) return null;

  const numero = parseInt(match[2], 10);
  const anio = fecha.getFullYear();
  const snap = await getDoc(contadorRefPara(db, appId, prefijo, mesCodigo, anio));
  const ultimoContador = snap.exists() ? snap.data().ultimo : 0;
  const ultimo = Math.max(ultimoContador, maxNumeroExistente(tickets, prefijo, mesCodigo, anio));
  if (!Number.isFinite(numero) || numero <= ultimo + 1) return null;
  return { codigo, ultimo, esperado: ultimo + 1 };
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

// Antes de generar, se pone al día contra los tickets ya existentes (nunca borra el
// "ultimo" guardado; solo lo adelanta si hay un número más alto por ahí, típicamente
// por un código manual de antes de que existiera la sincronización).
export async function generarCorrelativoConCatchUp(db, appId, tickets, tipoTrabajo, fecha = new Date(), alReservar = null, ticketRef = null) {
  const prefijo = obtenerPrefijoTipo(tipoTrabajo);
  const mesCodigo = obtenerCodigoMes(fecha);
  const catchUpMax = maxNumeroExistente(tickets, prefijo, mesCodigo, fecha.getFullYear());
  return generarCorrelativo(db, appId, tipoTrabajo, fecha, catchUpMax, alReservar, ticketRef);
}

// Guarda la orden. Instalación sin número aún ("IS", "IMZ", etc.) con técnico asignado:
// le corresponde numerarse, y el número + el guardado van en una sola transacción
// (si falla el guardado no se gasta número; si otro clic ya la numeró, se reutiliza ese).
// `armarTicket(codigo)` debe ser pura: la transacción puede reintentarla.
export async function guardarConNumeracion(db, appId, tickets, ticketId, codigoActual, tipoTrabajo, tecnicoFinal, fecha, armarTicket) {
  const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'tickets', ticketId.toString());
  const tieneTecnico = Boolean(tecnicoFinal && tecnicoFinal.toString().trim());
  if (!(esCodigoSinNumero(codigoActual) && tieneTecnico)) {
    const ticket = armarTicket(codigoActual);
    await setDoc(ticketRef, ticket);
    return ticket;
  }
  let guardado;
  await generarCorrelativoConCatchUp(db, appId, tickets, tipoTrabajo, fecha, (transaction, codigo) => {
    guardado = armarTicket(codigo);
    transaction.set(ticketRef, guardado);
  }, ticketRef);
  return guardado;
}
