import { useEffect, useState } from 'react';
import { leerNumero } from '../utils/leerNumero';
import { salidaAnimada } from '../hooks/usePresencia';

// Un número grande de un reporte que se cuenta desde 0 hasta su valor al mostrarse (y otra vez cuando el valor cambia). Entiende enteros y decimales como los
// escribe la app ("1.234", "116,50 $", "45%", "3 h") y deja tal cual lo que no es un número simple (horas "4:51:00", fechas, textos).
// Como el resto de las animaciones, solo corre en PC y se salta con "reducir movimiento"; en móvil muestra el valor directo.
const DURACION_MS = 700;

const formatear = (numero, decimales) => numero.toLocaleString('es-VE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

export default function NumeroContado({ valor, className = '' }) {
  const [anima] = useState(salidaAnimada);
  const leido = leerNumero(valor);
  const objetivo = leido ? leido.numero : null;
  const [actual, setActual] = useState({ para: valor, numero: 0 });

  useEffect(() => {
    if (!anima || objetivo === null || objetivo === 0) return undefined;
    let cuadro;
    const inicio = performance.now();
    const paso = (ahora) => {
      const avance = Math.min(1, (ahora - inicio) / DURACION_MS);
      setActual({ para: valor, numero: objetivo * (1 - (1 - avance) ** 3) });
      if (avance < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, objetivo, anima]);

  if (!anima || !leido) return <span className={className}>{valor}</span>;
  // Mientras el valor cambia, hasta el primer cuadro se muestra 0 (no el valor nuevo de golpe).
  const mostrado = actual.para === valor ? actual.numero : 0;
  // Al llegar, el valor tal como vino (sin que el formato de contar lo cambie).
  if (mostrado === objetivo) return <span className={className}>{valor}</span>;
  return (
    <span className={className}>
      <span className="sr-only">{valor}</span>
      <span aria-hidden="true">{`${formatear(Number(mostrado.toFixed(leido.decimales)), leido.decimales)}${leido.sufijo}`}</span>
    </span>
  );
}
