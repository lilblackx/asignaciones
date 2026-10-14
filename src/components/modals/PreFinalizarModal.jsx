import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, MapPin, Plug, Tag, Wrench, X } from 'lucide-react';
import Modal from '../Modal';
import SelectMenu from '../SelectMenu';
import SenalSmartOlt from './SenalSmartOlt';
import { napSinDato, separarNapPuerto, unirNapPuerto } from '../../utils/napPuerto';
import { stripEmojis } from '../../utils/sanitizeInput';
import { formatCedula } from '../../utils/ticketDisplay';
import ContactoCliente from '../ContactoCliente';
import DevolucionAviso from '../DevolucionAviso';
import { evaluarPotencia, parsePotencia } from '../../utils/potencia';
import { puedeCapturarPotencia } from '../../utils/senalOnu';
import { TIPOS_VISITA, TIPO_CONECTOR_EXTERNO, TIPO_CONECTOR_INTERNO, TIPO_RECABLEADO, colorConectorExterno, colorConectorInterno, coloresConectorVisita, datosConectores, errorColorConector, esVisitaConector, parseMetros } from '../../utils/tipoVisita';
import { conceptoCobro } from '../../utils/cobro';
import { esInstalacion as trabajoEsInstalacion, napConPuerto, validarInstalacion } from '../../utils/instalacion';
import ConectoresRecableado, { ColorConectorVisita } from './ConectoresRecableado';
import DatosInstalacion from './DatosInstalacion';
import NapPuertoCampos from './NapPuertoCampos';

