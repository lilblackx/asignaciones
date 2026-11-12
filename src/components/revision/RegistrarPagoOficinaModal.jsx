import { X } from 'lucide-react';
import Modal from '../Modal';
import FormularioPagoCliente from '../FormularioPagoCliente';
import { cobroEsperadoDe } from '../../utils/pagoCliente';

// Solo el ADMIN, desde Revisión: registra el pago del cliente de una orden a nombre del técnico, cuando el técnico no lo ha registrado y la orden está esperando para aprobarse. Pide escribir por qué lo registra
// la oficina y queda marcado en la orden, en el pago y en el historial ("registrado por la oficina a nombre del técnico"). Si el cliente todavía no pagó, también puede dejarlo como "paga después".
// `orden`: la orden con su técnico; `cuentasEmpresa`: las formas de pago de la empresa ya normalizadas; `onRegistrar(valor, nota)` y `onPagaDespues({ nota })` guardan y devuelven { ok }, { repetida } o { error }.
export default function RegistrarPagoOficinaModal({ orden, cuentasEmpresa = [], onRegistrar, onPagaDespues, onClose }) {
  // Si al crear la orden se acordó "Pagada", los datos del pago ya están anotados en la orden: el formulario se abre con ellos.
  const pagoAcordado = orden.cobroAcordado?.modo === 'PAGADA' && orden.cobroAcordado.pago ? orden.cobroAcordado.pago : null;
  return (
    <Modal onClose={onClose} zIndexClass="z-[90]">
      <div role="dialog" aria-labelledby="oficina-pago-titulo" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <h2 id="oficina-pago-titulo" className="text-base font-black text-white">Registrar el pago a nombre del técnico</h2>
            <p className="text-xs font-bold text-zinc-300 truncate">{orden.codigo || 'S/C'} · {orden.nombre}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" aria-hidden="true" /></button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {orden.tecnico ? `${orden.tecnico} todavía no registró el pago de esta orden. ` : ''}Anota el pago que el cliente hizo y escribe por qué lo registras tú. Queda en el historial con tu nombre y la hora, marcado como
            registrado por la oficina; el técnico ya no tendrá que registrarlo.
          </p>
          {pagoAcordado && <p role="status" className="rounded-lg border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2 text-xs font-bold text-emerald-900 dark:text-emerald-300">Al crear la orden se anotó que el cliente ya pagó: el formulario trae esos datos. Revísalos y regístralos.</p>}
          <FormularioPagoCliente
            idPrefijo="oficina-pago"
            ticket={orden}
            cobro={cobroEsperadoDe(orden)}
            cuentasEmpresa={cuentasEmpresa}
            valoresIniciales={pagoAcordado}
            notaObligatoria
            notaEtiqueta="¿Por qué lo registras tú?"
            guardarTexto="Registrar el pago"
            confirmar={false}
            onGuardar={async (valor, nota) => {
              const r = await onRegistrar(valor, nota);
              if (r?.ok) onClose();
              return r;
            }}
            onPagaDespues={async (datos) => {
              const r = await onPagaDespues(datos);
              if (r?.ok) onClose();
              return r;
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
