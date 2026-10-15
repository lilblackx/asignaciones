// Prueba los roles ALMACEN y PROMOTORA: el estado que ve la promotora (palabras claras, sin términos internos), el resumen
// liviano que guarda el cierre, cómo se une con las órdenes activas, y que las pantallas nuevas gasten pocas lecturas de
// Firestore (sin listeners en vivo en almacén, consultas filtradas). No necesita el emulador. Uso: `npm run test:roles`.
import { readFileSync } from 'node:fs';
import { ROLES, etiquetaRol } from '../src/constants.js';
import { MENSAJE_PROMOTOR_OBLIGATORIO, claveNombre, errorNombresPromotora, nombrePromotora, parseNombresPromotora } from '../src/utils/promotora.js';
import { generarMensajeWhatsApp, ordenSinPlantilla, parseInstalacionTemplate, promotoraDeOrden } from '../src/utils/whatsapp.js';
import { claveNombre as claveW, nombrePromotora as nombreW, parseNombresPromotora as parseW, promotoraDePlantilla as plantillaW } from '../cf-worker/src/index.js';
import { ESTADOS_PROMOTORA, ORDEN_ESTADOS_PROMOTORA, RETENCION_DIAS_HISTORIAL, RETENCION_DIAS_HISTORIAL_VENTAS, categoriaOrden, esAveriaLos, estadoParaPromotora, etiquetaFiltroEstado, resumenInstalacion, textoPlantillaFinal, unirInstalaciones } from '../src/utils/estadoInstalacion.js';

let failures = 0;
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const AHORA = new Date('2026-10-14T15:00:00-04:00').getTime();
const base = { id: 'a', codigo: 'IO1', nombre: 'Ana', tipoTrabajo: 'INSTALACIÓN', estado: 'PENDIENTE', tecnico: '' };
const vista = (t) => { const v = estadoParaPromotora({ ...base, ...t }, AHORA); return v && [v.clave, v.etiqueta, v.detalle]; };

check('roles nuevos (el valor guardado no cambia)', [ROLES.ALMACEN, ROLES.PROMOTORA], ['ALMACEN', 'PROMOTORA']);
check('el rol se muestra como VENTAS (el valor guardado sigue siendo PROMOTORA)', [etiquetaRol('PROMOTORA'), etiquetaRol('ALMACEN'), etiquetaRol('ADMIN')], ['VENTAS', 'ALMACEN', 'ADMIN']);

// --- Estado en palabras claras ---
check('pendiente sin técnico', vista({}), ['SIN_TECNICO', 'Sin técnico asignado', '']);
check('pendiente con técnico', vista({ tecnico: 'GERARDO MOLERO' }), ['ASIGNADA', 'Asignada', 'GERARDO MOLERO']);
check('técnico en camino', vista({ tecnico: 'GERARDO MOLERO', enCamino: { tecnico: 'GERARDO MOLERO', desde: AHORA - 5 * 60000 } }), ['EN_CAMINO', 'Técnico en camino', 'GERARDO MOLERO · salió hace 5 min']);
check('técnico en el sitio', vista({ tecnico: 'GERARDO MOLERO', enCamino: { tecnico: 'GERARDO MOLERO', desde: AHORA - 40 * 60000, llegoEn: AHORA - 10 * 60000 } }), ['EN_SITIO', 'Técnico en el sitio', 'GERARDO MOLERO · llegó hace 10 min']);
check('un "en camino" caducado ya no cuenta', vista({ tecnico: 'GERARDO MOLERO', enCamino: { tecnico: 'GERARDO MOLERO', desde: AHORA - 5 * 3600000 } })?.[0], 'ASIGNADA');
check('programada para otro día', vista({ tecnico: 'GERARDO MOLERO', fechaProgramada: '2026-10-20' }), ['PROGRAMADA', 'Programada', '20/10/2026 · GERARDO MOLERO']);
check('programada para hoy ya es asignada', vista({ tecnico: 'GERARDO MOLERO', fechaProgramada: '2026-10-14' })?.[0], 'ASIGNADA');
check('pre-finalizada: instalada, en revisión', vista({ estado: 'PRE-FINALIZADO', tecnico: 'GERARDO MOLERO' }), ['EN_REVISION', 'Instalada, en revisión', 'GERARDO MOLERO']);
check('finalizada: instalada', vista({ estado: 'FINALIZADO', tecnico: 'GERARDO MOLERO' }), ['INSTALADA', 'Instalada', 'GERARDO MOLERO']);
check('cancelada', vista({ estado: 'CANCELADO' }), ['CANCELADA', 'Cancelada', '']);
check('eliminada no se muestra', vista({ estado: 'ELIMINADO' }), null);
check('ningún texto usa términos internos', Object.values(ESTADOS_PROMOTORA).some((t) => /PRE-FINALIZADO|ELIMINADO|PENDIENTE/.test(t)), false);
check('todos los estados tienen lugar en el orden', [...ORDEN_ESTADOS_PROMOTORA].sort(), Object.keys(ESTADOS_PROMOTORA).sort());

