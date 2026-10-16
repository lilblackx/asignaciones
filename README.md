# Asignaciones NS

PWA para el control y seguimiento de asignaciones (instalaciones, reconexiones, averías, garantías y validaciones de NAP) de una red de fibra. Las operadoras crean las órdenes, los técnicos las ejecutan y los administradores las aprueban. Cada orden genera su mensaje de WhatsApp con el formato de la plantilla.

## Funciones principales

- Órdenes con correlativo automático por tipo de trabajo, estados (pendiente, pre-finalizada, finalizada) e historial de cambios.
- Roles `ADMIN`, `USUARIO` y `TECNICO`, con permisos aplicados en `firestore.rules`. Hay dos roles de solo lectura, cada uno con su propia pantalla (`src/Root.jsx` decide cuál según el rol; con esos roles la app de oficina y técnicos ni se monta):
  - `ALMACEN`: solo ve Materiales (el mismo módulo del admin, a pantalla completa, PC y celular). Lee las órdenes, los reportes y los técnicos, pero no puede escribir nada. Para gastar pocas lecturas de Firestore no usa listeners en vivo: lee al abrir y al tocar "Actualizar" (o al volver a la pestaña tras 10 min), solo las órdenes FINALIZADO y PRE-FINALIZADO, solo los reportes de cierre y, al actualizar, solo los reportes nuevos (`useDatosAlmacen`; necesita el índice de `firestore.indexes.json`, y mientras no exista cae a una consulta sin filtro de tipo).
  - `PROMOTORA` (se muestra como "Ventas"; el valor guardado en el perfil sigue siendo `PROMOTORA`): ve solo las instalaciones de su promotor, no averías, con un estado en palabras claras (Sin técnico asignado, Programada, Asignada, Técnico en camino, Técnico en el sitio, Instalada en revisión, Instalada y Cancelada), filtros y buscador por nombre, cédula o código, y en cada tarjeta el promotor. No ve cobros, datos técnicos, teléfono ni observaciones. El promotor de una instalación sale de la línea "Promotor:" / "Promotora:" de la plantilla (`parseInstalacionTemplate`), se guarda en la orden como `promotora` (nombre ordenado) y `promotoraClave` (sin tildes, minúsculas), es obligatorio en toda instalación (al crearla y al editarla; el formulario no deja guardar con el campo vacío, con espacios o con "N/A", y el guardado lo vuelve a comprobar; las averías no lo piden) y se corrige en el campo "Promotor" de Crear y Editar, y las instalaciones anteriores se completan solas desde su plantilla cuando entra un ADMIN (`useCompletarPromotoras`). Cada usuario PROMOTOR tiene en su perfil `promotoraNombres` / `promotoraClaves` (hasta 5 nombres, con los que aparece en las plantillas; se escriben al crearlo en Usuarios y se cambian con el lápiz de su fila) y las reglas solo le dejan leer las instalaciones y el historial cuya `promotoraClave` esté entre las suyas; sin nombres no ve nada. Las instalaciones sin promotor en la plantilla (o con "N/A") no las ve ningún promotor. Las activas llegan en vivo (una consulta por nombre); las ya cerradas salen de `historialInstalaciones`, un resumen liviano (código, nombre, cédula, dirección, técnico, estado, promotor y fechas) que el cierre del día —manual y automático— guarda y limpia a los 15 días (lo que ve ventas, `RETENCION_DIAS_HISTORIAL_VENTAS`, y la misma constante en el Worker); cada promotora ve solo los últimos 7 (`RETENCION_DIAS_HISTORIAL`) y el perfil de ventas los 15. Se lee una vez y se guarda una copia 30 min en el equipo. Cada instalación finalizada lleva el botón "Ver plantilla": la plantilla final ya llena por el técnico (`textoPlantillaFinal`), para leerla y copiarla; al finalizar se guarda en la orden como `plantillaFinal` y el cierre del día la copia al historial (en el Worker solo se copia, sin repetir la lógica de la plantilla). Un perfil PROMOTOR con "Ver todas las instalaciones" (`verTodasInstalaciones` en su perfil, lo marca el ADMIN) ve las de todas las promotoras y además las averías de tipo LOS (falla `LOS`), solo lectura. Ese perfil elige entre "Todo", "Instalaciones" y "LOS"; las LOS siguen los mismos estados y filtros (con las palabras "Resuelta" y "Atendida, en revisión"), pasan al historial de 7 días al cerrar el día y no tienen plantilla. Las promotoras normales no ven averías.
