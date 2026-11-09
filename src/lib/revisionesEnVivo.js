import { collection, documentId, getDocsFromCache, query, where } from 'firebase/firestore';
import { getCountFromServer, getDocsFromServer, onSnapshot } from './medidorFirestore.js';
import { db, appId } from './firebase';
import { planDeLectura } from '../utils/ventanaLectura.js';
import { idsPagadas, marcadorDeInicio, marcadorDeLectura, pagadasCoinciden } from '../utils/pagadasRevision.js';

// Lo que Revisión de órdenes lee de Firestore vive aquí, fuera de la pantalla, y se queda leyendo mientras la sesión siga abierta. Si viviera en la pantalla, cada vez que se entra a Revisión después
// de más de 30 minutos Firestore cobraría de nuevo todos los documentos de la ventana (más de 200 hoy y crecen cada día). Son cuatro lecturas:
//   - lo no pagado, de cualquier fecha y en vivo: las aprobadas sin pagar (`pendientePago`) y las retenidas, excluidas o pendientes con corrección. Es lo que de verdad se trabaja y son pocas.
//   - lo pagado: no se relee entero. Se parte de lo que el navegador ya tiene guardado y al servidor solo se le piden los pagos nuevos (el `pagoId` lleva la hora del pago, ver utils/pagadasRevision).
//   - las filas de VN y TA de la ventana, en vivo.
// La caché del navegador puede quedarse corta (se borra al cerrar sesión, se limpia sola cuando se llena), así que no se confía a ciegas en ella: al empezar, y cada 10 minutos al entrar a Revisión,
// el servidor cuenta cuántas órdenes pagadas hay (una lectura) y si no coincide con lo que aquí se cree se vuelve a leer todo lo pagado; y antes de cambiar cualquier orden se confirma con el
// servidor que no esté ya pagada (pagadasEnServidor). Las reglas de Firestore además rechazan tocar una orden pagada. Se abre al entrar por primera vez a Revisión y se corta al cerrar la sesión (que
// recarga la página); al cambiar de usuario o de día se empieza de nuevo (ver planDeLectura).
const coleccion = (nombre) => collection(db, 'artifacts', appId, 'public', 'data', nombre);
const revisiones = () => coleccion('revisionPagos');
const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const llenar = (mapa, snap) => {
  mapa.clear();
  for (const d of snap.docs) mapa.set(d.id, { id: d.id, ...d.data() });
};

const CADA_CUANTO_VALIDAR_MS = 10 * 60 * 1000;
const ESPERA_ANTES_DE_RELEER_MS = 1500;

const VACIO = { uid: '', dia: '', ventana: null, sinPagar: [], pagadas: [], registros: [], error: false };
let estado = VACIO;
const oyentes = new Set();

// Lo no pagado
let uidSinPagar = '';
let bajasSinPagar = [];
const docsAprobadas = new Map();
const docsOtras = new Map();
// Las filas de VN y TA de la ventana
let bajaRegistros = null;
// Lo pagado: `semilla` es lo que se conocía de antes (caché o relectura completa) y `vivas` lo que llega en vivo; clave de la orden -> pagoId
let inicioPagos = '';
let generacionPagos = 0;
let bajaPagos = null;
let semilla = new Map();
let vivas = new Map();
let validadaEn = 0;
let validando = false;
let pagosCargados = false;   // ya llegó lo primero de los pagos: antes no hay nada que confirmar

const poner = (parcial) => {
  estado = { ...estado, ...parcial };
  oyentes.forEach((avisar) => avisar());
};

// Junta lo no pagado y lo pagado en la foto que ve la pantalla. Una orden con el pago anulado vuelve a salir sin pagar y eso gana sobre lo que la caché recuerde.
function recalcular() {
  const docs = new Map([...docsAprobadas, ...docsOtras]);
  const sinPagar = [];
  const conPago = new Map();
  for (const [id, d] of docs) {
    if (d.pagoId) conPago.set(id, d.pagoId);
    else sinPagar.push(id);
  }
  poner({ sinPagar: [...docs.values()], pagadas: idsPagadas(semilla, vivas, conPago, sinPagar, inicioPagos) });
}

