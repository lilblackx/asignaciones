import { useMemo, useState } from 'react';
import { Cable, ChevronDown } from 'lucide-react';
import Modal, { CENTRADO_AMPLIO, CENTRADO_ESTRECHO, PANEL_COMPLETO } from '../Modal';
import EncabezadoModulo from '../EncabezadoModulo';
import { PERIODOS, consumoPorTecnico, inicioPeriodo, totalConectores } from '../../utils/consumoMateriales';
import { aplanarArchivados } from '../../utils/reincidencia';
import { ETIQUETA_COLOR, etiquetaTipoVisita } from '../../utils/tipoVisita';
import InsigniaConector from '../InsigniaConector';
import AvisoCargarAnteriores from '../AvisoCargarAnteriores';
import Colapsable from '../Colapsable';
import Chip from '../Chip';
import { TARJETA } from '../estilos';
import Aviso from '../Aviso';
import { legible } from '../../utils/nombreTecnico';
import EstadoVacio from '../EstadoVacio';

const numero = (n) => Number(n).toLocaleString('es-VE');
const fechaCorta = (ms) => (ms ? new Date(ms).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-');

const PLURAL_COLOR = { VERDE: 'verdes', AZUL: 'azules' };

// Los conectores se cuentan solo por color (verde o azul), sin distinguir externo de interno.
// "1 conector verde", "2 conectores azules".
const textoConectores = (cantidad, color) =>
  `${cantidad} conector${cantidad === 1 ? '' : 'es'} ${cantidad === 1 ? ETIQUETA_COLOR[color].toLowerCase() : PLURAL_COLOR[color]}`;

// Cantidad de conectores de un color: la misma insignia de toda la app, apagada si no se usó ninguno.
const ChipConector = ({ color, cantidad }) => <InsigniaConector color={color} cantidad={cantidad} apagada={cantidad === 0} />;

function Conectores({ fila }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ChipConector color="VERDE" cantidad={fila.verde} />
      <ChipConector color="AZUL" cantidad={fila.azul} />
    </div>
  );
}

function Dato({ etiqueta, valor, detalle }) {
  return (
    <div className={`min-w-0 ${TARJETA} p-3`}>
      <p className="text-etiqueta font-bold text-muted-foreground">{etiqueta}</p>
      <p className="text-2xl font-black text-foreground leading-tight">{valor}</p>
      {detalle && <p className="text-etiqueta text-muted-foreground leading-snug mt-0.5">{detalle}</p>}
    </div>
  );
}

