// Prueba la venta que crea una PROMOTORA con permiso (puedeCrearVentas): la orden que arma (instalación pendiente, sin técnico,
// código "IS" sin número), lo que se valida antes de guardar y cómo la plantilla pegada rellena el formulario. No necesita el
// emulador (las reglas se prueban en `npm run test:rules`). Uso: `npm run test:venta`.
import { readFileSync } from 'node:fs';
import { armarVentaPromotora, camposDePlantillaVenta, errorVentaPromotora, esVentaPorNumerar, tecnicoDePlantilla, TEXTO_AVISO_NUEVA_VENTA } from '../src/utils/ventaPromotora.js';
import { esVentaDelTecnico } from '../src/utils/tecnicoVenta.js';

let failures = 0;
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
function check(name, actual, esperado) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(esperado);
  if (a === e) console.log(`PASS  ${name}`);
  else { failures++; console.log(`FAIL  ${name}\n      esperado ${e}\n      llegó    ${a}`); }
}

const datos = { cedula: '12.345.678', tipoDocumento: 'V', nombre: 'ana pérez', telefono: '0414-1234567', direccion: 'Av. 5', falla: 'MRTV', promotora: 'sariana', ubicacion: '', nap: '', plantillaOriginal: 'texto' };
const propia = { verTodas: false, promotoraClaves: ['sariana'] };

const ahora = new Date('2026-10-19T10:00:00-04:00');
const venta = armarVentaPromotora(datos, { username: 'sariana', nombre: 'Sariana Gómez' }, ahora);
check('la venta es una instalación pendiente y sin técnico', [venta.tipoTrabajo, venta.estado, venta.tecnico, venta.isAsignado], ['INSTALACIÓN', 'PENDIENTE', '', false]);
check('el código queda sin número (la oficina lo numera al asignar técnico)', /^I[A-Z]{1,2}$/.test(venta.codigo), true);
check('guarda el promotor con su clave y quién la creó', [venta.promotora, venta.promotoraClave, venta.creado, venta.creadoNombre], ['Sariana', 'sariana', 'sariana', 'Sariana Gómez']);
check('guarda la plantilla pegada para poder copiarla después', venta.plantillaOriginal, 'texto');
check('no trae campos de cobro, instalación ni viaje (las reglas no los dejan pasar)', ['cobroBs', 'instalacion', 'enCamino', 'serialEquipo'].filter((c) => c in venta), []);
check('el historial arranca vacío', venta.historialEdiciones, []);
check('lleva la marca de venta de promotora (la oficina recibe el aviso)', venta.ventaPromotora, true);
check('sin instalador es una instalación normal: ni técnico ni marca de venta de técnico', [venta.tecnico, 'ventaTecnico' in venta, 'ventaTecnicoId' in venta], ['', false, false]);
check('el aviso a la oficina solo dice "Nueva venta"', TEXTO_AVISO_NUEVA_VENTA, 'Nueva venta');

// --- Validación ---
check('una venta completa no tiene error', errorVentaPromotora(datos, propia), '');
check('sin teléfono no se guarda', errorVentaPromotora({ ...datos, telefono: '  ' }, propia) !== '', true);
check('sin tipo de instalación no se guarda', errorVentaPromotora({ ...datos, falla: '' }, propia) !== '', true);
check('sin promotor no se guarda', errorVentaPromotora({ ...datos, promotora: 'N/A' }, propia) !== '', true);
check('el promotor de otra persona no vale (no la vería después)', errorVentaPromotora({ ...datos, promotora: 'María' }, propia) !== '', true);
check('ventas (ve todas) puede poner cualquier promotor', errorVentaPromotora({ ...datos, promotora: 'María' }, { verTodas: true, promotoraClaves: [] }), '');
check('el nombre con otra mayúscula o tilde sigue siendo el suyo', errorVentaPromotora({ ...datos, promotora: 'ALEXIS AÑEZ' }, { verTodas: false, promotoraClaves: ['alexis anez'] }), '');

// --- Plantilla ---
const plantilla = 'Nombre: Ana Pérez\nC.I: V-12345678\nTeléfono: 0414-1234567\nDirección: Av. 5\nServicio a contratar: MRTV\nPromotor: Sariana\nInstalador: Gerardo Molero';
const campos = camposDePlantillaVenta(plantilla);
check('la plantilla rellena los datos del cliente', [campos.nombre, campos.telefono, campos.falla, campos.promotora], ['Ana Pérez', '0414-1234567', 'MRTV', 'Sariana']);
check('el instalador de la plantilla no se aplica (la oficina asigna el técnico)', 'instalador' in campos, false);

