import { useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import Chip from '../Chip';
import BotonLimpiarBusqueda from '../BotonLimpiarBusqueda';
import Boton from '../Boton';
import CobroModal from '../modals/CobroModal';
import { BUSCADOR } from '../estilos';
import { TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { etiquetaRango } from '../../utils/periodoReporte';
import { formatoMontoBs, textoMonto } from '../../utils/cobro';
import {
  ESTADO_COBRO, ETIQUETA_ESTADO_COBRO, cobrosDelPeriodo, filtrarCobros, resumenCobros, textoDeCobro, tieneCambioDeMonto,
} from '../../utils/cobrosClientes';

const CLASE_ESTADO = { PENDIENTE: 'bg-amber-400 text-black', CARGADO: 'bg-emerald-700 text-white' };
const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const monto = (m, moneda) => textoMonto(formatoMontoBs(Number(m) || 0), moneda);
const FILTROS_ESTADO = [{ valor: 'TODOS', etiqueta: 'Todos' }, { valor: ESTADO_COBRO.PENDIENTE, etiqueta: 'Pendientes' }, { valor: ESTADO_COBRO.CARGADO, etiqueta: 'Cargados' }];
const FILTROS_TIPO = [{ valor: '', etiqueta: 'Todas' }, { valor: 'INSTALACION', etiqueta: 'Instalaciones' }, { valor: 'OTRAS', etiqueta: 'Visitas y otras' }];

// Los cobros que se emitieron a los clientes (al finalizarse cada orden con cobro o instalación) y si Administración ya los subió al portal de la empresa, donde el cliente ve su factura y paga. Solo lectura.
// El período y el técnico son los de la barra de arriba de Finanzas. `cobros`: los leídos del período (useCobrosFinanzas).
export default function CobrosEmitidos({ cobros, rango, tecnico, cargado, error }) {
  const [estado, setEstado] = useState('TODOS');
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);

  const delPeriodo = useMemo(() => cobrosDelPeriodo(cobros, rango, { tecnico }), [cobros, rango, tecnico]);
  const visibles = useMemo(() => filtrarCobros(delPeriodo, { estado, tipo, busqueda }), [delPeriodo, estado, tipo, busqueda]);
  const resumen = useMemo(() => resumenCobros(visibles), [visibles]);
  const cobroAbierto = abierto ? delPeriodo.find((c) => c.id === abierto) || null : null;

  if (error && !cargado) return <p role="alert" className="text-base text-red-600 dark:text-red-400 text-center py-10">No se pudieron leer los cobros de los clientes. Recarga la página e intenta de nuevo.</p>;
  if (!cargado) return <p role="status" className="text-base text-zinc-600 dark:text-zinc-300 text-center py-10">Cargando los cobros...</p>;

  const total = resumen.PENDIENTE.cantidad + resumen.CARGADO.cantidad;
  const emitido = ['USD', 'BS'].map((m) => [m, resumen.PENDIENTE.montos[m] + resumen.CARGADO.montos[m]]).filter(([, v]) => v > 0).map(([m, v]) => monto(v, m));
  const tarjetas = [
    { etiqueta: 'Cobros emitidos', valor: String(total), detalle: emitido.join(' · ') },
    { etiqueta: 'Cargados en el portal', valor: String(resumen.CARGADO.cantidad) },
    { etiqueta: 'Pendientes por cargar', valor: String(resumen.PENDIENTE.cantidad) },
    { etiqueta: 'Con cambio de monto', valor: String(resumen.alertas), detalle: resumen.alertas > 0 ? 'Administración debe corregirlos' : '' },
  ];
  const estadoChip = (c) => <span className={`inline-block whitespace-nowrap text-[11px] max-lg:text-xs leading-tight font-black px-2 py-0.5 rounded ${CLASE_ESTADO[c.estado] || ''}`}>{ETIQUETA_ESTADO_COBRO[c.estado] || c.estado}</span>;
  const alerta = (c) => tieneCambioDeMonto(c) && <span className="inline-flex items-center gap-1 text-[11px] max-lg:text-xs font-bold text-amber-800 dark:text-amber-300"><AlertTriangle className="w-3 h-3" aria-hidden="true" />Cambió el monto</span>;
  const tipoTexto = (c) => (c.esInstalacion ? 'Instalación' : [c.tipoTrabajo, c.falla].filter(Boolean).join(' · '));

  return (
    <div className="space-y-5">
      <section aria-label="Resumen" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {tarjetas.map(({ etiqueta, valor, detalle }) => (
          <div key={etiqueta} className={`${TARJETA} p-3 min-w-0`}>
            <p className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none break-words text-zinc-900 dark:text-white">{valor}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100">{etiqueta}</p>
            {detalle && <p className="text-xs text-zinc-600 dark:text-zinc-300 break-words">{detalle}</p>}
          </div>
        ))}
      </section>

      <h2 className={TITULO_SECCION}>Cobros a los clientes · {etiquetaRango(rango)}</h2>
      <p className={TEXTO_SUAVE}>Cada orden con cobro, y cada instalación, genera un cobro al finalizarse. Administración lo sube al portal de la empresa y lo marca como cargado; el cliente ve su factura y paga allá.</p>

      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input type="search" aria-label="Buscar por código, cliente, cédula o técnico" placeholder="Código, cliente o cédula" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={BUSCADOR} />
          <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label="Estado del cobro" className="flex flex-wrap gap-1.5">
            {FILTROS_ESTADO.map(({ valor, etiqueta }) => <Chip activo={estado === valor} tamano="compacto" key={valor} type="button" onClick={() => setEstado(valor)}>{etiqueta}</Chip>)}
          </div>
          <div role="group" aria-label="Tipo de orden" className="flex flex-wrap gap-1.5">
            {FILTROS_TIPO.map(({ valor, etiqueta }) => <Chip activo={tipo === valor} tamano="compacto" key={valor || 'todas'} type="button" onClick={() => setTipo(valor)}>{etiqueta}</Chip>)}
          </div>
        </div>
      </div>

      <p className={TEXTO_SUAVE} aria-live="polite">{visibles.length} {visibles.length === 1 ? 'cobro' : 'cobros'}</p>

      {visibles.length === 0 ? (
        <p className="text-base text-zinc-700 dark:text-zinc-200 text-center py-10">{delPeriodo.length ? 'Ningún cobro coincide con lo que buscas. Prueba quitar algún filtro.' : 'Ningún cobro emitido en este periodo. Amplía el rango de fechas para ver anteriores.'}</p>
      ) : (
        <>
          {/* Celular y tablet: una tarjeta por cobro. */}
          <ul className="lg:hidden flex flex-col gap-2">
            {visibles.map((c) => (
              <li key={c.id} className={`${TARJETA} p-3 space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-sm">{c.codigo || 'S/C'} <span className="font-bold">· {c.nombre}</span></p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">{tipoTexto(c)} · {c.tecnico} · {fechaHora(c.creadoEn)}</p>
                  </div>
                  {estadoChip(c)}
                </div>
                <p className="text-sm font-bold break-words">{textoDeCobro(c)}</p>
                {alerta(c)}
                {c.estado === ESTADO_COBRO.CARGADO && <p className="text-xs text-zinc-700 dark:text-zinc-300">Cargado por {c.cargadoPor} · {fechaHora(c.cargadoEn)}</p>}
                <Boton variante="secundario" tamano="grande" className="w-full" onClick={() => setAbierto(c.id)}>Ver todos los datos</Boton>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla. */}
          <div className={`${TARJETA} hidden lg:block overflow-x-auto`}>
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-100 dark:bg-zinc-950 text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                <tr>{['Emitido', 'Código', 'Cliente', 'Técnico', 'Trabajo', 'Monto', 'Estado', 'Cargado por', ''].map((t, i) => <th key={`${t}${i}`} scope="col" className="px-3 py-2.5 font-bold">{t}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visibles.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-2.5 min-w-[6.5rem]">{fechaHora(c.creadoEn)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold">{c.codigo || 'S/C'}</td>
                    <td className="px-3 py-2.5 min-w-[8rem]">{c.nombre}</td>
                    <td className="px-3 py-2.5 min-w-[7rem]">{c.tecnico}</td>
                    <td className="px-3 py-2.5 min-w-[8rem] text-zinc-700 dark:text-zinc-300 break-words">{tipoTexto(c)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold">{textoDeCobro(c)}{alerta(c) && <span className="block">{alerta(c)}</span>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{estadoChip(c)}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-700 dark:text-zinc-300">{c.estado === ESTADO_COBRO.CARGADO ? <>{c.cargadoPor}<span className="block">{fechaHora(c.cargadoEn)}</span></> : '-'}</td>
                    <td className="px-3 py-2.5"><Boton variante="secundario" tamano="compacto" onClick={() => setAbierto(c.id)}>Ver</Boton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {cobroAbierto && <CobroModal key={cobroAbierto.id} cobro={cobroAbierto} soloLectura onClose={() => setAbierto(null)} />}
    </div>
  );
}
