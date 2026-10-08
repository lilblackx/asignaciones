import { useCallback, useEffect, useRef, useState } from 'react';
import { buscarClienteSmartOlt } from '../lib/smartolt';
import { camposParaRellenar, MIN_DIGITOS_CEDULA, soloDigitos } from '../utils/clienteSmartolt';

const ESPERA_AL_ESCRIBIR_MS = 900;

// Datos del cliente desde SmartOLT al crear la orden: con la cédula completa busca
// solo (o con el botón) y llena nombre, dirección, teléfono y NAP (y la ubicación, si
// la ONU tiene GPS), pero únicamente los campos que estén vacíos. Si la cédula cambia,
// lo que se había llenado solo y nadie tocó se vuelve a vaciar, para no dejar datos de
// otro cliente. `onApply(campos)` recibe { nombre: valor, ... }; un valor '' vacía el campo.
//
// El estado se muestra con dos piezas: <ClienteSmartOltIcono> junto al campo de cédula
// (un icono de estado y el botón de volver a buscar) y <ClienteSmartOltMensaje> debajo,
// que solo escribe algo cuando no hay resultado, hay error o hay que elegir entre ONU.
//
// `autoBuscar: false` apaga la búsqueda automática (el botón sigue funcionando). Se usa
// con la plantilla de la promotora: es un cliente nuevo que aún no está en la OLT.
export function useClienteSmartOlt({ cedula, formData, onApply, autoBuscar = true }) {
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
    // Al volver a buscar con los datos ya puestos (por una búsqueda anterior), siguen
    // siendo "tomados de SmartOLT" aunque ya no haya campos vacíos que llenar.
    const yaLlenados = aplicadosRef.current?.digitos === paraDigitos ? 1 : 0;
    setEstado({ tipo: 'listo', digitos: paraDigitos, llenados: etiquetas.length || yaLlenados });
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
      if (digitos.length < MIN_DIGITOS_CEDULA || !autoBuscar) { setEstado(null); return; }
      consultar(digitos, controller.signal);
    }, digitos.length < MIN_DIGITOS_CEDULA || !autoBuscar ? 0 : ESPERA_AL_ESCRIBIR_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [digitos, autoBuscar, consultar, soltarAplicados]);

  const buscarAhora = () => {
    manualRef.current?.abort();
    manualRef.current = new AbortController();
    consultar(digitos, manualRef.current.signal);
  };

  const elegir = (onu) => aplicar(onu, digitos);

  return {
    visible: digitos.length >= MIN_DIGITOS_CEDULA,
    estado: estado && estado.digitos === digitos ? estado : null,
    buscarAhora,
    elegir,
  };
}
