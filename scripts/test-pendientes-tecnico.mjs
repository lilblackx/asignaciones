// Prueba lo que le indica al técnico que tiene una orden finalizada por completar (el pago del cliente y/o las fotos): qué le falta (src/utils/pendientesTecnico.js), que la orden siga en su lista "Activas" (arriba de todas)
// y la etiqueta "Falta: …" de cada tarjeta. Las fotos solo se piden en las instalaciones: una avería o una visita solo espera el pago (si lleva cobro) o nada. No hay un aviso aparte arriba de la lista (ocupaba mucho espacio).
// Dibuja de verdad (en el servidor, sin navegador) el hook de la lista y la etiqueta. No necesita el emulador.
// Uso: `npm run test:pendientes`.
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { esPendienteDelTecnico, faltantesDelTecnico, pendientesDelTecnicoPrimero, textoFaltante } from '../src/utils/pendientesTecnico.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const OPC = { desde: '2026-11-13' };
const FINALIZADA = Date.parse('2026-11-14T15:00:00-04:00');
const ANTES = Date.parse('2026-11-12T15:00:00-04:00');
const foto = (n) => ({ ruta: `ordenes/T1/0${n}-abc.jpg`, bytes: 250000 });
const fotos = { fotos: [foto(1), foto(2)], subidoPor: 'jose', subidoEn: FINALIZADA };
const pago = { tipo: 'DESPUES', pago: null, nota: 'Paga el viernes', compartidoCon: null, monedaDistinta: false, diferencia: false, registradoPor: 'jose', registradoEn: FINALIZADA };
// Una avería sin cobro no espera nada; una avería con cobro, solo el pago; una instalación, el pago (lo que pagó el cliente) y las fotos.
const sinCobro = { id: 'T1', codigo: 'AO7', nombre: 'Ana', tecnico: 'JOSE', tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'FINALIZADO', finalizadoEn: FINALIZADA };
const conCobro = { ...sinCobro, id: 'T2', codigo: 'AO8', cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA', tipoVisita: 'CONECTOR_EXTERNO' };
const instalacion = { ...sinCobro, id: 'T3', codigo: 'AI9', tipoTrabajo: 'INSTALACIÓN', falla: 'SM' };

// --- Qué le falta ---
check('una instalación sin pago ni fotos espera las dos cosas', [faltantesDelTecnico(instalacion, OPC), textoFaltante(instalacion, OPC)], [['PAGO', 'DETALLES'], 'pago del cliente y fotos']);
check('una avería sin cobro no espera nada: las fotos solo se piden en las instalaciones', [faltantesDelTecnico(sinCobro, OPC), esPendienteDelTecnico(sinCobro, OPC), textoFaltante(sinCobro, OPC)], [[], false, '']);
check('una avería con cobro sin pago solo espera el pago, no las fotos', [faltantesDelTecnico(conCobro, OPC), textoFaltante(conCobro, OPC)], [['PAGO'], 'pago del cliente']);
check('con el pago registrado, la avería con cobro ya no espera nada', [faltantesDelTecnico({ ...conCobro, pagoCliente: pago }, OPC), esPendienteDelTecnico({ ...conCobro, pagoCliente: pago }, OPC)], [[], false]);
check('con el pago registrado, a la instalación solo le faltan las fotos', [faltantesDelTecnico({ ...instalacion, pagoCliente: pago }, OPC), textoFaltante({ ...instalacion, pagoCliente: pago }, OPC)], [['DETALLES'], 'fotos']);
check('con las fotos y sin el pago, a la instalación solo le falta el pago', [faltantesDelTecnico({ ...instalacion, detallesOrden: fotos }, OPC), textoFaltante({ ...instalacion, detallesOrden: fotos }, OPC)], [['PAGO'], 'pago del cliente']);
check('con todo completo no falta nada y ya no es pendiente', [faltantesDelTecnico({ ...instalacion, pagoCliente: pago, detallesOrden: fotos }, OPC), esPendienteDelTecnico({ ...instalacion, pagoCliente: pago, detallesOrden: fotos }, OPC)], [[], false]);
check('una sola foto no cuenta: a la instalación siguen faltándole las fotos', faltantesDelTecnico({ ...instalacion, pagoCliente: pago, detallesOrden: { ...fotos, fotos: [foto(1)] } }, OPC), ['DETALLES']);
check('solo cuenta una orden finalizada (pendiente, pre-finalizada o cancelada no)', ['PENDIENTE', 'PRE-FINALIZADO', 'CANCELADO'].map((estado) => esPendienteDelTecnico({ ...instalacion, estado }, OPC)), [false, false, false]);
check('lo finalizado antes de la fecha de inicio no se pide, y sin orden tampoco', [esPendienteDelTecnico({ ...instalacion, finalizadoEn: ANTES }, OPC), esPendienteDelTecnico(null, OPC), faltantesDelTecnico(undefined, OPC)], [false, false, []]);
check('las pendientes van primero sin cambiar el orden entre ellas ni el del resto', pendientesDelTecnicoPrimero([
  { id: 'a', estado: 'PENDIENTE' }, { ...instalacion, id: 'b' }, { id: 'c', estado: 'PRE-FINALIZADO' }, { ...conCobro, id: 'd' }, { ...instalacion, id: 'e', pagoCliente: pago, detallesOrden: fotos }, { ...sinCobro, id: 'f' },
], OPC).map((t) => t.id), ['b', 'd', 'a', 'c', 'e', 'f']);

// --- Dibujado real: la lista del técnico y la etiqueta ---
const servidor = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false }, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const cargar = async (ruta) => (await servidor.ssrLoadModule(ruta)).default ?? servidor.ssrLoadModule(ruta);
const textoPlano = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
try {
  // Con la fecha de hoy en la prueba, las órdenes de arriba (de noviembre de 2026) deben contar: se usa la fecha de inicio por defecto con una orden de dentro de unos días, como las demás pruebas.
  const futura = Date.now() + 2 * 24 * 3600 * 1000;
  const hoy = (o) => ({ ...o, finalizadoEn: futura });
  const lista = [
    { id: 'p1', codigo: 'P1', nombre: 'Pendiente', estado: 'PENDIENTE', tecnico: 'JOSE', fecha: '14/11/2026', createdAt: 1 },
    { id: 'p2', codigo: 'P2', nombre: 'Pre', estado: 'PRE-FINALIZADO', tecnico: 'JOSE', fecha: '14/11/2026', createdAt: 2 },
    // Instalación con el pago registrado: solo faltan las fotos.
    { ...hoy(instalacion), id: 'f1', codigo: 'F1', fecha: '14/11/2026', createdAt: 3, pagoCliente: pago },
    // Instalación completa (pago y fotos).
    { ...hoy(instalacion), id: 'f2', codigo: 'F2', fecha: '14/11/2026', createdAt: 4, pagoCliente: pago, detallesOrden: fotos },
    { id: 'c1', codigo: 'C1', nombre: 'Cancelada', estado: 'CANCELADO', tecnico: 'JOSE', fecha: '14/11/2026', createdAt: 5 },
    // Avería sin cobro, finalizada: ya no pide fotos y no le falta nada.
    { ...hoy(sinCobro), id: 'f3', codigo: 'F3', fecha: '14/11/2026', createdAt: 6 },
    // Avería con cobro sin pago: solo falta el pago.
    { ...hoy(conCobro), id: 'f4', codigo: 'F4', fecha: '14/11/2026', createdAt: 7 },
  ];
  const hookModulo = await servidor.ssrLoadModule('/src/hooks/useFilteredTickets.js');
  const Probe = ({ opciones }) => {
    const r = hookModulo.useFilteredTickets(lista, opciones);
    return createElement('pre', null, JSON.stringify(r.filteredTickets.map((t) => t.id)));
  };
  const ids = (opciones) => JSON.parse(textoPlano(renderToString(createElement(Probe, { opciones }))).replace(/&quot;/g, '"'));
  check('el técnico ve en "Activas" sus pendientes de completar, arriba de todas (y no la finalizada completa, la avería sin nada pendiente ni la cancelada)', ids({ ocultarProgramadasFuturas: true, incluirPendientesDelTecnico: true }), ['f1', 'f4', 'p1', 'p2']);
  check('sin la opción (la oficina) las finalizadas no salen en "Activas"', ids({ preFinalizadasArriba: true }), ['p2', 'p1']);

  const Etiqueta = await cargar('/src/components/FaltaPorCompletar.jsx');
  const etiqueta = (ticket) => renderToString(createElement(Etiqueta, { ticket }));
  check('la etiqueta de la tarjeta dice qué falta (pago, fotos o las dos) y no sale en una orden completa ni en una avería sin nada pendiente', [
    textoPlano(etiqueta(hoy(instalacion))),
    textoPlano(etiqueta(hoy({ ...instalacion, pagoCliente: pago }))),
    textoPlano(etiqueta(hoy(conCobro))),
    etiqueta(hoy({ ...instalacion, pagoCliente: pago, detallesOrden: fotos })),
    etiqueta(hoy(sinCobro)),
  ], ['Falta: pago del cliente y fotos', 'Falta: fotos', 'Falta: pago del cliente', '', '']);
} finally {
  await servidor.close();
}

// --- Todo conectado ---
const leer = (ruta) => readFileSync(ruta, 'utf8');
const app = leer('src/App.jsx');
check('App: la lista del técnico incluye sus pendientes (y la oficina no)', [app.includes('incluirPendientesDelTecnico: isTecnico'), app.includes('preFinalizadasArriba: canEditTickets, incluirPendientesDelTecnico: isTecnico')], [true, true]);
check('no hay un aviso grande arriba de la lista del técnico: la indicación es la etiqueta en cada orden', [app.includes('AvisoPendientesTecnico'), existsSync('src/components/AvisoPendientesTecnico.jsx')], [false, false]);
check('la etiqueta está en las tarjetas del celular y en las filas de la tabla, solo para el técnico', [leer('src/components/TicketsMobileList.jsx').includes('{isTecnico && <FaltaPorCompletar ticket={ticket} />}'), leer('src/components/TicketsTable.jsx').includes('{isTecnico && <FaltaPorCompletar ticket={ticket} />}')], [true, true]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
process.exit(0);
