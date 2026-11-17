import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ListOrdered, RefreshCw, Trash2, Users } from 'lucide-react';
import { COLOR_PALETTE, estiloTecnico, siguienteColorTecnico } from '../../constants';
import { stripEmojis } from '../../utils/sanitizeInput';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO, PANEL_PAGINA } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import Spinner from '../Spinner';
import Boton from '../Boton';
import SelectMenu from '../SelectMenu';
import { CAMPO_FORMULARIO, ETIQUETA_CAMPO, SELECTOR, TARJETA, TEXTO_SUAVE, TITULO_SECCION } from '../estilos';

// Arranca del orden guardado (filtrando técnicos que ya no existen) y agrega
// al final cualquiera que todavía no esté en la lista (técnico nuevo, o la
// primera vez que se configura el turno y no hay nada guardado aún).
function mergeOrden(ordenGuardado, technicians) {
  const nombresActuales = new Set(technicians.map(t => t.name));
  const base = ordenGuardado.filter(n => nombresActuales.has(n));
  const faltantes = technicians.map(t => t.name).filter(n => !base.includes(n));
  return [...base, ...faltantes];
}

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/s+/g, ' ').trim().toUpperCase();

export default function TechniciansModal({ technicians, newTech, setNewTech, handleAddTech, handleDeleteTech, onToggleActivo, verInventario = false, onCargarTecnicosInventario, onVincularInventario, ordenTurno = [], tecnicoSugerido = null, onGuardarOrden, onClose, enPagina = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [ordenLocal, setOrdenLocal] = useState(() => mergeOrden(ordenTurno, technicians));
  const [savingOrden, setSavingOrden] = useState(false);
  // Nombre en el inventario (solo para quien gestiona los envíos): la lista de técnicos del almacén y a quién se está guardando.
  const [tecnicosInventario, setTecnicosInventario] = useState(null);
  const [errorInventario, setErrorInventario] = useState('');
  const [vinculandoId, setVinculandoId] = useState(null);

  const aplicarListaInventario = (r) => {
    if (r.ok) setTecnicosInventario(r.tecnicos);
    else setErrorInventario(r.mensaje || 'No se pudo leer la lista de técnicos del inventario.');
  };
  const actualizarTecnicosInventario = async () => {
    setTecnicosInventario(null);
    setErrorInventario('');
    aplicarListaInventario(await onCargarTecnicosInventario());
  };
  // Se lee al abrir el módulo: la lista del almacén cambia poco y "Actualizar" la vuelve a leer.
  useEffect(() => {
    if (!verInventario || !onCargarTecnicosInventario) return undefined;
    let vigente = true;
    onCargarTecnicosInventario().then((r) => { if (vigente) aplicarListaInventario(r); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vincular = async (tech, nombre) => {
    setVinculandoId(tech.id);
    await onVincularInventario(tech.id, nombre);
    setVinculandoId(null);
  };

  const ordenCambio = JSON.stringify(ordenLocal) !== JSON.stringify(mergeOrden(ordenTurno, technicians));

  const colorAuto = siguienteColorTecnico(technicians);
  const colorActual = newTech.color || colorAuto;
  const cambiarColor = () => {
    const i = COLOR_PALETTE.findIndex(c => c.value === colorActual);
    setNewTech({ ...newTech, color: COLOR_PALETTE[(i + 1) % COLOR_PALETTE.length].value });
  };

  const moverOrden = (index, direccion) => {
    const destino = index + direccion;
    if (destino < 0 || destino >= ordenLocal.length) return;
    const copia = [...ordenLocal];
    [copia[index], copia[destino]] = [copia[destino], copia[index]];
    setOrdenLocal(copia);
  };

  const guardarOrdenClick = async () => {
    setSavingOrden(true);
    await onGuardarOrden(ordenLocal);
    setSavingOrden(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await handleAddTech(e);
    setIsSubmitting(false);
  };

  const onDelete = async (id) => {
    setDeletingId(id);
    await handleDeleteTech(id);
    setDeletingId(null);
  };

  const itemsInventario = (opciones, elegido, noEstaEnLista, cargando) => [
    { value: '', label: cargando ? 'Cargando...' : 'Sin elegir' },
    ...(noEstaEnLista ? [{ value: elegido, label: `${elegido} (no está en el inventario)` }] : []),
    ...opciones.map(o => ({ value: o.nombre, label: o.activo ? o.nombre : `${o.nombre} (inactivo)` })),
  ];

  return (
    <Modal enPagina={enPagina} onClose={onClose} zIndexClass="z-[60]" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-card rounded-card shadow-2xl w-full max-w-sm max-h-[90dvh] overflow-y-auto border border-border ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={Users} titulo="Técnicos" onClose={onClose} enPagina={enPagina} />
        <div className={`flex-1 overflow-y-auto bg-fondo p-4 sm:p-6 ${CENTRADO_AMPLIO}`}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">

            {/* Los técnicos: una tarjeta por persona, con su avatar de color, el interruptor de activo y (solo quien gestiona los envíos) su nombre en el inventario. */}
            <section aria-label="Técnicos" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={TITULO_SECCION}>Técnicos <span className="font-bold text-muted-foreground">({technicians.length})</span></h3>
                {verInventario && technicians.length > 0 && (
                  <Boton icono={RefreshCw} tamano="compacto" onClick={actualizarTecnicosInventario} disabled={tecnicosInventario === null && !errorInventario}>
                    Actualizar inventario
                  </Boton>
                )}
              </div>
              {verInventario && technicians.length > 0 && (
                <p className={TEXTO_SUAVE}>
                  Elige con qué nombre conoce el inventario del almacén a cada técnico. El material y los equipos se descuentan a ese nombre; un técnico sin elegir no envía sus órdenes. Solo tú ves esto.
                </p>
              )}
              {errorInventario && <p role="alert" className="text-xs font-bold text-red-700 dark:text-red-400">{errorInventario}</p>}

              <ul className="grid gap-3 sm:grid-cols-2">
                {technicians.map(t => {
                  const activo = t.activo !== false;
                  const elegido = t.tecnicoInventario || '';
                  const usados = new Set(technicians.filter(o => o.id !== t.id && o.tecnicoInventario).map(o => normalizar(o.tecnicoInventario)));
                  const opciones = (tecnicosInventario || []).filter(o => !usados.has(normalizar(o.nombre)));
                  const noEstaEnLista = Boolean(elegido) && tecnicosInventario !== null && !opciones.some(o => normalizar(o.nombre) === normalizar(elegido));
                  const inactivoAlla = Boolean(elegido) && !noEstaEnLista && (tecnicosInventario || []).some(o => normalizar(o.nombre) === normalizar(elegido) && !o.activo);
                  const cargandoInv = tecnicosInventario === null && !errorInventario;
                  return (
                    <li key={t.id} className={`${TARJETA} p-4 flex flex-col gap-3 ${activo ? '' : 'opacity-80'}`}>
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${activo ? estiloTecnico(t.color) : 'bg-zinc-300 text-zinc-600 dark:bg-zinc-800 dark:text-muted-foreground'}`}>{(t.name || '?').trim().charAt(0).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-foreground leading-tight truncate">{t.name}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${activo ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
                            {activo ? 'Activo' : 'Inactivo'}
                          </p>
                        </div>
                        <Boton variante="peligro" tamano="compacto" icono={Trash2} onClick={() => onDelete(t.id)} disabled={deletingId === t.id} aria-label={`Eliminar técnico ${t.name}`} title="Eliminar técnico" className="w-9 !px-0 shrink-0" />
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                        <span id={`recibe-${t.id}`} className="text-sm font-semibold text-card-foreground">Recibe órdenes</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={activo}
                          aria-labelledby={`recibe-${t.id}`}
                          onClick={() => onToggleActivo(t.id, !activo)}
                          title={activo ? 'Marcar como inactivo' : 'Marcar como activo'}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activo ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                        >
                          <span aria-hidden="true" className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      {verInventario && (
                        <div className="space-y-1 min-w-0 border-t border-border pt-3">
                          <p className="text-xs font-semibold text-muted-foreground">Nombre en el inventario</p>
                          <SelectMenu
                            id={`inv-${t.id}`}
                            ariaLabel={`Nombre en el inventario de ${t.name}`}
                            className={SELECTOR}
                            value={elegido}
                            disabled={cargandoInv || vinculandoId === t.id}
                            onChange={(v) => vincular(t, v)}
                            items={itemsInventario(opciones, elegido, noEstaEnLista, cargandoInv)}
                          />
                          <span className={`inline-block text-[11px] max-lg:text-xs font-black px-1.5 py-0.5 rounded ${elegido && !noEstaEnLista && !inactivoAlla ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                            {!elegido ? 'Sin elegir' : noEstaEnLista ? 'No está en el inventario' : inactivoAlla ? 'Inactivo en el inventario' : 'Elegido'}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
                {technicians.length === 0 && <li className={`${TARJETA} ${TEXTO_SUAVE} text-center py-8 sm:col-span-2`}>Aún no hay técnicos. Agrega el primero en Nuevo técnico.</li>}
              </ul>
            </section>

            <div className="space-y-4">
              {/* Turno para las instalaciones */}
              {technicians.length > 0 && (
                <section aria-label="Turno para instalaciones" className={`${TARJETA} p-4 space-y-3`}>
                  <h3 className={`${TITULO_SECCION} flex items-center gap-1.5`}><ListOrdered className="w-4 h-4" aria-hidden="true" /> Turno para instalaciones</h3>
                  <p className={TEXTO_SUAVE}>
                    Orden semanal manual. Al asignar una instalación, el turno pasa al siguiente de la lista (saltando a los inactivos). Al guardar un orden nuevo, el turno vuelve al primero de la lista.
                    {tecnicoSugerido
                      ? <> Turno actual: <strong className="text-zinc-800 dark:text-zinc-100">{tecnicoSugerido}</strong>.</>
                      : <> No hay técnicos activos en el orden.</>}
                  </p>
                  <ol className="space-y-1.5">
                    {ordenLocal.map((nombre, i) => {
                      const tech = technicians.find(t => t.name === nombre);
                      const activo = tech ? tech.activo !== false : false;
                      return (
                        <li key={nombre} className="flex items-center gap-2 rounded-campo border border-border bg-sunken p-1.5">
                          <span className="text-[11px] max-lg:text-xs font-black text-muted-foreground w-5 text-center shrink-0">{i + 1}</span>
                          <span className={`flex-1 min-w-0 truncate px-2 py-1 rounded-campo text-xs font-bold ${activo ? (estiloTecnico(tech?.color) || '') : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-muted-foreground'}`}>{nombre}</span>
                          <Boton variante="discreto" tamano="compacto" icono={ArrowUp} onClick={() => moverOrden(i, -1)} disabled={i === 0} aria-label={`Subir ${nombre}`} className="w-8 !px-0" />
                          <Boton variante="discreto" tamano="compacto" icono={ArrowDown} onClick={() => moverOrden(i, 1)} disabled={i === ordenLocal.length - 1} aria-label={`Bajar ${nombre}`} className="w-8 !px-0" />
                        </li>
                      );
                    })}
                  </ol>
                  <Boton variante="principal" className="w-full" onClick={guardarOrdenClick} disabled={!ordenCambio || savingOrden}>
                    {savingOrden && <Spinner />}{savingOrden ? 'Guardando...' : 'Guardar orden'}
                  </Boton>
                </section>
              )}

              {/* Nuevo técnico */}
              <form onSubmit={onSubmit} className={`${TARJETA} p-4 space-y-4`}>
                <h3 className={TITULO_SECCION}>Nuevo técnico</h3>
                <div className="space-y-1">
                  <label htmlFor="tech-name" className={ETIQUETA_CAMPO}>Nombre</label>
                  <input id="tech-name" required type="text" maxLength="60" value={newTech.name} onChange={(e) => setNewTech({ ...newTech, name: stripEmojis(e.target.value) })} className={CAMPO_FORMULARIO} placeholder="Ej. LUIS FERNÁNDEZ" />
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1.5 rounded-campo text-xs font-bold ${colorActual}`}>{newTech.name.trim() || 'ETIQUETA'}</span>
                  <span className={`${TEXTO_SUAVE} flex-1`}>{newTech.color ? 'Color elegido' : 'Color automático'}</span>
                  <Boton tamano="compacto" onClick={cambiarColor}>Cambiar color</Boton>
                </div>
                <Boton variante="principal" tamano="grande" className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting && <Spinner />}{isSubmitting ? 'Guardando...' : 'Añadir técnico'}</Boton>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
