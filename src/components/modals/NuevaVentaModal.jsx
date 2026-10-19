import { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, Star, X } from 'lucide-react';
import { TIPOS_POR_TRABAJO } from '../../constants';
import { TIPO_VENTA, camposDePlantillaVenta, instaladorDePlantilla, tecnicoRegistradoDePlantilla } from '../../utils/ventaPromotora';
import { leerTecnicos } from '../../hooks/useCrearVenta';
import { normalizarUbicacion } from '../../utils/ubicacion';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';
import TelefonosField from './TelefonosField';
import PromotorField from './PromotorField';
import { CedulaField } from './TicketFormFields';
import Spinner from '../Spinner';

const ETIQUETA = 'text-[10px] font-bold text-zinc-500 dark:text-zinc-400 ml-1';
const CAMPO = 'w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-2 rounded text-sm';
const TIPOS_ITEMS = [{ value: '', label: 'Seleccione...' }, ...(TIPOS_POR_TRABAJO[TIPO_VENTA] || []).map((t) => ({ value: t, label: t }))];
// "GERARDO MOLERO" -> "Gerardo Molero" (los técnicos se guardan en mayúsculas).
const nombreBonito = (nombre) => nombre.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
const ACTIVAS = new Set(['PENDIENTE', 'PRE-FINALIZADO']);

const FORM_VACIO = (promotora) => ({ plantillaOriginal: '', cedula: '', tipoDocumento: 'V', nombre: '', telefono: '', direccion: '', falla: '', promotora, ubicacion: '', nap: '' });

