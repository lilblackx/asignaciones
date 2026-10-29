import VentanaFinanzas from './VentanaFinanzas';
import { BOTON } from './estilos';
import { formatearCedula } from '../../utils/cedula';
import { estaExonerado, monedaDe, textoMonto } from '../../utils/cobro';
import { esInstalacion } from '../../utils/instalacion';
import { esCambioDeEquipo } from '../../utils/pagoCliente';
import { etiquetaTipoVisita } from '../../utils/tipoVisita';
import { fechaHoraLegible } from '../../utils/formatoFecha';
import { culminadaEn } from '../../utils/reporteMensual';
import { aBs, bolivares, dolares, grupoDePago } from '../../utils/finanzas';
import { TRABAJOS_VNTA, fechaLegible } from '../../utils/registroVnTa';
import InsigniaJM from '../InsigniaJM';
import CobroClienteDetalle from '../CobroClienteDetalle';

// El detalle de una orden que se le paga al técnico: quién es el cliente, qué trabajo fue, cómo se cobró y con qué precio se le paga. Solo lectura.
// Una fila del registro de VN y TA (item.registro) no es una orden: muestra el código, el trabajo, la fecha, quién la registró y la observación.
const ETIQUETA = 'text-xs font-semibold text-zinc-600 dark:text-zinc-300';
const VALOR = 'text-sm text-zinc-900 dark:text-zinc-50 mt-0.5 break-words';

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <p className={ETIQUETA}>{etiqueta}</p>
      <p className={VALOR}>{children || '-'}</p>
    </div>
  );
}

// Qué tipo de avería fue, porque el precio cambia según el tipo (ver el tabulador de precios).
const TIPO_DE_AVERIA = { MUDANZA_INTERNA: 'Mudanza interna', MUDANZA_EXTERNA: 'Mudanza externa', RECABLEADO: 'Recableado', LOW_SIGNAL: 'Low signal', CAMBIO_EQUIPO: 'Cambio de equipo' };

function textoCobro(orden) {
  if (estaExonerado(orden)) return 'Exonerado';
  if (orden.cobroBs) return textoMonto(orden.cobroBs, monedaDe(orden));
  return esInstalacion(orden.tipoTrabajo) ? 'Sin monto fijado por la oficina' : 'Sin cobro registrado';
}

// `item`: { orden, concepto, tecnico } de ordenesPagables; `tarifas`: el tabulador de precios.
export default function DetalleOrdenFinanzas({ item, tarifas, tasa = null, onClose, ajustes = [] }) {
  const { orden, concepto, registro } = item;
  // Una orden ya pagada muestra lo que se le pagó; una por pagar, el precio de hoy.
  const precio = item.pagada ? item.monto : tarifas[concepto] || 0;
  const terminada = culminadaEn(orden) || Number(orden.finalizadoEn) || 0;
  const trabajo = [orden.tipoTrabajo, orden.falla].filter(Boolean).join(' · ');

  // Garantías de otro técnico ligadas a esta orden: lo que se le descuenta (si es la original) o lo que se le paga (si es la garantía).
  const delDescuento = ajustes.filter((a) => a.tipo === 'DESCUENTO' && a.claveOrigen === item.clave);
  const dePago = ajustes.filter((a) => a.tipo === 'BONO' && a.clave === item.clave);
  const garantiaDe = orden.garantiaDe?.id ? orden.garantiaDe : null;

  const pie = <button type="button" onClick={onClose} className={BOTON}>Cerrar</button>;

  return (
    <VentanaFinanzas titulo={orden.codigo || 'S/C'} estado={{ texto: registro ? 'Registro' : item.pagada ? 'Pagada' : 'Por pagar', clase: item.pagada ? 'bg-emerald-700 text-white' : 'bg-amber-400 text-black' }} onClose={onClose} pie={pie} zIndexClass="z-[70]">
          <p className="text-lg font-bold text-zinc-900 dark:text-white break-words -mb-1">{orden.nombre || 'Sin nombre'} <InsigniaJM orden={orden} className="ml-1" /></p>
          {registro ? (
            <div className="grid grid-cols-2 gap-4">
              <Dato etiqueta="Trabajo realizado">{TRABAJOS_VNTA[registro.trabajo]?.nombre}</Dato>
              <Dato etiqueta="Técnico que apoyó">{registro.tecnico}</Dato>
              <Dato etiqueta="Fecha">{fechaLegible(registro.fecha)}</Dato>
              <Dato etiqueta="Registrado por">{registro.operador}</Dato>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-4">
            <Dato etiqueta="Cliente">{orden.nombre}</Dato>
            <Dato etiqueta="Cédula">{formatearCedula(orden.cedula, orden.tipoDocumento)}</Dato>
            <Dato etiqueta="Técnico">{orden.tecnico}</Dato>
            <Dato etiqueta="Terminada">{terminada ? fechaHoraLegible(terminada) : ''}</Dato>
            <Dato etiqueta="Trabajo">{trabajo}</Dato>
            <Dato etiqueta="Tipo de visita">{etiquetaTipoVisita(orden.tipoVisita)}</Dato>
            <Dato etiqueta="Cobro al cliente">{textoCobro(orden)}</Dato>
            <Dato etiqueta="Dirección">{orden.direccion}</Dato>
          </div>
          )}

          {!registro && (esInstalacion(orden.tipoTrabajo) || esCambioDeEquipo(orden)) && (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 space-y-1.5">
              <p className={ETIQUETA}>{esInstalacion(orden.tipoTrabajo) ? 'Cobro al cliente por la instalación' : 'Cobro al cliente por el cambio de equipo'}</p>
              <CobroClienteDetalle ticketId={orden.id ?? item.clave} paraFinanzas />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
            <div className="min-w-0">
              <p className={ETIQUETA}>{item.pagada ? 'Se le pagó al técnico como' : 'Se le paga al técnico como'}</p>
              <p className="text-base font-bold text-zinc-900 dark:text-white">{grupoDePago(concepto)}{TIPO_DE_AVERIA[concepto] ? ` · ${TIPO_DE_AVERIA[concepto]}` : ''}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-zinc-900 dark:text-white tabular-nums whitespace-nowrap leading-tight">{dolares(precio)}</p>
              {tasa > 0 && <p className="text-base font-bold text-zinc-700 dark:text-zinc-200 tabular-nums whitespace-nowrap">{bolivares(aBs(precio, tasa))}</p>}
            </div>
          </div>

          {garantiaDe && (
            <div className="rounded-md border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
              <p className="font-bold">Garantía de otro técnico</p>
              <p>De la orden {garantiaDe.codigo || 's/c'} ({garantiaDe.tecnico}).{dePago.length > 0 ? ` Se le paga ${dolares(dePago[0].monto)} al técnico de esta garantía, descontados de la orden original; esta orden no se paga como orden.` : ''}</p>
            </div>
          )}
          {delDescuento.map((a) => (
            <div key={a.id} className="rounded-md border border-sky-500 bg-sky-50 dark:bg-sky-950/30 px-3 py-2.5 text-sm text-sky-900 dark:text-sky-100">
              <p className="font-bold">Descuento por garantía: − {dolares(a.monto)}</p>
              <p>Por la garantía {a.codigo || 's/c'} hecha por {a.a}. A esta orden le quedan {dolares(Math.max(0, precio - a.monto))} de los {dolares(precio)}.{Number(a.aplicado) > 0 ? ` Ya se descontó ${dolares(a.aplicado)} en un pago.` : ''}</p>
            </div>
          ))}

          {orden.observacion && <Dato etiqueta="Observación">{orden.observacion}</Dato>}
    </VentanaFinanzas>
  );
}
