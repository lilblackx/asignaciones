import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { MAX_LARGO_OBSERVACION, TRABAJOS_VNTA, cifrasVnTa, columnasEstadisticaVnTa, columnasVnTa, estadisticaRegistros, fechaLegible, filaVnTa, filasEstadisticaVnTa, NOTA_VNTA } from '../../../utils/registroVnTa';
import { stripEmojis } from '../../../utils/sanitizeInput';
import Cifras from './Cifras';
import TablaReporte from './TablaReporte';
import Spinner from '../../Spinner';

const CAMPO = 'w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-red-600';
const ETIQUETA = 'text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

// La hoja de VN y TA: la única del Registro de estadísticas que se llena a mano (ver utils/registroVnTa). Arriba el formulario para agregar una fila
// (o corregir una), debajo las cifras y la lista del periodo con sus botones de editar y borrar.
//   registros: las filas del periodo (useRegistroVnTa), ya filtradas aquí por el técnico elegido arriba
//   puedeBorrar(registro): true si el usuario puede borrarla (un administrador o quien la registró)
//   soloLectura: sin formulario ni botones (Finanzas la ve pero no la llena)
// El técnico es el que apoyó el trabajo y es a quien Finanzas le paga (cada tipo con su precio); sin técnico lo hizo infraestructura sola y no se paga a nadie.
// Una fila que Finanzas ya pagó (pagoId) no se edita ni se borra: ya cuenta ese técnico y esa fecha.
export default function VnTaView({ registros, cargando, error, agregar, actualizar, eliminar, tecnicos, hoy, tecnico, puedeBorrar, soloLectura = false }) {
  const vacio = { trabajo: 'VN', tecnico: '', fecha: hoy, observacion: '' };
  const [form, setForm] = useState(vacio);
  const [editandoId, setEditandoId] = useState(null);
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [borrandoId, setBorrandoId] = useState(null);

  const visibles = useMemo(() => registros.filter((r) => !tecnico || String(r.tecnico || '').toUpperCase() === tecnico.toUpperCase()), [registros, tecnico]);
  const estadistica = estadisticaRegistros(visibles);
  const cambiar = (campo, valor) => { setForm((f) => ({ ...f, [campo]: valor })); setErrorForm(''); };

  const limpiar = () => { setForm(vacio); setEditandoId(null); setErrorForm(''); };

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    const resultado = editandoId ? await actualizar(editandoId, form) : await agregar(form);
    setGuardando(false);
    if (!resultado.ok) { setErrorForm(resultado.error); return; }
    // Al agregar se conservan el tipo, el técnico y la fecha (suelen repetirse en filas seguidas) y se limpia lo escrito de más.
    if (editandoId) limpiar();
    else setForm((f) => ({ ...f, observacion: '' }));
  };

  const editar = (r) => {
    setEditandoId(r.id);
    setForm({ trabajo: r.trabajo, tecnico: r.tecnico || '', fecha: r.fecha, observacion: r.observacion || '' });
    setErrorForm('');
    window.scrollTo?.({ top: 0 });
  };

  const borrar = async (id) => {
    const resultado = await eliminar(id);
    setBorrandoId(null);
    if (!resultado.ok) setErrorForm(resultado.error);
    if (editandoId === id) limpiar();
  };

  const filas = visibles.map((r) => soloLectura ? filaVnTa(r) : [
    ...filaVnTa(r),
    <span key={r.id} className="inline-flex items-center gap-1 whitespace-nowrap">
      {r.pagoId ? (
        <span title="Finanzas ya la pagó: no se puede editar ni borrar" className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold">Pagada</span>
      ) : borrandoId === r.id ? (
        <>
          <button type="button" onClick={() => borrar(r.id)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold">Sí, borrar</button>
          <button type="button" onClick={() => setBorrandoId(null)} className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-[11px] font-bold">No</button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => editar(r)} aria-label={`Editar ${r.codigo}`} title="Editar" className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"><Pencil className="w-3.5 h-3.5" aria-hidden="true" /></button>
          {puedeBorrar(r) && <button type="button" onClick={() => setBorrandoId(r.id)} aria-label={`Borrar ${r.codigo}`} title="Borrar" className="p-1.5 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>}
        </>
      )}
    </span>,
  ]);

  return (
    <div>
      {!soloLectura && <form onSubmit={guardar} className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">{editandoId ? 'Corregir registro' : 'Agregar registro'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label htmlFor="vnta-trabajo" className={ETIQUETA}>Trabajo realizado</label>
            <select id="vnta-trabajo" value={form.trabajo} onChange={(e) => cambiar('trabajo', e.target.value)} disabled={Boolean(editandoId)} className={`${CAMPO} disabled:opacity-60`}>
              {Object.entries(TRABAJOS_VNTA).map(([clave, { nombre }]) => <option key={clave} value={clave}>{nombre}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="vnta-tecnico" className={ETIQUETA}>Técnico que apoyó <span className="font-normal normal-case">(opcional)</span></label>
            <select id="vnta-tecnico" value={form.tecnico} onChange={(e) => cambiar('tecnico', e.target.value)} className={CAMPO}>
              <option value="">Sin técnico</option>
              {tecnicos.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="vnta-fecha" className={ETIQUETA}>Fecha</label>
            <input id="vnta-fecha" type="date" value={form.fecha} onChange={(e) => cambiar('fecha', e.target.value)} className={CAMPO} />
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-4">
            <label htmlFor="vnta-observacion" className={ETIQUETA}>Observación <span className="font-normal normal-case">(opcional)</span></label>
            <textarea id="vnta-observacion" value={form.observacion} onChange={(e) => cambiar('observacion', stripEmojis(e.target.value))} rows={2} maxLength={MAX_LARGO_OBSERVACION} placeholder="Ej. Apoyo en reparar NAP en residencia la colina" className={`${CAMPO} resize-none`} />
          </div>
        </div>
        {errorForm && <p role="alert" className="text-xs font-bold text-red-600 dark:text-red-400 mt-2">{errorForm}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button type="submit" disabled={guardando} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-60">
            {guardando ? <Spinner /> : <Plus className="w-4 h-4" aria-hidden="true" />}{editandoId ? 'Guardar cambios' : 'Agregar'}
          </button>
          {editandoId && <button type="button" onClick={limpiar} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-bold"><X className="w-4 h-4" aria-hidden="true" /> Cancelar</button>}
          {!editandoId && <p className="text-[11px] text-zinc-500">El código (VAN01, TA01...) lo pone la app y queda tu nombre como operador. Con técnico, Finanzas se lo paga; sin técnico (lo hizo infraestructura sola) no se paga.</p>}
        </div>
      </form>}

      {error &&<p role="alert" className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4">{error}</p>}
      <Cifras items={cifrasVnTa(estadistica)} />
      <p className="text-[11px] text-zinc-500 -mt-1 mb-4">{NOTA_VNTA}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
        <TablaReporte titulo="Estadística de VN y TA" columnas={columnasEstadisticaVnTa()} filas={filasEstadisticaVnTa(estadistica)} />
      </div>

      <TablaReporte
        titulo={`Hoja de VN y TA (${visibles.length})`}
        nota={cargando ? 'Cargando...' : 'Las filas del periodo elegido arriba, con las columnas de la hoja de cálculo.'}
        columnas={soloLectura ? columnasVnTa() : [...columnasVnTa(), { titulo: '' }]}
        filas={filas}
        vacio="Ningún registro de VN o TA en este periodo."
      />
      <p className="text-[11px] text-zinc-500 -mt-2 mb-4">Fecha de hoy: {fechaLegible(hoy)}.</p>
    </div>
  );
}
