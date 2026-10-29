import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { ESTADO_PAGO, ETIQUETA_ESTADO_PAGO, textoPago } from '../utils/pagoCliente';

const CLASE_ESTADO = {
  PENDIENTE_COBRO: 'bg-amber-400 text-black',
  POR_CONCILIAR: 'bg-sky-700 text-white',
  CONCILIADO: 'bg-emerald-700 text-white',
  SIN_COBRAR: 'bg-red-600 text-white',
};
const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');

// El pago que el cliente hizo por una orden, en solo lectura (para la oficina y Finanzas: se trabaja en el módulo de Administración). Lo lee una vez al abrir.
// `mensajeSinAcceso`: lo que se dice si las reglas no dejan leerlo (Finanzas solo lee el de una instalación ya conciliada).
export default function PagoClienteDetalle({ ticketId, mensajeSinAcceso = '' }) {
  const [estado, setEstado] = useState({ cargando: true, pago: null, error: false, sinAcceso: false });
  useEffect(() => {
    let vigente = true;
    getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pagosOrdenes', String(ticketId)))
      .then((snap) => { if (vigente) setEstado({ cargando: false, pago: snap.exists() ? snap.data() : null, error: false, sinAcceso: false }); })
      .catch((e) => { if (vigente) setEstado({ cargando: false, pago: null, error: e?.code !== 'permission-denied', sinAcceso: e?.code === 'permission-denied' }); });
    return () => { vigente = false; };
  }, [ticketId]);

  const { cargando, pago, error, sinAcceso } = estado;
  if (cargando) return <p className="text-xs text-zinc-600 dark:text-zinc-400">Cargando el pago...</p>;
  if (sinAcceso) return <p className="text-xs text-zinc-600 dark:text-zinc-400">{mensajeSinAcceso || 'No tienes acceso al pago de esta orden.'}</p>;
  if (error) return <p className="text-xs text-red-600 dark:text-red-400">No se pudo leer el pago.</p>;
  if (!pago) return <p className="text-xs text-zinc-600 dark:text-zinc-400">Todavía no hay un pago registrado para esta orden.</p>;
  return (
    <div className="space-y-1.5">
      <span className={`inline-block whitespace-nowrap text-[11px] max-lg:text-xs leading-tight font-black px-2 py-0.5 rounded ${CLASE_ESTADO[pago.estado] || ''}`}>{ETIQUETA_ESTADO_PAGO[pago.estado] || pago.estado}</span>
      <p className="text-sm font-bold text-zinc-900 dark:text-white break-words">
        {pago.pago ? textoPago(pago.pago) : pago.compartidoCon ? `Pagó junto con la orden ${pago.compartidoCon.codigo}` : 'El cliente paga después'}
      </p>
      {pago.pago?.titular && <p className="text-xs text-zinc-700 dark:text-zinc-300 break-words">Titular de la cuenta: {pago.pago.titular}</p>}
      {pago.pago?.cuentaEmpresa && <p className="text-xs text-zinc-700 dark:text-zinc-300">Cuenta de la empresa: {pago.pago.cuentaEmpresa}</p>}
      {pago.pago?.pagadoEn && <p className="text-xs text-zinc-700 dark:text-zinc-300">Pagado el {fechaHora(pago.pago.pagadoEn)}</p>}
      {pago.nota && <p className="text-xs text-zinc-700 dark:text-zinc-300 break-words">Nota del técnico: {pago.nota}</p>}
      {pago.notaAdministracion && <p className="text-xs text-zinc-700 dark:text-zinc-300 break-words">Nota de Administración: {pago.notaAdministracion}</p>}
      {pago.estado === ESTADO_PAGO.CONCILIADO && pago.conciliadoPor && <p className="text-xs text-zinc-600 dark:text-zinc-400">Conciliado por {pago.conciliadoPor} · {fechaHora(pago.conciliadoEn)}</p>}
    </div>
  );
}
