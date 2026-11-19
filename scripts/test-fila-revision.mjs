// Prueba los avisos de una fila de la Revisión de órdenes (src/components/revision/FilaRevision.jsx): cada motivo por el que una orden no se puede aprobar (falta el pago del cliente, faltan las fotos, no tiene concepto
// o técnico, es una garantía sin resolver) se dice una sola vez, y las órdenes que no son instalaciones no esperan fotos. Dibuja de verdad la fila (en el servidor, sin navegador). No necesita el emulador.
// Uso: `npm run test:filarevision`.
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const servidor = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false }, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const textoPlano = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const veces = (texto, re) => (texto.match(re) || []).length;
// Los botones de la fila: su texto y si están apagados.
const botones = (html) => [...html.matchAll(/<button[\s\S]*?<\/button>/g)].map((m) => ({ texto: textoPlano(m[0]), apagado: /\sdisabled=""/.test(m[0].slice(0, m[0].indexOf('>') + 1)) }));
const boton = (html, texto) => botones(html).find((b) => b.texto === texto);

try {
  const Fila = (await servidor.ssrLoadModule('/src/components/revision/FilaRevision.jsx')).default;
  const noop = () => {};
  const futura = Date.now() + 2 * 24 * 3600 * 1000;
  const pago = { tipo: 'DESPUES', pago: null, nota: 'Paga el viernes', compartidoCon: null, monedaDistinta: false, diferencia: false, registradoPor: 'jose', registradoEn: futura };
  const instalacion = { id: 'k1', codigo: 'AI7', nombre: 'Ana', tecnico: 'JOSE', tipoTrabajo: 'INSTALACIÓN', falla: 'SM', estado: 'FINALIZADO', finalizadoEn: futura };
  const item = (extra = {}, orden = {}) => ({
    clave: 'k1', dia: '2026-11-14', concepto: 'INSTALACION', conceptoOriginal: 'INSTALACION', tecnico: 'JOSE', tecnicoOriginal: 'JOSE', firma: 'f',
    estadoRevision: 'PENDIENTE', revision: null, revisionAnterior: null, cambioDespues: false, corregida: false, garantiaDe: null, descuento: 0, descuentoDe: null, garantiaSinDescuento: '', garantiaResuelta: false,
    orden: { ...instalacion, pagoCliente: pago, ...orden }, ...extra,
  });
  const fila = (it, props = {}) => renderToString(createElement(Fila, { item: it, precio: 25, tasa: 40, tecnicos: ['JOSE'], ocupado: false, onAccion: noop, onDeshacer: noop, onVerOrden: noop, onRegistrarPago: noop, ...props }));

  // Instalación con el pago hecho y sin fotos: espera las fotos.
  const sinFotos = fila(item());
  const textoSinFotos = textoPlano(sinFotos);
  check('instalación sin fotos: el aviso de las fotos sale una sola vez y dice qué hacer', [veces(textoSinFotos, /Faltan los detalles de la orden/g), textoSinFotos.includes('o apruébala sin ellos con un motivo')], [1, true]);
  check('instalación sin fotos: "Aprobar" está apagado y "Aprobar sin detalles" disponible', [boton(sinFotos, 'Aprobar')?.apagado, Boolean(boton(sinFotos, 'Aprobar sin detalles')), boton(sinFotos, 'Aprobar sin detalles')?.apagado], [true, true, false]);

  // Instalación sin el pago: espera el pago (primero el pago; las fotos se piden cuando ya esté).
  const sinPago = fila(item({}, { pagoCliente: undefined }));
  const textoSinPago = textoPlano(sinPago);
  check('instalación sin pago: el aviso del pago sale una sola vez, con quién lo registra, qué hacer si no puede y que no se aprueba hasta registrarlo', [
    veces(textoSinPago, /Falta el pago del cliente/g), textoSinPago.includes('Lo registra el técnico (JOSE)'), textoSinPago.includes('si no puede, regístralo tú'), textoSinPago.includes('No se puede aprobar hasta que esté registrado'),
  ], [1, true, true, true]);
  check('instalación sin pago: tiene "Registrar el pago", "Aprobar" apagado, y el aviso de las fotos todavía no (no se aprueba sin el pago y las fotos se piden después)', [Boolean(boton(sinPago, 'Registrar el pago')), boton(sinPago, 'Aprobar')?.apagado, veces(textoSinPago, /Faltan los detalles de la orden/g), Boolean(boton(sinPago, 'Aprobar sin detalles'))], [true, true, 0, false]);

  // Una avería no espera fotos: sin avisos y se aprueba directo.
  const averia = fila(item({ concepto: 'AVERIA', conceptoOriginal: 'AVERIA' }, { tipoTrabajo: 'AVERÍA', falla: 'LOS' }));
  const textoAveria = textoPlano(averia);
  check('avería sin fotos: ningún aviso de fotos ni del pago, sin "Aprobar sin detalles" y "Aprobar" activo', [veces(textoAveria, /Faltan los detalles|Falta el pago/g), Boolean(boton(averia, 'Aprobar sin detalles')), boton(averia, 'Aprobar')?.apagado], [0, false, false]);

  // Lo que no es ni el pago ni las fotos (sin concepto, sin técnico) va debajo de los botones, una vez.
  const sinConcepto = fila(item({ concepto: '', conceptoOriginal: '' }));
  const textoSinConcepto = textoPlano(sinConcepto);
  check('sin concepto: el aviso sale una vez (debajo de los botones), junto al de las fotos que también faltan, y "Aprobar" apagado', [veces(textoSinConcepto, /Elige el concepto con que se paga/g), veces(textoSinConcepto, /Faltan los detalles de la orden/g), boton(sinConcepto, 'Aprobar')?.apagado], [1, 1, true]);
  const sinTecnico = fila(item({ tecnico: '', tecnicoOriginal: '' }, { tecnico: '' }));
  check('sin técnico: el aviso sale una vez', veces(textoPlano(sinTecnico), /La orden no tiene técnico: corrígelo antes de aprobarla/g), 1);
  const variosMotivos = textoPlano(fila(item({ concepto: '', conceptoOriginal: '' }, { pagoCliente: undefined })));
  check('sin concepto y sin pago: cada motivo una sola vez', [veces(variosMotivos, /Falta el pago del cliente/g), veces(variosMotivos, /Elige el concepto con que se paga/g)], [1, 1]);

  // Una garantía sin resolver ya se dice arriba, con la orden original.
  const garantia = textoPlano(fila(item({ garantiaDe: { id: 'g0', codigo: 'AO1', tecnico: 'LUIS' } })));
  check('garantía de otro técnico sin resolver: el aviso sale una sola vez', veces(garantia, /garantía de otro técnico/gi), 1);

  // Lo ya aprobado no vuelve a avisar nada.
  const aprobada = textoPlano(fila(item({ estadoRevision: 'APROBADA', revision: { estado: 'APROBADA', por: 'admin', en: futura } })));
  check('una orden ya aprobada no avisa de lo que le falta', veces(aprobada, /Faltan los detalles|Falta el pago|Elige el concepto/g), 0);
} finally {
  await servidor.close();
}

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
process.exit(0);
