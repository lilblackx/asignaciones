// Prueba las visitas combinadas con cambio de equipo (Recableado + cambio de equipo, Reconexión + cambio de equipo y Conector interno + cambio de equipo):
// que aparezcan en el desplegable, que pidan el tipo y el serial del equipo nuevo (obligatorios), que hagan además lo de su visita de base, que el envío al
// inventario lleve el material y el serial, y que Finanzas las pague con la mayor de las dos tarifas. No necesita el emulador. Uso: `npm run test:combinadas`.
import {
  TIPOS_VISITA, TIPO_CAMBIO_EQUIPO, TIPO_CONECTOR_EXTERNO, TIPO_CONECTOR_INTERNO, TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO, TIPO_RECABLEADO, TIPO_RECABLEADO_CAMBIO_EQUIPO, TIPO_RECONEXION,
  TIPO_RECONEXION_CAMBIO_EQUIPO, avisaCobroAlPreFinalizar, datosConectores, datosSerialEquipo, errorTipoEquipoNuevo, esCambioEquipo, esReconexion, esRecableado, esVisitaConector,
  etiquetaTipoVisita, generaCobro, llevaConectores, parseSerialEquipo, pideNapPuertoVisita, pideSerialEquipo, tipoBase,
} from '../src/utils/tipoVisita.js';
import { payloadEnvioInventario } from '../src/utils/envioInventario.js';
import { conectoresPorColor, esCambioEquipoFinalizado, esRecableadoFinalizado, esVisitaConectorFinalizada } from '../src/utils/consumoMateriales.js';
import { conceptoDePago, ordenesPagables } from '../src/utils/finanzas.js';
import { datosParaConfirmar } from '../src/utils/confirmarPreFinalizar.js';
import { datosAutorizacion } from '../src/utils/datosAutorizacion.js';
import { textoAuditoria } from '../cf-worker/src/inventario.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const COMBINADAS = [TIPO_RECABLEADO_CAMBIO_EQUIPO, TIPO_RECONEXION_CAMBIO_EQUIPO, TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO];

// --- En el desplegable ---
check('las tres combinaciones están en el mismo desplegable, con su nombre',
  TIPOS_VISITA.filter((t) => COMBINADAS.includes(t.value)).map((t) => t.label),
  ['Recableado + cambio de equipo', 'Reconexión + cambio de equipo', 'Conector interno + cambio de equipo']);
check('su etiqueta es la del desplegable', COMBINADAS.map(etiquetaTipoVisita), ['Recableado + cambio de equipo', 'Reconexión + cambio de equipo', 'Conector interno + cambio de equipo']);
check('el valor guardado cabe en el límite de 60 letras de las reglas', COMBINADAS.every((t) => t.length <= 60), true);

// --- Qué visita de base hace cada una ---
check('la visita de base de cada combinación', COMBINADAS.map(tipoBase), [TIPO_RECABLEADO, TIPO_RECONEXION, TIPO_CONECTOR_INTERNO]);
check('un tipo que no es combinación es su propia base', [TIPO_RECABLEADO, TIPO_CAMBIO_EQUIPO, TIPO_CONECTOR_EXTERNO, ''].map(tipoBase), [TIPO_RECABLEADO, TIPO_CAMBIO_EQUIPO, TIPO_CONECTOR_EXTERNO, '']);
check('las tres piden el equipo nuevo (cambio de equipo) y su serial', [COMBINADAS.map(esCambioEquipo), COMBINADAS.map(pideSerialEquipo)], [[true, true, true], [true, true, true]]);
check('el recableado y la reconexión simples NO piden cambio de equipo', [TIPO_RECABLEADO, TIPO_RECONEXION, TIPO_CONECTOR_INTERNO].map(esCambioEquipo), [false, false, false]);
check('recableado + cambio lleva metros y conectores; reconexión + cambio es reconexión; conector interno + cambio es visita de conector con cobro',
  [esRecableado(TIPO_RECABLEADO_CAMBIO_EQUIPO), llevaConectores(TIPO_RECABLEADO_CAMBIO_EQUIPO), esReconexion(TIPO_RECONEXION_CAMBIO_EQUIPO), esVisitaConector(TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO), generaCobro(TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO), avisaCobroAlPreFinalizar(TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO)],
  [true, true, true, true, true, true]);
check('recableado + cambio pide NAP y puerto como el recableado; las otras dos no',
  COMBINADAS.map(pideNapPuertoVisita), [true, false, false]);

// --- El serial y el tipo del equipo nuevo son obligatorios en las tres ---
check('sin tipo de equipo nuevo hay error en las tres; con tipo no', [COMBINADAS.map((t) => errorTipoEquipoNuevo(t, '')), COMBINADAS.map((t) => errorTipoEquipoNuevo(t, 'SM'))],
  [Array(3).fill('Elige el tipo del equipo nuevo.'), ['', '', '']]);
