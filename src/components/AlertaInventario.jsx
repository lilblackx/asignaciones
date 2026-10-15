import { useEffect, useState } from 'react';
import { PackageCheck, PackageX, RefreshCw, X } from 'lucide-react';
import Modal from './Modal';
import { TEXTO_ESTADO_ENVIO } from '../utils/envioInventario';

const ETIQUETA_ESTADO = {
  SERIAL_NO_ENCONTRADO: 'Serial no existe',
  SERIAL_YA_INSTALADO: 'Ya instalado',
  EQUIPO_NO_ASIGNADO: 'No está con técnico',
  SIN_SERIAL: 'Sin serial',
  ERROR: 'Error al enviar',
  ENVIADO: 'Enviado',
  PENDIENTE: 'Pendiente',
  DESCARTADO: 'Descartada',
};
const ESTILO_ESTADO = {
  ENVIADO: 'bg-emerald-600 text-white',
  PENDIENTE: 'bg-amber-500 text-black',
  DESCARTADO: 'bg-zinc-400 dark:bg-zinc-600 text-white',
};
const ESTILO_ALERTA = 'bg-red-600 text-white';
const ETIQUETA_ACCION = { instalacion_nueva: 'Instalación', cambio_equipo: 'Cambio de equipo', averia: 'Material de avería' };
const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—');

// Aviso en la pantalla principal, solo para los usuarios del módulo: hay órdenes aprobadas que no se pudieron descontar del
// inventario del almacén.
export function AvisoInventario({ cantidad, onAbrir }) {
  if (cantidad <= 0) return null;
  return (
    <div role="alert" className="mb-3 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3 flex items-center gap-3 text-xs text-red-900 dark:text-red-200">
      <PackageX className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
      <p className="flex-1 font-bold leading-snug">
        {cantidad === 1 ? '1 orden aprobada no se envió' : `${cantidad} órdenes aprobadas no se enviaron`} al inventario del almacén.
      </p>
      <button type="button" onClick={onAbrir} className="shrink-0 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black">Ver</button>
    </div>
  );
}

function Chip({ estado }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${ESTILO_ESTADO[estado] || ESTILO_ALERTA}`}>{ETIQUETA_ESTADO[estado] || estado}</span>;
}

function Detalle({ envio }) {
  return (
    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
      {ETIQUETA_ACCION[envio.accion] || 'Orden'}{envio.tecnico ? ` · ${envio.tecnico}` : ''} · {fechaHora(envio.actualizadoEn)}
    </p>
  );
}

function Serial({ serial }) {
  if (!serial) return null;
  return (
    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
      Serial: <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100 break-all">{serial}</span>
    </p>
  );
}

function TarjetaAlerta({ envio, onReintentar, onDescartar }) {
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const motivo = envio.mensaje || TEXTO_ESTADO_ENVIO[envio.estado] || '';

  const reintentar = async () => {
    setOcupado(true);
    await onReintentar(envio);
    setOcupado(false);
  };
  const descartar = async () => {
    setOcupado(true);
    const ok = await onDescartar(envio);
    if (!ok) { setOcupado(false); setConfirmando(false); }
  };

  return (
    <li className="bg-white dark:bg-zinc-900 border-2 border-red-200 dark:border-red-900/50 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-zinc-900 dark:text-white break-words">{envio.codigo || 'S/C'}{envio.cliente ? ` — ${envio.cliente}` : ''}</p>
          <Detalle envio={envio} />
        </div>
        <Chip estado={envio.estado} />
      </div>
      <Serial serial={envio.serial} />
      {motivo && <p className="text-xs text-red-700 dark:text-red-300 leading-snug">{motivo}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={reintentar} disabled={ocupado} className="flex-1 min-w-[8rem] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-black hover:opacity-90 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${ocupado ? 'animate-spin' : ''}`} aria-hidden="true" /> {ocupado ? 'Enviando...' : 'Reintentar'}
        </button>
        {confirmando ? (
          <div className="flex-1 min-w-[8rem] flex gap-2">
            <button type="button" onClick={descartar} disabled={ocupado} className="flex-1 px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-black disabled:opacity-50">Sí, descartar</button>
            <button type="button" onClick={() => setConfirmando(false)} disabled={ocupado} className="px-3 py-2.5 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200">No</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} disabled={ocupado} className="flex-1 min-w-[8rem] px-3 py-2.5 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-red-600 disabled:opacity-50">
            Descartar
          </button>
        )}
      </div>
    </li>
  );
}

function FilaReciente({ envio }) {
  return (
    <li className="flex items-start justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{envio.codigo || 'S/C'}{envio.cliente ? ` — ${envio.cliente}` : ''}</p>
        <Detalle envio={envio} />
        <Serial serial={envio.serial} />
      </div>
      <Chip estado={envio.estado} />
    </li>
  );
}

// Módulo "Envíos al inventario" (solo para los usuarios de utils/accesoInventario): arriba, las órdenes aprobadas que no se
// pudieron descontar del inventario del almacén, con "Reintentar" (por ejemplo, después de que el almacén ingresó el serial)
// y "Descartar" (se da por resuelta sin enviar; queda guardada); abajo, la actividad reciente de los envíos.
export default function EnviosInventarioModal({ envios, recientes, cargando, onCargar, onActualizar, onReintentar, onDescartar, onClose }) {
  useEffect(() => { onCargar(); }, [onCargar]);

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-base font-black text-white flex items-center gap-2"><PackageCheck className="w-5 h-5 text-red-500" aria-hidden="true" /> ENVÍOS AL INVENTARIO</h2>
          <button onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
            Cada orden aprobada que instala un equipo o usa material se descuenta del inventario del almacén. Aquí ves lo que no se pudo enviar y lo que se envió.
          </p>

          <section aria-labelledby="envios-por-revisar" className="space-y-2">
            <h3 id="envios-por-revisar" className="text-[10px] font-bold tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">Por revisar ({envios.length})</h3>
            {envios.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">No hay órdenes pendientes de revisar.</p>
            ) : (
              <ul className="space-y-2.5">
                {envios.map((e) => <TarjetaAlerta key={e.id} envio={e} onReintentar={onReintentar} onDescartar={onDescartar} />)}
              </ul>
            )}
          </section>

          <section aria-labelledby="envios-recientes" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="envios-recientes" className="text-[10px] font-bold tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">Actividad reciente</h3>
              <button type="button" onClick={onActualizar} disabled={cargando} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-red-600 disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" /> Actualizar
              </button>
            </div>
            {recientes.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">Todavía no hay envíos registrados.</p>
            ) : (
              <ul className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
                {recientes.map((e) => <FilaReciente key={e.id} envio={e} />)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
