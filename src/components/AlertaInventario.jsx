import { useEffect, useState } from 'react';
import { Bell, ChevronDown, ClipboardCopy, PackageCheck, PackageX, RefreshCw, Search } from 'lucide-react';
import Modal, { CENTRADO_ESTRECHO, PANEL_COMPLETO, PANEL_PAGINA } from './Modal';
import EncabezadoModulo from './EncabezadoModulo';
import Colapsable from './Colapsable';
import BotonLimpiarBusqueda from './BotonLimpiarBusqueda';
import { ESTADOS_CON_ALERTA, TEXTO_ESTADO_ENVIO } from '../utils/envioInventario';
import Spinner from './Spinner';
import BotonFiltros from './BotonFiltros';
import { BUSCADOR } from './estilos';
import ChipFiltro from './Chip';
import Boton from './Boton';

const ETIQUETA_ESTADO = {
  SERIAL_NO_ENCONTRADO: 'Serial no existe',
  SERIAL_YA_INSTALADO: 'Ya instalado',
  EQUIPO_NO_ASIGNADO: 'No está con técnico',
  SIN_SERIAL: 'Sin serial',
  TECNICO_NO_VINCULADO: 'Técnico sin vincular',
  TECNICO_NO_ENCONTRADO: 'Técnico no existe',
  TECNICO_INACTIVO: 'Técnico inactivo',
  EQUIPO_OTRO_TECNICO: 'Equipo de otro técnico',
  ERROR: 'Error al enviar',
  ENVIADO: 'Enviado',
  PENDIENTE: 'Pendiente',
  DESCARTADO: 'Descartada',
};
const ESTILO_ESTADO = {
  ENVIADO: 'bg-emerald-700 text-white',
  PENDIENTE: 'bg-amber-500 text-black',
  DESCARTADO: 'bg-zinc-400 dark:bg-zinc-600 text-white',
};
const ESTILO_ALERTA = 'bg-red-600 text-white';
const ETIQUETA_ACCION = { instalacion_nueva: 'Instalación', cambio_equipo: 'Cambio de equipo', averia: 'Material de avería' };
const fechaHora = (ms) => (ms ? new Date(ms).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—');

// Aviso en la pantalla principal, solo para los usuarios del módulo: hay órdenes aprobadas que no se pudieron descontar del
// inventario del almacén.
export function AvisoInventario({ cantidad, pendientes = 0, onAbrir }) {
  // Lo que necesita a alguien (rojo) manda sobre lo que se reintenta solo (ámbar).
  const urgente = cantidad > 0;
  return (
    <Colapsable>
      {(cantidad > 0 || pendientes > 0) && (
        <div role="alert" className={`mb-3 rounded-xl border p-3 flex items-center gap-3 text-xs ${urgente ? 'border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200' : 'border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'}`}>
          <PackageX className={`w-5 h-5 shrink-0 ${urgente ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} aria-hidden="true" />
          <p className="flex-1 font-bold leading-snug">
            {urgente
              ? `${cantidad === 1 ? '1 orden aprobada no se envió' : `${cantidad} órdenes aprobadas no se enviaron`} al inventario del almacén.`
              : `${pendientes === 1 ? '1 orden espera' : `${pendientes} órdenes esperan`} para enviarse al inventario (se reintenta sola cada 15 minutos).`}
          </p>
          <button type="button" onClick={onAbrir} className={`shrink-0 px-3 py-2 rounded-lg text-white font-black ${urgente ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>Ver</button>
        </div>
      )}
    </Colapsable>
  );
}

function Chip({ estado }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${ESTILO_ESTADO[estado] || ESTILO_ALERTA}`}>{ETIQUETA_ESTADO[estado] || estado}</span>;
}

function Detalle({ envio }) {
  return (
    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
      {ETIQUETA_ACCION[envio.accion] || 'Orden'}{envio.tecnico || envio.tecnicoOrden ? ` · ${envio.tecnico || envio.tecnicoOrden}` : ''} · {fechaHora(envio.actualizadoEn)}
    </p>
  );
}

function Serial({ serial }) {
  if (!serial) return null;
  return (
    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
      Serial: <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100 break-all">{serial}</span>
    </p>
  );
}

function TarjetaAlerta({ envio, onReintentar, onReenviarAviso, onDescartar }) {
  const [ocupado, setOcupado] = useState(false);
  const [avisando, setAvisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const motivo = envio.mensaje || TEXTO_ESTADO_ENVIO[envio.estado] || '';

  const reintentar = async () => {
    setOcupado(true);
    await onReintentar(envio);
    setOcupado(false);
  };
  const reenviarAviso = async () => {
    setAvisando(true);
    await onReenviarAviso(envio);
    setAvisando(false);
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
        <Boton variante="principal" tamano="grande" className="flex-1 min-w-[8rem]" type="button" onClick={reintentar} disabled={ocupado}>
          <RefreshCw className={`w-3.5 h-3.5 ${ocupado ? 'animate-spin' : ''}`} aria-hidden="true" /> {ocupado ? 'Enviando...' : 'Reintentar'}
        </Boton>
        {confirmando ? (
          <div className="flex-1 min-w-[8rem] flex gap-2">
            <Boton variante="principal" tamano="grande" className="flex-1" type="button" onClick={descartar} disabled={ocupado}>Sí, descartar</Boton>
            <Boton variante="secundario" tamano="grande" type="button" onClick={() => setConfirmando(false)} disabled={ocupado}>No</Boton>
          </div>
        ) : (
          <Boton variante="secundario" tamano="grande" className="flex-1 min-w-[8rem]" type="button" onClick={() => setConfirmando(true)} disabled={ocupado}>
            Descartar
          </Boton>
        )}
        <Boton variante="secundario" tamano="compacto" className="w-full" type="button" onClick={reenviarAviso} disabled={ocupado || avisando}>
          <Bell className="w-3.5 h-3.5" aria-hidden="true" /> {avisando ? 'Reenviando aviso...' : 'Reenviar aviso a la app del almacén'}
        </Boton>
      </div>
    </li>
  );
}

const unidad = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Lo que se envió de una orden, en líneas (lo mismo que se copia).
function lineasEnvio(e) {
  const lineas = [
    `${e.codigo || 'S/C'}${e.cliente ? ` — ${e.cliente}` : ''}`,
    `${ETIQUETA_ACCION[e.accion] || 'Orden'}${e.tecnico || e.tecnicoOrden ? ` · ${e.tecnico || e.tecnicoOrden}` : ''}`,
    `Estado: ${ETIQUETA_ESTADO[e.estado] || e.estado}${e.intentos ? ` (${unidad(e.intentos, 'intento', 'intentos')})` : ''}`,
  ];
  if (e.serial) lineas.push(`Serial: ${e.serial}`);
  if (e.accion !== 'cambio_equipo') lineas.push(`Material: ${e.apc || 0} APC, ${e.upc || 0} UPC, ${Number(e.dropMetros) || 0} m de drop`);
  if (e.motivo) lineas.push(`Motivo: ${e.motivo}`);
  if (e.mensaje) lineas.push(`Detalle: ${e.mensaje}`);
  lineas.push(e.enviadoEn ? `Enviado: ${fechaHora(e.enviadoEn)}` : `Actualizado: ${fechaHora(e.actualizadoEn)}`);
  return lineas;
}

function FilaReciente({ envio, onReintentar, onReenviarAviso }) {
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [avisando, setAvisando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const lineas = lineasEnvio(envio);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(lineas.join('\n'));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* sin permiso del portapapeles: el detalle sigue a la vista para copiarlo a mano */ }
  };
  const reintentar = async () => {
    setOcupado(true);
    await onReintentar(envio);
    setOcupado(false);
  };
  const reenviarAviso = async () => {
    setAvisando(true);
    await onReenviarAviso(envio);
    setAvisando(false);
  };

  return (
    <li>
      <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <div className="min-w-0">
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{envio.codigo || 'S/C'}{envio.cliente ? ` — ${envio.cliente}` : ''}</p>
          <Detalle envio={envio} />
          <Serial serial={envio.serial} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Chip estado={envio.estado} />
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden="true" />
        </div>
      </button>
      <Colapsable>
        {abierta && (
          <div className="px-3 pb-3 space-y-2">
            <dl className="rounded-lg bg-zinc-100 dark:bg-zinc-800/60 p-2.5 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-200 space-y-0.5">
              {lineas.slice(2).map((l) => <dd key={l} className="break-words">{l}</dd>)}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" tamano="compacto" type="button" onClick={copiar}>
                <ClipboardCopy className="w-3 h-3" aria-hidden="true" /> {copiado ? 'Copiado' : 'Copiar resumen'}
              </Boton>
              {ESTADOS_CON_ALERTA.includes(envio.estado) && (
                <Boton variante="secundario" tamano="compacto" type="button" onClick={reenviarAviso} disabled={avisando}>
                  <Bell className="w-3 h-3" aria-hidden="true" /> {avisando ? 'Reenviando aviso...' : 'Reenviar aviso'}
                </Boton>
              )}
              {envio.estado === 'DESCARTADO' && (
                <Boton variante="principal" tamano="compacto" type="button" onClick={reintentar} disabled={ocupado}>
                  <RefreshCw className={`w-3 h-3 ${ocupado ? 'animate-spin' : ''}`} aria-hidden="true" /> {ocupado ? 'Enviando...' : 'Reabrir y reintentar'}
                </Boton>
              )}
            </div>
          </div>
        )}
      </Colapsable>
    </li>
  );
}

const FILTROS = [
  { clave: 'TODOS', etiqueta: 'Todos', coincide: () => true },
  { clave: 'ENVIADO', etiqueta: 'Enviados', coincide: (e) => e.estado === 'ENVIADO' },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes', coincide: (e) => e.estado === 'PENDIENTE' },
  { clave: 'ALERTA', etiqueta: 'Con alerta', coincide: (e) => ESTADOS_CON_ALERTA.includes(e.estado) },
  { clave: 'DESCARTADO', etiqueta: 'Descartadas', coincide: (e) => e.estado === 'DESCARTADO' },
];
const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Módulo "Envíos al inventario" (solo para los usuarios de utils/accesoInventario): arriba, las órdenes aprobadas que no se
// pudieron descontar del inventario del almacén, con "Reintentar" (por ejemplo, después de que el almacén ingresó el serial)
// y "Descartar" (se da por resuelta sin enviar; queda guardada); abajo, la actividad reciente de los envíos.
export default function EnviosInventarioModal({ envios, pendientes = [], recientes, cargando, hayMas, onCargar, onCargarMas, onActualizar, onReintentar, onReenviarAviso, onReintentarTodas, onBuscar, onDescartar, onClose, enPagina = false }) {
  useEffect(() => { onCargar(); }, [onCargar]);
  const [filtro, setFiltro] = useState('TODOS');
  const [texto, setTexto] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [encontrados, setEncontrados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState('');
  const [reintentandoTodas, setReintentandoTodas] = useState(false);

  const porReintentar = [...envios, ...pendientes];
  const reintentarTodas = async () => {
    setReintentandoTodas(true);
    await onReintentarTodas(porReintentar);
    setReintentandoTodas(false);
  };

  // Lo ya cargado se filtra aquí, sin leer nada; lo encontrado en el historial se suma sin repetir.
  const consulta = normalizar(texto).trim();
  const coincideFiltro = FILTROS.find((f) => f.clave === filtro).coincide;
  const todos = [...recientes, ...encontrados.filter((x) => !recientes.some((r) => r.id === x.id))];
  const visibles = todos.filter((e) => coincideFiltro(e) && (!consulta || normalizar(`${e.codigo} ${e.cliente} ${e.serial} ${e.tecnico}`).includes(consulta)));

  const buscarEnHistorial = async () => {
    setBuscando(true);
    setEncontrados(await onBuscar(texto));
    setBuscado(texto.trim());
    setBuscando(false);
  };
  const puedeBuscar = Boolean(consulta) && buscado !== texto.trim();

  return (
    <Modal enPagina={enPagina} onClose={onClose} zIndexClass="z-50" completa>
      <div className={enPagina ? PANEL_PAGINA : `bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-300 dark:border-zinc-800 ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={PackageCheck} titulo="Envíos al inventario" onClose={onClose} enPagina={enPagina} />
        <div className={`p-4 space-y-5 ${CENTRADO_ESTRECHO}`}>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug">
            Cada orden aprobada que instala un equipo o usa material se descuenta del inventario del almacén. Aquí ves lo que no se pudo enviar y lo que se envió.
          </p>

          {pendientes.length > 0 && (
            <section aria-labelledby="envios-pendientes" className="space-y-2">
              <h3 id="envios-pendientes" className="text-[10px] font-bold tracking-wide text-amber-700 dark:text-amber-400 uppercase">Esperando para enviarse ({pendientes.length})</h3>
              <ul className="border border-amber-300 dark:border-amber-900/60 rounded-xl divide-y divide-amber-200 dark:divide-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
                {pendientes.map((e) => (
                  <li key={e.id} className="px-3 py-2">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{e.codigo || 'S/C'}{e.cliente ? ` — ${e.cliente}` : ''}</p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300">{unidad(e.intentos, 'intento', 'intentos')} · {e.mensaje || 'No se pudo llegar al inventario.'}</p>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Se reintentan solas cada 15 minutos.</p>
            </section>
          )}

          <section aria-labelledby="envios-por-revisar" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="envios-por-revisar" className="text-[10px] font-bold tracking-wide text-zinc-600 dark:text-zinc-400 uppercase">Por revisar ({envios.length})</h3>
              {porReintentar.length > 1 && (
                <Boton variante="principal" tamano="compacto" type="button" onClick={reintentarTodas} disabled={reintentandoTodas}>
                  <RefreshCw className={`w-3 h-3 ${reintentandoTodas ? 'animate-spin' : ''}`} aria-hidden="true" /> {reintentandoTodas ? 'Enviando...' : `Reintentar todas (${porReintentar.length})`}
                </Boton>
              )}
            </div>
            {envios.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-4 rounded-xl border border-dashed border-zinc-400 dark:border-zinc-700">No hay órdenes pendientes de revisar.</p>
            ) : (
              <ul className="space-y-2.5">
                {envios.map((e) => <TarjetaAlerta key={e.id} envio={e} onReintentar={onReintentar} onReenviarAviso={onReenviarAviso} onDescartar={onDescartar} />)}
              </ul>
            )}
          </section>

          <section aria-labelledby="envios-recientes" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="envios-recientes" className="text-[10px] font-bold tracking-wide text-zinc-600 dark:text-zinc-400 uppercase">Actividad reciente</h3>
              <Boton variante="secundario" tamano="compacto" type="button" onClick={onActualizar} disabled={cargando}>
                <RefreshCw className={`w-3 h-3 ${cargando ? 'animate-spin' : ''}`} aria-hidden="true" /> Actualizar
              </Boton>
            </div>

            <div className="flex gap-2">
              <label className="relative block flex-1 min-w-0">
                <span className="sr-only">Buscar por código, cliente, serial o técnico</span>
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Código, cliente, serial o técnico"
                  className={BUSCADOR}
                />
                <BotonLimpiarBusqueda valor={texto} onLimpiar={() => setTexto('')} />
              </label>
              <BotonFiltros abierto={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} cuenta={(filtro !== 'TODOS' ? 1 : 0)} />
            </div>
            <Colapsable>{filtersOpen && (
              <div className="rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
                {FILTROS.map((f) => (
                  <ChipFiltro activo={filtro === f.clave} tamano="compacto" key={f.clave} type="button" onClick={() => setFiltro(f.clave)}>
                    {f.etiqueta}
                  </ChipFiltro>
                ))}
              </div>
              </div>
            )}</Colapsable>

            {visibles.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center py-4">
                {recientes.length === 0 && !consulta && filtro === 'TODOS' ? 'Todavía no hay envíos registrados.' : 'Ningún envío coincide con lo cargado.'}
              </p>
            ) : (
              <ul className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800">
                {visibles.map((e) => <FilaReciente key={e.id} envio={e} onReintentar={onReintentar} onReenviarAviso={onReenviarAviso} />)}
              </ul>
            )}

            {puedeBuscar && (
              <Boton variante="secundario" tamano="grande" className="w-full" type="button" onClick={buscarEnHistorial} disabled={buscando}>
                {buscando ? 'Buscando...' : `Buscar "${texto.trim()}" como código o serial en todo el historial`}
              </Boton>
            )}
            {hayMas && (
              <Boton variante="secundario" tamano="grande" className="w-full" type="button" onClick={onCargarMas} disabled={cargando}>
                {cargando && <Spinner />}{cargando ? 'Cargando...' : 'Cargar más'}
              </Boton>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