check('sin serial hay error y dice "equipo nuevo" también en la reconexión combinada',
  [parseSerialEquipo('', TIPO_RECABLEADO_CAMBIO_EQUIPO).error, parseSerialEquipo('', TIPO_RECONEXION_CAMBIO_EQUIPO).error, parseSerialEquipo('', TIPO_RECONEXION).error],
  ['Escribe el serial del equipo nuevo.', 'Escribe el serial del equipo nuevo.', 'Escribe el serial del equipo.']);
check('se guardan el serial y el tipo del equipo nuevo en las tres', COMBINADAS.map((t) => datosSerialEquipo(t, 'vsol00b995a6', 'SM')), Array(3).fill({ serialEquipo: 'VSOL00B995A6', tipoEquipoNuevo: 'SM' }));
check('el recableado simple no guarda ni serial ni tipo (borra uno anterior)', datosSerialEquipo(TIPO_RECABLEADO, 'VSOL00B995A6', 'SM'), { serialEquipo: '', tipoEquipoNuevo: '' });

// --- Lo de su visita de base sigue guardándose ---
check('recableado + cambio guarda los metros y los conectores del recableado',
  datosConectores(TIPO_RECABLEADO_CAMBIO_EQUIPO, { metros: 180, metrajeInicial: 10, metrajeFinal: 190, conectorExterno: 'VERDE', conectorInterno: 'VERDE' }),
  datosConectores(TIPO_RECABLEADO, { metros: 180, metrajeInicial: 10, metrajeFinal: 190, conectorExterno: 'VERDE', conectorInterno: 'VERDE' }));
check('conector interno + cambio guarda las cantidades de conectores del conector interno',
  datosConectores(TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO, { conectores: { verde: 1, azul: 1 } }), datosConectores(TIPO_CONECTOR_INTERNO, { conectores: { verde: 1, azul: 1 } }));

// --- Envío al inventario ---
const base = { id: 'x1', codigo: 'AN10', nombre: 'Leonela Hernandez', tecnico: 'ABRAHAM', estado: 'FINALIZADO', finalizadoEn: 1793000000000, serialEquipo: 'VSOL00B994DA', tipoEquipoNuevo: 'SM' };
const recableadoCambio = { ...base, tipoTrabajo: 'AVERÍA', tipoVisita: TIPO_RECABLEADO_CAMBIO_EQUIPO, metrosCable: 180, conectorExterno: 'VERDE', conectorInterno: 'VERDE' };
const conectorCambio = { ...base, codigo: 'AO225', tipoTrabajo: 'AVERÍA', tipoVisita: TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO, conectoresUsados: { verde: 1, azul: 0 }, serialEquipo: 'GPONZXICC9BA671A' };
const reconexionCambio = { ...base, codigo: 'AN99', tipoTrabajo: 'AVERÍA', tipoVisita: TIPO_RECONEXION_CAMBIO_EQUIPO };
const recableadoSolo = { ...recableadoCambio, tipoVisita: TIPO_RECABLEADO, serialEquipo: '', tipoEquipoNuevo: '' };

const pRec = payloadEnvioInventario(recableadoCambio);
check('recableado + cambio: una avería con el material Y el serial del equipo nuevo',
  [pRec.accion, pRec.serial, pRec.apc, pRec.upc, pRec.dropMetros, pRec.motivo], ['averia', 'VSOL00B994DA', 2, 0, 180, 'Recableado + cambio de equipo - Orden #AN10']);
const pCon = payloadEnvioInventario(conectorCambio);
check('conector interno + cambio: una avería con los conectores y el serial (el de la caja se convierte al de la OLT)',
  [pCon.accion, pCon.serial, pCon.apc, pCon.upc, pCon.dropMetros], ['averia', 'ZXICC9BA671A', 1, 0, 0]);
const pRecx = payloadEnvioInventario(reconexionCambio);
check('reconexión + cambio: un cambio de equipo con el serial y sin material', [pRecx.accion, pRecx.serial, pRecx.apc, pRecx.upc, pRecx.dropMetros], ['cambio_equipo', 'VSOL00B994DA', 0, 0, 0]);
check('el recableado simple sigue siendo una avería sin serial', [payloadEnvioInventario(recableadoSolo).accion, payloadEnvioInventario(recableadoSolo).serial, payloadEnvioInventario(recableadoSolo).motivo], ['averia', '', 'Recableado - Orden #AN10']);
check('qué orden es cada una para los conteos de materiales',
  [esRecableadoFinalizado(recableadoCambio), esCambioEquipoFinalizado(recableadoCambio), esVisitaConectorFinalizada(conectorCambio), esCambioEquipoFinalizado(conectorCambio), esCambioEquipoFinalizado(reconexionCambio)],
  [true, false, true, false, true]);
check('los conectores de las combinaciones se cuentan por color', [conectoresPorColor(recableadoCambio), conectoresPorColor(conectorCambio)], [{ verde: 2, azul: 0 }, { verde: 1, azul: 0 }]);
check('la auditoría del almacén dice qué equipo se cambió en la avería', textoAuditoria({ ...pRec, tecnico: 'ABRAHAM FERNANDEZ' }).detalle.includes('Equipo cambiado: Serial [VSOL00B994DA]'), true);
check('la auditoría de una avería sin cambio de equipo no cambia', textoAuditoria({ ...payloadEnvioInventario(recableadoSolo), tecnico: 'ABRAHAM FERNANDEZ' }).detalle.includes('Equipo cambiado'), false);

