// Prueba el formulario de pre-finalizar del técnico por pasos (ver src/utils/pasosPreFinalizar.js y components/modals/PreFinalizarModal): qué pasos salen según el tipo de visita, que cada bloque del formulario esté en su paso
// (NAP y puerto del recableado en "Datos", los colores en "Conectores"...), que "Siguiente" valide por paso, que el indicador bloquee los pasos a los que aún no se puede llegar y que se conserve el aviso de confirmación. No necesita el emulador.
// Uso: `npm run test:pasosprefinalizar`.
import { readFileSync } from 'node:fs';
import { ETIQUETA_PASO_PREFINALIZAR, pasosDePreFinalizar, visitaPideDatos } from '../src/utils/pasosPreFinalizar.js';
import {
  TIPO_CAMBIO_EQUIPO, TIPO_CONECTOR_EXTERNO, TIPO_CONECTOR_INTERNO, TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO, TIPO_CONFIG_ROUTER, TIPO_CONFIG_VLAN, TIPO_DROP_ATENUADO, TIPO_FUENTE_AVERIADA, TIPO_MUDANZA_INTERNA, TIPO_RECABLEADO, TIPO_RECABLEADO_CAMBIO_EQUIPO,
  TIPO_RECONEXION, TIPO_RECONEXION_CAMBIO_EQUIPO, pideNapPuertoVisita,
} from '../src/utils/tipoVisita.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const visita = (tipoVisita) => pasosDePreFinalizar({ tipoVisita });

// --- Qué pasos salen ---
check('una instalación siempre tiene los mismos 4 pasos', pasosDePreFinalizar({ instalacion: true }), ['orden', 'equipo', 'cable', 'cierre']);
check('una instalación ignora el tipo de visita (no aplica)', pasosDePreFinalizar({ instalacion: true, tipoVisita: TIPO_RECABLEADO }), ['orden', 'equipo', 'cable', 'cierre']);
check('sin tipo de visita elegido solo hay orden y cierre; al elegirlo aparecen los demás', [visita(''), visita(undefined), pasosDePreFinalizar()], [['orden', 'cierre'], ['orden', 'cierre'], ['orden', 'cierre']]);
check('conector externo: datos (NAP y puerto) y conectores', visita(TIPO_CONECTOR_EXTERNO), ['orden', 'datos', 'conectores', 'cierre']);
check('conector interno: solo conectores (no pide NAP ni datos)', visita(TIPO_CONECTOR_INTERNO), ['orden', 'conectores', 'cierre']);
check('recableado: datos (metraje, consulta de cobro, NAP y puerto) y conectores', visita(TIPO_RECABLEADO), ['orden', 'datos', 'conectores', 'cierre']);
check('drop atenuado: datos (NAP y puerto) y sin conectores', visita(TIPO_DROP_ATENUADO), ['orden', 'datos', 'cierre']);
check('cambio de equipo, reconexión y configuración de VLAN: un paso de datos', [TIPO_CAMBIO_EQUIPO, TIPO_RECONEXION, TIPO_CONFIG_VLAN].map(visita), [['orden', 'datos', 'cierre'], ['orden', 'datos', 'cierre'], ['orden', 'datos', 'cierre']]);
check('configuración de router, fuente averiada y mudanza interna no piden nada: orden y cierre', [TIPO_CONFIG_ROUTER, TIPO_FUENTE_AVERIADA, TIPO_MUDANZA_INTERNA].map(visita), [['orden', 'cierre'], ['orden', 'cierre'], ['orden', 'cierre']]);
check('las combinadas con cambio de equipo suman el paso de datos a lo de su visita de base', [TIPO_RECABLEADO_CAMBIO_EQUIPO, TIPO_RECONEXION_CAMBIO_EQUIPO, TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO].map(visita), [['orden', 'datos', 'conectores', 'cierre'], ['orden', 'datos', 'cierre'], ['orden', 'datos', 'conectores', 'cierre']]);
check('siempre empieza en orden y termina en cierre, y todos los pasos tienen nombre', [TIPO_CONECTOR_EXTERNO, TIPO_RECABLEADO, '', TIPO_CAMBIO_EQUIPO].every((t) => { const p = visita(t); return p[0] === 'orden' && p[p.length - 1] === 'cierre' && p.every((c) => ETIQUETA_PASO_PREFINALIZAR[c]); }), true);
check('NAP y puerto son obligatorios en recableado, conector externo y drop atenuado (y van en el paso de datos)', [TIPO_RECABLEADO, TIPO_CONECTOR_EXTERNO, TIPO_DROP_ATENUADO, TIPO_CONECTOR_INTERNO].map((t) => [pideNapPuertoVisita(t), visitaPideDatos(t)]), [[true, true], [true, true], [true, true], [false, false]]);

