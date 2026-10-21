import { X } from 'lucide-react';
import Modal from '../Modal';
import { formatearCedula } from '../../utils/cedula';
import { estaExonerado, monedaDe, textoMonto } from '../../utils/cobro';
import { esInstalacion } from '../../utils/instalacion';
import { etiquetaTipoVisita } from '../../utils/tipoVisita';
import { fechaHoraLegible } from '../../utils/formatoFecha';
import { culminadaEn } from '../../utils/reporteMensual';
import { aBs, bolivares, dolares, grupoDePago } from '../../utils/finanzas';
import { TRABAJOS_VNTA, fechaLegible } from '../../utils/registroVnTa';

// El detalle de una orden que se le paga al técnico: quién es el cliente, qué trabajo fue, cómo se cobró y con qué precio se le paga. Solo lectura.
// Una fila del registro de VN y TA (item.registro) no es una orden: muestra el código, el trabajo, la fecha, quién la registró y la observación.
const ETIQUETA = 'text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
const VALOR = 'text-sm text-zinc-900 dark:text-zinc-100 mt-0.5 break-words';

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <p className={ETIQUETA}>{etiqueta}</p>
      <p className={VALOR}>{children || '—'}</p>
    </div>
  );
}

// Qué tipo de avería fue, porque el precio cambia según el tipo (ver el tabulador de precios).
const TIPO_DE_AVERIA = { MUDANZA_INTERNA: 'Mudanza interna', MUDANZA_EXTERNA: 'Mudanza externa', RECABLEADO: 'Recableado', LOW_SIGNAL: 'Low signal', CAMBIO_EQUIPO: 'Cambio de equipo' };

function textoCobro(orden) {
  if (estaExonerado(orden)) return 'Exonerado';
  if (orden.cobroBs) return textoMonto(orden.cobroBs, monedaDe(orden));
  return esInstalacion(orden.tipoTrabajo) ? 'Las instalaciones no llevan cobro' : 'Sin cobro registrado';
}

// `item`: { orden, concepto, tecnico } de ordenesPagables; `tarifas`: el tabulador de precios.
export default function DetalleOrdenFinanzas({ item, tarifas, tasa = null, onClose }) {
  const { orden, concepto, registro } = item;
  // Una orden ya pagada muestra lo que se le pagó; una por pagar, el precio de hoy.
  const precio = item.pagada ? item.monto : tarifas[concepto] || 0;
  const terminada = culminadaEn(orden) || Number(orden.finalizadoEn) || 0;
  const trabajo = [orden.tipoTrabajo, orden.falla].filter(Boolean).join(' · ');

  return (
    <Modal onClose={onClose} zIndexClass="z-[70]">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex justify-between items-center sticky top-0 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wide">{registro ? 'DETALLE DEL REGISTRO' : 'DETALLE DE LA ORDEN'}</span>
              <span className="text-xs font-bold text-red-400">{orden.codigo || 'S/C'}</span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate">{orden.nombre || 'Sin nombre'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
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

          <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
            <div className="min-w-0">
              <p className={ETIQUETA}>{item.pagada ? 'Se le pagó al técnico como' : 'Se le paga al técnico como'}</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">{grupoDePago(concepto)}{TIPO_DE_AVERIA[concepto] ? ` · ${TIPO_DE_AVERIA[concepto]}` : ''}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-black text-zinc-900 dark:text-white tabular-nums whitespace-nowrap leading-tight">{dolares(precio)}</p>
              {tasa > 0 && <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">{bolivares(aBs(precio, tasa))}</p>}
            </div>
          </div>

          {orden.observacion && <Dato etiqueta="Observación">{orden.observacion}</Dato>}
        </div>
      </div>
    </Modal>
  );
}
