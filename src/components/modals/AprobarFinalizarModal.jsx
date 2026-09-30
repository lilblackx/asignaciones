import { useState } from 'react';
import { CheckCheck, ExternalLink, Eye, MapPin, Phone, Tag, User, Wrench, X } from 'lucide-react';
import Modal from '../Modal';
import { buildSmartOltUrl } from '../../utils/smartolt';
import { formatCedula } from '../../utils/ticketDisplay';
import { evaluarPotencia } from '../../utils/potencia';
import ContactoCliente from '../ContactoCliente';

function Campo({ label, value, className = '' }) {
  if (!value) return null;
  return (
    <div className={className}>
      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">{label}</span>
      <span className="text-xs text-zinc-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}

export default function AprobarFinalizarModal({ ticket, onConfirm, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!ticket) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await onConfirm(ticket);
    setIsSubmitting(false);
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-blue-500 flex justify-between items-center sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wide">
                REVISAR ANTES DE APROBAR
              </span>
              <span className="text-xs font-bold text-blue-400">{ticket.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate max-w-[260px] sm:max-w-md">{ticket.nombre}</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-tight">
              Solo lectura. Verifica que los datos que cargó el técnico estén correctos antes de aprobar.
            </p>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-3">
            <Campo label="TÉCNICO" value={ticket.tecnico} className="col-span-1" />
            {ticket.cedula && (
              <div className="col-span-1">
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 block">CÉDULA</span>
                <a
                  href={buildSmartOltUrl(ticket.cedula, ticket.tipoDocumento)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buscar cliente en SmartOLT"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 font-medium hover:underline"
                >
                  {formatCedula(ticket.cedula, ticket.tipoDocumento)}
                  <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                </a>
              </div>
            )}
            <div className="col-span-2 flex items-start gap-2">
              <Wrench className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-red-600 dark:text-red-400 text-xs">{ticket.tipoTrabajo}</span>
                {ticket.falla && <span className="text-zinc-500 dark:text-zinc-400 text-xs"> — {ticket.falla}</span>}
              </div>
            </div>
            <div className="col-span-2 flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span className="text-xs text-zinc-700 dark:text-zinc-300">{ticket.direccion}</span>
            </div>
            {ticket.telefono && (
              <div className="col-span-2 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{ticket.telefono}</span>
              </div>
            )}
            {ticket.creado && (
              <div className="col-span-2 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">Creado por: {ticket.creado}</span>
              </div>
            )}
            <ContactoCliente telefono={ticket.telefono} ubicacion={ticket.ubicacion} napCoordenadas={ticket.napCoordenadas} nombre={ticket.nombre} className="col-span-2" />
          </div>

          {ticket.nap && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-1 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> NAP / CAJA / PUERTO</span>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200">
                {ticket.nap}
              </div>
            </div>
          )}

          {ticket.potenciaDbm != null && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">POTENCIA ÓPTICA</span>
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs flex items-center justify-between gap-2">
                <span className="font-black text-zinc-900 dark:text-white">{ticket.potenciaDbm} dBm</span>
                {evaluarPotencia(ticket.potenciaDbm) && (
                  <span className={`font-bold ${evaluarPotencia(ticket.potenciaDbm).clase}`}>{evaluarPotencia(ticket.potenciaDbm).texto}</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">OBSERVACIÓN / DETALLES DEL TRABAJO</span>
            <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap min-h-[3rem]">
              {ticket.observacion || <span className="text-zinc-400 italic">Sin observación registrada.</span>}
            </div>
          </div>

          {(ticket.historialEdiciones && ticket.historialEdiciones.length > 0) && (
            <div>
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1 block mb-1">REGISTRO DE EDICIONES</span>
              <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {ticket.historialEdiciones.slice().reverse().map((edicion, i) => (
                  <div key={i} className="text-[9px] leading-snug text-zinc-600 dark:text-zinc-400">
                    <span className="font-bold text-red-600 dark:text-red-400">[{edicion.fecha}]</span> <span className="font-black text-zinc-800 dark:text-zinc-200">{edicion.operador}:</span> {edicion.detalle}
                  </div>
                ))}
              </div>
            </div>
          )}

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
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={`flex-1 py-3 text-xs sm:text-sm text-white font-black bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <CheckCheck className="w-4 h-4" />
              {isSubmitting ? 'Aprobando...' : 'Aprobar y Finalizar'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
