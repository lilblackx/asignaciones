import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import Modal from '../Modal';
import Boton from '../Boton';
import Spinner from '../Spinner';
import DatosTecnicoEdicion from './DatosTecnicoEdicion';
import { leerOrdenParaCorregir, guardarOrdenCorregida } from '../../lib/ordenesCerradas';
import { esInstalacion } from '../../utils/instalacion';
import { corregirDatosParaEnvio } from '../../utils/correccionEnvio';
import { formularioDatosTecnico, tieneDatosDelTecnico } from '../../utils/edicionDatosTecnico';

// Corrige lo que viaja al almacén de una orden (serial, metraje, conectores...) desde "Envíos al inventario", aunque la orden ya esté cerrada
// (entonces vive dentro de su reporte de cierre). Solo esos datos: el cobro, el técnico y el estado no se tocan. Después se reenvía.
//   envio: el envío (trae el id de la orden y cuándo se finalizó). `onReenviar(envio)`: lo vuelve a enviar con la orden corregida; devuelve true si salió.
export default function CorregirEnvioModal({ envio, usuario, onReenviar, onClose }) {
  const [lectura, setLectura] = useState(null); // null: leyendo; false: no se encontró
  const [formulario, setFormulario] = useState(null);
  const [errores, setErrores] = useState({});
  const [trabajando, setTrabajando] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vigente = true;
    leerOrdenParaCorregir(envio.id, envio.finalizadoEn).then((r) => {
      if (!vigente) return;
      setLectura(r || false);
      if (r) setFormulario(formularioDatosTecnico(r.ticket));
    }).catch((error) => {
      console.error('No se pudo leer la orden para corregirla:', error);
      if (vigente) setLectura(false);
    });
    return () => { vigente = false; };
  }, [envio.id, envio.finalizadoEn]);

  const cambiar = (parcial) => { setFormulario((f) => ({ ...f, ...parcial })); setErrores({}); setAviso(''); };

  const guardar = async (reenviar) => {
    const r = corregirDatosParaEnvio(lectura.ticket, formulario, { por: usuario });
    if (r.error) { setErrores(r.errores); document.getElementById(r.primerCampo)?.focus(); return; }
    if (r.sinCambios && !reenviar) { setAviso('No cambiaste nada.'); return; }
    setTrabajando(reenviar ? 'reenviar' : 'guardar');
    setAviso('');
    try {
      if (!r.sinCambios) {
        const g = await guardarOrdenCorregida(lectura, r.ticket);
        if (g?.error) { setAviso(g.error); return; }
        setLectura({ ...lectura, ticket: r.ticket });
      }
      if (reenviar) {
        const salio = await onReenviar(envio);
        if (!salio) { setAviso(r.sinCambios ? '' : 'La orden quedó corregida, pero el reenvío no salió. Revisa el aviso y reintenta desde la lista.'); return; }
      }
      onClose();
    } catch (error) {
      console.error('No se pudo corregir la orden:', error);
      setAviso('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setTrabajando('');
    }
  };

  const ticket = lectura?.ticket;
  const puedeEditar = Boolean(ticket) && tieneDatosDelTecnico(ticket);

  return (
    <Modal onClose={onClose} zIndexClass="z-[80]">
      <div role="dialog" aria-labelledby="corregir-envio-titulo" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-red-600 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <h2 id="corregir-envio-titulo" className="text-base font-black text-white">Corregir {envio.codigo || 'S/C'}</h2>
            <p className="text-xs font-bold text-zinc-300 truncate">{envio.cliente}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="shrink-0 inline-flex items-center justify-center bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {lectura === null && <p className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2"><Spinner /> Buscando la orden...</p>}
          {lectura === false && <p role="alert" className="text-sm font-bold text-red-600 dark:text-red-400">No se encontró la orden, ni en la lista ni en un reporte de cierre. No se puede corregir desde aquí.</p>}
          {ticket && !puedeEditar && <p role="alert" className="text-sm font-bold text-red-600 dark:text-red-400">Esta orden no está pre-finalizada ni finalizada: no tiene datos del técnico que corregir.</p>}
          {puedeEditar && (
            <>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {lectura.origen === 'archivada' ? `La orden ya está cerrada${lectura.fechaCierre ? ` (cierre del ${lectura.fechaCierre})` : ''}: se corrige dentro de su reporte.` : 'La orden sigue en la lista de órdenes.'}
                {' '}Solo se cambian estos datos; el cobro, el técnico y el estado quedan como están. El cambio queda en el historial de la orden.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <DatosTecnicoEdicion instalacion={esInstalacion(ticket.tipoTrabajo)} form={formulario} onChange={cambiar} errores={errores} finalizada={false} avisoSerial />
              </div>
              {aviso && <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-bold">{aviso}</p>}
              <div className="space-y-2">
                <Boton variante="principal" tamano="grande" icono={RefreshCw} className="w-full" onClick={() => guardar(true)} disabled={Boolean(trabajando)}>{trabajando === 'reenviar' ? <Spinner /> : null} Guardar y reenviar al inventario</Boton>
                <Boton variante="secundario" tamano="grande" className="w-full" onClick={() => guardar(false)} disabled={Boolean(trabajando)}>{trabajando === 'guardar' ? <Spinner /> : null} Solo guardar</Boton>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
