import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { buscarClienteSmartOlt } from '../../lib/smartolt';
import { camposParaRellenar, MIN_DIGITOS_CEDULA, soloDigitos } from '../../utils/clienteSmartolt';

const ESPERA_AL_ESCRIBIR_MS = 900;

// Datos del cliente desde SmartOLT al crear la orden: con la cédula completa busca
// solo (o con el botón) y llena nombre, dirección, teléfono, NAP y ubicación, pero
// únicamente los campos que estén vacíos. Si la cédula cambia, lo que se había
// llenado solo y nadie tocó se vuelve a vaciar, para no dejar datos de otro cliente.
// `onApply(campos)` recibe { nombre: valor, ... }; un valor '' vacía el campo.
export default function ClienteSmartOltField({ cedula, formData, onApply, wrapperClassName }) {
  const digitos = soloDigitos(cedula);
  const [estado, setEstado] = useState(null);
  const formRef = useRef(formData);
  const onApplyRef = useRef(onApply);
  const aplicadosRef = useRef(null); // { digitos, campos } de lo llenado automáticamente
  const manualRef = useRef(null);

  useEffect(() => {
    formRef.current = formData;
    onApplyRef.current = onApply;
  });

  const soltarAplicados = useCallback((paraDigitos) => {
    const previo = aplicadosRef.current;
    if (!previo || previo.digitos === paraDigitos) return;
    const intactos = Object.fromEntries(Object.entries(previo.campos).filter(([nombre, valor]) => formRef.current?.[nombre] === valor).map(([nombre]) => [nombre, '']));
    if (Object.keys(intactos).length > 0) onApplyRef.current(intactos);
    aplicadosRef.current = null;
  }, []);

  const aplicar = useCallback((onu, paraDigitos) => {
    const { campos, etiquetas } = camposParaRellenar(onu, paraDigitos, formRef.current);
    if (Object.keys(campos).length > 0) {
      onApplyRef.current(campos);
      aplicadosRef.current = { digitos: paraDigitos, campos };
    }
    setEstado({ tipo: 'listo', digitos: paraDigitos, etiquetas });
  }, []);

  const consultar = useCallback(async (paraDigitos, signal) => {
    const busqueda = {};
    setEstado({ tipo: 'buscando', digitos: paraDigitos, busqueda });
    try {
      const resultados = await buscarClienteSmartOlt(paraDigitos, signal);
      if (resultados.length === 0) setEstado({ tipo: 'vacio', digitos: paraDigitos });
      else if (resultados.length === 1) aplicar(resultados[0], paraDigitos);
      else setEstado({ tipo: 'opciones', digitos: paraDigitos, opciones: resultados });
    } catch (err) {
      if (err.name !== 'AbortError') setEstado({ tipo: 'error', digitos: paraDigitos, mensaje: err.message });
      else setEstado((actual) => (actual?.busqueda === busqueda ? null : actual));
    }
  }, [aplicar]);

  // Busca sola al dejar de escribir una cédula completa. Todo ocurre dentro del
  // temporizador (también el reseteo con una cédula corta o cambiada).
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      soltarAplicados(digitos);
      if (digitos.length < MIN_DIGITOS_CEDULA) { setEstado(null); return; }
      consultar(digitos, controller.signal);
    }, digitos.length < MIN_DIGITOS_CEDULA ? 0 : ESPERA_AL_ESCRIBIR_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [digitos, consultar, soltarAplicados]);

  const buscarAhora = () => {
    manualRef.current?.abort();
    manualRef.current = new AbortController();
    consultar(digitos, manualRef.current.signal);
  };

  const mensaje = estado && estado.digitos === digitos ? estado : null;
  if (digitos.length < MIN_DIGITOS_CEDULA) return null;

  return (
    <div className={wrapperClassName}>
      <div className="flex items-center gap-2 ml-1">
        <button type="button" onClick={buscarAhora} disabled={mensaje?.tipo === 'buscando'} className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 dark:text-violet-400 hover:underline disabled:opacity-60">
          {mensaje?.tipo === 'buscando' ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Search className="w-3 h-3" aria-hidden="true" />} Buscar cliente en SmartOLT
        </button>
        {mensaje?.tipo === 'buscando' && <span role="status" className="text-[10px] text-zinc-500">Buscando...</span>}
      </div>
      {mensaje?.tipo === 'listo' && (
        <p role="status" className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 ml-1">
          {mensaje.etiquetas.length > 0 ? 'Datos tomados de SmartOLT' : 'Cliente encontrado en SmartOLT (no había campos vacíos que llenar)'}
        </p>
      )}
      {mensaje?.tipo === 'vacio' && <p role="status" className="text-[10px] font-bold text-amber-700 dark:text-amber-400 ml-1">No se encontró un cliente con esta cédula en SmartOLT.</p>}
      {mensaje?.tipo === 'error' && <p role="alert" className="text-[10px] font-bold text-red-600 dark:text-red-400 ml-1">{mensaje.mensaje} Llena los datos a mano.</p>}
      {mensaje?.tipo === 'opciones' && (
        <div role="group" aria-label="Varias ONU con esta cédula, elige una" className="flex flex-wrap gap-1 ml-1 mt-0.5">
          <span className="w-full text-[10px] font-bold text-amber-700 dark:text-amber-400">Varias ONU con esta cédula, elige una:</span>
          {mensaje.opciones.map((onu) => (
            <button key={onu.idExterno || onu.nombre} type="button" onClick={() => aplicar(onu, digitos)} className="text-[10px] font-bold px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors text-left">
              {onu.nombre || 'Sin nombre'}{onu.zona ? ` · ${onu.zona}` : ''}{onu.direccion ? ` · ${onu.direccion}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
