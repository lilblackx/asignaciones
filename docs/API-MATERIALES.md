# API de Materiales

API de solo lectura con la información del módulo de Materiales de la app de asignaciones: metros de cable y conectores usados por los técnicos, en total y por técnico.

Es la misma información y el mismo cálculo de la pantalla de Materiales de la app, así que los números coinciden.

## Datos de conexión

| | |
| --- | --- |
| URL base | `https://asignaciones-notify.soportenetworkspeed.workers.dev` |
| Endpoint | `GET /api/materiales` |
| Autenticación | la llave de API, en `Authorization: Bearer <llave>` o en `X-API-Key: <llave>` |
| Formato | JSON, UTF-8 |
| Navegador (CORS) | no permitido: la llamada debe salir del servidor de la otra aplicación, nunca del navegador, para no exponer la llave |

La llave se entrega aparte, por un canal seguro. Guárdala como secreto o variable de entorno en tu aplicación; no la pongas en el código ni en el repositorio.

## Parámetros

Todos son opcionales.

| Parámetro | Valores | Por defecto | Qué hace |
| --- | --- | --- | --- |
| `periodo` | `HOY`, `SEMANA`, `MES` | `MES` | Período relativo a hoy. `SEMANA` son los últimos 7 días contando hoy; `MES` empieza el día 1 del mes en curso. |
| `desde` | `AAAA-MM-DD` | — | Primer día de un rango propio. Si se envía `desde` (o `hasta`), `periodo` se ignora. |
| `hasta` | `AAAA-MM-DD` | hoy | Último día del rango, incluido completo. |
| `detalle` | `0` | detalle incluido | Con `0` se omite la lista `ordenes` de cada técnico y queda solo el resumen (respuesta mucho más corta). |

- Las fechas y los límites de los períodos son en **hora de Venezuela** (UTC-4, `America/Caracas`).
- Un rango (`desde`/`hasta`) puede abarcar como máximo **93 días**. Para períodos más largos, pedirlo por partes (p. ej. mes por mes) y sumar.
- Cualquier otro valor de `periodo` (por ejemplo `TODO`) da error 400.

Ejemplos:

```
GET /api/materiales
GET /api/materiales?periodo=HOY
GET /api/materiales?periodo=SEMANA&detalle=0
GET /api/materiales?desde=2026-10-01&hasta=2026-10-15
```

## Qué cuenta y qué no

- Cuenta el material de las órdenes **FINALIZADAS** (ya aprobadas), activas o archivadas en los reportes de cierre del día.
- Una orden entra en el período según su fecha de finalización (`finalizadoEn`) o, si no la tiene, la de creación.
- Las **PRE-FINALIZADAS** (esperan aprobación) no se suman: se informan aparte en `porAprobar`.
- Tipos de orden que gastan material:
  - **Recableado:** metros de cable y los conectores que se hayan marcado (uno por cada conector puesto).
  - **Instalación:** el metraje de cable y los conectores que registró el técnico (externos e internos, sumados por color). Las instalaciones anteriores a que se pidiera el metraje no lo tienen y no suman; las anteriores a que se pidieran los conectores cuentan 0 conectores.
  - **Visita de conector** (externo o interno): las cantidades de conectores por color que escribió el técnico. Las visitas antiguas que solo guardaron el color cuentan como 1 conector de ese color. Una visita de conector no gasta cable.
  - **Cambio de equipo:** no gasta cable ni conectores; se cuenta y se lista con el serial del equipo nuevo (`serial`). Los cambios de equipo anteriores a que se pidiera el serial salen con `serial` en `null`.
- Las instalaciones también traen su `serial` (el de la ONU instalada); las anteriores a que se guardara salen con `null`.
- Los conectores se cuentan solo por color (`verde` o `azul`), sin distinguir externo de interno. El verde es el conector **APC** y el azul es el **UPC**.
- El material se descuenta cuando la orden está **FINALIZADA**, no cuando el técnico la pre-finaliza. Hasta entonces aparece en `porAprobar` y no debe descontarse.
- Para registrar el gasto en otro sistema, `recableado` (`clase: RECABLEADO`) y `visita de conector` (`clase: VISITA`) se asientan como **Avería**, con el motivo "Recableado" o "Visita de conector".
- Una orden que aparezca dos veces (activa y archivada) se cuenta una sola vez.
- La lista `tecnicos` trae **todos los técnicos registrados**, aunque no hayan usado material (con ceros), de más a menos metros y luego por conectores. Si hay órdenes sin técnico, aparece una fila `SIN TÉCNICO`.

