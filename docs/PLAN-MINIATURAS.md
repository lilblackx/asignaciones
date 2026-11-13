# Plan: miniaturas de las fotos de "Detalles de la orden"

**Estado: pendiente. No implementar todavía.** Se decidió esperar porque, con el volumen actual, no ahorra dinero (ver "Por qué no ahora"). Este documento deja el diseño listo para retomarlo cuando se cumpla alguno de los disparadores.

## Cuándo implementarlo (disparadores)

Corre `npm run medir:fotos -- C:\ruta\a\llave.json` (solo lectura, ver `scripts/medir-fotos-reales.mjs`) y revisa "Qué conviene hacer". Implementar las miniaturas si:

1. Las **descargas estimadas pasan de 50 GB al mes** (la mitad del cupo gratis de 100 GB). El propio script lo avisa.
2. La **oficina se queja de que las fotos tardan en cargar** (Revisión de órdenes y detalle de la orden).
3. El **volumen se multiplica por 10 o más** respecto a ~20 órdenes con fotos al día.
4. Las fotos reales pesan mucho más de lo esperado y bajar el tamaño (1280 px, calidad 60 %) no basta o no se lee bien.

Antes de las miniaturas, probar lo barato: la caché de 60 días de las fotos (ya aplicada, `CACHE_FOTO` en `src/utils/detallesOrden.js`) y bajar `LADO_MAXIMO_FOTO` a 1280 y `CALIDAD_FOTO` a 0.6 (las fotos pesarían ~45 % menos).

## Por qué no ahora

Con ~19–23 órdenes con fotos al día y 7 fotos como máximo:

| Concepto | Uso estimado | Cupo gratis |
|---|---|---|
| Descargas (cada orden vista ~2 veces) | ~3 GB al mes | 100 GB |
| Lecturas de archivos | ~10 mil al mes | 50 mil |
| Almacenamiento (retención de 60 días) | 2,5–3 GB | 5 GB |

Las miniaturas bajarían las descargas, que ya cuestan $0, y **empeorarían** las operaciones (una foto serían 2 archivos al subir y 8 al ver). El beneficio es solo de rapidez con conexión lenta.

## Diseño

### Qué se guarda

Al subir cada foto se crean **dos archivos** a partir de la misma imagen ya leída en el celular (sin volver a decodificarla):

- La foto de siempre: lado largo 1600 px, JPEG 70 % (`01-abc.jpg`, ~250–350 KB).
- Una miniatura: lado largo 320 px, JPEG 60 % (`01-abc-m.jpg`, ~10–25 KB).

La orden guarda las dos rutas, siempre como texto (nunca imágenes dentro de Firestore):

```
detallesOrden: { fotos: [{ ruta, mini, bytes }], subidoPor, subidoEn }
```

**No** poner miniaturas en base64 dentro del documento de la orden: todos los celulares y pantallas de la oficina escuchan las órdenes y las descargarían todas, siempre; gastaría más lecturas de las que ahorra.

### Qué usa cada pantalla

| Pantalla | Usa |
|---|---|
| Cuadrícula de fotos del detalle de la orden (`FotosDeOrden`) | miniaturas |
| Fila de miniaturas del visor (`VisorFotos`) | miniaturas |
| Foto grande del visor | la original, solo la que se está viendo |
| "Corregir fotos" del técnico (`DetallesOrdenCampo`, fotos ya guardadas) | miniaturas |
| Botón "Ver detalles" de Revisión (`VerFotosOrden`) | miniaturas en el visor + la original de la foto abierta |

Una orden sin `mini` (anterior a este cambio) usa la original, así que no hay que migrar nada.

### Cambios por archivo

- `src/utils/detallesOrden.js`: constantes `LADO_MINIATURA = 320` y `CALIDAD_MINIATURA = 0.6`, `nombreDeMiniatura(ruta)` (cambia `.jpg` por `-m.jpg`); `armarDetalles` y `validarDetalles` aceptan y validan `mini` (misma carpeta de la orden, nombre derivado de `ruta`).
- `src/lib/fotosOrden.js`: crear la miniatura desde el mismo bitmap, subirla con el mismo `cacheControl` (si falla la miniatura, la foto se guarda igual sin `mini`); al quitar o cambiar una foto, borrar también su miniatura (`rutasQuitadas` debe incluirla).
- `firestore.rules`: en `fotoDetalleValida`, permitir la clave opcional `mini` (string, mismo patrón, termina en `-m.jpg`, hasta 160 caracteres): `hasOnly(['ruta', 'bytes', 'mini'])` con `hasAll(['ruta', 'bytes'])`.
- `storage.rules`: ya acepta nombres que terminan en `.jpg`; opcional, limitar los `-m.jpg` a 100 KB.
- `src/hooks/useUrlsDeFotos.js`: sin cambios (se le pasan las rutas de las miniaturas, y la de la original solo cuando se abre el visor).
- `src/components/VisorFotos.jsx`: aceptar `miniatura` por foto; mostrarla mientras llega la original (con un fundido).
- `src/components/FotosDeOrden.jsx`, `VerFotosOrden.jsx`, `DetallesOrdenCampo.jsx`: pedir las miniaturas para las listas y la original solo al abrir.
- `scripts/seed-detalles-emulator.mjs`: subir también miniaturas de muestra.
- `scripts/test-detalles-orden.mjs` y `scripts/test-detalles-orden-reglas.mjs`: casos de `mini` válida, de otra orden, sin `mini`, y borrado de ambas al corregir.

### Efecto esperado

- Descarga al abrir "Ver detalles" en Revisión: de ~2,1 MB a ~0,45 MB (7 miniaturas + la foto abierta), un ahorro cercano al 80 %.
- Cuadrícula del detalle: de ~2,1 MB a ~0,14 MB.
- Almacenamiento: +7 % (~0,2 GB).
- Subidas por mes: se duplican (de ~4–5 mil a ~8–10 mil); el exceso sobre el cupo de 5 mil cuesta menos de $0,03 al mes.

### Cómo comprobarlo al terminar

Medir en el navegador, con las herramientas de red, los bytes transferidos al abrir una orden con 7 fotos antes y después, y volver a correr `npm run medir:fotos`.

## Datos de contexto

- Cupos de Cloud Storage for Firebase (plan Blaze, bucket `*.firebasestorage.app` en `us-east1`): 5 GB-mes almacenados, 100 GB al mes de descargas, 5 mil subidas y 50 mil lecturas de archivos al mes. Pasado el cupo se cobra como Google Cloud Storage (operaciones de escritura $0,005 por mil).
- Retención: una regla de ciclo de vida del bucket borra los archivos a los 60 días.
- Compresión actual: lado largo 1600 px, JPEG 70 % (y baja la calidad solo si la foto pasa de 1 MB), sin los datos extra de la cámara.
