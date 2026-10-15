// Formas de pago de la empresa (config/formasPago). El ADMIN las carga desde la
// pestaña "Formas de pago" del modal de Tasa; el técnico las ve y copia desde
// su propio apartado para pasárselas al cliente.
//
// Cada forma de pago es una tarjeta independiente con sus propios datos: un pago
// móvil, una cuenta bancaria (cada cuenta aparte, con su titular y RIF), una cuenta
// Zelle o una cuenta Binance, de modo que se pueda copiar un dato suelto o todos los
// de una misma forma de pago.

export const TIPO_PAGO_MOVIL = 'PAGO_MOVIL';
export const TIPO_CUENTA = 'CUENTA';
export const TIPO_ZELLE = 'ZELLE';
export const TIPO_BINANCE = 'BINANCE';

export const TITULO_POR_TIPO = {
  [TIPO_PAGO_MOVIL]: 'Pago Móvil',
  [TIPO_CUENTA]: 'Transferencia bancaria',
  [TIPO_ZELLE]: 'Zelle',
  [TIPO_BINANCE]: 'Binance',
};

// Tipos que el ADMIN puede agregar, en el orden de los botones, con su texto.
export const TIPOS_AGREGABLES = [
  { tipo: TIPO_PAGO_MOVIL, etiqueta: 'Pago móvil' },
  { tipo: TIPO_CUENTA, etiqueta: 'Cuenta bancaria' },
  { tipo: TIPO_ZELLE, etiqueta: 'Cuenta Zelle' },
  { tipo: TIPO_BINANCE, etiqueta: 'Cuenta Binance' },
];

// Campos de cada tipo, en el orden en que se muestran y se copian.
export const CAMPOS_POR_TIPO = {
  [TIPO_PAGO_MOVIL]: [
    { clave: 'banco', etiqueta: 'Banco', maxLength: 60 },
    { clave: 'telefono', etiqueta: 'Teléfono', maxLength: 20 },
    { clave: 'rif', etiqueta: 'RIF', maxLength: 20 },
  ],
  [TIPO_CUENTA]: [
    { clave: 'banco', etiqueta: 'Banco', maxLength: 60 },
    { clave: 'numero', etiqueta: 'Número de cuenta', maxLength: 30 },
    { clave: 'titular', etiqueta: 'Titular', maxLength: 60 },
    { clave: 'rif', etiqueta: 'RIF', maxLength: 20 },
  ],
  [TIPO_ZELLE]: [
    { clave: 'correo', etiqueta: 'Correo o teléfono', maxLength: 60 },
    { clave: 'titular', etiqueta: 'Titular', maxLength: 60 },
  ],
  [TIPO_BINANCE]: [
    { clave: 'correo', etiqueta: 'Correo', maxLength: 60 },
    { clave: 'payId', etiqueta: 'Binance Pay ID', maxLength: 30 },
    { clave: 'titular', etiqueta: 'Titular', maxLength: 60 },
  ],
};

export const FORMAS_PAGO_INICIALES = [
  { tipo: TIPO_PAGO_MOVIL, banco: 'Banco Nacional de Crédito (BNC)', telefono: '0412-1009927', rif: 'J-295330804' },
  { tipo: TIPO_CUENTA, banco: 'Banco Mercantil', numero: '0105-0067-21-1067577920', titular: 'Network Speed, C.A', rif: 'J-295330804' },
  { tipo: TIPO_CUENTA, banco: 'Banesco', numero: '0134-0086-54-0861268484', titular: 'Network Speed, C.A', rif: 'J-295330804' },
  { tipo: TIPO_CUENTA, banco: 'Banco Nacional de Crédito', numero: '0191-0312-96-2100014647', titular: 'Network Speed, C.A', rif: 'J-295330804' },
];

const limpiar = (v) => String(v ?? '').trim();

export function formaVacia(tipo) {
  return { tipo, ...Object.fromEntries(CAMPOS_POR_TIPO[tipo].map(({ clave }) => [clave, ''])) };
}

// Devuelve la lista de formas de pago del documento de Firestore con la forma
// esperada, sin fiarse de que traiga todos los campos: descarta tipos
// desconocidos y tarjetas sin ningún dato.
export function normalizarFormasPago(raw) {
  const lista = Array.isArray(raw?.formas) ? raw.formas : [];
  return lista
    .filter(f => CAMPOS_POR_TIPO[f?.tipo])
    .map(f => ({ tipo: f.tipo, ...Object.fromEntries(CAMPOS_POR_TIPO[f.tipo].map(({ clave }) => [clave, limpiar(f[clave])])) }))
    .filter(f => CAMPOS_POR_TIPO[f.tipo].some(({ clave }) => f[clave]));
}

// Nombre corto de una forma de pago, para avisos ("Datos de Banesco copiados").
export function nombreForma(forma) {
  return forma.tipo === TIPO_CUENTA && forma.banco ? forma.banco : TITULO_POR_TIPO[forma.tipo];
}

// Texto listo para pegar en WhatsApp. Una forma de pago:
//   *Transferencia bancaria*
//   Banco: Banesco
//   Número de cuenta: 0134-...
export function textoForma(forma) {
  const lineas = CAMPOS_POR_TIPO[forma.tipo]
    .filter(({ clave }) => forma[clave])
    .map(({ clave, etiqueta }) => `${etiqueta}: ${forma[clave]}`);
  return [`*${TITULO_POR_TIPO[forma.tipo]}*`, ...lineas].join('\n');
}

export function textoTodasLasFormas(formas) {
  return formas.map(textoForma).join('\n\n');
}

// Mensaje para pegarle al cliente: lo que debe cancelar y, si hay, las formas de pago.
export function textoCobroParaCliente(monto, formas, moneda) {
  const texto = `Monto a cancelar: ${monto} ${moneda === 'USD' ? '$' : 'Bs'}`;
  return formas.length > 0 ? `${texto}\n\n${textoTodasLasFormas(formas)}` : texto;
}
