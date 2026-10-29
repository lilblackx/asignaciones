// Prueba el cobro de cada orden para ADMINISTRACION (src/utils/cobrosClientes.js): cuándo se emite, qué lleva, cómo cambia si la orden cambia, lo que hace Administración
// (cargar, devolver, confirmar un cambio de monto) y las listas y resúmenes. No necesita el emulador. Uso: `npm run test:cobroscliente`.
import {
  ESTADO_COBRO, cobroDesdePagoPendiente, armarCarga, armarCobro, armarConfirmacionCambio, armarDevolucionCobro, avisoDeCobro, cantidadPorCargar, cobrosDelPeriodo, diasEsperando, filtrarCobros, ordenarCobros, resumenCobros,
  sincronizarCobro, textoDeCobro, textoParaCopiar,
} from '../src/utils/cobrosClientes.js';

let failures = 0;
function check(name, actual, esperado) {
  // Los montos salen con espacio de no separar: se comparan con espacio normal.
  const a = JSON.stringify(actual)?.replace(/ /g, ' ');
  const e = JSON.stringify(esperado)?.replace(/ /g, ' ');
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const AHORA = Date.parse('2026-10-30T15:00:00-04:00');
const base = { id: 'T1', codigo: 'AO7', nombre: 'Ana Pérez', cedula: '12345678', telefono: '0414-1234567', tecnico: 'JOSE', tipoTrabajo: 'AVERÍA', falla: 'LOS', tipoVisita: 'CONECTOR_EXTERNO', estado: 'FINALIZADO' };
const visita = { ...base, cobroBs: '5.696', cobroTipo: 'VISITA_TECNICA' };
const dolares = { ...base, id: 'T2', codigo: 'AC9', tipoVisita: 'CAMBIO_EQUIPO', cobroBs: '30', cobroTipo: 'OTRO_MONTO', cobroMoneda: 'USD' };
const instalacion = { ...base, id: 'T3', codigo: 'IO3', tipoTrabajo: 'INSTALACIÓN', tipoVisita: '', falla: 'SM' };

// --- Emitir ---
const cobro = armarCobro(visita, { por: 'oficina', ahora: AHORA });
check('una visita con cobro emite un cobro pendiente con el monto y los datos de la orden', [cobro.estado, cobro.monto, cobro.moneda, cobro.codigo, cobro.nombre, cobro.cedula, cobro.telefono, cobro.esInstalacion, cobro.anulado, cobro.montoCambio], [ESTADO_COBRO.PENDIENTE, 5696, 'BS', 'AO7', 'Ana Pérez', '12345678', '0414-1234567', false, false, null]);
check('en dólares: el cambio de equipo emite 30 $', [armarCobro(dolares, { por: 'o', ahora: AHORA }).monto, armarCobro(dolares, { por: 'o', ahora: AHORA }).moneda], [30, 'USD']);
check('la instalación emite el cobro sin monto (lo escribe Administración)', [armarCobro(instalacion, { por: 'o', ahora: AHORA }).monto, armarCobro(instalacion, { por: 'o', ahora: AHORA }).esInstalacion], [null, true]);
check('una orden exonerada, sin cobro o ya cerrada sin monto no emite nada', [{ ...visita, cobroTipo: 'EXONERADO', cobroBs: null }, base, { ...visita, cobroBs: '' }, null].map((t) => armarCobro(t, { por: 'o', ahora: AHORA })), [null, null, null, null]);
check('el historial arranca con quién lo emitió', [cobro.historial.length, cobro.historial[0].por, cobro.historial[0].detalle], [1, 'oficina', 'Cobro emitido: 5.696 Bs']);
check('el texto del cobro: con monto y sin él', [textoDeCobro(cobro), textoDeCobro(armarCobro(instalacion, { por: 'o', ahora: AHORA }))], ['5.696 Bs', 'Monto por definir']);
check('el aviso a Administración trae la orden, el cliente y el monto', avisoDeCobro(cobro), { title: 'Cobro por cargar', body: 'AO7 · Ana Pérez · 5.696 Bs' });
check('lo que se copia para subirlo al portal', textoParaCopiar(cobro).split('\n'), ['Orden: AO7', 'Cliente: Ana Pérez', 'Cédula: 12345678', 'Teléfono: 0414-1234567', 'Trabajo: AVERÍA - LOS', 'Monto: 5.696 Bs']);

// --- Si la orden cambia ---
check('pendiente: si la oficina cambia el monto, se actualiza solo', (({ cambios }) => [cambios.monto, cambios.moneda, cambios.historial.length])(sincronizarCobro(cobro, { ...visita, cobroBs: '8.000' }, { por: 'oficina', ahora: AHORA + 1 })), [8000, 'BS', 2]);
check('pendiente: si el monto sigue igual no hay nada que cambiar', sincronizarCobro(cobro, visita, { por: 'o', ahora: AHORA + 1 }), null);
check('pendiente: si la orden se cancela o se exonera, el cobro se retira', [sincronizarCobro(cobro, { ...visita, estado: 'CANCELADO' }, { por: 'o', ahora: AHORA + 1 }).cambios.anulado, sincronizarCobro(cobro, { ...visita, cobroTipo: 'EXONERADO', cobroBs: null }, { por: 'o', ahora: AHORA + 1 }).cambios.anulado], [true, true]);
const cargado = { ...cobro, ...armarCarga(cobro, {}, { por: 'adm', ahora: AHORA + 2 }).cambios };
check('cargado: si el monto cambia no se toca lo cargado y queda la alerta con el monto anterior y el nuevo', sincronizarCobro(cargado, { ...visita, cobroBs: '8.000' }, { por: 'o', ahora: AHORA + 3 }).cambios.montoCambio, { anterior: { monto: 5696, moneda: 'BS' }, nuevo: { monto: 8000, moneda: 'BS' } });
check('cargado: si la orden se cancela, la alerta dice que ya no hay cobro', sincronizarCobro(cargado, { ...visita, estado: 'CANCELADO' }, { por: 'o', ahora: AHORA + 3 }).cambios.montoCambio, { anterior: { monto: 5696, moneda: 'BS' }, nuevo: null });
const conAlerta = { ...cargado, ...sincronizarCobro(cargado, { ...visita, cobroBs: '8.000' }, { por: 'o', ahora: AHORA + 3 }).cambios };
check('cargado con alerta: otro cambio conserva el monto que estaba cargado como "anterior"; si vuelve al monto cargado, la alerta se quita', [
  sincronizarCobro(conAlerta, { ...visita, cobroBs: '9.000' }, { por: 'o', ahora: AHORA + 4 }).cambios.montoCambio,
  sincronizarCobro(conAlerta, visita, { por: 'o', ahora: AHORA + 4 }).cambios.montoCambio,
], [{ anterior: { monto: 5696, moneda: 'BS' }, nuevo: { monto: 9000, moneda: 'BS' } }, null]);
check('cargado: el mismo monto otra vez no genera nada', sincronizarCobro(cargado, visita, { por: 'o', ahora: AHORA + 3 }), null);
const instPendiente = armarCobro(instalacion, { por: 'o', ahora: AHORA });
check('instalación pendiente: editar la orden no cambia el monto; cancelarla la retira', [sincronizarCobro(instPendiente, { ...instalacion, falla: 'MTV' }, { por: 'o', ahora: AHORA + 1 }), sincronizarCobro(instPendiente, { ...instalacion, estado: 'CANCELADO' }, { por: 'o', ahora: AHORA + 1 }).cambios.anulado], [null, true]);

// --- Lo que hace Administración ---
check('cargar una visita no pide monto: pasa a CARGADO con quién y cuándo', [cargado.estado, cargado.monto, cargado.cargadoPor, cargado.cargadoEn, cargado.historial.at(-1).detalle], [ESTADO_COBRO.CARGADO, 5696, 'adm', AHORA + 2, 'Cargado en el portal: 5.696 Bs']);
check('cargar una instalación exige el monto y la moneda', [armarCarga(instPendiente, {}, { por: 'a', ahora: AHORA }).campo, armarCarga(instPendiente, { monto: '0' }, { por: 'a', ahora: AHORA }).campo, armarCarga(instPendiente, { monto: 'abc' }, { por: 'a', ahora: AHORA }).campo, armarCarga(instPendiente, { monto: '45', moneda: 'EUR' }, { por: 'a', ahora: AHORA }).campo], ['monto', 'monto', 'monto', 'moneda']);
const instCargada = armarCarga(instPendiente, { monto: '45,50', moneda: 'USD' }, { por: 'adm', ahora: AHORA + 5 }).cambios;
check('la instalación cargada guarda el monto y la moneda que escribió', [instCargada.estado, instCargada.monto, instCargada.moneda], [ESTADO_COBRO.CARGADO, 45.5, 'USD']);
check('no se carga dos veces ni uno anulado', [armarCarga(cargado, {}, { por: 'a', ahora: AHORA }).error, armarCarga({ ...cobro, anulado: true }, {}, { por: 'a', ahora: AHORA }).error].map(Boolean), [true, true]);
check('devolver a pendiente deshace la carga y lo deja en el historial; solo de un cargado', [armarDevolucionCobro(cargado, { por: 'adm', ahora: AHORA + 6 }).cambios.estado, armarDevolucionCobro(cargado, { por: 'adm', ahora: AHORA + 6 }).cambios.cargadoPor, armarDevolucionCobro(cobro, { por: 'a', ahora: AHORA }).error].map((x) => (typeof x === 'string' ? x : null)), ['PENDIENTE', '', 'Solo se puede devolver un cobro cargado.']);
check('confirmar un cambio de monto: el monto nuevo pasa a ser el cargado y la alerta se quita', (({ cambios }) => [cambios.monto, cambios.montoCambio, cambios.historial.at(-1).detalle])(armarConfirmacionCambio(conAlerta, { por: 'adm', ahora: AHORA + 7 })), [8000, null, 'Corregido en el portal: 8.000 Bs']);
check('confirmar que la orden se canceló retira el cobro; sin alerta no hay nada que confirmar', [armarConfirmacionCambio({ ...cargado, montoCambio: { anterior: { monto: 5696, moneda: 'BS' }, nuevo: null } }, { por: 'a', ahora: AHORA }).cambios.anulado, Boolean(armarConfirmacionCambio(cargado, { por: 'a', ahora: AHORA }).error)], [true, true]);

// --- Los "paga después" pendientes del flujo anterior pasan a Administración ---
const pagoPendiente = { ticketId: 'P1', codigo: 'AO9', nombre: 'Luis', cedula: '18222333', telefono: '0412-5550101', tecnico: 'REINEL', tipoTrabajo: 'AVERÍA', tipoVisita: 'CONECTOR_EXTERNO', falla: 'LOS', estado: 'PENDIENTE_COBRO', cobro: { monto: 40, moneda: 'USD' }, pago: null, nota: 'Paga el viernes', creadoEn: AHORA - 2 * 86400000 };
const migrado = cobroDesdePagoPendiente(pagoPendiente, { ahora: AHORA });
check('un "paga después" pendiente pasa a cobro pendiente, con su monto, su fecha original y de dónde viene', [migrado.estado, migrado.monto, migrado.moneda, migrado.creadoEn === pagoPendiente.creadoEn, migrado.creadoPor, migrado.historial[0].detalle], [ESTADO_COBRO.PENDIENTE, 40, 'USD', true, 'migración', 'Pasó del flujo anterior: el técnico dijo que el cliente paga después (Paga el viernes). 40 $']);
check('una instalación pendiente pasa sin monto; lo que no estaba pendiente o no tiene monto no pasa', [cobroDesdePagoPendiente({ ...pagoPendiente, tipoTrabajo: 'INSTALACIÓN', cobro: null }, { ahora: AHORA }).monto, cobroDesdePagoPendiente({ ...pagoPendiente, estado: 'POR_CONCILIAR' }, { ahora: AHORA }), cobroDesdePagoPendiente({ ...pagoPendiente, cobro: null }, { ahora: AHORA })], [null, null, null]);

// --- Listas ---
const lista = [
  { ...cobro, id: 'a', codigo: 'AO1', creadoEn: AHORA - 3 * 86400000 },
  { ...cobro, id: 'b', codigo: 'AO2', creadoEn: AHORA - 1 * 86400000 },
  { ...cargado, id: 'c', codigo: 'AO3', creadoEn: AHORA - 2 * 86400000 },
  { ...conAlerta, id: 'd', codigo: 'AO4', creadoEn: AHORA - 4 * 86400000 },
  { ...instPendiente, id: 'e', codigo: 'IO5', nombre: 'Luis Gómez', cedula: '18222333', tecnico: 'PEDRO', creadoEn: AHORA - 5 * 3600000 },
  { ...cobro, id: 'f', codigo: 'AO6', anulado: true },
];
check('lo anulado no sale en ninguna lista', filtrarCobros(lista).map((c) => c.codigo), ['AO1', 'AO2', 'AO3', 'AO4', 'IO5']);
check('filtros por estado, con cambio de monto, técnico y tipo', [filtrarCobros(lista, { estado: 'PENDIENTE' }).length, filtrarCobros(lista, { estado: 'CARGADO' }).length, filtrarCobros(lista, { estado: 'ALERTA' }).map((c) => c.codigo), filtrarCobros(lista, { tecnico: 'PEDRO' }).length, filtrarCobros(lista, { tipo: 'INSTALACION' }).length, filtrarCobros(lista, { tipo: 'OTRAS' }).length], [3, 2, ['AO4'], 1, 1, 4]);
check('la búsqueda por código, cliente o cédula', [filtrarCobros(lista, { busqueda: 'io5' }).length, filtrarCobros(lista, { busqueda: 'gómez' }).length, filtrarCobros(lista, { busqueda: 'gomez' }).length, filtrarCobros(lista, { busqueda: '18.222' }).length], [1, 1, 1, 1]);
check('el orden: con cambio de monto, pendientes del más viejo al más nuevo y cargados del más nuevo al más viejo', ordenarCobros(filtrarCobros(lista)).map((c) => c.codigo), ['AO4', 'AO1', 'AO2', 'IO5', 'AO3']);
check('el resumen cuenta por estado, suma por moneda y cuenta las alertas', (({ PENDIENTE, CARGADO, alertas }) => [PENDIENTE.cantidad, PENDIENTE.montos.BS, CARGADO.cantidad, CARGADO.montos.BS, alertas])(resumenCobros(lista)), [3, 11392, 2, 11392, 1]);
check('por cargar (el contador del menú): solo pendientes vigentes', cantidadPorCargar(lista), 3);
check('los días que lleva esperando', [diasEsperando(lista[0], AHORA), diasEsperando(lista[4], AHORA)], [3, 0]);
check('por período y técnico para Finanzas, los más nuevos primero', [cobrosDelPeriodo(lista, { desde: '2026-10-29', hasta: '2026-10-30' }).map((c) => c.codigo), cobrosDelPeriodo(lista, { desde: '2026-10-01', hasta: '2026-10-30' }, { tecnico: 'pedro' }).map((c) => c.codigo)], [['IO5', 'AO2'], ['IO5']]);

if (failures > 0) {
  console.log(`\n${failures} prueba(s) fallaron.`);
  process.exit(1);
}
console.log('\nTodas las pruebas pasaron.');