// --- Pago al técnico: la mayor de las dos tarifas ---
const DIA = (n) => Date.UTC(2026, 10, n, 16, 0, 0);
const pagada = (extra) => ({ id: 'p1', codigo: 'AN10', nombre: 'Cliente', estado: 'FINALIZADO', tecnico: 'ABRAHAM', createdAt: DIA(1), finalizadoEn: DIA(2), tipoTrabajo: 'AVERÍA', cobroBs: null, cobroTipo: 'EXONERADO', ...extra });
const tarifaCambioMayor = { RECABLEADO: 10, AVERIA: 6, CAMBIO_EQUIPO: 12 };
const tarifaCambioMenor = { RECABLEADO: 10, AVERIA: 6, CAMBIO_EQUIPO: 4 };
const oRec = pagada({ tipoVisita: TIPO_RECABLEADO_CAMBIO_EQUIPO });
const oRecx = pagada({ tipoVisita: TIPO_RECONEXION_CAMBIO_EQUIPO });
const oCon = pagada({ tipoVisita: TIPO_CONECTOR_INTERNO_CAMBIO_EQUIPO });
check('recableado + cambio: gana la más alta (cambio de equipo 12 > recableado 10)', conceptoDePago(oRec, 'AVERIAS', null, tarifaCambioMayor), 'CAMBIO_EQUIPO');
check('recableado + cambio: gana la más alta (recableado 10 > cambio de equipo 4)', conceptoDePago(oRec, 'AVERIAS', null, tarifaCambioMenor), 'RECABLEADO');
check('reconexión y conector interno + cambio se comparan contra la tarifa de avería',
  [oRecx, oCon].map((o) => [conceptoDePago(o, 'AVERIAS', null, tarifaCambioMayor), conceptoDePago(o, 'AVERIAS', null, tarifaCambioMenor)]), [['CAMBIO_EQUIPO', 'AVERIA'], ['CAMBIO_EQUIPO', 'AVERIA']]);
check('en empate se queda con la de su visita', conceptoDePago(oRec, 'AVERIAS', null, { RECABLEADO: 8, CAMBIO_EQUIPO: 8 }), 'RECABLEADO');
check('sin tarifas se queda con la de su visita', [oRec, oRecx].map((o) => conceptoDePago(o, 'AVERIAS')), ['RECABLEADO', 'AVERIA']);
check('una orden combinada se paga una sola vez (un solo concepto en la lista de pagables)',
  ordenesPagables([oRec], { desde: '2026-11-01', hasta: '2026-11-30' }, { tarifas: tarifaCambioMayor }).map((i) => i.concepto), ['CAMBIO_EQUIPO']);
check('un recableado simple y un cambio de equipo simple no cambian', [conceptoDePago(pagada({ tipoVisita: TIPO_RECABLEADO }), 'AVERIAS', null, tarifaCambioMayor), conceptoDePago(pagada({ tipoVisita: TIPO_CAMBIO_EQUIPO }), 'AVERIAS', null, tarifaCambioMenor)], ['RECABLEADO', 'CAMBIO_EQUIPO']);

// --- Lo que ve el técnico al confirmar y la oficina al autorizar ---
const confirmar = datosParaConfirmar({ tipoVisita: TIPO_RECABLEADO_CAMBIO_EQUIPO, tipoEquipoNuevo: 'SM', serialEquipo: 'VSOL00B994DA', metrosCable: 180, nap: 'SN - 14 - 5', observacionTecnico: 'x' }).map((f) => f.etiqueta);
check('al confirmar un recableado + cambio se ve el equipo nuevo y los metros', ['Tipo de equipo nuevo', 'Serial del equipo nuevo', 'Metros de cable'].every((e) => confirmar.includes(e)), true);
const confirmarRx = datosParaConfirmar({ tipoVisita: TIPO_RECONEXION_CAMBIO_EQUIPO, tipoEquipoNuevo: 'SM', serialEquipo: 'VSOL00B994DA', observacionTecnico: 'x' }).map((f) => f.etiqueta);
check('al confirmar una reconexión + cambio el serial sale una sola vez, como equipo nuevo', [confirmarRx.filter((e) => e === 'Serial del equipo nuevo').length, confirmarRx.includes('Serial del equipo')], [1, false]);
const autorizar = datosAutorizacion({ ...base, tipoTrabajo: 'AVERÍA', tipoVisita: TIPO_RECONEXION_CAMBIO_EQUIPO });
check('los datos para autorizar muestran el serial una sola vez y como equipo nuevo', [autorizar.equipo?.filter((d) => d.clave === 'serialEquipo').map((d) => d.etiqueta), autorizar.equipo?.some((d) => d.clave === 'tipoEquipoNuevo')], [['Serial del equipo nuevo'], true]);

if (failures > 0) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
