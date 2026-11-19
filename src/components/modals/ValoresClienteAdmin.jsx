import { CheckCircle2, Loader2, Radio, Save } from 'lucide-react';
import SenalSmartOlt from './SenalSmartOlt';
import { calidadValor } from '../../utils/valoresCliente';
import { parsePotencia } from '../../utils/potencia';
import { claseCampo } from '../estilos';
import Aviso from '../Aviso';

const NOTA_SMARTOLT = 'Los valores quedaron en los campos de abajo. Es la última medición de SmartOLT; puedes corregirlos y luego guardarlos.';

function CampoValor({ id, etiqueta, valor, onChange, error, placeholder, obligatorio }) {
  const parseado = parsePotencia(valor);
  const calidad = parseado.valor !== undefined ? calidadValor(parseado.valor) : null;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-bold text-card-foreground ml-1">
        {etiqueta} <span className={`font-normal ${obligatorio ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>{obligatorio ? '(obligatorio)' : '(opcional)'}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        maxLength="7"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, ''))}
        aria-invalid={!!error}
        aria-describedby={`${id}-nota`}
        className={`${claseCampo('grande', error ? 'error' : 'normal')} font-mono`}
      />
      <p id={`${id}-nota`} role={error ? 'alert' : undefined} className={`text-etiqueta font-bold ml-1 ${error ? 'text-red-700 dark:text-red-400' : calidad ? calidad.clase : 'text-muted-foreground font-normal'}`}>
        {error || (calidad ? calidad.texto : 'En dBm. Sin signo se toma como negativo.')}
      </p>
    </div>
  );
}

// Valores de señal del cliente que guarda la oficina antes de aprobar o finalizar: OLT Rx (1310 nm) y ONU Rx
// (1490 nm). Son obligatorios: sin guardarlos no se cierra la orden. El técnico los ve junto al cobro resultante; en las instalaciones no hay
// cobro y no los ve (`tecnicoLosVe` false), pero la oficina igual debe guardarlos.
// El estado vive en el modal (AprobarFinalizarModal) porque el botón de cerrar también lo necesita.
export default function ValoresClienteAdmin({ ticket, obligatorio = true, tecnicoLosVe = true, olt, onu, onOlt, onOnu, errores, guardados, sucio, guardando, errorGuardar, onGuardar }) {
  const capturarSenal = (v1310, v1490) => {
    if (v1310 !== null) onOlt(v1310);
    if (v1490 !== null) onOnu(v1490);
    return true;
  };

  return (
    <section aria-label="Valores del cliente" className="rounded-campo border border-border p-3 space-y-3 text-xs">
      <div>
        <h3 className="flex items-center gap-2 font-black text-foreground">
          <Radio className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" aria-hidden="true" /> Valores del cliente
        </h3>
        <p className="ml-6 mt-1 text-etiqueta text-muted-foreground">
          {tecnicoLosVe
            ? 'Los guardas tú y el técnico los ve junto con el cobro. Los que él capturó al pre-finalizar son solo informativos.'
            : 'Los guardas tú y quedan registrados en la orden; el técnico no los ve. Los que él capturó al pre-finalizar son solo informativos.'}
        </p>
      </div>

      {ticket.cedula && <SenalSmartOlt ticketId={ticket.id} onCapturar={capturarSenal} nota={NOTA_SMARTOLT} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CampoValor id="vc-olt" etiqueta="OLT Rx · Potencia (1310 nm)" valor={olt} onChange={onOlt} error={errores.olt} placeholder="Ej. -19.85" obligatorio={obligatorio} />
        <CampoValor id="vc-onu" etiqueta="ONU Rx · Señal (1490 nm)" valor={onu} onChange={onOnu} error={errores.onu} placeholder="Ej. -22.84" obligatorio={obligatorio} />
      </div>

      {guardados && !sucio ? (
        <Aviso nivel="exito" icono={CheckCircle2} compact titulo={<>Valores guardados{guardados.guardadoPor ? ` por ${guardados.guardadoPor}` : ''}{obligatorio && tecnicoLosVe ? '. El técnico los verá con el cobro' : ''}. Si los cambias, vuelve a guardar.</>} />
      ) : (
        <p role={errorGuardar ? 'alert' : undefined} className="font-bold text-amber-800 dark:text-amber-300">
          {errorGuardar || (sucio ? `Cambiaste los valores: guárdalos de nuevo${obligatorio && tecnicoLosVe ? ' para que el técnico vea los nuevos' : ''}.` : obligatorio ? 'Aún no guardas los valores: sin ellos no se puede cerrar la orden.' : 'Aún no guardas los valores. Si no los vas a registrar, deja los campos vacíos.')}
        </p>
      )}

      <button
        id="vc-guardar"
        type="button"
        onClick={onGuardar}
        disabled={guardando}
        className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-campo text-xs font-black shadow-sm transition-colors disabled:opacity-60 ${guardados && !sucio ? 'bg-card dark:bg-background border border-input text-foreground' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}
      >
        {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
        {guardando ? 'Guardando...' : guardados && !sucio ? 'Guardar valores de nuevo' : 'Guardar valores'}
      </button>
    </section>
  );
}
