import { X } from 'lucide-react';
import Modal from '../Modal';
import FormularioPagoCliente from '../FormularioPagoCliente';
import { TIPO_PAGO, pagoClienteDe } from '../../utils/pagoEnOrden';

// Solo el ADMIN: corrige los datos del pago que registró el técnico o, si el técnico dejó "el cliente paga después", registra el pago que sí se hizo. Siempre pide escribir qué se corrigió y queda en el historial
// del pago, de la orden y del cobro con su nombre y la hora (el pago que ve cada pantalla se actualiza solo). A diferencia del técnico, no pide confirmar: la nota explica el cambio.
// `cobro`: el cobro con su `pagoCliente`; `cuentasEmpresa`: las formas de pago de la empresa ya normalizadas; `onCorregir(valor, nota)` guarda y devuelve { ok } o { error, campo }.
export default function CorregirPagoModal({ cobro, cuentasEmpresa = [], onCorregir, onClose }) {
  const p = pagoClienteDe(cobro);
  const registrando = p?.tipo !== TIPO_PAGO.PAGO;
  const esperado = Number(cobro.monto) > 0 ? { monto: Number(cobro.monto), moneda: cobro.moneda } : null;
  return (
    <Modal onClose={onClose} zIndexClass="z-[90]">
      <div role="dialog" aria-labelledby="corregir-pago-titulo" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <h2 id="corregir-pago-titulo" className="text-base font-black text-white">{registrando ? 'Registrar el pago' : 'Corregir el pago'}</h2>
            <p className="text-xs font-bold text-zinc-300 truncate">{cobro.codigo || 'S/C'} · {cobro.nombre}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {registrando
              ? 'El técnico dijo que el cliente pagaba después. Registra los datos del pago que sí se hizo y escribe por qué. Queda en el historial con tu nombre y la hora.'
              : 'Cambia lo que esté mal y escribe qué corregiste. Queda en el historial con tu nombre y la hora; el pago que ven la oficina, Revisión, Finanzas y Administración se actualiza.'}
          </p>
          <FormularioPagoCliente
            idPrefijo="adm-corregir"
            ticket={cobro}
            cobro={esperado}
            cuentasEmpresa={cuentasEmpresa}
            valoresIniciales={p?.tipo === TIPO_PAGO.PAGO ? p.pago : null}
            notaObligatoria
            notaEtiqueta={registrando ? '¿Por qué registras el pago?' : '¿Qué corregiste?'}
            guardarTexto={registrando ? 'Registrar el pago' : 'Guardar la corrección'}
            confirmar={false}
            onGuardar={async (valor, nota) => {
              const r = await onCorregir(valor, nota);
              if (r?.ok) onClose();
              return r;
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
