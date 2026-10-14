// Prueba la normalización y el texto de copia de las formas de pago (src/utils/formasPago.js).
// No necesita el emulador. Uso: `npm run test:formas`.
import { FORMAS_PAGO_INICIALES, TIPOS_AGREGABLES, TIPO_BINANCE, TIPO_CUENTA, TIPO_PAGO_MOVIL, TIPO_ZELLE, formaVacia, nombreForma, normalizarFormasPago, textoCobroParaCliente, textoForma, textoTodasLasFormas } from '../src/utils/formasPago.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}\n      esperado ${e}, llegó ${a}`);
  }
}

const pagoMovil = FORMAS_PAGO_INICIALES[0];
const mercantil = FORMAS_PAGO_INICIALES[1];

check('sin documento no hay formas de pago', normalizarFormasPago(null), []);
check('documento sin "formas" no hay formas de pago', normalizarFormasPago({}), []);
check('los datos iniciales ya vienen normalizados', normalizarFormasPago({ formas: FORMAS_PAGO_INICIALES }), FORMAS_PAGO_INICIALES);
check('hay un pago móvil y tres cuentas, cada cuenta con su titular y RIF',
  FORMAS_PAGO_INICIALES.map(f => [f.tipo, Boolean(f.titular && f.rif) || f.tipo === TIPO_PAGO_MOVIL]),
  [[TIPO_PAGO_MOVIL, true], [TIPO_CUENTA, true], [TIPO_CUENTA, true], [TIPO_CUENTA, true]]);
check('recorta espacios y completa campos que faltan',
  normalizarFormasPago({ formas: [{ tipo: TIPO_CUENTA, banco: '  Banesco ', numero: ' 0134 ' }] }),
  [{ tipo: TIPO_CUENTA, banco: 'Banesco', numero: '0134', titular: '', rif: '' }]);
check('descarta tipos desconocidos y tarjetas sin ningún dato',
  normalizarFormasPago({ formas: [{ tipo: 'CRIPTO', banco: 'X' }, formaVacia(TIPO_CUENTA), { tipo: TIPO_PAGO_MOVIL, banco: '   ' }, null] }),
  []);
check('no copia campos de otro tipo (un pago móvil no lleva número de cuenta)',
  normalizarFormasPago({ formas: [{ tipo: TIPO_PAGO_MOVIL, banco: 'BNC', numero: '123' }] }),
  [{ tipo: TIPO_PAGO_MOVIL, banco: 'BNC', telefono: '', rif: '' }]);

check('texto de un pago móvil', textoForma(pagoMovil),
  '*Pago Móvil*\nBanco: Banco Nacional de Crédito (BNC)\nTeléfono: 0412-1009927\nRIF: J-295330804');
check('texto de una cuenta bancaria', textoForma(mercantil),
  '*Transferencia bancaria*\nBanco: Banco Mercantil\nNúmero de cuenta: 0105-0067-21-1067577920\nTitular: Network Speed, C.A\nRIF: J-295330804');
check('el texto omite los campos vacíos', textoForma({ ...mercantil, titular: '', rif: '' }),
  '*Transferencia bancaria*\nBanco: Banco Mercantil\nNúmero de cuenta: 0105-0067-21-1067577920');
check('todas las formas van separadas por una línea en blanco',
  textoTodasLasFormas([pagoMovil, mercantil]), `${textoForma(pagoMovil)}\n\n${textoForma(mercantil)}`);

check('nombre de una cuenta es su banco', nombreForma(mercantil), 'Banco Mercantil');
check('nombre de un pago móvil es su título', nombreForma(pagoMovil), 'Pago Móvil');
check('cuenta sin banco usa el título', nombreForma(formaVacia(TIPO_CUENTA)), 'Transferencia bancaria');

const zelle = { tipo: TIPO_ZELLE, correo: 'pagos@empresa.com', titular: 'Network Speed LLC' };
const binance = { tipo: TIPO_BINANCE, correo: 'cripto@empresa.com', payId: '123456789', titular: 'Network Speed' };

check('Zelle y Binance se guardan tal cual', normalizarFormasPago({ formas: [zelle, binance] }), [zelle, binance]);
check('Zelle recorta espacios y no copia campos de otro tipo (ni el Pay ID de Binance)',
  normalizarFormasPago({ formas: [{ tipo: TIPO_ZELLE, correo: ' pagos@empresa.com ', payId: '1', banco: 'X' }] }),
  [{ tipo: TIPO_ZELLE, correo: 'pagos@empresa.com', titular: '' }]);
check('una tarjeta Zelle o Binance vacía se descarta',
  normalizarFormasPago({ formas: [formaVacia(TIPO_ZELLE), formaVacia(TIPO_BINANCE)] }), []);
check('texto de Zelle', textoForma(zelle), '*Zelle*\nCorreo o teléfono: pagos@empresa.com\nTitular: Network Speed LLC');
check('texto de Binance', textoForma(binance),
  '*Binance*\nCorreo: cripto@empresa.com\nBinance Pay ID: 123456789\nTitular: Network Speed');
check('el texto de Binance omite el Pay ID si no lo hay', textoForma({ ...binance, payId: '' }),
  '*Binance*\nCorreo: cripto@empresa.com\nTitular: Network Speed');
check('nombre de Zelle y de Binance es su título', [nombreForma(zelle), nombreForma(binance)], ['Zelle', 'Binance']);
check('el ADMIN puede agregar los cuatro tipos',
  TIPOS_AGREGABLES.map(t => t.tipo), [TIPO_PAGO_MOVIL, TIPO_CUENTA, TIPO_ZELLE, TIPO_BINANCE]);

// --- Mensaje del cobro para el cliente ---
check('con formas de pago: el monto y luego todas las formas',
  textoCobroParaCliente('5.696', [pagoMovil, mercantil]), `Monto a cancelar: 5.696 Bs\n\n${textoTodasLasFormas([pagoMovil, mercantil])}`);
check('sin formas de pago: solo el monto', textoCobroParaCliente('12.345,5', []), 'Monto a cancelar: 12.345,5 Bs');

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
