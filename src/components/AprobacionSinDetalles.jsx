import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { leerRevisionDeOrden } from '../lib/revisionDeOrden';
import { claveOrden } from '../utils/finanzas';
import { tieneDetalles } from '../utils/detallesOrden';

const fechaHora = (ms) => (ms ? new Date(Number(ms)).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '');

// Aviso del Detalle de la orden cuando la oficina la aprobó en Revisión sin los detalles (fotos) que debía subir el técnico: quién, cuándo y el motivo que escribió. Lee la revisión de la orden una vez al abrir
// (solo ADMIN: es quien lee esa colección); si no la puede leer o la orden no se aprobó así, no muestra nada.
export default function AprobacionSinDetalles({ orden, className = '' }) {
  const [revision, setRevision] = useState(null);
  // Se lee por la clave de la orden (no por el objeto, que cambia con cada actualización de la lista): una lectura por orden abierta.
  const clave = claveOrden(orden);
  useEffect(() => {
    let vigente = true;
    leerRevisionDeOrden(clave).then((r) => { if (vigente) setRevision(r); }).catch(() => { if (vigente) setRevision(null); });
    return () => { vigente = false; };
  }, [clave]);

  // Si el técnico subió las fotos después de la aprobación, el aviso ya no aplica y se quita para no confundir.
  if (revision?.estado !== 'APROBADA' || !revision.sinDetalles || tieneDetalles(orden)) return null;
  return (
    <div role="status" className={`rounded-campo border flex items-start gap-2 p-2.5 text-xs bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/50 text-amber-900 dark:text-amber-100 ${className}`}>
      <Camera className="w-4 h-4 shrink-0 mt-px text-amber-700 dark:text-amber-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-black leading-tight">Aprobada sin los detalles de la orden (fotos){revision.por ? ` por ${revision.por}` : ''}{revision.en ? ` · ${fechaHora(revision.en)}` : ''}</p>
        <p className="leading-snug break-words whitespace-pre-wrap mt-0.5">Motivo: {revision.sinDetalles}</p>
      </div>
    </div>
  );
}