// --- Resumen que guarda el cierre ---
const completa = { ...base, id: 'x', cedula: '12.345.678', tipoDocumento: 'V', direccion: 'Calle 1', tecnico: 'GERARDO MOLERO', estado: 'FINALIZADO', createdAt: 100, finalizadoEn: 200,
  serial: 'SECRETO', vlan: '1700', cobroBs: '400', telefono: '0414-1', observacion: 'interna', plantillaOriginal: 'IO-0\n*Instalador:* \n*Serial:*', instalacion: { serial: 'ABC123' } };
const resumen = resumenInstalacion(completa, 999);
check('el resumen solo lleva lo que ve la promotora', Object.keys(resumen).sort(), ['archivadoEn', 'cedula', 'codigo', 'creadaEn', 'direccion', 'estado', 'falla', 'finalizadoEn', 'nombre', 'plantillaFinal', 'promotora', 'promotoraClave', 'tecnico', 'tipoDocumento', 'tipoTrabajo']);
check('con sus valores', [resumen.codigo, resumen.nombre, resumen.cedula, resumen.estado, resumen.creadaEn, resumen.finalizadoEn, resumen.archivadoEn], ['IO1', 'Ana', '12.345.678', 'FINALIZADO', 100, 200, 999]);
check('sin datos técnicos sueltos, de cobro ni de contacto (solo la plantilla final)', JSON.stringify({ ...resumen, plantillaFinal: '' }).match(/SECRETO|1700|400|0414|interna|ABC123/), null);
check('las promotoras ven 7 días de historial y ventas 15', [RETENCION_DIAS_HISTORIAL, RETENCION_DIAS_HISTORIAL_VENTAS], [7, 15]);
check('el Worker conserva el historial lo que ve ventas (15), la app al cerrar también', /const RETENCION_MS_HISTORIAL = (\d+) \* 24/.exec(leer('../cf-worker/src/index.js'))?.[1] === String(RETENCION_DIAS_HISTORIAL_VENTAS) && /ahoraMs - RETENCION_MS_HISTORIAL_VENTAS/.test(leer('../src/hooks/useReports.js')), true);
check('el historial descarta lo que sobra para cada pantalla (ventas 15 días, una promotora 7)', /claves === null \? RETENCION_MS_HISTORIAL_VENTAS : RETENCION_MS_HISTORIAL/.test(leer('../src/hooks/useHistorialInstalaciones.js')), true);

