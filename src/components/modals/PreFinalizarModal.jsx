import { useState } from 'react';
import { AlertCircle, CheckCircle2, MapPin, Plug, Tag, Wrench, X } from 'lucide-react';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';
import SenalSmartOlt from './SenalSmartOlt';
import { separarNapPuerto, unirNapPuerto } from '../../utils/napPuerto';
import { stripEmojis } from '../../utils/sanitizeInput';
import { formatCedula } from '../../utils/ticketDisplay';
import ContactoCliente from '../ContactoCliente';
import DevolucionAviso from '../DevolucionAviso';
import { evaluarPotencia, parsePotencia } from '../../utils/potencia';

const TIPOS_VISITA = [
  { value: '', label: 'Ninguno' },
  { value: 'CONECTOR_EXTERNO', label: 'Conector externo' },
  { value: 'CONECTOR_INTERNO', label: 'Conector interno' },
];

export default function PreFinalizarModal({ ticket, onConfirm, onClose }) {
  const separado = ticket?.tipoVisita === 'CONECTOR_EXTERNO' ? separarNapPuerto(ticket?.nap) : null;
  const [nap, setNap] = useState(separado ? separado.nap : (ticket?.nap || ''));
  const [puerto, setPuerto] = useState(separado ? separado.puerto : '');
  const [tipoVisita, setTipoVisita] = useState(ticket?.tipoVisita || '');
  const [napError, setNapError] = useState('');
  const [puertoError, setPuertoError] = useState('');
  const [observacion, setObservacion] = useState(ticket?.observacion || '');
  const [potencia, setPotencia] = useState(ticket?.potenciaDbm != null ? String(ticket.potenciaDbm) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [obsError, setObsError] = useState('');

  if (!ticket) return null;

  const conectorExterno = tipoVisita === 'CONECTOR_EXTERNO';
  const potenciaParseada = parsePotencia(potencia);
  const potenciaEval = potenciaParseada.valor !== undefined ? evaluarPotencia(potenciaParseada.valor) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!observacion.trim()) {
      setObsError('Debes describir el trabajo realizado antes de pre-finalizar.');
      return;
    }
    if (conectorExterno) {
      const faltaNap = !nap.trim();
      const faltaPuerto = !puerto.trim();
      setNapError(faltaNap ? 'Indica la nomenclatura de la NAP.' : '');
      setPuertoError(faltaPuerto ? 'Indica el puerto.' : '');
      if (faltaNap || faltaPuerto) return;
    }
    if (potenciaParseada.error) return;
    setObsError('');
    setNapError('');
    setPuertoError('');
    setIsSubmitting(true);
    await onConfirm(ticket, { nap: conectorExterno ? unirNapPuerto(nap, puerto) : nap, observacion, potenciaDbm: potenciaParseada.valor ?? null, tipoVisita });
    setIsSubmitting(false);
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-amber-500 flex justify-between items-center sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded tracking-wide">
                PRE-FINALIZAR
              </span>
              <span className="text-xs font-bold text-amber-400">
                {ticket.codigo || 'S/C'}
              </span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate max-w-[260px] sm:max-w-md">
              {ticket.nombre}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <DevolucionAviso ticket={ticket} />
          {/* Resumen compacto de la orden */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="font-bold text-red-600 dark:text-red-400">{ticket.tipoTrabajo}</span>
              {ticket.falla && <span className="text-zinc-400">({ticket.falla})</span>}
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{ticket.direccion}</span>
            </div>
            {ticket.cedula && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Tag className="w-3 h-3 text-zinc-400 shrink-0" />
                <span>C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</span>
                {ticket.telefono && <span className="ml-2">Telf: {ticket.telefono}</span>}
              </div>
            )}
            <ContactoCliente telefono={ticket.telefono} ubicacion={ticket.ubicacion} napCoordenadas={ticket.napCoordenadas} nombre={ticket.nombre} className="pt-1" />
          </div>

          <div className="space-y-1">
            <label htmlFor="pf-tipo-visita" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              TIPO DE VISITA <span className="font-normal text-zinc-400">(opcional)</span>
            </label>
            <SelectMenu
              id="pf-tipo-visita"
              ariaLabel="Tipo de visita"
              icon={Plug}
              value={tipoVisita}
              onChange={(v) => {
                setTipoVisita(v);
                setNapError('');
                setPuertoError('');
                // Un texto ya escrito como "NAP 08 - Puerto 3" se reparte en los dos campos.
                if (v === 'CONECTOR_EXTERNO' && !puerto) {
                  const sep = separarNapPuerto(nap);
                  setNap(sep.nap);
                  setPuerto(sep.puerto);
                }
              }}
              items={TIPOS_VISITA}
            />
          </div>

          {conectorExterno ? (
            <div className="space-y-2">
              <div className="flex gap-2.5 items-start">
                <div className="space-y-1 flex-1 min-w-0">
                  <label htmlFor="pf-nap" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
                    NOMENCLATURA DE LA NAP <span className="font-normal text-red-500">(obligatorio)</span>
                  </label>
                  <input
                    id="pf-nap"
                    type="text"
                    maxLength="40"
                    placeholder="Ej. NAP 08"
                    value={nap}
                    onChange={(e) => { setNap(stripEmojis(e.target.value)); if (napError) setNapError(''); }}
                    aria-invalid={!!napError}
                    className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${napError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
                  />
                  {napError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{napError}</p>}
                </div>
                <div className="space-y-1 w-24 shrink-0">
                  <label htmlFor="pf-puerto" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
                    PUERTO <span className="font-normal text-red-500">(obligatorio)</span>
                  </label>
                  <input
                    id="pf-puerto"
                    type="text"
                    inputMode="numeric"
                    maxLength="3"
                    placeholder="Ej. 3"
                    value={puerto}
                    onChange={(e) => { setPuerto(e.target.value.replace(/\D/g, '')); if (puertoError) setPuertoError(''); }}
                    aria-invalid={!!puertoError}
                    className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${puertoError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
                  />
                  {puertoError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{puertoError}</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label htmlFor="pf-nap" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
                NAP / CAJA / PUERTO <span className="font-normal text-zinc-400">(opcional)</span>
              </label>
              <input
                id="pf-nap"
                type="text"
                maxLength="50"
                placeholder="Ej. NAP 08 - Puerto 3"
                value={nap}
                onChange={(e) => setNap(stripEmojis(e.target.value))}
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors"
              />
            </div>
          )}

          {tipoVisita && (
            <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-xl p-3 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-200">
              <Plug className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-tight">
                {conectorExterno ? 'Conector externo' : 'Conector interno'}: cuando se finalice la orden, verás el cobro resultante para el cliente.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="pf-potencia" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              POTENCIA ÓPTICA (dBm) <span className="font-normal text-zinc-400">(opcional)</span>
            </label>
            <input
              id="pf-potencia"
              type="text"
              inputMode="decimal"
              maxLength="7"
              placeholder="Ej. -19.5"
              value={potencia}
              onChange={(e) => setPotencia(e.target.value.replace(/[^0-9.,-]/g, ''))}
              aria-invalid={!!potenciaParseada.error}
              aria-describedby="pf-potencia-hint"
              className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${potenciaParseada.error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
            />
            <p id="pf-potencia-hint" role={potenciaParseada.error ? 'alert' : undefined} className={`text-[10px] font-bold ml-1 ${potenciaParseada.error ? 'text-red-600 dark:text-red-400' : potenciaEval ? potenciaEval.clase : 'text-zinc-400 font-normal'}`}>
              {potenciaParseada.error || (potenciaEval ? potenciaEval.texto : 'Potencia recibida en la ONU. Si omites el signo se toma como negativa.')}
            </p>
            {ticket.cedula && <SenalSmartOlt ticketId={ticket.id} onCapturar={setPotencia} />}
          </div>

          <div className="space-y-1">
            <label htmlFor="pf-obs"className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              OBSERVACIÓN / DETALLES DEL TRABAJO <span className="font-normal text-red-500">(obligatorio)</span>
            </label>
            <textarea
              id="pf-obs"
              required
              rows="3"
              maxLength="300"
              placeholder="Escribe detalles del servicio (ej. Instalación operativa, cliente conforme)..."
              value={observacion}
              onChange={(e) => { setObservacion(stripEmojis(e.target.value)); if (obsError) setObsError(''); }}
              aria-invalid={!!obsError}
              className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors resize-none ${obsError ? 'border-red-500 focus:border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
            />
            {obsError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{obsError}</p>}
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-tight">
              Esta orden quedará en estado <strong>PRE-FINALIZADA</strong> para que el administrador u operador revise y realice la finalización definitiva.
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3 text-xs sm:text-sm text-black font-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{isSubmitting ? 'Guardando...' : 'Confirmar'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