- Autocompletado de instalaciones a partir de la plantilla que pega la promotora (`parseInstalacionTemplate` en `src/utils/whatsapp.js`). El teléfono se lee aunque venga con el guion "no separable" (U+2011) que escribe WhatsApp en los números, o con rayas: se guarda con un guion normal.
- El teléfono del cliente es obligatorio en todas las órdenes, nuevas y existentes: se exige al crearlas y al editarlas (ADMIN y USUARIO; si la orden es vieja y no lo tiene, hay que escribirlo para poder guardar la edición). Al menos un número, de hasta tres. Los técnicos no editan el teléfono, así que pre-finalizar no se les bloquea. Lo comprueban el formulario y, otra vez, el guardado (`createTicket` y `updateTicket`); `firestore.rules` no valida campos, igual que con el nombre y la dirección.
- El ADMIN o USUARIO puede devolver una orden pre-finalizada al técnico con un motivo obligatorio (botón "Devolver" al revisar). La orden vuelve a PENDIENTE y el técnico recibe un push al instante y un aviso con el motivo, que se deduce del historial y desaparece al volver a pre-finalizar.
- Al pre-finalizar, el técnico puede elegir un "Tipo de visita" opcional: "Conector externo" (pide la nomenclatura de la NAP y el puerto en dos campos separados, que se guardan juntos en `nap` como "NAP 08 - Puerto 3") o "Conector interno". En ambos el técnico escribe cuántos conectores usó de cada color (con botones − y + o escribiendo): en el externo, solo verdes (al menos 1); en el interno, verdes y/o azules (al menos 1 en total); máximo 10 por color (`MAX_CONECTORES_POR_COLOR`). Se guarda en `conectoresUsados: { verde, azul }` (y, si se usó un solo color, también en `conectorExterno` / `conectorInterno`), y se ve al aprobar, en el historial y en el Excel (columnas "Conectores verdes" y "Conectores azules"). Las visitas anteriores, que solo guardaron el color, cuentan como 1 conector de ese color. El cobro resultante en Bs se le avisa al técnico con un aviso a pantalla completa que no se quita hasta que pulsa "Entendido" (sobrevive a recargas y cierres de la app), además del push y el recuadro en la orden. Con **conector interno** el aviso sale apenas el técnico pre-finaliza (con el monto de la visita técnica, para informárselo al cliente en el momento); con **conector externo** sale cuando se finaliza la orden. Al finalizar (al aprobar o al finalizar directo), quien finaliza elige el cobro: "Visita técnica" (el monto de siempre: monto base en EUR x tasa del momento), "Otro monto" (escrito a mano, en Bs) o "Exonerar" (no se cobra). Lo elegido se guarda en `cobroBs` (y `cobroTipo`, que vale `EXONERADO` cuando se exonera) y es lo que ve el técnico: el monto, o "No cobrar" si se exoneró. Si difiere de lo que ya vio al pre-finalizar, el aviso se le muestra de nuevo. Toda orden lleva este cobro, menos las instalaciones, sin importar el tipo de visita (averías, reconexiones, recableados...): al aprobar o finalizar, quien lo hace siempre elige "Visita técnica", "Otro monto" o "Exonerar", queda en el historial y el técnico lo ve cuando se finaliza (el modal de pre-finalizar se lo anticipa). Por eso FINALIZADO ya no se elige en el formulario de Editar (ahí no habría cobro): se finaliza con "Finalizar" o "Aprobar" de la lista. Las órdenes que se finalizaron antes de esto no tienen cobro y no muestran nada. En la pantalla del cobro, el técnico ve debajo del monto las formas de pago (pago móvil, cuentas, Zelle y Binance, con un botón para copiar cada dato y "Copiar todo"), "Copiar monto" y "Copiar monto y formas de pago", que arma el mensaje para pegarle al cliente ("Monto a cancelar: 5.696 Bs" y las formas de pago); si la visita se exoneró no se muestran. La sección viene plegada y se despliega al tocarla, y el botón "Entendido" queda fijo abajo.
- Al pre-finalizar, el botón "Ver valores" consulta la potencia de la ONU del cliente en SmartOLT (solo al presionarlo) y deja el valor de 1310 nm capturado en el campo de potencia, que el técnico aún puede corregir. Si la potencia ya tiene algo escrito, no se pisa (solo se actualiza lo que dejó la propia consulta sin que nadie lo toque); la señal de 1490 nm sí se captura. Va por `POST /onu/senal` del Worker `asignaciones-tomodat`, que lee la cédula de la propia orden con el token del técnico (solo órdenes suyas).
- Mensaje de WhatsApp por orden. Si la orden tiene coordenadas de la NAP, el mensaje termina con `*Ubicación NAP:* <enlace de Maps>`. Esto aplica a todos los tipos de orden.
- Consulta de coordenadas de NAP en Tomodat por código de NAP.
- Ubicación del cliente y enlace "cómo llegar" a la NAP.
- Tasa BCV del día y monto en Bs para el aviso de cobro.
- Instalaciones: al pre-finalizar, el técnico llena lo que la plantilla de la promotora trae vacío: serial de la ONU, VLAN, NAP y puerto del cliente, metraje del drop (metros enteros, de 1 a 9999; se escribe en la línea "Drop:" de la plantilla, con "m", solo si viene vacía), posteadura (uno o varios postes) y puertos disponibles de la NAP, en ese orden, el mismo del modal de revisión de la oficina (lo vigila `npm run test:instalacion`). El serial (de 6 a 24 letras y números, en mayúsculas, ej. `HWTC1A2B3C4D`), la VLAN (1 a 4094), la NAP, el puerto, el metraje, al menos un poste y los puertos disponibles de la NAP son obligatorios (la NAP y el puerto se ven igual que en la visita de conector externo; los puertos disponibles son texto libre, ej. `6`, y `0` si no queda ninguno). Se guardan en `instalacion` (`{ serial, vlan, posteadura: [...], nap, puerto, puertosDisponibles }`; el técnico puede escribir ese campo, ver `firestore.rules`) y la NAP también en `nap` ("NAP 08 - Puerto 3"). Las instalaciones no muestran "Tipo de visita". La plantilla que se copia (botón de WhatsApp) sigue siendo exactamente la de la promotora; lo único que cambia es que sus campos vacíos se completan con lo que llenó el técnico al pre-finalizar (antes de pre-finalizar, o si la orden vuelve al técnico, el botón copia la plantilla original con los campos vacíos; ya pre-finalizada o finalizada, la copia lleva los datos): `*Mac:*` (ahí va el serial), `*Vlan:*`, `*Posteadura:*` (los postes separados por coma), `*Nap:*`, `*Cliente conecta en el puerto N°:*` y `*PUERTOS DISPONIBLES:*`. Solo se completan los que están vacíos (lo que la promotora ya escribió se respeta, también si lo puso en la línea de abajo) y nunca se agrega ni se quita una línea: si la plantilla no trae un campo, no sale. Sin datos del técnico la plantilla sale idéntica a como siempre. La app nunca arma una plantilla por su cuenta: si una instalación o una reconexión se creó sin pegar la plantilla de la promotora, el botón de copiar queda deshabilitado ("Sin plantilla" en el celular) y avisa por qué; la plantilla se puede pegar después desde Editar (solo si falta, y queda en el historial; una que ya está pegada no se edita). Al crear la orden se avisa si no se pegó (`npm run test:instalacion` lo comprueba con la plantilla de ejemplo, letra por letra). El admin los ve al aprobar (con un icono para copiar el serial), en el historial y en el CSV.
- Prioridad alta: ADMIN y USUARIO tienen un botón (bandera) junto al código de cada orden pendiente para darle prioridad alta (campo `prioridadAlta`; se quita volviendo a tocarlo y queda en el historial). El técnico asignado la ve con una etiqueta "PRIORIDAD ALTA" y la fila/tarjeta en rojo, la lista pone esas órdenes primero (en un grupo "PRIORIDAD ALTA" arriba; si se elige otro orden —técnico, tipo o programadas— no se reordena) y le llega un aviso: push con prioridad alta (tipo `prioridad`, no requiere cambios en el Worker), aviso dentro de la app con sonido propio y entrada en la campana; si la orden se asigna ya con prioridad, el aviso de "Nueva asignación" lo dice. Con la app cerrada, el aviso al abrirla sale del punto de partida guardado en el dispositivo. El técnico no puede marcarla (reglas de Firestore). Solo cuenta mientras la orden está pendiente.
- "En camino" / "En sitio": en su orden pendiente el técnico toca "Estoy en camino" (carrito) y luego "Llegué" (o "Cancelar"; en sitio, "Deshacer"). Se guarda en `enCamino: { tecnico, desde, llegoEn }` (el técnico puede escribir ese campo, solo a su nombre; ver `firestore.rules`) y queda en el historial. La oficina (ADMIN/USUARIO) ve la etiqueta bajo el técnico, la fila/tarjeta resaltada, los chips "EN CAMINO n" / "EN SITIO n" (también filtros) y recibe aviso en la app (toast, sonido y campana); no hay push. Solo vale con la orden PENDIENTE y para su técnico; un "en camino" sin cerrar caduca a las 4 h (un "en sitio", a las 12 h) y un técnico va a una orden a la vez. Lógica en `src/utils/enCamino.js`.
- Tipo de visita "Recableado": el técnico registra los metros de cable usados (obligatorio) y, opcionalmente, un conector externo (solo verde) y/o uno interno (verde o azul). No genera cobro. Se guarda en `metrosCable`, `conectorExterno` y `conectorInterno` (el técnico puede escribir esos campos; ver `firestore.rules`).
- Tipos de visita "Cambio de equipo" y "Drop atenuado": con "Cambio de equipo" el técnico debe escribir el serial del equipo nuevo (6 a 24 letras y números, en mayúsculas, igual que el de la ONU de una instalación; además debe ser el de la etiqueta, con la misma verificación verde/rojo de la instalación, ver "Serial de la ONU y del equipo nuevo" más abajo) y no puede pre-finalizar sin él. Se guarda en `serialEquipo` (el técnico puede escribir ese campo; ver `firestore.rules`), queda en el historial, se ve al aprobar (con un icono para copiarlo) y sale en el CSV. "Drop atenuado" solo registra el tipo de visita. Ninguno suma en Materiales.
- Revisar antes de aprobar / finalizar: el mismo modal sirve para aprobar una orden pre-finalizada (con "Devolver") y para finalizar directo una orden pendiente (sin "Devolver"); en los dos se ven los mismos datos y el mismo selector de cobro. Si una instalación no trae todos sus datos (serial, VLAN, NAP, puerto, drop, posteadura, puertos disponibles) sale un aviso rojo con lo que falta; es solo un aviso, no bloquea. Todos los botones de copiar de la app (este modal, las formas de pago y el cobro del técnico) usan `components/BotonCopiar.jsx` y `hooks/useCopiado.js`. El modal muestra arriba los datos para autorizar en SmartOLT, en dos bloques: equipo (serial, VLAN, NAP, puerto, drop, posteadura y puertos disponibles) y cliente (nombre, cédula con enlace a SmartOLT, teléfonos, dirección, ubicación, servicio y el plan que trae la plantilla de la promotora). Cada dato tiene su botón de copiar (el drop se copia solo como número) y "Copiar todo" copia todo en un texto ordenado; también se puede ver y copiar la plantilla completa. Botones de Aprobar y Devolver siempre a la vista. Lo arma `src/utils/datosAutorizacion.js`.
- Módulo "Materiales" (menú de ADMIN): metros de cable (de los recableados y el metraje de las instalaciones) y conectores (de los recableados y de las visitas de conector externo/interno; contados solo por color, verde o azul, y sumando las cantidades que escribió el técnico) usados en las órdenes aprobadas, en total y por técnico (salen todos los registrados, aunque estén en 0) y por período (hoy, 7 días, este mes, todo). Las visitas de conector anteriores a que se pidiera el color no suman. Las instalaciones también piden al pre-finalizar los conectores usados, obligatorios (al menos 1): cantidad de externos (solo verde) e internos (verde y azul), que se guardan en `instalacion.conectores`, se ven en el bloque "Conectores colocados" de la revisión y en el historial, y en Materiales cuentan solo por color; las instalaciones anteriores no los tienen y no se bloquean al aprobarlas. No aparecen en la plantilla de WhatsApp. Suma las órdenes activas y los reportes de cierre cargados, y avisa de los recableados y visitas que aún esperan aprobación. Filtra por `finalizadoEn`, la fecha en que se finaliza la orden.
- Envío al inventario del otro sistema (Telecom, un Firebase aparte): al aprobar o finalizar una orden que instala un equipo o usa material, el Worker `asignaciones-notify` la envía a su inventario (`cf-worker/src/inventario.js`; qué se envía y cómo lo decide `src/utils/envioInventario.js`, la misma lógica para la app y el Worker). Instalación -> `instalacion_nueva` (el drop en metros y los conectores, verde = APC y azul = UPC, y el serial de la ONU pasa a "Instalado" en su inventario); cambio de equipo -> `cambio_equipo` (solo el serial del equipo nuevo); recableado y visita de conector -> `averia` (solo material, con el motivo "Recableado - Orden #1234" pegado al nombre del cliente). Cada orden se envía una sola vez: el registro de material lleva un id fijo sacado de la orden y las dos escrituras (material y equipo) van en un solo commit, así que reenviar nunca descuenta dos veces. Solo se descuenta (y pasa a "Instalado") el equipo que figura "Con Técnico" en su inventario, es decir, el que ya tiene asignado un técnico; si el serial no existe, o el equipo sigue "En Almacén" (o en otro estado), o ya figura instalado a otro cliente, o la orden no trae serial, no se envía nada de la orden y queda una alerta. El estado de cada envío vive en `telecomEnvios/{id de la orden}` (ENVIADO, PENDIENTE, SERIAL_NO_ENCONTRADO, SERIAL_YA_INSTALADO, EQUIPO_NO_ASIGNADO, SIN_SERIAL, ERROR, DESCARTADO). Al aprobar, la app deja una marca mínima "pendiente" (sin datos de la orden: el Worker lee la orden él mismo) y llama al Worker; si esa llamada no llega, el cron (cada 15 minutos) la recoge, y también reintenta lo que falló por red o por clave (máximo 4 intentos, luego ERROR). El módulo "Envíos al inventario" (menú, con las alertas por revisar, "Reintentar", "Descartar" —queda guardada como DESCARTADO— y la actividad reciente), el aviso en la pantalla principal y los avisos push son solo del usuario `lfernandez` (`USUARIOS_INVENTARIO` en `src/utils/accesoInventario.js`; las reglas de Firestore y el Worker lo exigen también). Solo se envían las órdenes aprobadas desde que se activó. Sin los secretos `TELECOM_EMAIL` y `TELECOM_PASSWORD` el envío está apagado.
- Serial de la ONU y del equipo nuevo: el técnico escribe el de la caja o la etiqueta y el campo se marca en verde ("Serial correcto.") o en rojo con el motivo; el rojo bloquea el pre-finalizar (también al guardar, en `useTickets`). Es correcto el PON S/N de la etiqueta (`VSOL00E65D25`, `BTPTDD004F58`, `TPLGBDAA8DE0`: 4 letras y 8 caracteres hexadecimales) o la forma de caja con `GPON` delante. Es error `GOPN` (el `GPON` al revés), la MAC y lo que no tiene ese formato. La regla está en `src/utils/serialOlt.js`. El almacén guarda el serial como lo ve la OLT, así que al enviar se convierte (solo en el envío; la orden y la línea `*Mac:*` de la plantilla conservan lo que escribió el técnico): `GPONBTPTDD9BA588` -> `BTPTDD9BA588` (BT-PON: `GPON` + serial en texto) y `GPON54504C47BDA9EC40` -> `TPLGBDA9EC40` (TP-Link: `GPON` + el fabricante en ASCII hexadecimal, `54504C47` = `TPLG`, + 8 caracteres); el PON S/N de V-SOL y BT-PON se envía igual. No se calcula desde la MAC. Lo que no encaja se envía como está y el almacén responde "serial no encontrado". En Editar orden, el ADMIN ve lo mismo en las órdenes finalizadas, más "Se enviará al almacén como: ..." (solo aviso). Lo cubre `npm run test:edicion`.
- Corregir lo que cargó el técnico (Editar orden, ADMIN y USUARIO, órdenes pre-finalizadas o finalizadas): una sección "Datos que cargó el técnico" con el serial, la VLAN, la NAP y el puerto, el metraje, los postes, los puertos disponibles y los conectores de una instalación; en las demás órdenes, el tipo de visita y sus datos (metros y conectores del recableado, cantidades de una visita de conector, serial del equipo nuevo). Lo escrito debe ser válido y lo que la orden ya tenía no se puede dejar vacío; lo que nunca tuvo (instalaciones anteriores al metraje y a los conectores) puede seguir vacío. Si no se toca la sección, no se valida ni se guarda nada de ella. Cada cambio queda en el historial ("Serial: ..."), y llega a la plantilla y a Materiales. Un envío al inventario que ya quedó ENVIADO no se reenvía ni se revierte: el cambio solo corrige la app. En cambio, "Reintentar" y el cron envían lo que dice la orden ahora (solo si la orden ya se archivó usan lo guardado del envío), así que corregir un serial tras una alerta y reintentar envía el correcto. Lógica en `src/utils/edicionDatosTecnico.js`, pruebas con `npm run test:edicion` y `npm run test:inventario`.
- Formas de pago (pago móvil, cuentas bancarias, Zelle y Binance): el ADMIN las carga en la pestaña "Formas de pago" del modal "Tasa y pagos" y el técnico las copia, dato por dato, desde el botón "Pagos".
- Reportes y exportación, carga de trabajo por técnico, detección de reincidencias.
- Notificaciones: en vivo dentro de la app (Firestore) y push (FCM) con la app cerrada.
  - El push sale con prioridad alta (Android no lo retrasa en reposo) y con un `tag` por evento, para no duplicar avisos.
  - Quien asigna o devuelve una orden ve un aviso si el técnico no tiene notificaciones activas en ningún dispositivo, o si el envío falló tras reintentar.
  - Un banner pide activar las notificaciones (el permiso lo debe pedir un toque, no la carga) y avisa si están bloqueadas.
  - Al cerrar sesión el dispositivo se desvincula del perfil; los tokens que FCM da por muertos (`UNREGISTERED`) se borran solos.
  - Al abrir la app se avisa de lo que cambió con ella cerrada (órdenes nuevas, devueltas, aprobadas), aunque el push no haya llegado (referencia guardada en el dispositivo, vigente 3 días).
  - Tocar un aviso (campana o push del sistema) abre la orden o la acción correspondiente.
