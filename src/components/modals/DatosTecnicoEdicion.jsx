import { Plus, X } from 'lucide-react';
import SelectMenu from '../SelectMenu';
import ConectoresRecableado, { CantidadesConectorVisita } from './ConectoresRecableado';
import SerialEquipoCampo from './SerialEquipoCampo';
import { MAX_LARGO_METRAJE, MAX_LARGO_POSTE, MAX_LARGO_PUERTOS_DISPONIBLES, MAX_LARGO_SERIAL, MAX_POSTES } from '../../utils/instalacion';
import { TIPOS_VISITA, TIPO_CAMBIO_EQUIPO, TIPO_CONECTOR_INTERNO, TIPO_RECABLEADO, esVisitaConector } from '../../utils/tipoVisita';
import { stripEmojis } from '../../utils/sanitizeInput';
import { esSerialOlt, evaluarSerialCaja, serialParaOlt } from '../../utils/serialOlt';

const claseEtiqueta = 'text-[10px] font-bold text-zinc-600 dark:text-zinc-400 ml-1';
const claseInput = (error, correcto = false) =>
  `w-full min-w-0 bg-white dark:bg-zinc-950 border px-3 py-1.5 rounded-lg focus:ring-0 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors ${error ? 'border-red-500' : correcto ? 'border-emerald-500 focus:border-emerald-500' : 'border-zinc-400 dark:border-zinc-700 focus:border-red-600'}`;

function Campo({ id, etiqueta, error, ayuda, className = 'col-span-1', children }) {
  return (
    <div className={`${className} space-y-1`}>
      <label htmlFor={id} className={claseEtiqueta}>{etiqueta}</label>
      {children}
      {error ? <p id={`${id}-error`} role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{error}</p> : ayuda && <p className="text-[10px] text-zinc-600 dark:text-zinc-400 ml-1">{ayuda}</p>}
    </div>
  );
}

// Solo para los admins, en órdenes finalizadas: si el serial es correcto (verde) o no (rojo), con la misma verificación que ve el
// técnico, y cómo se enviará al inventario del almacén (el que ve la OLT) cuando se puede convertir.
// `soloEnvio`: sin el veredicto (el campo ya lo muestra, como el del técnico), solo cómo se enviará al almacén.
function AvisoSerialOlt({ serial, soloEnvio = false }) {
  const evaluacion = evaluarSerialCaja(serial);
  if (evaluacion.estado === 'vacio') return null;
  const olt = serialParaOlt(serial);
  const envio = esSerialOlt(olt) ? `Se enviará al almacén como: ${olt}` : '';
  if (soloEnvio) return envio ? <p role="status" className="text-[10px] text-zinc-600 dark:text-zinc-400 font-bold ml-1">{envio}</p> : null;
  const color = evaluacion.estado === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  return <p role="status" className={`text-[10px] ${color} font-bold ml-1`}>{evaluacion.mensaje} {envio}</p>;
}

const soloDigitos = (v, largo) => v.replace(/\D/g, '').slice(0, largo);

// Cantidad de conectores de una instalación: un campo de texto numérico por tipo y color.
function CampoConectores({ id, etiqueta, valor, onChange, error }) {
  return (
    <div className="space-y-1 min-w-0">
      <label htmlFor={id} className={claseEtiqueta}>{etiqueta}</label>
      <input id={id} type="text" inputMode="numeric" autoComplete="off" maxLength="2" placeholder="0" value={valor} onChange={(e) => onChange(soloDigitos(e.target.value, 2))} aria-invalid={!!error} className={`${claseInput(error)} text-center`} />
    </div>
  );
}

