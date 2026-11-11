// Prueba que una garantía del mismo técnico toma el código de la orden original y una garantía de otro técnico toma un número nuevo (src/utils/garantia.js) y que el código anterior de una orden se puede recuperar del historial (src/utils/correlativo.js).
import { readFileSync } from 'node:fs';
import { codigoManualDeOrdenNueva, codigosParaGarantia, errorCodigoGarantia, esTipoGarantia, llevaCodigoDeOriginal, tecnicoDeOriginal } from '../src/utils/garantia.js';
import { codigosAnteriores } from '../src/utils/correlativo.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

check('reconoce el tipo GARANTIA con o sin tilde y en minúsculas', ['GARANTIA', 'garantía', ' Garantia ', 'AVERÍA', ''].map(esTipoGarantia), [true, true, true, false, false]);

const ordenes = [
  { id: '1', codigo: 'IO96', tipoTrabajo: 'INSTALACIÓN', cedula: 'V-18.395.753', createdAt: 100, estado: 'FINALIZADO', tecnico: 'ABRAHAM' },
  { id: '2', codigo: 'AO275', tipoTrabajo: 'AVERÍA', cedula: '18395753', createdAt: 300, estado: 'FINALIZADO', tecnico: 'REINEL' },
  { id: '3', codigo: 'AO275', tipoTrabajo: 'AVERÍA', cedula: '18395753', createdAt: 200, estado: 'FINALIZADO', tecnico: 'REINEL' },
  { id: '4', codigo: 'AO275', tipoTrabajo: 'GARANTIA', cedula: '18395753', createdAt: 400, estado: 'PENDIENTE', tecnico: 'REINEL' },
  { id: '5', codigo: 'IO', tipoTrabajo: 'INSTALACIÓN', cedula: '18395753', createdAt: 500, estado: 'PENDIENTE', tecnico: '' },
  { id: '6', codigo: 'AO12', tipoTrabajo: 'AVERÍA', cedula: '12345678', createdAt: 600, estado: 'FINALIZADO', tecnico: 'ABRAHAM' },
  { id: '7', tipoTrabajo: 'AVERÍA', cedula: '18395753', createdAt: 700 },
];
const candidatas = codigosParaGarantia(ordenes, '18.395.753');
check('ofrece los códigos del cliente, el más reciente primero, sin repetir', candidatas.map((c) => c.codigo), ['AO275', 'IO96']);
check('no ofrece garantías, instalaciones sin número, órdenes sin código ni de otros clientes', candidatas.some((c) => ['IO', 'AO12', undefined].includes(c.codigo)), false);
check('con una cédula incompleta no ofrece nada', codigosParaGarantia(ordenes, '123'), []);
check('limita la cantidad', codigosParaGarantia(ordenes, '18395753', 1).length, 1);

const MENSAJE = 'Una garantía lleva el código de la orden original. Elige una de las órdenes del cliente o escribe el código.';
check('garantía sin código y con órdenes del cliente: pide el código', errorCodigoGarantia('GARANTIA', '', candidatas), MENSAJE);
check('con el código escrito, no hay error', errorCodigoGarantia('GARANTIA', 'AO275', candidatas), '');
check('garantía de un cliente sin órdenes anteriores: puede quedar vacío (número nuevo)', errorCodigoGarantia('GARANTIA', '', []), '');
check('otros tipos de trabajo no piden código', errorCodigoGarantia('AVERÍA', '', candidatas), '');

check('el técnico de la original sale del código, sin importar mayúsculas', tecnicoDeOriginal(ordenes, ' ao275 ', '18395753'), 'REINEL');
check('ignora garantías: IO96 es de ABRAHAM', tecnicoDeOriginal(ordenes, 'IO96', ''), 'ABRAHAM');
check('prefiere la orden del mismo cliente', tecnicoDeOriginal([...ordenes, { id: '8', codigo: 'IO96', tipoTrabajo: 'INSTALACIÓN', cedula: '999999999', createdAt: 900, tecnico: 'OTRO' }], 'IO96', '18395753'), 'ABRAHAM');
check('código sin número, vacío o inexistente: sin técnico', [tecnicoDeOriginal(ordenes, 'IO', ''), tecnicoDeOriginal(ordenes, '', ''), tecnicoDeOriginal(ordenes, 'ZZ1', '')], ['', '', '']);

