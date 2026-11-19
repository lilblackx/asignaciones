import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CAMPOS_POR_TIPO, FORMAS_PAGO_INICIALES, TIPOS_AGREGABLES, TITULO_POR_TIPO, formaVacia, normalizarFormasPago } from '../../utils/formasPago';
import { ICONO_POR_TIPO } from './formasPagoIconos';
import Spinner from '../Spinner';
import Boton from '../Boton';
import { TARJETA, claseCampo } from '../estilos';

const INPUT_CLASS = claseCampo('grande');
const LABEL_CLASS = 'text-xs font-bold text-muted-foreground ml-1';

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
        <p className="text-xs text-muted-foreground text-center py-2">No hay formas de pago. Agrega una con los botones de abajo.</p>
      )}

      {formas.map((forma, i) => {
        const Icono = ICONO_POR_TIPO[forma.tipo];
        const titulo = TITULO_POR_TIPO[forma.tipo];
        return (
          <div key={i} role="group" aria-label={`${titulo} ${i + 1}`} className={`${TARJETA} p-4 space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2.5 text-sm font-black text-foreground">
                <span aria-hidden="true" className="shrink-0 w-9 h-9 rounded-full inline-flex items-center justify-center bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"><Icono className="w-[18px] h-[18px]" /></span>
                {titulo}
              </span>
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar ${titulo} ${forma.banco || i + 1}`}
                title="Quitar"
                className="p-2 rounded-campo text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-[18px] h-[18px]" aria-hidden="true" />
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
        {TIPOS_AGREGABLES.map(({ tipo, etiqueta }) => (
          <button
            key={tipo}
            type="button"
            onClick={() => agregar(tipo)}
            className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-boton font-bold text-xs border-2 border-dashed border-input text-muted-foreground hover:border-red-600 hover:text-red-600 transition-colors"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" /> {etiqueta}
          </button>
        ))}
      </div>

      {formasPago?.actualizadoEn && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Última actualización{formasPago.actualizadoPor ? ` por ${formasPago.actualizadoPor}` : ''}</span>
          <span>{new Date(formasPago.actualizadoEn).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      )}
      {!formasPago && <p className="text-xs text-amber-700 dark:text-amber-400 font-bold ml-1">Aún sin guardar: los técnicos no verán estos datos hasta que pulses Guardar.</p>}

      <Boton variante="principal" tamano="grande" className="w-full" type="submit" disabled={isSaving}>{isSaving && <Spinner />}{isSaving ? 'Guardando...' : 'Guardar formas de pago'}</Boton>
    </form>
  );
}
