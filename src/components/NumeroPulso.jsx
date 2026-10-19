import { useState } from 'react';

// Un número que da un pequeño pulso cuando cambia, para notar que algo se movió sin mirar fijo. No pulsa al mostrarse por primera vez.
export default function NumeroPulso({ valor, className = '' }) {
  const [anterior, setAnterior] = useState(valor);
  const [cambios, setCambios] = useState(0);
  if (valor !== anterior) {
    setAnterior(valor);
    setCambios(cambios + 1);
  }
  return <span key={cambios} className={`inline-block ${cambios > 0 ? 'animate-pulso-numero' : ''} ${className}`}>{valor}</span>;
}
