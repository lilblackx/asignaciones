// Corrección, por la oficina (ADMIN/USUARIO), de lo que el técnico cargó al pre-finalizar: desde "Editar orden" y mientras
// la orden está pre-finalizada o finalizada. Es lo mismo que pide el modal de Pre-finalizar:
//   - Instalación: serial, VLAN, NAP y puerto, metraje del drop, posteadura, puertos disponibles y conectores usados
//     (se guardan en `ticket.instalacion`; la NAP y el puerto también van juntos en `ticket.nap`).
//   - Otras órdenes: el tipo de visita y sus datos (metros y conectores del recableado, cantidades de una visita de conector,
//     serial del equipo nuevo de un cambio de equipo).
// El formulario trabaja con texto, como se escribe (ver formularioDatosTecnico); validarDatosTecnico lo convierte a lo que se guarda.
//
// Qué se exige: lo que se escribe debe ser válido y lo que la orden ya tenía no se puede dejar vacío. Lo que la orden nunca
// tuvo (las anteriores a que se pidiera el metraje o los conectores) puede seguir vacío: así se corrige un serial sin obligar
// a inventar datos que van al módulo Materiales y al inventario del almacén.
import { napSinDato, separarNapPuerto } from './napPuerto.js';
import { esInstalacion, limpiarPostes, napConPuerto, validarInstalacion } from './instalacion.js';
import { errorConectoresInstalacion, normalizarConectoresInstalacion, parseConectoresInstalacion, textoConectoresInstalacion } from './conectoresInstalacion.js';
import {
  TIPO_RECABLEADO, cantidadesConector, colorConectorExterno, colorConectorInterno, datosConectores, datosSerialEquipo, esCambioEquipo, etiquetaTipoVisita,
  llevaConectores, parseCantidadesConector, parseMetros, parseSerialEquipo, partesRecableado, textoConectorVisita, tieneDatosRecableado,
} from './tipoVisita.js';

export const ESTADOS_CON_DATOS_DEL_TECNICO = ['PRE-FINALIZADO', 'FINALIZADO'];

// ¿Se muestran los datos del técnico para corregir? Solo en órdenes que el técnico ya pre-finalizó (o ya finalizadas).
export const tieneDatosDelTecnico = (ticket) => ESTADOS_CON_DATOS_DEL_TECNICO.includes(ticket?.estado);

const texto = (v) => String(v ?? '');
const numero = (v) => (v ? String(v) : '');

// La orden -> los campos del formulario, todos como texto. Una instalación sin NAP o puerto propios los toma del texto de la
// orden ("NAP 08 - Puerto 3").
export function formularioDatosTecnico(ticket) {
  const inst = ticket?.instalacion || {};
  const separado = separarNapPuerto(ticket?.nap);
  const conectores = normalizarConectoresInstalacion(inst.conectores);
  const cantidades = cantidadesConector(ticket);
  return {
    serial: texto(inst.serial),
    vlan: texto(inst.vlan),
    nap: texto(inst.nap || separado.nap),
    puerto: texto(inst.puerto || separado.puerto),
    metraje: numero(inst.metraje),
    postes: inst.posteadura?.length ? [...inst.posteadura] : [''],
    puertosDisponibles: texto(inst.puertosDisponibles),
    extVerde: numero(conectores.externo.verde),
    intVerde: numero(conectores.interno.verde),
    intAzul: numero(conectores.interno.azul),
    tipoVisita: texto(ticket?.tipoVisita),
    metros: ticket?.metrosCable != null ? String(ticket.metrosCable) : '',
    colorExterno: colorConectorExterno(ticket?.conectorExterno),
    colorInterno: colorConectorInterno(ticket?.conectorInterno),
    cantVerde: numero(cantidades.verde),
    cantAzul: numero(cantidades.azul),
    serialEquipo: texto(ticket?.serialEquipo),
  };
}

export const formularioModificado = (inicial, actual) => JSON.stringify(inicial) !== JSON.stringify(actual);

// Id del campo del formulario (para llevar el cursor al primero con error), en el orden en que se ven.
const ID_CONECTOR_INSTALACION = { externoVerde: 'ed-cant-ext-verde', internoVerde: 'ed-cant-int-verde', internoAzul: 'ed-cant-int-azul' };
const ID_CONECTOR_VISITA = { verde: 'pf-cant-verde', azul: 'pf-cant-azul' };

