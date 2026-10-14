import { useMemo, useState } from 'react';
import { Cable, ChevronDown, X } from 'lucide-react';
import Modal from '../Modal';
import { PERIODOS, consumoPorTecnico, inicioPeriodo, totalConectores } from '../../utils/consumoMateriales';
import { aplanarArchivados } from '../../utils/reincidencia';
import { ETIQUETA_COLOR } from '../../utils/tipoVisita';

const numero = (n) => Number(n).toLocaleString('es-VE');
const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');

const PUNTO = { VERDE: 'bg-emerald-500', AZUL: 'bg-blue-500' };
const PLURAL_COLOR = { VERDE: 'verdes', AZUL: 'azules' };

// Los conectores se cuentan solo por color (verde o azul), sin distinguir externo de interno.
// "1 conector verde", "2 conectores azules".
const textoConectores = (cantidad, color) =>
  `${cantidad} conector${cantidad === 1 ? '' : 'es'} ${cantidad === 1 ? ETIQUETA_COLOR[color].toLowerCase() : PLURAL_COLOR[color]}`;

// Cantidad de conectores de un color: el color se lee en el texto, no solo en el punto.
function ChipConector({ color, cantidad }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${cantidad > 0 ? 'border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${PUNTO[color]} ${cantidad > 0 ? '' : 'opacity-40'}`} aria-hidden="true" />
      Conector {ETIQUETA_COLOR[color].toLowerCase()}: <span className="font-black">{cantidad}</span>
    </span>
  );
}

function Conectores({ fila }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ChipConector color="VERDE" cantidad={fila.verde} />
      <ChipConector color="AZUL" cantidad={fila.azul} />
    </div>
  );
}

function Dato({ etiqueta, valor, detalle }) {
  return (
    <div className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
      <p className="text-[10px] font-bold tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">{etiqueta}</p>
      <p className="text-2xl font-black text-zinc-900 dark:text-white leading-tight">{valor}</p>
      {detalle && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">{detalle}</p>}
    </div>
  );
}

function FilaTecnico({ fila, abierto, onToggle }) {
  const idDetalle = `materiales-${fila.tecnico.replace(/\W+/g, '-')}`;
  const conDatos = fila.detalle.length > 0;
  const resumen = (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-black text-zinc-900 dark:text-white truncate">{fila.tecnico}</span>
        <span className={`shrink-0 text-lg font-black ${conDatos ? 'text-red-600 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-600'}`}>{numero(fila.metros)} <span className="text-xs">m</span></span>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {fila.ordenes} recableado{fila.ordenes === 1 ? '' : 's'} · {totalConectores(fila)} conector{totalConectores(fila) === 1 ? '' : 'es'}
      </p>
      {conDatos && <Conectores fila={fila} />}
    </div>
  );
  return (
    <li className="bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      {conDatos ? (
        <button type="button" onClick={onToggle} aria-expanded={abierto} aria-controls={idDetalle} className="w-full text-left p-3 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          {resumen}
          <ChevronDown className={`w-4 h-4 mt-1 shrink-0 text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      ) : (
        <div className="p-3 flex">{resumen}</div>
      )}
      {abierto && conDatos && (
        <ul id={idDetalle} className="border-t border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
          {fila.detalle.map((o) => (
            <li key={o.id} className="px-3 py-2 text-xs flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-zinc-800 dark:text-zinc-100 truncate">{o.codigo || 'S/C'}{o.nombre ? ` — ${o.nombre}` : ''}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {fechaCorta(o.fecha)}
                  {o.verde > 0 && ` · ${textoConectores(o.verde, 'VERDE')}`}
                  {o.azul > 0 && ` · ${textoConectores(o.azul, 'AZUL')}`}
                  {totalConectores(o) === 0 && ' · sin conectores'}
                </p>
              </div>
              <span className="shrink-0 font-black text-zinc-900 dark:text-white">{numero(o.metros)} m</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// Módulo solo para ADMIN: metros de cable y conectores usados en los recableados, en total y
// por técnico (todos los registrados, aunque no hayan usado material en el período).
// Suma las órdenes activas y las ya archivadas en los reportes de cierre que estén cargados.
export default function MaterialesModal({ tickets, reports, technicians, hasMoreReports, isLoadingReports, onLoadMore, onClose }) {
  const [periodo, setPeriodo] = useState('MES');
  const [abierto, setAbierto] = useState(null);

  const ordenes = useMemo(() => [...tickets, ...aplanarArchivados(reports)], [tickets, reports]);
  const nombresTecnicos = useMemo(() => technicians.map((t) => t.name), [technicians]);
  const { filas, totales, porAprobar } = useMemo(
    () => consumoPorTecnico(ordenes, { desde: inicioPeriodo(periodo), tecnicos: nombresTecnicos }),
    [ordenes, periodo, nombresTecnicos]
  );

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Cable className="w-5 h-5 text-red-500" aria-hidden="true" /> MATERIALES</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Metros de cable y conectores usados en los recableados ya aprobados, en total y por técnico.</p>

          <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${periodo === p.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-red-600'}`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Dato etiqueta="Metros de cable" valor={`${numero(totales.metros)} m`} />
            <Dato etiqueta="Recableados" valor={numero(totales.ordenes)} />
            <Dato etiqueta="Conectores" valor={numero(totalConectores(totales))} detalle={`Verde ${totales.verde} · Azul ${totales.azul}`} />
          </div>

          {porAprobar.ordenes > 0 && (
            <p role="status" className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3 py-2">
              {porAprobar.ordenes} recableado{porAprobar.ordenes === 1 ? '' : 's'} ({numero(porAprobar.metros)} m) espera{porAprobar.ordenes === 1 ? '' : 'n'} aprobación y todavía no se suma{porAprobar.ordenes === 1 ? '' : 'n'}.
            </p>
          )}

          {filas.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No hay recableados aprobados en este período.</p>
          ) : (
            <section aria-labelledby="materiales-por-tecnico" className="space-y-2">
              <h3 id="materiales-por-tecnico" className="text-[10px] font-bold tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">Por técnico</h3>
              <ul className="space-y-2.5">
                {filas.map((fila) => (
                  <FilaTecnico key={fila.tecnico} fila={fila} abierto={abierto === fila.tecnico} onToggle={() => setAbierto(abierto === fila.tecnico ? null : fila.tecnico)} />
                ))}
              </ul>
            </section>
          )}

          <div className="text-[10px] text-zinc-400 flex flex-wrap items-center justify-between gap-2">
            <span>Incluye las órdenes activas y {reports.length} reporte{reports.length === 1 ? '' : 's'} de cierre cargado{reports.length === 1 ? '' : 's'}.</span>
            {hasMoreReports && (
              <button type="button" onClick={onLoadMore} disabled={isLoadingReports} className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:border-red-600 disabled:opacity-50">
                {isLoadingReports ? 'Cargando...' : 'Cargar reportes anteriores'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
