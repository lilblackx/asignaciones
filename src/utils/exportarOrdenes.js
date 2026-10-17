// Exportar a Excel (CSV) lo que ventas está viendo. Solo lo que ya muestra la pantalla: sin plantillas, cobros ni datos de contacto.
import { atrasoOrden, esAveriaLos, fechaOrden } from './estadoInstalacion.js';
import { promotoraDeOrden } from './whatsapp.js';
import { formatearCedula } from './cedula.js';

const ENCABEZADOS = ['Código', 'Tipo', 'Cliente', 'Cédula', 'Dirección', 'Promotor', 'Técnico', 'Estado', 'Fecha', 'Atraso'];

const dosDigitos = (n) => String(n).padStart(2, '0');
const fechaHora = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()} ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
};

// Una celda de texto. Si empieza con = + - @ Excel lo tomaría por una fórmula (un nombre o dirección escrito así no debe ejecutarse),
// así que se le antepone un apóstrofo. Las comillas y el punto y coma se escapan; los saltos de línea se vuelven espacios.
function celda(valor) {
  let texto = String(valor ?? '').replace(/\s+/g, ' ').trim();
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return /[";]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Las filas ya armadas (sin escapar): una por orden, en el mismo orden en que están en pantalla.
export function filasExportacion(ordenes, ahora = Date.now()) {
  return ordenes.map((o) => [
    o.codigo || 'S/C',
    esAveriaLos(o) ? 'LOS' : 'Instalación',
    o.nombre || '',
    formatearCedula(o.cedula, o.tipoDocumento),
    o.direccion || '',
    promotoraDeOrden(o),
    o.tecnico || '',
    o.vista?.etiqueta || '',
    fechaHora(fechaOrden(o)),
    atrasoOrden(o, ahora)?.texto || '',
  ]);
}

// Texto CSV con punto y coma (así lo abre Excel en español) y marca de orden de bytes UTF-8 (para que respete las tildes).
export function csvDeOrdenes(ordenes, ahora = Date.now()) {
  const lineas = [ENCABEZADOS, ...filasExportacion(ordenes, ahora)].map((fila) => fila.map(celda).join(';'));
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}

export function nombreArchivoExportacion(ahora = Date.now()) {
  const d = new Date(ahora);
  return `ordenes-${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}.csv`;
}

// Baja el archivo en el equipo (sin pasar por ningún servidor).
export function descargarCsv(texto, nombre) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
