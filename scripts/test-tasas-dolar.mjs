// Prueba las tasas BCV del dólar de los últimos 7 días que usa Finanzas (src/utils/tasasDolar.js): la ventana de 7 días, lo que sale del historial de la API y de la tasa del momento, cómo se juntan
// con lo guardado (sin pisar lo que ya estaba, salvo hoy), las opciones del selector y que la pantalla y el pago las usen. No necesita el emulador. Uso: `node scripts/test-tasas-dolar.mjs`.
import { readFileSync } from 'node:fs';
import { DIAS_GUARDADOS, delMomento, desdeHistorico, diaCaracas, etiquetaDia, etiquetaDiaLarga, fusionarDias, opcionElegida, opcionesDeTasa, primerDiaGuardado } from '../src/utils/tasasDolar.js';

let failures = 0;
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

// Hoy es martes 10/11/2026: el lunes 9 fue el día de la tasa que se quiere usar.
const HOY = '2026-11-10';
check('se guardan 7 días: hoy y los 6 anteriores', [DIAS_GUARDADOS, primerDiaGuardado(HOY)], [7, '2026-11-04']);
check('el día es el de Caracas (UTC-4): a las 23:00 de Caracas del 10 ya es 11 en UTC y sigue siendo el 10', [diaCaracas(Date.parse('2026-11-10T23:00:00-04:00')), diaCaracas(Date.parse('2026-11-10T00:30:00-04:00')), diaCaracas(Date.parse('2026-11-11T00:00:00-04:00'))], ['2026-11-10', '2026-11-10', '2026-11-11']);
check('las etiquetas dicen el día de la semana y la fecha', [etiquetaDia('2026-11-09'), etiquetaDiaLarga('2026-11-09'), etiquetaDia('2026-11-08')], ['lun 09/11', 'lunes 09/11', 'dom 08/11']);

// --- El historial de la API ---
const historico = [
  { fuente: 'oficial', promedio: 880.0, fecha: '2026-10-30' },
  { fuente: 'oficial', promedio: 889.2553, fecha: '2026-11-04' },
  { fuente: 'oficial', promedio: 889.5754, fecha: '2026-11-06' },
  { fuente: 'oficial', promedio: 897.5383, fecha: '2026-11-09' },
  { fuente: 'oficial', promedio: 899.2705, fecha: '2026-11-10' },
  { fuente: 'oficial', promedio: 901.6175, fecha: '2026-11-11' },
  { fuente: 'paralelo', promedio: 1200, fecha: '2026-11-09' },
  { fuente: 'oficial', promedio: 0, fecha: '2026-11-05' },
  { fuente: 'oficial', promedio: 890, fecha: 'ayer' },
  null,
];
check('del historial entran solo los oficiales de los últimos 7 días, redondeados a dos decimales (ni más viejos, ni de mañana, ni sin tasa)', desdeHistorico(historico, HOY), { '2026-11-04': 889.26, '2026-11-06': 889.58, '2026-11-09': 897.54, '2026-11-10': 899.27 });
check('si la API no trae una lista no hay nada', [desdeHistorico(null, HOY), desdeHistorico({}, HOY), desdeHistorico([], HOY)], [{}, {}, {}]);
check('la tasa del momento entra con el día en que la publicó el BCV', [delMomento(899.2705, Date.parse('2026-11-10T00:00:00-04:00'), HOY), delMomento(899.2705, null, HOY)], [{ '2026-11-10': 899.27 }, { '2026-11-10': 899.27 }]);
check('una tasa publicada para mañana o sin valor no entra', [delMomento(901, Date.parse('2026-11-11T00:00:00-04:00'), HOY), delMomento(0, null, HOY), delMomento(null, null, HOY)], [{}, {}, {}]);