- Instalable como PWA. Se actualiza sola: revisa versión nueva cada 15 min y la aplica al volver a la app o si está en segundo plano.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `src/` | App React (componentes, hooks, `lib/` para Firebase y Tomodat, `utils/` con la lógica de negocio) |
| `src/sw.js` | Service Worker propio: precache (Workbox) y push de FCM en segundo plano |
| `cf-worker/` | Cloudflare Worker `asignaciones-notify`: envía los pushes de FCM, hace el cierre automático y expone la API de Materiales (`src/materiales-api.js`) |
| `cf-worker-tomodat/` | Cloudflare Worker `asignaciones-tomodat`: consulta NAP en Tomodat |
| `firestore.rules` | Reglas de seguridad de Firestore |
| `scripts/` | Seed del emulador y pruebas de las reglas |

## Stack

React 19, Vite 8, Tailwind CSS 4, Firebase (Auth, Firestore, Hosting, Cloud Messaging), `vite-plugin-pwa` con Workbox, Cloudflare Workers.

## Requisitos

- Node.js 20.19 o superior (o 22.12+)
- Firebase CLI (`npx firebase`) con acceso al proyecto `seguimientons-f2026`
- Wrangler (se instala con las dependencias de cada worker) para desplegar los workers

## Desarrollo

