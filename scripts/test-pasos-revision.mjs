// Prueba la revisión por pasos de la oficina (ver src/utils/pasosRevision.js y el modal "Revisar antes de aprobar"): qué pasos salen según la orden (autorizar solo con datos del equipo, cobro solo si lleva, valores solo si se piden),
// cuándo es una sola pantalla y que cada pieza esté conectada (carcasa global, indicador clicable, "Devolver" en todos los pasos, bloqueos por paso, resumen final y el botón discreto "Ver detalles" de Revisión). No necesita el emulador.
// Uso: `npm run test:pasosrevision`.
import { readFileSync } from 'node:fs';
import { esAsistenteDeRevision, motivoNoSePuedeLlegar, pasosDeRevision } from '../src/utils/pasosRevision.js';
import { requiereAutorizar } from '../src/utils/datosAutorizacion.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const base = { id: 'T1', codigo: 'AO7', nombre: 'Ana', cedula: '12345678', telefono: '0414-1234567', direccion: 'Calle 1', tecnico: 'JOSE', estado: 'PRE-FINALIZADO' };
const averia = { ...base, tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO' };
const instalacion = { ...base, tipoTrabajo: 'INSTALACIÓN', falla: 'SM', instalacion: { serial: 'GPON12AB34CD', vlan: '120', nap: 'NAP 02', puerto: '5' } };
const cambioEquipo = { ...averia, falla: 'Cambio de ONU', tipoVisita: 'CAMBIO_EQUIPO', serialEquipo: 'GPON99AA88BB', tipoEquipoNuevo: 'ONU' };

// --- Qué pasos salen ---
check('una instalación con datos del equipo: revisar, autorizar, valores (obligatorios) y decisión', pasosDeRevision(instalacion), ['revisar', 'autorizar', 'valores', 'decision']);
check('una instalación sin datos del equipo no tiene paso de autorizar', pasosDeRevision({ ...instalacion, instalacion: {} }), ['revisar', 'valores', 'decision']);
check('la NAP y el puerto solos no piden autorizar: una avería con NAP sigue sin paso de autorizar', [pasosDeRevision({ ...averia, nap: 'NAP 03 - 2' }), requiereAutorizar({ ...averia, nap: 'NAP 03 - 2' })], [['revisar', 'cobro', 'valores', 'decision'], false]);
check('una instalación con solo NAP y puerto (sin serial ni VLAN) tampoco', requiereAutorizar({ ...instalacion, instalacion: { nap: 'NAP 02', puerto: '5' } }), false);
check('sí piden autorizar: serial, VLAN, equipo nuevo en un cambio de equipo, reconexión con serial y VLAN configurada', [
  requiereAutorizar(instalacion), requiereAutorizar({ ...instalacion, instalacion: { vlan: '120' } }), requiereAutorizar(cambioEquipo),
  requiereAutorizar({ ...averia, tipoVisita: 'RECONEXION', serialEquipo: 'GPON99AA88BB' }), requiereAutorizar({ ...averia, tipoVisita: 'CONFIG_VLAN', vlanVisita: '120' }),
], [true, true, true, true, true]);
check('una avería con cobro: revisar, cobro, valores y decisión (sin autorizar: no hay datos del equipo)', pasosDeRevision(averia), ['revisar', 'cobro', 'valores', 'decision']);
check('un cambio de equipo: los cinco pasos', pasosDeRevision(cambioEquipo), ['revisar', 'autorizar', 'cobro', 'valores', 'decision']);
check('un retiro de equipo lleva cobro pero no valores del cliente', pasosDeRevision({ ...averia, tipoTrabajo: 'RETIRO EQUIPO' }), ['revisar', 'cobro', 'decision']);
check('una orden cerrada como trabajo adicional (TA) no lleva cobro ni valores: revisar y decidir', pasosDeRevision({ ...averia, estado: 'FINALIZADO', infraestructura: { activa: false, resultado: 'CERRADA' } }), ['revisar', 'decision']);
check('siempre empieza en revisar y termina en decisión', [averia, instalacion, cambioEquipo].map((t) => { const p = pasosDeRevision(t); return [p[0], p[p.length - 1]]; }), [['revisar', 'decision'], ['revisar', 'decision'], ['revisar', 'decision']]);

// --- Una pantalla o un asistente ---
check('con 2 pasos o menos es una sola pantalla; con 3 o más, un asistente', [esAsistenteDeRevision(['revisar', 'decision']), esAsistenteDeRevision(['revisar', 'cobro', 'decision']), esAsistenteDeRevision(pasosDeRevision(cambioEquipo))], [false, true, true]);

// --- No se salta un paso con lo obligatorio sin cumplir ---
const claves = ['revisar', 'cobro', 'valores', 'decision'];
const MOTIVO_VALORES = 'Guarda los valores del cliente para continuar.';
const MOTIVO_COBRO = 'Elige un cobro válido para continuar.';
const sinValores = (clave) => (clave === 'valores' ? MOTIVO_VALORES : '');
const sinCobro = (clave) => (clave === 'cobro' ? MOTIVO_COBRO : '');
check('sin los valores guardados no se llega a la decisión, ni con Siguiente ni saltando desde antes', [motivoNoSePuedeLlegar(claves, 'valores', 'decision', sinValores), motivoNoSePuedeLlegar(claves, 'revisar', 'decision', sinValores), motivoNoSePuedeLlegar(claves, 'cobro', 'decision', sinValores)], [MOTIVO_VALORES, MOTIVO_VALORES, MOTIVO_VALORES]);
check('con los valores guardados sí se llega', motivoNoSePuedeLlegar(claves, 'valores', 'decision', () => ''), '');
check('hacia atrás siempre se puede, y también al mismo paso o a uno anterior al problema', [motivoNoSePuedeLlegar(claves, 'decision', 'valores', sinValores), motivoNoSePuedeLlegar(claves, 'decision', 'revisar', sinValores), motivoNoSePuedeLlegar(claves, 'revisar', 'cobro', sinValores), motivoNoSePuedeLlegar(claves, 'valores', 'valores', sinValores)], ['', '', '', '']);
check('al paso del problema se llega (para arreglarlo) y el cobro sin elegir frena todo lo que está después', [motivoNoSePuedeLlegar(claves, 'cobro', 'valores', sinValores), motivoNoSePuedeLlegar(claves, 'revisar', 'valores', sinCobro), motivoNoSePuedeLlegar(claves, 'revisar', 'decision', sinCobro)], ['', MOTIVO_COBRO, MOTIVO_COBRO]);
check('una clave que no existe no bloquea ni rompe', [motivoNoSePuedeLlegar(claves, 'nada', 'decision', sinValores), motivoNoSePuedeLlegar(claves, 'revisar', 'nada', sinValores)], ['', '']);

// --- Todo conectado ---
const leer = (ruta) => readFileSync(ruta, 'utf8');
const modal = leer('src/components/modals/AprobarFinalizarModal.jsx');
check('el modal usa la carcasa global, el hook de pasos y la regla de qué pasos salen', [modal.includes('<AsistentePasos'), modal.includes('usePasosAsistente(claves)'), modal.includes('pasosDeRevision(ticket)'), modal.includes('esAsistenteDeRevision(claves)'), modal.includes('const unaSolaPantalla'), modal.includes('{porPasos ? asistente : unaSolaPantalla}')], [true, true, true, true, true, true]);
check('la oficina puede saltar entre pasos con el indicador, pero no a un paso al que aún no se puede llegar (aparece bloqueado, con candado)', [
  modal.includes('if (bloqueoParaLlegar(destino)) return;'), modal.includes('bloqueo={bloqueoParaLlegar}'), modal.includes('motivoNoSePuedeLlegar(claves, clave, destino, motivoDelPaso)'),
  leer('src/components/Pasos.jsx').includes('bloqueo(clave)'), leer('src/components/Pasos.jsx').includes('<Lock'), leer('src/components/Pasos.jsx').includes('disabled title={razon}'),
], [true, true, true, true, true, true]);
check('"Devolver" está en el pie de todos los pasos (lleva a la decisión con el motivo abierto), no solo en el último; ya devolviendo no se ofrece', [modal.includes("const irADevolver = () => { setPasoDeOrigen(nav.clave === 'decision' ? null : nav.clave); setDevolviendo(true); nav.ir('decision'); };"), (modal.match(/secundaria=\{secundariaDevolver\}/g) || []).length >= 2, modal.includes('onDevolver && !finalizando && !devolviendo')], [true, true, true]);
check('no se sigue sin un cobro válido ni sin los valores del cliente guardados (donde son obligatorios)', [modal.includes("clavePaso === 'cobro' && !cobroValido"), modal.includes("clavePaso === 'valores' && !valoresListos"), modal.includes('disabled: Boolean(bloqueoSiguiente)')], [true, true, true]);
check('al aprobar con un problema, salta al paso donde se arregla', [modal.includes("irAlPaso('valores'"), modal.includes("irAlPaso('cobro')")], [true, true]);
check('el último paso tiene el resumen con cobro, valores y faltantes, y el motivo de la devolución baja y da el foco', [modal.includes('const resumenFinal'), modal.includes('Resumen antes de'), modal.includes('<div ref={mostrarMotivo}'), modal.includes("margenInferior: porPasos ? 8 : 88")], [true, true, true, true]);
check('en el resumen final los valores del cliente van uno debajo del otro (OLT y ONU en líneas separadas), no en una sola línea', [modal.includes('[`OLT ${valoresGuardadosEnOrden.olt1310Dbm} dBm`, `ONU ${valoresGuardadosEnOrden.onu1490Dbm} dBm`]'), modal.includes('const lineas = Array.isArray(valor) ? valor : [valor];'), !modal.includes(' · ONU ${')], [true, true, true]);
check('el aviso de que la orden cambió y los otros revisando siguen en el encabezado fijo, y la orden cambiada bloquea aprobar y devolver', [modal.includes('<AvisoCambioDeOrden'), modal.includes('<AvisoRevision'), (modal.match(/Boolean\(cambio\)/g) || []).length >= 4], [true, true, true]);

const bloqueDatos = leer('src/components/modals/DatosParaAutorizar.jsx');
check('las órdenes que no necesitan autorizar dicen "Datos del cliente" (y "NAP" en la tarjeta del equipo); las que sí, "Para autorizar en SmartOLT"', [
  bloqueDatos.includes("{paraAutorizar ? 'Para autorizar en SmartOLT' : 'Datos del cliente'}"), bloqueDatos.toUpperCase().includes("PARAAUTORIZAR ? 'EQUIPO' : 'NAP'"), modal.includes('paraAutorizar={hayEquipo}'), modal.includes("const hayEquipo = claves.includes('autorizar')"),
], [true, true, true, true]);
check('la revisión de órdenes tiene el botón discreto "Ver detalles" con las fotos, que no pide nada hasta que se toca', [leer('src/components/revision/FilaRevision.jsx').includes('<VerFotosOrden'), leer('src/components/VerFotosOrden.jsx').includes('pedidas ? fotos.map((f) => f.ruta) : []'), leer('src/components/VerFotosOrden.jsx').includes('Ver detalles ('), leer('src/components/VerFotosOrden.jsx').includes('<VisorFotos')], [true, true, true, true]);

// Devolver salta directo a la decisión desde cualquier paso: cancelar tiene que volver al paso de origen (no dejar la ventana en la decisión, lista para aprobar sin haber pasado por lo obligatorio), y Aprobar no se habilita si falta algo.
check('Devolver recuerda de qué paso viene y al cancelar regresa a ese paso (desde la decisión misma se queda ahí)', [
  modal.includes("setPasoDeOrigen(nav.clave === 'decision' ? null : nav.clave)"), modal.includes('if (pasoDeOrigen) nav.ir(pasoDeOrigen);'), modal.includes('onAnterior={cancelarDevolver}'),
], [true, true, true]);
check('al saltar con el indicador de pasos se sale del modo devolver, y Aprobar queda bloqueado si falta lo obligatorio antes de la decisión (con su aviso)', [
  modal.includes("if (destino !== 'decision') { setDevolviendo(false); setPasoDeOrigen(null); }"),
  modal.includes("motivoNoSePuedeLlegar(claves, claves[0], 'decision', motivoDelPaso)"), modal.includes('Boolean(faltaAntesDeDecidir)'), modal.includes('{faltaAntesDeDecidir && !devolviendo && <p role="alert"'),
], [true, true, true, true]);
// En el asistente la barra de desplazamiento solo sale cuando el paso no cabe de verdad: si solo sobra el margen de abajo no hay nada que desplazar.
const carcasa = leer('src/components/AsistentePasos.jsx');
check('la carcasa del asistente quita la barra cuando solo sobra el margen de abajo (16 px o menos) y la deja cuando el paso no cabe', [
  carcasa.includes('const TOLERANCIA_PX = 16;'), carcasa.includes('elemento.scrollHeight - elemento.clientHeight <= TOLERANCIA_PX'), carcasa.includes("sinBarra ? 'overflow-y-hidden' : 'overflow-y-auto'"), carcasa.includes('new ResizeObserver(medir)'),
], [true, true, true, true]);
// Los pasos llevan 16 px o más de margen abajo (si no, la tolerancia taparía contenido).
check('el contenido de cada paso de los asistentes lleva 16 px o más de margen abajo', [
  modal.includes('<div className="p-4 sm:p-5 space-y-4">'), leer('src/components/modals/PreFinalizarModal.jsx').includes('noValidate className="p-4 sm:p-5 space-y-4"'), /<section aria-label="Detalles de la orden" className="px-5 py-4 space-y-3">/.test(leer('src/components/modals/CobroResultanteModal.jsx')),
], [true, true, true]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
