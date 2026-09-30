import { POTENCIA_MIN_DBM } from './potencia';

// CSV con ";" como separador (no ","): es el que Excel en español espera por
// defecto, y evita choques con las comas que aparecen en nombres/direcciones.
function csvField(value) {
  let str = String(value ?? '');
  // Excel ejecuta como fórmula cualquier celda que empiece con = + - @: los
  // textos escritos por usuarios (nombre, observación...) no pueden colarse así.
  // Los números negativos (potencia) no son texto y se dejan tal cual.
  if (/^[=+\-@\t\r]/.test(str) && !/^-?\d+([.,]\d+)?$/.test(str)) str = `'${str}`;
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const horaDe = (ms) => (ms ? new Date(ms).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '');
// Coma decimal, como la espera Excel en español.
const decimalEs = (n) => (n === null || n === undefined || n === '' ? '' : String(n).replace('.', ','));

const COLUMNAS = [
  ['Código', t => t.codigo],
  ['Fecha', t => t.fecha],
  ['Hora de creación', t => horaDe(t.createdAt)],
  ['Creada por', t => t.creado],
  ['Nombre', t => t.nombre],
  ['Cédula', t => t.cedula],
  ['Dirección', t => t.direccion],
  ['Teléfono', t => t.telefono],
  ['Tipo de Trabajo', t => t.tipoTrabajo],
  ['Falla', t => t.falla],
  ['Técnico', t => t.tecnico],
  ['NAP', t => t.nap],
  ['Coordenadas NAP', t => t.napCoordenadas],
  ['Potencia (dBm)', t => decimalEs(t.potenciaDbm)],
  ['Ubicación', t => t.ubicacion],
  ['Enviado', t => (t.isAsignado ? 'Sí' : 'No')],
  ['Observación', t => t.observacion],
  ['Estado', t => t.estado],
];

const filaDe = (columnas, ticket) => columnas.map(([, get]) => csvField(get(ticket))).join(';');

function descargarCsv(nombreArchivo, lineas) {
  // BOM al inicio: sin esto, Excel interpreta tildes/ñ como caracteres corruptos.
  const csvContent = '﻿' + lineas.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const fechaArchivoHoy = () => new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replaceAll('/', '-');

export function exportReportToCsv(report) {
  const encabezado = [
    `Cierre de ${report.tipoReporte === 'CANCELADOS' ? 'Cancelados' : 'Jornada'}`,
    `Fecha: ${report.fechaCierre}`,
    `Hora: ${report.horaCierre}`,
    `Operador: ${report.operador}`,
    `Total: ${report.total}`,
  ].join(';');

  const filas = [
    encabezado,
    '',
    COLUMNAS.map(([label]) => csvField(label)).join(';'),
    ...(report.ticketsDetalle || []).map(ticket => filaDe(COLUMNAS, ticket)),
  ];

  const fechaArchivo = (report.fechaCierre || '').replaceAll('/', '-');
  const tipo = report.tipoReporte === 'CANCELADOS' ? 'cancelados' : 'cierre';
  descargarCsv(`reporte_${tipo}_${fechaArchivo}.csv`, filas);
}

// Historial de órdenes tal como quedó filtrado en pantalla. `filtros` es un texto
// legible con los filtros activos; `_origen` (Activa / Cierre dd/mm/aaaa) lo agrega el modal.
export function exportOrdersToCsv(orders, filtros) {
  const columnas = [...COLUMNAS, ['Origen', t => t._origen]];
  const filas = [
    'Historial de órdenes',
    `Generado: ${new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}`,
    `Filtros: ${filtros || 'ninguno'}`,
    `Total: ${orders.length}`,
    '',
    columnas.map(([label]) => csvField(label)).join(';'),
    ...orders.map(t => filaDe(columnas, t)),
  ];
  descargarCsv(`historial_ordenes_${fechaArchivoHoy()}.csv`, filas);
}

// Un renglón por técnico sobre las órdenes indicadas (no cuenta las eliminadas).
export function exportResumenTecnicosToCsv(orders, filtros) {
  const porTecnico = new Map();
  orders.forEach(t => {
    if (!t.tecnico || t.estado === 'ELIMINADO') return;
    const r = porTecnico.get(t.tecnico) || { total: 0, finalizadas: 0, canceladas: 0, abiertas: 0, potencias: [] };
    r.total += 1;
    if (t.estado === 'FINALIZADO') r.finalizadas += 1;
    else if (t.estado === 'CANCELADO') r.canceladas += 1;
    else r.abiertas += 1;
    if (t.potenciaDbm !== null && t.potenciaDbm !== undefined && t.potenciaDbm !== '' && !Number.isNaN(Number(t.potenciaDbm))) {
      r.potencias.push(Number(t.potenciaDbm));
    }
    porTecnico.set(t.tecnico, r);
  });

  const cabecera = ['Técnico', 'Órdenes', 'Finalizadas', 'Canceladas', 'Abiertas', 'Con potencia', 'Potencia promedio (dBm)', `Señal débil (< ${POTENCIA_MIN_DBM} dBm)`];
  const renglones = [...porTecnico.entries()]
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
    .map(([nombre, r]) => {
      const promedio = r.potencias.length ? Math.round((r.potencias.reduce((s, n) => s + n, 0) / r.potencias.length) * 10) / 10 : '';
      const debiles = r.potencias.filter(n => n < POTENCIA_MIN_DBM).length;
      return [nombre, r.total, r.finalizadas, r.canceladas, r.abiertas, r.potencias.length, decimalEs(promedio), debiles].map(csvField).join(';');
    });

  descargarCsv(`resumen_tecnicos_${fechaArchivoHoy()}.csv`, [
    'Resumen por técnico',
    `Generado: ${new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}`,
    `Filtros: ${filtros || 'ninguno'}`,
    '',
    cabecera.map(csvField).join(';'),
    ...renglones,
  ]);
}