```bash
npm install
npm run dev
```

La app corre en `http://localhost:5173`. Ese origen ya está permitido en los workers.

### Emuladores de Firebase

Por defecto la app apunta al proyecto real. Para usar los emuladores:

1. Crea `.env.development.local` con `VITE_USE_EMULATORS=true`. Este archivo no se sube al repo.
2. Inicia los emuladores: `npm run emulators`
3. Carga datos de prueba: `npm run seed:emulator`

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build local |
| `npm run lint` | ESLint |
| `npm run emulators` | Emuladores de Auth y Firestore |
| `npm run seed:emulator` | Datos de prueba en el emulador |
| `npm run test:rules` | Pruebas de `firestore.rules` |
| `npm run test:notify` | Pruebas del Worker de notificaciones (FCM y Firestore simulados) |
| `npm run test:recableado` | Pruebas del tipo de visita Recableado y del consumo de materiales |
| `npm run test:autorizacion` | Pruebas de los datos para autorizar una instalación en SmartOLT (equipo, cliente, plan de la plantilla y el texto de "Copiar todo") |
| `npm run test:encamino` | Pruebas de "en camino" / "en sitio" (estado del viaje, caducidad, un viaje a la vez y aviso a la oficina) |
| `npm run test:prioridad` | Pruebas de la prioridad alta (quién cuenta, orden de la lista y aviso al técnico) |
| `npm run test:instalacion` | Pruebas de los datos de la instalación (serial, VLAN, posteadura, NAP, puerto, puertos disponibles) y de cómo se escriben en la plantilla |
| `npm run test:equipo` | Pruebas del tipo de visita "Cambio de equipo" (serial del equipo nuevo) y "Drop atenuado" |
| `npm run test:edicion` | Pruebas de la corrección de los datos del técnico desde Editar orden (qué se valida y se guarda, historial) y del serial (conversión a formato OLT y verificación verde/rojo) |
| `npm run test:cobro` | Pruebas del cobro que se informa al técnico (Visita técnica / Otro monto / Exonerar) |
| `npm run test:inventario` | Pruebas del envío al inventario del otro sistema (qué se envía de cada tipo de orden, serial inexistente, no duplicar, reintentos, permisos y acceso exclusivo) con los dos Firebase simulados |
| `npm run test:materiales` | Pruebas de la API de Materiales (llave, período en hora de Venezuela y que los números coincidan con la pantalla) |
| `npm run test:roles` | Pruebas de los roles ALMACÉN y PROMOTORA (estados que ve la promotora, resumen del historial, aislamiento de la app actual y lecturas de Firestore) |
| `npm run test:telefono` | Pruebas del teléfono obligatorio de la orden (crear, editar y guardar) y de los guiones de WhatsApp en los números |