export default function PreFinalizarModal({ ticket, onConfirm, onClose }) {
  // La NAP y el puerto van en dos campos con conector externo y en las instalaciones.
  const conDosCampos = ticket?.tipoVisita === 'CONECTOR_EXTERNO' || trabajoEsInstalacion(ticket?.tipoTrabajo);
  const separado = conDosCampos ? separarNapPuerto(ticket?.nap) : null;
  const napInicial = separado ? separado.nap : (ticket?.nap || '');
  // En esos casos una NAP "SN" (o vacía) no sirve: el técnico debe escribir la real.
  const [nap, setNap] = useState(conDosCampos && napSinDato(napInicial) ? '' : napInicial);
  const [puerto, setPuerto] = useState(separado ? separado.puerto : '');
  // Instalación: lo que la plantilla de la promotora trae vacío (ver utils/instalacion).
  const [serial, setSerial] = useState(ticket?.instalacion?.serial || '');
  const [vlan, setVlan] = useState(ticket?.instalacion?.vlan || '');
  const [puertosDisponibles, setPuertosDisponibles] = useState(ticket?.instalacion?.puertosDisponibles || '');
  const [postes, setPostes] = useState(ticket?.instalacion?.posteadura?.length ? ticket.instalacion.posteadura : ['']);
  const [instalacionErrores, setInstalacionErrores] = useState({});
  const [tipoVisitaElegido, setTipoVisita] = useState(ticket?.tipoVisita || '');
  const [napError, setNapError] = useState('');
  const [puertoError, setPuertoError] = useState('');
  const [observacion, setObservacion] = useState(ticket?.observacion || '');
  const potenciaInicial = ticket?.potenciaDbm != null ? String(ticket.potenciaDbm) : '';
  const [potencia, setPotenciaCampo] = useState(potenciaInicial);
  // La consulta a SmartOLT es asíncrona: lo que hay en el campo y lo último que ella escribió se
  // leen de aquí, no del estado de cuando se tocó el botón (el técnico pudo escribir mientras tanto).
  const potenciaEscrita = useRef(potenciaInicial);
  const potenciaDeSmartOlt = useRef('');
  const setPotencia = (valor) => { potenciaEscrita.current = valor; setPotenciaCampo(valor); };
  const [potencia1490, setPotencia1490] = useState(ticket?.potencia1490Dbm != null ? String(ticket.potencia1490Dbm) : '');
  // Recableado: metros de cable (obligatorios) y conectores colocados (opcionales). Visita de
  // conector: el color del conector colocado (el interno es obligatorio).
  const [metros, setMetros] = useState(ticket?.metrosCable != null ? String(ticket.metrosCable) : '');
  const [colorExterno, setColorExterno] = useState(colorConectorExterno(ticket?.conectorExterno));
  const [colorInterno, setColorInterno] = useState(colorConectorInterno(ticket?.conectorInterno));
  const [metrosError, setMetrosError] = useState('');
  const [colorError, setColorError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [obsError, setObsError] = useState('');

  if (!ticket) return null;

  // En una instalación no aplica el tipo de visita (conectores, recableado): se oculta y no se guarda.
  const esInstalacion = trabajoEsInstalacion(ticket.tipoTrabajo);
  const tipoVisita = esInstalacion ? '' : tipoVisitaElegido;
  const conectorExterno = tipoVisita === TIPO_CONECTOR_EXTERNO;
  const recableado = tipoVisita === TIPO_RECABLEADO;
  const potenciaParseada = parsePotencia(potencia);
  const potenciaEval = potenciaParseada.valor !== undefined ? evaluarPotencia(potenciaParseada.valor) : null;

  // SmartOLT solo rellena la potencia si nadie escribió nada: nunca pisa lo escrito. Devuelve si la escribió.
  const capturarSenal = (v1310, v1490) => {
    const escribir = puedeCapturarPotencia(potenciaEscrita.current, potenciaDeSmartOlt.current);
    if (escribir) {
      setPotencia(v1310);
      potenciaDeSmartOlt.current = v1310;
    }
    setPotencia1490(v1490 ?? '');
    return escribir;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const metrosParseados = recableado ? parseMetros(metros) : null;
    const errorColor = errorColorConector(tipoVisita, colorInterno);
    const instalacion = esInstalacion ? validarInstalacion({ serial, vlan, postes, nap, puerto, puertosDisponibles }) : null;
    // Con conector externo y en las instalaciones la NAP real y el puerto son obligatorios.
    const pideNapPuerto = conectorExterno || esInstalacion;
    const faltaNap = pideNapPuerto && napSinDato(nap);
    const faltaPuerto = pideNapPuerto && !puerto.trim();
    setMetrosError(metrosParseados?.error || '');
    setColorError(errorColor);
    setInstalacionErrores(instalacion?.errores || {});
    setNapError(faltaNap ? 'Indica la nomenclatura real de la NAP (no vale "SN").' : '');
    setPuertoError(faltaPuerto ? 'Indica el puerto.' : '');
    const faltaObs = !observacion.trim();
    setObsError(faltaObs ? 'Debes describir el trabajo realizado antes de pre-finalizar.' : '');
    // El campo queda arriba y el botón abajo: el cursor va al primer campo con problema, en el orden del formulario.
    if (metrosParseados?.error) document.getElementById('pf-metros')?.focus();
    else if (errorColor) document.getElementById('pf-color-conector')?.focus();
    else if (instalacion?.errores.serial) document.getElementById('pf-serial')?.focus();
    else if (instalacion?.errores.vlan) document.getElementById('pf-vlan')?.focus();
    else if (instalacion?.errores.posteadura) document.getElementById('pf-poste-1')?.focus();
    else if (faltaNap) document.getElementById('pf-nap')?.focus();
    else if (faltaPuerto) document.getElementById('pf-puerto')?.focus();
    else if (instalacion?.errores.puertosDisponibles) document.getElementById('pf-puertos-disponibles')?.focus();
    else if (potenciaParseada.error) document.getElementById('pf-potencia')?.focus();
    else if (faltaObs) document.getElementById('pf-obs')?.focus();
    if (faltaObs || metrosParseados?.error || errorColor || instalacion?.error || faltaNap || faltaPuerto || potenciaParseada.error) return;
    setIsSubmitting(true);
    await onConfirm(ticket, {
      nap: conectorExterno ? unirNapPuerto(nap, puerto) : esInstalacion ? napConPuerto(nap, puerto) : nap,
      ...(instalacion ? { instalacion: instalacion.datos } : {}),
      observacion,
      potenciaDbm: potenciaParseada.valor ?? null,
      potencia1490Dbm: parsePotencia(potencia1490).valor ?? null,
      tipoVisita,
      ...datosConectores(tipoVisita, { metros: metrosParseados?.valor, conectorExterno: colorExterno, conectorInterno: colorInterno }),
    });
    setIsSubmitting(false);
  };

  return (
    <Modal onClose={onClose} zIndexClass="z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800">
        <div className="bg-black px-4 py-3.5 border-b-2 border-amber-500 flex justify-between items-center sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded tracking-wide">
                PRE-FINALIZAR
              </span>
              <span className="text-xs font-bold text-amber-400">
                {ticket.codigo || 'S/C'}
              </span>
            </div>
            <h2 className="text-sm font-black text-white mt-0.5 truncate max-w-[260px] sm:max-w-md">
              {ticket.nombre}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="bg-zinc-800 p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* noValidate: las faltas las revisa handleSubmit, que muestra todos los errores y lleva el cursor al primero. */}
        <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-5 space-y-4">
          <DevolucionAviso ticket={ticket} />
          {/* Resumen compacto de la orden */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="font-bold text-red-600 dark:text-red-400">{ticket.tipoTrabajo}</span>
              {ticket.falla && <span className="text-zinc-400">({ticket.falla})</span>}
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{ticket.direccion}</span>
            </div>
            {ticket.cedula && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Tag className="w-3 h-3 text-zinc-400 shrink-0" />
                <span>C.I: {formatCedula(ticket.cedula, ticket.tipoDocumento)}</span>
                {ticket.telefono && <span className="ml-2">Telf: {ticket.telefono}</span>}
              </div>
            )}
            <ContactoCliente telefono={ticket.telefono} ubicacion={ticket.ubicacion} napCoordenadas={ticket.napCoordenadas} nombre={ticket.nombre} className="pt-1" />
          </div>

          {!esInstalacion && (
          <div className="space-y-1">
            <label htmlFor="pf-tipo-visita" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              TIPO DE VISITA <span className="font-normal text-zinc-400">(opcional)</span>
            </label>
            <SelectMenu
              id="pf-tipo-visita"
              ariaLabel="Tipo de visita"
              icon={Plug}
              value={tipoVisita}
              onChange={(v) => {
                setTipoVisita(v);
                setNapError('');
                setPuertoError('');
                setMetrosError('');
                setColorError('');
                // Un texto ya escrito como "NAP 08 - Puerto 3" se reparte en los dos campos.
                if (v === TIPO_CONECTOR_EXTERNO && !puerto) {
                  const sep = separarNapPuerto(nap);
                  setNap(napSinDato(sep.nap) ? '' : sep.nap);
                  setPuerto(sep.puerto);
                }
              }}
              items={TIPOS_VISITA}
            />
          </div>
          )}

          {recableado && (
            <div className="space-y-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3">
              <div className="space-y-1">
                <label htmlFor="pf-metros" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
                  METROS DE CABLE <span className="font-normal text-red-500">(obligatorio)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="pf-metros"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 35"
                    value={metros}
                    onChange={(e) => { setMetros(e.target.value.replace(/\D/g, '').slice(0, 4)); if (metrosError) setMetrosError(''); }}
                    aria-invalid={!!metrosError}
                    aria-describedby={metrosError ? 'pf-metros-error' : undefined}
                    className={`flex-1 min-w-0 bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm font-bold text-zinc-900 dark:text-white shadow-sm transition-colors ${metrosError ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
                  />
                  <span className="text-sm font-black text-zinc-500 dark:text-zinc-400 shrink-0">m</span>
                </div>
                {metrosError && <p id="pf-metros-error" role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{metrosError}</p>}
              </div>
              <ConectoresRecableado colorExterno={colorExterno} colorInterno={colorInterno} onExterno={setColorExterno} onInterno={setColorInterno} />
            </div>
          )}

          {esVisitaConector(tipoVisita) && (
            <ColorConectorVisita
              colores={coloresConectorVisita(tipoVisita)}
              valor={tipoVisita === TIPO_CONECTOR_INTERNO ? colorInterno : colorExterno}
              onChange={(color) => { setColorInterno(color); setColorError(''); }}
              error={colorError}
            />
          )}

          {esInstalacion ? (
            <DatosInstalacion
              serial={serial}
              onSerial={(v) => { setSerial(v); if (instalacionErrores.serial) setInstalacionErrores((e) => ({ ...e, serial: undefined })); }}
              vlan={vlan}
              onVlan={(v) => { setVlan(v); if (instalacionErrores.vlan) setInstalacionErrores((e) => ({ ...e, vlan: undefined })); }}
              postes={postes}
              onPostes={(v) => { setPostes(v); if (instalacionErrores.posteadura) setInstalacionErrores((e) => ({ ...e, posteadura: undefined })); }}
              nap={nap}
              onNap={(v) => { setNap(v); if (napError) setNapError(''); }}
              puerto={puerto}
              onPuerto={(v) => { setPuerto(v); if (puertoError) setPuertoError(''); }}
              puertosDisponibles={puertosDisponibles}
              onPuertosDisponibles={(v) => { setPuertosDisponibles(v); if (instalacionErrores.puertosDisponibles) setInstalacionErrores((e) => ({ ...e, puertosDisponibles: undefined })); }}
              errores={{ ...instalacionErrores, nap: napError, puerto: puertoError }}
            />
          ) : conectorExterno ? (
            <NapPuertoCampos
              nap={nap}
              onNap={(v) => { setNap(v); if (napError) setNapError(''); }}
              napError={napError}
              puerto={puerto}
              onPuerto={(v) => { setPuerto(v); if (puertoError) setPuertoError(''); }}
              puertoError={puertoError}
            />
          ) : (
            <div className="space-y-1">
              <label htmlFor="pf-nap" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
                NAP / CAJA / PUERTO <span className="font-normal text-zinc-400">(opcional)</span>
              </label>
              <input
                id="pf-nap"
                type="text"
                maxLength="50"
                placeholder="Ej. NAP 08 - Puerto 3"
                value={nap}
                onChange={(e) => setNap(stripEmojis(e.target.value))}
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors"
              />
            </div>
          )}

          <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-xl p-3 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-200">
            <Plug className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-tight">
              {conceptoCobro({ tipoTrabajo: ticket.tipoTrabajo, tipoVisita })}: cuando se finalice la orden, verás el cobro resultante para el cliente.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="pf-potencia" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              POTENCIA ÓPTICA (dBm) <span className="font-normal text-zinc-400">(opcional)</span>
            </label>
            <input
              id="pf-potencia"
              type="text"
              inputMode="decimal"
              maxLength="7"
              placeholder="Ej. -19.5"
              value={potencia}
              onChange={(e) => setPotencia(e.target.value.replace(/[^0-9.,-]/g, ''))}
              aria-invalid={!!potenciaParseada.error}
              aria-describedby="pf-potencia-hint"
              className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${potenciaParseada.error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
            />
            <p id="pf-potencia-hint" role={potenciaParseada.error ? 'alert' : undefined} className={`text-[10px] font-bold ml-1 ${potenciaParseada.error ? 'text-red-600 dark:text-red-400' : potenciaEval ? potenciaEval.clase : 'text-zinc-400 font-normal'}`}>
              {potenciaParseada.error || (potenciaEval ? potenciaEval.texto : 'Potencia recibida en la ONU. Si omites el signo se toma como negativa.')}
            </p>
            {ticket.cedula && <SenalSmartOlt ticketId={ticket.id} onCapturar={capturarSenal} />}
          </div>

          <div className="space-y-1">
            <label htmlFor="pf-obs"className="text-xs font-bold text-zinc-700 dark:text-zinc-300 ml-1">
              OBSERVACIÓN / DETALLES DEL TRABAJO <span className="font-normal text-red-500">(obligatorio)</span>
            </label>
            <textarea
              id="pf-obs"
              required
              rows="3"
              maxLength="300"
              placeholder="Escribe detalles del servicio (ej. Instalación operativa, cliente conforme)..."
              value={observacion}
              onChange={(e) => { setObservacion(stripEmojis(e.target.value)); if (obsError) setObsError(''); }}
              aria-invalid={!!obsError}
              className={`w-full bg-white dark:bg-zinc-950 border px-3 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors resize-none ${obsError ? 'border-red-500 focus:border-red-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-amber-500'}`}
            />
            {obsError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{obsError}</p>}
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-tight">
              Esta orden quedará en estado <strong>PRE-FINALIZADA</strong> para que el administrador u operador revise y realice la finalización definitiva.
            </p>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3 text-xs sm:text-sm text-black font-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{isSubmitting ? 'Guardando...' : 'Confirmar'}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