## Respuesta (200)

Ejemplo (con `detalle` incluido, recortado):

```json
{
  "version": 1,
  "generadoEn": "2026-10-15T16:00:00.000Z",
  "periodo": {
    "id": "MES",
    "desde": "2026-10-01T04:00:00.000Z",
    "hasta": "2026-10-15T16:00:00.000Z",
    "zonaHoraria": "America/Caracas"
  },
  "totales": {
    "metros": 175,
    "recableados": 2,
    "instalaciones": 1,
    "visitasConector": 1,
    "cambiosEquipo": 1,
    "conectores": { "verde": 3, "azul": 1, "total": 4 }
  },
  "porAprobar": { "recableados": 1, "instalaciones": 0, "visitasConector": 0, "cambiosEquipo": 0, "metros": 30 },
  "tecnicos": [
    {
      "tecnico": "GERARDO MOLERO",
      "metros": 160,
      "recableados": 1,
      "instalaciones": 1,
      "visitasConector": 0,
      "cambiosEquipo": 0,
      "conectores": { "verde": 1, "azul": 0, "total": 1 },
      "ordenes": [
        {
          "id": "R1",
          "codigo": "R1",
          "cliente": "Cliente R1",
          "fecha": "2026-10-15T15:00:00.000Z",
          "clase": "RECABLEADO",
          "tipoVisita": "RECABLEADO",
          "serial": null,
          "metros": 40,
          "conectores": { "verde": 1, "azul": 0, "total": 1 }
        },
        {
          "id": "I1",
          "codigo": "I1",
          "cliente": "Cliente I1",
          "fecha": "2026-10-13T15:00:00.000Z",
          "clase": "INSTALACION",
          "tipoVisita": null,
          "serial": "HWTC1A2B3C4D",
          "metros": 120,
          "conectores": { "verde": 0, "azul": 0, "total": 0 }
        }
      ]
    },
    {
      "tecnico": "SIN USO",
      "metros": 0,
      "recableados": 0,
      "instalaciones": 0,
      "visitasConector": 0,
      "cambiosEquipo": 0,
      "conectores": { "verde": 0, "azul": 0, "total": 0 },
      "ordenes": []
    }
  ]
}
```

### Todos los campos

**Raíz**

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `version` | número | Versión del formato (hoy `1`). Cambia solo si se rompe la compatibilidad. |
| `generadoEn` | texto ISO 8601 (UTC) | Cuándo se calculó esta respuesta. Puede tener hasta 5 minutos de antigüedad (ver "Actualización de los datos"). |
| `periodo` | objeto | Período que se calculó. |
| `totales` | objeto | Suma de todos los técnicos. |
| `porAprobar` | objeto | Lo pre-finalizado del período que aún no se suma. |
| `tecnicos` | lista | Una fila por técnico. |

**`periodo`**

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | texto | `HOY`, `SEMANA`, `MES` o `PERSONALIZADO` (cuando se usó `desde`/`hasta`). |
| `desde` | texto ISO 8601 (UTC) | Inicio del período (medianoche de Venezuela). |
| `hasta` | texto ISO 8601 (UTC) | Fin del período (ahora, o el final del día `hasta`). |
| `zonaHoraria` | texto | Siempre `America/Caracas`. |

**`totales`** y cada elemento de **`tecnicos`** (el técnico añade `tecnico` y `ordenes`)

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `tecnico` | texto | Nombre del técnico, en mayúsculas como está registrado (solo en `tecnicos`). |
| `metros` | número | Metros de cable usados (recableados + instalaciones). |
| `recableados` | número | Cantidad de recableados aprobados. |
| `instalaciones` | número | Cantidad de instalaciones aprobadas con metraje. |
| `visitasConector` | número | Cantidad de visitas de conector aprobadas. |
| `cambiosEquipo` | número | Cantidad de cambios de equipo aprobados. |
| `conectores` | objeto | `{ verde, azul, total }`: conectores usados por color y en total (recableados + visitas de conector). |
| `ordenes` | lista | Detalle de las órdenes que suman, de la más nueva a la más vieja (solo en `tecnicos` y sin `detalle=0`). |