// --- Plantilla final (la que el técnico dejó llena) ---
check('la plantilla final de una finalizada sale llena con el código, el técnico y lo que llenó el técnico', textoPlantillaFinal(completa), 'IO1\n*Instalador:* GERARDO MOLERO\n*Serial:* ABC123');
check('el resumen la guarda para cuando salga de la lista', resumen.plantillaFinal, 'IO1\n*Instalador:* GERARDO MOLERO\n*Serial:* ABC123');
check('una orden archivada (sin plantilla original) usa la guardada', textoPlantillaFinal({ id: 'h', estado: 'FINALIZADO', plantillaFinal: 'GUARDADA' }), 'GUARDADA');
check('una activa que aún no se finaliza no tiene plantilla final', [textoPlantillaFinal({ ...completa, estado: 'PRE-FINALIZADO' }), textoPlantillaFinal({ ...completa, estado: 'PENDIENTE' }), textoPlantillaFinal({ ...completa, estado: 'CANCELADO' })], ['', '', '']);
check('sin plantilla de la promotora no hay nada que mostrar', textoPlantillaFinal({ ...completa, plantillaOriginal: '' }), '');
check('el Worker copia la plantilla final de las finalizadas al historial', /plantillaFinal: \{ stringValue: f\.estado\?\.stringValue === 'FINALIZADO'/.test(leer('../cf-worker/src/index.js')), true);
check('al finalizar una instalación se guarda la plantilla final (aprobar y finalizar directo)', (leer('../src/hooks/useTickets.js').match(/\.\.\.plantillaFinalDe\(ticket\)/g) || []).length, 2);
check('el historial de órdenes ofrece "Ver plantilla" solo con permiso (ADMIN y usuarios con permiso de cierre) y en todas las órdenes con plantilla (no solo instalaciones)', /puedeVerPlantilla=\{canCerrar\}/.test(leer('../src/App.jsx')) && /puedeVerPlantilla && armarPlantilla\?\.\(o\)/.test(leer('../src/components/modals/OrdersHistoryModal.jsx')) && /plantillaDe=\{plantillaDeHistorial\}/.test(leer('../src/App.jsx')), true);
const averiaH = { codigo: 'AO179', tipoTrabajo: 'AVERÍA', falla: 'LOS', nombre: 'Harold', cedula: '16458185', direccion: 'Barrio Chino', creado: 'Skeyver' };
check('la plantilla de una avería del historial usa el monto del cobro registrado, no el de la tasa de hoy', [generarMensajeWhatsApp(averiaH, { montoBaseEUR: 10, tasa: 600 }, '4.200').match(/cancelar (\S+)Bs/)?.[1], generarMensajeWhatsApp(averiaH, { montoBaseEUR: 10, tasa: 600 }).match(/cancelar (\S+)Bs/)?.[1]], ['4.200', '6.000']);
check('toda orden sin plantilla de la promotora tiene mensaje; instalación o reconexión sin plantilla pegada, no', [ordenSinPlantilla(averiaH), ordenSinPlantilla({ tipoTrabajo: 'MUDANZA' }), ordenSinPlantilla({ tipoTrabajo: 'INSTALACIÓN' }), ordenSinPlantilla({ tipoTrabajo: 'RECONEXIÓN' })], [false, false, true, true]);
check('el botón Ver plantilla solo sale en las finalizadas', /vista\.clave === 'INSTALADA' && textoPlantillaFinal\(orden\)/.test(leer('../src/components/TarjetaInstalacion.jsx')), true);

// --- Averías LOS (solo las ve ventas) ---
const los = { ...base, id: 'l1', codigo: 'AS7', tipoTrabajo: 'AVERÍA', falla: 'LOS', estado: 'FINALIZADO', tecnico: 'GERARDO MOLERO', plantillaOriginal: 'AS7\n*Instalador:*' };
check('LOS es una avería con falla LOS (otra avería o una instalación no)', [esAveriaLos(los), esAveriaLos({ ...los, falla: 'Tensado de drop' }), esAveriaLos({ ...los, tipoTrabajo: 'INSTALACIÓN' })], [true, false, false]);
check('categoría: LOS o instalación (el historial viejo, sin tipo, es instalación)', [categoriaOrden(los), categoriaOrden(base), categoriaOrden({ id: 'h', estado: 'FINALIZADO' })], ['LOS', 'INSTALACION', 'INSTALACION']);
check('una LOS tiene los mismos estados que una instalación', ['PENDIENTE', 'PRE-FINALIZADO', 'FINALIZADO', 'CANCELADO'].map((estado) => estadoParaPromotora({ ...los, estado }, AHORA)?.clave), ['ASIGNADA', 'EN_REVISION', 'INSTALADA', 'CANCELADA']);
check('con otras palabras: no se "instala" una avería', [estadoParaPromotora({ ...los, estado: 'FINALIZADO' }, AHORA).etiqueta, estadoParaPromotora({ ...los, estado: 'PRE-FINALIZADO' }, AHORA).etiqueta], ['Resuelta', 'Atendida, en revisión']);
check('las instalaciones conservan sus palabras de siempre', [estadoParaPromotora({ ...base, estado: 'FINALIZADO', tecnico: 'X' }, AHORA).etiqueta, estadoParaPromotora({ ...base, estado: 'PRE-FINALIZADO', tecnico: 'X' }, AHORA).etiqueta], ['Instalada', 'Instalada, en revisión']);
check('filtros según lo que se ve', [etiquetaFiltroEstado('INSTALADA', 'INSTALACION'), etiquetaFiltroEstado('INSTALADA', 'LOS'), etiquetaFiltroEstado('INSTALADA', 'TODO'), etiquetaFiltroEstado('EN_REVISION', 'TODO'), etiquetaFiltroEstado('ASIGNADA', 'LOS')], ['Instalada', 'Resuelta', 'Instalada / Resuelta', 'En revisión', 'Asignada']);
check('una LOS no tiene plantilla que ver', textoPlantillaFinal(los), '');
check('el resumen de una LOS la marca para el historial', (({ tipoTrabajo, falla, plantillaFinal }) => [tipoTrabajo, falla, plantillaFinal])(resumenInstalacion(los, 1)), ['AVERÍA', 'LOS', '']);
check('unirInstalaciones deja pasar las LOS y no otras averías', unirInstalaciones([los, { ...los, id: 'l2', falla: 'LOS', estado: 'PENDIENTE' }, { ...los, id: 'o', falla: 'LOS EN CASA', tipoTrabajo: 'AVERÍA' }, { ...los, id: 'm', tipoTrabajo: 'MUDANZA' }], [], AHORA).map((o) => o.id).sort(), ['l1', 'l2']);
const reglasLos = leer('../firestore.rules');
check('las reglas dejan leer las LOS solo al perfil de ventas, con falla LOS', /isPromotoraRole\(appId\) && promotoraVeTodas\(appId\) && resource\.data\.tipoTrabajo == 'AVERÍA' && resource\.data\.get\('falla', ''\) == 'LOS'/.test(reglasLos), true);
check('ventas pide las LOS con los dos filtros que exigen las reglas', /where\('tipoTrabajo', '==', TIPO_AVERIA\), where\('falla', '==', FALLA_LOS\)/.test(leer('../src/hooks/useInstalacionesPromotora.js')), true);
check('el cierre (app y Worker) archiva también las LOS', /filter\(esDeVentas\)/.test(leer('../src/hooks/useReports.js')) && /esAveriaLosFirestore\(t\.fields\)/.test(leer('../cf-worker/src/index.js')), true);
check('solo ventas elige entre instalaciones, LOS o todo (las demás promotoras ven solo instalaciones)', /const vista = verTodasInstalaciones \? categoria : 'INSTALACION'/.test(leer('../src/components/PromotoraApp.jsx')), true);

// --- Activas + historial ---
const activas = [
  { ...base, id: '1', codigo: 'IO1', createdAt: 10 },
  { ...base, id: '2', codigo: 'IO2', estado: 'ELIMINADO', createdAt: 20 },
  { ...base, id: '3', codigo: 'AS3', tipoTrabajo: 'AVERÍA', createdAt: 30 },
  { ...base, id: '4', codigo: 'IO4', estado: 'FINALIZADO', tecnico: 'X', createdAt: 5 },
];
const hist = [
  { id: '4', codigo: 'IO4', nombre: 'dup', estado: 'FINALIZADO', archivadoEn: AHORA - 1000 },
  { id: '9', codigo: 'IO9', nombre: 'vieja', estado: 'CANCELADO', archivadoEn: AHORA - 86400000 },
];
const unidas = unirInstalaciones(activas, hist, AHORA);
check('solo instalaciones, sin eliminadas, sin duplicados', unidas.map((o) => o.codigo), ['IO1', 'IO4', 'IO9']);
check('las activas van primero y gana la activa si está en las dos', unidas.map((o) => o.origen), ['activa', 'activa', 'historial']);
check('cada una trae su estado', unidas.map((o) => o.vista.clave), ['SIN_TECNICO', 'INSTALADA', 'CANCELADA']);

// --- La promotora de cada instalación y quién ve qué ---
check('clave del nombre: sin tildes, minúsculas y espacios juntos', ['Alexis Añez', ' SARIANA  ', 'María   de los Ángeles', 'Sariana.'].map(claveNombre), ['alexis anez', 'sariana', 'maria de los angeles', 'sariana']);
check('"N/A" y parecidos no son un nombre', ['', 'N/A', 'no aplica', 'Pendiente', 'sin promotora', null, undefined].map(claveNombre), ['', '', '', '', '', '', '']);
check('nombre ordenado para mostrar', ['sariana', 'ALEXIS AÑEZ', 'maria de los angeles', ' luisa   perez '].map(nombrePromotora), ['Sariana', 'Alexis Añez', 'Maria de los Angeles', 'Luisa Perez']);
check('nombres que escribe el administrador', parseNombresPromotora('Sariana, sariana pérez; SARIANA'), { nombres: ['Sariana', 'Sariana Pérez'], claves: ['sariana', 'sariana perez'] });
check('máximo 5 nombres', parseNombresPromotora('a1,b2,c3,d4,e5,f6').claves.length, 5);
check('errores de los nombres', [errorNombresPromotora(''), errorNombresPromotora('  , '), errorNombresPromotora('Sariana'), errorNombresPromotora('a1,b2,c3,d4,e5,f6')],
  ['Escribe el nombre con que aparece el promotor en las plantillas.', 'Escribe el nombre con que aparece el promotor en las plantillas.', '', 'Máximo 5 nombres por promotor.']);
check('la promotora de una orden: la guardada o, si no hay, la de la plantilla',
  [{ promotora: 'sariana' }, { plantillaOriginal: '*Promotora:* alexis añez' }, { promotora: '', plantillaOriginal: '*Promotor:* Luisa' }, { promotora: 'Ana', plantillaOriginal: '*Promotora:* Luisa' }, {}, null].map(promotoraDeOrden),
  ['Sariana', 'Alexis Añez', 'Luisa', 'Ana', '', '']);
check('el resumen del historial lleva la promotora y su clave',
  [resumenInstalacion({ ...base, plantillaOriginal: '*Promotora:* ALEXIS AÑEZ' }, 1), resumenInstalacion({ ...base, promotora: 'Sariana' }, 1), resumenInstalacion(base, 1)].map((r) => [r.promotora, r.promotoraClave]),
  [['Alexis Añez', 'alexis anez'], ['Sariana', 'sariana'], ['', '']]);

// El Worker (cierre automático) lee la promotora igual que la app: mismas respuestas con las mismas plantillas
const MUESTRAS = ['*Promotora:* sariana', 'Promotor: Alexis Añez', '*Promotor/a:* maria de los angeles', '*Promotora:*\nLuisa Pérez\n*Fuente:* x', '*Promotora:* N/A', '*Promotora:*\n*Fuente:* Sariana',
  '*PROMOTORA:*   ALEXIS   AÑEZ ', '*Nap:* N02H05', '*Promotora:* juan@gmail.com', '*Promotora:* 04141234567', 'IO1\n*Nombres Completos:* Ana\n*Promotora:* sariana \n*Fuente:* Sariana', '', null];
check('el Worker lee la promotora de la plantilla igual que la app', MUESTRAS.map(plantillaW), MUESTRAS.map((m) => parseInstalacionTemplate(m).promotora || ''));
check('el Worker normaliza los nombres igual que la app', ['Alexis Añez', ' SARIANA  ', 'N/A', 'maria de los angeles'].map((n) => [claveW(n), nombreW(n)]), ['Alexis Añez', ' SARIANA  ', 'N/A', 'maria de los angeles'].map((n) => [claveNombre(n), nombrePromotora(n)]));
check('y los nombres del administrador', parseW('Sariana, sariana pérez; SARIANA'), parseNombresPromotora('Sariana, sariana pérez; SARIANA'));

// El código guarda la promotora al crear y al editar, la pide el formulario y solo el ADMIN completa las viejas
const hook = leer('../src/hooks/useTickets.js');
check('al crear una instalación se guarda la promotora y su clave', /promotoraClave: claveNombre\(formData\.promotora\)/.test(hook), true);
check('al editar se recalcula (menos el técnico, que no edita)', /role !== 'TECNICO' && esInstalacion\(editingTicket\.tipoTrabajo\)[\s\S]{0,200}promotoraClave = claveNombre/.test(hook), true);
check('el formulario de crear y el de editar muestran el promotor de las instalaciones', /id="tk-promotora"/.test(leer('../src/components/modals/CreateTicketModal.jsx')) && /id="ed-promotora"/.test(leer('../src/components/modals/EditTicketModal.jsx')), true);
const campoPromotor = leer('../src/components/modals/PromotorField.jsx');
check('el promotor es obligatorio (no vale vacío, espacios ni "N/A")', /required/.test(campoPromotor) && /setCustomValidity\(falta \? MENSAJE_PROMOTOR_CAMPO/.test(campoPromotor) && /const falta = !claveNombre\(value\)/.test(campoPromotor), true);
check('crear y editar usan el campo obligatorio', /<PromotorField/.test(leer('../src/components/modals/CreateTicketModal.jsx')) && /<PromotorField/.test(leer('../src/components/modals/EditTicketModal.jsx')), true);
check('al guardar se vuelve a comprobar, al crear y al editar (menos el técnico)',
  /includes\('INSTAL'\) && !claveNombre\(formData\.promotora\)[\s\S]{0,120}MENSAJE_PROMOTOR_OBLIGATORIO/.test(hook) && /role !== 'TECNICO' && esInstalacion\(editingTicket\.tipoTrabajo\) && !promotoraDeOrden\(editingTicket\)/.test(hook), true);
check('el mensaje de promotor obligatorio', MENSAJE_PROMOTOR_OBLIGATORIO, 'Promotor: es obligatorio en una instalación, escribe el nombre como aparece en la plantilla.');
const completar = leer('../src/hooks/useCompletarPromotoras.js');
check('las instalaciones viejas se completan solo cuando entra un ADMIN y solo si les falta la clave', /role !== 'ADMIN'/.test(completar) && /t\.promotoraClave !== undefined/.test(completar), true);
const usuarios = leer('../src/components/modals/UsersModal.jsx');
check('Usuarios pide el nombre de la promotora al crearla y al cambiar el rol', /id="user-promotora"/.test(usuarios) && /startPromEdit/.test(usuarios) && /errorNombresPromotora/.test(usuarios), true);
const reglasP = leer('../firestore.rules');
check('las reglas comparan la promotora de la orden con las del perfil, en órdenes y en historial',
  (reglasP.match(/resource\.data\.get\('promotoraClave', ''\) in promotoraClaves\(appId\)/g) || []).length === 2, true);
check('el historial de la promotora no usa un filtro de fecha en la consulta (evita un índice nuevo)', /where\('promotoraClave', '==', c\)/.test(leer('../src/hooks/useHistorialInstalaciones.js')) && !/where\('archivadoEn'/.test(leer('../src/hooks/useHistorialInstalaciones.js')), true);
check('el Worker exige un nombre para crear una promotora y lo normaliza', /nombresPromotora\.claves\.length === 0/.test(leer('../cf-worker/src/index.js')) && /promotoraClaves: \{ arrayValue/.test(leer('../cf-worker/src/index.js')), true);

// --- Costo de Firebase: se vigila en el código ---
const almacen = leer('../src/hooks/useDatosAlmacen.js');
check('almacén: sin listeners en vivo', /onSnapshot/.test(almacen), false);
check('almacén: solo lee las órdenes que Materiales usa', /where\('estado', 'in', ESTADOS_DE_MATERIALES\)/.test(almacen) && /\['FINALIZADO', 'PRE-FINALIZADO'\]/.test(almacen), true);
check('almacén: solo reportes de cierre y, al actualizar, solo los nuevos', /where\('tipoReporte', '==', 'CIERRE'\)/.test(almacen) && /where\('createdAt', '>', mayor\)/.test(almacen), true);
check('almacén: no usa los hooks pesados de la oficina', /useTickets|useReports|useTechnicians/.test(almacen), false);
const historialHook = leer('../src/hooks/useHistorialInstalaciones.js');
check('historial: una lectura, sin listener, y solo los últimos días', !/onSnapshot/.test(historialHook) && /getDocs/.test(historialHook) && /\(h\.archivadoEn \|\| 0\) >= desde/.test(historialHook), true);
const promotora = leer('../src/hooks/useInstalacionesPromotora.js');
check('promotora: pide solo sus instalaciones, una consulta por nombre (lo exigen las reglas y ahorra lecturas)', /where\('tipoTrabajo', '==', TIPO_INSTALACION\)/.test(promotora) && /where\('promotoraClave', '==', clave\)/.test(promotora), true);
const almacenApp = leer('../src/components/AlmacenApp.jsx');
check('almacén: botón Actualizar', /onClick=\{actualizar\}/.test(almacenApp), true);

// --- Aislamiento: la app de oficina y técnicos no se toca ---
const root = leer('../src/Root.jsx');
check('Root manda cada rol de solo lectura a su pantalla', /ROLES\.ALMACEN \|\| auth\.role === ROLES\.PROMOTORA/.test(root) && /<App auth=\{auth\} \/>/.test(root), true);
check('las pantallas nuevas no importan hooks de edición', ['AlmacenApp', 'PromotoraApp'].some((f) => /useTickets'|usePushToken|useUsers/.test(leer(`../src/components/${f}.jsx`))), false);
const reglas = leer('../firestore.rules');
check('las reglas no dan escritura a los roles nuevos', /allow (create|update|delete|write)[^;]*(isAlmacenRole|isPromotoraRole)/.test(reglas), false);
const worker = leer('../cf-worker/src/index.js');
check('el Worker acepta los roles nuevos al crear usuarios', /ROLES_VALIDOS = \['ADMIN', 'USUARIO', 'TECNICO', 'ALMACEN', 'PROMOTORA'\]/.test(worker), true);

console.log(failures ? `\n${failures} prueba(s) fallaron.` : '\nTodas las pruebas pasaron.');
process.exit(failures ? 1 : 0);