function resultado(errores, ordenCampos, datos) {
  const campos = Object.keys(errores);
  const primero = ordenCampos.find((c) => campos.includes(c.clave));
  const idError = primero && (typeof primero.id === 'function' ? primero.id(errores[primero.clave]) : primero.id);
  return { datos: campos.length === 0 ? datos : null, errores, error: campos.length > 0, primerCampo: idError || null };
}

const ORDEN_INSTALACION = [
  { clave: 'serial', id: 'ed-serial' }, { clave: 'vlan', id: 'ed-vlan' }, { clave: 'nap', id: 'ed-nap' }, { clave: 'puerto', id: 'ed-puerto' },
  { clave: 'metraje', id: 'ed-metraje' }, { clave: 'posteadura', id: 'ed-poste-1' }, { clave: 'puertosDisponibles', id: 'ed-puertos-disponibles' },
  { clave: 'conectores', id: (e) => ID_CONECTOR_INSTALACION[e.campo] },
];

function validarInstalacionEditada(ticket, f) {
  const reporte = validarInstalacion({ serial: f.serial, vlan: f.vlan, postes: f.postes, metraje: f.metraje, nap: f.nap, puerto: f.puerto, puertosDisponibles: f.puertosDisponibles });
  // Lo que la orden ya tenía no se puede dejar vacío; lo que nunca tuvo puede seguir vacío (solo se revisa si se escribió).
  const inicial = formularioDatosTecnico(ticket);
  const exige = {
    serial: Boolean(inicial.serial.trim()), vlan: Boolean(inicial.vlan.trim()), posteadura: limpiarPostes(inicial.postes).length > 0,
    metraje: Boolean(inicial.metraje.trim()), puertosDisponibles: Boolean(inicial.puertosDisponibles.trim()),
  };
  const vacios = {
    serial: !texto(f.serial).trim(), vlan: !texto(f.vlan).trim(), posteadura: limpiarPostes(f.postes).length === 0,
    metraje: !texto(f.metraje).trim(), puertosDisponibles: !texto(f.puertosDisponibles).trim(),
  };
  const errores = {};
  for (const [campo, mensaje] of Object.entries(reporte.errores)) if (exige[campo] || !vacios[campo]) errores[campo] = mensaje;
  if (!napSinDato(inicial.nap) && napSinDato(f.nap)) errores.nap = 'Indica la nomenclatura real de la NAP (no vale "SN").';
  if (inicial.puerto.trim() && !texto(f.puerto).trim()) errores.puerto = 'Indica el puerto.';

  let conectores;
  const leidos = parseConectoresInstalacion({ externoVerde: f.extVerde, internoVerde: f.intVerde, internoAzul: f.intAzul });
  if (!leidos.error) conectores = leidos.valor;
  else {
    const todoEnCero = [f.extVerde, f.intVerde, f.intAzul].every((v) => /^0*$/.test(texto(v).trim()));
    // Sin conectores solo se acepta si la orden tampoco los tenía (instalaciones anteriores a que se pidieran).
    const yaLosTenia = !errorConectoresInstalacion(ticket?.instalacion?.conectores);
    if (todoEnCero && !yaLosTenia) conectores = normalizarConectoresInstalacion(null);
    else errores.conectores = { campo: leidos.campo, mensaje: leidos.error };
  }

  // El texto de la NAP de la orden solo se reescribe si se tocó la NAP o el puerto (si no, se respeta como estaba).
  const tocoNap = f.nap !== inicial.nap || f.puerto !== inicial.puerto;
  return resultado(errores, ORDEN_INSTALACION, { ...(tocoNap ? { nap: napConPuerto(f.nap, f.puerto) } : {}), instalacion: { ...reporte.datos, conectores } });
}

const ORDEN_VISITA = [
  { clave: 'metros', id: 'pf-metros' }, { clave: 'cantidades', id: (e) => ID_CONECTOR_VISITA[e.campo === 'azul' ? 'azul' : 'verde'] }, { clave: 'serialEquipo', id: 'pf-serial-equipo' },
];