**`porAprobar`**

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `recableados` | número | Recableados pre-finalizados del período. |
| `instalaciones` | número | Instalaciones pre-finalizadas con metraje. |
| `visitasConector` | número | Visitas de conector pre-finalizadas. |
| `cambiosEquipo` | número | Cambios de equipo pre-finalizados. |
| `metros` | número | Metros de cable de los recableados e instalaciones pre-finalizados. |

**Cada elemento de `ordenes`**

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | texto | Identificador interno de la orden. |
| `codigo` | texto | Código de la orden (puede ser vacío). |
| `cliente` | texto | Nombre del cliente de la orden (puede ser vacío). |
| `fecha` | texto ISO 8601 (UTC) | Cuándo se usó el material (finalización de la orden). |
| `clase` | texto | `RECABLEADO`, `INSTALACION`, `CAMBIO_EQUIPO` o `VISITA` (visita de conector). |
| `tipoVisita` | texto o `null` | `RECABLEADO`, `CONECTOR_EXTERNO`, `CONECTOR_INTERNO` o `CAMBIO_EQUIPO`; `null` en las instalaciones. |
| `serial` | texto o `null` | Serial del equipo: el de la ONU en una instalación y el del equipo nuevo en un cambio de equipo. `null` en recableados y visitas de conector, y si no se registró. |
| `metros` | número o `null` | Metros de cable de la orden; `null` en una visita de conector y en un cambio de equipo (no gastan cable). |
| `conectores` | objeto | `{ verde, azul, total }` de esa orden. |

Todos los conteos son enteros; `metros` son metros enteros.

Datos que la API **no** envía: teléfonos, cédulas, direcciones, plantillas, cobros, potencias de la ONU ni nada más de la orden. De la orden solo salen el código, el nombre del cliente (`cliente`) y el serial del equipo (`serial`); si la otra aplicación no los necesita, conviene pedir `detalle=0`.

## Errores

Siempre en JSON: `{ "error": "mensaje" }`.

| Código | Cuándo |
| --- | --- |
| 400 | Parámetro inválido: fecha mal escrita o inexistente, `hasta` anterior a `desde`, rango de más de 93 días, `periodo` desconocido. |
| 401 | Falta la llave o es incorrecta (con cabecera `WWW-Authenticate: Bearer`). |
| 405 | Se usó un método distinto de `GET`. |
| 500 | No se pudo leer la información (falla de Firestore). Reintentar más tarde. |
| 503 | La API no está habilitada por el momento. Contactar al administrador. |

## Ejemplos de uso

curl:

```bash
curl -H "Authorization: Bearer $MATERIALES_API_KEY" \
  "https://asignaciones-notify.soportenetworkspeed.workers.dev/api/materiales?periodo=MES"
```

Node.js (servidor):

```js
const res = await fetch(
  'https://asignaciones-notify.soportenetworkspeed.workers.dev/api/materiales?desde=2026-10-01&hasta=2026-10-15',
  { headers: { Authorization: `Bearer ${process.env.MATERIALES_API_KEY}` } },
);
if (!res.ok) throw new Error(`Materiales respondió ${res.status}: ${(await res.json()).error}`);
const { totales, tecnicos } = await res.json();
```

Python:

```python
import os, requests

r = requests.get(
    "https://asignaciones-notify.soportenetworkspeed.workers.dev/api/materiales",
    params={"periodo": "SEMANA", "detalle": "0"},
    headers={"Authorization": f"Bearer {os.environ['MATERIALES_API_KEY']}"},
    timeout=30,
)
r.raise_for_status()
datos = r.json()
```

## Actualización de los datos y buenas prácticas

- El Worker guarda cada respuesta **5 minutos**; la cabecera `X-Cache` indica `HIT` (copia) o `MISS` (recién calculada). Los números pueden ir hasta 5 minutos atrasados; `generadoEn` dice de cuándo son.
- Cada consulta sin copia le cuesta lecturas a Firestore. Lo recomendable es que la otra aplicación **guarde el resultado** y lo refresque cada 5 a 15 minutos (o una vez al día para períodos cerrados), en vez de llamar en cada pantalla o petición de un usuario.
- Las órdenes del día pasan a los reportes de cierre cuando se cierra el día, así que un período ya terminado no cambia (salvo correcciones).
- Para historiales largos, pedir por meses (`desde`/`hasta`) y guardar cada mes cerrado.
- Mantener la llave solo en el servidor. Si se filtra o se sospecha que se filtró, avisar de inmediato al administrador de la app: se genera una nueva y la anterior deja de funcionar al instante.
