import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import Modal from '../Modal';
import { normalizarUbicacion } from '../../utils/ubicacion';

// Pegado manual de la ubicación de una orden. Se abre cuando el portapapeles no
// tenía un enlace válido, o para cambiar una ubicación ya guardada.
export default function UbicacionModal({ ticket, onSave, onClose }) {
  const [valor, setValor] = useState(ticket.ubicacion || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parseada = normalizarUbicacion(valor);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!parseada.valor) return;
    setIsSubmitting(true);
    const ok = await onSave(ticket, parseada.valor);
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3 border-b-2 border-sky-500 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-sky-400" aria-hidden="true" /> UBICACIÓN</h2>
            <p className="text-[10px] font-medium text-sky-400">{ticket.codigo || 'S/C'} — {ticket.nombre}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-3">
          {!ticket.ubicacion && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              No se encontró un enlace de ubicación en el portapapeles. En WhatsApp Web toca el mapa, copia el enlace de la pestaña de Google Maps que se abre y pégalo aquí.
            </p>
          )}
          <div className="space-y-1">
            <label htmlFor="ub-valor" className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1">ENLACE DE GOOGLE MAPS O COORDENADAS</label>
            <input
              id="ub-valor"
              autoFocus
              type="text"
              inputMode="url"
              maxLength="600"
              placeholder="https://maps.app.goo.gl/... o 10.4806, -66.9036"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              aria-invalid={!!parseada.error}
              className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2 rounded-lg outline-none text-xs text-zinc-900 dark:text-white ${parseada.error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-sky-500'}`}
            />
            {parseada.error && <p role="alert" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">{parseada.error}</p>}
            {parseada.valor && <a href={parseada.valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-400 hover:underline ml-1"><MapPin className="w-3 h-3" aria-hidden="true" /> Probar enlace</a>}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={!parseada.valor || isSubmitting} className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-zinc-400 disabled:cursor-not-allowed rounded-lg transition-colors">{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
