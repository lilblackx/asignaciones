import { useState } from 'react';
import { ArrowDown, ArrowUp, ListOrdered, Trash2, Users, X } from 'lucide-react';
import { COLOR_PALETTE, estiloTecnico, siguienteColorTecnico } from '../../constants';
import { stripEmojis } from '../../utils/sanitizeInput';
import Modal from '../Modal';

// Arranca del orden guardado (filtrando técnicos que ya no existen) y agrega
// al final cualquiera que todavía no esté en la lista (técnico nuevo, o la
// primera vez que se configura el turno y no hay nada guardado aún).
function mergeOrden(ordenGuardado, technicians) {
  const nombresActuales = new Set(technicians.map(t => t.name));
  const base = ordenGuardado.filter(n => nombresActuales.has(n));
  const faltantes = technicians.map(t => t.name).filter(n => !base.includes(n));
  return [...base, ...faltantes];
}

export default function TechniciansModal({ technicians, newTech, setNewTech, handleAddTech, handleDeleteTech, onToggleActivo, ordenTurno = [], tecnicoSugerido = null, onGuardarOrden, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [ordenLocal, setOrdenLocal] = useState(() => mergeOrden(ordenTurno, technicians));
  const [savingOrden, setSavingOrden] = useState(false);

  const ordenCambio = JSON.stringify(ordenLocal) !== JSON.stringify(mergeOrden(ordenTurno, technicians));

  const colorAuto = siguienteColorTecnico(technicians);
  const colorActual = newTech.color || colorAuto;
  const cambiarColor = () => {
    const i = COLOR_PALETTE.findIndex(c => c.value === colorActual);
    setNewTech({ ...newTech, color: COLOR_PALETTE[(i + 1) % COLOR_PALETTE.length].value });
  };

  const moverOrden = (index, direccion) => {
    const destino = index + direccion;
    if (destino < 0 || destino >= ordenLocal.length) return;
    const copia = [...ordenLocal];
    [copia[index], copia[destino]] = [copia[destino], copia[index]];
    setOrdenLocal(copia);
  };

  const guardarOrdenClick = async () => {
    setSavingOrden(true);
    await onGuardarOrden(ordenLocal);
    setSavingOrden(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await handleAddTech(e);
    setIsSubmitting(false);
  };

  const onDelete = async (id) => {
    setDeletingId(id);
    await handleDeleteTech(id);
    setDeletingId(null);
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-[60]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-6 py-4 border-b-2 border-red-600 flex justify-between items-center">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Users className="w-5 h-5 text-red-500" /> TÉCNICOS</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 block ml-1">TÉCNICOS ACTIVOS</label>
            <div className="max-h-36 overflow-y-auto border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-2 space-y-2 bg-zinc-50 dark:bg-zinc-950">
              {technicians.map(t => {
                const activo = t.activo !== false;
                return (
                  <div key={t.id} className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold ${activo ? estiloTecnico(t.color) : 'bg-zinc-300 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ring-2 ring-white dark:ring-zinc-950 ${activo ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
                      {t.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleActivo(t.id, !activo)}
                        aria-label={`Marcar ${t.name} como ${activo ? 'inactivo' : 'activo'}`}
                        title={activo ? 'Marcar como inactivo' : 'Marcar como activo'}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'}`}
                      >
                        {activo ? 'Activo' : 'Inactivo'}
                      </button>
                      <button type="button" onClick={() => onDelete(t.id)} disabled={deletingId === t.id} aria-label={`Eliminar técnico ${t.name}`} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-all disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
              {technicians.length === 0 && <p className="text-xs text-center text-zinc-500 py-3">No hay técnicos.</p>}
            </div>
          </div>

          {technicians.length > 0 && (
            <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 ml-1">
                <ListOrdered className="w-3.5 h-3.5" /> TURNO PARA INSTALACIONES
              </label>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-1">
                Orden semanal manual. Al asignar una instalación, el turno pasa al siguiente de la lista (saltando a los inactivos).
                {tecnicoSugerido
                  ? <> Turno actual: <strong className="text-zinc-700 dark:text-zinc-300">{tecnicoSugerido}</strong>.</>
                  : <> No hay técnicos activos en el orden.</>}
              </p>
              <div className="border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-2 space-y-1.5 bg-zinc-50 dark:bg-zinc-950">
                {ordenLocal.map((nombre, i) => {
                  const tech = technicians.find(t => t.name === nombre);
                  const activo = tech ? tech.activo !== false : false;
                  return (
                    <div key={nombre} className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <span className="text-[10px] font-black text-zinc-400 w-4 text-center shrink-0">{i + 1}</span>
                      <span className={`flex-1 inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${activo ? (estiloTecnico(tech?.color) || '') : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                        {nombre}
                      </span>
                      <button type="button" onClick={() => moverOrden(i, -1)} disabled={i === 0} aria-label={`Subir ${nombre}`} className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => moverOrden(i, 1)} disabled={i === ordenLocal.length - 1} aria-label={`Bajar ${nombre}`} className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowDown className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={guardarOrdenClick}
                disabled={!ordenCambio || savingOrden}
                className={`w-full py-2 text-xs font-bold rounded-lg transition-colors ${!ordenCambio || savingOrden ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
              >
                {savingOrden ? 'Guardando...' : 'Guardar orden'}
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-5">
            <div className="space-y-2">
              <label htmlFor="tech-name" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 ml-1">NUEVO TÉCNICO</label>
              <input id="tech-name" required type="text" maxLength="60" value={newTech.name} onChange={(e) => setNewTech({ ...newTech, name: stripEmojis(e.target.value) })} className="w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3 rounded-xl focus:ring-0 focus:border-red-600 outline-none uppercase transition-colors shadow-sm" placeholder="Nombre completo" />
            </div>
            <div className="flex items-center gap-3 ml-1">
              <span className={`px-2.5 py-1.5 rounded text-xs font-bold ${colorActual}`}>{newTech.name.trim() || 'ETIQUETA'}</span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex-1">{newTech.color ? 'Color elegido' : 'Color automático'}</span>
              <button type="button" onClick={cambiarColor} className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cambiar</button>
            </div>
            <div className="pt-2 flex gap-3 justify-end">
              <button type="submit" disabled={isSubmitting} className={`px-6 py-3 w-full text-white font-bold rounded-xl transition-colors shadow-md ${isSubmitting ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSubmitting ? 'Guardando...' : 'Añadir Técnico'}</button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
