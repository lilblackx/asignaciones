# Asignaciones NS

PWA para el control y seguimiento de asignaciones (instalaciones, reconexiones, averías, garantías y validaciones de NAP) de una red de fibra. Las operadoras crean las órdenes, los técnicos las ejecutan y los administradores las aprueban. Cada orden genera su mensaje de WhatsApp con el formato de la plantilla.

## Funciones principales

- Órdenes con correlativo automático por tipo de trabajo, estados (pendiente, pre-finalizada, finalizada) e historial de cambios.
- Roles `ADMIN`, `USUARIO` y `TECNICO`, con permisos aplicados en `firestore.rules`.
- Autocompletado de instalaciones a partir de la plantilla que pega la promotora (`parseInstalacionTemplate` en `src/utils/whatsapp.js`).
- El ADMIN o USUARIO puede devolver una orden pre-finalizada al técnico con un motivo obligatorio (botón "Devolver" al revisar). La orden vuelve a PENDIENTE y el técnico recibe un push al instante y un aviso con el motivo, que se deduce del historial y desaparece al volver a pre-finalizar.
- Al pre-finalizar, el técnico puede elegir un "Tipo de visita" opcional: "Conector externo" (pide la nomenclatura de la NAP y el puerto en dos campos separados, que se guardan juntos en `nap` como "NAP 08 - Puerto 3") o "Conector interno". En ambos el técnico indica el tipo de conector colocado: el externo es siempre verde (ya viene marcado) y el interno es verde o azul (obligatorio); se guarda en `conectorExterno` / `conectorInterno` y se ve al aprobar y en el historial. El cobro resultante en Bs se le avisa al técnico con un aviso a pantalla completa que no se quita hasta que pulsa "Entendido" (sobrevive a recargas y cierres de la app), además del push y el recuadro en la orden. Con **conector interno** el aviso sale apenas el técnico pre-finaliza (con el monto de la visita técnica, para informárselo al cliente en el momento); con **conector externo** sale cuando se finaliza la orden. Al finalizar (al aprobar o al finalizar directo), quien finaliza elige el cobro: "Visita técnica" (el monto de siempre: monto base en EUR x tasa del momento), "Otro monto" (escrito a mano, en Bs) o "Exonerar" (no se cobra). Lo elegido se guarda en `cobroBs` (y `cobroTipo`, que vale `EXONERADO` cuando se exonera) y es lo que ve el técnico: el monto, o "No cobrar" si se exoneró. Si difiere de lo que ya vio al pre-finalizar, el aviso se le muestra de nuevo. Toda orden lleva este cobro, menos las instalaciones, sin importar el tipo de visita (averías, reconexiones, recableados...): al aprobar o finalizar, quien lo hace siempre elige "Visita técnica", "Otro monto" o "Exonerar", queda en el historial y el técnico lo ve cuando se finaliza (el modal de pre-finalizar se lo anticipa). Por eso FINALIZADO ya no se elige en el formulario de Editar (ahí no habría cobro): se finaliza con "Finalizar" o "Aprobar" de la lista. Las órdenes que se finalizaron antes de esto no tienen cobro y no muestran nada. En la pantalla del cobro, el técnico ve debajo del monto las formas de pago (pago móvil, cuentas, Zelle y Binance, con un botón para copiar cada dato y "Copiar todo"), "Copiar monto" y "Copiar monto y formas de pago", que arma el mensaje para pegarle al cliente ("Monto a cancelar: 5.696 Bs" y las formas de pago); si la visita se exoneró no se muestran. La sección viene plegada y se despliega al tocarla, y el botón "Entendido" queda fijo abajo.
- Al pre-finalizar, el botón "Ver valores" consulta la potencia de la ONU del cliente en SmartOLT (solo al presionarlo) y deja el valor de 1310 nm capturado en el campo de potencia, que el técnico aún puede corregir. Si la potencia ya tiene algo escrito, no se pisa (solo se actualiza lo que dejó la propia consulta sin que nadie lo toque); la señal de 1490 nm sí se captura. Va por `POST /onu/senal` del Worker `asignaciones-tomodat`, que lee la cédula de la propia orden con el token del técnico (solo órdenes suyas).
- Mensaje de WhatsApp por orden. Si la orden tiene coordenadas de la NAP, el mensaje termina con `*Ubicación NAP:* <enlace de Maps>`. Esto aplica a todos los tipos de orden.
- Consulta de coordenadas de NAP en Tomodat por código de NAP.
- Ubicación del cliente y enlace "cómo llegar" a la NAP.
- Tasa BCV del día y monto en Bs para el aviso de cobro.
- Instalaciones: al pre-finalizar, el técnico llena lo que la plantilla de la promotora trae vacío: serial / MAC de la ONU, VLAN, NAP y puerto del cliente, metraje del drop (metros enteros, de 1 a 9999; se escribe en la línea "Drop:" de la plantilla, con "m", solo si viene vacía), posteadura (uno o varios postes) y puertos disponibles de la NAP, en ese orden, el mismo del modal de revisión de la oficina (lo vigila `npm run test:instalacion`). El serial (de 6 a 24 letras y números, en mayúsculas, ej. `HWTC1A2B3C4D`), la VLAN (1 a 4094), la NAP, el puerto, el metraje, al menos un poste y los puertos disponibles de la NAP son obligatorios (la NAP y el puerto se ven igual que en la visita de conector externo; los puertos disponibles son texto libre, ej. `6`, y `0` si no queda ninguno). Se guardan en `instalacion` (`{ serial, vlan, posteadura: [...], nap, puerto, puertosDisponibles }`; el técnico puede escribir ese campo, ver `firestore.rules`) y la NAP también en `nap` ("NAP 08 - Puerto 3"). Las instalaciones no muestran "Tipo de visita". La plantilla que se copia (botón de WhatsApp) sigue siendo exactamente la de la promotora; lo único que cambia es que sus campos vacíos se completan con lo que llenó el técnico al pre-finalizar (antes de pre-finalizar, o si la orden vuelve al técnico, el botón copia la plantilla original con los campos vacíos; ya pre-finalizada o finalizada, la copia lleva los datos): `*Mac:*` (ahí va el serial), `*Vlan:*`, `*Posteadura:*` (los postes separados por coma), `*Nap:*`, `*Cliente conecta en el puerto N°:*` y `*PUERTOS DISPONIBLES:*`. Solo se completan los que están vacíos (lo que la promotora ya escribió se respeta, también si lo puso en la línea de abajo) y nunca se agrega ni se quita una línea: si la plantilla no trae un campo, no sale. Sin datos del técnico la plantilla sale idéntica a como siempre. La app nunca arma una plantilla por su cuenta: si una instalación o una reconexión se creó sin pegar la plantilla de la promotora, el botón de copiar queda deshabilitado ("Sin plantilla" en el celular) y avisa por qué; la plantilla se puede pegar después desde Editar (solo si falta, y queda en el historial; una que ya está pegada no se edita). Al crear la orden se avisa si no se pegó (`npm run test:instalacion` lo comprueba con la plantilla de ejemplo, letra por letra). El admin los ve al aprobar (con un icono para copiar el serial), en el historial y en el CSV.
- Prioridad alta: ADMIN y USUARIO tienen un botón (bandera) junto al código de cada orden pendiente para darle prioridad alta (campo `prioridadAlta`; se quita volviendo a tocarlo y queda en el historial). El técnico asignado la ve con una etiqueta "PRIORIDAD ALTA" y la fila/tarjeta en rojo, la lista pone esas órdenes primero (en un grupo "PRIORIDAD ALTA" arriba; si se elige otro orden —técnico, tipo o programadas— no se reordena) y le llega un aviso: push con prioridad alta (tipo `prioridad`, no requiere cambios en el Worker), aviso dentro de la app con sonido propio y entrada en la campana; si la orden se asigna ya con prioridad, el aviso de "Nueva asignación" lo dice. Con la app cerrada, el aviso al abrirla sale del punto de partida guardado en el dispositivo. El técnico no puede marcarla (reglas de Firestore). Solo cuenta mientras la orden está pendiente.
- "En camino" / "En sitio": en su orden pendiente el técnico toca "Estoy en camino" (carrito) y luego "Llegué" (o "Cancelar"; en sitio, "Deshacer"). Se guarda en `enCamino: { tecnico, desde, llegoEn }` (el técnico puede escribir ese campo, solo a su nombre; ver `firestore.rules`) y queda en el historial. La oficina (ADMIN/USUARIO) ve la etiqueta bajo el técnico, la fila/tarjeta resaltada, los chips "EN CAMINO n" / "EN SITIO n" (también filtros) y recibe aviso en la app (toast, sonido y campana); no hay push. Solo vale con la orden PENDIENTE y para su técnico; un "en camino" sin cerrar caduca a las 4 h (un "en sitio", a las 12 h) y un técnico va a una orden a la vez. Lógica en `src/utils/enCamino.js`.
- Tipo de visita "Recableado": el técnico registra los metros de cable usados (obligatorio) y, opcionalmente, un conector externo (solo verde) y/o uno interno (verde o azul). No genera cobro. Se guarda en `metrosCable`, `conectorExterno` y `conectorInterno` (el técnico puede escribir esos campos; ver `firestore.rules`).
- Tipos de visita "Cambio de equipo" y "Drop atenuado": con "Cambio de equipo" el técnico debe escribir el serial del equipo nuevo (6 a 24 letras y números, en mayúsculas, igual que el de la ONU de una instalación) y no puede pre-finalizar sin él. Se guarda en `serialEquipo` (el técnico puede escribir ese campo; ver `firestore.rules`), queda en el historial, se ve al aprobar (con un icono para copiarlo) y sale en el CSV. "Drop atenuado" solo registra el tipo de visita. Ninguno suma en Materiales.
- Revisar antes de aprobar / finalizar: el mismo modal sirve para aprobar una orden pre-finalizada (con "Devolver") y para finalizar directo una orden pendiente (sin "Devolver"); en los dos se ven los mismos datos y el mismo selector de cobro. Si una instalación no trae todos sus datos (serial, VLAN, NAP, puerto, drop, posteadura, puertos disponibles) sale un aviso rojo con lo que falta; es solo un aviso, no bloquea. Todos los botones de copiar de la app (este modal, las formas de pago y el cobro del técnico) usan `components/BotonCopiar.jsx` y `hooks/useCopiado.js`. El modal muestra arriba los datos para autorizar en SmartOLT, en dos bloques: equipo (serial o MAC, VLAN, NAP, puerto, drop, posteadura y puertos disponibles) y cliente (nombre, cédula con enlace a SmartOLT, teléfonos, dirección, ubicación, servicio y el plan que trae la plantilla de la promotora). Cada dato tiene su botón de copiar (el drop se copia solo como número) y "Copiar todo" copia todo en un texto ordenado; también se puede ver y copiar la plantilla completa. Botones de Aprobar y Devolver siempre a la vista. Lo arma `src/utils/datosAutorizacion.js`.
- Módulo "Materiales" (menú de ADMIN): metros de cable (de los recableados y el metraje de las instalaciones) y conectores (de los recableados y de las visitas de conector externo/interno; contados solo por color: verde o azul) usados en las órdenes aprobadas, en total y por técnico (salen todos los registrados, aunque estén en 0) y por período (hoy, 7 días, este mes, todo). Las visitas de conector anteriores a que se pidiera el color no suman. Suma las órdenes activas y los reportes de cierre cargados, y avisa de los recableados y visitas que aún esperan aprobación. Filtra por `finalizadoEn`, la fecha en que se finaliza la orden.
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
| `cf-worker/` | Cloudflare Worker `asignaciones-notify`: envía los pushes de FCM |
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
| `npm run test:cobro` | Pruebas del cobro que se informa al técnico (Visita técnica / Otro monto / Exonerar) |

## Despliegue

### App (Firebase Hosting)

```bash
npm run build
npx firebase deploy --only hosting
```

URL: https://seguimientons-f2026.web.app

Para publicar las reglas de Firestore: `npx firebase deploy --only firestore:rules`.

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

Las variables no secretas (`ALLOWED_ORIGINS`, `FIREBASE_PROJECT_ID`, etc.) están en cada `wrangler.toml`. Si cambia el dominio de la app, actualiza `ALLOWED_ORIGINS` en ambos workers.

Las URLs de los workers y la configuración web de Firebase están en `src/lib/firebase.js`. La configuración web de Firebase y la clave VAPID son públicas por diseño.

## Actualización en los dispositivos

`src/main.jsx` registra el Service Worker con `registerType: 'autoUpdate'`. Al detectar una versión nueva manda `SKIP_WAITING` al SW nuevo (manejado en `src/sw.js`) y recarga la página cuando la app pasa a segundo plano o vuelve a primer plano. No hace falta un hard reload.
