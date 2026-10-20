// Estadísticas operativas de las órdenes de un periodo: finalizadas por técnico, NAPs con más fallas y clientes con varias órdenes.
import { diaDe } from './totalesMes.js';
import { enRango } from './periodoReporte.js';
import { grupoDeTrabajo } from './tiposDeTrabajo.js';

// El día (Caracas) al que cuenta una orden: cuando se cerró o, si sigue abierta, cuando se creó. Sin fecha conocida, no cuenta en ningún periodo.
// `_cierreEn` lo agrega todasLasOrdenes a las órdenes archivadas: cuándo se hizo el cierre que las guardó.
export function diaDeOrden(t) {
  const cerrada = t._cierreEn || t.estado === 'FINALIZADO' || t.estado === 'CANCELADO';
  const ms = (cerrada ? (t.finalizadoEn || t.archivadoEn || t._cierreEn || t.createdAt) : t.createdAt) || 0;
  return ms ? diaDe(ms) : null;
}

export function estadisticasOperativas(ordenes, rango, tecnico) {
  const lista = ordenes.filter((t) => {
    const dia = diaDeOrden(t);
    return dia && enRango(dia, rango) && (!tecnico || (t.tecnico || '').toUpperCase() === tecnico.toUpperCase());
  });

  // Finalizadas por técnico: en total y separadas por grupo de trabajo (ver tiposDeTrabajo): instalaciones, averías (con reconexiones, low signal y cambios
  // de equipo), visitas (mudanzas, retiros, garantías y validaciones de NAP) y otros. Cada orden cae en un solo grupo: los grupos suman el total.
  const finalizadasDe = (acepta) => {
    const por = new Map();
    for (const t of lista) {
      if (t.estado !== 'FINALIZADO' || !t.tecnico || !acepta(t)) continue;
      const clave = t.tecnico.toUpperCase();
      por.set(clave, (por.get(clave) || 0) + 1);
    }
    return [...por.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };
  const porTecnico = finalizadasDe(() => true);
  const porTecnicoTipo = {
    TODO: porTecnico,
    INSTALACION: finalizadasDe((t) => grupoDeTrabajo(t) === 'INSTALACION'),
    AVERIA: finalizadasDe((t) => grupoDeTrabajo(t) === 'AVERIA'),
    VISITA: finalizadasDe((t) => grupoDeTrabajo(t) === 'VISITA'),
    OTRO: finalizadasDe((t) => grupoDeTrabajo(t) === 'OTRO'),
  };
  const sumar = (lista) => lista.reduce((suma, f) => suma + f.count, 0);
  const totalesPorTipo = Object.fromEntries(Object.entries(porTecnicoTipo).map(([clave, lista]) => [clave, sumar(lista)]));

  const napsPor = new Map();
  for (const t of lista) {
    const nap = (t.nap || '').trim();
    if (!nap) continue;
    napsPor.set(nap, (napsPor.get(nap) || 0) + 1);
  }
  const porNap = [...napsPor.entries()].map(([nap, count]) => ({ nap, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const clientes = new Map();
  for (const t of lista) {
    const cedula = (t.cedula || '').trim();
    if (!cedula) continue;
    const entrada = clientes.get(cedula) || { nombre: t.nombre, count: 0 };
    entrada.count += 1;
    if (t.nombre) entrada.nombre = t.nombre;
    clientes.set(cedula, entrada);
  }
  const reincidentes = [...clientes.entries()].map(([cedula, v]) => ({ cedula, nombre: v.nombre, count: v.count })).filter((x) => x.count > 1).sort((a, b) => b.count - a.count).slice(0, 15);

  return {
    porTecnico,
    porTecnicoTipo,
    totalesPorTipo,
    porNap,
    reincidentes,
    finalizadas: porTecnico.reduce((suma, t) => suma + t.count, 0),
    totalOrdenes: lista.length,
  };
}
