// Prueba los "Detalles de la orden" (fotos del técnico, ver src/utils/detallesOrden.js): cuándo se piden, qué le falta al técnico, la forma de lo que se guarda y que cada pantalla (modal del cobro, listas del técnico,
// cierre del día, Revisión y detalle de la orden) esté conectada. No necesita el emulador (las reglas de verdad, de Firestore y de Storage, las prueba test-detalles-orden-reglas.mjs).
// Uso: `npm run test:detalles`.
import { readFileSync } from 'node:fs';
import {
  BYTES_MAXIMOS_FOTO, FECHA_INICIO_DETALLES, MAX_FOTOS, MIN_FOTOS, PENDIENTE_DETALLES, PENDIENTE_PAGO, armarDetalles, carpetaDeFotos, debePedirDetalles, dimensionesReducidas, faltanDetalles, fotosDe, nombreDeFoto, pendienteDelTecnico, puedeCorregirDetalles, rutasQuitadas, tieneDetalles, validarDetalles,
} from '../src/utils/detallesOrden.js';
import { aprobarPendientes, armarRevision, motivoSinDetalles } from '../src/utils/revisionPagos.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const DESDE = '2026-11-13';
const OPC = { desde: DESDE };
const AHORA = Date.parse('2026-11-14T15:00:00-04:00');
const ANTES = Date.parse('2026-11-12T15:00:00-04:00');
const orden = { id: 'T1', codigo: 'AO7', tecnico: 'JOSE', tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'FINALIZADO', finalizadoEn: AHORA };
const foto = (n) => ({ ruta: `ordenes/T1/0${n}-abc.jpg`, bytes: 250000 });
const detalles = (n) => armarDetalles(Array.from({ length: n }, (_, i) => foto(i + 1)), { por: 'jose', ahora: AHORA });

// --- Las cantidades y el peso ---
check('de 2 a 7 fotos', [MIN_FOTOS, MAX_FOTOS], [2, 7]);
check('una foto pesa como máximo 1 MB', BYTES_MAXIMOS_FOTO, 1024 * 1024);
check('la foto se reduce a 1600 px de lado largo, sin deformarla ni agrandarla', [dimensionesReducidas(4000, 3000), dimensionesReducidas(3000, 4000), dimensionesReducidas(800, 600), dimensionesReducidas(0, 10)], [{ ancho: 1600, alto: 1200 }, { ancho: 1200, alto: 1600 }, { ancho: 800, alto: 600 }, { ancho: 0, alto: 0 }]);
check('la carpeta y el nombre de la foto', [carpetaDeFotos('T1'), nombreDeFoto(0, 36 * 36), nombreDeFoto(6, 36 * 36)], ['ordenes/T1', '01-100.jpg', '07-100.jpg']);

// --- Cuándo se piden ---
check('una orden finalizada desde la fecha de inicio pide los detalles', debePedirDetalles(orden, OPC), true);
check('una finalizada antes de la fecha de inicio no los pide (no se toca lo anterior)', debePedirDetalles({ ...orden, finalizadoEn: ANTES }, OPC), false);
check('una pre-finalizada, una pendiente o una cancelada no los piden', ['PRE-FINALIZADO', 'PENDIENTE', 'CANCELADO'].map((estado) => debePedirDetalles({ ...orden, estado }, OPC)), [false, false, false]);
check('sin técnico o sin hora de finalización no los pide', [debePedirDetalles({ ...orden, tecnico: '' }, OPC), debePedirDetalles({ ...orden, finalizadoEn: null }, OPC), debePedirDetalles(null, OPC)], [false, false, false]);
check('la fecha de inicio por defecto es una fecha válida', /^\d{4}-\d{2}-\d{2}$/.test(FECHA_INICIO_DETALLES), true);

