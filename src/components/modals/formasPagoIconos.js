import { Bitcoin, CircleDollarSign, Landmark, Smartphone } from 'lucide-react';
import { TIPO_BINANCE, TIPO_CUENTA, TIPO_PAGO_MOVIL, TIPO_ZELLE } from '../../utils/formasPago';

// Icono de cada tipo de forma de pago (lo usan el editor del ADMIN y la vista del técnico).
export const ICONO_POR_TIPO = {
  [TIPO_PAGO_MOVIL]: Smartphone,
  [TIPO_CUENTA]: Landmark,
  [TIPO_ZELLE]: CircleDollarSign,
  [TIPO_BINANCE]: Bitcoin,
};