function asegurarSinPagar(uid) {
  if (uidSinPagar === uid && bajasSinPagar.length > 0) return;
  bajasSinPagar.forEach((baja) => baja());
  docsAprobadas.clear();
  docsOtras.clear();
  uidSinPagar = uid;
  // Un error termina ese escuchador: se marca para volver a empezar la próxima vez que se pida.
  const alFallar = (que) => (e) => { console.error(`No se pudo leer ${que}:`, e); uidSinPagar = ''; poner({ error: true }); };
  bajasSinPagar = [
    onSnapshot(query(revisiones(), where('pendientePago', '==', true)), (snap) => { llenar(docsAprobadas, snap); recalcular(); }, alFallar('lo aprobado sin pagar')),
    onSnapshot(query(revisiones(), where('estado', 'in', ['RETENIDA', 'EXCLUIDA', 'PENDIENTE'])), (snap) => { llenar(docsOtras, snap); recalcular(); }, alFallar('lo retenido y excluido')),
  ];
}

function reiniciarRegistros(desde, hasta) {
  bajaRegistros?.();
  bajaRegistros = onSnapshot(
    query(coleccion('registroVnTa'), where('fecha', '>=', desde), where('fecha', '<=', hasta)),
    (snap) => poner({ registros: aLista(snap) }),
    (e) => { console.error('No se pudo leer el registro de VN y TA:', e); poner({ error: true, ventana: null }); },
  );
}

// Lo pagado desde `inicio`: primero lo que el navegador ya tiene guardado (no se cobra) y, en vivo, solo los pagos desde el más reciente que se conocía.
async function arrancarPagos(inicio, yo) {
  const conocidas = new Map();
  try {
    const guardadas = await getDocsFromCache(query(revisiones(), where('pagoId', '>=', inicio)));
    for (const d of guardadas.docs) if (d.data().pagoId) conocidas.set(d.id, d.data().pagoId);
  } catch { /* sin caché: todo se pide al servidor */ }
  if (yo !== generacionPagos) return;
  semilla = conocidas;
  vivas = new Map();
  recalcular();
  let primera = true;
  const baja = onSnapshot(
    query(revisiones(), where('pagoId', '>=', marcadorDeLectura(conocidas, inicio))),
    (snap) => {
      if (yo !== generacionPagos) return;
      vivas = new Map(snap.docs.map((d) => [d.id, d.data().pagoId]));
      pagosCargados = true;
      recalcular();
      // Con lo primero que llega (y con un poco de tiempo para que lleguen también las no pagadas) el servidor confirma el conteo.
      if (primera) { primera = false; setTimeout(() => { if (yo === generacionPagos) validar(true); }, 2000); }
    },
    (e) => { console.error('No se pudo leer lo pagado:', e); inicioPagos = ''; poner({ error: true }); },
  );
  if (yo === generacionPagos) bajaPagos = baja; else baja();
}

function reiniciarPagos(inicio) {
  bajaPagos?.();
  bajaPagos = null;
  generacionPagos += 1;
  inicioPagos = inicio;
  validadaEn = 0;
  pagosCargados = false;
  arrancarPagos(inicio, generacionPagos);
}