## Despliegue

### App (Firebase Hosting)

```bash
npm run build
npx firebase deploy --only hosting
```

URL: https://seguimientons-f2026.web.app

Para publicar las reglas de Firestore: `npx firebase deploy --only firestore:rules`. El índice de reportes (`firestore.indexes.json`, usado por la pantalla de almacén) se publica con `npx firebase deploy --only firestore:indexes` y tarda unos minutos en construirse.

### Workers (Cloudflare)

Cada worker se despliega desde su carpeta:

```bash
cd cf-worker            # o cf-worker-tomodat
npm install
npx wrangler deploy
```

Secretos. No van en el repo ni en `wrangler.toml`:

| Worker | Secreto | Comando |
| --- | --- | --- |
| `cf-worker` | `FIREBASE_SERVICE_ACCOUNT_JSON` | `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON` |
| `cf-worker-tomodat` | `TOMODAT_TOKEN` | `npx wrangler secret put TOMODAT_TOKEN` |
| `cf-worker` | `TELECOM_EMAIL` y `TELECOM_PASSWORD` (usuario con que el Worker entra al inventario del otro sistema; sin ellos el envío está apagado) | `npx wrangler secret put TELECOM_EMAIL` y `npx wrangler secret put TELECOM_PASSWORD` |
| `cf-worker` | `MATERIALES_API_KEY` (llave de la API de Materiales; sin ella la API responde 503) | `npx wrangler secret put MATERIALES_API_KEY` |

