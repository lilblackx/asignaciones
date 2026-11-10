// El monto se escribe como en una calculadora: solo dígitos, que se llenan de derecha a izquierda y los dos últimos son los decimales ("5", "56", "569" y "56960" se ven "0,05", "0,56", "5,69" y "569,60"),
// con puntos de miles y coma para los decimales ("5.696,00"). Así nadie confunde un punto con una coma ni pierde los decimales. Sin dependencias: lo usan los campos de monto y los lectores de montos.

// Lo que se escribe en el campo -> como se ve. Todo ceros o sin dígitos queda vacío (para poder borrar); tope de once dígitos (999.999.999,99).
export function montoCalculadora(raw) {
  const digitos = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
  if (!digitos) return '';
  const centavos = digitos.padStart(3, '0');
  const entero = centavos.slice(0, -2).replace(/^0+(?=\d)/, '');
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos.slice(-2)}`;
}

// Un monto ya guardado (5696 o 5696.5) como se ve en el campo: "5.696,00" y "5.696,50". Vacío si no hay monto.
export const montoParaCampo = (monto) => (Number(monto) > 0 ? montoCalculadora(String(Math.round(Number(monto) * 100))) : '');

// El monto del campo (con puntos de miles: "5.696,00") como lo leen los lectores de montos ("5696,00"). Lo que no tiene ese formato queda como estaba (así siguen valiendo "5696,5" y "50.50").
export const montoDelCampo = (texto) => (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(String(texto ?? '').trim()) ? String(texto).trim().replace(/\./g, '') : texto);
