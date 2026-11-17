import Modal from '../Modal';
import FormularioPagoCliente from '../FormularioPagoCliente';
import { cobroEsperadoDe } from '../../utils/pagoCliente';
import Aviso from '../Aviso';
import BotonCerrar from '../BotonCerrar';

// Solo el ADMIN, desde Revisión: registra el pago del cliente de una orden a nombre del técnico, cuando el técnico no lo ha registrado y la orden está esperando para aprobarse. Pide escribir por qué lo registra
// la oficina y queda marcado en la orden, en el pago y en el historial ("registrado por la oficina a nombre del técnico"). Si el cliente todavía no pagó, también puede dejarlo como "paga después".
// `orden`: la orden con su técnico; `cuentasEmpresa`: las formas de pago de la empresa ya normalizadas; `onRegistrar(valor, nota)` y `onPagaDespues({ nota })` guardan y devuelven { ok }, { repetida } o { error }.
export default function RegistrarPagoOficinaModal({ orden, cuentasEmpresa = [], onRegistrar, onPagaDespues, onClose }) {
  // Si al crear la orden se acordó "Pagada", los datos del pago ya están anotados en la orden: el formulario se abre con ellos.
  const pagoAcordado = orden.cobroAcordado?.modo === 'PAGADA' && orden.cobroAcordado.pago ? orden.cobroAcordado.pago : null;
  return (
    <Modal onClose={onClose} zIndexClass="z-[90]">
      <div role="dialog" aria-labelledby="oficina-pago-titulo" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-card rounded-card shadow-2xl border border-border">
        <div className="encabezado-d bg-black px-4 py-3.5 border-b-2 border-red-600 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <h2 id="oficina-pago-titulo" className="text-base font-black text-white">Registrar el pago a nombre del técnico</h2>
            <p className="text-xs font-bold text-zinc-300 truncate">{orden.codigo || 'S/C'} · {orden.nombre}</p>
          </div>
          <BotonCerrar onClick={onClose} />
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {orden.tecnico ? `${orden.tecnico} todavía no registró el pago de esta orden. ` : ''}Anota el pago que el cliente hizo y escribe por qué lo registras tú. Queda en el historial con tu nombre y la hora, marcado como
            registrado por la oficina; el técnico ya no tendrá que registrarlo.
          </p>
          {pagoAcordado && <Aviso nivel="exito" compact>Al crear la orden se anotó que el cliente ya pagó: el formulario trae esos datos. Revísalos y regístralos.</Aviso>}
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
