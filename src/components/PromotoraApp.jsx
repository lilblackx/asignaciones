import { useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { etiquetaRol } from '../constants';
import { useToast } from '../hooks/useToast';
import { useAhora } from '../hooks/useAhora';
import { useInstalacionesPromotora } from '../hooks/useInstalacionesPromotora';
import { useHistorialInstalaciones } from '../hooks/useHistorialInstalaciones';
import { ORDEN_ESTADOS_PROMOTORA, RETENCION_DIAS_HISTORIAL, RETENCION_DIAS_HISTORIAL_VENTAS, categoriaOrden, etiquetaFiltroEstado, textoPlantillaFinal, unirInstalaciones } from '../utils/estadoInstalacion';
import Toast from './Toast';
import EncabezadoSimple from './EncabezadoSimple';
import TarjetaInstalacion from './TarjetaInstalacion';
import PlantillaFinalModal from './modals/PlantillaFinalModal';
import { promotoraDeOrden } from '../utils/whatsapp';

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Pantalla de la PROMOTORA: todas las instalaciones y en qué van. Solo lectura; no ve averías, cobros ni datos técnicos.
export default function PromotoraApp({ auth }) {
  const { firebaseUser, currentUserName, currentUser, role, handleLogout, promotoraClaves, promotoraNombres, verTodasInstalaciones } = auth;
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { toastMsg, setToastMsg } = useToast();
  const ahora = useAhora();
  // Solo ve las instalaciones de su promotora (los nombres que el administrador le asignó). Sin nombres no ve nada,
  // salvo el perfil de ventas (`verTodasInstalaciones`), que ve las de todas las promotoras.
  const sinNombre = !verTodasInstalaciones && promotoraClaves.length === 0;
  const { tickets, cargado, error } = useInstalacionesPromotora(firebaseUser, promotoraClaves, verTodasInstalaciones);
  const historial = useHistorialInstalaciones(firebaseUser, promotoraClaves, verTodasInstalaciones);
  const [filtro, setFiltro] = useState('TODAS');
  // Solo ventas (ve todas) trabaja con instalaciones y averías LOS: elige ver las dos juntas, solo instalaciones o solo LOS.
  const [categoria, setCategoria] = useState('TODO');
  const vista = verTodasInstalaciones ? categoria : 'INSTALACION';
  const [busqueda, setBusqueda] = useState('');
  // Instalación finalizada cuya plantilla se está viendo (se guarda la orden; el texto se arma al mostrarla).
  const [plantillaDe, setPlantillaDe] = useState(null);

  // Copia el texto y avisa con el toast (devuelve si pudo, para el visto del botón).
  const copiar = async (texto, mensaje) => {
    try {
      await navigator.clipboard.writeText(texto);
      setToastMsg({ type: 'success', text: mensaje });
      return true;
    } catch {
      setToastMsg({ type: 'error', text: 'No se pudo copiar la plantilla.' });
      return false;
    }
  };

  const todas = useMemo(() => unirInstalaciones(tickets, historial, ahora), [tickets, historial, ahora]);
  const cuantasPorCategoria = useMemo(() => todas.reduce((acc, o) => ({ ...acc, [categoriaOrden(o)]: (acc[categoriaOrden(o)] || 0) + 1 }), {}), [todas]);
  // Lo que se ve según el selector de arriba; los filtros de estado, el conteo y el buscador trabajan sobre esto.
  const ordenes = useMemo(() => (vista === 'TODO' ? todas : todas.filter((o) => categoriaOrden(o) === vista)), [todas, vista]);
  const conteo = useMemo(() => ordenes.reduce((acc, o) => ({ ...acc, [o.vista.clave]: (acc[o.vista.clave] || 0) + 1 }), {}), [ordenes]);
  const visibles = useMemo(() => {
    const q = sinTildes(busqueda).trim();
    return ordenes.filter((o) => (filtro === 'TODAS' || o.vista.clave === filtro)
      && (!q || sinTildes(`${o.nombre} ${o.cedula} ${o.codigo} ${verTodasInstalaciones ? promotoraDeOrden(o) : ''}`).includes(q)));
  }, [ordenes, filtro, busqueda, verTodasInstalaciones]);

  const chip = (clave, texto, n) => (
    <button
      key={clave}
      type="button"
      aria-pressed={filtro === clave}
      onClick={() => setFiltro(clave)}
      className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-colors ${filtro === clave ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'}`}
    >
      {texto} <span className="opacity-80">({n})</span>
    </button>
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
        <Toast toastMsg={toastMsg} onClose={() => setToastMsg(null)} />
        <EncabezadoSimple titulo={verTodasInstalaciones ? 'Instalaciones y LOS' : 'Instalaciones'} icono={Building2} nombre={currentUserName || currentUser} rol={etiquetaRol(role)} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} handleLogout={handleLogout} />

        <main className="p-4 max-w-[1400px] mx-auto w-full flex-1 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              aria-label={verTodasInstalaciones ? 'Buscar por nombre, cédula, código o promotor' : 'Buscar por nombre, cédula o código'}
              placeholder={verTodasInstalaciones ? 'Buscar nombre, cédula, código o promotor' : 'Buscar nombre, cédula o código'}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 pl-9 pr-3 py-2.5 rounded-xl text-sm focus:ring-0 focus:border-red-600 outline-none"
            />
          </div>

          {verTodasInstalaciones && (
            <div role="group" aria-label="Qué órdenes ver" className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-200 dark:bg-zinc-900 md:max-w-xl">
              {[
                ['TODO', 'Todo', todas.length],
                ['INSTALACION', 'Instalaciones', cuantasPorCategoria.INSTALACION || 0],
                ['LOS', 'LOS', cuantasPorCategoria.LOS || 0],
              ].map(([clave, texto, n]) => (
                <button
                  key={clave}
                  type="button"
                  aria-pressed={categoria === clave}
                  onClick={() => { setCategoria(clave); setFiltro('TODAS'); }}
                  className={`px-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${categoria === clave ? 'bg-white dark:bg-zinc-700 text-red-600 dark:text-red-400 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                >
                  {texto} <span className="opacity-80">({n})</span>
                </button>
              ))}
            </div>
          )}

          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
            {chip('TODAS', 'Todas', ordenes.length)}
            {ORDEN_ESTADOS_PROMOTORA.filter((c) => conteo[c]).map((c) => chip(c, etiquetaFiltroEstado(c, vista), conteo[c]))}
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{visibles.length} de {ordenes.length} {vista === 'LOS' ? 'averías LOS' : vista === 'TODO' ? 'órdenes' : 'instalaciones'}</p>

          {sinNombre ? (
            <p role="alert" className="text-sm text-amber-700 dark:text-amber-400 text-center py-10 max-w-md mx-auto">Tu usuario todavía no tiene un nombre de promotor asignado, por eso no ves instalaciones. Pídele al administrador que lo agregue en Usuarios.</p>
          ) : error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center py-10">No se pudieron cargar las instalaciones. Revisa tu conexión e intenta de nuevo.</p>
          ) : !cargado ? (
            <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">Cargando instalaciones...</p>
          ) : visibles.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">{ordenes.length === 0 ? (vista === 'LOS' ? 'Todavía no hay averías LOS.' : vista === 'TODO' ? 'Todavía no hay órdenes.' : 'Todavía no hay instalaciones.') : 'Ninguna orden coincide con la búsqueda.'}</p>
          ) : (
            <ul className="grid gap-2.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {visibles.map((o) => <TarjetaInstalacion key={o.id} orden={o} onVerPlantilla={setPlantillaDe} mostrarTipo={verTodasInstalaciones} />)}
            </ul>
          )}

          <p className="text-[10px] text-zinc-400 text-center pt-2">
            {verTodasInstalaciones ? <>Ves las instalaciones de todas las promotoras y las averías LOS. </> : promotoraNombres.length > 0 && <>Ves las instalaciones de: {promotoraNombres.join(', ')}. </>}
            Las terminadas o canceladas se muestran durante {verTodasInstalaciones ? RETENCION_DIAS_HISTORIAL_VENTAS : RETENCION_DIAS_HISTORIAL} días.
          </p>
        </main>

        {plantillaDe && <PlantillaFinalModal orden={plantillaDe} texto={textoPlantillaFinal(plantillaDe)} onCopy={copiar} onClose={() => setPlantillaDe(null)} />}
      </div>
    </div>
  );
}
