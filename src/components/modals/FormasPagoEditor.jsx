import { useState } from 'react';
import { Landmark, Plus, Smartphone, Trash2 } from 'lucide-react';
import { CAMPOS_POR_TIPO, FORMAS_PAGO_INICIALES, TIPO_CUENTA, TIPO_PAGO_MOVIL, TITULO_POR_TIPO, formaVacia, normalizarFormasPago } from '../../utils/formasPago';

const INPUT_CLASS = 'w-full bg-white dark:bg-zinc-950 border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white px-3 py-2 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-sm shadow-sm';
const LABEL_CLASS = 'text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1 uppercase';

// Sin nada guardado todavía (el documento no existe) se precarga con los datos de
// la empresa para que el ADMIN solo revise y guarde. Si ya hay un documento, manda
// siempre lo guardado, aunque esté vacío (el ADMIN pudo quitar todo a propósito).
const desdeFirestore = (raw) => (raw ? normalizarFormasPago(raw) : FORMAS_PAGO_INICIALES);

export default function FormasPagoEditor({ formasPago, onGuardar }) {
  const [formas, setFormas] = useState(() => desdeFirestore(formasPago));
  const [isSaving, setIsSaving] = useState(false);

  // Si otro admin guarda mientras esta pestaña está abierta, o al guardar aquí
  // (que quita las tarjetas vacías), se recarga el formulario con lo guardado.
  // Se ajusta durante el render, igual que el buffer de la pestaña de Tasa.
  const [prevActualizadoEn, setPrevActualizadoEn] = useState(formasPago?.actualizadoEn);
  if (formasPago?.actualizadoEn !== prevActualizadoEn) {
    setPrevActualizadoEn(formasPago?.actualizadoEn);
    setFormas(desdeFirestore(formasPago));
  }

  const setCampo = (i, clave, valor) => setFormas(fs => fs.map((f, j) => (j === i ? { ...f, [clave]: valor } : f)));
  const agregar = (tipo) => setFormas(fs => [...fs, formaVacia(tipo)]);
  const quitar = (i) => setFormas(fs => fs.filter((_, j) => j !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await onGuardar(formas);
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formas.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-2">No hay formas de pago. Agrega una con los botones de abajo.</p>
      )}

      {formas.map((forma, i) => {
        const Icono = forma.tipo === TIPO_PAGO_MOVIL ? Smartphone : Landmark;
        const titulo = TITULO_POR_TIPO[forma.tipo];
        return (
          <div key={i} role="group" aria-label={`${titulo} ${i + 1}`} className="bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-wide">
                <Icono className="w-4 h-4" aria-hidden="true" /> {titulo}
              </span>
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar ${titulo} ${forma.banco || i + 1}`}
                title="Quitar"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            {CAMPOS_POR_TIPO[forma.tipo].map(({ clave, etiqueta, maxLength }) => (
              <div key={clave} className="space-y-1">
                <label htmlFor={`fp-${i}-${clave}`} className={LABEL_CLASS}>{etiqueta}</label>
                <input
                  id={`fp-${i}-${clave}`}
                  type="text"
                  maxLength={maxLength}
                  value={forma[clave]}
                  onChange={(e) => setCampo(i, clave, e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-2">
        {[TIPO_PAGO_MOVIL, TIPO_CUENTA].map(tipo => (
          <button
            key={tipo}
            type="button"
            onClick={() => agregar(tipo)}
            className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl font-bold text-xs border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-red-600 hover:text-red-600 transition-colors"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" /> {tipo === TIPO_PAGO_MOVIL ? 'Pago móvil' : 'Cuenta bancaria'}
          </button>
        ))}
      </div>

      {formasPago?.actualizadoEn && (
        <div className="flex justify-between text-[10px] text-zinc-400">
          <span>Última actualización{formasPago.actualizadoPor ? ` por ${formasPago.actualizadoPor}` : ''}</span>
          <span>{new Date(formasPago.actualizadoEn).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      )}
      {!formasPago && <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold ml-1">Aún sin guardar: los técnicos no verán estos datos hasta que pulses Guardar.</p>}

      <button type="submit" disabled={isSaving} className={`w-full px-4 py-3 text-white font-bold rounded-xl transition-colors shadow-md ${isSaving ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>{isSaving ? 'Guardando...' : 'Guardar formas de pago'}</button>
    </form>
  );
}