// --- Cada bloque en su paso ---
const leer = (ruta) => readFileSync(ruta, 'utf8');
const modal = leer('src/components/modals/PreFinalizarModal.jsx');
const desde = modal.indexOf('const contenidoDelPaso = {');
const bloquePaso = (clave, siguiente) => modal.slice(modal.indexOf(`${clave}: `, desde), modal.indexOf(`${siguiente}: `, desde));
const orden = bloquePaso('orden', 'equipo');
const equipo = bloquePaso('equipo', 'cable');
const cable = bloquePaso('cable', 'datos');
const datos = bloquePaso('datos', 'conectores');
const conectores = bloquePaso('conectores', 'cierre');
const cierre = modal.slice(modal.indexOf('cierre: (', desde), modal.indexOf('}[nav.clave]', desde));
check('paso Orden: el aviso de devolución completo, el resumen, el tipo de visita, el aviso de cobro y la nota de la oficina', ['<DevolucionAviso ticket={ticket} conValores />', 'bloqueResumen', 'bloqueTipoVisita', 'bloqueAvisoCobro', 'bloqueNotaOficina'].map((x) => orden.includes(x)), [true, true, true, true, true]);
check('paso Equipo (instalación): serial, VLAN, NAP y puerto; paso Cable: metraje, posteadura, puertos y conectores', [equipo.includes('bloqueEquipoInstalacion'), cable.includes('bloqueCableInstalacion'), modal.includes('<DatosInstalacion parte="equipo"'), modal.includes('<DatosInstalacion parte="cable"'), modal.includes('<CantidadesConectorInstalacion')], [true, true, true, true, true]);
check('paso Datos (visita): metraje y consulta del recableado, VLAN, serial y tipo del equipo, y NAP y puerto', ['bloqueRecabladoDatos', 'bloqueVlanVisita', 'bloqueSerialEquipo', 'bloqueNapPuertoVisita'].map((x) => datos.includes(x)), [true, true, true, true]);
check('el recableado reparte sus campos: metraje y consulta de cobro en Datos, colores de los conectores en Conectores', (() => {
  const rd = modal.slice(modal.indexOf('const bloqueRecabladoDatos'), modal.indexOf('const bloqueRecabladoConectores'));
  const rc = modal.slice(modal.indexOf('const bloqueRecabladoConectores'), modal.indexOf('const bloqueVlanVisita'));
  return [rd.includes('<MetrajeInicialFinal'), rd.includes('<ConsultaCobroRecableado'), !rd.includes('<ConectoresRecableado'), rc.includes('<ConectoresRecableado'), !rc.includes('<MetrajeInicialFinal')];
})(), [true, true, true, true, true]);
check('paso Conectores (visita): colores del recableado y cantidades de las visitas de conector', [conectores.includes('bloqueRecabladoConectores'), conectores.includes('bloqueCantidadesVisita')], [true, true]);
check('paso Cierre: potencia (con SmartOLT), el reporte anterior, la observación obligatoria y el aviso de que queda pre-finalizada', ['bloquePotencia', 'bloqueReporteAnterior', 'bloqueObservacion', 'bloqueAvisoPre'].map((x) => cierre.includes(x)), [true, true, true, true]);
check('si la oficina devolvió la orden, su motivo se ve en todos los pasos (completo en el primero y resumido en los demás)', [(modal.match(/\{aviso\}/g) || []).length >= 4, modal.includes('const aviso = <DevolucionAviso ticket={ticket} compact />')], [true, true]);