// El servidor cuenta cuántas revisiones pagadas hay desde el inicio de la ventana (una lectura) y se compara con las que aquí se creen pagadas. Si no coincide (después de esperar un momento, por si
// justo se acaba de pagar algo y el escuchador todavía no lo trae) se vuelve a leer todo lo pagado del servidor y se usa eso.
async function validar(forzar = false) {
  if (validando || !inicioPagos || !pagosCargados) return;
  if (!forzar && Date.now() - validadaEn < CADA_CUANTO_VALIDAR_MS) return;
  validando = true;
  const yo = generacionPagos;
  const inicio = inicioPagos;
  try {
    const contar = async () => (await getCountFromServer(query(revisiones(), where('pagoId', '>=', inicio)))).data().count;
    let servidor = await contar();
    if (!pagadasCoinciden(servidor, estado.pagadas.length)) {
      await new Promise((resolver) => setTimeout(resolver, ESPERA_ANTES_DE_RELEER_MS));
      servidor = await contar();
    }
    if (yo !== generacionPagos) return;
    if (!pagadasCoinciden(servidor, estado.pagadas.length)) {
      const completo = await getDocsFromServer(query(revisiones(), where('pagoId', '>=', inicio)));
      if (yo !== generacionPagos) return;
      console.warn(`Revisión: lo pagado que se conocía no coincidía con el servidor (servidor ${servidor}, aquí ${estado.pagadas.length}); se volvió a leer completo.`);
      semilla = new Map(completo.docs.filter((d) => d.data().pagoId).map((d) => [d.id, d.data().pagoId]));
      recalcular();
    }
    validadaEn = Date.now();
  } catch (e) {
    console.error('No se pudo confirmar lo pagado con el servidor:', e);
  } finally {
    validando = false;
  }
}

function cortarTodo() {
  bajasSinPagar.forEach((baja) => baja());
  bajasSinPagar = [];
  uidSinPagar = '';
  docsAprobadas.clear();
  docsOtras.clear();
  bajaRegistros?.();
  bajaRegistros = null;
  generacionPagos += 1;
  bajaPagos?.();
  bajaPagos = null;
  inicioPagos = '';
  semilla = new Map();
  vivas = new Map();
  validadaEn = 0;
  pagosCargados = false;
}

// Para useSyncExternalStore: `estado` solo se reemplaza (nunca se modifica), así que es una foto estable.
export const suscribirseARevisiones = (avisar) => {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
};
export const revisionesEnVivo = () => estado;

// Pide que se esté leyendo lo que Revisión necesita para este usuario ({ uid, hoy: 'AAAA-MM-DD', rango: { desde, hasta } }): lo no pagado, lo pagado desde el inicio de la ventana y las filas de VN y TA
// de la ventana. Lo que ya se lee no se vuelve a leer.
export function leerRevisiones({ uid, hoy, rango }) {
  if (estado.uid && estado.uid !== uid) {
    cortarTodo();
    poner(VACIO);
  }
  asegurarSinPagar(uid);
  const plan = planDeLectura(estado, { uid, hoy, rango });
  if (plan.cambiar) {
    poner({ uid, dia: hoy, ventana: plan.ventana, error: false, ...(plan.conservarDatos ? {} : { registros: [] }) });
    reiniciarRegistros(plan.ventana.desde, plan.ventana.hasta);
  }
  const inicio = marcadorDeInicio(plan.ventana.desde);
  if (inicio !== inicioPagos) reiniciarPagos(inicio);
}

// Al entrar a Revisión: si hace más de 10 minutos que el servidor no confirma lo pagado, lo confirma ahora.
export const validarPagadas = () => validar(false);

// Antes de cambiar órdenes: pregunta al servidor (no a la caché) cuáles de esas claves ya están pagadas y devuelve las que sí. Se apuntan en lo pagado para que la pantalla las oculte de inmediato.
export async function pagadasEnServidor(claves) {
  const ids = [...new Set(claves)];
  const encontradas = [];
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocsFromServer(query(revisiones(), where(documentId(), 'in', ids.slice(i, i + 30))));
    for (const d of snap.docs) if (d.data().pagoId) encontradas.push([d.id, d.data().pagoId]);
  }
  if (encontradas.length > 0) {
    for (const [id, pagoId] of encontradas) semilla.set(id, pagoId);
    recalcular();
  }
  return encontradas.map(([id]) => id);
}

// Corta la lectura y olvida todo (para las pruebas y por si algún día hace falta al cambiar de usuario sin recargar).
export function dejarDeLeerRevisiones() {
  cortarTodo();
  poner(VACIO);
}
