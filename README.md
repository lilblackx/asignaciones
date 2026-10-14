# Asignaciones NS

PWA para el control y seguimiento de asignaciones (instalaciones, reconexiones, averías, garantías y validaciones de NAP) de una red de fibra. Las operadoras crean las órdenes, los técnicos las ejecutan y los administradores las aprueban. Cada orden genera su mensaje de WhatsApp con el formato de la plantilla.

## Funciones principales

- Órdenes con correlativo automático por tipo de trabajo, estados (pendiente, pre-finalizada, finalizada) e historial de cambios.
- Roles `ADMIN`, `USUARIO` y `TECNICO`, con permisos aplicados en `firestore.rules`.
- Autocompletado de instalaciones a partir de la plantilla que pega la promotora (`parseInstalacionTemplate` en `src/utils/whatsapp.js`).
- El ADMIN o USUARIO puede devolver una orden pre-finalizada al técnico con un motivo obligatorio (botón "Devolver" al revisar). La orden vuelve a PENDIENTE y el técnico recibe un push al instante y un aviso con el motivo, que se deduce del historial y desaparece al volver a pre-finalizar.
- Al pre-finalizar, el técnico puede elegir un "Tipo de visita" opcional: "Conector externo" (pide la nomenclatura de la NAP y el puerto en dos campos separados, que se guardan juntos en `nap` como "NAP 08 - Puerto 3") o "Conector interno". El cobro resultante en Bs se le avisa al técnico con un aviso a pantalla completa que no se quita hasta que pulsa "Entendido" (sobrevive a recargas y cierres de la app), además del push y el recuadro en la orden. Con **conector interno** el aviso sale apenas el técnico pre-finaliza (con el monto de la visita técnica, para informárselo al cliente en el momento); con **conector externo** sale cuando se finaliza la orden. Al finalizar (al aprobar o al finalizar directo), quien finaliza elige el cobro: "Visita técnica" (el monto de siempre: monto base en EUR x tasa del momento), "Otro monto" (escrito a mano, en Bs) o "Exonerar" (no se cobra). Lo elegido se guarda en `cobroBs` (y `cobroTipo`, que vale `EXONERADO` cuando se exonera) y es lo que ve el técnico: el monto, o "No cobrar" si se exoneró. Si difiere de lo que ya vio al pre-finalizar, el aviso se le muestra de nuevo.
- Al pre-finalizar, el botón "Ver valores" consulta la potencia de la ONU del cliente en SmartOLT (solo al presionarlo) y deja el valor de 1310 nm capturado en el campo de potencia, que el técnico aún puede corregir. Va por `POST /onu/senal` del Worker `asignaciones-tomodat`, que lee la cédula de la propia orden con el token del técnico (solo órdenes suyas).
- Mensaje de WhatsApp por orden. Si la orden tiene coordenadas de la NAP, el mensaje termina con `*Ubicación NAP:* <enlace de Maps>`. Esto aplica a todos los tipos de orden.
- Consulta de coordenadas de NAP en Tomodat por código de NAP.
- Ubicación del cliente y enlace "cómo llegar" a la NAP.
- Tasa BCV del día y monto en Bs para el aviso de cobro.
- Tipo de visita "Recableado": el técnico registra los metros de cable usados (obligatorio) y, opcionalmente, un conector externo (solo verde) y/o uno interno (verde o azul). No genera cobro. Se guarda en `metrosCable`, `conectorExterno` y `conectorInterno` (el técnico puede escribir esos campos; ver `firestore.rules`).
- Módulo "Materiales" (menú de ADMIN): metros de cable y conectores (contados solo por color: verde o azul) usados en los recableados aprobados, en total y por técnico (salen todos los registrados, aunque estén en 0) y por período (hoy, 7 días, este mes, todo). Suma las órdenes activas y los reportes de cierre cargados, y avisa de los recableados que aún esperan aprobación. Filtra por `finalizadoEn`, la fecha en que se finaliza la orden.
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
