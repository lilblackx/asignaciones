import { useEffect, useRef } from 'react';
import { montoCalculadora } from '../../utils/montoCalculadora';
import { Check } from 'lucide-react';
import { COBRO_EXONERADO, COBRO_OTRO, COBRO_VISITA, ETIQUETA_COBRO, MONEDA_BS, MONEDA_USD } from '../../utils/cobro';
import { ETIQUETA_CAMPO, claseCampo } from '../estilos';
import Segmentado from '../Segmentado';

// Qué cobro se le informa al técnico al finalizar la orden: "Visita técnica" (el monto de
// siempre), "Otro monto" (escrito a mano; es el que verá el técnico en su aviso final) o
// "Exonerar" (no se cobra; el aviso le dice que no cobre nada).
// `idBase` evita ids repetidos si hay dos selectores en pantalla. `modos` limita las opciones que se ofrecen
// (la consulta de cobro de un recableado no lleva "Visita técnica").
export default function CobroSelector({ idBase = 'cobro', montoVisita, seleccion, onChange, error, modos = [COBRO_VISITA, COBRO_OTRO, COBRO_EXONERADO], tituloOtro = ETIQUETA_COBRO[COBRO_OTRO] }) {
  const inputRef = useRef(null);
  const esOtro = seleccion.modo === COBRO_OTRO;
  const moneda = seleccion.moneda === MONEDA_USD ? MONEDA_USD : MONEDA_BS;

  // Al elegir "Otro monto" el cursor pasa al campo del monto; si el monto escrito no es válido, vuelve ahí.
  // Si el selector ya se abre con "Otro monto" (cobro respondido de antemano), no se lleva el cursor: taparía el aviso de arriba.
  const modoAlAbrir = useRef(seleccion.modo);
  useEffect(() => {
    if (!esOtro) modoAlAbrir.current = null;
    if (esOtro && modoAlAbrir.current !== COBRO_OTRO) inputRef.current?.focus();
  }, [esOtro]);
  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const opcion = (modo, titulo, detalle) => {
    const activa = seleccion.modo === modo;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={activa}
        onClick={() => onChange({ ...seleccion, modo })}
        className={`w-full flex items-center gap-3 text-left px-3 py-3 rounded-campo border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
          activa ? 'border-red-600 bg-red-50 dark:bg-red-950/30' : 'border-input bg-card hover:border-zinc-500'
        }`}
      >
        <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${activa ? 'bg-red-600 border-red-600 text-white' : 'border-input'}`} aria-hidden="true">
          {activa && <Check className="w-3 h-3" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-foreground">{titulo}</span>
          {detalle && <span className="block text-xs text-muted-foreground">{detalle}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-2 text-left">
      <p id={`${idBase}-titulo`} className={`${ETIQUETA_CAMPO} ml-1`}>Cobro que verá el técnico</p>
      <div role="radiogroup" aria-labelledby={`${idBase}-titulo`} className="space-y-2">
        {modos.includes(COBRO_VISITA) && opcion(COBRO_VISITA, ETIQUETA_COBRO[COBRO_VISITA], montoVisita ? `${montoVisita} Bs (monto de siempre, con la tasa de hoy; siempre en Bs)` : 'La tasa no está configurada: el técnico no verá monto.')}
        {modos.includes(COBRO_OTRO) && opcion(COBRO_OTRO, tituloOtro, 'Escribe el monto que se debe cobrar, en Bs o en $')}
        {modos.includes(COBRO_EXONERADO) && opcion(COBRO_EXONERADO, ETIQUETA_COBRO[COBRO_EXONERADO], 'No se cobra esta visita al cliente')}
      </div>
      {esOtro && (
        <div className="space-y-1">
          <Segmentado llena grande ariaLabel="Moneda del cobro" opciones={[{ id: MONEDA_BS, etiqueta: 'Bs (bolívares)' }, { id: MONEDA_USD, etiqueta: '$ (dólares)' }]} valor={moneda} onCambiar={(valor) => onChange({ ...seleccion, moneda: valor })} />
          <label htmlFor={`${idBase}-otro`} className={`${ETIQUETA_CAMPO} ml-1`}>Monto a cobrar ({moneda === MONEDA_USD ? '$' : 'Bs'})</label>
          <input
            id={`${idBase}-otro`}
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0,00"
            value={seleccion.otro}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange({ ...seleccion, otro: montoCalculadora(e.target.value) })}
            aria-invalid={!!error}
            aria-describedby={error ? `${idBase}-error` : undefined}
            className={`${claseCampo('grande', error ? 'error' : 'normal')} font-bold text-right tabular-nums`}
          />
          <p className="text-xs text-muted-foreground ml-1">Escribe solo los números: se llenan de derecha a izquierda y los dos últimos son los decimales (569600 se ve 5.696,00).</p>
          {error && <p id={`${idBase}-error`} role="alert" className="text-xs text-red-700 dark:text-red-400 font-bold ml-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
