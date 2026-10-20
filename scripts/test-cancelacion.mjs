// Prueba el motivo de cancelación (src/utils/cancelacion.js): cuándo es obligatorio, qué campos se guardan al cancelar, corregir o
// reactivar una orden, y cómo sale en el reporte y en ventas. No necesita el emulador.
// Uso: `npm run test:cancelacion`.
import { MOTIVO_ELIMINADA_ANTES, camposCancelacion, cancelaAhora, comoCancelada, lineaMotivoCancelacion, motivoCancelacion, parseMotivoCancelacion } from '../src/utils/cancelacion.js';
import { estadoParaPromotora, resumenInstalacion } from '../src/utils/estadoInstalacion.js';
import { filaVisita, observacionDe } from '../src/utils/reporteMensual.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const orden = { id: 'a', codigo: 'IO1', nombre: 'Ana', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', tecnico: 'GERARDO', createdAt: 1000 };
const T = 5000;

// --- El motivo ---
check('el motivo es obligatorio', parseMotivoCancelacion('   ').error !== undefined, true);
check('se limpia de espacios, saltos de línea y barras (el historial separa con " | ")', parseMotivoCancelacion('  El cliente | ya no\n quiere  ').valor, 'El cliente / ya no quiere');
check('un motivo larguísimo se rechaza', parseMotivoCancelacion('x'.repeat(301)).error !== undefined, true);
check('trescientos caracteres justos valen', parseMotivoCancelacion('x'.repeat(300)).valor?.length, 300);

// --- Cuándo es obligatorio y qué se guarda ---
check('pasar a CANCELADO lo pide', [cancelaAhora(orden, { ...orden, estado: 'CANCELADO' }), cancelaAhora({ ...orden, estado: 'PRE-FINALIZADO' }, { ...orden, estado: 'CANCELADO' })], [true, true]);
check('una orden que ya estaba cancelada no lo pide otra vez', cancelaAhora({ ...orden, estado: 'CANCELADO' }, { ...orden, estado: 'CANCELADO' }), false);
check('al cancelar guarda motivo, quién y cuándo', camposCancelacion(orden, { ...orden, estado: 'CANCELADO', motivoCancelacion: ' No hay cobertura ' }, { por: 'ana', ahora: T }), { motivoCancelacion: 'No hay cobertura', canceladaPor: 'ana', canceladaEn: T });
check('corregir el motivo de una cancelada solo cambia el motivo', camposCancelacion({ ...orden, estado: 'CANCELADO', motivoCancelacion: 'A', canceladaPor: 'ana', canceladaEn: 1 }, { ...orden, estado: 'CANCELADO', motivoCancelacion: 'B' }, { por: 'luis', ahora: T }), { motivoCancelacion: 'B' });
check('si no se corrigió no se escribe nada', camposCancelacion({ ...orden, estado: 'CANCELADO', motivoCancelacion: 'A' }, { ...orden, estado: 'CANCELADO', motivoCancelacion: 'A' }), {});
check('reactivar la orden borra el motivo, quién y cuándo', camposCancelacion({ ...orden, estado: 'CANCELADO', motivoCancelacion: 'A', canceladaPor: 'ana', canceladaEn: 1 }, { ...orden, estado: 'PENDIENTE' }), { motivoCancelacion: null, canceladaPor: null, canceladaEn: null });
check('una orden normal no escribe nada', camposCancelacion(orden, { ...orden, observacion: 'x' }), {});
check('la línea del historial', [lineaMotivoCancelacion('No hay cobertura'), lineaMotivoCancelacion('')], ['Motivo de cancelación: No hay cobertura', '']);
check('solo una orden cancelada tiene motivo', [motivoCancelacion({ ...orden, motivoCancelacion: 'A' }), motivoCancelacion({ ...orden, estado: 'CANCELADO', motivoCancelacion: ' A ' })], ['', 'A']);

// --- Ventas: la tarjeta y el resumen del historial ---
const cancelada = { ...orden, estado: 'CANCELADO', motivoCancelacion: 'El cliente ya no quiere el servicio' };
check('el resumen del historial lleva el motivo', resumenInstalacion(cancelada, 9).motivoCancelacion, 'El cliente ya no quiere el servicio');
check('ventas ve la orden como cancelada y el motivo sigue en ella', [estadoParaPromotora(cancelada, T).clave, motivoCancelacion(cancelada)], ['CANCELADA', 'El cliente ya no quiere el servicio']);
check('una cancelada de antes (sin motivo) no rompe nada', [resumenInstalacion({ ...orden, estado: 'CANCELADO' }, 9).motivoCancelacion, motivoCancelacion({ ...orden, estado: 'CANCELADO' })], ['', '']);

// --- Reportes: el motivo sale en la fila de la hoja de visitas ---
const visita = { ...orden, tipoTrabajo: 'MUDANZA', estado: 'CANCELADO', motivoCancelacion: 'Cliente ausente', canceladaEn: T };
check('la observación de una NR dice el motivo', observacionDe(visita), 'Cancelada: Cliente ausente');
check('y sin motivo (cancelada de antes) queda el trabajo', observacionDe({ ...visita, motivoCancelacion: '' }), 'MUDANZA');
check('la fila de la hoja trae la observación con el motivo', filaVisita(visita, 1)[10], 'Cancelada: Cliente ausente');

// --- Ya solo existe cancelada: las que quedaron como ELIMINADO de antes se leen como canceladas ---
const eliminada = { id: 'e', codigo: 'IO8', estado: 'ELIMINADO', eliminadoPor: 'ana', fechaEliminacion: '10/10/2026', tecnico: 'GERARDO', tipoTrabajo: 'INSTALACIÓN' };
check('una ELIMINADO se lee como CANCELADO, con quién la eliminó y un motivo que lo explica', (({ estado, canceladaPor, motivoCancelacion: m }) => [estado, canceladaPor, m])(comoCancelada(eliminada)), ['CANCELADO', 'ana', MOTIVO_ELIMINADA_ANTES]);
check('si ya traía motivo, se conserva', comoCancelada({ ...eliminada, motivoCancelacion: 'Cliente repetido' }).motivoCancelacion, 'Cliente repetido');
check('ventas la ve como cancelada', estadoParaPromotora(comoCancelada(eliminada), T).clave, 'CANCELADA');
check('las demás órdenes no se tocan', [comoCancelada(orden) === orden, comoCancelada(cancelada) === cancelada], [true, true]);

if (failures) { console.log(`\n${failures} prueba(s) fallaron.`); process.exit(1); }
console.log('\nTodas las pruebas pasaron.');
