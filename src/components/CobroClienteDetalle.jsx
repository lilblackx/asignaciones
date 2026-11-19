import { useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { getDoc } from '../lib/medidorFirestore.js';
import { db, appId } from '../lib/firebase';
import { leerCobro } from '../lib/cobrosClientes';
import { ETIQUETA_ESTADO_COBRO, textoDeCobro } from '../utils/cobrosClientes';
import { CLASE_PAGO_FINANZAS, ETIQUETA_PAGO_FINANZAS, etiquetaEstadoPago, textoPago } from '../utils/pagoCliente';
import Cargando from './Cargando';

const CLASE_COBRO = { PENDIENTE: 'bg-amber-400 text-black', CARGADO: 'bg-emerald-700 text-white' };
const CLASE_PAGO = { PENDIENTE_COBRO: 'bg-amber-400 text-black', POR_CONCILIAR: 'bg-sky-700 text-white', CONCILIADO: 'bg-emerald-700 text-white', SIN_COBRAR: 'bg-red-600 text-white' };
const CHIP = 'inline-block whitespace-nowrap text-etiqueta leading-tight font-black px-2 py-0.5 rounded';
const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');

// El cobro de una orden al cliente, en solo lectura (la oficina y Finanzas; se trabaja en el módulo de Administración): si ya se emitió, su estado (pendiente o cargado en el portal) y su monto; si no, el pago que
// registró el técnico en el flujo anterior (historial), si lo hay. Lo lee una vez al abrir. `paraFinanzas`: un pago del historial se ve solo como "Registrado".
export default function CobroClienteDetalle({ ticketId, paraFinanzas = false }) {
  const [estado, setEstado] = useState({ cargando: true, cobro: null, pago: null, error: false });
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const cobro = await leerCobro(ticketId);
        const pago = cobro ? null : (await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pagosOrdenes', String(ticketId)))).data() ?? null;
        if (vigente) setEstado({ cargando: false, cobro, pago, error: false });
      } catch (e) {
        // Sin permiso para leer el pago del historial (Finanzas solo lee instalaciones y cambios de equipo): se trata como que no hay.
        if (vigente) setEstado({ cargando: false, cobro: null, pago: null, error: e?.code !== 'permission-denied' });
      }
    })();
    return () => { vigente = false; };
  }, [ticketId]);

  const { cargando, cobro, pago, error } = estado;
  if (cargando) return <Cargando variante="linea" texto="Cargando el cobro..." />;
  if (error) return <p className="text-xs text-red-700 dark:text-red-400">No se pudo leer el cobro.</p>;
  if (cobro && !cobro.anulado) {
    return (
      <div className="space-y-1.5">
        <span className={`${CHIP} ${CLASE_COBRO[cobro.estado] || ''}`}>{ETIQUETA_ESTADO_COBRO[cobro.estado] || cobro.estado}</span>
        <p className="text-sm font-bold text-foreground break-words">{textoDeCobro(cobro)}</p>
        {cobro.estado === 'CARGADO' && <p className="text-xs text-muted-foreground">Cargado en el portal por {cobro.cargadoPor} · {fechaHora(cobro.cargadoEn)}</p>}
        {cobro.estado === 'PENDIENTE' && <p className="text-xs text-muted-foreground">Emitido el {fechaHora(cobro.creadoEn)}: Administración todavía no lo sube al portal.</p>}
        {cobro.montoCambio && <p className="text-xs font-bold text-amber-800 dark:text-amber-300">El monto de la orden cambió: Administración debe corregirlo en el portal.</p>}
      </div>
    );
  }
  if (!pago) return <p className="text-xs text-muted-foreground">{cobro?.anulado ? 'El cobro se retiró: la orden se canceló o dejó de tener cobro.' : 'Esta orden no tiene un cobro emitido.'}</p>;
  return (
    <div className="space-y-1.5">
      <span className={`${CHIP} ${paraFinanzas ? CLASE_PAGO_FINANZAS : CLASE_PAGO[pago.estado] || ''}`}>{paraFinanzas ? ETIQUETA_PAGO_FINANZAS : etiquetaEstadoPago(pago.estado)}</span>
      <p className="text-sm font-bold text-foreground break-words">
        {pago.pago ? textoPago(pago.pago) : pago.compartidoCon ? `Pagó junto con la orden ${pago.compartidoCon.codigo}` : 'El cliente iba a pagar después'}
      </p>
      {pago.pago?.titular && <p className="text-xs text-card-foreground break-words">Titular de la cuenta: {pago.pago.titular}</p>}
      {pago.pago?.cuentaEmpresa && <p className="text-xs text-card-foreground">Cuenta de la empresa: {pago.pago.cuentaEmpresa}</p>}
      {pago.pago?.pagadoEn && <p className="text-xs text-card-foreground">Pagado el {fechaHora(pago.pago.pagadoEn)}</p>}
      {pago.nota && <p className="text-xs text-card-foreground break-words">Nota del técnico: {pago.nota}</p>}
    </div>
  );
}