function FilaTecnico({ fila, abierto, onToggle }) {
  const idDetalle = `materiales-${fila.tecnico.replace(/\W+/g, '-')}`;
  const conDatos = fila.detalle.length > 0;
  const conectores = totalConectores(fila);
  const partes = [
    fila.ordenes > 0 && `${fila.ordenes} recableado${fila.ordenes === 1 ? '' : 's'}`,
    fila.instalaciones > 0 && `${fila.instalaciones} instalaci${fila.instalaciones === 1 ? 'ón' : 'ones'}`,
    fila.visitas > 0 && `${fila.visitas} visita${fila.visitas === 1 ? '' : 's'} de conector`,
    fila.cambiosEquipo > 0 && `${fila.cambiosEquipo} cambio${fila.cambiosEquipo === 1 ? '' : 's'} de equipo`,
    conectores > 0 && `${conectores} conector${conectores === 1 ? '' : 'es'}`,
  ].filter(Boolean);
  const resumen = (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-black text-foreground truncate">{legible(fila.tecnico)}</span>
        <span className={`shrink-0 text-lg font-black ${conDatos ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>{numero(fila.metros)} <span className="text-xs">m</span></span>
      </div>
      {conDatos ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Lo que hizo ${legible(fila.tecnico)}`}>
          {partes.map((t) => (
            <li key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-etiqueta font-bold text-foreground">{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-etiqueta text-muted-foreground">Sin movimientos en este período.</p>
      )}
      {conDatos && <Conectores fila={fila} />}
    </div>
  );
  return (
    <li className={`${TARJETA} overflow-hidden`}>
      {conDatos ? (
        <button type="button" onClick={onToggle} aria-expanded={abierto} aria-controls={idDetalle} className="w-full text-left p-3 flex items-start gap-3 hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
          {resumen}
          <ChevronDown className={`w-4 h-4 mt-1 shrink-0 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      ) : (
        <div className="p-3 flex">{resumen}</div>
      )}
      <Colapsable>
        {abierto && conDatos && (
          <ul id={idDetalle} className="border-t border-border divide-y divide-border">
            {fila.detalle.map((o) => (
              <li key={o.id} className="px-3 py-2 text-xs flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{o.codigo || 'S/C'}{o.nombre ? ` - ${o.nombre}` : ''}</p>
                  <p className="text-etiqueta text-muted-foreground">
                    {fechaCorta(o.fecha)}
                    {o.clase === 'INSTALACION' && ' · Instalación'}
                    {o.clase === 'CAMBIO_EQUIPO' && ' · Cambio de equipo'}
                    {o.clase === 'VISITA' && ` · Visita de ${etiquetaTipoVisita(o.tipo).toLowerCase()}`}
                    {o.verde > 0 && ` · ${textoConectores(o.verde, 'VERDE')}`}
                    {o.azul > 0 && ` · ${textoConectores(o.azul, 'AZUL')}`}
                    {totalConectores(o) === 0 && o.clase !== 'INSTALACION' && o.clase !== 'CAMBIO_EQUIPO' && ' · sin conectores'}
                  </p>
                  {o.serial && (
                    <p className="text-etiqueta text-muted-foreground">
                      {o.clase === 'CAMBIO_EQUIPO' ? 'Serial del equipo nuevo' : 'Serial'}: <span className="font-mono font-bold text-foreground break-all">{o.serial}</span>
                    </p>
                  )}
                </div>
                {o.metros != null && <span className="shrink-0 font-black text-foreground">{numero(o.metros)} m</span>}
                {o.metrajeExistente && <span className="shrink-0 text-xs font-bold text-muted-foreground">Drop existente</span>}
              </li>
            ))}
          </ul>
        )}
      </Colapsable>
    </li>
  );
}

// Módulo solo para ADMIN: metros de cable (recableados e instalaciones) y conectores (recableados y
// visitas de conector) usados, más los cambios de equipo, en total y por técnico (todos los registrados, aunque no hayan usado material
// en el período). Suma las órdenes activas y las ya archivadas en los reportes de cierre cargados.
// `enPagina` (almacén): el mismo contenido como pantalla completa, sin ventana ni botón de cerrar.
export default function MaterialesModal({ tickets, reports, technicians, hasMoreReports, isLoadingReports, onLoadMore, onClose, enPagina = false }) {
  const [periodo, setPeriodo] = useState('MES');
  const [abierto, setAbierto] = useState(null);

  const ordenes = useMemo(() => [...tickets, ...aplanarArchivados(reports)], [tickets, reports]);
  const nombresTecnicos = useMemo(() => technicians.map((t) => t.name), [technicians]);
  const { filas, totales, porAprobar } = useMemo(
    () => consumoPorTecnico(ordenes, { desde: inicioPeriodo(periodo), tecnicos: nombresTecnicos }),
    [ordenes, periodo, nombresTecnicos]
  );
  const porAprobarTotal = porAprobar.ordenes + porAprobar.instalaciones + porAprobar.visitas + porAprobar.cambiosEquipo;
  const textoPorAprobar = [
    porAprobar.ordenes > 0 && `${porAprobar.ordenes} recableado${porAprobar.ordenes === 1 ? '' : 's'}`,
    porAprobar.instalaciones > 0 && `${porAprobar.instalaciones} instalaci${porAprobar.instalaciones === 1 ? 'ón' : 'ones'}`,
    porAprobar.visitas > 0 && `${porAprobar.visitas} visita${porAprobar.visitas === 1 ? '' : 's'} de conector`,
    porAprobar.cambiosEquipo > 0 && `${porAprobar.cambiosEquipo} cambio${porAprobar.cambiosEquipo === 1 ? '' : 's'} de equipo`,
  ].filter(Boolean).join(', ') + (porAprobar.metros > 0 ? ` (${numero(porAprobar.metros)} m de cable)` : '');

  const contenido = (
        <div className={`p-4 sm:p-6 space-y-4 ${enPagina ? CENTRADO_AMPLIO : CENTRADO_ESTRECHO}`}>
          <p className="text-xs text-muted-foreground max-w-4xl max-sm:hidden">Metros de cable y conectores usados en los recableados, las instalaciones y las visitas de conector ya aprobados, en total y por técnico. Las instalaciones y los cambios de equipo se listan con su serial.</p>

          <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <Chip activo={periodo === p.id} tamano="compacto" key={p.id} type="button" onClick={() => setPeriodo(p.id)}>
                {p.etiqueta}
              </Chip>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
            <Dato etiqueta="Metros de cable" valor={`${numero(totales.metros)} m`} />
            <Dato etiqueta="Recableados" valor={numero(totales.ordenes)} />
            <Dato etiqueta="Instalaciones" valor={numero(totales.instalaciones)} />
            <Dato etiqueta="Visitas de conector" valor={numero(totales.visitas)} />
            <Dato etiqueta="Cambios de equipo" valor={numero(totales.cambiosEquipo)} />
            <Dato etiqueta="Conectores" valor={numero(totalConectores(totales))} detalle={`Verde ${totales.verde} · Azul ${totales.azul}`} />
          </div>

          {porAprobarTotal > 0 && (
            <Aviso nivel="atencion" compact>
              {textoPorAprobar} espera{porAprobarTotal === 1 ? '' : 'n'} aprobación y todavía no se suma{porAprobarTotal === 1 ? '' : 'n'}.
            </Aviso>
          )}

          {filas.length === 0 ? (
            <EstadoVacio compacto titulo="Sin materiales en este período">No hay recableados, instalaciones, visitas de conector ni cambios de equipo aprobados. Se suman cuando la oficina aprueba la orden; prueba con un rango más amplio.</EstadoVacio>
          ) : (
            <section aria-labelledby="materiales-por-tecnico" className="space-y-2">
              <h3 id="materiales-por-tecnico" className="text-sm font-black text-foreground">Por técnico</h3>
              <ul className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3 items-start">
                {filas.map((fila) => (
                  <FilaTecnico key={fila.tecnico} fila={fila} abierto={abierto === fila.tecnico} onToggle={() => setAbierto(abierto === fila.tecnico ? null : fila.tecnico)} />
                ))}
              </ul>
            </section>
          )}

          <div className="text-etiqueta text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>Incluye las órdenes activas y {reports.length} reporte{reports.length === 1 ? '' : 's'} de cierre cargado{reports.length === 1 ? '' : 's'}.</span>
          </div>
          <AvisoCargarAnteriores variante="reporte" hayMas={hasMoreReports} cargando={isLoadingReports} onCargar={onLoadMore} />
        </div>
  );

  // Como pantalla del almacén o del administrador (`enPagina`) es el contenido de la página, sin ventana ni encabezado propio (ya lo pone la app).
  const tarjeta = enPagina ? contenido : (
      <div className={`bg-card rounded-card shadow-2xl w-full border border-border max-w-2xl max-h-[92dvh] overflow-y-auto ${PANEL_COMPLETO}`}>
        <EncabezadoModulo Icono={Cable} titulo="Materiales" onClose={onClose} />
        {contenido}
      </div>
  );

  return enPagina ? tarjeta : <Modal onClose={onClose} zIndexClass="z-50" completa>{tarjeta}</Modal>;
}