function validarVisitaEditada(ticket, f) {
  const tipo = f.tipoVisita;
  const errores = {};
  const metros = tipo === TIPO_RECABLEADO ? parseMetros(f.metros) : null;
  if (metros?.error) errores.metros = metros.error;
  const cantidades = parseCantidadesConector(tipo, { verde: f.cantVerde, azul: f.cantAzul });
  if (cantidades.error) errores.cantidades = { campo: cantidades.campo, mensaje: cantidades.error };
  const serialEquipo = esCambioEquipo(tipo) ? parseSerialEquipo(f.serialEquipo) : null;
  if (serialEquipo?.error) errores.serialEquipo = serialEquipo.error;

  // Igual que al pre-finalizar: los campos de metros, conectores y serial solo se escriben si el tipo los lleva o si hay
  // que borrar los de un tipo anterior; las demás órdenes no suman campos vacíos.
  const conConectores = llevaConectores(tipo) || tieneDatosRecableado(ticket) || ticket?.conectoresUsados;
  const conSerial = esCambioEquipo(tipo) || ticket?.serialEquipo;
  return resultado(errores, ORDEN_VISITA, {
    tipoVisita: tipo,
    ...(conConectores ? datosConectores(tipo, { metros: metros?.valor, conectorExterno: f.colorExterno, conectorInterno: f.colorInterno, conectores: cantidades.valor }) : {}),
    ...(conSerial ? datosSerialEquipo(tipo, f.serialEquipo) : {}),
  });
}

// El formulario -> { datos, errores, error, primerCampo }. `datos` son los campos de la orden a guardar (null si hay errores).
export function validarDatosTecnico(ticket, f) {
  return esInstalacion(ticket?.tipoTrabajo) ? validarInstalacionEditada(ticket, f) : validarVisitaEditada(ticket, f);
}

// Líneas del historial con lo que cambió de estos datos, ya con su valor nuevo ("Serial: HWTC1A2B3C4D", "Metraje: 120 m"). La
// NAP y el puerto salen aparte: el historial ya dice "NAP: ..." cuando cambia el texto de la NAP de la orden.
export function cambiosDatosTecnico(antes, despues) {
  const cambios = [];
  const a = antes?.instalacion || {};
  const d = despues?.instalacion || {};
  const si = (distinto, linea) => { if (distinto) cambios.push(linea); };
  si(texto(a.serial) !== texto(d.serial), `Serial: ${d.serial || 'Vacío'}`);
  si(texto(a.vlan) !== texto(d.vlan), `VLAN: ${d.vlan || 'Vacía'}`);
  si(JSON.stringify(a.posteadura || []) !== JSON.stringify(d.posteadura || []), `Posteadura: ${(d.posteadura || []).join(', ') || 'Vacía'}`);
  si(numero(a.metraje) !== numero(d.metraje), `Metraje: ${d.metraje ? `${d.metraje} m` : 'Vacío'}`);
  si(texto(a.puertosDisponibles) !== texto(d.puertosDisponibles), `Puertos disponibles: ${d.puertosDisponibles || 'Vacío'}`);
  const conectoresAntes = textoConectoresInstalacion(a.conectores);
  const conectoresDespues = textoConectoresInstalacion(d.conectores);
  si(conectoresAntes !== conectoresDespues, `Conectores: ${conectoresDespues || 'Ninguno'}`);

  si(texto(antes?.tipoVisita) !== texto(despues?.tipoVisita), `Tipo de visita: ${etiquetaTipoVisita(despues?.tipoVisita) || 'Ninguno'}`);
  const recableadoAntes = partesRecableado(antes).join(', ');
  const recableadoDespues = partesRecableado(despues).join(', ');
  si(recableadoAntes !== recableadoDespues, `Recableado: ${recableadoDespues || 'Sin datos'}`);
  const conectorAntes = textoConectorVisita(antes);
  const conectorDespues = textoConectorVisita(despues);
  si(conectorAntes !== conectorDespues && conectorDespues !== '', conectorDespues);
  si(texto(antes?.serialEquipo) !== texto(despues?.serialEquipo), `Serial del equipo nuevo: ${despues?.serialEquipo || 'Vacío'}`);
  return cambios;
}