// --- Garantía de otro técnico: es una orden nueva para otro técnico, con su propio número según su tipo (no el código de la original) ---
const marcadaSinOriginal = { id: '' };
const conOriginal = { id: 'abc', codigo: 'AO275', tecnico: 'REINEL', cliente: 'X' };
check('una GARANTIA sin el check de otro técnico reutiliza el código de la original', llevaCodigoDeOriginal('GARANTIA', null), true);
check('con el check marcado (aunque aún sin original elegida) o con la original elegida, no lo reutiliza', [llevaCodigoDeOriginal('GARANTIA', marcadaSinOriginal), llevaCodigoDeOriginal('GARANTIA', conOriginal)], [false, false]);
check('otros tipos de trabajo nunca reutilizan el código de la original', ['AVERÍA', 'INSTALACIÓN', 'RECONEXIÓN'].map((t) => llevaCodigoDeOriginal(t, null)), [false, false, false]);
check('en una garantía de otro técnico no se pide el código de la original', [errorCodigoGarantia('GARANTIA', '', candidatas, conOriginal), errorCodigoGarantia('GARANTIA', '', candidatas, marcadaSinOriginal)], ['', '']);
check('sin el check se sigue pidiendo (el argumento nuevo es opcional)', [errorCodigoGarantia('GARANTIA', '', candidatas, null), errorCodigoGarantia('GARANTIA', '', candidatas)], [MENSAJE, MENSAJE]);
check('al guardar, una GARANTIA de otro técnico con su original descarta el código escrito y toma el número automático', codigoManualDeOrdenNueva('GARANTIA', 'AO275', conOriginal), '');
check('al guardar, una GARANTIA del mismo técnico conserva el código de la original', codigoManualDeOrdenNueva('GARANTIA', ' ao275 ', null), 'ao275');
check('un código escrito en otro tipo de orden se respeta, aunque lleve el check', [codigoManualDeOrdenNueva('AVERÍA', 'AO300', conOriginal), codigoManualDeOrdenNueva('AVERÍA', '', conOriginal)], ['AO300', '']);

// Conexión: el formulario y el guardado usan estas reglas (no se prueba con el emulador: el número lo asigna utils/correlativo.js como en cualquier orden del tipo).
const formulario = readFileSync(new URL('../src/components/modals/CreateTicketModal.jsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../src/hooks/useTickets.js', import.meta.url), 'utf8');
check('el formulario solo ofrece y exige el código de la original cuando no hay garantía de otro técnico', formulario.includes('llevaCodigoDeOriginal(formData.tipoTrabajo, formData.garantiaDe)') && formulario.includes('usaCodigoOriginal ? codigosParaGarantia('), true);
check('el formulario no asigna el técnico de la original en una garantía de otro técnico', formulario.includes('const codigo = usaCodigoOriginal ?'), true);
check('al marcar el check se quita el código de la original ya elegido', formulario.includes("if (value && esGarantiaTipo && formData.codigo) handleCreateChange({ target: { name: 'codigo', value: '', type: 'text' } });"), true);
check('al crear la orden se descarta el código de la original en una garantía de otro técnico', hook.includes('const codigoManual = codigoManualDeOrdenNueva(formData.tipoTrabajo, formData.codigo, formData.garantiaDe);'), true);

const orden = {
  historialEdiciones: [
    { fecha: '24/10/26 11:40', operador: 'svivenes', detalle: 'Técnico: Sin asignar → ABRAHAM' },
    { fecha: '24/10/26 11:41', operador: 'svivenes', detalle: 'Cód: AO299 → IO100' },
    { fecha: '24/10/26 11:50', operador: 'svivenes', detalle: 'Obs. modificada | Cód: IO100 → IO101' },
    { fecha: '24/10/26 11:55', operador: 'svivenes', detalle: 'Cód: IO102' },
  ],
};
check('recupera los códigos anteriores del historial, en orden', codigosAnteriores(orden), ['AO299', 'IO100']);
check('sin historial no hay códigos anteriores', [codigosAnteriores({}), codigosAnteriores(null), codigosAnteriores({ historialEdiciones: [] })], [[], [], []]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
