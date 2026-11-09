// Las lecturas pesadas de Reportes (cierres, registro de técnicos, totales mensuales) se guardan este tiempo: abrir el módulo varias veces seguidas
// no vuelve a leerlas del servidor (cada apertura costaba unas 200 lecturas). Un botón "Actualizar" las vuelve a leer en cualquier momento.
export const VIGENCIA_LECTURA_MS = 15 * 60 * 1000;

// `leidaEn`: cuándo terminó la última lectura buena (ms, 0 si no hay). Un reloj que retrocedió (leidaEn en el futuro) cuenta como vencida.
export const lecturaVigente = (leidaEn, ahora = Date.now()) => Number(leidaEn) > 0 && ahora >= leidaEn && ahora - leidaEn < VIGENCIA_LECTURA_MS;