// Los datos que cargó el técnico al pre-finalizar, para que la oficina los corrija en "Editar orden". Una instalación lleva
// serial, VLAN, NAP y puerto, metraje, posteadura, puertos disponibles y conectores; el resto de las órdenes, su tipo de visita
// con los datos que ese tipo pide. Se rellena en el mismo formulario del técnico: las mismas reglas (ver utils/edicionDatosTecnico).
export default function DatosTecnicoEdicion({ instalacion, form, onChange, errores, finalizada, avisoSerial = false }) {
  const conectoresError = errores.conectores?.mensaje || '';
  const cambiarPoste = (i, valor) => onChange({ postes: form.postes.map((p, j) => (j === i ? valor : p)) });
  const tipoVisita = form.tipoVisita;
  const evaluacionSerial = evaluarSerialCaja(form.serial);

  return (
    <section aria-label="Datos que cargó el técnico" className="col-span-2 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <h3 className="text-[11px] font-black tracking-wide text-amber-800 dark:text-amber-300">DATOS QUE CARGÓ EL TÉCNICO</h3>
        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-0.5">
          Corrige lo que el técnico escribió.{instalacion ? ' La plantilla de la orden se actualiza con estos datos.' : ''}
          {finalizada ? ' Si la orden ya se envió al inventario del almacén, el cambio no se reenvía: solo se corrige aquí.' : ''}
        </p>
      </div>

      {instalacion ? (
        <>
          <Campo id="ed-serial" etiqueta="SERIAL" error={errores.serial} className="col-span-2">
            <input id="ed-serial" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={MAX_LARGO_SERIAL} placeholder="Ej. HWTC1A2B3C4D" value={form.serial} onChange={(e) => onChange({ serial: e.target.value.replace(/[^0-9a-zA-Z-]/g, '').toUpperCase() })} aria-invalid={!!errores.serial} aria-describedby={errores.serial ? 'ed-serial-error' : undefined} className={claseInput(errores.serial || (avisoSerial && evaluacionSerial.estado === 'error'), avisoSerial && evaluacionSerial.estado === 'ok')} />
            {avisoSerial && !errores.serial && <AvisoSerialOlt serial={form.serial} />}
          </Campo>
          {/* VLAN y metraje: una fila para las etiquetas, otra para los campos y otra para los avisos, así los campos quedan a la misma altura aunque una etiqueta ocupe dos líneas. */}
          <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-1 items-end">
            <label htmlFor="ed-vlan" className={`${claseEtiqueta} col-start-1 row-start-1`}>VLAN</label>
            <label htmlFor="ed-metraje" className={`${claseEtiqueta} col-start-2 row-start-1`}>METRAJE DEL DROP (m)</label>
            <input id="ed-vlan" type="text" inputMode="numeric" autoComplete="off" maxLength="4" placeholder="Ej. 100" value={form.vlan} onChange={(e) => onChange({ vlan: soloDigitos(e.target.value, 4) })} aria-invalid={!!errores.vlan} aria-describedby={errores.vlan ? 'ed-vlan-error' : undefined} className={`${claseInput(errores.vlan)} col-start-1 row-start-2`} />
            <input id="ed-metraje" type="text" inputMode="numeric" autoComplete="off" maxLength={MAX_LARGO_METRAJE} placeholder="Ej. 120" value={form.metraje} onChange={(e) => onChange({ metraje: soloDigitos(e.target.value, MAX_LARGO_METRAJE) })} aria-invalid={!!errores.metraje} aria-describedby={errores.metraje ? 'ed-metraje-error' : undefined} className={`${claseInput(errores.metraje)} col-start-2 row-start-2`} />
            {errores.vlan && <p id="ed-vlan-error" role="alert" className="col-start-1 row-start-3 self-start text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{errores.vlan}</p>}
            {errores.metraje && <p id="ed-metraje-error" role="alert" className="col-start-2 row-start-3 self-start text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{errores.metraje}</p>}
          </div>
          <Campo id="ed-nap" etiqueta="NAP" error={errores.nap}>
            <input id="ed-nap" type="text" maxLength="40" placeholder="Ej. NAP 08" value={form.nap} onChange={(e) => onChange({ nap: stripEmojis(e.target.value) })} aria-invalid={!!errores.nap} aria-describedby={errores.nap ? 'ed-nap-error' : undefined} className={claseInput(errores.nap)} />
          </Campo>
          <Campo id="ed-puerto" etiqueta="PUERTO" error={errores.puerto}>
            <input id="ed-puerto" type="text" inputMode="numeric" autoComplete="off" maxLength="3" placeholder="Ej. 3" value={form.puerto} onChange={(e) => onChange({ puerto: soloDigitos(e.target.value, 3) })} aria-invalid={!!errores.puerto} aria-describedby={errores.puerto ? 'ed-puerto-error' : undefined} className={claseInput(errores.puerto)} />
          </Campo>

          <div className="col-span-2 space-y-1.5" role="group" aria-labelledby="ed-postes-etiqueta">
            <p id="ed-postes-etiqueta" className={claseEtiqueta}>POSTEADURA <span className="font-normal text-zinc-400">uno o varios postes</span></p>
            {form.postes.map((poste, i) => (
              <div key={i} className="flex items-center gap-2">
                <input id={`ed-poste-${i + 1}`} type="text" autoComplete="off" maxLength={MAX_LARGO_POSTE} placeholder={i === 0 ? 'Ej. DM SN N01B01' : `Poste ${i + 1}`} aria-label={`Poste ${i + 1}`} aria-invalid={i === 0 && !!errores.posteadura} value={poste} onChange={(e) => cambiarPoste(i, stripEmojis(e.target.value))} className={`flex-1 ${claseInput(i === 0 && errores.posteadura)}`} />
                {form.postes.length > 1 && (
                  <button type="button" onClick={() => onChange({ postes: form.postes.filter((_, j) => j !== i) })} aria-label={`Quitar poste ${i + 1}`} className="shrink-0 p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => onChange({ postes: [...form.postes, ''] })} disabled={form.postes.length >= MAX_POSTES} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-zinc-400 dark:border-zinc-600 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-red-600 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-50">
              <Plus className="w-3 h-3" aria-hidden="true" /> Agregar otro poste
            </button>
            {errores.posteadura && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{errores.posteadura}</p>}
          </div>

          <Campo id="ed-puertos-disponibles" etiqueta="PUERTOS DISPONIBLES" error={errores.puertosDisponibles} ayuda="Los que quedan libres en la NAP (0 si ninguno)." className="col-span-2">
            <input id="ed-puertos-disponibles" type="text" autoComplete="off" maxLength={MAX_LARGO_PUERTOS_DISPONIBLES} placeholder="Ej. 6" value={form.puertosDisponibles} onChange={(e) => onChange({ puertosDisponibles: stripEmojis(e.target.value) })} aria-invalid={!!errores.puertosDisponibles} aria-describedby={errores.puertosDisponibles ? 'ed-puertos-disponibles-error' : undefined} className={claseInput(errores.puertosDisponibles)} />
          </Campo>

          <div className="col-span-2 space-y-1.5" role="group" aria-labelledby="ed-conectores-etiqueta">
            <p id="ed-conectores-etiqueta" className={claseEtiqueta}>CONECTORES USADOS <span className="font-normal text-zinc-400">cuántos de cada tipo y color</span></p>
            <div className="grid grid-cols-3 gap-2">
              <CampoConectores id="ed-cant-ext-verde" etiqueta="Ext. verdes" valor={form.extVerde} onChange={(v) => onChange({ extVerde: v })} error={errores.conectores?.campo === 'externoVerde' ? conectoresError : ''} />
              <CampoConectores id="ed-cant-int-verde" etiqueta="Int. verdes" valor={form.intVerde} onChange={(v) => onChange({ intVerde: v })} error={errores.conectores?.campo === 'internoVerde' ? conectoresError : ''} />
              <CampoConectores id="ed-cant-int-azul" etiqueta="Int. azules" valor={form.intAzul} onChange={(v) => onChange({ intAzul: v })} error={errores.conectores?.campo === 'internoAzul' ? conectoresError : ''} />
            </div>
            <p className="text-[10px] text-zinc-600 dark:text-zinc-400 ml-1">El externo es solo verde; el interno, verde o azul.</p>
            {conectoresError && <p role="alert" className="text-[10px] text-red-600 dark:text-red-400 font-bold ml-1">{conectoresError}</p>}
          </div>
        </>
      ) : (
        <>
          <div className="col-span-2 space-y-1">
            <label htmlFor="ed-tipo-visita" className={claseEtiqueta}>TIPO DE VISITA</label>
            <SelectMenu
              id="ed-tipo-visita"
              ariaLabel="Tipo de visita"
              value={tipoVisita}
              onChange={(v) => onChange({ tipoVisita: v })}
              items={TIPOS_VISITA}
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-400 dark:border-zinc-700 pl-3 pr-8 py-1.5 rounded-lg focus:ring-0 focus:border-red-600 outline-none text-xs text-zinc-900 dark:text-white shadow-sm transition-colors"
              chevronClassName="w-3.5 h-3.5 right-2"
            />
          </div>

          {tipoVisita === TIPO_RECABLEADO && (
            <div className="col-span-2 space-y-3">
              <Campo id="pf-metros" etiqueta="METROS DE CABLE" error={errores.metros} className="col-span-2">
                <div className="relative">
                  <input id="pf-metros" type="text" inputMode="numeric" placeholder="Ej. 35" value={form.metros} onChange={(e) => onChange({ metros: soloDigitos(e.target.value, 4) })} aria-invalid={!!errores.metros} aria-describedby={errores.metros ? 'pf-metros-error' : undefined} className={`w-full pr-8 ${claseInput(errores.metros)}`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-600 dark:text-zinc-400 pointer-events-none" aria-hidden="true">m</span>
                </div>
              </Campo>
              <ConectoresRecableado colorExterno={form.colorExterno} colorInterno={form.colorInterno} onExterno={(v) => onChange({ colorExterno: v })} onInterno={(v) => onChange({ colorInterno: v })} />
            </div>
          )}

          {tipoVisita === TIPO_CAMBIO_EQUIPO && (
            <div className="col-span-2">
              <SerialEquipoCampo serial={form.serialEquipo} onSerial={(v) => onChange({ serialEquipo: v })} error={errores.serialEquipo} tipoEquipo={form.tipoEquipoNuevo} onTipoEquipo={(v) => onChange({ tipoEquipoNuevo: v })} errorTipo={errores.tipoEquipoNuevo} verificar={avisoSerial} aviso={avisoSerial ? <AvisoSerialOlt serial={form.serialEquipo} soloEnvio /> : null} />
            </div>
          )}

          {esVisitaConector(tipoVisita) && (
            <div className="col-span-2">
              <CantidadesConectorVisita
                interno={tipoVisita === TIPO_CONECTOR_INTERNO}
                verde={form.cantVerde}
                azul={form.cantAzul}
                onVerde={(v) => onChange({ cantVerde: v })}
                onAzul={(v) => onChange({ cantAzul: v })}
                error={errores.cantidades || {}}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