// --- Juntar lo guardado con lo nuevo ---
const nuevos = desdeHistorico(historico, HOY);
const vacio = fusionarDias(null, nuevos, HOY);
check('sin nada guardado se guarda todo lo de los 7 días', [Object.keys(vacio.dias).sort(), vacio.hayCambios], [['2026-11-04', '2026-11-06', '2026-11-09', '2026-11-10'], true]);
const guardados = { '2026-11-09': 897.54, '2026-11-10': 899.27, '2026-11-04': 889.26, '2026-11-06': 889.58 };
check('si ya está todo guardado no hay nada que escribir', fusionarDias(guardados, nuevos, HOY).hayCambios, false);
check('una tasa guardada de un día anterior no se pisa aunque la API diga otra (es la que se pudo usar para pagar)', fusionarDias({ ...guardados, '2026-11-09': 890 }, nuevos, HOY).dias['2026-11-09'], 890);
const hoyCambiado = fusionarDias({ ...guardados, '2026-11-10': 898 }, nuevos, HOY);
check('la de hoy sí se actualiza si cambió', [hoyCambiado.dias['2026-11-10'], hoyCambiado.hayCambios], [899.27, true]);
check('un día que faltaba se agrega', fusionarDias({ '2026-11-10': 899.27 }, nuevos, HOY).dias['2026-11-09'], 897.54);
const conViejo = fusionarDias({ ...guardados, '2026-10-30': 880 }, nuevos, HOY);
check('lo que ya salió de los 7 días se borra y eso cuenta como un cambio que guardar', [conViejo.dias['2026-10-30'], conViejo.hayCambios], [undefined, true]);
const siguiente = fusionarDias(guardados, { ...nuevos, '2026-11-11': 901.62 }, '2026-11-11');
check('al día siguiente la ventana avanza: el 04/11 sale y el 11/11 entra', [Object.keys(siguiente.dias).sort(), siguiente.hayCambios], [['2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11'], true]);
check('valores raros guardados (texto, ceros, días mal escritos) se descartan', fusionarDias({ '2026-11-09': 'x', '2026-11-08': 0, mal: 5, '2026-11-10': 899.27 }, {}, HOY).dias, { '2026-11-10': 899.27 });

// --- Las opciones del selector ---
const opciones = opcionesDeTasa(guardados, HOY);
check('el selector lista de la más reciente a la más antigua, con el día y la tasa', opciones.map((o) => o.texto), ['mar 10/11 (hoy) · 899,27 Bs', 'lun 09/11 · 897,54 Bs', 'vie 06/11 · 889,58 Bs', 'mié 04/11 · 889,26 Bs']);
check('solo la de hoy dice "hoy"', opciones.map((o) => o.esHoy), [true, false, false, false]);
check('lo que no es de la ventana (más viejo, de mañana o inválido) no sale', opcionesDeTasa({ ...guardados, '2026-10-30': 880, '2026-11-11': 901, '2026-11-05': 0 }, HOY).length, 4);
check('sin elegir (o con un día que ya no está) se usa la más reciente; elegir el lunes da la del lunes', [opcionElegida(opciones, null).dia, opcionElegida(opciones, '2026-10-01').dia, opcionElegida(opciones, '2026-11-09').tasa], ['2026-11-10', '2026-11-10', 897.54]);
check('sin opciones no hay tasa elegida', [opcionElegida([], null), opcionesDeTasa({}, HOY)], [null, []]);
check('un sábado la más reciente es la del viernes y no dice "hoy"', opcionesDeTasa({ '2026-11-06': 889.58, '2026-11-05': 888 }, '2026-11-07')[0].texto, 'vie 06/11 · 889,58 Bs');

// --- Conexión en la app ---
const app = leer('../src/components/FinanzasApp.jsx');
check('Finanzas usa la tasa del día elegido (la más reciente si no se elige) y la de ahora solo si no hay historial', app.includes('const tasa = tasaElegida ? tasaElegida.tasa : bcv.tasa;'), true);
check('el pago nuevo sale con la tasa elegida', app.includes('onPagar={(fila, opciones) => finanzas.pagar(fila, rangoDeuda, { ...opciones, tasa })}'), true);
check('el selector va junto a la tasa y vuelve a "la más reciente" al elegirla', app.includes('onElegir={(dia) => setDiaTasa(dia === tasas.opciones[0]?.dia ? null : dia)}'), true);
check('el panel de pago dice de qué día es la tasa cuando no es la de hoy', leer('../src/components/finanzas/PanelPago.jsx').includes('{etiquetaTasa && ` (${etiquetaTasa})`}') && app.includes('etiquetaTasa={etiquetaTasa}'), true);
const hook = leer('../src/hooks/useTasasDolar.js');
check('el hook lee el documento, trae el historial y solo escribe cuando hay algo nuevo (una vez por cambio)', [hook.includes("'config', 'tasasDolar'"), hook.includes('ve.dolarapi.com/v1/historicos/dolares/oficial'), hook.includes('guardado.current === firma')], [true, true, true]);
const reglas = leer('../firestore.rules');
check('las reglas dejan guardar las tasas a FINANZAS (y ADMIN), solo ese documento y con esos campos', reglas.includes('match /artifacts/{appId}/public/data/config/tasasDolar') && reglas.includes("hasOnly(['dias', 'actualizadoEn', 'actualizadoPor'])"), true);

if (failures) { console.log(`\n${failures} prueba(s) fallaron`); process.exit(1); }
console.log('\nTodas las pruebas pasaron');