// --- Navegación y validación ---
check('Siguiente siempre está habilitado: valida el paso, muestra los errores y lleva el cursor al primero', [modal.includes('siguiente={{ onClick: siguientePaso }}'), modal.includes('const siguientePaso = () => {'), modal.includes("aplicarErrores(ev, [nav.clave])"), modal.includes("document.getElementById(propio.id)?.focus()")], [true, true, true, true]);
check('Enter avanza (y en el último paso confirma): el formulario lleva su botón de envío escondido', [modal.includes('if (nav.esUltimo) handleSubmit(); else siguientePaso();'), modal.includes('className="sr-only" tabIndex={-1}')], [true, true]);
check('el indicador deja saltar entre pasos pero bloquea (con candado) los pasos a los que aún no se puede llegar', [modal.includes('if (!bloqueoParaLlegar(destino)) nav.ir(destino)'), modal.includes('bloqueo={bloqueoParaLlegar}'), modal.includes('motivoNoSePuedeLlegar(claves, nav.clave, destino, motivoDelPaso)')], [true, true, true]);
check('al confirmar se revisa todo y, si hay un problema en otro paso, va a ese paso y pone el cursor en el campo', [modal.includes('aplicarErrores(ev, null)'), modal.includes('irAlPaso(primero.paso, () => document.getElementById(primero.id)?.focus())')], [true, true]);
check('NAP y puerto se revisan en el paso de equipo (instalación) o de datos (visita)', modal.includes("const pasoDeNap = esInstalacion ? 'equipo' : 'datos';"), true);
check('se conserva el aviso de confirmación final (con su resumen de datos) y el último paso lo abre con "Confirmar"', [modal.includes('{porConfirmar && ('), modal.includes('<ConfirmPreFinalizarModal'), modal.includes("texto: isSubmitting ? 'Guardando...' : 'Confirmar'"), modal.includes("tono: 'ambar'")], [true, true, true, true]);
check('en celular el indicador solo escribe el nombre del paso actual, igual en todos los asistentes (con 2, 3, 4 o 5 pasos)', [leer('src/components/Pasos.jsx').includes('const ocultarNombre = !esActual;'), leer('src/components/Pasos.jsx').includes("'hidden sm:inline '")], [true, true]);
check('el pie lleva el botón principal a todo el ancho y debajo una fila con "Atrás" a la izquierda y la acción alterna a la derecha (centrada si va sola), y una nota centrada', [leer('src/components/AsistentePasos.jsx').includes('w-full inline-flex items-center justify-center gap-2 h-11'), leer('src/components/AsistentePasos.jsx').includes("onAnterior && secundaria ? 'justify-between' : 'justify-center'"), leer('src/components/AsistentePasos.jsx').includes('text-center leading-snug'), !leer('src/components/AsistentePasos.jsx').includes('col-start-2')], [true, true, true, true]);
check('la carcasa global ofrece el tono ámbar para ese botón', leer('src/components/AsistentePasos.jsx').includes("ambar: 'bg-amber-500 hover:bg-amber-400 text-black shadow-"), true);
check('los pasos se calculan con la regla pura y el tipo de visita elegido', [modal.includes('pasosDePreFinalizar({ instalacion: ordenEsInstalacion, tipoVisita: ordenEsInstalacion ? \'\' : tipoVisitaElegido })'), modal.includes('usePasosAsistente(claves)')], [true, true]);
check('el orden del cursor y de los problemas sigue el de los pasos: tipo de visita, datos, equipo, cable, conectores y cierre', (() => {
  const lista = modal.slice(modal.indexOf('const problemas = ['), modal.indexOf('].filter(([hay])'));
  const pasos = [...lista.matchAll(/, '(orden|datos|equipo|cable|conectores|cierre)'|, (pasoDeNap),/g)].map((m) => m[1] || m[2]);
  return pasos.filter((p, i, todos) => p !== todos[i - 1]);
})(), ['orden', 'datos', 'equipo', 'pasoDeNap', 'cable', 'conectores', 'cierre']);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