Las variables no secretas (`ALLOWED_ORIGINS`, `FIREBASE_PROJECT_ID`, etc.) están en cada `wrangler.toml`. Si cambia el dominio de la app, actualiza `ALLOWED_ORIGINS` en ambos workers.

Las URLs de los workers y la configuración web de Firebase están en `src/lib/firebase.js`. La configuración web de Firebase y la clave VAPID son públicas por diseño.

### API de Materiales (para otra aplicación)

Guía completa para quien la consume (conexión, parámetros, todos los campos, errores y ejemplos): [docs/API-MATERIALES.md](docs/API-MATERIALES.md).

Solo lectura, en el Worker `asignaciones-notify`: `GET https://<worker>.workers.dev/api/materiales`. Devuelve lo mismo que la pantalla de Materiales (el cálculo es `consumoPorTecnico` de `src/utils/consumoMateriales.js`, importado por el Worker, así que nunca difieren): metros de cable y conectores por color de los recableados, instalaciones y visitas de conector ya aprobados, más los cambios de equipo (que no gastan material) con el serial del equipo nuevo y las instalaciones con el serial de la ONU, en total y por técnico (con todos los técnicos registrados, aunque no hayan usado material), más lo pre-finalizado que espera aprobación (`porAprobar`, no suma).

- Autenticación: la llave del secreto `MATERIALES_API_KEY`, en `Authorization: Bearer <llave>` o `X-API-Key`. Va solo en el servidor de la otra aplicación (la API no abre CORS para navegadores). Para rotarla se vuelve a ejecutar `wrangler secret put`.
- Período, en hora de Venezuela: `?periodo=HOY|SEMANA|MES` (por defecto `MES`) o `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` (ambos días incluidos; máximo 93 días por consulta porque cada reporte de cierre es un documento grande).
- `?detalle=0` quita la lista de órdenes de cada técnico (código, cliente, fecha, clase, metros, conectores) y deja solo el resumen.
- Respuesta (`version: 1`): `periodo`, `totales`, `porAprobar` y `tecnicos[]` (`tecnico`, `metros`, `recableados`, `instalaciones`, `visitasConector`, `cambiosEquipo`, `conectores {verde, azul, total}` y `ordenes[]`, cada una con su `serial`). Errores: 400 (parámetros), 401 (llave), 405 (no GET), 503 (API apagada), 500.
- Lecturas de Firestore: la API lee con la cuenta de servicio del Worker, y cada documento leído se cobra. Para gastar lo mínimo: la respuesta de cada período se guarda 5 minutos en memoria del Worker (`CACHE_TTL_MS`; la cabecera `X-Cache` dice `HIT` o `MISS`), las llamadas simultáneas iguales comparten una lectura, los técnicos se guardan 30 minutos, las órdenes FINALIZADO y PRE-FINALIZADO van en una sola consulta, solo se piden los campos que usa el cálculo (`select`) y de los reportes de cierre solo los del período. Una llamada sin copia cuesta: las órdenes aprobadas y por aprobar que haya en la tabla, un reporte por cada cierre del período y los técnicos; con copia, 0. Los números pueden ir hasta 5 minutos atrasados. La copia es por instancia del Worker (no se comparte), así que la otra aplicación debería guardar también el resultado en vez de consultar en cada vista.
- Prueba: `npm run test:materiales`.