// --- Técnico: solo el de la plantilla ---
const tecnicos = [{ name: 'GERARDO MOLERO' }, { name: 'EDGAR MONTERO' }];
check('el instalador de la plantilla se empareja con el técnico registrado', tecnicoDePlantilla(plantilla, tecnicos), 'GERARDO MOLERO');
check('un nombre corto también (Edgar -> EDGAR MONTERO)', tecnicoDePlantilla('Instalador: Edgar', tecnicos), 'EDGAR MONTERO');
check('no distingue mayúsculas, tildes ni espacios de más', [tecnicoDePlantilla('Instalador: GERARDO molero', tecnicos), tecnicoDePlantilla('*Instalador:*   gerardo   MOLERO ', tecnicos), tecnicoDePlantilla('Instalador: Géràrdo Molero', tecnicos), tecnicoDePlantilla('Instalador: gerardo molero', [{ name: 'Gerardo Molero' }])], ['GERARDO MOLERO', 'GERARDO MOLERO', 'GERARDO MOLERO', 'Gerardo Molero']);
check('la misma lógica de la oficina: "JOSE" o "Jose Suarez" son el técnico JOSE SUAREZ; con dos Jose no se elige ninguno', [tecnicoDePlantilla('Instalador: JOSE', [{ name: 'JOSE SUAREZ' }]), tecnicoDePlantilla('Instalador: Jose Suarez', [{ name: 'JOSE SUAREZ' }]), tecnicoDePlantilla('Instalador: JOSE', [{ name: 'JOSE SUAREZ' }, { name: 'JOSE PEREZ' }])], ['JOSE SUAREZ', 'JOSE SUAREZ', '']);
check('un instalador que no es técnico registrado no asigna a nadie', tecnicoDePlantilla('Instalador: Juan Pérez', tecnicos), '');
check('sin instalador no hay técnico', tecnicoDePlantilla('Nombre: Ana', tecnicos), '');
check('sin la lista de técnicos no se asigna', tecnicoDePlantilla(plantilla, []), '');
const conTecnico = armarVentaPromotora({ ...datos, tecnico: 'GERARDO MOLERO', tecnicoId: 'GERARDO MOLERO' }, { username: 'sariana', nombre: 'Sariana' }, ahora);
check('con técnico: queda asignado y marcado como venta suya', [conTecnico.tecnico, conTecnico.ventaTecnico, esVentaDelTecnico(conTecnico.ventaTecnico, conTecnico.tecnico)], ['GERARDO MOLERO', 'GERARDO MOLERO', true]);
check('sin técnico: no lleva marca de venta', ['ventaTecnico' in venta, venta.tecnico], [false, '']);
check('la oficina numera la venta que llega con técnico y sin número', esVentaPorNumerar({ ...conTecnico, tipoTrabajo: 'INSTALACIÓN' }), true);
check('no numera la que ya tiene número, no tiene técnico o no está pendiente', [esVentaPorNumerar({ ...conTecnico, codigo: 'IS12' }), esVentaPorNumerar(venta), esVentaPorNumerar({ ...conTecnico, estado: 'FINALIZADO' })], [false, false, false]);

// --- Cableado: lo que no se puede probar sin pantalla ---
const app = leer('../src/components/PromotoraApp.jsx');
check('el botón "Nueva venta" va en el encabezado y solo sale con el permiso', /accion=\{puedeCrearVentas \? \{ texto: 'Nuevo'/.test(app), true);
check('el permiso viene de la sesión y solo vale para PROMOTORA', /puedeCrearVentas: profile\?\.role === 'PROMOTORA' && profile\?\.puedeCrearVentas === true/.test(leer('../src/hooks/useAuth.js')), true);
check('el Worker guarda el permiso solo en PROMOTORA', /puedeCrearVentas: \{ booleanValue: role === 'PROMOTORA' && puedeCrearVentas === true \}/.test(leer('../cf-worker/src/index.js')), true);
check('el técnico se toma de la plantilla: el formulario no tiene selector de técnico', !/TecnicoField|technicians\.map/.test(leer('../src/components/modals/NuevaVentaModal.jsx')), true);
check('la oficina numera y avisa al técnico de las ventas por numerar', /esVentaPorNumerar\(t\)/.test(leer('../src/hooks/useTickets.js')) && /notifyTicketChange\(null, guardada\)/.test(leer('../src/hooks/useTickets.js')), true);
check('la marca "Tu venta" sale al técnico y "Venta" a la oficina (lista de celular y tabla)', ['../src/components/TicketsMobileList.jsx', '../src/components/TicketsTable.jsx'].every((r) => /<InsigniaVentaTecnico ticket=\{ticket\} paraTecnico=\{isTecnico\} \/>/.test(leer(r))), true);
check('las reglas exigen el permiso, instalación pendiente y sin técnico', /function creaVentaPromotora/.test(leer('../firestore.rules')) && /creaVentaPromotora\(appId\);/.test(leer('../firestore.rules')), true);

console.log(failures === 0 ? '\nTodo bien.' : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);