// Nueva venta de una PROMOTORA con permiso de crear ventas: solo instalaciones. La plantilla pegada rellena el resto; la oficina
// asigna el técnico después. Con "ve todas" (ventas) el promotor se escribe; si no, se elige entre los nombres de su usuario.
export default function NuevaVentaModal({ perfil, tickets, onCrear, onClose }) {
  const { verTodas, promotoraNombres } = perfil;
  const [form, setForm] = useState(() => FORM_VACIO(verTodas ? '' : promotoraNombres[0] || ''));
  const [guardando, setGuardando] = useState(false);
  const [intento, setIntento] = useState(false);
  // null = leyendo, 'error' = no se pudieron leer
  const [tecnicos, setTecnicos] = useState(null);
  useEffect(() => {
    let activo = true;
    leerTecnicos().then((lista) => { if (activo) setTecnicos(lista); }).catch((err) => { console.error('No se pudieron leer los técnicos:', err); if (activo) setTecnicos('error'); });
    return () => { activo = false; };
  }, []);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const poner = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  // El promotor de la plantilla solo se toma en ventas; una promotora con sus nombres no puede cambiarlo.
  const alPegar = (e) => {
    const texto = e.target.value;
    const campos = camposDePlantillaVenta(texto);
    if (!verTodas) delete campos.promotora;
    setForm((f) => ({ ...f, ...campos, plantillaOriginal: texto }));
  };

  // El técnico no se elige: sale solo del "Instalador:" de la plantilla, si es un técnico registrado.
  const instalador = instaladorDePlantilla(form.plantillaOriginal);
  const registrado = Array.isArray(tecnicos) ? tecnicoRegistradoDePlantilla(form.plantillaOriginal, tecnicos) : null;
  const tecnico = registrado?.name || '';
  const esperandoTecnicos = Boolean(instalador) && !Array.isArray(tecnicos);

  const ubicacion = normalizarUbicacion(form.ubicacion);
  const duplicada = form.cedula && tickets.find((t) => t.cedula === form.cedula && ACTIVAS.has(t.estado));
  const faltaTipo = intento && !form.falla;

  const enviar = async (e) => {
    e.preventDefault();
    setIntento(true);
    if (!form.falla) { document.getElementById('nv-falla')?.focus(); return; }
    if (ubicacion.error) { document.getElementById('nv-ubicacion')?.focus(); return; }
    setGuardando(true);
    const creada = await onCrear({ ...form, tecnico, tecnicoId: registrado?.id || '' });
    setGuardando(false);
    if (creada) onClose();
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3 border-b-2 border-red-600 flex justify-between items-center">
          <h2 className="text-sm font-black text-white">NUEVA VENTA</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="bg-zinc-800 p-2 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={enviar} className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-0.5">
            <label htmlFor="nv-plantilla" className={ETIQUETA}>PLANTILLA <span className="font-normal normal-case text-zinc-400">(pégala completa y se llenan los datos)</span></label>
            <textarea id="nv-plantilla" rows="4" value={form.plantillaOriginal} onChange={alPegar} className={`${CAMPO} font-mono text-xs`} placeholder="Pega aquí la plantilla tal como la enviaste..." />
          </div>

          <CedulaField variant="create" wrapperClassName="col-span-2 space-y-0.5" idPrefix="nv" tipoDocumento={form.tipoDocumento} cedula={form.cedula} onChange={cambiar} />
          {duplicada && (
            <div role="status" className="col-span-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded px-2.5 py-2 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Ya hay una orden <strong>{duplicada.estado}</strong> con esta cédula: <strong>{duplicada.codigo || 'S/C'}</strong> — {duplicada.nombre}. Puedes seguir si es otra venta.</span>
            </div>
          )}

          <div className="col-span-2 space-y-0.5">
            <label htmlFor="nv-nombre" className={ETIQUETA}>NOMBRE<span className="text-red-600"> *</span></label>
            <input id="nv-nombre" required type="text" maxLength="100" name="nombre" value={form.nombre} onChange={cambiar} className={CAMPO} />
          </div>

          <div className="col-span-2 space-y-0.5">
            <label htmlFor="nv-telefono" className={ETIQUETA}>TELÉFONO<span className="text-red-600"> *</span></label>
            <TelefonosField id="nv-telefono" required value={form.telefono} onChange={(v) => poner('telefono', v)} inputClassName={CAMPO} />
          </div>

          <div className="col-span-2 space-y-0.5">
            <label htmlFor="nv-instalador" className={ETIQUETA}>INSTALADOR <span className="font-normal normal-case text-zinc-400">(de la plantilla; define el técnico)</span></label>
            <input id="nv-instalador" readOnly type="text" value={instalador} placeholder="Sin instalador" className={`${CAMPO} bg-zinc-100 dark:bg-zinc-900/60 text-zinc-700 dark:text-zinc-300 cursor-default`} />
            {tecnico ? (
              <p role="status" className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 ml-1">
                <Star className="w-3 h-3 shrink-0 fill-current" aria-hidden="true" /> Venta de: {nombreBonito(tecnico)}
              </p>
            ) : instalador && (
              <p role="status" className="text-[11px] text-zinc-500 dark:text-zinc-400 ml-1">
                {tecnicos === 'error' ? 'No se pudieron leer los técnicos. Cierra y vuelve a abrir esta ventana.'
                  : esperandoTecnicos ? 'Buscando al instalador entre los técnicos...'
                    : 'No coincide con un técnico registrado: la oficina asignará el técnico.'}
              </p>
            )}
          </div>

          <div className="col-span-2 space-y-0.5">
            <label htmlFor="nv-falla" className={ETIQUETA}>TIPO<span className="text-red-600"> *</span></label>
            <SelectMenu
              id="nv-falla"
              ariaLabel="Tipo de instalación"
              value={form.falla}
              onChange={(v) => poner('falla', v)}
              items={TIPOS_ITEMS}
              className={`w-full bg-white dark:bg-zinc-950 border ${faltaTipo ? 'border-red-600' : 'border-zinc-200 dark:border-zinc-700'} pl-2 pr-7 py-2 rounded text-sm`}
              chevronClassName="w-3.5 h-3.5 right-2"
            />
            {faltaTipo && <p role="alert" className="text-[10px] font-bold text-red-600 ml-1">Seleccione un tipo.</p>}
          </div>

          {verTodas ? (
            <PromotorField id="nv-promotora" value={form.promotora} onChange={cambiar} wrapperClassName="col-span-2 space-y-0.5" labelClassName={ETIQUETA} inputClassName={CAMPO} ayuda="(quién la vendió)" />
          ) : (
            <div className="col-span-2 space-y-0.5">
              <label htmlFor="nv-promotora" className={ETIQUETA}>PROMOTOR</label>
              {promotoraNombres.length > 1 ? (
                <SelectMenu
                  id="nv-promotora"
                  ariaLabel="Promotor"
                  value={form.promotora}
                  onChange={(v) => poner('promotora', v)}
                  items={promotoraNombres.map((n) => ({ value: n, label: n }))}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 pl-2 pr-7 py-2 rounded text-sm"
                  chevronClassName="w-3.5 h-3.5 right-2"
                />
              ) : (
                <input id="nv-promotora" readOnly type="text" value={form.promotora} className={`${CAMPO} bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 cursor-default`} />
              )}
            </div>
          )}

          <div className="col-span-2 space-y-0.5">
            <label htmlFor="nv-direccion" className={ETIQUETA}>DIRECCIÓN<span className="text-red-600"> *</span></label>
            <input id="nv-direccion" required type="text" maxLength="200" name="direccion" value={form.direccion} onChange={cambiar} className={CAMPO} />
          </div>

          <div className="col-span-2 space-y-0.5">
            <label htmlFor="nv-ubicacion" className={ETIQUETA}>UBICACIÓN <span className="font-normal normal-case text-zinc-400">(enlace de Google Maps, opcional)</span></label>
            <input id="nv-ubicacion" type="text" inputMode="url" maxLength="300" name="ubicacion" placeholder="https://maps.app.goo.gl/..." value={form.ubicacion} onChange={cambiar} aria-invalid={!!ubicacion.error} className={`${CAMPO} ${ubicacion.error ? 'border-red-500' : ''}`} />
            {ubicacion.error && <p role="alert" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">{ubicacion.error}</p>}
            {ubicacion.valor && <a href={ubicacion.valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 dark:text-sky-400 hover:underline ml-1"><MapPin className="w-3 h-3" aria-hidden="true" /> Probar enlace</a>}
          </div>

          <div className="col-span-2 pt-1 flex gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={guardando} className="px-4 py-2 text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs transition-colors">Cancelar</button>
            <button type="submit" disabled={guardando || esperandoTecnicos || (Boolean(instalador) && tecnicos === 'error')} className={`px-4 py-2 text-white font-bold rounded-lg text-xs shadow-md transition-colors ${guardando || esperandoTecnicos ? 'bg-zinc-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-60 disabled:cursor-not-allowed`}>{guardando && <Spinner />}{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