## Próximas actualizaciones

### Limpieza de `telecomEnvios`

Cada orden enviada deja un documento pequeño en `telecomEnvios` y hoy no se borra ninguno (es el historial del módulo "Envíos al inventario"). Si algún día estorba, el cierre automático del Worker puede borrar los ENVIADO y DESCARTADO de más de, por ejemplo, 90 días, igual que ya limpia `historialInstalaciones`.

### Resumen diario de materiales (menos lecturas de Firestore)

Hoy la API de Materiales (y la pantalla de Materiales del almacén) leen los reportes de cierre completos: cada uno es un documento grande con todas las órdenes del día dentro, y es lo que más pesa en un período largo. Si el costo lo justifica, la mejora grande es precalcular el material:

- Al cerrar el día (cierre manual en `useReports.cerrarDia` y cierre automático en `cierreAutomatico` del Worker `cf-worker`), guardar un documento liviano por cierre, p. ej. en `materialesDiarios/{fecha}`, con lo que ya calcula `consumoPorTecnico`: por técnico, metros, recableados, instalaciones, visitas de conector y conectores verde/azul, más la lista corta de órdenes (código, cliente, fecha, clase, metros, conectores) si se quiere el detalle. Sin plantillas, teléfonos ni direcciones.
- La API leería un documento chico por día en vez de reportes enteros, y sumaría esos días con las órdenes activas de hoy (que siguen saliendo de `tickets`). Un mes pasaría de ~30 documentos grandes a ~30 chicos, y se podría quitar el tope de 93 días.
- Hace falta llenar los días anteriores una sola vez a partir de los reportes que ya existen (un script con la cuenta de servicio, parecido a `scripts/revisar-promotores.mjs`).
- Cuidado: la lógica de cálculo está en `src/utils/consumoMateriales.js`; el Worker ya la importa, así que ambos cierres deben usar esa misma función para que el resumen nunca difiera de la pantalla. Si un cierre se corrige o se rehace, el resumen de ese día se vuelve a escribir (mismo id de documento).
- Reglas de Firestore: lectura solo para ADMIN y ALMACÉN, escritura solo desde el cliente que cierra (ADMIN) y el Worker; hay que agregarlas en `firestore.rules` y cubrirlas en `npm run test:rules`.

Otros pasos más pequeños, si hicieran falta antes: compartir la copia de la API entre instancias con un KV de Cloudflare (como `CATALOGO` en `cf-worker-tomodat`), y aplicar la misma idea de copia a la pantalla de Materiales (`useDatosAlmacen`).

## Actualización en los dispositivos

`src/main.jsx` registra el Service Worker con `registerType: 'autoUpdate'`. Al detectar una versión nueva manda `SKIP_WAITING` al SW nuevo (manejado en `src/sw.js`) y recarga la página cuando la app pasa a segundo plano o vuelve a primer plano. No hace falta un hard reload.
