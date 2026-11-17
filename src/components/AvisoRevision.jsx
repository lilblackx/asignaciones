import { Eye } from 'lucide-react';
import Aviso from './Aviso';

const unir = (nombres) => (nombres.length <= 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`);

// "Ana está revisando esta orden": otra persona de la oficina la tiene abierta ahora. Es solo un aviso; no impide nada (si las dos la finalizan,
// solo se guarda la primera). `nombres`: las otras personas; vacío = no se muestra. En `compact` es una etiqueta chica para las listas.
export default function AvisoRevision({ nombres = [], compact = false, encabezado = false, className = '' }) {
  if (nombres.length === 0) return null;
  // En el encabezado fijo de una ventana (`encabezado`): solo una línea de texto discreta, para que se vea siempre sin llenar la barra.
  if (encabezado) {
    return (
      <p role="status" className={`mt-1 flex items-start gap-1 text-[11px] max-lg:text-xs leading-snug text-violet-300 ${className}`}>
        <Eye className="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
        <span><span className="font-bold">{unir(nombres)}</span> {nombres.length === 1 ? 'también tiene' : 'también tienen'} abierta esta orden.<span className="hidden sm:inline"> Si las dos personas la finalizan, solo se guarda la primera.</span></span>
      </p>
    );
  }
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 self-start rounded px-1.5 py-0.5 text-[11px] max-lg:text-xs font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 ${className}`} title={`${unir(nombres)} ${nombres.length === 1 ? 'tiene' : 'tienen'} abierta esta orden`}>
        <Eye className="w-3 h-3 shrink-0" aria-hidden="true" /> {unir(nombres)} revisando
      </span>
    );
  }
  return (
    <Aviso nivel="info" icono={Eye} titulo={`${unir(nombres)} ${nombres.length === 1 ? 'también tiene' : 'también tienen'} abierta esta orden.`} className={className}>
      Si las dos personas la finalizan, solo se guarda la primera.
    </Aviso>
  );
}