// --- Qué le falta ---
check('sin fotos faltan; con 1 siguen faltando; con 2 ya están', [faltanDetalles(orden, OPC), faltanDetalles({ ...orden, detallesOrden: detalles(1) }, OPC), faltanDetalles({ ...orden, detallesOrden: detalles(2) }, OPC)], [true, true, false]);
check('con 7 fotos están', [tieneDetalles({ detallesOrden: detalles(7) }), fotosDe({ detallesOrden: detalles(7) }).length], [true, 7]);
check('fotosDe ignora lo que no es una foto', fotosDe({ detallesOrden: { fotos: [null, {}, { ruta: '' }, foto(1)] } }).length, 1);
const conCobro = { ...orden, cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', tipoVisita: 'CONECTOR_EXTERNO' };
const pago = { tipo: 'DESPUES', pago: null, nota: '', compartidoCon: null, monedaDistinta: false, diferencia: false, registradoPor: 'jose', registradoEn: AHORA };
check('primero se pide el pago y después los detalles', [pendienteDelTecnico(conCobro, OPC), pendienteDelTecnico({ ...conCobro, pagoCliente: pago }, OPC), pendienteDelTecnico({ ...conCobro, pagoCliente: pago, detallesOrden: detalles(3) }, OPC)], [PENDIENTE_PAGO, PENDIENTE_DETALLES, '']);
check('una orden sin cobro solo pide los detalles', pendienteDelTecnico(orden, OPC), PENDIENTE_DETALLES);

// --- Corregir las fotos ---
const guardadas = { ...orden, detallesOrden: detalles(3) };
check('las fotos que se quitaron o se cambiaron son las que ya no están en la lista final', [rutasQuitadas(guardadas, [foto(1), foto(3)]), rutasQuitadas(guardadas, [foto(1), foto(2), foto(3), { ruta: 'ordenes/T1/09-nueva.jpg', bytes: 1 }]), rutasQuitadas(orden, [foto(1)])], [[foto(2).ruta], [], []]);
check('el técnico corrige mientras la orden siga finalizada y ya tenga detalles', [puedeCorregirDetalles(guardadas), puedeCorregirDetalles(orden), puedeCorregirDetalles({ ...guardadas, estado: 'PRE-FINALIZADO' }), puedeCorregirDetalles(null)], [true, false, false, false]);

// --- Lo que se guarda ---
const bueno = detalles(3);
check('lo que se guarda: solo rutas y pesos, quién y cuándo', [Object.keys(bueno), bueno.fotos[0], bueno.subidoPor, bueno.subidoEn], [['fotos', 'subidoPor', 'subidoEn'], foto(1), 'jose', AHORA]);
check('3 fotos de la orden sirven', validarDetalles(bueno, 'T1'), { ok: true });
check('menos de 2 fotos no sirven', validarDetalles(detalles(1), 'T1').error, 'Sube al menos 2 fotos.');
check('más de 7 fotos no sirven', validarDetalles({ ...bueno, fotos: Array.from({ length: 8 }, (_, i) => ({ ruta: `ordenes/T1/0${i}-x${i}.jpg`, bytes: 1000 })) }, 'T1').error, 'Son 7 fotos como máximo.');
check('una foto de otra orden no sirve', validarDetalles({ ...bueno, fotos: [foto(1), { ruta: 'ordenes/OTRA/01-abc.jpg', bytes: 1000 }] }, 'T1').error, 'Una de las fotos no es de esta orden.');
check('una ruta que no es un JPEG o que sale de la carpeta no sirve', [
  validarDetalles({ ...bueno, fotos: [foto(1), { ruta: 'ordenes/T1/02-abc.png', bytes: 1000 }] }, 'T1').error,
  validarDetalles({ ...bueno, fotos: [foto(1), { ruta: 'ordenes/T1/../x/02.jpg', bytes: 1000 }] }, 'T1').error,
], ['Una de las fotos no es de esta orden.', 'Una de las fotos no es de esta orden.']);
check('una foto que pesa de más o vacía no sirve', [validarDetalles({ ...bueno, fotos: [foto(1), { ...foto(2), bytes: BYTES_MAXIMOS_FOTO + 1 }] }, 'T1').error, validarDetalles({ ...bueno, fotos: [foto(1), { ...foto(2), bytes: 0 }] }, 'T1').error], ['Una de las fotos pesa demasiado.', 'Una de las fotos pesa demasiado.']);
check('una foto repetida no sirve', validarDetalles({ ...bueno, fotos: [foto(1), foto(1)] }, 'T1').error, 'Hay una foto repetida.');

// --- Revisión: sin los detalles no se aprueba (la prueba usa la fecha de inicio por defecto con una orden de hoy) ---
const item = (extra = {}) => ({ clave: 'k1', orden: { ...orden, finalizadoEn: Date.now() + 2 * 24 * 3600 * 1000, ...extra }, estadoRevision: 'PENDIENTE' });
check('Revisión: una orden sin fotos tiene motivo, con nombre del técnico, y una con fotos no', [motivoSinDetalles(item()).startsWith('Faltan los detalles de la orden'), motivoSinDetalles(item()).includes('(JOSE)'), motivoSinDetalles(item({ detallesOrden: detalles(2) }))], [true, true, '']);
check('Revisión: la aprobación en bloque deja fuera las que esperan fotos y lo dice', (() => {
  const { omitidas, documentos } = aprobarPendientes([{ ...item(), concepto: 'AVERIA', conceptoOriginal: 'AVERIA', tecnico: 'JOSE', tecnicoOriginal: 'JOSE', firma: 'f', dia: '2026-11-14' }], { por: 'admin', ahora: AHORA });
  return [documentos.length, omitidas.map((o) => [Boolean(o.sinDetalles), o.motivo.startsWith('Faltan los detalles de la orden')])];
})(), [0, [[true, true]]]);

// Aprobar una orden sin los detalles: solo una por una y con motivo obligatorio.
const aprobable = { ...item(), concepto: 'AVERIA', conceptoOriginal: 'AVERIA', tecnico: 'JOSE', tecnicoOriginal: 'JOSE', firma: 'f', dia: '2026-11-14' };
check('Revisión: sin motivo no se aprueba sin detalles (ni vacío ni solo espacios) y con motivo sí, y se guarda', (() => {
  const sin = armarRevision(aprobable, 'APROBAR', { por: 'admin', ahora: AHORA });
  const vacio = armarRevision(aprobable, 'APROBAR', { por: 'admin', ahora: AHORA, sinDetalles: '   ' });
  const con = armarRevision(aprobable, 'APROBAR', { por: 'admin', ahora: AHORA, sinDetalles: 'El técnico perdió el teléfono' });
  return [sin.error.startsWith('Faltan los detalles'), vacio.error, con.datos.estado, con.datos.sinDetalles, con.datos.historial[0].sinDetalles];
})(), [true, 'Escribe por qué se aprueba sin los detalles de la orden.', 'APROBADA', 'El técnico perdió el teléfono', 'El técnico perdió el teléfono']);
check('Revisión: una orden con fotos no guarda motivo aunque se mande, y retener no lo guarda', (() => {
  const conFotos = { ...aprobable, orden: { ...aprobable.orden, detallesOrden: detalles(2) } };
  const a = armarRevision(conFotos, 'APROBAR', { por: 'admin', ahora: AHORA, sinDetalles: 'x' });
  const r = armarRevision(aprobable, 'RETENER', { por: 'admin', ahora: AHORA, motivo: 'm', sinDetalles: 'x' });
  return ['sinDetalles' in a.datos, 'sinDetalles' in r.datos];
})(), [false, false]);

// --- Todo conectado ---
const leer = (ruta) => readFileSync(ruta, 'utf8');
const modal = leer('src/components/modals/CobroResultanteModal.jsx');
check('el modal del cobro tiene el paso de los detalles (campo de fotos con su mínimo y máximo, subida) y ese paso no repite una indicación arriba: las explicaciones van debajo', [modal.includes('DetallesOrdenCampo'), modal.includes('onSubirDetalles'), modal.includes('faltanDetalles'), modal.includes("clave === 'detalles' ? '' :"), leer('src/components/DetallesOrdenCampo.jsx').includes('MIN_FOTOS') && leer('src/components/DetallesOrdenCampo.jsx').includes('MAX_FOTOS')], [true, true, true, true, true]);
const asistente = leer('src/components/AsistentePasos.jsx');
check('el modal del cobro es un asistente por pasos (cobro y datos, pago, detalles) hecho con la carcasa global, con "Hacerlo después"', [
  modal.includes("['cobro', 'pago']"), modal.includes("'detalles'"), modal.includes('<AsistentePasos'), modal.includes('usePasosAsistente'), modal.includes('<BotonesPasos'), modal.includes('Hacerlo después'),
], [true, true, true, true, true, true]);
check('la carcasa global del asistente: indicador, "(último)", Siguiente y Atrás, transición hacia adelante y hacia atrás, y arranca arriba en cada paso', [
  asistente.includes("import Pasos from './Pasos'"), asistente.includes('(último)'), asistente.includes("'Siguiente'"), asistente.includes("textoAnterior = 'Atrás'"), asistente.includes('animate-paso-adelante'), asistente.includes('animate-paso-atras'), asistente.includes('scrollTo({ top: 0 })'),
], [true, true, true, true, true, true, true]);
check('el indicador de pasos puede ser clicable (para saltar entre pasos) y el hook sabe ir a un paso', [leer('src/components/Pasos.jsx').includes('onElegir'), leer('src/hooks/usePasosAsistente.js').includes('ir: (clave)')], [true, true]);
check('el paso del cobro muestra el monto, los valores del cliente y los datos de la orden; el del pago, el formulario; el de las fotos, el campo de fotos', (() => {
  const cobro = modal.slice(modal.indexOf("clave === 'cobro' && ("), modal.indexOf("clave === 'pago' && ("));
  const pagoPaso = modal.slice(modal.indexOf("clave === 'pago' && ("), modal.indexOf("clave === 'detalles' && ("));
  const fotos = modal.slice(modal.indexOf("clave === 'detalles' && ("), modal.indexOf('{porPasos ? ('));
  return [cobro.includes('cuadroDelCobro') && cobro.includes('valoresDelCliente') && cobro.includes('datosDeLaOrden'), pagoPaso.includes('<FormularioPagoCliente') && !pagoPaso.includes('DetallesOrdenCampo'), fotos.includes('<DetallesOrdenCampo') && !fotos.includes('<FormularioPagoCliente')];
})(), [true, true, true]);
check('App le pasa al modal la subida de los detalles', leer('src/App.jsx').includes('onSubirDetalles: subirDetallesDeLaOrden'), true);
const hook = leer('src/hooks/useTickets.js');
check('useTickets: lo que el técnico debe completar incluye las órdenes sin detalles y sube las fotos', [hook.includes('|| faltanDetalles(t)'), hook.includes('subirDetallesDeOrden(ticket, fotos')], [true, true]);
check('el técnico corrige las fotos desde su lista (tabla y celular) en un modal propio', [leer('src/components/TicketsTable.jsx').includes('onCorregirFotos(ticket)'), leer('src/components/TicketsMobileList.jsx').includes('Corregir fotos'), leer('src/App.jsx').includes('<CorregirDetallesModal'), leer('src/components/DetallesOrdenCampo.jsx').includes('Cambiar la foto'), leer('src/components/DetallesOrdenCampo.jsx').includes('Quitar la foto')], [true, true, true, true, true]);
check('las listas del técnico muestran el botón de subir los detalles', [leer('src/components/TicketsTable.jsx').includes('pendienteDelTecnico(ticket)'), leer('src/components/TicketsMobileList.jsx').includes('Subir detalles')], [true, true]);
check('el cierre del día no archiva una orden a la que le faltan los detalles', leer('src/hooks/useReports.js').includes('!faltaElPago(t) && !faltanDetalles(t)'), true);
check('Revisión muestra el motivo y bloquea la aprobación, salvo "Aprobar sin detalles" con motivo', [leer('src/components/revision/FilaRevision.jsx').includes('motivoSinDetalles(item)'), leer('src/components/revision/FilaRevision.jsx').includes('Aprobar sin detalles'), leer('src/utils/revisionPagos.js').includes('motivoSinPago(efectivo)')], [true, true, true]);
check('el detalle de pago de Revisión tiene el botón "Ver detalle completo" que abre el Detalle de la orden (no en una fila del registro de VN y TA)', [leer('src/components/finanzas/DetalleOrdenFinanzas.jsx').includes('onVerCompleto && !registro'), leer('src/components/revision/RevisionPagosModal.jsx').includes('onVerCompleto={setDetalleCompleto}'), leer('src/components/revision/RevisionPagosModal.jsx').includes('<DetalleOrdenModal ticket={detalleCompleto} verCobro')], [true, true, true]);
check('el Detalle de la orden avisa, solo al ADMIN, si se aprobó sin los detalles: lee la revisión una vez por orden y solo muestra una aprobada con motivo', [
  leer('src/components/modals/DetalleOrdenModal.jsx').includes('verRevision && <AprobacionSinDetalles'), leer('src/App.jsx').split('verRevision={isAdmin}').length - 1, leer('src/components/revision/RevisionPagosModal.jsx').includes('verCobro verRevision'),
  leer('src/components/AprobacionSinDetalles.jsx').includes("revision?.estado !== 'APROBADA' || !revision.sinDetalles"), leer('src/components/AprobacionSinDetalles.jsx').includes('[clave]'), leer('src/components/AprobacionSinDetalles.jsx').includes('|| tieneDetalles(orden)'), leer('src/components/revision/FilaRevision.jsx').includes('!tieneDetalles(item.orden)'), leer('src/lib/revisionDeOrden.js').includes("'revisionPagos'"),
], [true, 2, true, true, true, true, true, true]);
check('las reglas de Firestore aceptan el motivo de la aprobación sin detalles', leer('firestore.rules').includes("'garantiaSinDescuento', 'sinDetalles', 'por'"), true);
check('las fotos solo las ve la oficina y solo se piden cuando la sección entra en pantalla; se abren en el visor de la app, no en otra pestaña', [
  leer('src/components/modals/DetalleOrdenModal.jsx').includes('verCobro && fotosDe(ticket).length > 0'),
  leer('src/components/FotosDeOrden.jsx').includes('cerca ? fotos.map((f) => f.ruta) : []'), leer('src/components/FotosDeOrden.jsx').includes('IntersectionObserver'),
  leer('src/components/FotosDeOrden.jsx').includes('<VisorFotos'), leer('src/components/FotosDeOrden.jsx').includes('target="_blank"'),
], [true, true, true, true, false]);
check('las fotos se ven en el detalle de la orden y en el de Revisión y Finanzas', [leer('src/components/modals/DetalleOrdenModal.jsx').includes('<FotosDeOrden'), leer('src/components/finanzas/DetalleOrdenFinanzas.jsx').includes('<FotosDeOrden')], [true, true]);
const reglas = leer('firestore.rules');
check('las reglas de Firestore dejan al técnico guardar detallesOrden una sola vez, en su orden finalizada', [reglas.includes("'historialEdiciones', 'detallesOrden'])"), reglas.includes('detallesOrdenValido(request.resource.data.detallesOrden, docId)'), /resource\.data\.estado == 'FINALIZADO'\s+&& detallesOrdenValido/.test(reglas)], [true, true, true]);
const storage = leer('storage.rules');
check('las reglas de Storage: solo el técnico de la orden finalizada sube un JPEG de hasta 1 MB, sin sobrescribir', [storage.includes("ordenDe(ticketId).estado == 'FINALIZADO'"), storage.includes("request.resource.contentType == 'image/jpeg'"), storage.includes('1024 * 1024'), storage.includes('allow update: if false')], [true, true, true, true]);
const firebase = JSON.parse(leer('firebase.json'));
check('firebase.json: reglas de Storage, emulador y las fotos permitidas en la política de seguridad', [firebase.storage?.rules, firebase.emulators.storage?.port, JSON.stringify(firebase.hosting.headers).includes('https://firebasestorage.googleapis.com')], ['storage.rules', 9199, true]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
