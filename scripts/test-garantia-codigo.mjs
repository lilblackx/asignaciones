// Prueba que una garantía toma el código de la orden original (src/utils/garantia.js) y que el código anterior de una orden se puede recuperar del historial (src/utils/correlativo.js).
import { codigosParaGarantia, errorCodigoGarantia, esTipoGarantia } from '../src/utils/garantia.js';
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
