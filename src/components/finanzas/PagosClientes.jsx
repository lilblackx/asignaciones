import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Chip from '../Chip';
import BotonLimpiarBusqueda from '../BotonLimpiarBusqueda';
import Boton from '../Boton';
import SelectMenu from '../SelectMenu';
import ConciliarPagoModal from '../modals/ConciliarPagoModal';
import { BUSCADOR } from '../estilos';
import { SELECTOR, TARJETA, TEXTO_SUAVE, TITULO_SECCION } from './estilos';
import { etiquetaRango } from '../../utils/periodoReporte';
import { formatoMontoBs, textoMonto } from '../../utils/cobro';
import {
  CLASE_PAGO_FINANZAS, ETIQUETA_PAGO_FINANZAS, FILTROS_TIPO_PAGO, cifrasPagosClientes, filtrarPagosClientes, pagosClientesDelPeriodo, resumenPorForma, textoPago, tipoPagoFinanzas,
} from '../../utils/pagoCliente';

const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const monto = (m, moneda) => textoMonto(formatoMontoBs(Number(m) || 0), moneda);

// La sección "Pagos de clientes" de Finanzas: lo que los clientes pagaron por las instalaciones y los cambios de equipo, tal como lo registró el técnico, con todos sus datos (forma, banco,
// titular, referencia, cuenta de la empresa, monto). Solo lectura. El período y el técnico son los de la barra de arriba de Finanzas.
//   pagos: los leídos del período (usePagosFinanzas).
export default function PagosClientes({ pagos, rango, tecnico, cargado, error }) {
  const [tipo, setTipo] = useState('');
  const [forma, setForma] = useState('');
  const [moneda, setMoneda] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(null);

  const delPeriodo = useMemo(() => pagosClientesDelPeriodo(pagos, rango, { tecnico }), [pagos, rango, tecnico]);
  const visibles = useMemo(() => filtrarPagosClientes(delPeriodo, { tipo, forma, moneda, busqueda }), [delPeriodo, tipo, forma, moneda, busqueda]);
  const formas = useMemo(() => [...new Set(delPeriodo.map((p) => p.pago?.forma).filter(Boolean))].sort(), [delPeriodo]);
  const porForma = useMemo(() => resumenPorForma(visibles), [visibles]);
  const pagoAbierto = abierto ? delPeriodo.find((p) => p.id === abierto) || null : null;

  if (error && !cargado) return <p role="alert" className="text-base text-red-600 dark:text-red-400 text-center py-10">No se pudieron leer los pagos de los clientes. Recarga la página e intenta de nuevo.</p>;
  if (!cargado) return <p role="status" className="text-base text-zinc-600 dark:text-zinc-300 text-center py-10">Cargando los pagos...</p>;

  const estadoChip = () => <span className={`inline-block whitespace-nowrap text-[11px] max-lg:text-xs leading-tight font-black px-2 py-0.5 rounded ${CLASE_PAGO_FINANZAS}`}>{ETIQUETA_PAGO_FINANZAS}</span>;
  const detalle = (p) => (p.pago ? textoPago(p.pago) : p.compartidoCon ? `Pagó junto con ${p.compartidoCon.codigo}` : p.cobro ? `Debe ${monto(p.cobro.monto, p.cobro.moneda)}` : 'Sin pago');
  const datosExtra = (p) => [p.pago?.titular && `Titular: ${p.pago.titular}`, p.pago?.cuentaEmpresa && `Llegó a: ${p.pago.cuentaEmpresa}`].filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Dos por fila en el celular: la cifra de bolívares no cabe en cuatro columnas. */}
      <section aria-label="Resumen" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cifrasPagosClientes(visibles).map(({ etiqueta, valor, detalle }) => (
          <div key={etiqueta} className={`${TARJETA} p-3 min-w-0`}>
            <p className="text-xl sm:text-2xl font-extrabold tabular-nums leading-none break-words text-zinc-900 dark:text-white">{valor}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100">{etiqueta}</p>
            {detalle && <p className="text-xs text-zinc-600 dark:text-zinc-300 break-words">{detalle}</p>}
          </div>
        ))}
      </section>

      <h2 className={TITULO_SECCION}>Pagos de clientes · {etiquetaRango(rango)}</h2>
      <p className={TEXTO_SUAVE}>Lo que el cliente pagó por cada instalación y cada cambio de equipo, tal como lo registró el técnico.</p>

      {porForma.length > 0 && (
        <ul aria-label="Por forma de pago" className={`${TARJETA} px-4 divide-y divide-zinc-200 dark:divide-zinc-800`}>
          {porForma.map((f) => (
            <li key={f.forma} className="py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-bold text-sm">{f.forma} <span className="font-normal text-zinc-600 dark:text-zinc-300">· {f.cantidad} {f.cantidad === 1 ? 'pago' : 'pagos'}</span></span>
              <span className="text-sm font-bold tabular-nums">{[f.USD > 0 && monto(f.USD, 'USD'), f.BS > 0 && monto(f.BS, 'BS')].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input type="search" aria-label="Buscar por código, cliente, cédula, técnico o referencia" placeholder="Código, cliente, cédula o referencia" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={BUSCADOR} />
          <BotonLimpiarBusqueda valor={busqueda} onLimpiar={() => setBusqueda('')} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Tipo de orden" className="flex flex-wrap gap-1.5">
            {FILTROS_TIPO_PAGO.map(({ valor, etiqueta }) => <Chip activo={tipo === valor} tamano="compacto" key={valor || 'todos'} type="button" onClick={() => setTipo(valor)}>{etiqueta}</Chip>)}
          </div>
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex">
            <SelectMenu ariaLabel="Forma de pago" className={SELECTOR} value={forma} onChange={setForma} items={[{ value: '', label: 'Todas las formas' }, ...formas.map((f) => ({ value: f, label: f }))]} />
            <SelectMenu ariaLabel="Moneda" className={SELECTOR} value={moneda} onChange={setMoneda} items={[{ value: '', label: 'Bs y $' }, { value: 'BS', label: 'Bolívares (Bs)' }, { value: 'USD', label: 'Dólares ($)' }]} />
          </div>
        </div>
      </div>

      <p className={TEXTO_SUAVE} aria-live="polite">{visibles.length} {visibles.length === 1 ? 'pago' : 'pagos'}</p>

      {visibles.length === 0 ? (
        <p className="text-base text-zinc-700 dark:text-zinc-200 text-center py-10">{delPeriodo.length ? 'Ningún pago coincide con lo que buscas. Prueba quitar algún filtro.' : 'Ningún pago de instalaciones ni de cambios de equipo en este periodo. Amplía el rango de fechas para ver anteriores.'}</p>
      ) : (
        <>
          {/* Celular y tablet: una tarjeta por pago. */}
          <ul className="lg:hidden flex flex-col gap-2">
            {visibles.map((p) => (
              <li key={p.id} className={`${TARJETA} p-3 space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black text-sm">{p.codigo || 'S/C'} <span className="font-bold">· {p.nombre}</span></p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">{tipoPagoFinanzas(p)} · {p.tecnico} · {fechaHora(p.pago?.pagadoEn || p.creadoEn)}</p>
                  </div>
                  {estadoChip()}
                </div>
                <p className="text-sm font-bold break-words">{detalle(p)}</p>
                {datosExtra(p).map((l) => <p key={l} className="text-xs text-zinc-700 dark:text-zinc-300 break-words">{l}</p>)}
                {p.nota && <p className="text-xs text-zinc-700 dark:text-zinc-300 break-words">Nota del técnico: {p.nota}</p>}
                <Boton variante="secundario" tamano="grande" className="w-full" onClick={() => setAbierto(p.id)}>Ver todos los datos</Boton>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla. */}
          <div className={`${TARJETA} hidden lg:block overflow-x-auto`}>
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-100 dark:bg-zinc-950 text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                <tr>{['Pagado el', 'Código', 'Cliente', 'Técnico', 'Tipo', 'Pago', 'Titular y cuenta', 'Estado', ''].map((c, i) => <th key={`${c}${i}`} scope="col" className="px-3 py-2.5 font-bold">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visibles.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-2.5 min-w-[6.5rem]">{fechaHora(p.pago?.pagadoEn || p.creadoEn)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold">{p.codigo || 'S/C'}</td>
                    <td className="px-3 py-2.5 min-w-[8rem]">{p.nombre}</td>
                    <td className="px-3 py-2.5 min-w-[7rem]">{p.tecnico}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{tipoPagoFinanzas(p)}</td>
                    <td className="px-3 py-2.5 min-w-[12rem] font-bold break-words">{detalle(p)}</td>
                    <td className="px-3 py-2.5 min-w-[10rem] text-xs text-zinc-700 dark:text-zinc-300 break-words">{datosExtra(p).map((l) => <span key={l} className="block">{l}</span>)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{estadoChip()}</td>
                    <td className="px-3 py-2.5"><Boton variante="secundario" tamano="compacto" onClick={() => setAbierto(p.id)}>Ver</Boton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {pagoAbierto && <ConciliarPagoModal key={pagoAbierto.id} pago={pagoAbierto} soloLectura onClose={() => setAbierto(null)} />}
    </div>
  );
}
