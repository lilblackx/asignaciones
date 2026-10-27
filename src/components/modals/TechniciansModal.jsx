import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ListOrdered, RefreshCw, Trash2, Users } from 'lucide-react';
import { COLOR_PALETTE, estiloTecnico, siguienteColorTecnico } from '../../constants';
import { stripEmojis } from '../../utils/sanitizeInput';
import Modal, { CENTRADO_AMPLIO, PANEL_COMPLETO, PANEL_PAGINA } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import Spinner from '../Spinner';
import Boton from '../Boton';
import SelectMenu from '../SelectMenu';
import { CAMPO_FORMULARIO, ETIQUETA, SELECTOR, TARJETA, TEXTO_SUAVE, TITULO_SECCION } from '../estilos';

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

  // En el celular la fila es: nombre, estado y eliminar (y debajo, el nombre del inventario); en PC son columnas.
  const columnas = verInventario ? 'grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1.1fr)_8rem_minmax(0,1.4fr)_2.25rem]' : 'grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_8rem_2.25rem]';
  const itemsInventario = (opciones, elegido, noEstaEnLista, cargando) => [
    { value: '', label: cargando ? 'Cargando...' : 'Sin elegir' },
    ...(noEstaEnLista ? [{ value: elegido, label: `${elegido} (no está en el inventario)` }] : []),
    ...opciones.map(o => ({ value: o.nombre, label: o.activo ? o.nombre : `${o.nombre} (inactivo)` })),
  ];

  return (
    <Modal enPagina={enPagina} onClose={onClose} zIndexClass="z-[60]" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800 ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={Users} titulo="Técnicos" onClose={onClose} enPagina={enPagina} />
        <div className={`flex-1 overflow-y-auto bg-fondo p-4 sm:p-6 ${CENTRADO_AMPLIO}`}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">

            {/* Los técnicos: estado, nombre en el inventario (solo quien gestiona los envíos) y eliminar, todo en una fila. */}
            <section aria-label="Técnicos" className={`${TARJETA} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-300 dark:border-zinc-800">
                <h3 className={TITULO_SECCION}>Técnicos <span className="font-bold text-zinc-600 dark:text-zinc-400">({technicians.length})</span></h3>
                {verInventario && technicians.length > 0 && (
                  <Boton icono={RefreshCw} tamano="compacto" onClick={actualizarTecnicosInventario} disabled={tecnicosInventario === null && !errorInventario}>
                    Actualizar inventario
                  </Boton>
                )}
              </div>
              {verInventario && technicians.length > 0 && (
                <p className={`${TEXTO_SUAVE} px-4 py-2 border-b border-zinc-200 dark:border-zinc-800`}>
                  Elige con qué nombre conoce el inventario del almacén a cada técnico. El material y los equipos se descuentan a ese nombre; un técnico sin elegir no envía sus órdenes. Solo tú ves esto.
                </p>
              )}
              {errorInventario && <p role="alert" className="px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400">{errorInventario}</p>}

              {technicians.length > 0 && (
                <div className={`hidden md:grid ${columnas} gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 ${ETIQUETA}`}>
                  <span>Técnico</span>
                  <span>Estado</span>
                  {verInventario && <span>Nombre en el inventario</span>}
                  <span className="sr-only">Eliminar</span>
                </div>
              )}

              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {technicians.map(t => {
                  const activo = t.activo !== false;
                  const elegido = t.tecnicoInventario || '';
                  const usados = new Set(technicians.filter(o => o.id !== t.id && o.tecnicoInventario).map(o => normalizar(o.tecnicoInventario)));
                  const opciones = (tecnicosInventario || []).filter(o => !usados.has(normalizar(o.nombre)));
                  const noEstaEnLista = Boolean(elegido) && tecnicosInventario !== null && !opciones.some(o => normalizar(o.nombre) === normalizar(elegido));
                  const inactivoAlla = Boolean(elegido) && !noEstaEnLista && (tecnicosInventario || []).some(o => normalizar(o.nombre) === normalizar(elegido) && !o.activo);
                  const cargandoInv = tecnicosInventario === null && !errorInventario;
                  return (
                    <li key={t.id} className={`grid ${columnas} gap-x-3 gap-y-2 px-4 py-3 items-center`}>
                      <span className={`order-1 inline-flex w-fit max-w-full items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold ${activo ? estiloTecnico(t.color) : 'bg-zinc-300 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ring-2 ring-white dark:ring-zinc-950 ${activo ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
                        <span className="truncate">{t.name}</span>
                      </span>
                      <Boton
                        tamano="compacto"
                        onClick={() => onToggleActivo(t.id, !activo)}
                        aria-label={`Marcar ${t.name} como ${activo ? 'inactivo' : 'activo'}`}
                        title={activo ? 'Marcar como inactivo' : 'Marcar como activo'}
                        className={`order-2 w-fit ${activo ? '!border-emerald-600 !text-emerald-700 dark:!text-emerald-300' : ''}`}
                      >
                        {activo ? 'Activo' : 'Inactivo'}
                      </Boton>
                      {verInventario && (
                        <div className="order-4 md:order-3 space-y-1 min-w-0 col-span-full md:col-span-1">
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
                      <Boton variante="peligro" tamano="compacto" icono={Trash2} onClick={() => onDelete(t.id)} disabled={deletingId === t.id} aria-label={`Eliminar técnico ${t.name}`} title="Eliminar técnico" className="order-3 md:order-4 w-9 !px-0 justify-self-end" />
                    </li>
                  );
                })}
                {technicians.length === 0 && <li className={`${TEXTO_SUAVE} text-center py-6`}>Aún no hay técnicos. Agrega el primero en Nuevo técnico.</li>}
              </ul>
            </section>

            <div className="space-y-4">
              {/* Turno para las instalaciones */}
              {technicians.length > 0 && (
                <section aria-label="Turno para instalaciones" className={`${TARJETA} p-4 space-y-3`}>
                  <h3 className={`${TITULO_SECCION} flex items-center gap-1.5`}><ListOrdered className="w-4 h-4" aria-hidden="true" /> Turno para instalaciones</h3>
                  <p className={TEXTO_SUAVE}>
                    Orden semanal manual. Al asignar una instalación, el turno pasa al siguiente de la lista (saltando a los inactivos).
                    {tecnicoSugerido
                      ? <> Turno actual: <strong className="text-zinc-800 dark:text-zinc-100">{tecnicoSugerido}</strong>.</>
                      : <> No hay técnicos activos en el orden.</>}
                  </p>
                  <ol className="space-y-1.5">
                    {ordenLocal.map((nombre, i) => {
                      const tech = technicians.find(t => t.name === nombre);
                      const activo = tech ? tech.activo !== false : false;
                      return (
                        <li key={nombre} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-1.5">
                          <span className="text-[11px] max-lg:text-xs font-black text-zinc-500 w-5 text-center shrink-0">{i + 1}</span>
                          <span className={`flex-1 min-w-0 truncate px-2 py-1 rounded-md text-xs font-bold ${activo ? (estiloTecnico(tech?.color) || '') : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>{nombre}</span>
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
                  <label htmlFor="tech-name" className={ETIQUETA}>Nombre</label>
                  <input id="tech-name" required type="text" maxLength="60" value={newTech.name} onChange={(e) => setNewTech({ ...newTech, name: stripEmojis(e.target.value) })} className={CAMPO_FORMULARIO} placeholder="Ej. LUIS FERNÁNDEZ" />
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1.5 rounded-md text-xs font-bold ${colorActual}`}>{newTech.name.trim() || 'ETIQUETA'}</span>
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
